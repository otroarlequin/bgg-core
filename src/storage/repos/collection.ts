import type { CollectionEntry } from "../../domain/types.js";
import type { Db } from "../database.js";
import { runTransaction } from "../database.js";
import { sqlNull } from "../sql-utils.js";

export function upsertCollectionEntry(db: Db, entry: CollectionEntry): void {
  db.prepare(
    `INSERT INTO collection_entries (
      coll_id, bgg_id, subtype, name, year_published, image_url, thumbnail_url,
      own, prev_owned, for_trade, want, want_to_play, want_to_buy, wishlist,
      preordered, has_parts, want_parts, personal_rating, comment,
      wishlist_priority, num_plays, bgg_rating, bgg_rank, last_modified, synced_at
    ) VALUES (
      @collId, @bggId, @subtype, @itemName, @yearPublished, @imageUrl, @thumbnailUrl,
      @own, @prevOwned, @forTrade, @want, @wantToPlay, @wantToBuy, @wishlist,
      @preordered, @hasParts, @wantParts, @personalRating, @comment,
      @wishlistPriority, @numPlays, @bggRating, @bggRank, @lastModified, @syncedAt
    )
    ON CONFLICT(coll_id) DO UPDATE SET
      bgg_id = excluded.bgg_id,
      subtype = excluded.subtype,
      name = excluded.name,
      year_published = excluded.year_published,
      image_url = excluded.image_url,
      thumbnail_url = excluded.thumbnail_url,
      own = excluded.own,
      prev_owned = excluded.prev_owned,
      for_trade = excluded.for_trade,
      want = excluded.want,
      want_to_play = excluded.want_to_play,
      want_to_buy = excluded.want_to_buy,
      wishlist = excluded.wishlist,
      preordered = excluded.preordered,
      has_parts = excluded.has_parts,
      want_parts = excluded.want_parts,
      personal_rating = excluded.personal_rating,
      comment = excluded.comment,
      wishlist_priority = excluded.wishlist_priority,
      num_plays = excluded.num_plays,
      bgg_rating = excluded.bgg_rating,
      bgg_rank = excluded.bgg_rank,
      last_modified = excluded.last_modified,
      synced_at = excluded.synced_at`,
  ).run({
    collId: entry.collId,
    bggId: entry.bggId,
    subtype: entry.subtype,
    itemName: entry.name,
    yearPublished: sqlNull(entry.yearPublished),
    imageUrl: sqlNull(entry.imageUrl),
    thumbnailUrl: sqlNull(entry.thumbnailUrl),
    own: entry.own ? 1 : 0,
    prevOwned: entry.prevOwned ? 1 : 0,
    forTrade: entry.forTrade ? 1 : 0,
    want: entry.want ? 1 : 0,
    wantToPlay: entry.wantToPlay ? 1 : 0,
    wantToBuy: entry.wantToBuy ? 1 : 0,
    wishlist: entry.wishlist ? 1 : 0,
    preordered: entry.preordered ? 1 : 0,
    hasParts: entry.hasParts ? 1 : 0,
    wantParts: entry.wantParts ? 1 : 0,
    personalRating: sqlNull(entry.personalRating),
    comment: sqlNull(entry.comment),
    wishlistPriority: sqlNull(entry.wishlistPriority),
    numPlays: entry.numPlays,
    bggRating: sqlNull(entry.bggRating),
    bggRank: sqlNull(entry.bggRank),
    lastModified: sqlNull(entry.lastModified),
    syncedAt: entry.syncedAt,
  });
}

export function upsertCollectionEntries(
  db: Db,
  entries: CollectionEntry[],
): number {
  runTransaction(db, () => {
    for (const item of entries) {
      try {
        upsertCollectionEntry(db, item);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(
          `Error guardando colección collId=${item.collId} bggId=${item.bggId} (${item.name}): ${message}`,
        );
      }
    }
  });
  return entries.length;
}

export function getDistinctCollectionBggIds(db: Db): number[] {
  const rows = db
    .prepare("SELECT DISTINCT bgg_id FROM collection_entries")
    .all() as Array<{ bgg_id: number }>;
  return rows.map((r) => r.bgg_id);
}

export function getCollectionEntryByBggId(
  db: Db,
  bggId: number,
): CollectionEntry | null {
  const row = db
    .prepare("SELECT * FROM collection_entries WHERE bgg_id = ? LIMIT 1")
    .get(bggId) as CollectionEntryRow | undefined;
  return row ? mapCollectionRow(row) : null;
}

/** Mark game as wishlist locally. Uses synthetic coll_id = -bggId when creating. */
export function upsertLocalWishlist(
  db: Db,
  input: {
    bggId: number;
    name: string;
    yearPublished: number | null;
    imageUrl: string | null;
    thumbnailUrl: string | null;
    subtype?: string;
    bggRating: number | null;
    bggRank: number | null;
    wishlistPriority: number;
    comment?: string | null;
  },
): void {
  const existing = getCollectionEntryByBggId(db, input.bggId);
  const now = new Date().toISOString();
  if (existing) {
    db.prepare(
      `UPDATE collection_entries
       SET wishlist = 1,
           wishlist_priority = ?,
           comment = COALESCE(?, comment),
           synced_at = ?
       WHERE bgg_id = ?`,
    ).run(
      input.wishlistPriority,
      input.comment?.trim() || null,
      now,
      input.bggId,
    );
    return;
  }

  const entry: CollectionEntry = {
    collId: -input.bggId,
    bggId: input.bggId,
    subtype: (input.subtype as CollectionEntry["subtype"]) ?? "boardgame",
    name: input.name,
    yearPublished: input.yearPublished,
    imageUrl: input.imageUrl,
    thumbnailUrl: input.thumbnailUrl,
    own: false,
    prevOwned: false,
    forTrade: false,
    want: false,
    wantToPlay: false,
    wantToBuy: false,
    wishlist: true,
    preordered: false,
    hasParts: false,
    wantParts: false,
    personalRating: null,
    comment: input.comment?.trim() || null,
    wishlistPriority: input.wishlistPriority,
    numPlays: 0,
    bggRating: input.bggRating,
    bggRank: input.bggRank,
    lastModified: null,
    syncedAt: now,
  };
  upsertCollectionEntry(db, entry);
}

interface CollectionEntryRow {
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
}

function mapCollectionRow(row: CollectionEntryRow): CollectionEntry {
  return {
    collId: row.coll_id,
    bggId: row.bgg_id,
    subtype: row.subtype as CollectionEntry["subtype"],
    name: row.name,
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
  };
}
