import type { Db } from "../database.js";
import type { BrowseRankItem } from "../../bgg/browse-ranks.js";

const CACHE_KEY = "boardgame-top-100";

export function ensureBggTopRanksCacheTable(db: Db): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS bgg_top_ranks_cache (
      cache_key TEXT PRIMARY KEY NOT NULL,
      payload_json TEXT NOT NULL,
      fetched_at TEXT NOT NULL,
      expires_at TEXT NOT NULL
    );
  `);
}

export function getBggTop100Cache(
  db: Db,
  nowIso = new Date().toISOString(),
): { items: BrowseRankItem[]; fetchedAt: string } | null {
  ensureBggTopRanksCacheTable(db);
  const row = db
    .prepare(
      `SELECT payload_json, fetched_at, expires_at
       FROM bgg_top_ranks_cache
       WHERE cache_key = ?`,
    )
    .get(CACHE_KEY) as
    | { payload_json: string; fetched_at: string; expires_at: string }
    | undefined;
  if (!row || row.expires_at < nowIso) return null;
  try {
    const items = JSON.parse(row.payload_json) as BrowseRankItem[];
    if (!Array.isArray(items) || items.length === 0) return null;
    return { items, fetchedAt: row.fetched_at };
  } catch {
    return null;
  }
}

export function setBggTop100Cache(
  db: Db,
  items: BrowseRankItem[],
  ttlHours = 36,
): string {
  ensureBggTopRanksCacheTable(db);
  const fetchedAt = new Date();
  const expiresAt = new Date(fetchedAt.getTime() + ttlHours * 60 * 60 * 1000);
  const fetchedAtIso = fetchedAt.toISOString();
  db.prepare(
    `INSERT INTO bgg_top_ranks_cache (cache_key, payload_json, fetched_at, expires_at)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(cache_key) DO UPDATE SET
       payload_json = excluded.payload_json,
       fetched_at = excluded.fetched_at,
       expires_at = excluded.expires_at`,
  ).run(CACHE_KEY, JSON.stringify(items), fetchedAtIso, expiresAt.toISOString());
  return fetchedAtIso;
}
