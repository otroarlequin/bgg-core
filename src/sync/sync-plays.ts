import type { BggClient } from "../bgg/client.js";
import { mapPlayItem, subtractDays } from "../bgg/mappers.js";
import type { StorageService } from "../storage/index.js";

export interface SyncPlaysResult {
  count: number;
  pages: number;
  incremental: boolean;
}

export async function syncPlays(
  storage: StorageService,
  client: BggClient,
  username: string,
  options: { incremental?: boolean } = {},
): Promise<SyncPlaysResult> {
  const incremental = options.incremental ?? true;
  const previous = storage.syncState.getSyncState(storage.db, "plays");

  let mindate: string | undefined;
  if (incremental && previous?.lastSyncedAt) {
    mindate = subtractDays(previous.lastSyncedAt.slice(0, 10), 1);
  }

  let page = 1;
  let total = 0;
  let count = 0;
  const batch: ReturnType<typeof mapPlayItem>[] = [];

  do {
    const result = await client.getPlays({
      username,
      page,
      mindate,
    });

    total = result.plays.total ?? 0;
    const plays = result.plays.play ?? [];
    if (plays.length === 0) break;

    for (const play of plays) {
      batch.push(mapPlayItem(play, new Date().toISOString()));
    }

    if (batch.length >= 100) {
      count += storage.plays.upsertPlays(storage.db, batch.splice(0, batch.length));
    }

    page += 1;
  } while ((page - 1) * 100 < total);

  if (batch.length > 0) {
    count += storage.plays.upsertPlays(storage.db, batch);
  }

  storage.syncState.setSyncState(
    storage.db,
    "plays",
    new Date().toISOString(),
    { count, pages: page - 1, incremental: incremental && !!previous, mindate },
  );

  return { count, pages: page - 1, incremental: incremental && !!previous };
}
