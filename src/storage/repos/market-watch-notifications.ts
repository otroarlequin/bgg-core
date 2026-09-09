import type { Db } from "../database.js";

export function ensureMarketWatchNotificationsTable(db: Db): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS market_watch_notifications (
      bgg_id INTEGER NOT NULL,
      listing_key TEXT NOT NULL,
      notified_at TEXT NOT NULL,
      PRIMARY KEY (bgg_id, listing_key)
    );
  `);
}

export function hasWatchNotification(
  db: Db,
  bggId: number,
  listingKey: string,
): boolean {
  ensureMarketWatchNotificationsTable(db);
  const row = db
    .prepare(
      `SELECT 1 FROM market_watch_notifications WHERE bgg_id = ? AND listing_key = ?`,
    )
    .get(bggId, listingKey);
  return row != null;
}

export function insertWatchNotificationIfNew(
  db: Db,
  bggId: number,
  listingKey: string,
): boolean {
  ensureMarketWatchNotificationsTable(db);
  const result = db
    .prepare(
      `INSERT OR IGNORE INTO market_watch_notifications (bgg_id, listing_key, notified_at)
       VALUES (?, ?, ?)`,
    )
    .run(bggId, listingKey, new Date().toISOString());
  return Number(result.changes) > 0;
}
