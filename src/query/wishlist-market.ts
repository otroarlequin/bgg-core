import type { MarketFetchFn, MarketListing } from "../bgg/marketplace.js";
import type { Db } from "../storage/database.js";
import {
  countUnreadMarketAlerts,
  insertMarketAlertIfNew,
  listUnreadMarketAlerts,
  markMarketAlertsRead,
  type MarketAlert,
} from "../storage/repos/market-alerts.js";
import {
  getMarketListingsCache,
  setMarketListingsCache,
} from "../storage/repos/market-listings-cache.js";
import { queryCollection } from "./collection.js";

export type MarketSortBy = "priceAsc" | "priceDesc" | "dateDesc" | "name";

export interface WishlistMarketParams {
  forceRefresh?: boolean;
  maxItems?: number;
  minPriority?: number;
  conditions?: string[];
  maxPrice?: number;
  currencies?: string[];
  sortBy?: MarketSortBy;
  cacheTtlHours?: number;
  /** Only read cache; never call BGG or write empty cache rows. */
  cacheOnly?: boolean;
  /** Inject market fetch for tests / live scan. */
  fetchMarket?: MarketFetchFn;
}

export interface WishlistMarketGameMatch {
  bggId: number;
  name: string;
  thumbnailUrl: string | null;
  wishlistPriority: number | null;
  listings: MarketListing[];
}

export interface WishlistMarketResult {
  message: string;
  scanned: number;
  withListings: number;
  noListing: number;
  cacheHits: number;
  networkCalls: number;
  newAlerts: number;
  alertsUnread: number;
  alerts: MarketAlert[];
  matches: WishlistMarketGameMatch[];
  errors: Array<{ batch: string; error: string }>;
}

function normalizeCondition(value: string): string {
  return value.trim().toLowerCase();
}

export function filterAndSortListings(
  listings: MarketListing[],
  params: Pick<
    WishlistMarketParams,
    "conditions" | "maxPrice" | "currencies" | "sortBy"
  >,
): MarketListing[] {
  const conditions = params.conditions?.map(normalizeCondition).filter(Boolean);
  const currencies = params.currencies
    ?.map((c) => c.trim().toUpperCase())
    .filter(Boolean);
  const maxPrice = params.maxPrice;
  const sortBy = params.sortBy ?? "priceAsc";

  let out = [...listings];
  if (conditions?.length) {
    out = out.filter(
      (l) => l.condition != null && conditions.includes(l.condition),
    );
  }
  if (maxPrice != null && Number.isFinite(maxPrice)) {
    out = out.filter((l) => l.price != null && l.price <= maxPrice);
  }
  if (currencies?.length) {
    out = out.filter(
      (l) =>
        l.currency != null && currencies.includes(l.currency.toUpperCase()),
    );
  }

  out.sort((a, b) => {
    if (sortBy === "name") {
      return (a.url ?? "").localeCompare(b.url ?? "");
    }
    if (sortBy === "dateDesc") {
      const ad = a.listDate ?? "";
      const bd = b.listDate ?? "";
      return bd.localeCompare(ad);
    }
    const ap = a.price;
    const bp = b.price;
    if (ap == null && bp == null) return 0;
    if (ap == null) return 1;
    if (bp == null) return -1;
    return sortBy === "priceDesc" ? bp - ap : ap - bp;
  });

  return out;
}

export async function queryWishlistMarket(
  db: Db,
  params: WishlistMarketParams = {},
): Promise<WishlistMarketResult> {
  const forceRefresh = params.forceRefresh === true;
  const cacheOnly = params.cacheOnly === true;
  const maxItems = Math.min(100, Math.max(1, params.maxItems ?? 40));
  const ttlHours = params.cacheTtlHours ?? 12;
  const fetchMarket = params.fetchMarket;

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

  const matches: WishlistMarketGameMatch[] = [];
  const errors: Array<{ batch: string; error: string }> = [];
  let cacheHits = 0;
  let networkCalls = 0;
  let newAlerts = 0;
  let noListing = 0;

  const missingIds: number[] = [];
  const listingsById = new Map<number, MarketListing[]>();

  for (const item of wishlist) {
    if (!forceRefresh || cacheOnly) {
      const cached = getMarketListingsCache(db, item.bggId);
      if (cached) {
        listingsById.set(item.bggId, cached.listings);
        cacheHits += 1;
        continue;
      }
    }
    if (!cacheOnly) missingIds.push(item.bggId);
  }

  if (missingIds.length > 0) {
    if (!fetchMarket) {
      throw new Error("fetchMarket requerido para consultar BGG Market");
    }
    try {
      networkCalls = Math.ceil(missingIds.length / 20);
      const results = await fetchMarket(missingIds);
      const seen = new Set<number>();
      for (const result of results) {
        seen.add(result.bggId);
        listingsById.set(result.bggId, result.listings);
        setMarketListingsCache(db, result.bggId, result.listings, ttlHours);
        for (const listing of result.listings) {
          const inserted = insertMarketAlertIfNew(db, {
            bggId: result.bggId,
            listingKey: listing.listingKey,
            gameName: result.name || wishlist.find((w) => w.bggId === result.bggId)?.name || String(result.bggId),
            price: listing.price,
            currency: listing.currency,
            condition: listing.condition,
            url: listing.url,
          });
          if (inserted) newAlerts += 1;
        }
      }
      for (const id of missingIds) {
        if (!seen.has(id)) {
          listingsById.set(id, []);
          setMarketListingsCache(db, id, [], ttlHours);
        }
      }
    } catch (error) {
      errors.push({
        batch: missingIds.slice(0, 8).join(","),
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  for (const item of wishlist) {
    const listings = listingsById.get(item.bggId) ?? [];
    const filtered = filterAndSortListings(listings, params);
    if (filtered.length === 0) {
      noListing += 1;
      continue;
    }
    matches.push({
      bggId: item.bggId,
      name: item.name,
      thumbnailUrl: item.thumbnailUrl,
      wishlistPriority: item.wishlistPriority,
      listings: filtered,
    });
  }

  // Sort games by cheapest listing under current sort (priceAsc default)
  const sortBy = params.sortBy ?? "priceAsc";
  if (sortBy === "priceAsc" || sortBy === "priceDesc") {
    matches.sort((a, b) => {
      const ap = a.listings[0]?.price;
      const bp = b.listings[0]?.price;
      if (ap == null && bp == null) return a.name.localeCompare(b.name);
      if (ap == null) return 1;
      if (bp == null) return -1;
      return sortBy === "priceDesc" ? bp - ap : ap - bp;
    });
  } else if (sortBy === "name") {
    matches.sort((a, b) =>
      a.name.localeCompare(b.name, "es", { sensitivity: "base" }),
    );
  }

  const alerts = listUnreadMarketAlerts(db);
  const alertsUnread = countUnreadMarketAlerts(db);
  const withListings = matches.length;

  const message =
    withListings > 0
      ? `Market: ${withListings} juegos con ofertas (${alertsUnread} novedades sin revisar).`
      : `Sin ofertas en Market para ${wishlist.length} juegos escaneados.`;

  return {
    message,
    scanned: wishlist.length,
    withListings,
    noListing,
    cacheHits,
    networkCalls: missingIds.length === 0 ? 0 : networkCalls,
    newAlerts,
    alertsUnread,
    alerts,
    matches,
    errors,
  };
}

export function markWishlistMarketAlertsRead(
  db: Db,
  alertIds?: number[],
): { marked: number; alertsUnread: number } {
  const marked = markMarketAlertsRead(db, alertIds);
  return { marked, alertsUnread: countUnreadMarketAlerts(db) };
}

export function getWishlistMarketAlertStatus(db: Db): {
  alertsUnread: number;
  alerts: MarketAlert[];
} {
  return {
    alertsUnread: countUnreadMarketAlerts(db),
    alerts: listUnreadMarketAlerts(db),
  };
}
