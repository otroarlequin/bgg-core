import type { Db } from "../storage/database.js";
import {
  attachDiscoverySuggestions,
  buildPlayProfile,
  type CandidateInput,
  type SmartWishlistMode,
  type SmartWishlistResult,
  type SmartWishlistSuggestion,
} from "./smart-wishlist.js";

export interface HotnessScoutParams {
  mode?: SmartWishlistMode;
  includeExpansions?: boolean;
  /** How many hot IDs to pull from BGG (default 50). */
  hotLimit?: number;
  /** Max things to fetch/score (default 20). */
  maxThings?: number;
  /** Max suggestions to return (default 12). */
  limit?: number;
}

export interface HotnessScoutDeps {
  fetchHotGameIds: (limit: number) => Promise<number[]>;
  fetchThings: (bggIds: number[]) => Promise<
    Array<{
      bggId: number;
      name: string;
      yearPublished: number | null;
      thumbnailUrl: string | null;
      thingType: string | null;
      designers: string[];
      mechanics: string[];
      categories: string[];
    }>
  >;
}

export interface HotnessScoutResult {
  status: {
    ok: boolean;
    message?: string;
  };
  mode: SmartWishlistMode;
  hotRankTotal: number;
  candidatesFetched: number;
  alreadyOwnedSkipped: number;
  suggestions: SmartWishlistSuggestion[];
  profile: SmartWishlistResult["profile"];
}

function loadOwnedIds(db: Db): Set<number> {
  const rows = db
    .prepare(`SELECT bgg_id FROM collection_entries WHERE own = 1`)
    .all() as Array<{ bgg_id: number }>;
  return new Set(rows.map((r) => r.bgg_id));
}

function loadTrackedFlags(db: Db): Map<
  number,
  { wishlist: boolean; preordered: boolean; wantToPlay: boolean }
> {
  const rows = db
    .prepare(
      `SELECT bgg_id, wishlist, preordered, want_to_play
       FROM collection_entries
       WHERE wishlist = 1 OR preordered = 1 OR want_to_play = 1`,
    )
    .all() as Array<{
    bgg_id: number;
    wishlist: number;
    preordered: number;
    want_to_play: number;
  }>;
  const map = new Map<
    number,
    { wishlist: boolean; preordered: boolean; wantToPlay: boolean }
  >();
  for (const row of rows) {
    map.set(row.bgg_id, {
      wishlist: row.wishlist === 1,
      preordered: row.preordered === 1,
      wantToPlay: row.want_to_play === 1,
    });
  }
  return map;
}

/**
 * Hot list of BGG scored against the user's owned-play profile.
 * Excludes owned only; wishlist/preordered may appear (already on radar).
 */
export async function runHotnessScoutQuery(
  db: Db,
  deps: HotnessScoutDeps,
  params: HotnessScoutParams = {},
): Promise<HotnessScoutResult> {
  const mode = params.mode ?? "balance";
  const includeExpansions = params.includeExpansions === true;
  const hotLimit = params.hotLimit ?? 50;
  const maxThings = params.maxThings ?? 20;
  const limit = params.limit ?? 12;

  const { profile } = buildPlayProfile(db);
  const owned = loadOwnedIds(db);
  const tracked = loadTrackedFlags(db);

  if (profile.ownedCount === 0) {
    return {
      status: {
        ok: false,
        message: "Necesitas juegos owned (con things) para comparar la hot list.",
      },
      mode,
      hotRankTotal: 0,
      candidatesFetched: 0,
      alreadyOwnedSkipped: 0,
      suggestions: [],
      profile,
    };
  }

  let hotIds: number[] = [];
  try {
    hotIds = await deps.fetchHotGameIds(hotLimit);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      status: {
        ok: false,
        message: `No se pudo leer la hot list de BGG: ${message}`,
      },
      mode,
      hotRankTotal: 0,
      candidatesFetched: 0,
      alreadyOwnedSkipped: 0,
      suggestions: [],
      profile,
    };
  }

  let alreadyOwnedSkipped = 0;
  const idToRank = new Map<number, number>();
  const candidateIds: number[] = [];
  hotIds.forEach((id, index) => {
    idToRank.set(id, index + 1);
    if (owned.has(id)) {
      alreadyOwnedSkipped += 1;
      return;
    }
    if (candidateIds.length < maxThings) candidateIds.push(id);
  });

  if (candidateIds.length === 0) {
    return {
      status: {
        ok: true,
        message:
          hotIds.length === 0
            ? "BGG devolvió una hot list vacía."
            : "Todos los juegos de la hot list ya están en tu owned.",
      },
      mode,
      hotRankTotal: hotIds.length,
      candidatesFetched: 0,
      alreadyOwnedSkipped,
      suggestions: [],
      profile,
    };
  }

  let things: Awaited<ReturnType<HotnessScoutDeps["fetchThings"]>> = [];
  try {
    things = await deps.fetchThings(candidateIds);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      status: {
        ok: false,
        message: `Falló al cargar details de la hot list: ${message}`,
      },
      mode,
      hotRankTotal: hotIds.length,
      candidatesFetched: 0,
      alreadyOwnedSkipped,
      suggestions: [],
      profile,
    };
  }

  const candidates: CandidateInput[] = [];
  for (const game of things) {
    if (owned.has(game.bggId)) continue;
    if (
      !includeExpansions &&
      (game.thingType === "boardgameexpansion" ||
        game.thingType === "boardgameaccessory")
    ) {
      continue;
    }
    const rank = idToRank.get(game.bggId);
    candidates.push({
      source: "discovery",
      bggId: game.bggId,
      name: game.name,
      thumbnailUrl: game.thumbnailUrl,
      yearPublished: game.yearPublished,
      subtype: game.thingType,
      wishlistPriority: null,
      designers: game.designers,
      mechanics: game.mechanics,
      categories: game.categories,
      discoverySeed: rank != null ? `hot BGG #${rank}` : "tendencias en BGG",
    });
  }

  const emptyBase: SmartWishlistResult = {
    profile,
    gaps: [],
    localSuggestions: [],
    discoverySuggestions: [],
    discoveryStatus: { available: true },
  };

  const scored = attachDiscoverySuggestions(db, emptyBase, candidates, {
    mode,
    discoveryLimit: limit,
  });

  const suggestions = scored.discoverySuggestions.map((s) => {
    const flags = tracked.get(s.bggId);
    if (!flags) return s;
    const tags: string[] = [];
    if (flags.wishlist) tags.push("ya en wishlist");
    if (flags.preordered) tags.push("preordered");
    if (flags.wantToPlay) tags.push("want-to-play");
    if (tags.length === 0) return s;
    return {
      ...s,
      reasons: [
        {
          kind: "discovery_seed" as const,
          strength: "medium" as const,
          headline: `Ya lo tienes marcado: ${tags.join(", ")}.`,
        },
        ...s.reasons,
      ].slice(0, 3),
    };
  });

  return {
    status: {
      ok: true,
      message:
        suggestions.length === 0
          ? "La hot list no trajo candidatos puntuables contra tu perfil."
          : undefined,
    },
    mode,
    hotRankTotal: hotIds.length,
    candidatesFetched: things.length,
    alreadyOwnedSkipped,
    suggestions,
    profile,
  };
}
