import {
  queryWishlistStoreMatch,
  type WishlistStoreMatchParams,
  type WishlistStoreMatchResult,
} from "../../query/wishlist-store-match.js";
import type { StoreId } from "../../stores/types.js";
import type { Activity, ActivityContext } from "../types.js";

export interface WishlistStoreMatchRunParams {
  action?: "scan" | "status";
  stores?: StoreId[];
  inStockOnly?: boolean;
  maxItems?: number;
  forceRefresh?: boolean;
  minPriority?: number;
}

export type WishlistStoreMatchOutput = WishlistStoreMatchResult;

export async function runWishlistStoreMatch(
  params: WishlistStoreMatchRunParams,
  ctx: ActivityContext,
): Promise<WishlistStoreMatchOutput> {
  const action = params.action ?? "scan";
  if (action === "status") {
    return {
      message:
        "Listo para escanear. Uso personal: consultas con rate limit y caché 24h.",
      scanned: 0,
      cacheHits: 0,
      networkCalls: 0,
      matches: [],
      ambiguous: [],
      noOffer: 0,
      errors: [],
    };
  }

  const queryParams: WishlistStoreMatchParams = {
    stores: params.stores,
    inStockOnly: params.inStockOnly,
    maxItems: params.maxItems,
    forceRefresh: params.forceRefresh,
    minPriority: params.minPriority,
  };

  return queryWishlistStoreMatch(ctx.storage.db, queryParams);
}

export const wishlistStoreMatchActivity: Activity<
  WishlistStoreMatchRunParams,
  WishlistStoreMatchOutput
> = {
  id: "wishlist-store-match",
  name: "Wishlist × tiendas",
  kind: "analytical",
  description:
    "Busca ofertas de tu wishlist en Game Nerdz y Miniature Market (uso personal).",
  run: runWishlistStoreMatch,
};
