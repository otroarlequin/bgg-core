import type { GamePeriodSummary, Play, PlayPlayer, PlaySummary } from "../domain/types.js";
import type { Db } from "../storage/database.js";
import {
  decodeHtmlEntities,
  decodeHtmlEntitiesList,
} from "../utils/html-entities.js";
import { SQL_VIRTUAL_LOCATION } from "../utils/play-location.js";

export interface QueryPlaysParams {
  from?: string;
  to?: string;
  bggId?: number;
  includeIncomplete?: boolean;
}

export interface QueryGamesPlayedInPeriodParams {
  from: string;
  to: string;
  minPlays?: number;
  includeIncomplete?: boolean;
  /** When false, exclude boardgameexpansion. Default true. */
  includeExpansions?: boolean;
  /** Only games marked owned in collection. */
  ownedOnly?: boolean;
  /** Exclude TTS/BGA plays from the period aggregation. */
  excludeVirtual?: boolean;
  designer?: string;
  categories?: string[];
  mechanics?: string[];
  languageDependence?: string;
  players?: number;
  /** Inclusive max game weight (BGG averageweight). */
  maxWeight?: number;
}

export interface PlayStats {
  totalPlays: number;
  uniqueGames: number;
  uniqueBaseGames: number;
  uniqueExpansions: number;
  totalMinutes: number;
  hIndex: number;
}

function parseJsonArray(value: string | null): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed)
      ? decodeHtmlEntitiesList(parsed.map(String))
      : [];
  } catch {
    return [];
  }
}

export function queryPlays(db: Db, params: QueryPlaysParams = {}): PlaySummary[] {
  const conditions: string[] = ["1=1"];
  const values: unknown[] = [];

  if (params.from) {
    conditions.push("p.date >= ?");
    values.push(params.from);
  }
  if (params.to) {
    conditions.push("p.date <= ?");
    values.push(params.to);
  }
  if (params.bggId !== undefined) {
    conditions.push("p.bgg_id = ?");
    values.push(params.bggId);
  }
  if (params.includeIncomplete === false) {
    conditions.push("p.incomplete = 0");
  }

  const playRows = db
    .prepare(
      `SELECT
         p.*,
         COALESCE(g.thumbnail_url, ce.thumbnail_url) AS thumbnail_url
       FROM plays p
       LEFT JOIN games g ON g.bgg_id = p.bgg_id
       LEFT JOIN collection_entries ce ON ce.bgg_id = p.bgg_id
       WHERE ${conditions.join(" AND ")}
       ORDER BY p.date DESC, p.play_id DESC`,
    )
    .all(...(values as (string | number)[])) as unknown as PlayRow[];

  if (playRows.length === 0) return [];

  const playIds = playRows.map((r) => r.play_id);
  const placeholders = playIds.map(() => "?").join(", ");
  const playerRows = db
    .prepare(
      `SELECT * FROM play_players WHERE play_id IN (${placeholders})`,
    )
    .all(...playIds) as unknown as PlayerRow[];

  const playersByPlay = new Map<number, PlayPlayer[]>();
  for (const row of playerRows) {
    const list = playersByPlay.get(row.play_id) ?? [];
    list.push(mapPlayerRow(row));
    playersByPlay.set(row.play_id, list);
  }

  return playRows.map((row) => ({
    ...mapPlayRow(row),
    thumbnailUrl: row.thumbnail_url ?? null,
    players: playersByPlay.get(row.play_id) ?? [],
  }));
}

/** Largest h such that at least h games each have >= h plays. */
export function computeHIndex(playCountsDescending: number[]): number {
  let h = 0;
  for (let i = 0; i < playCountsDescending.length; i++) {
    if (playCountsDescending[i]! >= i + 1) {
      h = i + 1;
    } else {
      break;
    }
  }
  return h;
}

export function queryPlayStats(
  db: Db,
  params: QueryPlaysParams = {},
): PlayStats {
  const conditions: string[] = ["1=1"];
  const values: unknown[] = [];

  if (params.from) {
    conditions.push("p.date >= ?");
    values.push(params.from);
  }
  if (params.to) {
    conditions.push("p.date <= ?");
    values.push(params.to);
  }
  if (params.bggId !== undefined) {
    conditions.push("p.bgg_id = ?");
    values.push(params.bggId);
  }
  if (params.includeIncomplete === false) {
    conditions.push("p.incomplete = 0");
  }

  const where = conditions.join(" AND ");

  const row = db
    .prepare(
      `SELECT
         COALESCE(SUM(p.quantity), 0) AS total_plays,
         COUNT(DISTINCT p.bgg_id) AS unique_games,
         COUNT(DISTINCT CASE
           WHEN COALESCE(ce.subtype, 'boardgame') != 'boardgameexpansion'
           THEN p.bgg_id END) AS unique_base,
         COUNT(DISTINCT CASE
           WHEN ce.subtype = 'boardgameexpansion'
           THEN p.bgg_id END) AS unique_expansions,
         COALESCE(SUM(p.length * p.quantity), 0) AS total_minutes
       FROM plays p
       LEFT JOIN collection_entries ce ON ce.bgg_id = p.bgg_id
       WHERE ${where}`,
    )
    .get(...(values as (string | number)[])) as {
    total_plays: number;
    unique_games: number;
    unique_base: number;
    unique_expansions: number;
    total_minutes: number;
  };

  const playCountRows = db
    .prepare(
      `SELECT SUM(p.quantity) AS play_count
       FROM plays p
       LEFT JOIN collection_entries ce ON ce.bgg_id = p.bgg_id
       WHERE ${where}
         AND COALESCE(ce.subtype, 'boardgame') != 'boardgameexpansion'
       GROUP BY p.bgg_id
       ORDER BY play_count DESC`,
    )
    .all(...(values as (string | number)[])) as Array<{ play_count: number }>;

  return {
    totalPlays: row.total_plays,
    uniqueGames: row.unique_games,
    uniqueBaseGames: row.unique_base,
    uniqueExpansions: row.unique_expansions,
    totalMinutes: row.total_minutes,
    hIndex: computeHIndex(playCountRows.map((r) => Number(r.play_count))),
  };
}

export function queryGamesPlayedInPeriod(
  db: Db,
  params: QueryGamesPlayedInPeriodParams,
): GamePeriodSummary[] {
  const minPlays = params.minPlays ?? 1;
  const conditions: string[] = ["p.date >= @from", "p.date <= @to"];
  const having: string[] = ["play_count >= @minPlays"];
  const bind: Record<string, string | number> = {
    from: params.from,
    to: params.to,
    minPlays,
  };

  if (params.includeIncomplete === false) {
    conditions.push("p.incomplete = 0");
  }
  if (params.excludeVirtual) {
    conditions.push(`NOT ${SQL_VIRTUAL_LOCATION}`);
  }
  if (params.includeExpansions === false) {
    conditions.push(
      "COALESCE(ce.subtype, 'boardgame') != 'boardgameexpansion'",
    );
  }
  if (params.ownedOnly) {
    conditions.push("ce.own = 1");
  }
  if (params.designer?.trim()) {
    conditions.push(`EXISTS (
      SELECT 1 FROM json_each(COALESCE(g.designers, '[]')) je
      WHERE je.value = @designer COLLATE NOCASE
    )`);
    bind.designer = params.designer.trim();
  }
  if (params.languageDependence?.trim()) {
    conditions.push("g.language_dependence = @languageDependence");
    bind.languageDependence = params.languageDependence.trim();
  }
  if (params.players !== undefined) {
    conditions.push("(g.min_players IS NULL OR g.min_players <= @players)");
    conditions.push("(g.max_players IS NULL OR g.max_players >= @players)");
    bind.players = params.players;
  }
  if (params.maxWeight !== undefined) {
    conditions.push("g.weight IS NOT NULL AND g.weight <= @maxWeight");
    bind.maxWeight = params.maxWeight;
  }
  if (params.categories?.length) {
    params.categories.forEach((cat, i) => {
      const key = `category${i}`;
      conditions.push(`EXISTS (
        SELECT 1 FROM json_each(COALESCE(g.categories, '[]')) je
        WHERE je.value = @${key} COLLATE NOCASE
      )`);
      bind[key] = cat.trim();
    });
  }
  if (params.mechanics?.length) {
    params.mechanics.forEach((mech, i) => {
      const key = `mechanic${i}`;
      conditions.push(`EXISTS (
        SELECT 1 FROM json_each(COALESCE(g.mechanics, '[]')) je
        WHERE je.value = @${key} COLLATE NOCASE
      )`);
      bind[key] = mech.trim();
    });
  }

  const rows = db
    .prepare(
      `SELECT
         p.bgg_id,
         COALESCE(g.name, p.game_name) AS name,
         g.thumbnail_url,
         g.image_url,
         g.designers AS designers_json,
         g.weight,
         ce.personal_rating,
         SUM(p.quantity) AS play_count,
         SUM(p.length * p.quantity) AS total_minutes,
         MIN(p.date) AS first_play,
         MAX(p.date) AS last_play,
         SUM(
           CASE WHEN EXISTS (
             SELECT 1 FROM play_players pp2
             WHERE pp2.play_id = p.play_id AND pp2.win = 1
           ) THEN p.quantity ELSE 0 END
         ) AS wins
       FROM plays p
       LEFT JOIN games g ON g.bgg_id = p.bgg_id
       LEFT JOIN collection_entries ce ON ce.bgg_id = p.bgg_id
       WHERE ${conditions.join(" AND ")}
       GROUP BY p.bgg_id
       HAVING ${having.join(" AND ")}
       ORDER BY play_count DESC, name COLLATE NOCASE ASC`,
    )
    .all(bind) as unknown as PeriodRow[];

  return rows.map((row) => {
    const playCount = Number(row.play_count);
    const wins = Number(row.wins);
    return {
      bggId: row.bgg_id,
      name: decodeHtmlEntities(row.name),
      thumbnailUrl: row.thumbnail_url,
      imageUrl: row.image_url,
      designers: parseJsonArray(row.designers_json),
      weight: row.weight,
      personalRating: row.personal_rating,
      playCount,
      totalMinutes: Number(row.total_minutes),
      firstPlay: row.first_play,
      lastPlay: row.last_play,
      wins,
      winRate: playCount > 0 ? wins / playCount : null,
    };
  });
}

interface PlayRow {
  play_id: number;
  bgg_id: number;
  game_name: string;
  date: string;
  quantity: number;
  length: number;
  location: string;
  incomplete: number;
  nowinstats: number;
  comments: string | null;
  synced_at: string;
  thumbnail_url?: string | null;
}

interface PlayerRow {
  play_id: number;
  username: string;
  userid: number | null;
  name: string;
  score: string;
  win: number;
  color: string;
  rating: number | null;
}

interface PeriodRow {
  bgg_id: number;
  name: string;
  thumbnail_url: string | null;
  image_url: string | null;
  designers_json: string | null;
  weight: number | null;
  personal_rating: number | null;
  play_count: number;
  total_minutes: number;
  first_play: string;
  last_play: string;
  wins: number;
}

function mapPlayRow(row: PlayRow): Play {
  return {
    playId: row.play_id,
    bggId: row.bgg_id,
    gameName: decodeHtmlEntities(row.game_name),
    date: row.date,
    quantity: row.quantity,
    length: row.length,
    location: row.location,
    incomplete: row.incomplete === 1,
    nowinstats: row.nowinstats === 1,
    comments: row.comments,
    syncedAt: row.synced_at,
  };
}

function mapPlayerRow(row: PlayerRow): PlayPlayer {
  return {
    playId: row.play_id,
    username: row.username,
    userid: row.userid,
    name: row.name,
    score: row.score,
    win: row.win === 1,
    color: row.color,
    rating: row.rating,
  };
}
