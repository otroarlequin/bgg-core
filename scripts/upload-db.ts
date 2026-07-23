/**
 * Merge app tables from an old SQLite DB into a new synced DB, then upload to Fly.
 *
 * Usage:
 *   npm run db:upload
 *   npm run db:upload -- --local-only --old ./tmp/remote.db
 *   npm run db:upload -- --skip-download --old ./tmp/remote.db
 *   npm run db:upload -- --new ./data/bgg.db --app bgg-core
 */
import { mkdtempSync, copyFileSync, existsSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { DatabaseSync } from "node:sqlite";
import { loadConfig } from "../src/config/index.js";

const APP_TABLES = ["duel_sessions", "duel_rounds", "purchase_reviews"] as const;

function argValue(flag: string): string | undefined {
  const idx = process.argv.indexOf(flag);
  if (idx === -1) return undefined;
  return process.argv[idx + 1];
}

function hasFlag(flag: string): boolean {
  return process.argv.includes(flag);
}

function fly(args: string[]): ReturnType<typeof spawnSync> {
  return spawnSync("fly", args, {
    encoding: "utf8",
    shell: true,
    stdio: ["ignore", "pipe", "pipe"],
  });
}

function sqlPath(path: string): string {
  return path.replace(/\\/g, "/").replace(/'/g, "''");
}

function attachedTableExists(db: DatabaseSync, name: string): boolean {
  const row = db
    .prepare(
      "SELECT 1 AS ok FROM old.sqlite_master WHERE type = 'table' AND name = ?",
    )
    .get(name) as { ok: number } | undefined;
  return Boolean(row);
}

function ensureAppSchema(db: DatabaseSync): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS duel_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      period_from TEXT NOT NULL,
      period_to TEXT NOT NULL,
      min_plays INTEGER NOT NULL DEFAULT 1,
      status TEXT NOT NULL DEFAULT 'active',
      winner_bgg_id INTEGER,
      remaining_bgg_ids TEXT NOT NULL,
      started_at TEXT NOT NULL,
      completed_at TEXT,
      filters_json TEXT
    );
    CREATE TABLE IF NOT EXISTS duel_rounds (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id INTEGER NOT NULL,
      round_number INTEGER NOT NULL,
      candidate_a_bgg_id INTEGER NOT NULL,
      candidate_b_bgg_id INTEGER NOT NULL,
      winner_bgg_id INTEGER NOT NULL,
      decided_at TEXT NOT NULL,
      FOREIGN KEY (session_id) REFERENCES duel_sessions(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_duel_rounds_session ON duel_rounds(session_id);
    CREATE TABLE IF NOT EXISTS purchase_reviews (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      bgg_id INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      notes TEXT,
      decision TEXT NOT NULL DEFAULT 'sin_decision',
      overlap_score REAL,
      snapshot_json TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_purchase_reviews_bgg_id
      ON purchase_reviews(bgg_id);
  `);
}

function mergeAppTables(newDbPath: string, oldDbPath: string): void {
  const db = new DatabaseSync(newDbPath);
  try {
    ensureAppSchema(db);
    db.exec(`ATTACH DATABASE '${sqlPath(oldDbPath)}' AS old`);

    if (attachedTableExists(db, "duel_sessions")) {
      const oldSessions = (
        db.prepare("SELECT COUNT(*) AS n FROM old.duel_sessions").get() as {
          n: number;
        }
      ).n;
      if (oldSessions > 0) {
        db.exec("DELETE FROM duel_rounds");
        db.exec("DELETE FROM duel_sessions");
        db.exec("INSERT INTO duel_sessions SELECT * FROM old.duel_sessions");
        if (attachedTableExists(db, "duel_rounds")) {
          db.exec("INSERT INTO duel_rounds SELECT * FROM old.duel_rounds");
        }
        console.log(`Merged duel_sessions (${oldSessions}) + rounds`);
      } else {
        console.log("Remote duel_sessions empty; keeping local");
      }
    } else {
      console.log("No duel tables in old DB (ok)");
    }

    if (attachedTableExists(db, "purchase_reviews")) {
      const n = (
        db.prepare("SELECT COUNT(*) AS n FROM old.purchase_reviews").get() as {
          n: number;
        }
      ).n;
      if (n > 0) {
        db.exec("DELETE FROM purchase_reviews");
        db.exec(
          "INSERT INTO purchase_reviews SELECT * FROM old.purchase_reviews",
        );
        console.log(`Merged purchase_reviews (${n})`);
      } else {
        console.log("Remote purchase_reviews empty; keeping local");
      }
    } else {
      console.log("No purchase_reviews in old DB (ok)");
    }

    db.exec("DETACH DATABASE old");
  } finally {
    db.close();
  }
}

function main(): void {
  const config = loadConfig();
  const localDb = resolve(argValue("--new") ?? config.dbPath);
  const appName = argValue("--app") ?? "bgg-core";
  const localOnly = hasFlag("--local-only");
  const skipDownload = hasFlag("--skip-download");
  let oldDb = argValue("--old") ? resolve(argValue("--old")!) : undefined;

  if (!existsSync(localDb)) {
    console.error(`Local DB not found: ${localDb}`);
    process.exit(1);
  }

  const workDir = mkdtempSync(join(tmpdir(), "bgg-upload-"));
  const mergedPath = join(workDir, "bgg-merged.db");
  copyFileSync(localDb, mergedPath);

  if (!oldDb && !skipDownload && !localOnly) {
    const remotePath = join(workDir, "bgg-remote.db");
    console.log("Downloading remote DB from Fly...");
    const get = fly([
      "ssh",
      "sftp",
      "get",
      "/data/bgg.db",
      remotePath,
      "-a",
      appName,
    ]);
    if (get.status === 0 && existsSync(remotePath)) {
      oldDb = remotePath;
      console.log("Remote DB downloaded");
    } else {
      console.log("No remote DB (or download failed); uploading local only");
      if (get.stderr) console.log(String(get.stderr).trim());
    }
  }

  if (oldDb && existsSync(oldDb)) {
    console.log(`Merging app tables from ${oldDb}`);
    mergeAppTables(mergedPath, oldDb);
  }

  if (localOnly) {
    const out = resolve(
      argValue("--out") ?? join(config.projectRoot, "data", "bgg-merged.db"),
    );
    copyFileSync(mergedPath, out);
    console.log(`Wrote merged DB to ${out}`);
    return;
  }

  console.log("Replacing remote DB...");
  fly([
    "ssh",
    "console",
    "-a",
    appName,
    "-C",
    "rm -f /data/bgg.db /data/bgg.db-wal /data/bgg.db-shm",
  ]);
  const put = fly([
    "ssh",
    "sftp",
    "put",
    mergedPath,
    "/data/bgg.db",
    "-a",
    appName,
  ]);
  if (put.status !== 0) {
    console.error(put.stderr || put.stdout || "sftp put failed");
    process.exit(1);
  }
  console.log("Uploaded. Restarting app...");
  const restart = fly(["apps", "restart", appName]);
  if (restart.status !== 0) {
    console.error(restart.stderr || "restart failed");
    process.exit(1);
  }
  try {
    unlinkSync(mergedPath);
  } catch {
    // ignore
  }
  console.log("Done.");
  console.log(`Preserved tables when present: ${APP_TABLES.join(", ")}`);
}

main();
