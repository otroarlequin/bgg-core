import type { Db } from "../storage/database.js";
import {
  decodeHtmlEntities,
  decodeHtmlEntitiesList,
} from "../utils/html-entities.js";

export type SmartWishlistMode = "balance" | "more" | "gaps";

export interface SmartWishlistParams {
  mode?: SmartWishlistMode;
  includeWantToPlay?: boolean;
  includeExpansions?: boolean;
  /** Cap local suggestions (default 25). */
  localLimit?: number;
  /** Cap discovery suggestions after scoring (default 5). */
  discoveryLimit?: number;
}

export type ReasonKind =
  | "fit_mechanic"
  | "fit_designer"
  | "fit_category"
  | "gap_mechanic"
  | "gap_designer"
  | "gap_category"
  | "similar_loved"
  | "fresh_vs_owned"
  | "crowded_clone"
  | "priority"
  | "discovery_seed"
  | "missing_data";

export type ReasonStrength = "high" | "medium" | "low";

export interface Reason {
  kind: ReasonKind;
  strength: ReasonStrength;
  headline: string;
  detail?: string;
}

export type FacetKind = "mechanic" | "designer" | "category";

export interface FacetTasteEntry {
  facet: FacetKind;
  value: string;
  taste: number;
  rawTaste: number;
  ownedCount: number;
  totalPlays: number;
}

export interface GapEntry {
  facet: FacetKind;
  value: string;
  kind: "strong" | "soft" | "saturated";
  taste: number;
  ownedCount: number;
}

export interface SmartWishlistProfile {
  topMechanics: FacetTasteEntry[];
  topDesigners: FacetTasteEntry[];
  topCategories: FacetTasteEntry[];
  ownedCount: number;
  playSignalCount: number;
  summary: string;
}

export interface ScoreBreakdown {
  fit: number;
  gap: number;
  novelty: number;
  priority: number;
}

export interface CoveredGap {
  facet: FacetKind;
  value: string;
}

export interface SmartWishlistSuggestion {
  source: "local" | "discovery";
  bggId: number;
  name: string;
  thumbnailUrl: string | null;
  yearPublished: number | null;
  subtype: string | null;
  wishlistPriority: number | null;
  score: number;
  breakdown: ScoreBreakdown;
  reasons: Reason[];
  /** Classic collection gaps this candidate covers — for scoring + chip filters. */
  coveredGaps: CoveredGap[];
  /** Mechanics/designers on this game with taste ≥ 0.25 (wishlist filter fallback). */
  tasteFacets: CoveredGap[];
  discoverySeed?: string;
}

export interface DiscoveryStatus {
  available: boolean;
  message?: string;
}

export interface SmartWishlistResult {
  profile: SmartWishlistProfile;
  gaps: GapEntry[];
  localSuggestions: SmartWishlistSuggestion[];
  discoverySuggestions: SmartWishlistSuggestion[];
  discoveryStatus: DiscoveryStatus;
}

interface OwnedRow {
  bgg_id: number;
  name: string;
  subtype: string;
  personal_rating: number | null;
  num_plays: number;
  last_play_date: string | null;
  designers_json: string | null;
  mechanics_json: string | null;
  categories_json: string | null;
}

interface CandidateRow {
  bgg_id: number;
  name: string;
  subtype: string;
  year_published: number | null;
  thumbnail_url: string | null;
  wishlist: number;
  want_to_play: number;
  wishlist_priority: number | null;
  designers_json: string | null;
  mechanics_json: string | null;
  categories_json: string | null;
}

export interface CandidateInput {
  source: "local" | "discovery";
  bggId: number;
  name: string;
  thumbnailUrl: string | null;
  yearPublished: number | null;
  subtype: string | null;
  wishlistPriority: number | null;
  designers: string[];
  mechanics: string[];
  categories: string[];
  discoverySeed?: string;
}

interface ModeWeights {
  fitMax: number;
  gapMax: number;
  noveltyMax: number;
  priorityMax: number;
}

const MODE_WEIGHTS: Record<SmartWishlistMode, ModeWeights> = {
  balance: { fitMax: 40, gapMax: 30, noveltyMax: 20, priorityMax: 10 },
  more: { fitMax: 55, gapMax: 15, noveltyMax: 10, priorityMax: 10 },
  gaps: { fitMax: 25, gapMax: 45, noveltyMax: 10, priorityMax: 10 },
};

const STRENGTH_RANK: Record<ReasonStrength, number> = {
  high: 3,
  medium: 2,
  low: 1,
};

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

/** Same token scheme as purchase-validator (d:/m:/c:). */
export function similarityTokens(game: {
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

export function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 0;
  let intersect = 0;
  for (const token of a) {
    if (b.has(token)) intersect += 1;
  }
  const union = a.size + b.size - intersect;
  return union === 0 ? 0 : intersect / union;
}

/**
 * BGG tags that often mark *capability* (e.g. has a solo mode), not that you
 * prefer that mode. Soft-weighted in taste; deprioritized as headline reasons.
 */
const LOW_SIGNAL_FACETS = new Set(
  [
    "Solo / Solitaire Game",
    "Solitaire",
    "Fan Expansion",
    "Expansion for Base-game",
  ].map((v) => normalizeToken(v)),
);

function isLowSignalFacet(value: string): boolean {
  return LOW_SIGNAL_FACETS.has(normalizeToken(value));
}

function facetSignalWeight(value: string): number {
  return isLowSignalFacet(value) ? 0.35 : 1;
}

/**
 * Weight an owned game toward facet taste.
 * Unplayed owned still count (collection shape) but weakly — avoids “you play X”
 * from shelf tags alone.
 */
function gameWeight(row: {
  num_plays: number;
  personal_rating: number | null;
  last_play_date: string | null;
}): number {
  const plays = Math.max(0, row.num_plays);
  if (plays === 0 && !row.last_play_date) {
    let w = 0.2;
    const rating = row.personal_rating;
    if (rating != null && rating >= 7) w += 0.15;
    return w;
  }

  let w = 1 + Math.log1p(plays);
  const rating = row.personal_rating;
  if (rating != null) {
    if (rating >= 9) w += 1.5;
    else if (rating >= 8) w += 1;
    else if (rating >= 7) w += 0.5;
  }
  if (row.last_play_date) {
    const days =
      (Date.now() - new Date(row.last_play_date).getTime()) /
      (1000 * 60 * 60 * 24);
    if (Number.isFinite(days) && days >= 0 && days < 90) w += 0.3;
  }
  return w;
}

function loadOwnedRows(db: Db): OwnedRow[] {
  return db
    .prepare(
      `SELECT
         ce.bgg_id,
         COALESCE(g.name, ce.name) AS name,
         ce.subtype,
         ce.personal_rating,
         ce.num_plays,
         (
           SELECT MAX(p.date) FROM plays p WHERE p.bgg_id = ce.bgg_id
         ) AS last_play_date,
         g.designers AS designers_json,
         g.mechanics AS mechanics_json,
         g.categories AS categories_json
       FROM collection_entries ce
       LEFT JOIN games g ON g.bgg_id = ce.bgg_id
       WHERE ce.own = 1`,
    )
    .all() as unknown as OwnedRow[];
}

function loadLocalCandidates(
  db: Db,
  params: {
    includeWantToPlay: boolean;
    includeExpansions: boolean;
  },
): CandidateRow[] {
  const conditions = ["ce.own = 0", "(ce.wishlist = 1"];
  if (params.includeWantToPlay) {
    conditions[1] += " OR ce.want_to_play = 1)";
  } else {
    conditions[1] += ")";
  }
  if (!params.includeExpansions) {
    conditions.push("ce.subtype != 'boardgameexpansion'");
  }

  return db
    .prepare(
      `SELECT
         ce.bgg_id,
         COALESCE(g.name, ce.name) AS name,
         ce.subtype,
         COALESCE(g.year_published, ce.year_published) AS year_published,
         COALESCE(g.thumbnail_url, ce.thumbnail_url) AS thumbnail_url,
         ce.wishlist,
         ce.want_to_play,
         ce.wishlist_priority,
         g.designers AS designers_json,
         g.mechanics AS mechanics_json,
         g.categories AS categories_json
       FROM collection_entries ce
       LEFT JOIN games g ON g.bgg_id = ce.bgg_id
       WHERE ${conditions.join(" AND ")}`,
    )
    .all() as unknown as CandidateRow[];
}

function loadExcludedBggIds(db: Db): Set<number> {
  const rows = db
    .prepare(
      `SELECT bgg_id FROM collection_entries
       WHERE own = 1 OR wishlist = 1 OR preordered = 1 OR want_to_play = 1`,
    )
    .all() as Array<{ bgg_id: number }>;
  return new Set(rows.map((r) => r.bgg_id));
}

function buildFacetMaps(owned: OwnedRow[]): {
  mechanics: Map<string, { raw: number; ownedIds: Set<number>; plays: number }>;
  designers: Map<string, { raw: number; ownedIds: Set<number>; plays: number }>;
  categories: Map<string, { raw: number; ownedIds: Set<number>; plays: number }>;
} {
  const mechanics = new Map<
    string,
    { raw: number; ownedIds: Set<number>; plays: number }
  >();
  const designers = new Map<
    string,
    { raw: number; ownedIds: Set<number>; plays: number }
  >();
  const categories = new Map<
    string,
    { raw: number; ownedIds: Set<number>; plays: number }
  >();

  const bump = (
    map: Map<string, { raw: number; ownedIds: Set<number>; plays: number }>,
    value: string,
    row: OwnedRow,
    w: number,
  ) => {
    const key = value.trim();
    if (!key) return;
    const cur = map.get(key) ?? {
      raw: 0,
      ownedIds: new Set<number>(),
      plays: 0,
    };
    cur.raw += w;
    cur.ownedIds.add(row.bgg_id);
    cur.plays += row.num_plays;
    map.set(key, cur);
  };

  for (const row of owned) {
    const base = gameWeight(row);
    for (const m of parseJsonArray(row.mechanics_json)) {
      bump(mechanics, m, row, base * facetSignalWeight(m));
    }
    // Split weight across co-designers so a single obscure credit
    // on a heavily played game does not look like a "designer gap".
    const designerList = parseJsonArray(row.designers_json);
    const designerShare =
      designerList.length > 0 ? base / designerList.length : 0;
    for (const d of designerList) {
      bump(designers, d, row, designerShare);
    }
    for (const c of parseJsonArray(row.categories_json)) {
      bump(categories, c, row, base * facetSignalWeight(c));
    }
  }

  return { mechanics, designers, categories };
}

export interface FacetTasteMeta {
  taste: number;
  totalPlays: number;
  ownedCount: number;
}

function toTasteEntries(
  facet: FacetKind,
  map: Map<string, { raw: number; ownedIds: Set<number>; plays: number }>,
): FacetTasteEntry[] {
  const maxRaw = Math.max(0, ...[...map.values()].map((v) => v.raw));
  const entries: FacetTasteEntry[] = [];
  for (const [value, data] of map) {
    entries.push({
      facet,
      value,
      rawTaste: data.raw,
      taste: maxRaw > 0 ? data.raw / maxRaw : 0,
      ownedCount: data.ownedIds.size,
      totalPlays: data.plays,
    });
  }
  return entries.sort((a, b) => b.taste - a.taste || a.value.localeCompare(b.value));
}

function percentileThreshold(sortedDesc: number[], percentile: number): number {
  if (sortedDesc.length === 0) return 1;
  const idx = Math.min(
    sortedDesc.length - 1,
    Math.floor(((100 - percentile) / 100) * sortedDesc.length),
  );
  return sortedDesc[idx] ?? 1;
}

function computeGaps(entries: FacetTasteEntry[]): GapEntry[] {
  const byFacet: FacetKind[] = ["mechanic", "designer", "category"];
  const gaps: GapEntry[] = [];

  for (const facet of byFacet) {
    const group = entries.filter((e) => e.facet === facet && e.taste > 0);
    if (group.length === 0) continue;
    const tastes = group.map((e) => e.taste).sort((a, b) => b - a);
    const highBar = percentileThreshold(tastes, 70);
    // Designers need a clearer play signal; co-credits are noisy.
    const minPlaysStrong = facet === "designer" ? 5 : 1;
    const minPlaysSoft = facet === "designer" ? 8 : 2;

    for (const e of group) {
      const avgPlays =
        e.ownedCount > 0 ? e.totalPlays / e.ownedCount : 0;
      if (e.ownedCount >= 4 && avgPlays < 1.5) {
        gaps.push({
          facet,
          value: e.value,
          kind: "saturated",
          taste: e.taste,
          ownedCount: e.ownedCount,
        });
        continue;
      }
      if (e.taste < highBar) continue;
      if (e.ownedCount <= 1 && e.totalPlays >= minPlaysStrong) {
        gaps.push({
          facet,
          value: e.value,
          kind: "strong",
          taste: e.taste,
          ownedCount: e.ownedCount,
        });
      } else if (e.ownedCount === 2 && e.totalPlays >= minPlaysSoft) {
        gaps.push({
          facet,
          value: e.value,
          kind: "soft",
          taste: e.taste,
          ownedCount: e.ownedCount,
        });
      }
    }
  }

  return gaps.sort((a, b) => {
    const kindRank = { strong: 0, soft: 1, saturated: 2 };
    if (kindRank[a.kind] !== kindRank[b.kind]) {
      return kindRank[a.kind] - kindRank[b.kind];
    }
    return b.taste - a.taste;
  });
}

function profileSummary(
  topMechanics: FacetTasteEntry[],
  topDesigners: FacetTasteEntry[],
  gaps: GapEntry[],
  ownedCount: number,
  playSignalCount: number,
): string {
  if (ownedCount === 0) {
    return "Aún no hay juegos owned para construir un perfil de mesa.";
  }
  const mech = topMechanics
    .slice(0, 3)
    .map((m) => m.value)
    .join(", ");
  const des = topDesigners
    .slice(0, 2)
    .map((d) => d.value)
    .join(", ");
  const strongGaps = gaps.filter((g) => g.kind === "strong").slice(0, 2);
  const gapText =
    strongGaps.length > 0
      ? ` Huecos detectados: ${strongGaps.map((g) => g.value).join(", ")}.`
      : "";
  const playNote =
    playSignalCount === 0
      ? " Aún hay pocas partidas; el perfil usa más tu colección que tu historial."
      : "";
  const parts = [
    mech
      ? `Rasgos frecuentes en owned (ponderados por partidas): ${mech}.`
      : null,
    des ? `Diseñadores frecuentes: ${des}.` : null,
  ].filter(Boolean);
  return `${parts.join(" ")}${gapText}${playNote}`.trim();
}

function pickFitFacet(
  candidates: Array<{ value: string; taste: number }>,
  facet: FacetKind,
  facetMeta: Map<string, FacetTasteMeta>,
  minTaste: number,
): { value: string; taste: number; totalPlays: number; ownedCount: number } | null {
  const ranked = [...candidates]
    .filter((c) => c.taste >= minTaste)
    .sort((a, b) => {
      const aLow = isLowSignalFacet(a.value) ? 1 : 0;
      const bLow = isLowSignalFacet(b.value) ? 1 : 0;
      if (aLow !== bLow) return aLow - bLow;
      const aMeta = facetMeta.get(`${facet}:${normalizeToken(a.value)}`);
      const bMeta = facetMeta.get(`${facet}:${normalizeToken(b.value)}`);
      const aPlays = aMeta?.totalPlays ?? 0;
      const bPlays = bMeta?.totalPlays ?? 0;
      const aPlayBacked = aPlays > 0 ? 0 : 1;
      const bPlayBacked = bPlays > 0 ? 0 : 1;
      if (aPlayBacked !== bPlayBacked) return aPlayBacked - bPlayBacked;
      return b.taste - a.taste;
    });
  const best = ranked[0];
  if (!best) return null;
  // Don't headline a low-signal tag unless nothing else qualifies.
  if (isLowSignalFacet(best.value) && ranked.length > 1) {
    const alt = ranked.find((c) => !isLowSignalFacet(c.value));
    if (alt && alt.taste >= minTaste * 0.85) {
      const meta = facetMeta.get(`${facet}:${normalizeToken(alt.value)}`);
      return {
        value: alt.value,
        taste: alt.taste,
        totalPlays: meta?.totalPlays ?? 0,
        ownedCount: meta?.ownedCount ?? 0,
      };
    }
  }
  const meta = facetMeta.get(`${facet}:${normalizeToken(best.value)}`);
  return {
    value: best.value,
    taste: best.taste,
    totalPlays: meta?.totalPlays ?? 0,
    ownedCount: meta?.ownedCount ?? 0,
  };
}

function fitReasonFor(
  kind: "fit_mechanic" | "fit_designer" | "fit_category",
  picked: { value: string; taste: number; totalPlays: number; ownedCount: number },
): Reason | null {
  // Skip noisy modality tags as primary narrative unless heavily play-backed.
  if (isLowSignalFacet(picked.value) && picked.totalPlays < 3) {
    return null;
  }

  const strength: ReasonStrength =
    picked.taste >= 0.65 || picked.totalPlays >= 8 ? "high" : "medium";

  if (kind === "fit_designer") {
    if (picked.totalPlays > 0) {
      return {
        kind,
        strength,
        headline: `Coincide con tu mesa: ${picked.value} aparece en juegos que sí juegas.`,
        detail: `${picked.totalPlays} partida${picked.totalPlays === 1 ? "" : "s"} entre owned de ese diseñador.`,
      };
    }
    return {
      kind,
      strength: "low",
      headline: `Coincide con tu colección: tienes owned de ${picked.value}, con pocas partidas registradas.`,
    };
  }

  if (kind === "fit_mechanic") {
    if (picked.totalPlays > 0) {
      return {
        kind,
        strength,
        headline: `Coincide con tu mesa: ${picked.value} aparece en juegos que sí juegas.`,
        detail: `Señal de partidas en owned con esa mecánica (${picked.totalPlays} en total), no del modo de juego.`,
      };
    }
    return {
      kind,
      strength: "low",
      headline: `Coincide con tu colección: ${picked.value} aparece en owned, aunque con pocas partidas.`,
      detail: "Es un tag de BGG en juegos que posees, no una prueba de que lo juegues así.",
    };
  }

  // category
  if (picked.totalPlays > 0) {
    return {
      kind,
      strength,
      headline: `Afinidad de categoría: ${picked.value} aparece en juegos que sí juegas.`,
      detail: `${picked.ownedCount} owned · ${picked.totalPlays} partida${picked.totalPlays === 1 ? "" : "s"}.`,
    };
  }
  return {
    kind,
    strength: "low",
    headline: `Afinidad de categoría en colección: ${picked.value} aparece en owned con pocas partidas.`,
  };
}

export function buildPlayProfile(db: Db): {
  profile: SmartWishlistProfile;
  gaps: GapEntry[];
  tasteByKey: Map<string, number>;
  facetMeta: Map<string, FacetTasteMeta>;
  ownedTokens: Array<{
    bggId: number;
    name: string;
    personalRating: number | null;
    numPlays: number;
    tokens: Set<string>;
  }>;
  designerSeeds: string[];
  mechanicGapSeeds: string[];
} {
  const owned = loadOwnedRows(db);
  const maps = buildFacetMaps(owned);
  const mechanics = toTasteEntries("mechanic", maps.mechanics);
  const designers = toTasteEntries("designer", maps.designers);
  const categories = toTasteEntries("category", maps.categories);
  const allEntries = [...mechanics, ...designers, ...categories];
  const gaps = computeGaps(allEntries);

  const tasteByKey = new Map<string, number>();
  const facetMeta = new Map<string, FacetTasteMeta>();
  for (const e of allEntries) {
    const key = `${e.facet}:${normalizeToken(e.value)}`;
    tasteByKey.set(key, e.taste);
    facetMeta.set(key, {
      taste: e.taste,
      totalPlays: e.totalPlays,
      ownedCount: e.ownedCount,
    });
  }

  const ownedTokens = owned.map((row) => ({
    bggId: row.bgg_id,
    name: decodeHtmlEntities(row.name),
    personalRating: row.personal_rating,
    numPlays: row.num_plays,
    tokens: similarityTokens({
      designers: parseJsonArray(row.designers_json),
      mechanics: parseJsonArray(row.mechanics_json),
      categories: parseJsonArray(row.categories_json),
    }),
  }));

  const playSignalCount = owned.filter(
    (r) => r.num_plays > 0 || r.last_play_date,
  ).length;

  const strongDesignerGaps = gaps
    .filter((g) => g.facet === "designer" && g.kind !== "saturated")
    .map((g) => g.value);
  const topDesigners = designers.slice(0, 5).map((d) => d.value);
  const designerSeeds = [
    ...new Set([...strongDesignerGaps, ...topDesigners]),
  ].slice(0, 5);

  const mechanicGapSeeds = gaps
    .filter((g) => g.facet === "mechanic" && g.kind === "strong")
    .map((g) => g.value)
    .slice(0, 2);

  const profile: SmartWishlistProfile = {
    topMechanics: mechanics
      .filter((m) => !isLowSignalFacet(m.value) || m.totalPlays >= 3)
      .slice(0, 5),
    topDesigners: designers.slice(0, 5),
    topCategories: categories
      .filter((c) => !isLowSignalFacet(c.value) || c.totalPlays >= 3)
      .slice(0, 5),
    ownedCount: owned.length,
    playSignalCount,
    summary: profileSummary(
      mechanics.filter((m) => !isLowSignalFacet(m.value) || m.totalPlays >= 3),
      designers,
      gaps,
      owned.length,
      playSignalCount,
    ),
  };

  return {
    profile,
    gaps,
    tasteByKey,
    facetMeta,
    ownedTokens,
    designerSeeds,
    mechanicGapSeeds,
  };
}

function noveltyFromJaccard(maxSim: number): {
  scoreUnit: number;
  kind: "fresh_vs_owned" | "crowded_clone" | null;
} {
  // Bell curve peaking at medium-low overlap; clones penalized.
  if (maxSim >= 0.55) return { scoreUnit: 0.15, kind: "crowded_clone" };
  if (maxSim >= 0.4) return { scoreUnit: 0.35, kind: "crowded_clone" };
  if (maxSim >= 0.12 && maxSim < 0.35) return { scoreUnit: 1, kind: "fresh_vs_owned" };
  if (maxSim > 0 && maxSim < 0.12) return { scoreUnit: 0.75, kind: "fresh_vs_owned" };
  if (maxSim >= 0.35 && maxSim < 0.4) return { scoreUnit: 0.55, kind: null };
  return { scoreUnit: 0.4, kind: "fresh_vs_owned" };
}

function priorityPoints(priority: number | null, max: number): number {
  if (priority == null || !Number.isFinite(priority)) return 0;
  // BGG: 1 = must have … 5 = imagining
  const clamped = Math.min(5, Math.max(1, Math.round(priority)));
  const unit = (6 - clamped) / 5;
  return unit * max;
}

function topReasons(reasons: Reason[], limit = 3): Reason[] {
  return [...reasons]
    .sort(
      (a, b) =>
        STRENGTH_RANK[b.strength] - STRENGTH_RANK[a.strength] ||
        a.kind.localeCompare(b.kind),
    )
    .slice(0, limit);
}

export function scoreCandidate(
  candidate: CandidateInput,
  ctx: {
    mode: SmartWishlistMode;
    tasteByKey: Map<string, number>;
    facetMeta: Map<string, FacetTasteMeta>;
    gaps: GapEntry[];
    ownedTokens: Array<{
      bggId: number;
      name: string;
      personalRating: number | null;
      numPlays: number;
      tokens: Set<string>;
    }>;
  },
): SmartWishlistSuggestion {
  const weights = MODE_WEIGHTS[ctx.mode];
  const reasons: Reason[] = [];
  const hasFacets =
    candidate.designers.length +
      candidate.mechanics.length +
      candidate.categories.length >
    0;

  if (!hasFacets) {
    reasons.push({
      kind: "missing_data",
      strength: "high",
      headline: "Faltan datos de BGG/thing para valorar este título.",
      detail: "Sincroniza things o ábrelo en el validador para enriquecer facets.",
    });
  }

  // Fit
  let fitSum = 0;
  const mechCands: Array<{ value: string; taste: number }> = [];
  const desCands: Array<{ value: string; taste: number }> = [];
  const catCands: Array<{ value: string; taste: number }> = [];

  for (const m of candidate.mechanics) {
    const t = ctx.tasteByKey.get(`mechanic:${normalizeToken(m)}`) ?? 0;
    fitSum += t;
    mechCands.push({ value: m, taste: t });
  }
  for (const d of candidate.designers) {
    const t = ctx.tasteByKey.get(`designer:${normalizeToken(d)}`) ?? 0;
    fitSum += t * 1.2;
    desCands.push({ value: d, taste: t });
  }
  for (const c of candidate.categories) {
    const t = ctx.tasteByKey.get(`category:${normalizeToken(c)}`) ?? 0;
    fitSum += t * 0.8;
    catCands.push({ value: c, taste: t });
  }
  const fitUnit = Math.min(1, fitSum / 2.5);
  const fit = fitUnit * weights.fitMax;

  const bestDes = pickFitFacet(desCands, "designer", ctx.facetMeta, 0.35);
  const bestMech = pickFitFacet(mechCands, "mechanic", ctx.facetMeta, 0.4);
  const bestCat = pickFitFacet(catCands, "category", ctx.facetMeta, 0.45);

  if (bestDes) {
    const r = fitReasonFor("fit_designer", bestDes);
    if (r) reasons.push(r);
  }
  if (bestMech) {
    const r = fitReasonFor("fit_mechanic", bestMech);
    if (r) reasons.push(r);
  }
  if (bestCat && reasons.length < 2) {
    const r = fitReasonFor("fit_category", bestCat);
    if (r) reasons.push(r);
  }

  // Gap boost
  const candNorm = {
    mechanics: new Set(candidate.mechanics.map(normalizeToken)),
    designers: new Set(candidate.designers.map(normalizeToken)),
    categories: new Set(candidate.categories.map(normalizeToken)),
  };
  const covered = ctx.gaps.filter((g) => {
    if (g.kind === "saturated") return false;
    const key = normalizeToken(g.value);
    if (g.facet === "mechanic") return candNorm.mechanics.has(key);
    if (g.facet === "designer") return candNorm.designers.has(key);
    return candNorm.categories.has(key);
  });
  const coveredSorted = [...covered].sort((a, b) => {
    const kr = { strong: 0, soft: 1, saturated: 2 };
    return kr[a.kind] - kr[b.kind] || b.taste - a.taste;
  });
  let gapUnit = 0;
  for (const g of coveredSorted.slice(0, 3)) {
    gapUnit += g.kind === "strong" ? 0.45 : 0.25;
    const kind =
      g.facet === "mechanic"
        ? "gap_mechanic"
        : g.facet === "designer"
          ? "gap_designer"
          : "gap_category";
    const facetLabel =
      g.facet === "mechanic"
        ? "mecánica"
        : g.facet === "designer"
          ? "diseñador"
          : "categoría";
    reasons.push({
      kind,
      strength: g.kind === "strong" ? "high" : "medium",
      headline: `Cubre un hueco: te gusta ${g.value} (${facetLabel}) y tienes poco owned con eso.`,
      detail:
        g.ownedCount === 0
          ? "Casi no hay títulos owned con ese rasgo."
          : `Solo ${g.ownedCount} owned con ese rasgo.`,
    });
  }
  const gap = Math.min(1, gapUnit) * weights.gapMax;

  // Novelty vs owned
  const candTokens = similarityTokens(candidate);
  let maxSim = 0;
  let bestLoved: {
    name: string;
    personalRating: number | null;
    numPlays: number;
    sim: number;
  } | null = null;

  if (candTokens.size === 0) {
    // novelty 0
  } else {
    for (const owned of ctx.ownedTokens) {
      if (owned.tokens.size === 0) continue;
      const sim = jaccard(candTokens, owned.tokens);
      if (sim > maxSim) maxSim = sim;
      const loved =
        (owned.personalRating != null && owned.personalRating >= 8) ||
        owned.numPlays >= 5;
      if (loved && (!bestLoved || sim > bestLoved.sim)) {
        bestLoved = {
          name: owned.name,
          personalRating: owned.personalRating,
          numPlays: owned.numPlays,
          sim,
        };
      }
    }
  }

  const noveltyInfo =
    candTokens.size === 0
      ? { scoreUnit: 0, kind: null as "fresh_vs_owned" | "crowded_clone" | null }
      : noveltyFromJaccard(maxSim);
  const novelty = noveltyInfo.scoreUnit * weights.noveltyMax;

  if (bestLoved && bestLoved.sim >= 0.25 && bestLoved.sim < 0.55) {
    const bits = [
      bestLoved.personalRating != null ? `★${bestLoved.personalRating}` : null,
      bestLoved.numPlays > 0 ? `${bestLoved.numPlays} partidas` : null,
    ].filter(Boolean);
    reasons.push({
      kind: "similar_loved",
      strength: "medium",
      headline: `Se parece a ${bestLoved.name}${bits.length ? ` (${bits.join(", ")})` : ""}, que ya te funciona.`,
    });
  }
  if (noveltyInfo.kind === "crowded_clone") {
    reasons.push({
      kind: "crowded_clone",
      strength: "medium",
      headline: "Ojo: es muy parecido a lo que ya tienes; puede sentirse repetido.",
    });
  } else if (noveltyInfo.kind === "fresh_vs_owned" && candTokens.size > 0) {
    reasons.push({
      kind: "fresh_vs_owned",
      strength: maxSim < 0.2 ? "medium" : "low",
      headline: "Aporta variedad: poco solapamiento con tu owned actual.",
    });
  }

  const priority = priorityPoints(candidate.wishlistPriority, weights.priorityMax);
  if (candidate.wishlistPriority != null && candidate.wishlistPriority <= 2) {
    reasons.push({
      kind: "priority",
      strength: "high",
      headline: "Ya lo marcaste con prioridad alta en wishlist.",
    });
  } else if (candidate.wishlistPriority != null && candidate.wishlistPriority === 3) {
    reasons.push({
      kind: "priority",
      strength: "low",
      headline: "Está en tu wishlist con prioridad media.",
    });
  }

  if (candidate.source === "discovery" && candidate.discoverySeed) {
    const hotSeed =
      normalizeToken(candidate.discoverySeed) ===
      normalizeToken("tendencias en BGG");
    reasons.push({
      kind: "discovery_seed",
      strength: "high",
      headline: hotSeed
        ? "Candidato de la hot list de BGG, puntuado contra tu mesa."
        : candidate.discoverySeed.startsWith("hot BGG #")
          ? `Está en la hot list de BGG (${candidate.discoverySeed.replace("hot ", "")}), puntuado contra tu mesa.`
          : `Descubierto por tu interés en ${candidate.discoverySeed} (aún no está en tu colección).`,
    });
  }

  const score = Math.max(
    0,
    Math.min(100, Math.round(fit + gap + novelty + priority)),
  );

  const coveredGaps: CoveredGap[] = covered
    .filter((g) => g.facet === "mechanic" || g.facet === "designer")
    .map((g) => ({ facet: g.facet, value: g.value }));

  const tasteFacets: CoveredGap[] = [];
  for (const m of candidate.mechanics) {
    const t = ctx.tasteByKey.get(`mechanic:${normalizeToken(m)}`) ?? 0;
    if (t >= 0.25) tasteFacets.push({ facet: "mechanic", value: m });
  }
  for (const d of candidate.designers) {
    const t = ctx.tasteByKey.get(`designer:${normalizeToken(d)}`) ?? 0;
    if (t >= 0.25) tasteFacets.push({ facet: "designer", value: d });
  }

  return {
    source: candidate.source,
    bggId: candidate.bggId,
    name: candidate.name,
    thumbnailUrl: candidate.thumbnailUrl,
    yearPublished: candidate.yearPublished,
    subtype: candidate.subtype,
    wishlistPriority: candidate.wishlistPriority,
    score,
    breakdown: {
      fit: Math.round(fit * 10) / 10,
      gap: Math.round(gap * 10) / 10,
      novelty: Math.round(novelty * 10) / 10,
      priority: Math.round(priority * 10) / 10,
    },
    reasons: topReasons(reasons),
    coveredGaps,
    tasteFacets,
    discoverySeed: candidate.discoverySeed,
  };
}

function gapLookupKey(facet: string, value: string): string {
  return `${facet}:${normalizeToken(value)}`;
}

/**
 * UI chips must be actionable against the wishlist: only expose gaps that at
 * least one local suggestion covers. Falls back to high-taste facets that
 * appear on wishlist items when classic gaps do not intersect.
 */
export function selectExposedGaps(
  gaps: GapEntry[],
  suggestions: SmartWishlistSuggestion[],
  tasteByKey: Map<string, number> = new Map(),
): GapEntry[] {
  const coverage = new Map<string, number>();
  for (const s of suggestions) {
    for (const g of s.coveredGaps ?? []) {
      if (g.facet !== "mechanic" && g.facet !== "designer") continue;
      const k = gapLookupKey(g.facet, g.value);
      coverage.set(k, (coverage.get(k) ?? 0) + 1);
    }
  }

  const usable = gaps.filter(
    (g) =>
      g.kind !== "saturated" &&
      (g.facet === "mechanic" || g.facet === "designer") &&
      (coverage.get(gapLookupKey(g.facet, g.value)) ?? 0) > 0,
  );

  const rank = (list: GapEntry[]) =>
    [...list].sort((a, b) => {
      const ca = coverage.get(gapLookupKey(a.facet, a.value)) ?? 0;
      const cb = coverage.get(gapLookupKey(b.facet, b.value)) ?? 0;
      if (cb !== ca) return cb - ca;
      const kindRank = { strong: 0, soft: 1, saturated: 2 };
      if (kindRank[a.kind] !== kindRank[b.kind]) {
        return kindRank[a.kind] - kindRank[b.kind];
      }
      return b.taste - a.taste || a.value.localeCompare(b.value);
    });

  let mechs = rank(usable.filter((g) => g.facet === "mechanic")).slice(0, 8);
  let designers = rank(usable.filter((g) => g.facet === "designer")).slice(
    0,
    8,
  );

  // Fallback: high-taste facets that actually appear on wishlist cards.
  if (mechs.length + designers.length === 0 && suggestions.length > 0) {
    const facetHits = new Map<
      string,
      { facet: FacetKind; value: string; count: number; taste: number }
    >();
    for (const s of suggestions) {
      for (const g of s.tasteFacets ?? []) {
        if (g.facet !== "mechanic" && g.facet !== "designer") continue;
        const k = gapLookupKey(g.facet, g.value);
        const taste = tasteByKey.get(k) ?? 0;
        if (taste < 0.25) continue;
        const cur = facetHits.get(k);
        if (cur) cur.count += 1;
        else {
          facetHits.set(k, {
            facet: g.facet,
            value: g.value,
            count: 1,
            taste,
          });
        }
      }
    }

    const synthesized = [...facetHits.values()]
      .sort((a, b) => b.count - a.count || b.taste - a.taste)
      .map(
        (f): GapEntry => ({
          facet: f.facet,
          value: f.value,
          kind: "soft",
          taste: f.taste,
          ownedCount: 0,
        }),
      );
    mechs = synthesized.filter((g) => g.facet === "mechanic").slice(0, 8);
    designers = synthesized.filter((g) => g.facet === "designer").slice(0, 8);
  }

  return [...mechs, ...designers].sort((a, b) => {
    if (a.facet !== b.facet) return a.facet === "mechanic" ? -1 : 1;
    return b.taste - a.taste || a.value.localeCompare(b.value);
  });
}

function sortSuggestions(
  items: SmartWishlistSuggestion[],
): SmartWishlistSuggestion[] {
  return [...items].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    const ap = a.wishlistPriority ?? 99;
    const bp = b.wishlistPriority ?? 99;
    if (ap !== bp) return ap - bp;
    return a.name.localeCompare(b.name);
  });
}

/**
 * Local smart-wishlist (profile + gaps + ranked wishlist/want-to-play).
 * Discovery list is empty; status says not requested.
 */
export function querySmartWishlist(
  db: Db,
  params: SmartWishlistParams = {},
): SmartWishlistResult {
  const mode = params.mode ?? "balance";
  const includeWantToPlay = params.includeWantToPlay !== false;
  const includeExpansions = params.includeExpansions === true;
  const localLimit = params.localLimit ?? 25;

  const built = buildPlayProfile(db);
  const rows = loadLocalCandidates(db, { includeWantToPlay, includeExpansions });

  const scored = sortSuggestions(
    rows.map((row) =>
      scoreCandidate(
        {
          source: "local",
          bggId: row.bgg_id,
          name: decodeHtmlEntities(row.name),
          thumbnailUrl: row.thumbnail_url,
          yearPublished: row.year_published,
          subtype: row.subtype,
          wishlistPriority: row.wishlist_priority,
          designers: parseJsonArray(row.designers_json),
          mechanics: parseJsonArray(row.mechanics_json),
          categories: parseJsonArray(row.categories_json),
        },
        {
          mode,
          tasteByKey: built.tasteByKey,
          facetMeta: built.facetMeta,
          gaps: built.gaps,
          ownedTokens: built.ownedTokens,
        },
      ),
    ),
  ).slice(0, localLimit);

  return {
    profile: built.profile,
    gaps: selectExposedGaps(built.gaps, scored, built.tasteByKey),
    localSuggestions: scored,
    discoverySuggestions: [],
    discoveryStatus: {
      available: false,
      message: "Discovery desactivado en esta consulta.",
    },
  };
}

export interface DiscoveryFetchDeps {
  searchDesigners: (
    query: string,
    limit: number,
  ) => Promise<Array<{ bggId: number; name: string }>>;
  fetchDesignerGameIds: (
    designerId: number,
    limit: number,
  ) => Promise<number[]>;
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

/**
 * Score discovery candidates (already fetched things) and merge into a result.
 */
export function attachDiscoverySuggestions(
  db: Db,
  base: SmartWishlistResult,
  candidates: CandidateInput[],
  params: SmartWishlistParams = {},
): SmartWishlistResult {
  const mode = params.mode ?? "balance";
  const discoveryLimit = params.discoveryLimit ?? 5;
  const built = buildPlayProfile(db);

  const scored = candidates.map((c) =>
    scoreCandidate(c, {
      mode,
      tasteByKey: built.tasteByKey,
      facetMeta: built.facetMeta,
      gaps: built.gaps,
      ownedTokens: built.ownedTokens,
    }),
  );

  // Soft floor: discovery has no wishlist_priority boost, so avoid a high bar.
  const filtered = sortSuggestions(scored).filter((s) => s.score >= 8);
  const picked =
    filtered.length > 0
      ? filtered.slice(0, discoveryLimit)
      : sortSuggestions(scored).slice(0, discoveryLimit);

  return {
    ...base,
    discoverySuggestions: picked,
    discoveryStatus: base.discoveryStatus.available
      ? base.discoveryStatus
      : { available: true },
  };
}

/**
 * Hot-list discovery (fast, reliable). Designer person pages rarely expose
 * linked games in XML API2, so we avoid that multi-request path.
 */
export async function collectDiscoveryCandidates(
  db: Db,
  deps: DiscoveryFetchDeps,
  options: {
    includeExpansions?: boolean;
    maxThings?: number;
    hotLimit?: number;
  } = {},
): Promise<{
  candidates: CandidateInput[];
  error?: string;
  stats?: {
    designerSeeds: number;
    designerGameIds: number;
    hotGameIds: number;
    fetched: number;
  };
}> {
  const includeExpansions = options.includeExpansions === true;
  const maxThings = options.maxThings ?? 12;
  const hotLimit = options.hotLimit ?? 20;

  const { profile } = buildPlayProfile(db);
  const excluded = loadExcludedBggIds(db);

  if (profile.ownedCount === 0) {
    return {
      candidates: [],
      error: "No hay perfil owned para puntuar descubrimientos.",
      stats: {
        designerSeeds: 0,
        designerGameIds: 0,
        hotGameIds: 0,
        fetched: 0,
      },
    };
  }

  let hotGameIds = 0;

  try {
    const hotIds = await deps.fetchHotGameIds(hotLimit);
    const idToSeed = new Map<number, string>();

    for (const id of hotIds) {
      if (excluded.has(id)) continue;
      idToSeed.set(id, "tendencias en BGG");
      hotGameIds += 1;
      if (idToSeed.size >= maxThings) break;
    }

    const ids = [...idToSeed.keys()];
    if (ids.length === 0) {
      return {
        candidates: [],
        error:
          "La hot list de BGG no trajo juegos nuevos respecto a tu colección.",
        stats: {
          designerSeeds: 0,
          designerGameIds: 0,
          hotGameIds,
          fetched: 0,
        },
      };
    }

    const things = await deps.fetchThings(ids);
    const candidates: CandidateInput[] = [];

    for (const game of things) {
      if (excluded.has(game.bggId)) continue;
      if (
        !includeExpansions &&
        (game.thingType === "boardgameexpansion" ||
          game.thingType === "boardgameaccessory")
      ) {
        continue;
      }

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
        discoverySeed: idToSeed.get(game.bggId) ?? "tendencias en BGG",
      });
    }

    return {
      candidates,
      stats: {
        designerSeeds: 0,
        designerGameIds: 0,
        hotGameIds,
        fetched: things.length,
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      candidates: [],
      error: message,
      stats: {
        designerSeeds: 0,
        designerGameIds: 0,
        hotGameIds,
        fetched: 0,
      },
    };
  }
}

export function getExcludedCollectionIds(db: Db): Set<number> {
  return loadExcludedBggIds(db);
}
