import type { Activity } from "./types.js";
import { pairwiseDuelActivity } from "./pairwise-duel/index.js";
import { purchaseValidatorActivity } from "./purchase-validator/index.js";

const activities: Activity<unknown, unknown>[] = [
  pairwiseDuelActivity as Activity<unknown, unknown>,
  purchaseValidatorActivity as Activity<unknown, unknown>,
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
