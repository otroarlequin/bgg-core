import type { Db } from "../database.js";
import { runTransaction } from "../database.js";

export const SETTING_BGG_USERNAME = "bgg_username";

export function ensureAppSettingsTable(db: Db): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY NOT NULL,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);
}

export function getSetting(db: Db, key: string): string | null {
  ensureAppSettingsTable(db);
  const row = db
    .prepare("SELECT value FROM app_settings WHERE key = ?")
    .get(key) as { value: string } | undefined;
  return row?.value ?? null;
}

export function setSetting(db: Db, key: string, value: string): void {
  ensureAppSettingsTable(db);
  const updatedAt = new Date().toISOString();
  db.prepare(
    `INSERT INTO app_settings (key, value, updated_at)
     VALUES (?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET
       value = excluded.value,
       updated_at = excluded.updated_at`,
  ).run(key, value, updatedAt);
}

export function getStoredBggUsername(db: Db): string | null {
  const value = getSetting(db, SETTING_BGG_USERNAME);
  const trimmed = value?.trim() ?? "";
  return trimmed.length > 0 ? trimmed : null;
}

export function setStoredBggUsername(db: Db, username: string): void {
  setSetting(db, SETTING_BGG_USERNAME, username.trim());
}

/** Counts that indicate BGG-synced user data is present. */
export function hasBggUserData(db: Db): {
  hasCollectionData: boolean;
  hasPlaysData: boolean;
} {
  const collectionCount = (
    db.prepare("SELECT COUNT(*) AS n FROM collection_entries").get() as {
      n: number;
    }
  ).n;
  const playsCount = (
    db.prepare("SELECT COUNT(*) AS n FROM plays").get() as { n: number }
  ).n;
  return {
    hasCollectionData: collectionCount > 0,
    hasPlaysData: playsCount > 0,
  };
}

/**
 * Wipe BGG-synced user data. Keeps games cache, duel_*, purchase_reviews.
 */
export function wipeBggUserData(db: Db): void {
  runTransaction(db, () => {
    db.exec("DELETE FROM play_players");
    db.exec("DELETE FROM plays");
    db.exec("DELETE FROM collection_entries");
    db.prepare(
      `DELETE FROM sync_state WHERE resource IN ('collection', 'plays', 'things')`,
    ).run();
  });
}
