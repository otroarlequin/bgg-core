import type { Db } from "../database.js";
import type { MarketListing } from "../../bgg/marketplace.js";

export interface MarketListingsCacheRow {
  bggId: number;
  listings: MarketListing[];
  fetchedAt: string;
  expiresAt: string;
}

export function ensureMarketListingsCacheTable(db: Db): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS market_listings_cache (
      bgg_id INTEGER PRIMARY KEY NOT NULL,
      payload_json TEXT NOT NULL,
      fetched_at TEXT NOT NULL,
      expires_at TEXT NOT NULL
    );
  `);
}

export function getMarketListingsCache(
  db: Db,
  bggId: number,
  nowIso = new Date().toISOString(),
): MarketListingsCacheRow | null {
  ensureMarketListingsCacheTable(db);
  const row = db
    .prepare(
      `SELECT bgg_id, payload_json, fetched_at, expires_at
       FROM market_listings_cache WHERE bgg_id = ?`,
    )
    .get(bggId) as
    | {
        bgg_id: number;
        payload_json: string;
        fetched_at: string;
        expires_at: string;
      }
    | undefined;

  if (!row) return null;
  if (row.expires_at < nowIso) return null;

  try {
    const listings = JSON.parse(row.payload_json) as MarketListing[];
    if (!Array.isArray(listings)) return null;
    return {
      bggId: row.bgg_id,
      listings,
      fetchedAt: row.fetched_at,
      expiresAt: row.expires_at,
    };
  } catch {
    return null;
  }
}

export function setMarketListingsCache(
  db: Db,
  bggId: number,
  listings: MarketListing[],
  ttlHours = 12,
): void {
  ensureMarketListingsCacheTable(db);
  const fetchedAt = new Date();
  const expiresAt = new Date(fetchedAt.getTime() + ttlHours * 60 * 60 * 1000);
  db.prepare(
    `INSERT INTO market_listings_cache (bgg_id, payload_json, fetched_at, expires_at)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(bgg_id) DO UPDATE SET
       payload_json = excluded.payload_json,
       fetched_at = excluded.fetched_at,
       expires_at = excluded.expires_at`,
  ).run(
    bggId,
    JSON.stringify(listings),
    fetchedAt.toISOString(),
    expiresAt.toISOString(),
  );
}
