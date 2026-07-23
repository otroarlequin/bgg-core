import type { Game } from "../../domain/types.js";
import type { Db } from "../database.js";
import { sqlNull } from "../sql-utils.js";

function parseJsonArray(value: string | null): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

function serializeJsonArray(values: string[]): string {
  return JSON.stringify(values);
}

export function upsertGame(db: Db, game: Game): void {
  db.prepare(
    `INSERT INTO games (
      bgg_id, name, year_published, min_players, max_players,
      playing_time, min_play_time, max_play_time, weight,
      image_url, thumbnail_url, description, designers, artists, publishers,
      mechanics, categories, language_dependence,
      bgg_rating, bgg_rank, thing_synced_at
    ) VALUES (
      @bggId, @itemName, @yearPublished, @minPlayers, @maxPlayers,
      @playingTime, @minPlayTime, @maxPlayTime, @weight,
      @imageUrl, @thumbnailUrl, @description, @designers, @artists, @publishers,
      @mechanics, @categories, @languageDependence,
      @bggRating, @bggRank, @thingSyncedAt
    )
    ON CONFLICT(bgg_id) DO UPDATE SET
      name = excluded.name,
      year_published = excluded.year_published,
      min_players = excluded.min_players,
      max_players = excluded.max_players,
      playing_time = excluded.playing_time,
      min_play_time = excluded.min_play_time,
      max_play_time = excluded.max_play_time,
      weight = excluded.weight,
      image_url = excluded.image_url,
      thumbnail_url = excluded.thumbnail_url,
      description = excluded.description,
      designers = excluded.designers,
      artists = excluded.artists,
      publishers = excluded.publishers,
      mechanics = excluded.mechanics,
      categories = excluded.categories,
      language_dependence = excluded.language_dependence,
      bgg_rating = excluded.bgg_rating,
      bgg_rank = excluded.bgg_rank,
      thing_synced_at = excluded.thing_synced_at`,
  ).run({
    bggId: game.bggId,
    itemName: game.name,
    yearPublished: sqlNull(game.yearPublished),
    minPlayers: sqlNull(game.minPlayers),
    maxPlayers: sqlNull(game.maxPlayers),
    playingTime: sqlNull(game.playingTime),
    minPlayTime: sqlNull(game.minPlayTime),
    maxPlayTime: sqlNull(game.maxPlayTime),
    weight: sqlNull(game.weight),
    imageUrl: sqlNull(game.imageUrl),
    thumbnailUrl: sqlNull(game.thumbnailUrl),
    description: sqlNull(game.description),
    designers: serializeJsonArray(game.designers),
    artists: serializeJsonArray(game.artists),
    publishers: serializeJsonArray(game.publishers),
    mechanics: serializeJsonArray(game.mechanics),
    categories: serializeJsonArray(game.categories),
    languageDependence: sqlNull(game.languageDependence),
    bggRating: sqlNull(game.bggRating),
    bggRank: sqlNull(game.bggRank),
    thingSyncedAt: game.thingSyncedAt,
  });
}

export function getGameById(db: Db, bggId: number): Game | null {
  const row = db
    .prepare("SELECT * FROM games WHERE bgg_id = ?")
    .get(bggId) as GameRow | undefined;
  return row ? mapGameRow(row) : null;
}

export function getGamesNeedingSync(db: Db, bggIds: number[]): number[] {
  if (bggIds.length === 0) return [];
  const placeholders = bggIds.map(() => "?").join(", ");
  const rows = db
    .prepare(`SELECT bgg_id FROM games WHERE bgg_id IN (${placeholders})`)
    .all(...bggIds) as Array<{ bgg_id: number }>;
  const synced = new Set(rows.map((r) => r.bgg_id));
  return bggIds.filter((id) => !synced.has(id));
}

export function getAllKnownBggIds(db: Db): number[] {
  const fromCollection = db
    .prepare("SELECT DISTINCT bgg_id FROM collection_entries")
    .all() as Array<{ bgg_id: number }>;
  const fromPlays = db
    .prepare("SELECT DISTINCT bgg_id FROM plays")
    .all() as Array<{ bgg_id: number }>;
  const ids = new Set<number>();
  for (const row of fromCollection) ids.add(row.bgg_id);
  for (const row of fromPlays) ids.add(row.bgg_id);
  return [...ids];
}

interface GameRow {
  bgg_id: number;
  name: string;
  year_published: number | null;
  min_players: number | null;
  max_players: number | null;
  playing_time: number | null;
  min_play_time: number | null;
  max_play_time: number | null;
  weight: number | null;
  image_url: string | null;
  thumbnail_url: string | null;
  description: string | null;
  designers: string;
  artists: string | null;
  publishers: string | null;
  mechanics: string;
  categories: string;
  language_dependence: string | null;
  bgg_rating: number | null;
  bgg_rank: number | null;
  thing_synced_at: string;
}

function mapGameRow(row: GameRow): Game {
  return {
    bggId: row.bgg_id,
    name: row.name,
    yearPublished: row.year_published,
    minPlayers: row.min_players,
    maxPlayers: row.max_players,
    playingTime: row.playing_time,
    minPlayTime: row.min_play_time,
    maxPlayTime: row.max_play_time,
    weight: row.weight,
    imageUrl: row.image_url,
    thumbnailUrl: row.thumbnail_url,
    description: row.description,
    designers: parseJsonArray(row.designers),
    artists: parseJsonArray(row.artists),
    publishers: parseJsonArray(row.publishers),
    mechanics: parseJsonArray(row.mechanics),
    categories: parseJsonArray(row.categories),
    languageDependence: row.language_dependence,
    bggRating: row.bgg_rating,
    bggRank: row.bgg_rank,
    thingSyncedAt: row.thing_synced_at,
  };
}
