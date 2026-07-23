import type { Db } from "../database.js";

export type PurchaseDecision =
  | "interesado"
  | "esperar"
  | "descartar"
  | "sin_decision";

export interface PurchaseReview {
  id: number;
  bggId: number;
  createdAt: string;
  notes: string | null;
  decision: PurchaseDecision;
  overlapScore: number | null;
  snapshotJson: string;
}

export function ensurePurchaseReviewsTable(db: Db): void {
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
    CREATE INDEX IF NOT EXISTS idx_purchase_reviews_bgg_id
      ON purchase_reviews(bgg_id);
  `);
}

export function insertPurchaseReview(
  db: Db,
  input: {
    bggId: number;
    notes?: string | null;
    decision?: PurchaseDecision;
    overlapScore?: number | null;
    snapshot: unknown;
  },
): PurchaseReview {
  ensurePurchaseReviewsTable(db);
  const createdAt = new Date().toISOString();
  const decision = input.decision ?? "sin_decision";
  const snapshotJson = JSON.stringify(input.snapshot);
  const result = db
    .prepare(
      `INSERT INTO purchase_reviews
        (bgg_id, created_at, notes, decision, overlap_score, snapshot_json)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .run(
      input.bggId,
      createdAt,
      input.notes ?? null,
      decision,
      input.overlapScore ?? null,
      snapshotJson,
    );

  return {
    id: Number(result.lastInsertRowid),
    bggId: input.bggId,
    createdAt,
    notes: input.notes ?? null,
    decision,
    overlapScore: input.overlapScore ?? null,
    snapshotJson,
  };
}
