import type { BggClient } from "../bgg/client.js";
import { chunkArray, mapThingItemToGame } from "../bgg/mappers.js";
import type { StorageService } from "../storage/index.js";

const THING_BATCH_SIZE = 20;

export interface SyncThingsResult {
  requested: number;
  synced: number;
  skipped: number;
}

export async function syncThings(
  storage: StorageService,
  client: BggClient,
  options: { bggIds?: number[]; force?: boolean } = {},
): Promise<SyncThingsResult> {
  const allIds =
    options.bggIds ??
    [
      ...new Set([
        ...storage.collection.getDistinctCollectionBggIds(storage.db),
        ...storage.games.getAllKnownBggIds(storage.db),
      ]),
    ];

  const now = new Date().toISOString();
  let idsToSync = allIds;

  if (!options.force) {
    idsToSync = storage.games.getGamesNeedingSync(storage.db, allIds);
  }

  const skipped = allIds.length - idsToSync.length;
  const batches = chunkArray(idsToSync, THING_BATCH_SIZE);
  let synced = 0;

  for (const batch of batches) {
    if (batch.length === 0) continue;
    const result = await client.getThing(batch, { stats: true });
    const items = result.items.item ?? [];
    const itemList = Array.isArray(items) ? items : [items];

    for (const item of itemList) {
      const game = mapThingItemToGame(item, now);
      storage.games.upsertGame(storage.db, game);
      synced += 1;
    }
  }

  storage.syncState.setSyncState(storage.db, "things", now, {
    requested: allIds.length,
    synced,
    skipped,
  });

  return { requested: allIds.length, synced, skipped };
}
