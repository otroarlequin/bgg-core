import type { Game } from "../domain/types.js";
import type { Db } from "../storage/database.js";
import {
  decodeHtmlEntities,
  decodeHtmlEntitiesList,
} from "../utils/html-entities.js";

export type MatchFacet =
  | "designer"
  | "artist"
  | "publisher"
  | "mechanic"
  | "category"
  | "languageDependence";

export interface CollectionStatusFlags {
  own: boolean;
  wishlist: boolean;
  preordered: boolean;
  wishlistPriority: number | null;
}

export interface CandidateGameView {
  bggId: number;
  name: string;
  yearPublished: number | null;
  minPlayers: number | null;
  maxPlayers: number | null;
  playingTime: number | null;
  minPlayTime: number | null;
  maxPlayTime: number | null;
  weight: number | null;
  imageUrl: string | null;
  thumbnailUrl: string | null;
  description: string | null;
  designers: string[];
  artists: string[];
  publishers: string[];
  mechanics: string[];
  categories: string[];
  languageDependence: string | null;
  bggRating: number | null;
  bggRank: number | null;
  personalRating: number | null;
  numPlays: number;
  collectionStatus: CollectionStatusFlags | null;
}

export interface MatchGameRow {
  bggId: number;
  name: string;
  thumbnailUrl: string | null;
  personalRating: number | null;
  numPlays: number;
  weight: number | null;
  subtype: string;
  own: boolean;
  wishlist: boolean;
  preordered: boolean;
  similarity?: number;
}

export interface OverlapSummary {
  /** Mean Jaccard similarity of the top-10 most similar collection games (0–100). */
  top10MeanPercent: number;
  topSimilar: MatchGameRow[];
  hint: string;
}

export interface PurchaseAnalysis {
  candidate: CandidateGameView;
  alreadyInCollection: boolean;
  overlap: OverlapSummary;
}

export interface FacetMatchesResult {
  facet: MatchFacet;
  value: string;
  total: number;
  items: MatchGameRow[];
}

interface UniverseRow {
  bgg_id: number;
  name: string;
  subtype: string;
  thumbnail_url: string | null;
  personal_rating: number | null;
  num_plays: number;
  weight: number | null;
  own: number;
  wishlist: number;
  preordered: number;
  wishlist_priority: number | null;
  designers_json: string | null;
  artists_json: string | null;
  publishers_json: string | null;
  mechanics_json: string | null;
  categories_json: string | null;
  language_dependence: string | null;
  year_published: number | null;
  min_players: number | null;
  max_players: number | null;
  playing_time: number | null;
  min_play_time: number | null;
  max_play_time: number | null;
  image_url: string | null;
  bgg_rating: number | null;
  bgg_rank: number | null;
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

function normalizeToken(value: string): string {
  return value.trim().toLowerCase();
}

function similarityTokens(game: {
  designers: string[];
  mechanics: string[];
  categories: string[];
}): Set<string> {
  const tokens = new Set<string>();
  for (const d of game.designers) tokens.add(`d:${normalizeToken(d)}`);
  for (const m of game.mechanics) tokens.add(`m:${normalizeToken(m)}`);
  for (const c of game.categories) tokens.add(`c:${normalizeToken(c)}`);
  return tokens;
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 0;
  let intersect = 0;
  for (const token of a) {
    if (b.has(token)) intersect += 1;
  }
  const union = a.size + b.size - intersect;
  return union === 0 ? 0 : intersect / union;
}

function loadUniverse(db: Db): UniverseRow[] {
  return db
    .prepare(
      `SELECT
         ce.bgg_id,
         COALESCE(g.name, ce.name) AS name,
         ce.subtype,
         COALESCE(g.thumbnail_url, ce.thumbnail_url) AS thumbnail_url,
         ce.personal_rating,
         ce.num_plays,
         g.weight,
         ce.own,
         ce.wishlist,
         ce.preordered,
         ce.wishlist_priority,
         g.designers AS designers_json,
         g.artists AS artists_json,
         g.publishers AS publishers_json,
         g.mechanics AS mechanics_json,
         g.categories AS categories_json,
         g.language_dependence,
         COALESCE(g.year_published, ce.year_published) AS year_published,
         g.min_players,
         g.max_players,
         g.playing_time,
         g.min_play_time,
         g.max_play_time,
         COALESCE(g.image_url, ce.image_url) AS image_url,
         COALESCE(g.bgg_rating, ce.bgg_rating) AS bgg_rating,
         COALESCE(g.bgg_rank, ce.bgg_rank) AS bgg_rank
       FROM collection_entries ce
       LEFT JOIN games g ON g.bgg_id = ce.bgg_id
       WHERE ce.own = 1 OR ce.wishlist = 1 OR ce.preordered = 1`,
    )
    .all() as unknown as UniverseRow[];
}

function rowToMatch(row: UniverseRow, similarity?: number): MatchGameRow {
  return {
    bggId: row.bgg_id,
    name: decodeHtmlEntities(row.name),
    thumbnailUrl: row.thumbnail_url,
    personalRating: row.personal_rating,
    numPlays: row.num_plays,
    weight: row.weight,
    subtype: row.subtype,
    own: row.own === 1,
    wishlist: row.wishlist === 1,
    preordered: row.preordered === 1,
    similarity,
  };
}

function sortMatches(items: MatchGameRow[]): MatchGameRow[] {
  return [...items].sort((a, b) => {
    const ar = a.personalRating;
    const br = b.personalRating;
    if (ar == null && br != null) return 1;
    if (ar != null && br == null) return -1;
    if (ar != null && br != null && ar !== br) return br - ar;
    if (b.numPlays !== a.numPlays) return b.numPlays - a.numPlays;
    return a.name.localeCompare(b.name);
  });
}

export function buildCandidateView(
  game: Game,
  collectionRow: UniverseRow | null,
): CandidateGameView {
  const status: CollectionStatusFlags | null = collectionRow
    ? {
        own: collectionRow.own === 1,
        wishlist: collectionRow.wishlist === 1,
        preordered: collectionRow.preordered === 1,
        wishlistPriority: collectionRow.wishlist_priority,
      }
    : null;

  return {
    bggId: game.bggId,
    name: game.name,
    yearPublished: game.yearPublished,
    minPlayers: game.minPlayers,
    maxPlayers: game.maxPlayers,
    playingTime: game.playingTime,
    minPlayTime: game.minPlayTime,
    maxPlayTime: game.maxPlayTime,
    weight: game.weight,
    imageUrl: game.imageUrl,
    thumbnailUrl: game.thumbnailUrl,
    description: game.description,
    designers: game.designers,
    artists: game.artists,
    publishers: game.publishers,
    mechanics: game.mechanics,
    categories: game.categories,
    languageDependence: game.languageDependence,
    bggRating: game.bggRating,
    bggRank: game.bggRank,
    personalRating: collectionRow?.personal_rating ?? null,
    numPlays: collectionRow?.num_plays ?? 0,
    collectionStatus: status,
  };
}

export function analyzePurchaseCandidate(
  db: Db,
  game: Game,
): PurchaseAnalysis {
  const universe = loadUniverse(db);
  const collectionRow =
    universe.find((r) => r.bgg_id === game.bggId) ??
    (db
      .prepare(
        `SELECT
           ce.bgg_id, ce.name, ce.subtype, ce.thumbnail_url, ce.personal_rating,
           ce.num_plays, NULL AS weight, ce.own, ce.wishlist, ce.preordered,
           ce.wishlist_priority, NULL AS designers_json, NULL AS artists_json,
           NULL AS publishers_json, NULL AS mechanics_json, NULL AS categories_json,
           NULL AS language_dependence, ce.year_published, NULL AS min_players,
           NULL AS max_players, NULL AS playing_time, NULL AS min_play_time,
           NULL AS max_play_time, ce.image_url, ce.bgg_rating, ce.bgg_rank
         FROM collection_entries ce WHERE ce.bgg_id = ? LIMIT 1`,
      )
      .get(game.bggId) as UniverseRow | undefined) ??
    null;

  const candidateTokens = similarityTokens(game);
  const scored = universe
    .filter((r) => r.bgg_id !== game.bggId)
    .map((row) => {
      const tokens = similarityTokens({
        designers: parseJsonArray(row.designers_json),
        mechanics: parseJsonArray(row.mechanics_json),
        categories: parseJsonArray(row.categories_json),
      });
      return rowToMatch(row, jaccard(candidateTokens, tokens));
    })
    .sort((a, b) => (b.similarity ?? 0) - (a.similarity ?? 0));

  const topSimilar = scored.slice(0, 10);
  const top10Mean =
    topSimilar.length === 0
      ? 0
      : topSimilar.reduce((sum, g) => sum + (g.similarity ?? 0), 0) /
        topSimilar.length;

  const alreadyInCollection = Boolean(
    collectionRow &&
      (collectionRow.own === 1 ||
        collectionRow.wishlist === 1 ||
        collectionRow.preordered === 1),
  );

  return {
    candidate: buildCandidateView(game, collectionRow),
    alreadyInCollection,
    overlap: {
      top10MeanPercent: Math.round(top10Mean * 1000) / 10,
      topSimilar,
      hint: "Similitud con tu ludoteca (mecánicas, categorías y diseñadores), no predicción de gusto.",
    },
  };
}

export function queryFacetMatches(
  db: Db,
  facet: MatchFacet,
  value: string,
  options: { limit?: number; excludeBggId?: number } = {},
): FacetMatchesResult {
  const universe = loadUniverse(db);
  const needle = normalizeToken(value);
  const limit = options.limit ?? 10;

  const filtered = universe.filter((row) => {
    if (options.excludeBggId != null && row.bgg_id === options.excludeBggId) {
      return false;
    }
    switch (facet) {
      case "designer":
        return parseJsonArray(row.designers_json).some(
          (v) => normalizeToken(v) === needle,
        );
      case "artist":
        return parseJsonArray(row.artists_json).some(
          (v) => normalizeToken(v) === needle,
        );
      case "publisher":
        return parseJsonArray(row.publishers_json).some(
          (v) => normalizeToken(v) === needle,
        );
      case "mechanic":
        return parseJsonArray(row.mechanics_json).some(
          (v) => normalizeToken(v) === needle,
        );
      case "category":
        return parseJsonArray(row.categories_json).some(
          (v) => normalizeToken(v) === needle,
        );
      case "languageDependence":
        return normalizeToken(row.language_dependence ?? "") === needle;
      default:
        return false;
    }
  });

  const sorted = sortMatches(filtered.map((r) => rowToMatch(r)));
  const items =
    limit <= 0 || limit >= sorted.length ? sorted : sorted.slice(0, limit);

  return {
    facet,
    value,
    total: sorted.length,
    items,
  };
}
