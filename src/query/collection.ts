import type { CollectionQueryResult, GameSubtype } from "../domain/types.js";
import { BGG_LANGUAGE_DEPENDENCE_LEVELS } from "../domain/language-dependence.js";
import type { Db } from "../storage/database.js";
import {
  decodeHtmlEntities,
  decodeHtmlEntitiesList,
} from "../utils/html-entities.js";

export interface QueryCollectionParams {
  own?: boolean;
  wishlist?: boolean;
  preordered?: boolean;
  minPlays?: number;
  includeExpansions?: boolean;
  designer?: string;
  artist?: string;
  publisher?: string;
  categories?: string[];
  mechanics?: string[];
  languageDependence?: string;
  players?: number;
  sortBy?: "name" | "rating" | "plays" | "weight";
  limit?: number;
}

export interface CollectionFacets {
  designers: string[];
  artists: string[];
  publishers: string[];
  categories: string[];
  mechanics: string[];
  languageDependence: string[];
  playersMin: number;
  playersMax: number;
}

const PLAYERS_SLIDER_MAX = 30;

type FacetField =
  | "designer"
  | "artist"
  | "publisher"
  | "categories"
  | "mechanics"
  | "languageDependence"
  | "players";

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

function addUniqueValues(target: Set<string>, values: string[]): void {
  for (const value of values) {
    const trimmed = value.trim();
    if (trimmed) target.add(trimmed);
  }
}

function jsonArrayExact(column: string): string {
  return `EXISTS (
    SELECT 1 FROM json_each(COALESCE(${column}, '[]')) je
    WHERE je.value = ? COLLATE NOCASE
  )`;
}

function addJsonArrayExactFilters(
  column: string,
  values: string[],
  conditions: string[],
  params: unknown[],
): void {
  for (const value of values) {
    const trimmed = value.trim();
    if (!trimmed) continue;
    conditions.push(jsonArrayExact(column));
    params.push(trimmed);
  }
}

function buildCollectionConditions(
  params: QueryCollectionParams,
  exclude: FacetField[] = [],
): { conditions: string[]; values: unknown[] } {
  const conditions: string[] = ["1=1"];
  const values: unknown[] = [];
  const skip = new Set(exclude);

  if (params.own !== undefined) {
    conditions.push("ce.own = ?");
    values.push(params.own ? 1 : 0);
  }
  if (params.wishlist !== undefined) {
    conditions.push("ce.wishlist = ?");
    values.push(params.wishlist ? 1 : 0);
  }
  if (params.preordered !== undefined) {
    conditions.push("ce.preordered = ?");
    values.push(params.preordered ? 1 : 0);
  }
  if (params.minPlays !== undefined) {
    conditions.push("ce.num_plays >= ?");
    values.push(params.minPlays);
  }
  if (params.includeExpansions !== true) {
    conditions.push("ce.subtype != 'boardgameexpansion'");
  }
  if (!skip.has("designer") && params.designer?.trim()) {
    conditions.push(jsonArrayExact("g.designers"));
    values.push(params.designer.trim());
  }
  if (!skip.has("artist") && params.artist?.trim()) {
    conditions.push(jsonArrayExact("g.artists"));
    values.push(params.artist.trim());
  }
  if (!skip.has("publisher") && params.publisher?.trim()) {
    conditions.push(jsonArrayExact("g.publishers"));
    values.push(params.publisher.trim());
  }
  if (!skip.has("categories") && params.categories?.length) {
    addJsonArrayExactFilters("g.categories", params.categories, conditions, values);
  }
  if (!skip.has("mechanics") && params.mechanics?.length) {
    addJsonArrayExactFilters("g.mechanics", params.mechanics, conditions, values);
  }
  if (!skip.has("languageDependence") && params.languageDependence?.trim()) {
    conditions.push("g.language_dependence = ?");
    values.push(params.languageDependence.trim());
  }
  if (!skip.has("players") && params.players !== undefined) {
    conditions.push("(g.min_players IS NULL OR g.min_players <= ?)");
    values.push(params.players);
    conditions.push("(g.max_players IS NULL OR g.max_players >= ?)");
    values.push(params.players);
  }

  return { conditions, values };
}

export function queryCollectionFacets(
  db: Db,
  params: QueryCollectionParams = {},
): CollectionFacets {
  const { conditions, values } = buildCollectionConditions(params);

  const rows = db
    .prepare(
      `SELECT
         g.designers,
         g.artists,
         g.publishers,
         g.mechanics,
         g.categories,
         g.language_dependence,
         g.min_players,
         g.max_players
       FROM collection_entries ce
       LEFT JOIN games g ON g.bgg_id = ce.bgg_id
       WHERE ${conditions.join(" AND ")}`,
    )
    .all(...(values as Array<string | number>)) as Array<{
    designers: string | null;
    artists: string | null;
    publishers: string | null;
    mechanics: string | null;
    categories: string | null;
    language_dependence: string | null;
    min_players: number | null;
    max_players: number | null;
  }>;

  const designers = new Set<string>();
  const artists = new Set<string>();
  const publishers = new Set<string>();
  const categories = new Set<string>();
  const mechanics = new Set<string>();
  let playersMin = 12;
  let playersMax = 1;
  let hasPlayerData = false;

  for (const row of rows) {
    addUniqueValues(designers, parseJsonArray(row.designers));
    addUniqueValues(artists, parseJsonArray(row.artists));
    addUniqueValues(publishers, parseJsonArray(row.publishers));
    addUniqueValues(categories, parseJsonArray(row.categories));
    addUniqueValues(mechanics, parseJsonArray(row.mechanics));
    if (row.min_players != null) {
      hasPlayerData = true;
      playersMin = Math.min(playersMin, row.min_players);
    }
    if (row.max_players != null) {
      hasPlayerData = true;
      playersMax = Math.max(playersMax, row.max_players);
    }
  }

  if (!hasPlayerData) {
    playersMin = 1;
    playersMax = 12;
  } else if (playersMax < playersMin) {
    playersMax = playersMin;
  }

  playersMax = Math.min(playersMax, PLAYERS_SLIDER_MAX);
  playersMin = Math.min(playersMin, playersMax);

  const sort = (set: Set<string>) =>
    [...set].sort((a, b) => a.localeCompare(b, "es", { sensitivity: "base" }));

  return {
    designers: sort(designers),
    artists: sort(artists),
    publishers: sort(publishers),
    categories: sort(categories),
    mechanics: sort(mechanics),
    languageDependence: [...BGG_LANGUAGE_DEPENDENCE_LEVELS],
    playersMin,
    playersMax,
  };
}

export function queryCollection(
  db: Db,
  params: QueryCollectionParams = {},
): CollectionQueryResult[] {
  const { conditions, values } = buildCollectionConditions(params);

  const sortMap = {
    name: "COALESCE(g.name, ce.name) COLLATE NOCASE ASC",
    rating:
      "ce.personal_rating DESC NULLS LAST, COALESCE(g.name, ce.name) COLLATE NOCASE ASC",
    plays:
      "ce.num_plays DESC, COALESCE(g.name, ce.name) COLLATE NOCASE ASC",
    weight:
      "g.weight DESC NULLS LAST, COALESCE(g.name, ce.name) COLLATE NOCASE ASC",
  } as const;
  const sortKey = params.sortBy ?? "name";
  const sortBy = sortMap[sortKey];
  const limitClause = params.limit ? "LIMIT ?" : "";
  if (params.limit) values.push(params.limit);

  const sql = `
    SELECT
      ce.*,
      COALESCE(g.name, ce.name) AS resolved_name,
      g.weight AS game_weight,
      g.designers AS game_designers_json,
      g.min_players AS game_min_players,
      g.max_players AS game_max_players,
      g.playing_time AS game_playing_time,
      g.min_play_time AS game_min_play_time,
      g.max_play_time AS game_max_play_time,
      g.artists AS game_artists_json,
      g.publishers AS game_publishers_json,
      g.description AS game_description
    FROM collection_entries ce
    LEFT JOIN games g ON g.bgg_id = ce.bgg_id
    WHERE ${conditions.join(" AND ")}
    ORDER BY ${sortBy}
    ${limitClause}
  `;

  const rows = db
    .prepare(sql)
    .all(...(values as Array<string | number>)) as unknown as CollectionRow[];

  const items = rows.map((row) => ({
    collId: row.coll_id,
    bggId: row.bgg_id,
    subtype: row.subtype as GameSubtype,
    name: decodeHtmlEntities(row.resolved_name ?? row.name),
    yearPublished: row.year_published,
    imageUrl: row.image_url,
    thumbnailUrl: row.thumbnail_url,
    own: row.own === 1,
    prevOwned: row.prev_owned === 1,
    forTrade: row.for_trade === 1,
    want: row.want === 1,
    wantToPlay: row.want_to_play === 1,
    wantToBuy: row.want_to_buy === 1,
    wishlist: row.wishlist === 1,
    preordered: row.preordered === 1,
    hasParts: row.has_parts === 1,
    wantParts: row.want_parts === 1,
    personalRating: row.personal_rating,
    comment: row.comment,
    wishlistPriority: row.wishlist_priority,
    numPlays: row.num_plays,
    bggRating: row.bgg_rating,
    bggRank: row.bgg_rank,
    lastModified: row.last_modified,
    syncedAt: row.synced_at,
    gameWeight: row.game_weight,
    gameDesigners: parseJsonArray(row.game_designers_json),
    minPlayers: row.game_min_players,
    maxPlayers: row.game_max_players,
    playingTime: row.game_playing_time,
    minPlayTime: row.game_min_play_time,
    maxPlayTime: row.game_max_play_time,
    gameArtists: parseJsonArray(row.game_artists_json),
    gamePublishers: parseJsonArray(row.game_publishers_json),
    gameDescription: row.game_description,
  }));

  // Re-sort by decoded display name so HTML entities / Unicode don't break A–Z order.
  if (sortKey === "name") {
    items.sort((a, b) =>
      a.name.localeCompare(b.name, "es", { sensitivity: "base", numeric: true }),
    );
  }

  return items;
}

interface CollectionRow {
  coll_id: number;
  bgg_id: number;
  subtype: string;
  name: string;
  year_published: number | null;
  image_url: string | null;
  thumbnail_url: string | null;
  own: number;
  prev_owned: number;
  for_trade: number;
  want: number;
  want_to_play: number;
  want_to_buy: number;
  wishlist: number;
  preordered: number;
  has_parts: number;
  want_parts: number;
  personal_rating: number | null;
  comment: string | null;
  wishlist_priority: number | null;
  num_plays: number;
  bgg_rating: number | null;
  bgg_rank: number | null;
  last_modified: string | null;
  synced_at: string;
  game_weight: number | null;
  game_designers_json: string | null;
  game_min_players: number | null;
  game_max_players: number | null;
  game_playing_time: number | null;
  game_min_play_time: number | null;
  game_max_play_time: number | null;
  game_artists_json: string | null;
  game_publishers_json: string | null;
  game_description: string | null;
  resolved_name: string | null;
}
