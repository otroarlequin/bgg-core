import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { mapCollectionItemToEntry } from "../src/bgg/mappers.js";
import type { CollectionEntry, Game } from "../src/domain/types.js";
import { createQueryService } from "../src/query/index.js";
import { createDatabase, createStorageService } from "../src/storage/index.js";
import { setSyncState } from "../src/storage/repos/sync-state.js";
import { syncCollection } from "../src/sync/sync-collection.js";

function createTestContext() {
  const dir = mkdtempSync(join(tmpdir(), "bgg-collection-names-"));
  const db = createDatabase(join(dir, "test.db"));
  const storage = createStorageService(db);
  const queries = createQueryService(db);
  return { db, storage, queries };
}

function entry(
  partial: Partial<CollectionEntry> &
    Pick<CollectionEntry, "collId" | "bggId" | "name">,
): CollectionEntry {
  return {
    subtype: "boardgame",
    yearPublished: 2026,
    imageUrl: null,
    thumbnailUrl: null,
    own: true,
    prevOwned: false,
    forTrade: false,
    want: false,
    wantToPlay: false,
    wantToBuy: false,
    wishlist: false,
    preordered: false,
    hasParts: false,
    wantParts: false,
    personalRating: null,
    comment: null,
    wishlistPriority: null,
    numPlays: 0,
    bggRating: 6.7,
    bggRank: null,
    lastModified: null,
    syncedAt: new Date().toISOString(),
    ...partial,
  };
}

function game(partial: Partial<Game> & Pick<Game, "bggId" | "name">): Game {
  return {
    yearPublished: 2026,
    minPlayers: null,
    maxPlayers: null,
    playingTime: null,
    minPlayTime: null,
    maxPlayTime: null,
    weight: null,
    imageUrl: null,
    thumbnailUrl: null,
    description: null,
    designers: [],
    artists: [],
    publishers: [],
    mechanics: [],
    categories: [],
    languageDependence: null,
    bggRating: null,
    bggRank: null,
    thingSyncedAt: new Date().toISOString(),
    ...partial,
  };
}

describe("mapCollectionItemToEntry name shapes", () => {
  const now = "2026-11-13T12:00:00.000Z";

  it("reads collection XML text nodes from bgg-api-ts / fast-xml-parser", () => {
    const mapped = mapCollectionItemToEntry(
      {
        collid: 1,
        objectid: 462649,
        subtype: "boardgame",
        name: [{ sortindex: 1, "#text": "Blancat" }],
        yearpublished: 2026,
        stats: { rating: { average: { value: 6.7 } } },
      },
      now,
    );
    expect(mapped.name).toBe("Blancat");
    expect(mapped.yearPublished).toBe(2026);
    expect(mapped.bggRating).toBe(6.7);
  });

  it("reads xml2js-style text and thing-style value attributes", () => {
    expect(
      mapCollectionItemToEntry(
        {
          collid: 2,
          objectid: 2,
          name: [{ sortindex: 1, _: "CMYK Tricks" }],
        },
        now,
      ).name,
    ).toBe("CMYK Tricks");

    expect(
      mapCollectionItemToEntry(
        {
          collid: 3,
          objectid: 3,
          name: [{ type: "primary", value: "Trash Poker" }],
        },
        now,
      ).name,
    ).toBe("Trash Poker");

    expect(
      mapCollectionItemToEntry(
        {
          collid: 4,
          objectid: 4,
          name: { sortindex: 1, text: "Matchmakers" },
        },
        now,
      ).name,
    ).toBe("Matchmakers");

    expect(
      mapCollectionItemToEntry(
        {
          collid: 5,
          objectid: 5,
          name: "Nights &amp; Weekends",
        },
        now,
      ).name,
    ).toBe("Nights & Weekends");
  });

  it("keeps Unknown only when no title is present", () => {
    expect(
      mapCollectionItemToEntry({ collid: 9, objectid: 9 }, now).name,
    ).toBe("Unknown");
    expect(
      mapCollectionItemToEntry(
        { collid: 10, objectid: 10, name: [{ sortindex: 1 }] },
        now,
      ).name,
    ).toBe("Unknown");
  });
});

describe("queryCollection title fallback", () => {
  it("does not let games.name Unknown hide the collection title", () => {
    const { storage, queries } = createTestContext();
    storage.collection.upsertCollectionEntries(storage.db, [
      entry({ collId: 1, bggId: 462649, name: "Blancat", own: true }),
    ]);
    storage.games.upsertGame(
      storage.db,
      game({ bggId: 462649, name: "Unknown" }),
    );

    const results = queries.queryCollection({ own: true });
    expect(results).toHaveLength(1);
    expect(results[0].name).toBe("Blancat");
  });
});

describe("syncCollection placeholder heal", () => {
  it("forces a full collection fetch when stored titles are Unknown", async () => {
    const { storage } = createTestContext();
    storage.collection.upsertCollectionEntries(storage.db, [
      entry({ collId: 1, bggId: 462649, name: "Unknown", own: true }),
    ]);
    setSyncState(storage.db, "collection", "2026-11-12T08:00:00.000Z");

    const calls: Array<Record<string, unknown>> = [];
    const client = {
      getCollection: async (params: Record<string, unknown>) => {
        calls.push(params);
        return {
          items: {
            item: [
              {
                collid: 1,
                objectid: 462649,
                subtype: "boardgame",
                name: [{ sortindex: 1, "#text": "Blancat" }],
                yearpublished: 2026,
              },
            ],
          },
        };
      },
    };

    const result = await syncCollection(storage, client as never, "soleda", {
      incremental: true,
    });

    expect(result.incremental).toBe(false);
    expect(calls.length).toBeGreaterThan(0);
    expect(calls.every((params) => params.modifiedsince == null)).toBe(true);
    expect(
      storage.collection.getCollectionEntryByBggId(storage.db, 462649)?.name,
    ).toBe("Blancat");
  });

  it("keeps incremental sync when titles are already resolved", async () => {
    const { storage } = createTestContext();
    storage.collection.upsertCollectionEntries(storage.db, [
      entry({ collId: 1, bggId: 100, name: "Trash Poker", own: true }),
    ]);
    setSyncState(storage.db, "collection", "2026-11-12T08:00:00.000Z");

    const calls: Array<Record<string, unknown>> = [];
    const client = {
      getCollection: async (params: Record<string, unknown>) => {
        calls.push(params);
        return { items: { item: [] } };
      },
    };

    const result = await syncCollection(storage, client as never, "soleda", {
      incremental: true,
    });

    expect(result.incremental).toBe(true);
    expect(calls.some((params) => params.modifiedsince === "2026-11-12")).toBe(
      true,
    );
  });
});
