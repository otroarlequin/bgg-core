import { readFileSync } from "node:fs";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { createActivityContext } from "../src/activities/context.js";
import { runInsights } from "../src/activities/insights/index.js";
import {
  fetchBrowseTop100,
  parseBrowseBoardgameHtml,
} from "../src/bgg/browse-ranks.js";
import type { CollectionEntry, Game, Play, PlayPlayer } from "../src/domain/types.js";
import { buildTop100Section, queryInsights } from "../src/query/insights.js";
import { createDatabase, createStorageService } from "../src/storage/index.js";
import { setStoredBggUsername } from "../src/storage/repos/app-settings.js";
import {
  countCollectionStatusEvents,
  listAggregatedCollectionFlags,
  listCollectionStatusEvents,
  recordCollectionStatusEvents,
} from "../src/storage/repos/collection-status-events.js";

const fixturesDir = join(
  dirname(fileURLToPath(import.meta.url)),
  "fixtures",
  "bgg",
);

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

function game(partial: Partial<Game> & Pick<Game, "bggId" | "name">): Game {
  return {
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
    designers: [],
    artists: [],
    publishers: [],
    mechanics: ["Hand Management"],
    categories: ["Strategy"],
    languageDependence: null,
    bggRating: 8,
    bggRank: null,
    thingSyncedAt: new Date().toISOString(),
    ...partial,
  };
}

function play(
  partial: Partial<Play> & Pick<Play, "playId" | "bggId" | "date">,
): Play {
  return {
    gameName: "Game",
    quantity: 1,
    length: 60,
    location: "Casa",
    incomplete: false,
    nowinstats: false,
    comments: null,
    syncedAt: new Date().toISOString(),
    ...partial,
  };
}

function player(
  playId: number,
  name: string,
  username = "",
  win = false,
): PlayPlayer {
  return {
    playId,
    username,
    userid: null,
    name,
    score: "",
    win,
    color: "",
    rating: null,
  };
}

describe("parseBrowseBoardgameHtml", () => {
  it("extracts rank, id, name and thumbnail", () => {
    const html = readFileSync(join(fixturesDir, "browse-boardgame.html"), "utf8");
    const items = parseBrowseBoardgameHtml(html);
    expect(items).toHaveLength(3);
    expect(items[0]).toMatchObject({
      rank: 1,
      bggId: 224517,
      name: "Brass: Birmingham",
      thumbnailUrl: "https://cf.geekdo-images.com/brass.jpg",
    });
    expect(items[2].bggId).toBe(174430);
  });

  it("merges two browse pages and caps at rank 100", async () => {
    const page1 = parseBrowseBoardgameHtml(
      readFileSync(join(fixturesDir, "browse-boardgame.html"), "utf8"),
    );
    const items = await fetchBrowseTop100(async (page) => {
      if (page === 1) {
        return readFileSync(join(fixturesDir, "browse-boardgame.html"), "utf8");
      }
      return `
        <td class="collection_rank"><a name="4"></a>
        <a href="/boardgame/123/foo" class="primary">Foo</a>
        <img src="https://cf.geekdo-images.com/foo.jpg" alt="Foo"></td>`;
    });
    expect(items.length).toBeGreaterThanOrEqual(page1.length);
    expect(items.some((item) => item.bggId === 123)).toBe(true);
    expect(items.every((item) => item.rank <= 100)).toBe(true);
  });
});

describe("collection status events", () => {
  it("writes baseline once and diffs later flag changes", () => {
    const dir = mkdtempSync(join(tmpdir(), "bgg-insights-"));
    const db = createDatabase(join(dir, "test.db"));
    const storage = createStorageService(db);

    storage.collection.upsertCollectionEntries(storage.db, [
      entry({ collId: 1, bggId: 10, name: "Wingspan", wishlist: true }),
      entry({ collId: 2, bggId: 20, name: "Brass", own: true }),
    ]);
    const first = recordCollectionStatusEvents(
      db,
      new Map(),
      "2026-01-01T00:00:00.000Z",
    );
    expect(first.baseline).toBe(true);
    expect(first.inserted).toBe(2);
    expect(countCollectionStatusEvents(db)).toBe(2);
    expect(
      listCollectionStatusEvents(db).every((e) => e.source === "baseline"),
    ).toBe(true);

    const previous = listAggregatedCollectionFlags(db);
    storage.collection.upsertCollectionEntries(storage.db, [
      entry({ collId: 1, bggId: 10, name: "Wingspan", own: true }),
    ]);
    const second = recordCollectionStatusEvents(
      db,
      previous,
      "2026-03-01T00:00:00.000Z",
    );
    expect(second.baseline).toBe(false);
    expect(second.inserted).toBe(1);
    const syncs = listCollectionStatusEvents(db).filter((e) => e.source === "sync");
    expect(syncs).toHaveLength(1);
    expect(syncs[0]?.bggId).toBe(10);
    expect(syncs[0]?.own).toBe(true);
  });
});

describe("queryInsights", () => {
  it("builds yearly series, debuts, companions and weight", () => {
    const dir = mkdtempSync(join(tmpdir(), "bgg-insights-q-"));
    const db = createDatabase(join(dir, "test.db"));
    const storage = createStorageService(db);
    setStoredBggUsername(db, "santi");

    storage.games.upsertGame(
      db,
      game({
        bggId: 10,
        name: "Wingspan",
        weight: 2.4,
        mechanics: ["Hand Management"],
        categories: ["Animals"],
        thumbnailUrl: "http://example.com/w.jpg",
      }),
    );
    storage.games.upsertGame(
      db,
      game({
        bggId: 20,
        name: "Brass",
        weight: 3.9,
        mechanics: ["Network Building"],
        categories: ["Economic"],
      }),
    );
    storage.collection.upsertCollectionEntries(storage.db, [
      entry({
        collId: 1,
        bggId: 10,
        name: "Wingspan",
        own: true,
        numPlays: 2,
        thumbnailUrl: "http://example.com/w.jpg",
      }),
      entry({
        collId: 2,
        bggId: 30,
        name: "Shame",
        own: true,
        numPlays: 0,
      }),
    ]);

    storage.plays.upsertPlays(storage.db, [
      {
        play: play({
          playId: 1,
          bggId: 10,
          gameName: "Wingspan",
          date: "2024-05-01",
          length: 60,
        }),
        players: [player(1, "Santi", "santi"), player(1, "Ana", "ana", true)],
      },
      {
        play: play({
          playId: 2,
          bggId: 10,
          gameName: "Wingspan",
          date: "2025-02-01",
          length: 90,
        }),
        players: [player(2, "Santi", "santi"), player(2, "Ana", "ana")],
      },
      {
        play: play({
          playId: 3,
          bggId: 20,
          gameName: "Brass",
          date: "2025-06-01",
          length: 120,
        }),
        players: [player(3, "Santi", "santi")],
      },
    ]);

    const all = queryInsights(db);
    expect(all.years).toEqual([2024, 2025]);
    expect(all.yearly[0]?.debuts).toBe(1);
    expect(all.yearly[1]?.debuts).toBe(1);
    expect(all.selected.plays).toBe(3);
    expect(all.selected.unplayedOwned.count).toBe(1);
    expect(all.players.companions[0]?.displayName).toBe("Ana");
    expect(all.players.companions[0]?.playsTogether).toBe(2);
    expect(all.players.companions.some((c) => c.username === "santi")).toBe(
      false,
    );
    expect(all.players.playerCounts.find((b) => b.id === "2")?.plays).toBe(2);
    expect(all.players.playerCounts.find((b) => b.id === "1")?.plays).toBe(1);
    expect(all.players.avgWeight).not.toBeNull();
    expect(all.curiosities.mostPlayed?.bggId).toBe(10);
    expect(all.curiosities.topMechanic?.name).toBe("Hand Management");

    const y2025 = queryInsights(db, { year: 2025 });
    expect(y2025.selectedYear).toBe(2025);
    expect(y2025.selected.plays).toBe(2);
    expect(y2025.selected.debuts).toHaveLength(1);
    expect(y2025.selected.debuts[0]?.bggId).toBe(20);
  });

  it("only computes wishlist-to-owned after a tracked sync transition", () => {
    const dir = mkdtempSync(join(tmpdir(), "bgg-insights-t-"));
    const db = createDatabase(join(dir, "test.db"));
    const storage = createStorageService(db);

    storage.collection.upsertCollectionEntries(storage.db, [
      entry({ collId: 1, bggId: 10, name: "Wingspan", wishlist: true }),
    ]);
    recordCollectionStatusEvents(db, new Map(), "2026-01-01T00:00:00.000Z");

    const afterBaseline = queryInsights(db);
    expect(afterBaseline.selected.ownedThisPeriod).toHaveLength(0);
    expect(afterBaseline.selected.trackingSince).toBe("2026-01-01T00:00:00.000Z");

    const previous = listAggregatedCollectionFlags(db);
    storage.collection.upsertCollectionEntries(storage.db, [
      entry({ collId: 1, bggId: 10, name: "Wingspan", own: true }),
    ]);
    recordCollectionStatusEvents(db, previous, "2026-04-01T00:00:00.000Z");

    storage.plays.upsertPlays(storage.db, [
      {
        play: play({
          playId: 9,
          bggId: 10,
          gameName: "Wingspan",
          date: "2026-04-20",
        }),
        players: [player(9, "Santi", "santi")],
      },
    ]);

    const afterSync = queryInsights(db, { year: 2026 });
    expect(afterSync.selected.ownedThisPeriod).toHaveLength(1);
    const transition = afterSync.selected.ownedThisPeriod[0]!;
    expect(transition.daysWishlistToOwned).toBeNull();
    expect(transition.daysOwnedToFirstPlay).toBe(19);
  });

  it("measures wishlist-to-owned when both edges are sync events", () => {
    const dir = mkdtempSync(join(tmpdir(), "bgg-insights-w-"));
    const db = createDatabase(join(dir, "test.db"));
    const storage = createStorageService(db);

    storage.collection.upsertCollectionEntries(storage.db, [
      entry({ collId: 1, bggId: 10, name: "Wingspan" }),
    ]);
    recordCollectionStatusEvents(db, new Map(), "2026-01-01T00:00:00.000Z");

    let previous = listAggregatedCollectionFlags(db);
    storage.collection.upsertCollectionEntries(storage.db, [
      entry({ collId: 1, bggId: 10, name: "Wingspan", wishlist: true }),
    ]);
    recordCollectionStatusEvents(db, previous, "2026-02-01T00:00:00.000Z");

    previous = listAggregatedCollectionFlags(db);
    storage.collection.upsertCollectionEntries(storage.db, [
      entry({ collId: 1, bggId: 10, name: "Wingspan", own: true }),
    ]);
    recordCollectionStatusEvents(db, previous, "2026-03-03T00:00:00.000Z");

    const result = queryInsights(db);
    expect(result.selected.ownedThisPeriod[0]?.daysWishlistToOwned).toBe(30);
  });
});

describe("runInsights top 100", () => {
  it("marks owned games on the mosaic and uses injected browse", async () => {
    const dir = mkdtempSync(join(tmpdir(), "bgg-insights-top-"));
    const db = createDatabase(join(dir, "test.db"));
    const storage = createStorageService(db);
    storage.collection.upsertCollectionEntries(storage.db, [
      entry({
        collId: 1,
        bggId: 224517,
        name: "Brass: Birmingham",
        own: true,
        thumbnailUrl: "http://local/brass.jpg",
      }),
    ]);

    const html = readFileSync(join(fixturesDir, "browse-boardgame.html"), "utf8");
    const ctx = createActivityContext({ db });
    const result = await runInsights(
      { fetchBrowsePage: async () => html },
      ctx,
    );
    expect(result.top100.items).toHaveLength(3);
    expect(result.top100.owned).toBe(1);
    const brass = result.top100.items.find((item) => item.bggId === 224517);
    expect(brass?.owned).toBe(true);
    expect(brass?.thumbnailUrl).toBe("http://local/brass.jpg");

    const merged = buildTop100Section(
      db,
      parseBrowseBoardgameHtml(html),
      "now",
    );
    expect(merged.owned).toBe(1);
  });
});
