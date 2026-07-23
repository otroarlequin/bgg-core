import type { GameSubtype } from "../domain/types.js";
import type { Db } from "../storage/database.js";
import { decodeHtmlEntities } from "../utils/html-entities.js";

export interface WhatToPlayParams {
  players: number;
  maxTimeMinutes: number;
  maxWeight?: number;
  ownedOnly?: boolean;
  includeExpansions?: boolean;
  count?: number;
  /** Stable-ish reshuffle seed (e.g. timestamp). */
  seed?: number;
}

export interface WhatToPlaySuggestion {
  bggId: number;
  name: string;
  subtype: GameSubtype;
  thumbnailUrl: string | null;
  imageUrl: string | null;
  yearPublished: number | null;
  minPlayers: number | null;
  maxPlayers: number | null;
  playingTime: number | null;
  minPlayTime: number | null;
  maxPlayTime: number | null;
  weight: number | null;
  personalRating: number | null;
  bggRating: number | null;
  numPlays: number;
  designers: string[];
  score: number;
  reasons: string[];
}

function parseJsonArray(value: string | null): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

function mulberry32(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffleInPlace<T>(items: T[], rand: () => number): void {
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    const tmp = items[i]!;
    items[i] = items[j]!;
    items[j] = tmp;
  }
}

function effectiveTime(row: {
  playing_time: number | null;
  min_play_time: number | null;
  max_play_time: number | null;
}): number | null {
  if (row.playing_time != null) return row.playing_time;
  if (row.max_play_time != null) return row.max_play_time;
  if (row.min_play_time != null) return row.min_play_time;
  return null;
}

/**
 * Suggest 3–5 games that fit players/time/(optional) weight with a simple score.
 */
export function queryWhatToPlay(
  db: Db,
  params: WhatToPlayParams,
): WhatToPlaySuggestion[] {
  const count = Math.min(Math.max(params.count ?? 5, 3), 8);
  const ownedOnly = params.ownedOnly !== false;
  const conditions = ["1=1"];
  const values: unknown[] = [];

  if (ownedOnly) {
    conditions.push("ce.own = 1");
  }
  if (params.includeExpansions !== true) {
    conditions.push("ce.subtype != 'boardgameexpansion'");
  }

  conditions.push("(g.min_players IS NULL OR g.min_players <= ?)");
  values.push(params.players);
  conditions.push("(g.max_players IS NULL OR g.max_players >= ?)");
  values.push(params.players);

  // Prefer games with known time that fits; still allow unknown time with lower score
  conditions.push(`(
    g.playing_time IS NULL AND g.max_play_time IS NULL AND g.min_play_time IS NULL
    OR COALESCE(g.playing_time, g.max_play_time, g.min_play_time) <= ?
  )`);
  values.push(params.maxTimeMinutes);

  if (params.maxWeight !== undefined) {
    conditions.push("(g.weight IS NULL OR g.weight <= ?)");
    values.push(params.maxWeight);
  }

  const rows = db
    .prepare(
      `SELECT
         ce.bgg_id,
         COALESCE(g.name, ce.name) AS name,
         ce.subtype,
         COALESCE(g.thumbnail_url, ce.thumbnail_url) AS thumbnail_url,
         COALESCE(g.image_url, ce.image_url) AS image_url,
         ce.year_published,
         g.min_players,
         g.max_players,
         g.playing_time,
         g.min_play_time,
         g.max_play_time,
         g.weight,
         ce.personal_rating,
         COALESCE(g.bgg_rating, ce.bgg_rating) AS bgg_rating,
         ce.num_plays,
         g.designers,
         (
           SELECT MAX(p.date) FROM plays p WHERE p.bgg_id = ce.bgg_id
         ) AS last_play_date
       FROM collection_entries ce
       LEFT JOIN games g ON g.bgg_id = ce.bgg_id
       WHERE ${conditions.join(" AND ")}`,
    )
    .all(...(values as Array<string | number>)) as Array<{
    bgg_id: number;
    name: string;
    subtype: string;
    thumbnail_url: string | null;
    image_url: string | null;
    year_published: number | null;
    min_players: number | null;
    max_players: number | null;
    playing_time: number | null;
    min_play_time: number | null;
    max_play_time: number | null;
    weight: number | null;
    personal_rating: number | null;
    bgg_rating: number | null;
    num_plays: number;
    designers: string | null;
    last_play_date: string | null;
  }>;

  const scored: WhatToPlaySuggestion[] = rows.map((row) => {
    const reasons: string[] = [];
    let score = 40;

    const minP = row.min_players;
    const maxP = row.max_players;
    if (minP != null && maxP != null) {
      if (params.players === minP || params.players === maxP) {
        score += 8;
        reasons.push("En el borde del rango de jugadores");
      } else {
        score += 15;
        reasons.push(`Encaja ${params.players} jugadores`);
      }
    } else {
      score += 5;
    }

    const time = effectiveTime(row);
    if (time != null) {
      const slack = params.maxTimeMinutes - time;
      if (slack >= 0 && slack <= 30) {
        score += 18;
        reasons.push(`~${time} min (casi al límite)`);
      } else if (slack > 30) {
        score += 12;
        reasons.push(`~${time} min`);
      }
    }

    if (params.maxWeight !== undefined && row.weight != null) {
      const slack = params.maxWeight - row.weight;
      if (slack >= 0 && slack <= 0.5) {
        score += 10;
        reasons.push(`Peso ${row.weight.toFixed(1)}`);
      } else if (slack > 0.5) {
        score += 6;
      }
    } else if (row.weight != null && row.weight <= 2.5) {
      score += 4;
      reasons.push("Peso ligero");
    }

    if (row.personal_rating != null) {
      score += Math.min(row.personal_rating, 10);
      if (row.personal_rating >= 7) {
        reasons.push(`Rating ★${row.personal_rating}`);
      }
    } else if (row.bgg_rating != null) {
      score += Math.min(row.bgg_rating / 2, 5);
    }

    if (row.last_play_date) {
      const days =
        (Date.now() - new Date(row.last_play_date).getTime()) /
        (1000 * 60 * 60 * 24);
      if (days <= 30) {
        score += 12;
        reasons.push("Jugado recientemente");
      } else if (days <= 90) {
        score += 6;
        reasons.push("Jugado en los últimos 3 meses");
      } else if (days > 365 && row.num_plays > 0) {
        score += 8;
        reasons.push("Hace tiempo que no lo sacas");
      }
    } else if (row.num_plays === 0) {
      score += 5;
      reasons.push("Sin partidas aún");
    }

    if (row.num_plays >= 3 && row.num_plays <= 15) {
      score += 4;
    }

    return {
      bggId: row.bgg_id,
      name: decodeHtmlEntities(row.name),
      subtype: row.subtype as GameSubtype,
      thumbnailUrl: row.thumbnail_url,
      imageUrl: row.image_url,
      yearPublished: row.year_published,
      minPlayers: row.min_players,
      maxPlayers: row.max_players,
      playingTime: row.playing_time,
      minPlayTime: row.min_play_time,
      maxPlayTime: row.max_play_time,
      weight: row.weight,
      personalRating: row.personal_rating,
      bggRating: row.bgg_rating,
      numPlays: row.num_plays,
      designers: parseJsonArray(row.designers),
      score: Math.round(score * 10) / 10,
      reasons,
    };
  });

  scored.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name, "es"));

  // Reshuffle among a top band so "Otras sugerencias" feels fresh
  const topBand = scored.slice(0, Math.min(scored.length, Math.max(count * 3, 12)));
  const seed = params.seed ?? Date.now();
  const rand = mulberry32(seed);
  shuffleInPlace(topBand, rand);
  topBand.sort((a, b) => {
    // Keep roughly score-ordered but allow jitter from shuffle within ~8 pts
    const bucketA = Math.floor(a.score / 8);
    const bucketB = Math.floor(b.score / 8);
    if (bucketA !== bucketB) return bucketB - bucketA;
    return 0; // preserve shuffle order within bucket
  });

  return topBand.slice(0, count);
}
