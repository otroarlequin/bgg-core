import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const migrationsDir = dirname(fileURLToPath(import.meta.url));

export type Db = DatabaseSync;

export function createDatabase(dbPath: string): DatabaseSync {
  const db = new DatabaseSync(dbPath);
  db.exec("PRAGMA journal_mode = WAL");
  db.exec("PRAGMA foreign_keys = ON");
  runMigrations(db);
  return db;
}

function runMigrations(db: DatabaseSync): void {
  const sql = readFileSync(
    join(migrationsDir, "migrations", "001_initial.sql"),
    "utf8",
  );
  db.exec(sql);
  ensureColumn(db, "games", "artists", "TEXT");
  ensureColumn(db, "games", "publishers", "TEXT");
  ensureColumn(db, "games", "language_dependence", "TEXT");
  ensureColumn(db, "games", "description", "TEXT");
  ensureColumn(db, "duel_sessions", "filters_json", "TEXT");
  db.exec(`
    CREATE TABLE IF NOT EXISTS purchase_reviews (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      bgg_id INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      notes TEXT,
      decision TEXT NOT NULL DEFAULT 'sin_decision',
      overlap_score REAL,
      snapshot_json TEXT NOT NULL
    );
  `);
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_purchase_reviews_bgg_id
      ON purchase_reviews(bgg_id);
  `);
}

function ensureColumn(
  db: DatabaseSync,
  table: string,
  column: string,
  definition: string,
): void {
  const columns = db
    .prepare(`PRAGMA table_info(${table})`)
    .all() as Array<{ name: string }>;
  if (!columns.some((c) => c.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

export function runTransaction(db: DatabaseSync, fn: () => void): void {
  db.exec("BEGIN IMMEDIATE");
  try {
    fn();
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}
