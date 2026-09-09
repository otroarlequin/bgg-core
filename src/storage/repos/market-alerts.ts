import type { Db } from "../database.js";

export interface MarketAlert {
  id: number;
  bggId: number;
  listingKey: string;
  gameName: string;
  price: number | null;
  currency: string | null;
  condition: string | null;
  url: string;
  createdAt: string;
  readAt: string | null;
}

export function ensureMarketAlertsTable(db: Db): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS market_alerts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      bgg_id INTEGER NOT NULL,
      listing_key TEXT NOT NULL,
      game_name TEXT NOT NULL,
      price REAL,
      currency TEXT,
      condition TEXT,
      url TEXT NOT NULL,
      created_at TEXT NOT NULL,
      read_at TEXT,
      UNIQUE(bgg_id, listing_key)
    );
  `);
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_market_alerts_unread
      ON market_alerts(read_at, created_at DESC);
  `);
}

export function insertMarketAlertIfNew(
  db: Db,
  input: {
    bggId: number;
    listingKey: string;
    gameName: string;
    price: number | null;
    currency: string | null;
    condition: string | null;
    url: string;
  },
): boolean {
  ensureMarketAlertsTable(db);
  const result = db
    .prepare(
      `INSERT OR IGNORE INTO market_alerts
        (bgg_id, listing_key, game_name, price, currency, condition, url, created_at, read_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL)`,
    )
    .run(
      input.bggId,
      input.listingKey,
      input.gameName,
      input.price,
      input.currency,
      input.condition,
      input.url,
      new Date().toISOString(),
    );
  return Number(result.changes) > 0;
}

export function listUnreadMarketAlerts(db: Db, limit = 100): MarketAlert[] {
  ensureMarketAlertsTable(db);
  const rows = db
    .prepare(
      `SELECT id, bgg_id, listing_key, game_name, price, currency, condition, url, created_at, read_at
       FROM market_alerts
       WHERE read_at IS NULL
       ORDER BY created_at DESC
       LIMIT ?`,
    )
    .all(limit) as Array<{
    id: number;
    bgg_id: number;
    listing_key: string;
    game_name: string;
    price: number | null;
    currency: string | null;
    condition: string | null;
    url: string;
    created_at: string;
    read_at: string | null;
  }>;
  return rows.map(mapAlert);
}

export function countUnreadMarketAlerts(db: Db): number {
  ensureMarketAlertsTable(db);
  const row = db
    .prepare(
      `SELECT COUNT(*) AS c FROM market_alerts WHERE read_at IS NULL`,
    )
    .get() as { c: number };
  return Number(row.c) || 0;
}

export function markMarketAlertsRead(
  db: Db,
  alertIds?: number[],
): number {
  ensureMarketAlertsTable(db);
  const now = new Date().toISOString();
  if (!alertIds?.length) {
    const result = db
      .prepare(
        `UPDATE market_alerts SET read_at = ? WHERE read_at IS NULL`,
      )
      .run(now);
    return Number(result.changes) || 0;
  }
  const placeholders = alertIds.map(() => "?").join(",");
  const result = db
    .prepare(
      `UPDATE market_alerts SET read_at = ?
       WHERE read_at IS NULL AND id IN (${placeholders})`,
    )
    .run(now, ...alertIds);
  return Number(result.changes) || 0;
}

function mapAlert(row: {
  id: number;
  bgg_id: number;
  listing_key: string;
  game_name: string;
  price: number | null;
  currency: string | null;
  condition: string | null;
  url: string;
  created_at: string;
  read_at: string | null;
}): MarketAlert {
  return {
    id: row.id,
    bggId: row.bgg_id,
    listingKey: row.listing_key,
    gameName: row.game_name,
    price: row.price,
    currency: row.currency,
    condition: row.condition,
    url: row.url,
    createdAt: row.created_at,
    readAt: row.read_at,
  };
}
