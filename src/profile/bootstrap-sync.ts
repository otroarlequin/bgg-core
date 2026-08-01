import { createBggClient } from "../bgg/client.js";
import { loadConfig, requireBggToken } from "../config/index.js";
import { createStorageService } from "../storage/index.js";
import { syncCollection, syncPlays, syncThings } from "../sync/index.js";
import type { Db } from "../storage/database.js";

export interface ProfileSyncResult {
  username: string;
  collection: { count: number; incremental: boolean };
  plays: { count: number; incremental: boolean; pages?: number };
  things: { requested: number; synced: number; skipped: number };
  durationMs: number;
}

export async function bootstrapProfileSync(
  db: Db,
  username: string,
): Promise<ProfileSyncResult> {
  const started = Date.now();
  const config = loadConfig();
  const token = requireBggToken(config);
  const client = createBggClient(token);
  const storage = createStorageService(db);

  const collection = await syncCollection(storage, client, username, {
    incremental: false,
  });
  const plays = await syncPlays(storage, client, username, {
    incremental: false,
  });
  const things = await syncThings(storage, client, { force: false });

  return {
    username,
    collection,
    plays,
    things,
    durationMs: Date.now() - started,
  };
}
