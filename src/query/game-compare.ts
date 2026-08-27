import type { Game } from "../domain/types.js";
import type { Db } from "../storage/database.js";
import {
  decodeHtmlEntities,
  decodeHtmlEntitiesList,
} from "../utils/html-entities.js";

/** Raise later without redesigning the compare table. */
export const MAX_COMPARE_SLOTS = 4;

export interface CompareCollectionStatus {
  own: boolean;
  wishlist: boolean;
  preordered: boolean;
  personalRating: number | null;
  numPlays: number;
  subtype: string | null;
}

export interface CompareGameColumn {
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
  designers: string[];
  mechanics: string[];
  categories: string[];
  languageDependence: string | null;
  bggRating: number | null;
  bggRank: number | null;
  subtype: string | null;
  collection: CompareCollectionStatus | null;
  /** Similarity vs first column (0–100). Null for the base column. */
  similarityVsBasePercent: number | null;
}

export type CompareSpecKey =
  | "players"
  | "time"
  | "weight"
  | "bggRating"
  | "bggRank"
  | "year"
  | "language"
  | "subtype"
  | "collectionStatus";

export interface CompareSpecRow {
  key: CompareSpecKey;
  label: string;
  values: Array<string | null>;
  differs: boolean;
}

export interface CompareTagGroup {
  label: string;
  shared: string[];
  uniqueByGame: Array<{ bggId: number; name: string; values: string[] }>;
}

export interface GameCompareResult {
  games: CompareGameColumn[];
  rows: CompareSpecRow[];
  tagGroups: CompareTagGroup[];
  meanSimilarityVsBasePercent: number | null;
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

function formatPlayers(min: number | null, max: number | null): string | null {
  if (min == null && max == null) return null;
  if (min != null && max != null) {
    return min === max ? String(min) : `${min}–${max}`;
  }
  return String(min ?? max);
}

function formatTime(
  playing: number | null,
  min: number | null,
  max: number | null,
): string | null {
  if (min != null || max != null) {
    if (min != null && max != null) {
      return min === max ? `${min} min` : `${min}–${max} min`;
    }
    return `${min ?? max} min`;
  }
  if (playing != null) return `${playing} min`;
  return null;
}

function formatWeight(weight: number | null): string | null {
  return weight != null ? weight.toFixed(2) : null;
}

function formatRating(rating: number | null): string | null {
  return rating != null ? rating.toFixed(1) : null;
}

function formatRank(rank: number | null): string | null {
  return rank != null ? `#${rank}` : null;
}

function formatCollection(status: CompareCollectionStatus | null): string | null {
  if (!status) return null;
  const bits: string[] = [];
  if (status.own) bits.push("Owned");
  if (status.wishlist) bits.push("Wishlist");
  if (status.preordered) bits.push("Preordered");
  if (bits.length === 0) return null;
  return bits.join(" · ");
}

function valuesDiffer(values: Array<string | null>): boolean {
  const normalized = values.map((v) =>
    v == null || v.trim() === "" ? null : v.trim().toLowerCase(),
  );
  const present = normalized.filter((v) => v != null);
  if (present.length <= 1) return false;
  return new Set(present).size > 1;
}

function loadCollectionStatus(
  db: Db,
  bggId: number,
): CompareCollectionStatus | null {
  const row = db
    .prepare(
      `SELECT own, wishlist, preordered, personal_rating, num_plays, subtype
       FROM collection_entries WHERE bgg_id = ? LIMIT 1`,
    )
    .get(bggId) as
    | {
        own: number;
        wishlist: number;
        preordered: number;
        personal_rating: number | null;
        num_plays: number;
        subtype: string;
      }
    | undefined;
  if (!row) return null;
  return {
    own: row.own === 1,
    wishlist: row.wishlist === 1,
    preordered: row.preordered === 1,
    personalRating: row.personal_rating,
    numPlays: row.num_plays,
    subtype: row.subtype,
  };
}

function buildTagGroup(
  label: string,
  games: CompareGameColumn[],
  pick: (g: CompareGameColumn) => string[],
): CompareTagGroup {
  const sets = games.map((g) => {
    const values = pick(g).map((v) => decodeHtmlEntities(v));
    return { game: g, set: new Set(values.map(normalizeToken)), raw: values };
  });

  let sharedTokens: Set<string> | null = null;
  for (const s of sets) {
    if (sharedTokens == null) {
      sharedTokens = new Set(s.set);
    } else {
      const next = new Set<string>();
      for (const t of sharedTokens) {
        if (s.set.has(t)) next.add(t);
      }
      sharedTokens = next;
    }
  }
  const sharedSet = sharedTokens ?? new Set<string>();

  const sharedLabels = new Map<string, string>();
  for (const s of sets) {
    for (const raw of s.raw) {
      const key = normalizeToken(raw);
      if (sharedSet.has(key) && !sharedLabels.has(key)) {
        sharedLabels.set(key, raw);
      }
    }
  }

  const uniqueByGame = sets.map((s) => {
    const values = s.raw.filter((raw) => !sharedSet.has(normalizeToken(raw)));
    const seen = new Set<string>();
    const deduped: string[] = [];
    for (const v of values) {
      const k = normalizeToken(v);
      if (seen.has(k)) continue;
      seen.add(k);
      deduped.push(v);
    }
    return {
      bggId: s.game.bggId,
      name: s.game.name,
      values: deduped,
    };
  });

  return {
    label,
    shared: [...sharedLabels.values()].sort((a, b) => a.localeCompare(b)),
    uniqueByGame,
  };
}

function gameToColumn(
  game: Game,
  collection: CompareCollectionStatus | null,
  similarityVsBasePercent: number | null,
): CompareGameColumn {
  return {
    bggId: game.bggId,
    name: decodeHtmlEntities(game.name),
    yearPublished: game.yearPublished,
    minPlayers: game.minPlayers,
    maxPlayers: game.maxPlayers,
    playingTime: game.playingTime,
    minPlayTime: game.minPlayTime,
    maxPlayTime: game.maxPlayTime,
    weight: game.weight,
    imageUrl: game.imageUrl,
    thumbnailUrl: game.thumbnailUrl,
    designers: decodeHtmlEntitiesList(game.designers),
    mechanics: decodeHtmlEntitiesList(game.mechanics),
    categories: decodeHtmlEntitiesList(game.categories),
    languageDependence: game.languageDependence
      ? decodeHtmlEntities(game.languageDependence)
      : null,
    bggRating: game.bggRating,
    bggRank: game.bggRank,
    subtype: collection?.subtype ?? game.thingType ?? null,
    collection,
    similarityVsBasePercent,
  };
}

export function buildGameCompare(
  db: Db,
  games: Game[],
): GameCompareResult {
  if (games.length === 0) {
    return {
      games: [],
      rows: [],
      tagGroups: [],
      meanSimilarityVsBasePercent: null,
    };
  }

  const baseTokens = similarityTokens(games[0]);
  const columns = games.map((game, index) => {
    const collection = loadCollectionStatus(db, game.bggId);
    let similarityVsBasePercent: number | null = null;
    if (index > 0) {
      const sim = jaccard(baseTokens, similarityTokens(game));
      similarityVsBasePercent = Math.round(sim * 1000) / 10;
    }
    return gameToColumn(game, collection, similarityVsBasePercent);
  });

  const vsBase = columns
    .slice(1)
    .map((c) => c.similarityVsBasePercent)
    .filter((v): v is number => v != null);
  const meanSimilarityVsBasePercent =
    vsBase.length === 0
      ? null
      : Math.round(
          (vsBase.reduce((sum, v) => sum + v, 0) / vsBase.length) * 10,
        ) / 10;

  const specDefs: Array<{
    key: CompareSpecKey;
    label: string;
    cell: (g: CompareGameColumn) => string | null;
  }> = [
    {
      key: "players",
      label: "Jugadores",
      cell: (g) => formatPlayers(g.minPlayers, g.maxPlayers),
    },
    {
      key: "time",
      label: "Tiempo",
      cell: (g) => formatTime(g.playingTime, g.minPlayTime, g.maxPlayTime),
    },
    {
      key: "weight",
      label: "Peso",
      cell: (g) => formatWeight(g.weight),
    },
    {
      key: "bggRating",
      label: "Rating BGG",
      cell: (g) => formatRating(g.bggRating),
    },
    {
      key: "bggRank",
      label: "Rank BGG",
      cell: (g) => formatRank(g.bggRank),
    },
    {
      key: "year",
      label: "Año",
      cell: (g) => (g.yearPublished != null ? String(g.yearPublished) : null),
    },
    {
      key: "language",
      label: "Idioma",
      cell: (g) => g.languageDependence,
    },
    {
      key: "subtype",
      label: "Tipo",
      cell: (g) => {
        if (g.subtype === "boardgameexpansion") return "Expansión";
        if (g.subtype === "boardgame") return "Base";
        return g.subtype;
      },
    },
    {
      key: "collectionStatus",
      label: "En tu colección",
      cell: (g) => formatCollection(g.collection),
    },
  ];

  const rows: CompareSpecRow[] = specDefs.map((def) => {
    const values = columns.map((g) => def.cell(g));
    return {
      key: def.key,
      label: def.label,
      values,
      differs: valuesDiffer(values),
    };
  });

  const tagGroups = [
    buildTagGroup("Mecánicas", columns, (g) => g.mechanics),
    buildTagGroup("Categorías", columns, (g) => g.categories),
    buildTagGroup("Diseñadores", columns, (g) => g.designers),
  ];

  return {
    games: columns,
    rows,
    tagGroups,
    meanSimilarityVsBasePercent,
  };
}
