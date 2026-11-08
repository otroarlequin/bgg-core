import { createBggClient } from "../bgg/client.js";
import type { AppConfig } from "../config/index.js";
import { requireEffectiveBggCredentials } from "../config/bgg-username.js";
import type { Db } from "../storage/database.js";
import { createStorageService } from "../storage/index.js";
import { getSyncState } from "../storage/repos/sync-state.js";
import { syncCollection } from "./sync-collection.js";
import { syncPlays } from "./sync-plays.js";

export interface IncrementalBggSyncResult {
  username: string;
  collection?: { count: number; incremental: boolean };
  plays?: { count: number; incremental: boolean };
  durationMs: number;
}

/** Shared by POST /api/sync and the cron route so both never run at once. */
let syncInFlight = false;

export function isBggSyncInFlight(): boolean {
  return syncInFlight;
}

export async function runIncrementalBggSync(
  db: Db,
  config: AppConfig,
  options: { collection?: boolean; plays?: boolean } = {},
): Promise<IncrementalBggSyncResult> {
  if (syncInFlight) {
    throw new Error("Ya hay una sincronización en curso. Espera a que termine.");
  }
  const doCollection = options.collection !== false;
  const doPlays = options.plays !== false;

  const started = Date.now();
  syncInFlight = true;
  try {
    const { token, username } = requireEffectiveBggCredentials(db, config);
    const client = createBggClient(token);
    const storage = createStorageService(db);

    const result: IncrementalBggSyncResult = { username, durationMs: 0 };
    if (doCollection) {
      result.collection = await syncCollection(storage, client, username, {
        incremental: true,
      });
    }
    if (doPlays) {
      result.plays = await syncPlays(storage, client, username, {
        incremental: true,
      });
    }
    result.durationMs = Date.now() - started;
    return result;
  } finally {
    syncInFlight = false;
  }
}

/**
 * Daily gate for the scheduled sync. The cron fires twice a day and GitHub
 * schedules drift by hours, so we gate on the last collection sync instead of
 * the clock: anything under `minIntervalHours` is skipped.
 */
export function isDailyBggSyncDue(
  db: Db,
  now: Date = new Date(),
  minIntervalHours = 20,
): { due: boolean; lastSyncedAt: string | null } {
  const lastSyncedAt = getSyncState(db, "collection")?.lastSyncedAt ?? null;
  if (!lastSyncedAt) return { due: true, lastSyncedAt };
  const last = Date.parse(lastSyncedAt);
  if (!Number.isFinite(last)) return { due: true, lastSyncedAt };
  const elapsedHours = (now.getTime() - last) / (60 * 60 * 1000);
  return { due: elapsedHours >= minIntervalHours, lastSyncedAt };
}
