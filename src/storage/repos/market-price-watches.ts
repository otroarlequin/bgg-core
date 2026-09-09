import type { Db } from "../database.js";

export const MAX_MARKET_PRICE_WATCHES = 40;
export const DEFAULT_TOLERANCE_PCT = 10;

export interface MarketPriceWatch {
  bggId: number;
  maxPrice: number;
  tolerancePct: number;
  currency: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export function ensureMarketPriceWatchesTable(db: Db): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS market_price_watches (
      bgg_id INTEGER PRIMARY KEY NOT NULL,
      max_price REAL NOT NULL,
      tolerance_pct REAL NOT NULL DEFAULT 10,
      currency TEXT NOT NULL DEFAULT 'USD',
      enabled INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);
}

function mapRow(row: {
  bgg_id: number;
  max_price: number;
  tolerance_pct: number;
  currency: string;
  enabled: number;
  created_at: string;
  updated_at: string;
}): MarketPriceWatch {
  return {
    bggId: row.bgg_id,
    maxPrice: row.max_price,
    tolerancePct: row.tolerance_pct,
    currency: row.currency,
    enabled: row.enabled !== 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function listMarketPriceWatches(db: Db): MarketPriceWatch[] {
  ensureMarketPriceWatchesTable(db);
  const rows = db
    .prepare(
      `SELECT bgg_id, max_price, tolerance_pct, currency, enabled, created_at, updated_at
       FROM market_price_watches
       ORDER BY updated_at DESC`,
    )
    .all() as Array<{
    bgg_id: number;
    max_price: number;
    tolerance_pct: number;
    currency: string;
    enabled: number;
    created_at: string;
    updated_at: string;
  }>;
  return rows.map(mapRow);
}

export function listEnabledMarketPriceWatches(
  db: Db,
  limit = MAX_MARKET_PRICE_WATCHES,
): MarketPriceWatch[] {
  ensureMarketPriceWatchesTable(db);
  const rows = db
    .prepare(
      `SELECT bgg_id, max_price, tolerance_pct, currency, enabled, created_at, updated_at
       FROM market_price_watches
       WHERE enabled = 1
       ORDER BY updated_at DESC
       LIMIT ?`,
    )
    .all(limit) as Array<{
    bgg_id: number;
    max_price: number;
    tolerance_pct: number;
    currency: string;
    enabled: number;
    created_at: string;
    updated_at: string;
  }>;
  return rows.map(mapRow);
}

export function getMarketPriceWatch(
  db: Db,
  bggId: number,
): MarketPriceWatch | null {
  ensureMarketPriceWatchesTable(db);
  const row = db
    .prepare(
      `SELECT bgg_id, max_price, tolerance_pct, currency, enabled, created_at, updated_at
       FROM market_price_watches WHERE bgg_id = ?`,
    )
    .get(bggId) as
    | {
        bgg_id: number;
        max_price: number;
        tolerance_pct: number;
        currency: string;
        enabled: number;
        created_at: string;
        updated_at: string;
      }
    | undefined;
  return row ? mapRow(row) : null;
}

export function countMarketPriceWatches(db: Db): number {
  ensureMarketPriceWatchesTable(db);
  const row = db
    .prepare(`SELECT COUNT(*) AS c FROM market_price_watches`)
    .get() as { c: number };
  return Number(row.c) || 0;
}

export function upsertMarketPriceWatch(
  db: Db,
  input: {
    bggId: number;
    maxPrice: number;
    tolerancePct?: number;
    currency?: string;
    enabled?: boolean;
  },
): MarketPriceWatch {
  ensureMarketPriceWatchesTable(db);
  const existing = getMarketPriceWatch(db, input.bggId);
  if (!existing && countMarketPriceWatches(db) >= MAX_MARKET_PRICE_WATCHES) {
    throw new Error(
      `Máximo ${MAX_MARKET_PRICE_WATCHES} alertas de precio activas.`,
    );
  }

  const now = new Date().toISOString();
  const tolerancePct = input.tolerancePct ?? existing?.tolerancePct ?? DEFAULT_TOLERANCE_PCT;
  const currency = (input.currency ?? existing?.currency ?? "USD").trim().toUpperCase();
  const enabled = input.enabled ?? existing?.enabled ?? true;
  const createdAt = existing?.createdAt ?? now;

  db.prepare(
    `INSERT INTO market_price_watches
      (bgg_id, max_price, tolerance_pct, currency, enabled, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(bgg_id) DO UPDATE SET
       max_price = excluded.max_price,
       tolerance_pct = excluded.tolerance_pct,
       currency = excluded.currency,
       enabled = excluded.enabled,
       updated_at = excluded.updated_at`,
  ).run(
    input.bggId,
    input.maxPrice,
    tolerancePct,
    currency,
    enabled ? 1 : 0,
    createdAt,
    now,
  );

  return getMarketPriceWatch(db, input.bggId)!;
}

export function patchMarketPriceWatch(
  db: Db,
  bggId: number,
  patch: {
    maxPrice?: number;
    tolerancePct?: number;
    currency?: string;
    enabled?: boolean;
  },
): MarketPriceWatch | null {
  const existing = getMarketPriceWatch(db, bggId);
  if (!existing) return null;
  return upsertMarketPriceWatch(db, {
    bggId,
    maxPrice: patch.maxPrice ?? existing.maxPrice,
    tolerancePct: patch.tolerancePct ?? existing.tolerancePct,
    currency: patch.currency ?? existing.currency,
    enabled: patch.enabled ?? existing.enabled,
  });
}

export function deleteMarketPriceWatch(db: Db, bggId: number): boolean {
  ensureMarketPriceWatchesTable(db);
  const result = db
    .prepare(`DELETE FROM market_price_watches WHERE bgg_id = ?`)
    .run(bggId);
  return Number(result.changes) > 0;
}
