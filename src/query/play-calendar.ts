import type { Db } from "../storage/database.js";
import { decodeHtmlEntities } from "../utils/html-entities.js";

export interface PlayCalendarParams {
  from?: string;
  to?: string;
}

export interface PlayCalendarDay {
  date: string;
  playCount: number;
}

export interface PlayCalendarDayPlay {
  playId: number;
  bggId: number;
  gameName: string;
  quantity: number;
  thumbnailUrl: string | null;
}

export interface PlayCalendarResult {
  from: string;
  to: string;
  days: PlayCalendarDay[];
  currentStreak: number;
  bestStreak: number;
  daysWithPlays: number;
  totalPlays: number;
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function addDays(iso: string, delta: number): string {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return isoDate(d);
}

function defaultRange(): { from: string; to: string } {
  const to = isoDate(new Date());
  const fromDate = new Date();
  fromDate.setUTCFullYear(fromDate.getUTCFullYear() - 1);
  return { from: isoDate(fromDate), to };
}

function computeStreaks(
  daySet: Set<string>,
  from: string,
  to: string,
): { currentStreak: number; bestStreak: number } {
  let best = 0;
  let run = 0;
  for (let d = from; d <= to; d = addDays(d, 1)) {
    if (daySet.has(d)) {
      run += 1;
      best = Math.max(best, run);
    } else {
      run = 0;
    }
  }

  let current = 0;
  // Streak ending today or yesterday (allow missing today if not played yet)
  let cursor = to;
  if (!daySet.has(cursor)) {
    cursor = addDays(cursor, -1);
  }
  while (daySet.has(cursor) && cursor >= from) {
    current += 1;
    cursor = addDays(cursor, -1);
  }

  return { currentStreak: current, bestStreak: best };
}

export function queryPlayCalendar(
  db: Db,
  params: PlayCalendarParams = {},
): PlayCalendarResult {
  const range = defaultRange();
  const from = params.from ?? range.from;
  const to = params.to ?? range.to;

  const rows = db
    .prepare(
      `SELECT p.date AS date, COALESCE(SUM(p.quantity), 0) AS play_count
       FROM plays p
       WHERE p.date >= ? AND p.date <= ?
       GROUP BY p.date
       ORDER BY p.date ASC`,
    )
    .all(from, to) as Array<{ date: string; play_count: number }>;

  const days: PlayCalendarDay[] = rows.map((r) => ({
    date: r.date,
    playCount: Number(r.play_count),
  }));

  const daySet = new Set(days.map((d) => d.date));
  const { currentStreak, bestStreak } = computeStreaks(daySet, from, to);
  const totalPlays = days.reduce((acc, d) => acc + d.playCount, 0);

  return {
    from,
    to,
    days,
    currentStreak,
    bestStreak,
    daysWithPlays: days.length,
    totalPlays,
  };
}

export function queryPlaysOnDate(
  db: Db,
  date: string,
): PlayCalendarDayPlay[] {
  const rows = db
    .prepare(
      `SELECT
         p.play_id,
         p.bgg_id,
         p.game_name,
         p.quantity,
         COALESCE(g.thumbnail_url, ce.thumbnail_url) AS thumbnail_url
       FROM plays p
       LEFT JOIN games g ON g.bgg_id = p.bgg_id
       LEFT JOIN collection_entries ce ON ce.bgg_id = p.bgg_id
       WHERE p.date = ?
       ORDER BY p.play_id DESC`,
    )
    .all(date) as Array<{
    play_id: number;
    bgg_id: number;
    game_name: string;
    quantity: number;
    thumbnail_url: string | null;
  }>;

  return rows.map((row) => ({
    playId: row.play_id,
    bggId: row.bgg_id,
    gameName: decodeHtmlEntities(row.game_name),
    quantity: row.quantity,
    thumbnailUrl: row.thumbnail_url,
  }));
}
