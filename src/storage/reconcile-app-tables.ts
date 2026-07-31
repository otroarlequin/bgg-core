import { createHash } from "node:crypto";
import { DatabaseSync } from "node:sqlite";

export const APP_TABLES = [
  "duel_sessions",
  "duel_rounds",
  "purchase_reviews",
] as const;

interface DuelSessionRow {
  id: number;
  period_from: string;
  period_to: string;
  min_plays: number;
  status: string;
  winner_bgg_id: number | null;
  remaining_bgg_ids: string;
  filters_json: string | null;
  started_at: string;
  completed_at: string | null;
}

interface DuelRoundRow {
  id: number;
  session_id: number;
  round_number: number;
  candidate_a_bgg_id: number;
  candidate_b_bgg_id: number;
  winner_bgg_id: number;
  decided_at: string;
}

interface PurchaseReviewRow {
  id: number;
  bgg_id: number;
  created_at: string;
  notes: string | null;
  decision: string;
  overlap_score: number | null;
  snapshot_json: string;
}

export interface SideCounts {
  duelSessions: number;
  duelRounds: number;
  purchaseReviews: number;
  collectionEntries: number;
  plays: number;
  games: number;
  syncState: Record<string, string | null>;
}

export interface DiscrepancyReport {
  leftLabel: string;
  rightLabel: string;
  left: SideCounts;
  right: SideCounts;
  sessionsOnlyLeft: number;
  sessionsOnlyRight: number;
  sessionConflicts: number;
  reviewsOnlyLeft: number;
  reviewsOnlyRight: number;
  reviewConflicts: number;
  bggHints: string[];
  lines: string[];
}

export interface MergeResult {
  sessionsInserted: number;
  roundsInserted: number;
  reviewsInserted: number;
  conflictsKeptBoth: number;
  log: string[];
}

function sqlPath(path: string): string {
  return path.replace(/\\/g, "/").replace(/'/g, "''");
}

function tableExists(db: DatabaseSync, schema: string, name: string): boolean {
  const row = db
    .prepare(
      `SELECT 1 AS ok FROM ${schema}.sqlite_master WHERE type = 'table' AND name = ?`,
    )
    .get(name) as { ok: number } | undefined;
  return Boolean(row);
}

function countTable(db: DatabaseSync, schema: string, name: string): number {
  if (!tableExists(db, schema, name)) return 0;
  return (
    db.prepare(`SELECT COUNT(*) AS n FROM ${schema}.${name}`).get() as {
      n: number;
    }
  ).n;
}

function readSyncState(
  db: DatabaseSync,
  schema: string,
): Record<string, string | null> {
  if (!tableExists(db, schema, "sync_state")) return {};
  const rows = db
    .prepare(`SELECT resource, last_synced_at FROM ${schema}.sync_state`)
    .all() as Array<{ resource: string; last_synced_at: string | null }>;
  const out: Record<string, string | null> = {};
  for (const row of rows) out[row.resource] = row.last_synced_at;
  return out;
}

export function readSideCounts(
  db: DatabaseSync,
  schema = "main",
): SideCounts {
  return {
    duelSessions: countTable(db, schema, "duel_sessions"),
    duelRounds: countTable(db, schema, "duel_rounds"),
    purchaseReviews: countTable(db, schema, "purchase_reviews"),
    collectionEntries: countTable(db, schema, "collection_entries"),
    plays: countTable(db, schema, "plays"),
    games: countTable(db, schema, "games"),
    syncState: readSyncState(db, schema),
  };
}

function sessionStableKey(row: DuelSessionRow): string {
  return [
    row.started_at,
    row.period_from,
    row.period_to,
    String(row.min_plays),
    row.filters_json ?? "",
  ].join("|");
}

function sessionContentFingerprint(
  row: DuelSessionRow,
  rounds: DuelRoundRow[],
): string {
  const roundPart = rounds
    .slice()
    .sort((a, b) => a.round_number - b.round_number)
    .map(
      (r) =>
        `${r.round_number}:${r.candidate_a_bgg_id}:${r.candidate_b_bgg_id}:${r.winner_bgg_id}:${r.decided_at}`,
    )
    .join(";");
  const raw = [
    row.status,
    row.winner_bgg_id ?? "",
    row.remaining_bgg_ids,
    row.completed_at ?? "",
    roundPart,
  ].join("|");
  return createHash("sha256").update(raw).digest("hex").slice(0, 16);
}

function reviewStableKey(row: PurchaseReviewRow): string {
  return [
    String(row.bgg_id),
    row.created_at,
    row.decision,
    row.notes ?? "",
  ].join("|");
}

function reviewContentFingerprint(row: PurchaseReviewRow): string {
  const raw = `${row.overlap_score ?? ""}|${row.snapshot_json}`;
  return createHash("sha256").update(raw).digest("hex").slice(0, 16);
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

function loadSessions(
  db: DatabaseSync,
  schema: string,
): Map<
  string,
  { row: DuelSessionRow; rounds: DuelRoundRow[]; content: string }
> {
  const map = new Map<
    string,
    { row: DuelSessionRow; rounds: DuelRoundRow[]; content: string }
  >();
  if (!tableExists(db, schema, "duel_sessions")) return map;

  const sessions = db
    .prepare(`SELECT * FROM ${schema}.duel_sessions`)
    .all() as unknown as DuelSessionRow[];
  const hasRounds = tableExists(db, schema, "duel_rounds");

  for (const row of sessions) {
    const rounds = hasRounds
      ? (db
          .prepare(
            `SELECT * FROM ${schema}.duel_rounds WHERE session_id = ? ORDER BY round_number`,
          )
          .all(row.id) as unknown as DuelRoundRow[])
      : [];
    map.set(sessionStableKey(row), {
      row,
      rounds,
      content: sessionContentFingerprint(row, rounds),
    });
  }
  return map;
}

function loadReviews(
  db: DatabaseSync,
  schema: string,
): Map<string, { row: PurchaseReviewRow; content: string }> {
  const map = new Map<string, { row: PurchaseReviewRow; content: string }>();
  if (!tableExists(db, schema, "purchase_reviews")) return map;
  const rows = db
    .prepare(`SELECT * FROM ${schema}.purchase_reviews`)
    .all() as unknown as PurchaseReviewRow[];
  for (const row of rows) {
    map.set(reviewStableKey(row), {
      row,
      content: reviewContentFingerprint(row),
    });
  }
  return map;
}

function insertSessionWithRounds(
  db: DatabaseSync,
  session: DuelSessionRow,
  rounds: DuelRoundRow[],
): number {
  const result = db
    .prepare(
      `INSERT INTO duel_sessions (
        period_from, period_to, min_plays, status, winner_bgg_id,
        remaining_bgg_ids, started_at, completed_at, filters_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      session.period_from,
      session.period_to,
      session.min_plays,
      session.status,
      session.winner_bgg_id,
      session.remaining_bgg_ids,
      session.started_at,
      session.completed_at,
      session.filters_json,
    );
  const newId = Number(result.lastInsertRowid);
  const insertRound = db.prepare(
    `INSERT INTO duel_rounds (
      session_id, round_number, candidate_a_bgg_id, candidate_b_bgg_id,
      winner_bgg_id, decided_at
    ) VALUES (?, ?, ?, ?, ?, ?)`,
  );
  for (const round of rounds) {
    insertRound.run(
      newId,
      round.round_number,
      round.candidate_a_bgg_id,
      round.candidate_b_bgg_id,
      round.winner_bgg_id,
      round.decided_at,
    );
  }
  return newId;
}

function insertReview(db: DatabaseSync, review: PurchaseReviewRow): void {
  db.prepare(
    `INSERT INTO purchase_reviews (
      bgg_id, created_at, notes, decision, overlap_score, snapshot_json
    ) VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(
    review.bgg_id,
    review.created_at,
    review.notes,
    review.decision,
    review.overlap_score,
    review.snapshot_json,
  );
}

/**
 * Union app rows from `otherDbPath` into `targetDbPath`.
 * Never drops target rows. On content conflict, keeps both (inserts other copy).
 */
export function unionAppTablesInto(
  targetDbPath: string,
  otherDbPath: string,
): MergeResult {
  const db = new DatabaseSync(targetDbPath);
  const log: string[] = [];
  let sessionsInserted = 0;
  let roundsInserted = 0;
  let reviewsInserted = 0;
  let conflictsKeptBoth = 0;

  try {
    ensureAppSchema(db);
    db.exec(`ATTACH DATABASE '${sqlPath(otherDbPath)}' AS other`);

    const targetSessions = loadSessions(db, "main");
    const otherSessions = loadSessions(db, "other");

    db.exec("BEGIN");
    for (const [key, other] of otherSessions) {
      const existing = targetSessions.get(key);
      if (!existing) {
        insertSessionWithRounds(db, other.row, other.rounds);
        sessionsInserted += 1;
        roundsInserted += other.rounds.length;
        log.push(`+ session ${key} (+${other.rounds.length} rounds)`);
        continue;
      }
      if (existing.content === other.content) {
        continue;
      }
      insertSessionWithRounds(db, other.row, other.rounds);
      sessionsInserted += 1;
      roundsInserted += other.rounds.length;
      conflictsKeptBoth += 1;
      log.push(`CONFLICT kept both session ${key}`);
    }

    const targetReviews = loadReviews(db, "main");
    const otherReviews = loadReviews(db, "other");
    for (const [key, other] of otherReviews) {
      const existing = targetReviews.get(key);
      if (!existing) {
        insertReview(db, other.row);
        reviewsInserted += 1;
        log.push(`+ review ${key}`);
        continue;
      }
      if (existing.content === other.content) continue;
      insertReview(db, other.row);
      reviewsInserted += 1;
      conflictsKeptBoth += 1;
      log.push(`CONFLICT kept both review ${key}`);
    }
    db.exec("COMMIT");

    db.exec("DETACH DATABASE other");
  } catch (error) {
    try {
      db.exec("ROLLBACK");
    } catch {
      // ignore
    }
    db.close();
    throw error;
  }

  db.close();
  return {
    sessionsInserted,
    roundsInserted,
    reviewsInserted,
    conflictsKeptBoth,
    log,
  };
}

export function compareAppDatabases(
  leftPath: string,
  rightPath: string,
  leftLabel = "local",
  rightLabel = "remote",
): DiscrepancyReport {
  const db = new DatabaseSync(leftPath);
  try {
    db.exec(`ATTACH DATABASE '${sqlPath(rightPath)}' AS right`);
    const left = readSideCounts(db, "main");
    const right = readSideCounts(db, "right");

    const leftSessions = loadSessions(db, "main");
    const rightSessions = loadSessions(db, "right");
    let sessionsOnlyLeft = 0;
    let sessionsOnlyRight = 0;
    let sessionConflicts = 0;
    for (const [key, value] of leftSessions) {
      const other = rightSessions.get(key);
      if (!other) sessionsOnlyLeft += 1;
      else if (other.content !== value.content) sessionConflicts += 1;
    }
    for (const key of rightSessions.keys()) {
      if (!leftSessions.has(key)) sessionsOnlyRight += 1;
    }

    const leftReviews = loadReviews(db, "main");
    const rightReviews = loadReviews(db, "right");
    let reviewsOnlyLeft = 0;
    let reviewsOnlyRight = 0;
    let reviewConflicts = 0;
    for (const [key, value] of leftReviews) {
      const other = rightReviews.get(key);
      if (!other) reviewsOnlyLeft += 1;
      else if (other.content !== value.content) reviewConflicts += 1;
    }
    for (const key of rightReviews.keys()) {
      if (!leftReviews.has(key)) reviewsOnlyRight += 1;
    }

    const bggHints: string[] = [];
    for (const resource of ["collection", "plays", "things"] as const) {
      const l = left.syncState[resource] ?? null;
      const r = right.syncState[resource] ?? null;
      if (l && r && r > l) {
        bggHints.push(
          `${rightLabel} sync_state.${resource} (${r}) es más reciente que ${leftLabel} (${l}). Tras pull, conviene sync BGG en local.`,
        );
      } else if (l && r && l > r) {
        bggHints.push(
          `${leftLabel} sync_state.${resource} (${l}) es más reciente que ${rightLabel} (${r}).`,
        );
      }
    }
    if (right.collectionEntries > left.collectionEntries) {
      bggHints.push(
        `${rightLabel} tiene más collection_entries (${right.collectionEntries} vs ${left.collectionEntries}).`,
      );
    }
    if (right.plays > left.plays) {
      bggHints.push(
        `${rightLabel} tiene más plays (${right.plays} vs ${left.plays}).`,
      );
    }

    const lines: string[] = [
      `=== Discrepancias ${leftLabel} vs ${rightLabel} ===`,
      "",
      "App (crítico):",
      `  duel_sessions: ${left.duelSessions} vs ${right.duelSessions} | only-${leftLabel}=${sessionsOnlyLeft} only-${rightLabel}=${sessionsOnlyRight} conflicts=${sessionConflicts}`,
      `  duel_rounds:   ${left.duelRounds} vs ${right.duelRounds}`,
      `  purchase_reviews: ${left.purchaseReviews} vs ${right.purchaseReviews} | only-${leftLabel}=${reviewsOnlyLeft} only-${rightLabel}=${reviewsOnlyRight} conflicts=${reviewConflicts}`,
      "",
      "BGG (informativo / re-sincronizable):",
      `  collection_entries: ${left.collectionEntries} vs ${right.collectionEntries}`,
      `  plays: ${left.plays} vs ${right.plays}`,
      `  games: ${left.games} vs ${right.games}`,
    ];
    for (const hint of bggHints) lines.push(`  ! ${hint}`);

    db.exec("DETACH DATABASE right");

    return {
      leftLabel,
      rightLabel,
      left,
      right,
      sessionsOnlyLeft,
      sessionsOnlyRight,
      sessionConflicts,
      reviewsOnlyLeft,
      reviewsOnlyRight,
      reviewConflicts,
      bggHints,
      lines,
    };
  } finally {
    db.close();
  }
}

/**
 * After merging remote into artifact, ensure we did not drop remote app rows
 * (by stable-key cardinality).
 */
export function assertNoAppDataLoss(
  mergedPath: string,
  remotePath: string,
): { ok: true } | { ok: false; message: string } {
  const report = compareAppDatabases(
    mergedPath,
    remotePath,
    "merged",
    "remote",
  );
  // Remote-only sessions/reviews must be 0 after a proper union into merged.
  if (report.sessionsOnlyRight > 0 || report.reviewsOnlyRight > 0) {
    return {
      ok: false,
      message: `Merge incompleto: remote aún tiene filas de app ausentes en el artefacto (sessions only-remote=${report.sessionsOnlyRight}, reviews only-remote=${report.reviewsOnlyRight}). Abortando upload.`,
    };
  }
  if (
    report.left.duelSessions < report.right.duelSessions ||
    report.left.duelRounds < report.right.duelRounds ||
    report.left.purchaseReviews < report.right.purchaseReviews
  ) {
    return {
      ok: false,
      message: `Counts de app en merged son menores que remote (sessions ${report.left.duelSessions}<${report.right.duelSessions}, rounds ${report.left.duelRounds}<${report.right.duelRounds}, reviews ${report.left.purchaseReviews}<${report.right.purchaseReviews}). Abortando upload.`,
    };
  }
  return { ok: true };
}
