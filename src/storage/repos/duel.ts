import type { DuelRound, DuelSession, DuelSessionStatus } from "../../domain/types.js";
import type { Db } from "../database.js";

interface DuelSessionRow {
  id: number;
  period_from: string;
  period_to: string;
  min_plays: number;
  status: DuelSessionStatus;
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

function mapSession(row: DuelSessionRow): DuelSession {
  return {
    id: row.id,
    periodFrom: row.period_from,
    periodTo: row.period_to,
    minPlays: row.min_plays,
    status: row.status,
    winnerBggId: row.winner_bgg_id,
    remainingBggIds: JSON.parse(row.remaining_bgg_ids) as number[],
    filtersJson: row.filters_json ?? null,
    startedAt: row.started_at,
    completedAt: row.completed_at,
  };
}

export function createDuelSession(
  db: Db,
  input: {
    periodFrom: string;
    periodTo: string;
    minPlays: number;
    remainingBggIds: number[];
    filtersJson?: string | null;
    startedAt: string;
  },
): DuelSession {
  const result = db
    .prepare(
      `INSERT INTO duel_sessions (
        period_from, period_to, min_plays, status, remaining_bgg_ids, filters_json, started_at
      ) VALUES (@periodFrom, @periodTo, @minPlays, 'active', @remainingBggIds, @filtersJson, @startedAt)`,
    )
    .run({
      periodFrom: input.periodFrom,
      periodTo: input.periodTo,
      minPlays: input.minPlays,
      remainingBggIds: JSON.stringify(input.remainingBggIds),
      filtersJson: input.filtersJson ?? null,
      startedAt: input.startedAt,
    });

  const session = getDuelSession(db, Number(result.lastInsertRowid ?? 0));
  if (!session) throw new Error("No se pudo crear la sesión de duelo");
  return session;
}

export function getDuelSession(db: Db, sessionId: number): DuelSession | null {
  const row = db
    .prepare("SELECT * FROM duel_sessions WHERE id = ?")
    .get(sessionId) as DuelSessionRow | undefined;
  return row ? mapSession(row) : null;
}

export function updateDuelSessionRemaining(
  db: Db,
  sessionId: number,
  remainingBggIds: number[],
): void {
  db.prepare(
    "UPDATE duel_sessions SET remaining_bgg_ids = ? WHERE id = ?",
  ).run(JSON.stringify(remainingBggIds), sessionId);
}

export function completeDuelSession(
  db: Db,
  sessionId: number,
  winnerBggId: number,
  completedAt: string,
): void {
  db.prepare(
    `UPDATE duel_sessions
     SET status = 'completed', winner_bgg_id = ?, completed_at = ?, remaining_bgg_ids = '[]'
     WHERE id = ?`,
  ).run(winnerBggId, completedAt, sessionId);
}

/** Ends an active session without a winner so a new one can start. */
export function abandonDuelSession(db: Db, sessionId: number, completedAt: string): void {
  db.prepare(
    `UPDATE duel_sessions
     SET status = 'completed', winner_bgg_id = NULL, completed_at = ?, remaining_bgg_ids = '[]'
     WHERE id = ? AND status = 'active'`,
  ).run(completedAt, sessionId);
}

export function insertDuelRound(db: Db, round: Omit<DuelRound, "id">): DuelRound {
  const result = db
    .prepare(
      `INSERT INTO duel_rounds (
        session_id, round_number, candidate_a_bgg_id, candidate_b_bgg_id,
        winner_bgg_id, decided_at
      ) VALUES (
        @sessionId, @roundNumber, @candidateABggId, @candidateBBggId,
        @winnerBggId, @decidedAt
      )`,
    )
    .run({
      sessionId: round.sessionId,
      roundNumber: round.roundNumber,
      candidateABggId: round.candidateABggId,
      candidateBBggId: round.candidateBBggId,
      winnerBggId: round.winnerBggId,
      decidedAt: round.decidedAt,
    });

  return {
    id: Number(result.lastInsertRowid ?? 0),
    ...round,
  };
}

export function getDuelRounds(db: Db, sessionId: number): DuelRound[] {
  const rows = db
    .prepare(
      "SELECT * FROM duel_rounds WHERE session_id = ? ORDER BY round_number ASC",
    )
    .all(sessionId) as unknown as DuelRoundRow[];

  return rows.map((row) => ({
    id: row.id,
    sessionId: row.session_id,
    roundNumber: row.round_number,
    candidateABggId: row.candidate_a_bgg_id,
    candidateBBggId: row.candidate_b_bgg_id,
    winnerBggId: row.winner_bgg_id,
    decidedAt: row.decided_at,
  }));
}

export function getDuelRoundCount(db: Db, sessionId: number): number {
  const row = db
    .prepare("SELECT COUNT(*) AS count FROM duel_rounds WHERE session_id = ?")
    .get(sessionId) as { count: number };
  return row.count;
}

export function getActiveDuelSession(db: Db): DuelSession | null {
  const row = db
    .prepare("SELECT * FROM duel_sessions WHERE status = 'active' ORDER BY id DESC LIMIT 1")
    .get() as DuelSessionRow | undefined;
  return row ? mapSession(row) : null;
}
