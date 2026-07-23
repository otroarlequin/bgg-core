import type { BggClient } from "../bgg/client.js";
import {
  formatModifiedSince,
  mapCollectionItemToEntry,
} from "../bgg/mappers.js";
import type { BggCollectionItem } from "bgg-api-ts";
import type { CollectionEntry } from "../domain/types.js";
import type { StorageService } from "../storage/index.js";

export interface SyncCollectionResult {
  count: number;
  incremental: boolean;
}

async function fetchCollectionPart(
  client: BggClient,
  username: string,
  params: Record<string, string | boolean | number | undefined>,
): Promise<CollectionEntry[]> {
  const syncedAt = new Date().toISOString();
  const result = await client.getCollection({
    username,
    stats: true,
    ...params,
  });

  const items = result.items.item ?? [];
  return items.map((item: BggCollectionItem) =>
    mapCollectionItemToEntry(item as Parameters<typeof mapCollectionItemToEntry>[0], syncedAt),
  );
}

export async function syncCollection(
  storage: StorageService,
  client: BggClient,
  username: string,
  options: { incremental?: boolean } = {},
): Promise<SyncCollectionResult> {
  const incremental = options.incremental ?? true;
  const previous = storage.syncState.getSyncState(storage.db, "collection");

  const baseParams: Record<string, string | boolean> = {
    stats: true,
    excludesubtype: "boardgameexpansion",
  };
  const expansionParams: Record<string, string | boolean> = {
    stats: true,
    subtype: "boardgameexpansion",
  };

  if (incremental && previous?.lastSyncedAt) {
    const modifiedSince = formatModifiedSince(previous.lastSyncedAt);
    baseParams.modifiedsince = modifiedSince;
    expansionParams.modifiedsince = modifiedSince;
  }

  const baseGames = await fetchCollectionPart(client, username, baseParams);
  const expansions = await fetchCollectionPart(client, username, expansionParams);

  const entries = [...baseGames, ...expansions];
  const count = storage.collection.upsertCollectionEntries(storage.db, entries);

  storage.syncState.setSyncState(
    storage.db,
    "collection",
    new Date().toISOString(),
    { entryCount: count, incremental: incremental && !!previous },
  );

  return { count, incremental: incremental && !!previous };
}
