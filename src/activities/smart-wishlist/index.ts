import {
  querySmartWishlist,
  type SmartWishlistMode,
  type SmartWishlistParams,
  type SmartWishlistResult,
} from "../../query/smart-wishlist.js";
import type { Activity, ActivityContext } from "../types.js";

export interface SmartWishlistRunParams {
  mode?: SmartWishlistMode;
  includeWantToPlay?: boolean;
  includeExpansions?: boolean;
  localLimit?: number;
}

/**
 * Local-only wishlist prioritization (no BGG network calls).
 * Discovery lives in the hotness-scout activity.
 */
export async function runSmartWishlist(
  params: SmartWishlistRunParams,
  ctx: ActivityContext,
): Promise<SmartWishlistResult> {
  const queryParams: SmartWishlistParams = {
    mode: params.mode ?? "balance",
    includeWantToPlay: params.includeWantToPlay !== false,
    includeExpansions: params.includeExpansions === true,
    localLimit: params.localLimit,
  };

  const base = querySmartWishlist(ctx.storage.db, queryParams);
  return {
    ...base,
    discoverySuggestions: [],
    discoveryStatus: {
      available: false,
      message:
        "Los descubrimientos están en la actividad Hotness scout (hot list vs colección).",
    },
  };
}

export const smartWishlistActivity: Activity<
  SmartWishlistRunParams,
  SmartWishlistResult
> = {
  id: "smart-wishlist",
  name: "Wishlist inteligente",
  kind: "analytical",
  description:
    "Prioriza tu wishlist según cómo juegas y filtra por huecos de tu mesa.",
  async run(params, ctx) {
    return runSmartWishlist(params ?? {}, ctx);
  },
};
