import type { Db } from "../storage/database.js";
import {
  getStoreSearchCache,
  setStoreSearchCache,
} from "../storage/repos/store-search-cache.js";
import {
  STORE_IDS,
  storeSearchers,
  type StoreId,
  type StoreOffer,
  type StoreSearchError,
} from "../stores/index.js";
import {
  TITLE_AMBIGUOUS_MIN,
  TITLE_MATCH_THRESHOLD,
  applyPublisherSignal,
  buildSearchQuery,
  scoreTitleMatch,
} from "../utils/title-match.js";
import { queryCollection } from "./collection.js";

export interface ScoredStoreOffer extends StoreOffer {
  score: number;
}

export interface WishlistStoreMatchItem {
  bggId: number;
  name: string;
  thumbnailUrl: string | null;
  wishlistPriority: number | null;
  offers: ScoredStoreOffer[];
}

export interface WishlistStoreAmbiguousItem {
  bggId: number;
  name: string;
  wishlistPriority: number | null;
  candidates: ScoredStoreOffer[];
}

export interface WishlistStoreMatchParams {
  stores?: StoreId[];
  inStockOnly?: boolean;
  maxItems?: number;
  forceRefresh?: boolean;
  minPriority?: number;
  /** Inject searchers for tests. */
  searchers?: Partial<Record<StoreId, typeof storeSearchers.gamenerdz>>;
  cacheTtlHours?: number;
}

export interface WishlistStoreMatchResult {
  message: string;
  scanned: number;
  cacheHits: number;
  networkCalls: number;
  matches: WishlistStoreMatchItem[];
  ambiguous: WishlistStoreAmbiguousItem[];
  noOffer: number;
  errors: StoreSearchError[];
}

function pickStores(requested?: StoreId[]): StoreId[] {
  if (!requested?.length) return [...STORE_IDS];
  return STORE_IDS.filter((id) => requested.includes(id));
}

function filterOffers(
  offers: StoreOffer[],
  inStockOnly: boolean,
): StoreOffer[] {
  if (!inStockOnly) return offers;
  return offers.filter((o) => o.inStock !== false);
}

export async function queryWishlistStoreMatch(
  db: Db,
  params: WishlistStoreMatchParams = {},
): Promise<WishlistStoreMatchResult> {
  const stores = pickStores(params.stores);
  const inStockOnly = params.inStockOnly === true;
  const maxItems = Math.min(100, Math.max(1, params.maxItems ?? 40));
  const forceRefresh = params.forceRefresh === true;
  const ttlHours = params.cacheTtlHours ?? 24;
  const searchers = { ...storeSearchers, ...params.searchers };

  let wishlist = queryCollection(db, {
    wishlist: true,
    includeExpansions: true,
    sortBy: "name",
  });

  if (params.minPriority != null) {
    const min = params.minPriority;
    wishlist = wishlist.filter(
      (item) =>
        item.wishlistPriority != null && item.wishlistPriority <= min,
    );
  }

  wishlist = [...wishlist].sort((a, b) => {
    const ap = a.wishlistPriority ?? 99;
    const bp = b.wishlistPriority ?? 99;
    if (ap !== bp) return ap - bp;
    return a.name.localeCompare(b.name, "es", { sensitivity: "base" });
  });

  wishlist = wishlist.slice(0, maxItems);

  const matches: WishlistStoreMatchItem[] = [];
  const ambiguous: WishlistStoreAmbiguousItem[] = [];
  const errors: StoreSearchError[] = [];
  let cacheHits = 0;
  let networkCalls = 0;
  let noOffer = 0;

  for (const item of wishlist) {
    const query = buildSearchQuery(item.name);
    const queryKey = query.toLowerCase();
    const scored: ScoredStoreOffer[] = [];
    const bggPublishers = item.gamePublishers ?? [];

    for (const store of stores) {
      let offers: StoreOffer[] | null = null;

      if (!forceRefresh) {
        const cached = getStoreSearchCache(db, store, queryKey);
        if (cached) {
          offers = cached.offers;
          cacheHits += 1;
        }
      }

      if (!offers) {
        try {
          networkCalls += 1;
          offers = await searchers[store](query, { limit: 10 });
          setStoreSearchCache(db, store, queryKey, offers, ttlHours);
        } catch (error) {
          errors.push({
            store,
            query,
            error: error instanceof Error ? error.message : String(error),
          });
          continue;
        }
      }

      for (const offer of filterOffers(offers, inStockOnly)) {
        const titleScore = scoreTitleMatch(item.name, offer.name);
        const score = applyPublisherSignal(
          titleScore,
          bggPublishers,
          offer.publisher,
        );
        if (score >= TITLE_AMBIGUOUS_MIN) {
          scored.push({ ...offer, score });
        }
      }
    }

    scored.sort((a, b) => b.score - a.score || (a.price ?? 1e9) - (b.price ?? 1e9));

    const strong = scored.filter((o) => o.score >= TITLE_MATCH_THRESHOLD);
    if (strong.length > 0) {
      // Best offer per store among strong matches
      const byStore = new Map<StoreId, ScoredStoreOffer>();
      for (const offer of strong) {
        const prev = byStore.get(offer.store);
        if (!prev || offer.score > prev.score || (offer.score === prev.score && (offer.price ?? 1e9) < (prev.price ?? 1e9))) {
          byStore.set(offer.store, offer);
        }
      }
      matches.push({
        bggId: item.bggId,
        name: item.name,
        thumbnailUrl: item.thumbnailUrl,
        wishlistPriority: item.wishlistPriority,
        offers: [...byStore.values()].sort(
          (a, b) => (a.price ?? 1e9) - (b.price ?? 1e9),
        ),
      });
    } else if (scored.length > 0) {
      ambiguous.push({
        bggId: item.bggId,
        name: item.name,
        wishlistPriority: item.wishlistPriority,
        candidates: scored.slice(0, 6),
      });
    } else {
      noOffer += 1;
    }
  }

  matches.sort((a, b) => {
    const ap = a.wishlistPriority ?? 99;
    const bp = b.wishlistPriority ?? 99;
    if (ap !== bp) return ap - bp;
    return a.name.localeCompare(b.name, "es", { sensitivity: "base" });
  });

  const message =
    matches.length > 0
      ? `Encontradas ${matches.length} coincidencias en ${stores.join(" + ")}.`
      : `Sin coincidencias fuertes (${wishlist.length} juegos escaneados).`;

  return {
    message,
    scanned: wishlist.length,
    cacheHits,
    networkCalls,
    matches,
    ambiguous,
    noOffer,
    errors,
  };
}
