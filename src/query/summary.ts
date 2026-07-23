import type { Db } from "../storage/database.js";
import { queryPlayStats } from "./plays.js";
import { decodeHtmlEntities } from "../utils/html-entities.js";
import { SQL_VIRTUAL_LOCATION } from "../utils/play-location.js";

export interface TopGameSummary {
  bggId: number;
  name: string;
  thumbnailUrl: string | null;
  value: number;
}

export interface CollectionSummary {
  total: number;
  owned: number;
  wishlist: number;
  preordered: number;
  wantToPlay: number;
  avgPersonalRating: number | null;
  topByPlays: TopGameSummary[];
}

export interface PlaysSummary {
  totalPlays: number;
  uniqueGames: number;
  uniqueBaseGames: number;
  uniqueExpansions: number;
  hIndex: number;
  totalMinutes: number;
  totalHours: number;
  topPlayed: TopGameSummary[];
  topPlayedPhysical: TopGameSummary[];
  topPlayedVirtual: TopGameSummary[];
}

export interface DashboardSummary {
  collection: CollectionSummary;
  plays: PlaysSummary;
}

export function queryCollectionSummary(db: Db): CollectionSummary {
  const counts = db
    .prepare(
      `SELECT
         COUNT(*) AS total,
         SUM(own) AS owned,
         SUM(wishlist) AS wishlist,
         SUM(preordered) AS preordered,
         SUM(want_to_play) AS want_to_play,
         AVG(CASE WHEN personal_rating IS NOT NULL THEN personal_rating END) AS avg_rating
       FROM collection_entries`,
    )
    .get() as {
    total: number;
    owned: number;
    wishlist: number;
    preordered: number;
    want_to_play: number;
    avg_rating: number | null;
  };

  const topRows = db
    .prepare(
      `SELECT
         ce.bgg_id,
         COALESCE(g.name, ce.name) AS name,
         COALESCE(g.thumbnail_url, ce.thumbnail_url) AS thumbnail_url,
         ce.num_plays AS value
       FROM collection_entries ce
       LEFT JOIN games g ON g.bgg_id = ce.bgg_id
       WHERE ce.num_plays > 0
       ORDER BY ce.num_plays DESC, name COLLATE NOCASE ASC
       LIMIT 5`,
    )
    .all() as Array<{
    bgg_id: number;
    name: string;
    thumbnail_url: string | null;
    value: number;
  }>;

  return {
    total: counts.total,
    owned: counts.owned ?? 0,
    wishlist: counts.wishlist ?? 0,
    preordered: counts.preordered ?? 0,
    wantToPlay: counts.want_to_play ?? 0,
    avgPersonalRating: counts.avg_rating,
    topByPlays: topRows.map((r) => ({
      bggId: r.bgg_id,
      name: decodeHtmlEntities(r.name),
      thumbnailUrl: r.thumbnail_url,
      value: r.value,
    })),
  };
}

export function queryTopPlayedGames(
  db: Db,
  limit = 5,
  mode: "all" | "physical" | "virtual" = "all",
): TopGameSummary[] {
  const locationFilter =
    mode === "virtual"
      ? `AND ${SQL_VIRTUAL_LOCATION}`
      : mode === "physical"
        ? `AND NOT ${SQL_VIRTUAL_LOCATION}`
        : "";

  const rows = db
    .prepare(
      `SELECT
         p.bgg_id,
         COALESCE(g.name, p.game_name) AS name,
         g.thumbnail_url,
         SUM(p.quantity) AS value
       FROM plays p
       LEFT JOIN games g ON g.bgg_id = p.bgg_id
       WHERE 1=1
         ${locationFilter}
       GROUP BY p.bgg_id
       ORDER BY value DESC, name COLLATE NOCASE ASC
       LIMIT ?`,
    )
    .all(limit) as Array<{
    bgg_id: number;
    name: string;
    thumbnail_url: string | null;
    value: number;
  }>;

  return rows.map((r) => ({
    bggId: r.bgg_id,
    name: decodeHtmlEntities(r.name),
    thumbnailUrl: r.thumbnail_url,
    value: Number(r.value),
  }));
}

export function queryDashboardSummary(db: Db): DashboardSummary {
  const playStats = queryPlayStats(db);
  return {
    collection: queryCollectionSummary(db),
    plays: {
      totalPlays: playStats.totalPlays,
      uniqueGames: playStats.uniqueGames,
      uniqueBaseGames: playStats.uniqueBaseGames,
      uniqueExpansions: playStats.uniqueExpansions,
      hIndex: playStats.hIndex,
      totalMinutes: playStats.totalMinutes,
      totalHours: Math.round((playStats.totalMinutes / 60) * 10) / 10,
      topPlayed: queryTopPlayedGames(db),
      topPlayedPhysical: queryTopPlayedGames(db, 5, "physical"),
      topPlayedVirtual: queryTopPlayedGames(db, 5, "virtual"),
    },
  };
}
