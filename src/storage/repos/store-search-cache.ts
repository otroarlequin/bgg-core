import type { Db } from "../database.js";
import type { StoreId, StoreOffer } from "../../stores/types.js";

export interface StoreSearchCacheRow {
  store: StoreId;
  queryKey: string;
  offers: StoreOffer[];
  fetchedAt: string;
  expiresAt: string;
}

export function ensureStoreSearchCacheTable(db: Db): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS store_search_cache (
      store TEXT NOT NULL,
      query_key TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      fetched_at TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      PRIMARY KEY (store, query_key)
    );
  `);
}

export function getStoreSearchCache(
  db: Db,
  store: StoreId,
  queryKey: string,
  nowIso = new Date().toISOString(),
): StoreSearchCacheRow | null {
  ensureStoreSearchCacheTable(db);
  const row = db
    .prepare(
      `SELECT store, query_key, payload_json, fetched_at, expires_at
       FROM store_search_cache
       WHERE store = ? AND query_key = ?`,
    )
    .get(store, queryKey) as
    | {
        store: string;
        query_key: string;
        payload_json: string;
        fetched_at: string;
        expires_at: string;
      }
    | undefined;

  if (!row) return null;
  if (row.expires_at < nowIso) return null;

  try {
    const offers = JSON.parse(row.payload_json) as StoreOffer[];
    if (!Array.isArray(offers)) return null;
    return {
      store: row.store as StoreId,
      queryKey: row.query_key,
      offers,
      fetchedAt: row.fetched_at,
      expiresAt: row.expires_at,
    };
  } catch {
    return null;
  }
}

export function setStoreSearchCache(
  db: Db,
  store: StoreId,
  queryKey: string,
  offers: StoreOffer[],
  ttlHours = 24,
): void {
  ensureStoreSearchCacheTable(db);
  const fetchedAt = new Date();
  const expiresAt = new Date(fetchedAt.getTime() + ttlHours * 60 * 60 * 1000);
  db.prepare(
    `INSERT INTO store_search_cache (store, query_key, payload_json, fetched_at, expires_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(store, query_key) DO UPDATE SET
       payload_json = excluded.payload_json,
       fetched_at = excluded.fetched_at,
       expires_at = excluded.expires_at`,
  ).run(
    store,
    queryKey,
    JSON.stringify(offers),
    fetchedAt.toISOString(),
    expiresAt.toISOString(),
  );
}
