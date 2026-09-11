import { createBggClient } from "../../bgg/client.js";
import { createMarketFetchFn } from "../../bgg/marketplace.js";
import { loadConfig, requireBggToken } from "../../config/index.js";
import {
  getWishlistMarketAlertStatus,
  markWishlistMarketAlertsRead,
  queryWishlistMarket,
  type MarketSortBy,
  type WishlistMarketResult,
} from "../../query/wishlist-market.js";
import type { Activity, ActivityContext } from "../types.js";

export interface WishlistMarketRunParams {
  action?: "scan" | "status" | "listAlerts" | "markAlertsRead";
  forceRefresh?: boolean;
  maxItems?: number;
  minPriority?: number;
  conditions?: string[];
  maxPrice?: number;
  currencies?: string[];
  sortBy?: MarketSortBy;
  alertIds?: number[];
}

export type WishlistMarketOutput = WishlistMarketResult & {
  marked?: number;
};

function buildClient() {
  return createBggClient(requireBggToken(loadConfig()));
}

export async function runWishlistMarket(
  params: WishlistMarketRunParams,
  ctx: ActivityContext,
): Promise<WishlistMarketOutput> {
  const action = params.action ?? "scan";
  const db = ctx.storage.db;

  if (action === "listAlerts") {
    const status = getWishlistMarketAlertStatus(db);
    return {
      message: `${status.alertsUnread} alerta${status.alertsUnread === 1 ? "" : "s"} de precio sin revisar.`,
      scanned: 0,
      withListings: 0,
      noListing: 0,
      cacheHits: 0,
      networkCalls: 0,
      newAlerts: 0,
      alertsUnread: status.alertsUnread,
      alerts: status.alerts,
      matches: [],
      errors: [],
    };
  }

  if (action === "markAlertsRead") {
    const { marked, alertsUnread } = markWishlistMarketAlertsRead(
      db,
      params.alertIds,
    );
    const status = getWishlistMarketAlertStatus(db);
    return {
      message:
        marked > 0
          ? `Marcadas ${marked} alertas como leídas.`
          : "No había alertas pendientes.",
      scanned: 0,
      withListings: 0,
      noListing: 0,
      cacheHits: 0,
      networkCalls: 0,
      newAlerts: 0,
      alertsUnread,
      alerts: status.alerts,
      matches: [],
      errors: [],
      marked,
    };
  }

  if (action === "status") {
    return queryWishlistMarket(db, {
      cacheOnly: true,
      forceRefresh: false,
      maxItems: params.maxItems,
      minPriority: params.minPriority,
      conditions: params.conditions,
      maxPrice: params.maxPrice,
      currencies: params.currencies,
      sortBy: params.sortBy ?? "priceAsc",
    });
  }

  return queryWishlistMarket(db, {
    forceRefresh: params.forceRefresh,
    maxItems: params.maxItems,
    minPriority: params.minPriority,
    conditions: params.conditions,
    maxPrice: params.maxPrice,
    currencies: params.currencies,
    sortBy: params.sortBy ?? "priceAsc",
    fetchMarket: createMarketFetchFn(buildClient()),
  });
}

export const wishlistMarketActivity: Activity<
  WishlistMarketRunParams,
  WishlistMarketOutput
> = {
  id: "wishlist-market",
  name: "Wishlist × BGG Market",
  kind: "analytical",
  description:
    "Ofertas de GeekMarket para tu wishlist y alertas de precio por juego.",
  run: runWishlistMarket,
};
