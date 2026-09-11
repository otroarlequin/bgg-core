import type { Activity } from "./types.js";
import { hotnessScoutActivity } from "./hotness-scout/index.js";
import { pairwiseDuelActivity } from "./pairwise-duel/index.js";
import { purchaseValidatorActivity } from "./purchase-validator/index.js";
import { gameCompareActivity } from "./game-compare/index.js";
import { smartWishlistActivity } from "./smart-wishlist/index.js";
import { wishlistStoreMatchActivity } from "./wishlist-store-match/index.js";
import { wishlistMarketActivity } from "./wishlist-market/index.js";
import { insightsActivity } from "./insights/index.js";

const activities: Activity<unknown, unknown>[] = [
  pairwiseDuelActivity as Activity<unknown, unknown>,
  purchaseValidatorActivity as Activity<unknown, unknown>,
  gameCompareActivity as Activity<unknown, unknown>,
  smartWishlistActivity as Activity<unknown, unknown>,
  hotnessScoutActivity as Activity<unknown, unknown>,
  wishlistStoreMatchActivity as Activity<unknown, unknown>,
  wishlistMarketActivity as Activity<unknown, unknown>,
  insightsActivity as Activity<unknown, unknown>,
];

const registry = new Map(activities.map((a) => [a.id, a]));

export function listActivities(): Activity<unknown, unknown>[] {
  return [...activities];
}

export function getActivity(id: string): Activity<unknown, unknown> | undefined {
  return registry.get(id);
}

export function requireActivity(id: string): Activity<unknown, unknown> {
  const activity = getActivity(id);
  if (!activity) {
    throw new Error(
      `Actividad desconocida: ${id}. Disponibles: ${listActivities().map((a) => a.id).join(", ")}`,
    );
  }
  return activity;
}
