import type { Db } from "../database.js";
import { runTransaction } from "../database.js";

export type CollectionStatusSource = "baseline" | "sync";

export interface CollectionStatusFlags {
  bggId: number;
  own: boolean;
  wishlist: boolean;
  preordered: boolean;
  wantToPlay: boolean;
}

export interface CollectionStatusEvent extends CollectionStatusFlags {
  id: number;
  observedAt: string;
  source: CollectionStatusSource;
}

export function ensureCollectionStatusEventsTable(db: Db): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS collection_status_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      bgg_id INTEGER NOT NULL,
      observed_at TEXT NOT NULL,
      own INTEGER NOT NULL,
      wishlist INTEGER NOT NULL,
      preordered INTEGER NOT NULL,
      want_to_play INTEGER NOT NULL,
      source TEXT NOT NULL
    );
  `);
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_collection_status_events_bgg
      ON collection_status_events(bgg_id, observed_at, id);
  `);
}

export function listAggregatedCollectionFlags(db: Db): Map<number, CollectionStatusFlags> {
  const rows = db
    .prepare(
      `SELECT
         bgg_id,
         MAX(own) AS own,
         MAX(wishlist) AS wishlist,
         MAX(preordered) AS preordered,
         MAX(want_to_play) AS want_to_play
       FROM collection_entries
       GROUP BY bgg_id`,
    )
    .all() as Array<{
    bgg_id: number;
    own: number;
    wishlist: number;
    preordered: number;
    want_to_play: number;
  }>;

  const out = new Map<number, CollectionStatusFlags>();
  for (const row of rows) {
    out.set(row.bgg_id, {
      bggId: row.bgg_id,
      own: row.own === 1,
      wishlist: row.wishlist === 1,
      preordered: row.preordered === 1,
      wantToPlay: row.want_to_play === 1,
    });
  }
  return out;
}

export function countCollectionStatusEvents(db: Db): number {
  ensureCollectionStatusEventsTable(db);
  const row = db
    .prepare("SELECT COUNT(*) AS n FROM collection_status_events")
    .get() as { n: number };
  return row.n;
}

export function listCollectionStatusEvents(db: Db): CollectionStatusEvent[] {
  ensureCollectionStatusEventsTable(db);
  const rows = db
    .prepare(
      `SELECT id, bgg_id, observed_at, own, wishlist, preordered, want_to_play, source
       FROM collection_status_events
       ORDER BY bgg_id ASC, observed_at ASC, id ASC`,
    )
    .all() as Array<{
    id: number;
    bgg_id: number;
    observed_at: string;
    own: number;
    wishlist: number;
    preordered: number;
    want_to_play: number;
    source: string;
  }>;
  return rows.map((row) => ({
    id: row.id,
    bggId: row.bgg_id,
    observedAt: row.observed_at,
    own: row.own === 1,
    wishlist: row.wishlist === 1,
    preordered: row.preordered === 1,
    wantToPlay: row.want_to_play === 1,
    source: row.source === "sync" ? "sync" : "baseline",
  }));
}

function flagsEqual(
  a: CollectionStatusFlags | undefined,
  b: CollectionStatusFlags,
): boolean {
  if (!a) return false;
  return (
    a.own === b.own &&
    a.wishlist === b.wishlist &&
    a.preordered === b.preordered &&
    a.wantToPlay === b.wantToPlay
  );
}

function insertEvent(
  db: Db,
  flags: CollectionStatusFlags,
  observedAt: string,
  source: CollectionStatusSource,
): void {
  db.prepare(
    `INSERT INTO collection_status_events (
       bgg_id, observed_at, own, wishlist, preordered, want_to_play, source
     ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    flags.bggId,
    observedAt,
    flags.own ? 1 : 0,
    flags.wishlist ? 1 : 0,
    flags.preordered ? 1 : 0,
    flags.wantToPlay ? 1 : 0,
    source,
  );
}

/**
 * After a collection upsert: first run writes a baseline snapshot of every
 * current flag. Later runs insert a `sync` row only when flags change.
 */
export function recordCollectionStatusEvents(
  db: Db,
  previous: Map<number, CollectionStatusFlags>,
  observedAt = new Date().toISOString(),
): { baseline: boolean; inserted: number } {
  ensureCollectionStatusEventsTable(db);
  const current = listAggregatedCollectionFlags(db);
  const hadEvents = countCollectionStatusEvents(db) > 0;

  let inserted = 0;
  runTransaction(db, () => {
    if (!hadEvents) {
      for (const flags of current.values()) {
        insertEvent(db, flags, observedAt, "baseline");
        inserted += 1;
      }
      return;
    }

    for (const flags of current.values()) {
      const prev = previous.get(flags.bggId);
      if (flagsEqual(prev, flags)) continue;
      insertEvent(db, flags, observedAt, "sync");
      inserted += 1;
    }
  });

  return { baseline: !hadEvents, inserted };
}
