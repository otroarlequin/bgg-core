import type { BrowseRankItem } from "../bgg/browse-ranks.js";
import type { Db } from "../storage/database.js";
import { getStoredBggUsername } from "../storage/repos/app-settings.js";
import {
  listCollectionStatusEvents,
  type CollectionStatusEvent,
} from "../storage/repos/collection-status-events.js";
import { decodeHtmlEntities } from "../utils/html-entities.js";
import { queryPlayCalendar } from "./play-calendar.js";
import { queryPlayStats } from "./plays.js";
import { queryShelfOfShame } from "./shelf-of-shame.js";

export interface InsightsParams {
  year?: number;
  ownerUsername?: string | null;
}

export interface InsightsYearBucket {
  year: number;
  plays: number;
  uniqueGames: number;
  hours: number;
  debuts: number;
}

export interface InsightsGameRef {
  bggId: number;
  name: string;
  thumbnailUrl: string | null;
}

export interface InsightsDebut extends InsightsGameRef {
  firstPlay: string;
  playCount: number;
}

export interface InsightsCollectionTransition extends InsightsGameRef {
  ownedAt: string;
  wishlistAt: string | null;
  daysWishlistToOwned: number | null;
  firstPlay: string | null;
  daysOwnedToFirstPlay: number | null;
}

export interface InsightsCompanion {
  key: string;
  displayName: string;
  username: string;
  playsTogether: number;
  uniqueGames: number;
  wins: number;
  winRate: number | null;
  avgWeight: number | null;
}

export interface InsightsPlayerCountBucket {
  id: "1" | "2" | "3" | "4" | "5" | "6+";
  plays: number;
}

export interface InsightsWeightBucket {
  id: "light" | "medium" | "heavy";
  label: string;
  plays: number;
}

export interface InsightsCuriosity {
  mostPlayed: (InsightsGameRef & { plays: number }) | null;
  soloPlays: number;
  multiPlays: number;
  topMechanic: { name: string; plays: number } | null;
  topCategory: { name: string; plays: number } | null;
  currentStreak: number;
}

export interface InsightsTop100Item extends BrowseRankItem {
  owned: boolean;
}

export interface InsightsTop100 {
  owned: number;
  items: InsightsTop100Item[];
  fetchedAt: string | null;
  error: string | null;
}

export interface InsightsResult {
  years: number[];
  selectedYear: number | null;
  yearly: InsightsYearBucket[];
  selected: {
    plays: number;
    uniqueGames: number;
    hours: number;
    hIndex: number;
    debuts: InsightsDebut[];
    unplayedOwned: { count: number; sample: InsightsGameRef[] };
    ownedThisPeriod: InsightsCollectionTransition[];
    trackingSince: string | null;
  };
  players: {
    companions: InsightsCompanion[];
    playerCounts: InsightsPlayerCountBucket[];
    avgWeight: number | null;
    weightBuckets: InsightsWeightBucket[];
  };
  curiosities: InsightsCuriosity;
  top100: InsightsTop100;
  isProfile: boolean;
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

function yearOf(isoDate: string): number | null {
  const year = Number(isoDate.slice(0, 4));
  return Number.isFinite(year) && year >= 1970 ? year : null;
}

function daysBetween(fromIso: string, toIso: string): number {
  const a = Date.parse(`${fromIso.slice(0, 10)}T12:00:00Z`);
  const b = Date.parse(`${toIso.slice(0, 10)}T12:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return 0;
  return Math.round((b - a) / 86_400_000);
}

function inSelectedYear(iso: string, year: number | null): boolean {
  if (year == null) return true;
  return yearOf(iso) === year;
}

function playDateRange(year: number | null): { from?: string; to?: string } {
  if (year == null) return {};
  return { from: `${year}-01-01`, to: `${year}-12-31` };
}

function playerCountId(n: number): InsightsPlayerCountBucket["id"] {
  if (n <= 1) return "1";
  if (n === 2) return "2";
  if (n === 3) return "3";
  if (n === 4) return "4";
  if (n === 5) return "5";
  return "6+";
}

function weightBucketId(weight: number): InsightsWeightBucket["id"] {
  if (weight < 2) return "light";
  if (weight <= 3.2) return "medium";
  return "heavy";
}

function isOwnerPlayer(
  ownerUsername: string | null | undefined,
  username: string,
  name: string,
): boolean {
  const owner = ownerUsername?.trim().toLowerCase();
  if (!owner) return false;
  return username.trim().toLowerCase() === owner || name.trim().toLowerCase() === owner;
}

function companionKey(username: string, name: string): string {
  const user = username.trim().toLowerCase();
  if (user) return `u:${user}`;
  return `n:${name.trim().toLowerCase()}`;
}

function companionLabel(username: string, name: string): string {
  const trimmedName = name.trim();
  if (trimmedName) return trimmedName;
  return username.trim() || "Jugador";
}

function emptyPlayerCounts(): InsightsPlayerCountBucket[] {
  return (
    ["1", "2", "3", "4", "5", "6+"] as InsightsPlayerCountBucket["id"][]
  ).map((id) => ({ id, plays: 0 }));
}

function emptyWeightBuckets(): InsightsWeightBucket[] {
  return [
    { id: "light", label: "Ligero (< 2.0)", plays: 0 },
    { id: "medium", label: "Medio (2.0–3.2)", plays: 0 },
    { id: "heavy", label: "Pesado (> 3.2)", plays: 0 },
  ];
}

function topFacet(
  counts: Map<string, number>,
): { name: string; plays: number } | null {
  let best: { name: string; plays: number } | null = null;
  for (const [name, plays] of counts) {
    if (!best || plays > best.plays) best = { name, plays };
  }
  return best;
}

function computeOwnedTransitions(
  events: CollectionStatusEvent[],
  firstPlayById: Map<number, string>,
  namesById: Map<number, { name: string; thumbnailUrl: string | null }>,
  year: number | null,
): InsightsCollectionTransition[] {
  const byGame = new Map<number, CollectionStatusEvent[]>();
  for (const event of events) {
    const list = byGame.get(event.bggId) ?? [];
    list.push(event);
    byGame.set(event.bggId, list);
  }

  const out: InsightsCollectionTransition[] = [];
  for (const [bggId, list] of byGame) {
    let prev: CollectionStatusEvent | null = null;
    let trackedWishlistAt: string | null = null;

    for (const event of list) {
      if (event.source === "sync" && !prev) {
        if (event.wishlist) trackedWishlistAt = event.observedAt;
        if (event.own && inSelectedYear(event.observedAt, year)) {
          const firstPlay = firstPlayById.get(bggId) ?? null;
          const daysOwnedToFirstPlay =
            firstPlay && firstPlay >= event.observedAt.slice(0, 10)
              ? daysBetween(event.observedAt, firstPlay)
              : null;
          const meta = namesById.get(bggId);
          out.push({
            bggId,
            name: meta?.name ?? `Juego #${bggId}`,
            thumbnailUrl: meta?.thumbnailUrl ?? null,
            ownedAt: event.observedAt,
            wishlistAt: event.wishlist ? event.observedAt : null,
            daysWishlistToOwned: null,
            firstPlay,
            daysOwnedToFirstPlay,
          });
        }
      } else if (event.source === "sync" && prev) {
        if (!prev.wishlist && event.wishlist) {
          trackedWishlistAt = event.observedAt;
        }
        if (!prev.own && event.own) {
          if (prev.wishlist && prev.source === "sync" && !trackedWishlistAt) {
            trackedWishlistAt = prev.observedAt;
          }
          if (inSelectedYear(event.observedAt, year)) {
            const firstPlay = firstPlayById.get(bggId) ?? null;
            const daysOwnedToFirstPlay =
              firstPlay && firstPlay >= event.observedAt.slice(0, 10)
                ? daysBetween(event.observedAt, firstPlay)
                : null;
            const daysWishlistToOwned =
              trackedWishlistAt != null
                ? daysBetween(trackedWishlistAt, event.observedAt)
                : null;
            const meta = namesById.get(bggId);
            out.push({
              bggId,
              name: meta?.name ?? `Juego #${bggId}`,
              thumbnailUrl: meta?.thumbnailUrl ?? null,
              ownedAt: event.observedAt,
              wishlistAt: trackedWishlistAt,
              daysWishlistToOwned,
              firstPlay,
              daysOwnedToFirstPlay,
            });
          }
        }
      }
      prev = event;
    }
  }

  return out.sort((a, b) => b.ownedAt.localeCompare(a.ownedAt));
}

export function buildTop100Section(
  db: Db,
  ranks: BrowseRankItem[],
  fetchedAt: string | null,
  error: string | null = null,
): InsightsTop100 {
  const ownedIds = new Set(
    (
      db
        .prepare("SELECT DISTINCT bgg_id FROM collection_entries WHERE own = 1")
        .all() as Array<{ bgg_id: number }>
    ).map((row) => row.bgg_id),
  );

  const thumbs = db
    .prepare(
      `SELECT ce.bgg_id, COALESCE(g.thumbnail_url, ce.thumbnail_url) AS thumbnail_url
       FROM collection_entries ce
       LEFT JOIN games g ON g.bgg_id = ce.bgg_id`,
    )
    .all() as Array<{ bgg_id: number; thumbnail_url: string | null }>;
  const thumbById = new Map(
    thumbs.map((row) => [row.bgg_id, row.thumbnail_url]),
  );

  const items: InsightsTop100Item[] = ranks
    .filter((item) => item.rank >= 1 && item.rank <= 100)
    .sort((a, b) => a.rank - b.rank)
    .map((item) => ({
      ...item,
      owned: ownedIds.has(item.bggId),
      thumbnailUrl: thumbById.get(item.bggId) ?? item.thumbnailUrl,
    }));

  return {
    owned: items.filter((item) => item.owned).length,
    items,
    fetchedAt,
    error,
  };
}

export function queryInsights(
  db: Db,
  params: InsightsParams = {},
): Omit<InsightsResult, "top100" | "isProfile"> {
  const selectedYear =
    params.year != null && Number.isFinite(params.year) ? params.year : null;
  const ownerUsername =
    params.ownerUsername !== undefined
      ? params.ownerUsername
      : getStoredBggUsername(db);

  const playRows = db
    .prepare(
      `SELECT
         p.play_id,
         p.bgg_id,
         p.date,
         p.quantity,
         p.length,
         COALESCE(g.name, p.game_name) AS name,
         COALESCE(g.thumbnail_url, ce.thumbnail_url) AS thumbnail_url,
         g.weight,
         g.mechanics,
         g.categories
       FROM plays p
       LEFT JOIN games g ON g.bgg_id = p.bgg_id
       LEFT JOIN collection_entries ce ON ce.bgg_id = p.bgg_id
       ORDER BY p.date ASC, p.play_id ASC`,
    )
    .all() as Array<{
    play_id: number;
    bgg_id: number;
    date: string;
    quantity: number;
    length: number;
    name: string;
    thumbnail_url: string | null;
    weight: number | null;
    mechanics: string | null;
    categories: string | null;
  }>;

  const playerRows = db
    .prepare(
      `SELECT play_id, username, name, win FROM play_players`,
    )
    .all() as Array<{
    play_id: number;
    username: string;
    name: string;
    win: number;
  }>;

  const playersByPlay = new Map<number, typeof playerRows>();
  for (const row of playerRows) {
    const list = playersByPlay.get(row.play_id) ?? [];
    list.push(row);
    playersByPlay.set(row.play_id, list);
  }

  const firstPlayById = new Map<number, string>();
  const playCountById = new Map<number, number>();
  for (const row of playRows) {
    if (!firstPlayById.has(row.bgg_id)) firstPlayById.set(row.bgg_id, row.date);
    playCountById.set(
      row.bgg_id,
      (playCountById.get(row.bgg_id) ?? 0) + row.quantity,
    );
  }

  const yearMap = new Map<number, InsightsYearBucket>();
  for (const row of playRows) {
    const year = yearOf(row.date);
    if (year == null) continue;
    const bucket = yearMap.get(year) ?? {
      year,
      plays: 0,
      uniqueGames: 0,
      hours: 0,
      debuts: 0,
    };
    bucket.plays += row.quantity;
    bucket.hours += (row.length * row.quantity) / 60;
    yearMap.set(year, bucket);
  }

  const uniqueByYear = new Map<number, Set<number>>();
  for (const row of playRows) {
    const year = yearOf(row.date);
    if (year == null) continue;
    const set = uniqueByYear.get(year) ?? new Set<number>();
    set.add(row.bgg_id);
    uniqueByYear.set(year, set);
  }
  for (const [year, set] of uniqueByYear) {
    const bucket = yearMap.get(year);
    if (bucket) bucket.uniqueGames = set.size;
  }

  for (const firstPlay of firstPlayById.values()) {
    const year = yearOf(firstPlay);
    if (year == null) continue;
    const bucket = yearMap.get(year);
    if (bucket) bucket.debuts += 1;
  }

  const yearly = [...yearMap.values()].sort((a, b) => a.year - b.year);
  const years = yearly.map((item) => item.year);

  const range = playDateRange(selectedYear);
  const stats = queryPlayStats(db, range);
  const selectedPlayRows = playRows.filter((row) =>
    inSelectedYear(row.date, selectedYear),
  );

  const debuts: InsightsDebut[] = [];
  for (const [bggId, firstPlay] of firstPlayById) {
    if (!inSelectedYear(firstPlay, selectedYear)) continue;
    const row = playRows.find((item) => item.bgg_id === bggId);
    debuts.push({
      bggId,
      name: decodeHtmlEntities(row?.name ?? `Juego #${bggId}`),
      thumbnailUrl: row?.thumbnail_url ?? null,
      firstPlay,
      playCount: playCountById.get(bggId) ?? 0,
    });
  }
  debuts.sort((a, b) => b.firstPlay.localeCompare(a.firstPlay));

  const shame = queryShelfOfShame(db, { includeExpansions: false });
  const unplayedOwned = {
    count: shame.length,
    sample: shame.slice(0, 8).map((item) => ({
      bggId: item.bggId,
      name: item.name,
      thumbnailUrl: item.thumbnailUrl,
    })),
  };

  const nameRows = db
    .prepare(
      `SELECT
         ce.bgg_id,
         COALESCE(g.name, ce.name) AS name,
         COALESCE(g.thumbnail_url, ce.thumbnail_url) AS thumbnail_url
       FROM collection_entries ce
       LEFT JOIN games g ON g.bgg_id = ce.bgg_id`,
    )
    .all() as Array<{
    bgg_id: number;
    name: string;
    thumbnail_url: string | null;
  }>;
  const namesById = new Map(
    nameRows.map((row) => [
      row.bgg_id,
      { name: decodeHtmlEntities(row.name), thumbnailUrl: row.thumbnail_url },
    ]),
  );
  for (const row of playRows) {
    if (!namesById.has(row.bgg_id)) {
      namesById.set(row.bgg_id, {
        name: decodeHtmlEntities(row.name),
        thumbnailUrl: row.thumbnail_url,
      });
    }
  }

  const events = listCollectionStatusEvents(db);
  const trackingSince = events[0]?.observedAt ?? null;
  const ownedThisPeriod = computeOwnedTransitions(
    events,
    firstPlayById,
    namesById,
    selectedYear,
  );

  const companions = new Map<
    string,
    {
      displayName: string;
      username: string;
      playsTogether: number;
      games: Set<number>;
      wins: number;
      weightSum: number;
      weightPlays: number;
    }
  >();

  const playerCounts = emptyPlayerCounts();
  const weightBuckets = emptyWeightBuckets();
  let weightSum = 0;
  let weightPlays = 0;
  let soloPlays = 0;
  let multiPlays = 0;
  const mechanicCounts = new Map<string, number>();
  const categoryCounts = new Map<string, number>();
  const selectedPlayCountById = new Map<number, number>();

  for (const row of selectedPlayRows) {
    const players = playersByPlay.get(row.play_id) ?? [];
    const countId = playerCountId(players.length || 1);
    const bucket = playerCounts.find((item) => item.id === countId);
    if (bucket) bucket.plays += row.quantity;
    if (players.length <= 1) soloPlays += row.quantity;
    else multiPlays += row.quantity;

    selectedPlayCountById.set(
      row.bgg_id,
      (selectedPlayCountById.get(row.bgg_id) ?? 0) + row.quantity,
    );

    if (row.weight != null) {
      const weight = row.weight;
      weightSum += weight * row.quantity;
      weightPlays += row.quantity;
      const wb = weightBuckets.find((item) => item.id === weightBucketId(weight));
      if (wb) wb.plays += row.quantity;
    }

    for (const mechanic of parseJsonArray(row.mechanics)) {
      mechanicCounts.set(
        mechanic,
        (mechanicCounts.get(mechanic) ?? 0) + row.quantity,
      );
    }
    for (const category of parseJsonArray(row.categories)) {
      categoryCounts.set(
        category,
        (categoryCounts.get(category) ?? 0) + row.quantity,
      );
    }

    for (const player of players) {
      if (isOwnerPlayer(ownerUsername, player.username, player.name)) continue;
      const label = companionLabel(player.username, player.name);
      if (!player.username.trim() && !player.name.trim()) continue;
      const key = companionKey(player.username, player.name);
      const current = companions.get(key) ?? {
        displayName: label,
        username: player.username.trim(),
        playsTogether: 0,
        games: new Set<number>(),
        wins: 0,
        weightSum: 0,
        weightPlays: 0,
      };
      current.playsTogether += row.quantity;
      current.games.add(row.bgg_id);
      if (player.win === 1) current.wins += row.quantity;
      if (row.weight != null) {
        current.weightSum += row.weight * row.quantity;
        current.weightPlays += row.quantity;
      }
      companions.set(key, current);
    }
  }

  const companionList: InsightsCompanion[] = [...companions.entries()]
    .map(([key, value]) => ({
      key,
      displayName: value.displayName,
      username: value.username,
      playsTogether: value.playsTogether,
      uniqueGames: value.games.size,
      wins: value.wins,
      winRate:
        value.playsTogether > 0 ? value.wins / value.playsTogether : null,
      avgWeight:
        value.weightPlays > 0 ? value.weightSum / value.weightPlays : null,
    }))
    .sort((a, b) => {
      if (b.playsTogether !== a.playsTogether) {
        return b.playsTogether - a.playsTogether;
      }
      return a.displayName.localeCompare(b.displayName, "es", {
        sensitivity: "base",
      });
    })
    .slice(0, 15);

  let mostPlayed: InsightsCuriosity["mostPlayed"] = null;
  for (const [bggId, plays] of selectedPlayCountById) {
    if (!mostPlayed || plays > mostPlayed.plays) {
      const meta = namesById.get(bggId);
      mostPlayed = {
        bggId,
        name: meta?.name ?? `Juego #${bggId}`,
        thumbnailUrl: meta?.thumbnailUrl ?? null,
        plays,
      };
    }
  }

  const calendar = queryPlayCalendar(db);
  const hIndex = stats.hIndex;

  return {
    years,
    selectedYear,
    yearly,
    selected: {
      plays: stats.totalPlays,
      uniqueGames: stats.uniqueGames,
      hours: Math.round((stats.totalMinutes / 60) * 10) / 10,
      hIndex,
      debuts: debuts.slice(0, 20),
      unplayedOwned,
      ownedThisPeriod,
      trackingSince,
    },
    players: {
      companions: companionList,
      playerCounts,
      avgWeight: weightPlays > 0 ? Math.round((weightSum / weightPlays) * 100) / 100 : null,
      weightBuckets,
    },
    curiosities: {
      mostPlayed,
      soloPlays,
      multiPlays,
      topMechanic: topFacet(mechanicCounts),
      topCategory: topFacet(categoryCounts),
      currentStreak: calendar.currentStreak,
    },
  };
}
