import type { MarketFetchFn, MarketListing } from "../bgg/marketplace.js";
import type { Db } from "../storage/database.js";
import { insertMarketAlertIfNew } from "../storage/repos/market-alerts.js";
import {
  type MarketPriceWatch,
  listEnabledMarketPriceWatches,
} from "../storage/repos/market-price-watches.js";
import {
  getMarketListingsCache,
  setMarketListingsCache,
} from "../storage/repos/market-listings-cache.js";
import { insertWatchNotificationIfNew } from "../storage/repos/market-watch-notifications.js";
import {
  getMarketWatchCronEnabled,
  getNotifyEmail,
} from "../storage/repos/notification-settings.js";
import { queryCollection } from "./collection.js";
import type { SendMarketDigestFn } from "../notify/resend.js";

export interface WatchMatchHit {
  bggId: number;
  gameName: string;
  listing: MarketListing;
  watch: MarketPriceWatch;
  ceiling: number;
}

export interface MarketWatchCronResult {
  ok: boolean;
  skipped: boolean;
  reason?: string;
  watchesChecked: number;
  listingsMatched: number;
  newAlerts: number;
  emailsSent: number;
  errors: string[];
}

const PRICE_EPSILON = 0.001;

export function effectivePriceCeiling(
  maxPrice: number,
  tolerancePct: number,
): number {
  const raw = maxPrice * (1 + tolerancePct / 100);
  return Math.round(raw * 100) / 100;
}

export function listingMatchesWatch(
  listing: MarketListing,
  watch: Pick<MarketPriceWatch, "maxPrice" | "tolerancePct" | "currency">,
): boolean {
  if (listing.price == null || !Number.isFinite(listing.price)) return false;
  const listingCurrency = listing.currency?.trim().toUpperCase();
  const watchCurrency = watch.currency.trim().toUpperCase();
  if (!listingCurrency || listingCurrency !== watchCurrency) return false;
  const ceiling = effectivePriceCeiling(watch.maxPrice, watch.tolerancePct);
  return listing.price <= ceiling + PRICE_EPSILON;
}

export function findWatchMatchesForListings(
  listings: MarketListing[],
  watch: MarketPriceWatch,
): WatchMatchHit[] {
  const ceiling = effectivePriceCeiling(watch.maxPrice, watch.tolerancePct);
  return listings
    .filter((listing) => listingMatchesWatch(listing, watch))
    .map((listing) => ({
      bggId: watch.bggId,
      gameName: "",
      listing,
      watch,
      ceiling,
    }));
}

function gameNameForBggId(
  db: Db,
  bggId: number,
  fallback?: string,
): string {
  const row = db
    .prepare(`SELECT name FROM collection_entries WHERE bgg_id = ? LIMIT 1`)
    .get(bggId) as { name: string } | undefined;
  return row?.name ?? fallback ?? String(bggId);
}

export async function runMarketWatchCron(
  db: Db,
  options: {
    fetchMarket: MarketFetchFn;
    sendDigest?: SendMarketDigestFn;
    force?: boolean;
  },
): Promise<MarketWatchCronResult> {
  if (!options.force && !getMarketWatchCronEnabled(db)) {
    return {
      ok: true,
      skipped: true,
      reason: "market_watch_cron_disabled",
      watchesChecked: 0,
      listingsMatched: 0,
      newAlerts: 0,
      emailsSent: 0,
      errors: [],
    };
  }

  const watches = listEnabledMarketPriceWatches(db);
  if (watches.length === 0) {
    return {
      ok: true,
      skipped: true,
      reason: "no_enabled_watches",
      watchesChecked: 0,
      listingsMatched: 0,
      newAlerts: 0,
      emailsSent: 0,
      errors: [],
    };
  }

  const errors: string[] = [];
  let listingsMatched = 0;
  let newAlerts = 0;
  const digestHits: WatchMatchHit[] = [];

  const ids = watches.map((w) => w.bggId);
  let fetchResults: Awaited<ReturnType<MarketFetchFn>>;
  const missingIds: number[] = [];
  const listingsById = new Map<number, MarketListing[]>();
  const namesById = new Map<number, string>();

  for (const id of ids) {
    const cached = getMarketListingsCache(db, id);
    if (cached) {
      listingsById.set(id, cached.listings);
    } else {
      missingIds.push(id);
    }
  }

  try {
    if (missingIds.length > 0) {
      fetchResults = await options.fetchMarket(missingIds);
      for (const result of fetchResults) {
        listingsById.set(result.bggId, result.listings);
        namesById.set(result.bggId, result.name);
        setMarketListingsCache(db, result.bggId, result.listings);
      }
      for (const id of missingIds) {
        if (!listingsById.has(id)) {
          listingsById.set(id, []);
          setMarketListingsCache(db, id, []);
        }
      }
    }
  } catch (error) {
    return {
      ok: false,
      skipped: false,
      watchesChecked: watches.length,
      listingsMatched: 0,
      newAlerts: 0,
      emailsSent: 0,
      errors: [error instanceof Error ? error.message : String(error)],
    };
  }

  for (const watch of watches) {
    const listings = listingsById.get(watch.bggId) ?? [];
    const gameName = gameNameForBggId(
      db,
      watch.bggId,
      namesById.get(watch.bggId),
    );

    for (const listing of listings) {
      if (!listingMatchesWatch(listing, watch)) continue;
      listingsMatched += 1;

      const isNewNotification = insertWatchNotificationIfNew(
        db,
        watch.bggId,
        listing.listingKey,
      );
      if (!isNewNotification) continue;

      const inserted = insertMarketAlertIfNew(db, {
        bggId: watch.bggId,
        listingKey: listing.listingKey,
        gameName,
        price: listing.price,
        currency: listing.currency,
        condition: listing.condition,
        url: listing.url,
      });
      if (inserted) newAlerts += 1;

      digestHits.push({
        bggId: watch.bggId,
        gameName,
        listing,
        watch,
        ceiling: effectivePriceCeiling(watch.maxPrice, watch.tolerancePct),
      });
    }
  }

  let emailsSent = 0;
  const notifyEmail = getNotifyEmail(db);
  if (digestHits.length > 0 && notifyEmail && options.sendDigest) {
    try {
      await options.sendDigest({
        to: notifyEmail,
        hits: digestHits,
      });
      emailsSent = 1;
    } catch (error) {
      errors.push(
        `Email: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  return {
    ok: errors.length === 0,
    skipped: false,
    watchesChecked: watches.length,
    listingsMatched,
    newAlerts,
    emailsSent,
    errors,
  };
}

/** Wishlist entries for the price-watch picker UI. */
export function listWishlistForPriceWatches(db: Db) {
  return queryCollection(db, {
    wishlist: true,
    includeExpansions: true,
    sortBy: "name",
  });
}
