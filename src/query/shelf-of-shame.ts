import type { GameSubtype } from "../domain/types.js";
import type { Db } from "../storage/database.js";
import { decodeHtmlEntities } from "../utils/html-entities.js";

export interface ShelfOfShameParams {
  includeExpansions?: boolean;
  limit?: number;
}

export interface ShelfOfShameItem {
  bggId: number;
  name: string;
  subtype: GameSubtype;
  yearPublished: number | null;
  thumbnailUrl: string | null;
  imageUrl: string | null;
  lastModified: string | null;
  numPlays: number;
  personalRating: number | null;
  weight: number | null;
}

/**
 * Owned games with zero plays (collection count and no local play rows).
 * Oldest first by last_modified, then year, then name.
 */
export function queryShelfOfShame(
  db: Db,
  params: ShelfOfShameParams = {},
): ShelfOfShameItem[] {
  const conditions = [
    "ce.own = 1",
    "ce.num_plays = 0",
    "NOT EXISTS (SELECT 1 FROM plays p WHERE p.bgg_id = ce.bgg_id)",
  ];
  const values: unknown[] = [];

  if (params.includeExpansions !== true) {
    conditions.push("ce.subtype != 'boardgameexpansion'");
  }

  const limitClause = params.limit ? "LIMIT ?" : "";
  if (params.limit) values.push(params.limit);

  const rows = db
    .prepare(
      `SELECT
         ce.bgg_id,
         COALESCE(g.name, ce.name) AS name,
         ce.subtype,
         ce.year_published,
         COALESCE(g.thumbnail_url, ce.thumbnail_url) AS thumbnail_url,
         COALESCE(g.image_url, ce.image_url) AS image_url,
         ce.last_modified,
         ce.num_plays,
         ce.personal_rating,
         g.weight
       FROM collection_entries ce
       LEFT JOIN games g ON g.bgg_id = ce.bgg_id
       WHERE ${conditions.join(" AND ")}
       ORDER BY
         CASE WHEN ce.last_modified IS NULL OR ce.last_modified = '' THEN 1 ELSE 0 END,
         ce.last_modified ASC,
         CASE WHEN ce.year_published IS NULL THEN 1 ELSE 0 END,
         ce.year_published ASC,
         COALESCE(g.name, ce.name) COLLATE NOCASE ASC
       ${limitClause}`,
    )
    .all(...(values as Array<string | number>)) as Array<{
    bgg_id: number;
    name: string;
    subtype: string;
    year_published: number | null;
    thumbnail_url: string | null;
    image_url: string | null;
    last_modified: string | null;
    num_plays: number;
    personal_rating: number | null;
    weight: number | null;
  }>;

  return rows.map((row) => ({
    bggId: row.bgg_id,
    name: decodeHtmlEntities(row.name),
    subtype: row.subtype as GameSubtype,
    yearPublished: row.year_published,
    thumbnailUrl: row.thumbnail_url,
    imageUrl: row.image_url,
    lastModified: row.last_modified,
    numPlays: row.num_plays,
    personalRating: row.personal_rating,
    weight: row.weight,
  }));
}
