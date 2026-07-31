import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { CollectionEntry, Play, PlayPlayer } from "../src/domain/types.js";
import { createQueryService } from "../src/query/index.js";
import { createDatabase, createStorageService } from "../src/storage/index.js";
import { createSession, runPairwiseDuel } from "../src/activities/pairwise-duel/index.js";
import { createActivityContext } from "../src/activities/context.js";

const dbs: string[] = [];

function createTestContext() {
  const dir = mkdtempSync(join(tmpdir(), "bgg-core-test-"));
  const dbPath = join(dir, "test.db");
  dbs.push(dbPath);
  const db = createDatabase(dbPath);
  const storage = createStorageService(db);
  const queries = createQueryService(db);
  return { db, storage, queries, dbPath, dir };
}

afterEach(() => {
  dbs.length = 0;
});

function seedCollection(storage: ReturnType<typeof createStorageService>, entries: CollectionEntry[]) {
  storage.collection.upsertCollectionEntries(storage.db, entries);
}

function seedPlays(
  storage: ReturnType<typeof createStorageService>,
  items: Array<{ play: Play; players: PlayPlayer[] }>,
) {
  storage.plays.upsertPlays(storage.db, items);
}

describe("decodeHtmlEntities", () => {
  it("decodes numeric and named HTML entities", async () => {
    const { decodeHtmlEntities } = await import("../src/utils/html-entities.js");
    expect(decodeHtmlEntities("We Didn&#039;t Playtest This at All")).toBe(
      "We Didn't Playtest This at All",
    );
    expect(decodeHtmlEntities("Tom &amp; Jerry")).toBe("Tom & Jerry");
    expect(decodeHtmlEntities("A &#x27;quoted&#x27; name")).toBe("A 'quoted' name");
  });
});

describe("mapThingItemToGame language dependence", () => {
  it("extracts winning poll level from nested results array", async () => {
    const { mapThingItemToGame } = await import("../src/bgg/mappers.js");
    const now = new Date().toISOString();
    const game = mapThingItemToGame(
      {
        id: 174430,
        poll: [
          {
            name: "language_dependence",
            results: [
              {
                result: [
                  { level: 1, value: "No necessary in-game text", numvotes: 1 },
                  {
                    level: 4,
                    value: "Extensive use of text - massive conversion needed to be playable",
                    numvotes: 48,
                  },
                ],
              },
            ],
          },
        ],
      },
      now,
    );
    expect(game.languageDependence).toBe(
      "Extensive use of text - massive conversion needed to be playable",
    );
  });
});

describe("queryCollection", () => {
  it("filters by own and designer", () => {
    const { storage, queries } = createTestContext();
    const now = new Date().toISOString();

    seedCollection(storage, [
      {
        collId: 1,
        bggId: 100,
        subtype: "boardgame",
        name: "Brass",
        yearPublished: 2018,
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
        personalRating: 9,
        comment: null,
        wishlistPriority: null,
        numPlays: 10,
        bggRating: 8.5,
        bggRank: null,
        lastModified: null,
        syncedAt: now,
      },
      {
        collId: 2,
        bggId: 200,
        subtype: "boardgame",
        name: "Monopoly",
        yearPublished: 1935,
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
        personalRating: 4,
        comment: null,
        wishlistPriority: null,
        numPlays: 1,
        bggRating: 4.0,
        bggRank: null,
        lastModified: null,
        syncedAt: now,
      },
    ]);

    storage.games.upsertGame(storage.db, {
      bggId: 100,
      name: "Brass",
      yearPublished: 2018,
      minPlayers: 2,
      maxPlayers: 4,
      playingTime: 120,
      minPlayTime: 60,
      maxPlayTime: 120,
      weight: 3.9,
      imageUrl: null,
      thumbnailUrl: null,
      designers: ["Martin Wallace"],
      artists: [],
      publishers: [],
      mechanics: [],
      categories: [],
      languageDependence: null,
      bggRating: 8.5,
      bggRank: null,
      thingSyncedAt: now,
    });

    storage.games.upsertGame(storage.db, {
      bggId: 200,
      name: "Monopoly",
      yearPublished: 1935,
      minPlayers: 2,
      maxPlayers: 8,
      playingTime: 180,
      minPlayTime: 60,
      maxPlayTime: 180,
      weight: 1.6,
      imageUrl: null,
      thumbnailUrl: null,
      designers: ["Charles Darrow"],
      artists: [],
      publishers: [],
      mechanics: [],
      categories: [],
      languageDependence: null,
      bggRating: 4.0,
      bggRank: null,
      thingSyncedAt: now,
    });

    const results = queries.queryCollection({ own: true, designer: "Martin Wallace" });
    expect(results).toHaveLength(1);
    expect(results[0].name).toBe("Brass");
  });

  it("excludes expansions by default", () => {
    const { storage, queries } = createTestContext();
    const now = new Date().toISOString();

    seedCollection(storage, [
      {
        collId: 1,
        bggId: 100,
        subtype: "boardgame",
        name: "Base Game",
        yearPublished: 2020,
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
        bggRating: null,
        bggRank: null,
        lastModified: null,
        syncedAt: now,
      },
      {
        collId: 2,
        bggId: 101,
        subtype: "boardgameexpansion",
        name: "Expansion",
        yearPublished: 2021,
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
        bggRating: null,
        bggRank: null,
        lastModified: null,
        syncedAt: now,
      },
    ]);

    const withoutExpansions = queries.queryCollection({});
    expect(withoutExpansions).toHaveLength(1);
    expect(withoutExpansions[0].name).toBe("Base Game");

    const withExpansions = queries.queryCollection({ includeExpansions: true });
    expect(withExpansions).toHaveLength(2);
  });

  it("filters by multiple mechanics with AND logic", () => {
    const { storage, queries } = createTestContext();
    const now = new Date().toISOString();

    seedCollection(storage, [
      {
        collId: 1,
        bggId: 100,
        subtype: "boardgame",
        name: "Combo Game",
        yearPublished: 2020,
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
        bggRating: null,
        bggRank: null,
        lastModified: null,
        syncedAt: now,
      },
      {
        collId: 2,
        bggId: 200,
        subtype: "boardgame",
        name: "Single Mechanic Game",
        yearPublished: 2020,
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
        bggRating: null,
        bggRank: null,
        lastModified: null,
        syncedAt: now,
      },
    ]);

    storage.games.upsertGame(storage.db, {
      bggId: 100,
      name: "Combo Game",
      yearPublished: 2020,
      minPlayers: 2,
      maxPlayers: 4,
      playingTime: 60,
      minPlayTime: 30,
      maxPlayTime: 90,
      weight: 2.5,
      imageUrl: null,
      thumbnailUrl: null,
      designers: [],
      artists: [],
      publishers: [],
      mechanics: ["Hand Management", "Card Draft"],
      categories: [],
      languageDependence: null,
      bggRating: 8,
      bggRank: null,
      thingSyncedAt: now,
    });

    storage.games.upsertGame(storage.db, {
      bggId: 200,
      name: "Single Mechanic Game",
      yearPublished: 2020,
      minPlayers: 2,
      maxPlayers: 4,
      playingTime: 60,
      minPlayTime: 30,
      maxPlayTime: 90,
      weight: 2,
      imageUrl: null,
      thumbnailUrl: null,
      designers: [],
      artists: [],
      publishers: [],
      mechanics: ["Hand Management"],
      categories: [],
      languageDependence: null,
      bggRating: 7,
      bggRank: null,
      thingSyncedAt: now,
    });

    const both = queries.queryCollection({
      own: true,
      includeExpansions: true,
      mechanics: ["Hand Management", "Card Draft"],
    });
    expect(both).toHaveLength(1);
    expect(both[0].name).toBe("Combo Game");

    const one = queries.queryCollection({
      own: true,
      includeExpansions: true,
      mechanics: ["Hand Management"],
    });
    expect(one).toHaveLength(2);
  });
});

describe("queryGamesPlayedInPeriod", () => {
  it("aggregates plays by game in period", () => {
    const { storage, queries } = createTestContext();
    const now = new Date().toISOString();

    storage.games.upsertGame(storage.db, {
      bggId: 100,
      name: "Brass",
      yearPublished: 2018,
      minPlayers: 2,
      maxPlayers: 4,
      playingTime: 120,
      minPlayTime: 60,
      maxPlayTime: 120,
      weight: 3.9,
      imageUrl: null,
      thumbnailUrl: "http://example.com/brass.jpg",
      designers: ["Martin Wallace"],
      artists: [],
      publishers: [],
      mechanics: ["Economic"],
      categories: ["Strategy"],
      languageDependence: null,
      bggRating: 8.5,
      bggRank: 10,
      thingSyncedAt: now,
    });

    seedPlays(storage, [
      {
        play: {
          playId: 1,
          bggId: 100,
          gameName: "Brass",
          date: "2026-02-01",
          quantity: 2,
          length: 90,
          location: "Home",
          incomplete: false,
          nowinstats: true,
          comments: null,
          syncedAt: now,
        },
        players: [
          {
            playId: 1,
            username: "testuser",
            userid: 1,
            name: "Test",
            score: "100",
            win: true,
            color: "red",
            rating: 9,
          },
        ],
      },
      {
        play: {
          playId: 2,
          bggId: 100,
          gameName: "Brass",
          date: "2026-03-15",
          quantity: 1,
          length: 120,
          location: "Club",
          incomplete: false,
          nowinstats: true,
          comments: null,
          syncedAt: now,
        },
        players: [],
      },
    ]);

    const results = queries.queryGamesPlayedInPeriod({
      from: "2026-01-01",
      to: "2026-06-30",
    });

    expect(results).toHaveLength(1);
    expect(results[0].playCount).toBe(3);
    expect(results[0].totalMinutes).toBe(300);
    expect(results[0].firstPlay).toBe("2026-02-01");
    expect(results[0].lastPlay).toBe("2026-03-15");
  });
});

describe("pairwise-duel", () => {
  it("eliminates games until one winner remains", async () => {
    const { storage, queries, dbPath } = createTestContext();
    const now = new Date().toISOString();

    for (const [id, name] of [
      [100, "Brass"],
      [200, "Root"],
      [300, "Azul"],
    ] as const) {
      storage.games.upsertGame(storage.db, {
        bggId: id,
        name,
        yearPublished: 2020,
        minPlayers: 2,
        maxPlayers: 4,
        playingTime: 60,
        minPlayTime: 30,
        maxPlayTime: 90,
        weight: 2.5,
        imageUrl: null,
        thumbnailUrl: null,
        designers: [],
        artists: [],
        publishers: [],
        mechanics: [],
        categories: [],
        languageDependence: null,
        bggRating: 8,
        bggRank: null,
        thingSyncedAt: now,
      });

      seedPlays(storage, [
        {
          play: {
            playId: id,
            bggId: id,
            gameName: name,
            date: "2026-02-01",
            quantity: 1,
            length: 60,
            location: "",
            incomplete: false,
            nowinstats: true,
            comments: null,
            syncedAt: now,
          },
          players: [],
        },
      ]);
    }

    const ctx = {
      queries,
      storage,
      outputDir: dbPath,
    };

    const session = createSession(ctx, {
      from: "2026-01-01",
      to: "2026-06-30",
    });
    expect(session.remainingBggIds).toHaveLength(3);

    let currentSession = session;
    while (
      currentSession.status === "active" &&
      currentSession.remainingBggIds.length > 1
    ) {
      const next = await runPairwiseDuel(
        { action: "next", sessionId: session.id },
        ctx,
      );
      expect(next.duel).toBeTruthy();
      const winnerId = next.duel!.candidateA.bggId;
      const chosen = await runPairwiseDuel(
        { action: "choose", sessionId: session.id, winnerBggId: winnerId },
        ctx,
      );
      currentSession = chosen.session ?? currentSession;
    }

    const result = await runPairwiseDuel(
      { action: "result", sessionId: session.id },
      ctx,
    );
    expect(result.winner).toBeTruthy();
    expect(currentSession.status).toBe("completed");
  });

  it("filters ownedOnly pool", () => {
    const { storage, queries } = createTestContext();
    const now = new Date().toISOString();
    for (const [id, own] of [
      [1, true],
      [2, false],
    ] as const) {
      seedCollection(storage, [
        {
          collId: id,
          bggId: id,
          subtype: "boardgame",
          name: `Game ${id}`,
          yearPublished: 2020,
          imageUrl: null,
          thumbnailUrl: null,
          own,
          prevOwned: false,
          forTrade: false,
          want: false,
          wantToPlay: false,
          wantToBuy: false,
          wishlist: false,
          preordered: false,
          hasParts: false,
          wantParts: false,
          personalRating: 8,
          comment: null,
          wishlistPriority: null,
          numPlays: 1,
          bggRating: 8,
          bggRank: null,
          lastModified: null,
          syncedAt: now,
        },
      ]);
      storage.games.upsertGame(storage.db, {
        bggId: id,
        name: `Game ${id}`,
        yearPublished: 2020,
        minPlayers: 2,
        maxPlayers: 4,
        playingTime: 60,
        minPlayTime: 45,
        maxPlayTime: 60,
        weight: 2,
        imageUrl: null,
        thumbnailUrl: null,
        description: null,
        designers: [],
        artists: [],
        publishers: [],
        mechanics: [],
        categories: [],
        languageDependence: null,
        bggRating: 8,
        bggRank: null,
        thingSyncedAt: now,
      });
      seedPlays(storage, [
        {
          play: {
            playId: id,
            bggId: id,
            gameName: `Game ${id}`,
            date: "2026-03-01",
            quantity: 1,
            length: 60,
            location: "",
            incomplete: false,
            nowinstats: true,
            comments: null,
            syncedAt: now,
          },
          players: [],
        },
      ]);
    }

    const all = queries.queryGamesPlayedInPeriod({
      from: "2026-01-01",
      to: "2026-06-30",
    });
    expect(all).toHaveLength(2);

    const owned = queries.queryGamesPlayedInPeriod({
      from: "2026-01-01",
      to: "2026-06-30",
      ownedOnly: true,
    });
    expect(owned).toHaveLength(1);
    expect(owned[0].bggId).toBe(1);
  });
});

describe("purchase validator overlap", () => {
  it("scores similar games by shared designers/mechanics", async () => {
    const { analyzePurchaseCandidate } = await import(
      "../src/query/purchase-validator.js"
    );
    const { storage, db } = createTestContext();
    const now = new Date().toISOString();

    seedCollection(storage, [
      {
        collId: 1,
        bggId: 10,
        subtype: "boardgame",
        name: "Owned Twin",
        yearPublished: 2020,
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
        personalRating: 9,
        comment: null,
        wishlistPriority: null,
        numPlays: 5,
        bggRating: 8,
        bggRank: null,
        lastModified: null,
        syncedAt: now,
      },
      {
        collId: 2,
        bggId: 20,
        subtype: "boardgame",
        name: "Unrelated",
        yearPublished: 2010,
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
        personalRating: 5,
        comment: null,
        wishlistPriority: null,
        numPlays: 1,
        bggRating: 6,
        bggRank: null,
        lastModified: null,
        syncedAt: now,
      },
    ]);

    storage.games.upsertGame(storage.db, {
      bggId: 10,
      name: "Owned Twin",
      yearPublished: 2020,
      minPlayers: 2,
      maxPlayers: 4,
      playingTime: 60,
      minPlayTime: 45,
      maxPlayTime: 60,
      weight: 2.5,
      imageUrl: null,
      thumbnailUrl: null,
      description: null,
      designers: ["Ada Designer"],
      artists: [],
      publishers: [],
      mechanics: ["Hand Management"],
      categories: ["Strategy"],
      languageDependence: null,
      bggRating: 8,
      bggRank: null,
      thingSyncedAt: now,
    });
    storage.games.upsertGame(storage.db, {
      bggId: 20,
      name: "Unrelated",
      yearPublished: 2010,
      minPlayers: 2,
      maxPlayers: 4,
      playingTime: 30,
      minPlayTime: 20,
      maxPlayTime: 30,
      weight: 1.2,
      imageUrl: null,
      thumbnailUrl: null,
      description: null,
      designers: ["Other Person"],
      artists: [],
      publishers: [],
      mechanics: ["Roll and Move"],
      categories: ["Children"],
      languageDependence: null,
      bggRating: 6,
      bggRank: null,
      thingSyncedAt: now,
    });

    const candidate = {
      bggId: 99,
      name: "Candidate",
      yearPublished: 2024,
      minPlayers: 2,
      maxPlayers: 4,
      playingTime: 60,
      minPlayTime: 45,
      maxPlayTime: 60,
      weight: 2.4,
      imageUrl: null,
      thumbnailUrl: null,
      description: "A game",
      designers: ["Ada Designer"],
      artists: [],
      publishers: [],
      mechanics: ["Hand Management"],
      categories: ["Strategy"],
      languageDependence: null,
      bggRating: 8.2,
      bggRank: 100,
      thingSyncedAt: now,
      thingType: "boardgame",
    };

    const analysis = analyzePurchaseCandidate(db, candidate);
    expect(analysis.overlap.topSimilar[0]?.bggId).toBe(10);
    expect(analysis.overlap.topSimilar[0]?.similarity ?? 0).toBeGreaterThan(
      analysis.overlap.topSimilar.find((g) => g.bggId === 20)?.similarity ?? 0,
    );
  });
});

describe("activities registry", () => {
  it("lists pairwise-duel activity", async () => {
    const { listActivities } = await import("../src/activities/registry.js");
    const ids = listActivities().map((a) => a.id);
    expect(ids).toContain("pairwise-duel");
    expect(ids).toContain("smart-wishlist");
  });
});

describe("shelf of shame / what-to-play / calendar", () => {
  it("lists owned zero-play base games oldest first", () => {
    const { storage, queries } = createTestContext();
    const now = new Date().toISOString();

    seedCollection(storage, [
      {
        collId: 1,
        bggId: 1,
        subtype: "boardgame",
        name: "Newer Shame",
        yearPublished: 2022,
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
        bggRating: null,
        bggRank: null,
        lastModified: "2024-06-01",
        syncedAt: now,
      },
      {
        collId: 2,
        bggId: 2,
        subtype: "boardgame",
        name: "Older Shame",
        yearPublished: 2015,
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
        bggRating: null,
        bggRank: null,
        lastModified: "2020-01-01",
        syncedAt: now,
      },
      {
        collId: 3,
        bggId: 3,
        subtype: "boardgame",
        name: "Played",
        yearPublished: 2018,
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
        personalRating: 8,
        comment: null,
        wishlistPriority: null,
        numPlays: 2,
        bggRating: null,
        bggRank: null,
        lastModified: "2019-01-01",
        syncedAt: now,
      },
    ]);

    const shame = queries.queryShelfOfShame();
    expect(shame.map((g) => g.bggId)).toEqual([2, 1]);
  });

  it("suggests games that fit players and time", () => {
    const { storage, queries } = createTestContext();
    const now = new Date().toISOString();

    seedCollection(storage, [
      {
        collId: 1,
        bggId: 10,
        subtype: "boardgame",
        name: "Short Fit",
        yearPublished: 2020,
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
        personalRating: 8,
        comment: null,
        wishlistPriority: null,
        numPlays: 3,
        bggRating: 7.5,
        bggRank: null,
        lastModified: null,
        syncedAt: now,
      },
      {
        collId: 2,
        bggId: 20,
        subtype: "boardgame",
        name: "Too Long",
        yearPublished: 2020,
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
        personalRating: 9,
        comment: null,
        wishlistPriority: null,
        numPlays: 5,
        bggRating: 8,
        bggRank: null,
        lastModified: null,
        syncedAt: now,
      },
    ]);

    storage.games.upsertGame(storage.db, {
      bggId: 10,
      name: "Short Fit",
      yearPublished: 2020,
      minPlayers: 2,
      maxPlayers: 4,
      playingTime: 45,
      minPlayTime: 30,
      maxPlayTime: 60,
      weight: 2,
      imageUrl: null,
      thumbnailUrl: null,
      description: null,
      designers: [],
      artists: [],
      publishers: [],
      mechanics: [],
      categories: [],
      languageDependence: null,
      bggRating: 7.5,
      bggRank: null,
      thingSyncedAt: now,
    });
    storage.games.upsertGame(storage.db, {
      bggId: 20,
      name: "Too Long",
      yearPublished: 2020,
      minPlayers: 2,
      maxPlayers: 4,
      playingTime: 180,
      minPlayTime: 150,
      maxPlayTime: 200,
      weight: 3,
      imageUrl: null,
      thumbnailUrl: null,
      description: null,
      designers: [],
      artists: [],
      publishers: [],
      mechanics: [],
      categories: [],
      languageDependence: null,
      bggRating: 8,
      bggRank: null,
      thingSyncedAt: now,
    });

    const suggestions = queries.queryWhatToPlay({
      players: 3,
      maxTimeMinutes: 90,
      seed: 1,
    });
    expect(suggestions.suggestions.some((s) => s.bggId === 10)).toBe(true);
    expect(suggestions.suggestions.some((s) => s.bggId === 20)).toBe(false);

    storage.games.upsertGame(storage.db, {
      bggId: 10,
      name: "Short Fit",
      yearPublished: 2020,
      minPlayers: 2,
      maxPlayers: 4,
      playingTime: 45,
      minPlayTime: 30,
      maxPlayTime: 60,
      weight: 2,
      imageUrl: null,
      thumbnailUrl: null,
      description: null,
      designers: [],
      artists: [],
      publishers: [],
      mechanics: ["Hand Management"],
      categories: ["Strategy"],
      languageDependence: "No necessary in-game text",
      bggRating: 7.5,
      bggRank: null,
      thingSyncedAt: now,
    });

    const byTaxonomy = queries.queryWhatToPlay({
      players: 3,
      maxTimeMinutes: 90,
      categories: ["Strategy"],
      mechanics: ["Hand Management"],
      languageDependence: "No necessary in-game text",
      seed: 1,
    });
    expect(byTaxonomy.poolTotal).toBeGreaterThanOrEqual(1);
    expect(byTaxonomy.suggestions.some((s) => s.bggId === 10)).toBe(true);

    const missTaxonomy = queries.queryWhatToPlay({
      players: 3,
      maxTimeMinutes: 90,
      categories: ["Children"],
      seed: 1,
    });
    expect(missTaxonomy.suggestions.some((s) => s.bggId === 10)).toBe(false);
    expect(missTaxonomy.poolTotal).toBe(0);
  });

  it("computes play calendar streaks", () => {
    const { storage, queries } = createTestContext();
    const now = new Date().toISOString();

    seedPlays(storage, [
      {
        play: {
          playId: 1,
          bggId: 1,
          gameName: "A",
          date: "2026-07-20",
          quantity: 1,
          length: 30,
          location: "",
          incomplete: false,
          nowinstats: true,
          comments: null,
          syncedAt: now,
        },
        players: [],
      },
      {
        play: {
          playId: 2,
          bggId: 1,
          gameName: "A",
          date: "2026-07-21",
          quantity: 2,
          length: 30,
          location: "",
          incomplete: false,
          nowinstats: true,
          comments: null,
          syncedAt: now,
        },
        players: [],
      },
      {
        play: {
          playId: 3,
          bggId: 2,
          gameName: "B",
          date: "2026-07-23",
          quantity: 1,
          length: 40,
          location: "",
          incomplete: false,
          nowinstats: true,
          comments: null,
          syncedAt: now,
        },
        players: [],
      },
    ]);

    const cal = queries.queryPlayCalendar({
      from: "2026-07-01",
      to: "2026-07-23",
    });
    expect(cal.daysWithPlays).toBe(3);
    expect(cal.totalPlays).toBe(4);
    expect(cal.bestStreak).toBe(2);
    expect(cal.currentStreak).toBe(1);

    const day = queries.queryPlaysOnDate("2026-07-21");
    expect(day).toHaveLength(1);
    expect(day[0].quantity).toBe(2);
  });
});

describe("smart wishlist", () => {
  function entry(
    partial: Partial<CollectionEntry> &
      Pick<CollectionEntry, "collId" | "bggId" | "name">,
  ): CollectionEntry {
    return {
      subtype: "boardgame",
      yearPublished: 2020,
      imageUrl: null,
      thumbnailUrl: null,
      own: false,
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
      bggRating: null,
      bggRank: null,
      lastModified: null,
      syncedAt: new Date().toISOString(),
      ...partial,
    };
  }

  it("ranks wishlist by fit/gap and exposes profile reasons", () => {
    const { storage, queries } = createTestContext();
    const now = new Date().toISOString();

    seedCollection(storage, [
      entry({
        collId: 1,
        bggId: 1,
        name: "Owned Rosenberg A",
        own: true,
        personalRating: 9,
        numPlays: 12,
      }),
      entry({
        collId: 2,
        bggId: 2,
        name: "Owned Rosenberg B",
        own: true,
        personalRating: 8,
        numPlays: 6,
      }),
      entry({
        collId: 3,
        bggId: 10,
        name: "Wishlist Fit",
        wishlist: true,
        wishlistPriority: 1,
      }),
      entry({
        collId: 4,
        bggId: 20,
        name: "Wishlist Mismatch",
        wishlist: true,
        wishlistPriority: 5,
      }),
    ]);

    storage.games.upsertGame(storage.db, {
      bggId: 1,
      name: "Owned Rosenberg A",
      yearPublished: 2016,
      minPlayers: 1,
      maxPlayers: 4,
      playingTime: 90,
      minPlayTime: 60,
      maxPlayTime: 120,
      weight: 3,
      imageUrl: null,
      thumbnailUrl: null,
      description: null,
      designers: ["Uwe Rosenberg"],
      artists: [],
      publishers: [],
      mechanics: ["Worker Placement"],
      categories: ["Economic"],
      languageDependence: null,
      bggRating: 8,
      bggRank: null,
      thingSyncedAt: now,
    });
    storage.games.upsertGame(storage.db, {
      bggId: 2,
      name: "Owned Rosenberg B",
      yearPublished: 2018,
      minPlayers: 1,
      maxPlayers: 4,
      playingTime: 90,
      minPlayTime: 60,
      maxPlayTime: 120,
      weight: 3.2,
      imageUrl: null,
      thumbnailUrl: null,
      description: null,
      designers: ["Uwe Rosenberg"],
      artists: [],
      publishers: [],
      mechanics: ["Worker Placement", "Hand Management"],
      categories: ["Economic"],
      languageDependence: null,
      bggRating: 8,
      bggRank: null,
      thingSyncedAt: now,
    });
    storage.games.upsertGame(storage.db, {
      bggId: 10,
      name: "Wishlist Fit",
      yearPublished: 2022,
      minPlayers: 1,
      maxPlayers: 4,
      playingTime: 90,
      minPlayTime: 60,
      maxPlayTime: 120,
      weight: 3,
      imageUrl: null,
      thumbnailUrl: null,
      description: null,
      designers: ["Uwe Rosenberg"],
      artists: [],
      publishers: [],
      mechanics: ["Worker Placement"],
      categories: ["Economic"],
      languageDependence: null,
      bggRating: 8,
      bggRank: null,
      thingSyncedAt: now,
    });
    storage.games.upsertGame(storage.db, {
      bggId: 20,
      name: "Wishlist Mismatch",
      yearPublished: 2010,
      minPlayers: 2,
      maxPlayers: 8,
      playingTime: 30,
      minPlayTime: 20,
      maxPlayTime: 40,
      weight: 1.2,
      imageUrl: null,
      thumbnailUrl: null,
      description: null,
      designers: ["Someone Else"],
      artists: [],
      publishers: [],
      mechanics: ["Roll and Move"],
      categories: ["Children's Game"],
      languageDependence: null,
      bggRating: 5,
      bggRank: null,
      thingSyncedAt: now,
    });

    const result = queries.querySmartWishlist({ mode: "balance" });
    expect(result.profile.ownedCount).toBe(2);
    expect(result.profile.topDesigners.some((d) => d.value === "Uwe Rosenberg")).toBe(
      true,
    );
    expect(result.localSuggestions.length).toBe(2);
    expect(result.localSuggestions[0]?.bggId).toBe(10);
    expect(result.localSuggestions[0]!.score).toBeGreaterThan(
      result.localSuggestions[1]!.score,
    );
    expect(
      result.localSuggestions[0]!.reasons.some(
        (r) => r.kind === "fit_designer" || r.kind === "priority",
      ),
    ).toBe(true);
    expect(
      result.localSuggestions.some((s) =>
        s.reasons.some((r) => /juegas bastante/i.test(r.headline)),
      ),
    ).toBe(false);
    expect(Array.isArray(result.localSuggestions[0]?.coveredGaps)).toBe(true);
    expect(
      result.gaps.every(
        (g) => g.facet === "mechanic" || g.facet === "designer",
      ),
    ).toBe(true);

    const more = queries.querySmartWishlist({ mode: "more" });
    const gapsMode = queries.querySmartWishlist({ mode: "gaps" });
    expect(more.localSuggestions[0]?.bggId).toBe(10);
    expect(gapsMode.localSuggestions.map((s) => s.bggId)).toContain(10);
  });

  it("exposes coveredGaps for wishlist games that fill detected gaps", () => {
    const { storage, queries } = createTestContext();
    const now = new Date().toISOString();

    seedCollection(storage, [
      entry({
        collId: 1,
        bggId: 1,
        name: "Only Deck Builder",
        own: true,
        personalRating: 9,
        numPlays: 20,
      }),
      entry({
        collId: 2,
        bggId: 50,
        name: "Wishlist Deck",
        wishlist: true,
        wishlistPriority: 2,
      }),
      entry({
        collId: 3,
        bggId: 51,
        name: "Wishlist Unrelated",
        wishlist: true,
        wishlistPriority: 3,
      }),
    ]);

    storage.games.upsertGame(storage.db, {
      bggId: 1,
      name: "Only Deck Builder",
      yearPublished: 2015,
      minPlayers: 1,
      maxPlayers: 4,
      playingTime: 60,
      minPlayTime: 45,
      maxPlayTime: 90,
      weight: 2.5,
      imageUrl: null,
      thumbnailUrl: null,
      description: null,
      designers: ["Unique Designer"],
      artists: [],
      publishers: [],
      mechanics: ["Deck Building"],
      categories: ["Card Game"],
      languageDependence: null,
      bggRating: 8,
      bggRank: null,
      thingSyncedAt: now,
    });
    storage.games.upsertGame(storage.db, {
      bggId: 50,
      name: "Wishlist Deck",
      yearPublished: 2022,
      minPlayers: 1,
      maxPlayers: 4,
      playingTime: 60,
      minPlayTime: 45,
      maxPlayTime: 90,
      weight: 2.5,
      imageUrl: null,
      thumbnailUrl: null,
      description: null,
      designers: ["Unique Designer"],
      artists: [],
      publishers: [],
      mechanics: ["Deck Building"],
      categories: ["Card Game"],
      languageDependence: null,
      bggRating: 8,
      bggRank: null,
      thingSyncedAt: now,
    });
    storage.games.upsertGame(storage.db, {
      bggId: 51,
      name: "Wishlist Unrelated",
      yearPublished: 2010,
      minPlayers: 2,
      maxPlayers: 6,
      playingTime: 30,
      minPlayTime: 20,
      maxPlayTime: 40,
      weight: 1.2,
      imageUrl: null,
      thumbnailUrl: null,
      description: null,
      designers: ["Someone Else"],
      artists: [],
      publishers: [],
      mechanics: ["Roll and Move"],
      categories: ["Children's Game"],
      languageDependence: null,
      bggRating: 5,
      bggRank: null,
      thingSyncedAt: now,
    });

    const result = queries.querySmartWishlist({ mode: "balance" });
    const deck = result.localSuggestions.find((s) => s.bggId === 50);
    expect(deck).toBeTruthy();
    expect(
      deck!.coveredGaps.some(
        (g) =>
          (g.facet === "mechanic" && g.value === "Deck Building") ||
          (g.facet === "designer" && g.value === "Unique Designer"),
      ) ||
        deck!.tasteFacets.some(
          (g) =>
            (g.facet === "mechanic" && g.value === "Deck Building") ||
            (g.facet === "designer" && g.value === "Unique Designer"),
        ),
    ).toBe(true);
    // Chips only include facets that hit the wishlist.
    expect(result.gaps.length).toBeGreaterThan(0);
    expect(
      result.gaps.every((g) =>
        result.localSuggestions.some((s) =>
          [...s.coveredGaps, ...s.tasteFacets].some(
            (c) => c.facet === g.facet && c.value === g.value,
          ),
        ),
      ),
    ).toBe(true);
  });

  it("does not expose designer chips that no wishlist game covers", () => {
    const { storage, queries } = createTestContext();
    const now = new Date().toISOString();

    seedCollection(storage, [
      entry({
        collId: 1,
        bggId: 1,
        name: "CoCredit Hit",
        own: true,
        personalRating: 9,
        numPlays: 30,
      }),
      entry({
        collId: 2,
        bggId: 60,
        name: "Wishlist Other",
        wishlist: true,
        wishlistPriority: 1,
      }),
    ]);

    storage.games.upsertGame(storage.db, {
      bggId: 1,
      name: "CoCredit Hit",
      yearPublished: 2018,
      minPlayers: 1,
      maxPlayers: 4,
      playingTime: 90,
      minPlayTime: 60,
      maxPlayTime: 120,
      weight: 3,
      imageUrl: null,
      thumbnailUrl: null,
      description: null,
      designers: ["Famous Designer", "Obscure CoDesigner"],
      artists: [],
      publishers: [],
      mechanics: ["Worker Placement"],
      categories: ["Strategy"],
      languageDependence: null,
      bggRating: 8,
      bggRank: null,
      thingSyncedAt: now,
    });
    storage.games.upsertGame(storage.db, {
      bggId: 60,
      name: "Wishlist Other",
      yearPublished: 2024,
      minPlayers: 2,
      maxPlayers: 4,
      playingTime: 45,
      minPlayTime: 30,
      maxPlayTime: 60,
      weight: 2,
      imageUrl: null,
      thumbnailUrl: null,
      description: null,
      designers: ["Totally Different"],
      artists: [],
      publishers: [],
      mechanics: ["Hand Management"],
      categories: ["Card Game"],
      languageDependence: null,
      bggRating: 7,
      bggRank: null,
      thingSyncedAt: now,
    });

    const result = queries.querySmartWishlist({ mode: "balance" });
    expect(
      result.gaps.some(
        (g) =>
          g.facet === "designer" &&
          (g.value === "Obscure CoDesigner" || g.value === "Famous Designer"),
      ),
    ).toBe(false);
  });

  it("does not claim you play Solo from unplayed owned tags alone", () => {
    const { storage, queries } = createTestContext();
    const now = new Date().toISOString();

    seedCollection(storage, [
      entry({
        collId: 1,
        bggId: 1,
        name: "Shelf Solo Capable",
        own: true,
        personalRating: 8,
        numPlays: 0,
      }),
      entry({
        collId: 2,
        bggId: 2,
        name: "Played Worker",
        own: true,
        personalRating: 9,
        numPlays: 10,
      }),
      entry({
        collId: 3,
        bggId: 30,
        name: "Wishlist Solo Tag",
        wishlist: true,
        wishlistPriority: 2,
      }),
    ]);

    storage.games.upsertGame(storage.db, {
      bggId: 1,
      name: "Shelf Solo Capable",
      yearPublished: 2020,
      minPlayers: 1,
      maxPlayers: 4,
      playingTime: 60,
      minPlayTime: 45,
      maxPlayTime: 90,
      weight: 2.5,
      imageUrl: null,
      thumbnailUrl: null,
      description: null,
      designers: ["Other"],
      artists: [],
      publishers: [],
      mechanics: ["Solo / Solitaire Game", "Hand Management"],
      categories: ["Solo / Solitaire Game"],
      languageDependence: null,
      bggRating: 7,
      bggRank: null,
      thingSyncedAt: now,
    });
    storage.games.upsertGame(storage.db, {
      bggId: 2,
      name: "Played Worker",
      yearPublished: 2018,
      minPlayers: 1,
      maxPlayers: 4,
      playingTime: 90,
      minPlayTime: 60,
      maxPlayTime: 120,
      weight: 3,
      imageUrl: null,
      thumbnailUrl: null,
      description: null,
      designers: ["Uwe Rosenberg"],
      artists: [],
      publishers: [],
      mechanics: ["Worker Placement", "Solo / Solitaire Game"],
      categories: ["Economic"],
      languageDependence: null,
      bggRating: 8,
      bggRank: null,
      thingSyncedAt: now,
    });
    storage.games.upsertGame(storage.db, {
      bggId: 30,
      name: "Wishlist Solo Tag",
      yearPublished: 2024,
      minPlayers: 1,
      maxPlayers: 1,
      playingTime: 40,
      minPlayTime: 30,
      maxPlayTime: 45,
      weight: 2,
      imageUrl: null,
      thumbnailUrl: null,
      description: null,
      designers: ["Uwe Rosenberg"],
      artists: [],
      publishers: [],
      mechanics: ["Solo / Solitaire Game", "Worker Placement"],
      categories: ["Economic"],
      languageDependence: null,
      bggRating: 7.5,
      bggRank: null,
      thingSyncedAt: now,
    });

    const result = queries.querySmartWishlist({ mode: "balance" });
    const item = result.localSuggestions.find((s) => s.bggId === 30);
    expect(item).toBeTruthy();
    const soloHeadline = item!.reasons.find((r) =>
      /solo|solitaire/i.test(r.headline),
    );
    expect(soloHeadline).toBeUndefined();
    expect(
      item!.reasons.some(
        (r) =>
          r.kind === "fit_designer" ||
          r.kind === "fit_mechanic" ||
          r.kind === "priority",
      ),
    ).toBe(true);
    expect(
      item!.reasons.some((r) => /juegas bastante/i.test(r.headline)),
    ).toBe(false);
  });

  it("scores discovery candidates with discovery_seed reason via attach", async () => {
    const { storage, db, queries } = createTestContext();
    const now = new Date().toISOString();
    seedCollection(storage, [
      entry({
        collId: 1,
        bggId: 1,
        name: "Owned",
        own: true,
        personalRating: 9,
        numPlays: 10,
      }),
    ]);
    storage.games.upsertGame(storage.db, {
      bggId: 1,
      name: "Owned",
      yearPublished: 2016,
      minPlayers: 1,
      maxPlayers: 4,
      playingTime: 90,
      minPlayTime: 60,
      maxPlayTime: 120,
      weight: 3,
      imageUrl: null,
      thumbnailUrl: null,
      description: null,
      designers: ["Uwe Rosenberg"],
      artists: [],
      publishers: [],
      mechanics: ["Worker Placement"],
      categories: ["Economic"],
      languageDependence: null,
      bggRating: 8,
      bggRank: null,
      thingSyncedAt: now,
    });

    const base = queries.querySmartWishlist({ mode: "balance" });
    const { attachDiscoverySuggestions } = await import(
      "../src/query/smart-wishlist.js"
    );
    const withDisc = attachDiscoverySuggestions(
      db,
      base,
      [
        {
          source: "discovery",
          bggId: 99,
          name: "New Rosenberg",
          thumbnailUrl: null,
          yearPublished: 2024,
          subtype: "boardgame",
          wishlistPriority: null,
          designers: ["Uwe Rosenberg"],
          mechanics: ["Worker Placement"],
          categories: ["Economic"],
          discoverySeed: "Uwe Rosenberg",
        },
      ],
      { mode: "balance", discoveryLimit: 5 },
    );
    expect(withDisc.discoveryStatus.available).toBe(true);
    expect(withDisc.discoverySuggestions[0]?.bggId).toBe(99);
    expect(
      withDisc.discoverySuggestions[0]?.reasons.some((r) => r.kind === "discovery_seed"),
    ).toBe(true);
  });

  it("hotness scout scores hot list against owned profile and skips owned", async () => {
    const { storage, db } = createTestContext();
    const now = new Date().toISOString();
    seedCollection(storage, [
      entry({
        collId: 1,
        bggId: 1,
        name: "Owned",
        own: true,
        personalRating: 9,
        numPlays: 10,
      }),
      entry({
        collId: 2,
        bggId: 50,
        name: "Already hot owned",
        own: true,
        personalRating: 8,
        numPlays: 3,
      }),
      entry({
        collId: 3,
        bggId: 99,
        name: "On wishlist",
        own: false,
        wishlist: true,
        wishlistPriority: 2,
      }),
    ]);
    for (const game of [
      {
        bggId: 1,
        name: "Owned",
        designers: ["Uwe Rosenberg"],
        mechanics: ["Worker Placement"],
        categories: ["Economic"],
      },
      {
        bggId: 50,
        name: "Already hot owned",
        designers: ["Other"],
        mechanics: ["Dice Rolling"],
        categories: ["Fantasy"],
      },
    ]) {
      storage.games.upsertGame(storage.db, {
        bggId: game.bggId,
        name: game.name,
        yearPublished: 2016,
        minPlayers: 1,
        maxPlayers: 4,
        playingTime: 90,
        minPlayTime: 60,
        maxPlayTime: 120,
        weight: 3,
        imageUrl: null,
        thumbnailUrl: null,
        description: null,
        designers: game.designers,
        artists: [],
        publishers: [],
        mechanics: game.mechanics,
        categories: game.categories,
        languageDependence: null,
        bggRating: 8,
        bggRank: null,
        thingSyncedAt: now,
      });
    }

    const { runHotnessScoutQuery } = await import(
      "../src/query/hotness-scout.js"
    );
    const result = await runHotnessScoutQuery(
      db,
      {
        fetchHotGameIds: async () => [50, 99, 100],
        fetchThings: async (ids) =>
          ids.map((id) => ({
            bggId: id,
            name: id === 99 ? "On wishlist" : "Brand new hot",
            yearPublished: 2024,
            thumbnailUrl: null,
            thingType: "boardgame",
            designers: id === 99 ? ["Uwe Rosenberg"] : ["Someone"],
            mechanics: ["Worker Placement"],
            categories: ["Economic"],
          })),
      },
      { mode: "balance", maxThings: 10, limit: 10 },
    );

    expect(result.status.ok).toBe(true);
    expect(result.alreadyOwnedSkipped).toBe(1);
    expect(result.suggestions.some((s) => s.bggId === 50)).toBe(false);
    expect(result.suggestions.some((s) => s.bggId === 99)).toBe(true);
    expect(
      result.suggestions
        .find((s) => s.bggId === 99)
        ?.reasons.some((r) => /wishlist/i.test(r.headline)),
    ).toBe(true);
  });
});

describe("reconcile app tables", () => {
  it("unions remote-only sessions/reviews and keeps both on conflict", async () => {
    const { copyFileSync } = await import("node:fs");
    const local = createTestContext();
    const remote = createTestContext();

    local.storage.duel.createDuelSession(local.db, {
      periodFrom: "2026-01-01",
      periodTo: "2026-01-31",
      minPlays: 1,
      remainingBggIds: [1, 2],
      startedAt: "2026-01-15T10:00:00.000Z",
      filtersJson: null,
    });
    remote.storage.duel.createDuelSession(remote.db, {
      periodFrom: "2026-02-01",
      periodTo: "2026-02-28",
      minPlays: 1,
      remainingBggIds: [3, 4],
      startedAt: "2026-02-15T10:00:00.000Z",
      filtersJson: null,
    });
    // Same stable key, different content → conflict
    const conflictLocal = local.storage.duel.createDuelSession(local.db, {
      periodFrom: "2026-03-01",
      periodTo: "2026-03-31",
      minPlays: 2,
      remainingBggIds: [5],
      startedAt: "2026-03-10T10:00:00.000Z",
      filtersJson: '{"x":1}',
    });
    local.storage.duel.insertDuelRound(local.db, {
      sessionId: conflictLocal.id,
      roundNumber: 1,
      candidateABggId: 5,
      candidateBBggId: 6,
      winnerBggId: 5,
      decidedAt: "2026-03-10T11:00:00.000Z",
    });
    const conflictRemote = remote.storage.duel.createDuelSession(remote.db, {
      periodFrom: "2026-03-01",
      periodTo: "2026-03-31",
      minPlays: 2,
      remainingBggIds: [5, 6],
      startedAt: "2026-03-10T10:00:00.000Z",
      filtersJson: '{"x":1}',
    });
    remote.storage.duel.insertDuelRound(remote.db, {
      sessionId: conflictRemote.id,
      roundNumber: 1,
      candidateABggId: 5,
      candidateBBggId: 6,
      winnerBggId: 6,
      decidedAt: "2026-03-10T11:00:00.000Z",
    });

    remote.storage.purchaseReviews.insertPurchaseReview(remote.db, {
      bggId: 99,
      notes: "from fly",
      decision: "interesado",
      overlapScore: 0.5,
      snapshot: { ok: true },
    });

    local.db.close();
    remote.db.close();

    const {
      unionAppTablesInto,
      compareAppDatabases,
      assertNoAppDataLoss,
    } = await import("../src/storage/reconcile-app-tables.js");

    const report = compareAppDatabases(
      local.dbPath,
      remote.dbPath,
      "local",
      "remote",
    );
    expect(report.sessionsOnlyRight).toBeGreaterThanOrEqual(1);
    expect(report.sessionConflicts).toBeGreaterThanOrEqual(1);
    expect(report.reviewsOnlyRight).toBe(1);

    const merge = unionAppTablesInto(local.dbPath, remote.dbPath);
    expect(merge.sessionsInserted).toBeGreaterThanOrEqual(2);
    expect(merge.conflictsKeptBoth).toBeGreaterThanOrEqual(1);
    expect(merge.reviewsInserted).toBe(1);

    expect(assertNoAppDataLoss(local.dbPath, remote.dbPath).ok).toBe(true);

    const mergedPath = join(local.dir, "merged.db");
    copyFileSync(local.dbPath, mergedPath);
    expect(assertNoAppDataLoss(mergedPath, remote.dbPath).ok).toBe(true);
  });
});
