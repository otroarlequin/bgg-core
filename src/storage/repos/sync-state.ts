import type { SyncResource } from "../../domain/types.js";
import type { Db } from "../database.js";

export function getSyncState(
  db: Db,
  resource: SyncResource,
): { lastSyncedAt: string; metadata: Record<string, unknown> | null } | null {
  const row = db
    .prepare("SELECT last_synced_at, metadata FROM sync_state WHERE resource = ?")
    .get(resource) as
    | { last_synced_at: string; metadata: string | null }
    | undefined;

  if (!row) return null;

  let metadata: Record<string, unknown> | null = null;
  if (row.metadata) {
    try {
      metadata = JSON.parse(row.metadata) as Record<string, unknown>;
    } catch {
      metadata = null;
    }
  }

  return { lastSyncedAt: row.last_synced_at, metadata };
}

export function setSyncState(
  db: Db,
  resource: SyncResource,
  lastSyncedAt: string,
  metadata?: Record<string, unknown>,
): void {
  db.prepare(
    `INSERT INTO sync_state (resource, last_synced_at, metadata)
     VALUES (@resource, @lastSyncedAt, @metadata)
     ON CONFLICT(resource) DO UPDATE SET
       last_synced_at = excluded.last_synced_at,
       metadata = excluded.metadata`,
  ).run({
    resource,
    lastSyncedAt,
    metadata: metadata ? JSON.stringify(metadata) : null,
  });
}
