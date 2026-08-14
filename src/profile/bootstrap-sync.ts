import { createBggClient } from "../bgg/client.js";
import { loadConfig, requireBggToken } from "../config/index.js";
import { createStorageService } from "../storage/index.js";
import { syncCollection, syncPlays, syncThings } from "../sync/index.js";
import type { Db } from "../storage/database.js";

export type ProfileSyncStage =
  | "session"
  | "collection"
  | "plays"
  | "things"
  | "done";

export interface ProfileSyncProgress {
  type: "progress";
  stage: ProfileSyncStage;
  label: string;
  percent: number;
}

export interface ProfileSyncResult {
  username: string;
  collection: { count: number; incremental: boolean };
  plays: { count: number; incremental: boolean; pages?: number };
  things: { requested: number; synced: number; skipped: number };
  durationMs: number;
  playsMindate: string | null;
  thingsScope: "priority" | "all";
}

/** How many years of plays to pull for profile (default 1). */
function profilePlaysMindate(): string {
  const years = Math.max(1, Number(process.env.PROFILE_PLAYS_YEARS ?? 1));
  const d = new Date();
  d.setUTCFullYear(d.getUTCFullYear() - years);
  return d.toISOString().slice(0, 10);
}

export async function bootstrapProfileSync(
  db: Db,
  username: string,
  onProgress?: (event: ProfileSyncProgress) => void | Promise<void>,
): Promise<ProfileSyncResult> {
  const started = Date.now();
  const report = async (
    stage: ProfileSyncStage,
    label: string,
    percent: number,
  ) => {
    await onProgress?.({ type: "progress", stage, label, percent });
  };

  const config = loadConfig();
  const token = requireBggToken(config);
  const client = createBggClient(token);
  const storage = createStorageService(db);
  const playsMindate = profilePlaysMindate();

  await report("collection", "Descargando colección desde BGG…", 12);
  const collection = await syncCollection(storage, client, username, {
    incremental: false,
  });

  await report(
    "plays",
    `Descargando partidas desde ${playsMindate}…`,
    40,
  );
  const plays = await syncPlays(storage, client, username, {
    incremental: false,
    mindate: playsMindate,
  });

  // Metadata only for owned / wishlist / want-to-play / preordered — much faster.
  const priorityIds = storage.collection.getProfilePriorityBggIds(storage.db);
  await report(
    "things",
    `Enriqueciendo metadatos (${priorityIds.length} juegos prioritarios)…`,
    72,
  );
  const things = await syncThings(storage, client, {
    bggIds: priorityIds,
    force: false,
  });

  await report("done", "Listo", 100);

  return {
    username,
    collection,
    plays,
    things,
    durationMs: Date.now() - started,
    playsMindate,
    thingsScope: "priority",
  };
}
