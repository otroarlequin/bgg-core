import { readFileSync } from "node:fs";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type { CollectionEntry } from "../src/domain/types.js";
import { queryWishlistStoreMatch } from "../src/query/wishlist-store-match.js";
import { createDatabase, createStorageService } from "../src/storage/index.js";
import {
  parseGameNerdzSearchJson,
  parseMiniatureMarketManufacturer,
  parseMiniatureMarketSuggestHtml,
} from "../src/stores/parsers.js";
import type { StoreOffer } from "../src/stores/types.js";
import {
  TITLE_AMBIGUOUS_MIN,
  TITLE_MATCH_THRESHOLD,
  applyPublisherSignal,
  buildSearchQuery,
  normalizeTitle,
  scoreTitleMatch,
} from "../src/utils/title-match.js";

const fixturesDir = join(
  dirname(fileURLToPath(import.meta.url)),
  "fixtures",
  "stores",
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

function offer(partial: Partial<StoreOffer> & Pick<StoreOffer, "store" | "name" | "url">): StoreOffer {
  return {
    price: 29.99,
    currency: "USD",
    sku: null,
    inStock: true,
    publisher: null,
    ...partial,
  };
}

describe("store parsers (fixtures, offline)", () => {
  it("parses Game Nerdz StorePass JSON including publishers", () => {
    const raw = JSON.parse(
      readFileSync(join(fixturesDir, "gamenerdz-search.json"), "utf8"),
    );
    const offers = parseGameNerdzSearchJson(raw);
    expect(offers).toHaveLength(2);
    expect(offers[0]).toMatchObject({
      store: "gamenerdz",
      name: "Wingspan",
      price: 49.99,
      currency: "USD",
      url: "https://www.gamenerdz.com/wingspan",
      sku: "STM900",
      inStock: true,
      publisher: "Stonemaier Games",
    });
    expect(offers[1].inStock).toBe(false);
    expect(offers[1].name).toBe("Wingspan: European Expansion");
    expect(offers[1].publisher).toBe("Stonemaier Games");
  });

  it("parses Miniature Market suggest HTML", () => {
    const html = readFileSync(
      join(fixturesDir, "miniaturemarket-suggest.html"),
      "utf8",
    );
    const offers = parseMiniatureMarketSuggestHtml(html);
    expect(offers).toHaveLength(3);
    expect(offers[0]).toMatchObject({
      store: "miniaturemarket",
      name: "Wingspan",
      price: 44.99,
      url: "https://www.miniaturemarket.com/wingspan.html",
      inStock: true,
      publisher: null,
    });
    expect(offers[1].inStock).toBe(false);
    expect(offers[1].name).toContain("Preorder");
    expect(offers[2].url).toBe(
      "https://www.miniaturemarket.com/ark-nova.html",
    );
  });

  it("parses Manufacturer from MM product details HTML", () => {
    const html = readFileSync(
      join(fixturesDir, "miniaturemarket-product.html"),
      "utf8",
    );
    expect(parseMiniatureMarketManufacturer(html)).toBe("Synapses Games");
  });
});

describe("title-match", () => {
  it("scores exact and near matches", () => {
    expect(scoreTitleMatch("Wingspan", "Wingspan")).toBe(1);
    expect(scoreTitleMatch("Wingspan", "Wingspan Board Game")).toBeGreaterThanOrEqual(
      TITLE_MATCH_THRESHOLD,
    );
    expect(scoreTitleMatch("Ark Nova", "Ark Nova")).toBe(1);
    expect(scoreTitleMatch("Compile: Main 2", "Compile: Main 2")).toBe(1);
    expect(normalizeTitle("Café")).toBe("cafe");
  });

  it("rejects edition / short-title false positives", () => {
    expect(scoreTitleMatch("Compile: Main 2", "Compile: Main 1")).toBeLessThan(
      TITLE_AMBIGUOUS_MIN,
    );
    expect(
      scoreTitleMatch("Rum", "Bones Black: Skeletal Rum Runners"),
    ).toBeLessThan(TITLE_AMBIGUOUS_MIN);
    expect(
      scoreTitleMatch(
        "Rum",
        "Runnin Rum & Speakin Easy RPG Cinematic Adventure",
      ),
    ).toBeLessThan(TITLE_AMBIGUOUS_MIN);
  });

  it("marks weak similarity below ambiguous band", () => {
    expect(scoreTitleMatch("Wingspan", "Catan")).toBeLessThan(TITLE_AMBIGUOUS_MIN);
  });

  it("applyPublisherSignal boosts match and caps conflict", () => {
    expect(
      applyPublisherSignal(0.85, ["Stonemaier Games"], "Stonemaier Games"),
    ).toBeGreaterThanOrEqual(TITLE_MATCH_THRESHOLD);
    expect(
      applyPublisherSignal(0.94, ["Synapses Games"], "Greater Than Games, LLC"),
    ).toBeLessThan(TITLE_MATCH_THRESHOLD);
    expect(applyPublisherSignal(0.94, ["Synapses Games"], null)).toBe(0.94);
  });

  it("buildSearchQuery drops subtitle noise", () => {
    expect(buildSearchQuery("Brass: Birmingham")).toBe("Brass");
    expect(buildSearchQuery("Gloomhaven — Forgotten Circles")).toBe(
      "Gloomhaven",
    );
  });
});

describe("queryWishlistStoreMatch cache + match", () => {
  it("matches wishlist items via mock searchers and reuses cache", async () => {
    const dir = mkdtempSync(join(tmpdir(), "bgg-store-match-"));
    const db = createDatabase(join(dir, "test.db"));
    const storage = createStorageService(db);

    storage.collection.upsertCollectionEntries(storage.db, [
      entry({
        collId: 1,
        bggId: 266192,
        name: "Wingspan",
        wishlist: true,
        wishlistPriority: 1,
      }),
      entry({
        collId: 2,
        bggId: 999,
        name: "Totally Unknown Game XYZ",
        wishlist: true,
        wishlistPriority: 2,
      }),
    ]);

    const gnOffers: StoreOffer[] = [
      offer({
        store: "gamenerdz",
        name: "Wingspan",
        price: 49.99,
        url: "https://www.gamenerdz.com/wingspan",
        sku: "STM900",
        publisher: "Stonemaier Games",
      }),
    ];
    const mmOffers: StoreOffer[] = [
      offer({
        store: "miniaturemarket",
        name: "Wingspan",
        price: 44.99,
        url: "https://www.miniaturemarket.com/wingspan.html",
        sku: "wingspan.html",
        publisher: "Stonemaier Games",
      }),
    ];

    let gnCalls = 0;
    let mmCalls = 0;

    const first = await queryWishlistStoreMatch(db, {
      maxItems: 10,
      searchers: {
        gamenerdz: async () => {
          gnCalls += 1;
          return gnOffers;
        },
        miniaturemarket: async () => {
          mmCalls += 1;
          return mmOffers;
        },
      },
    });

    expect(first.scanned).toBe(2);
    expect(first.networkCalls).toBe(4);
    expect(first.cacheHits).toBe(0);
    expect(first.matches).toHaveLength(1);
    expect(first.matches[0].name).toBe("Wingspan");
    expect(first.matches[0].offers).toHaveLength(2);
    expect(first.noOffer).toBe(1);
    expect(gnCalls).toBe(2);
    expect(mmCalls).toBe(2);

    const second = await queryWishlistStoreMatch(db, {
      maxItems: 10,
      searchers: {
        gamenerdz: async () => {
          gnCalls += 1;
          return gnOffers;
        },
        miniaturemarket: async () => {
          mmCalls += 1;
          return mmOffers;
        },
      },
    });

    expect(second.cacheHits).toBe(4);
    expect(second.networkCalls).toBe(0);
    expect(gnCalls).toBe(2);
    expect(mmCalls).toBe(2);
    expect(second.matches[0].offers.some((o) => o.store === "miniaturemarket")).toBe(
      true,
    );
  });

  it("records store errors without aborting the other store", async () => {
    const dir = mkdtempSync(join(tmpdir(), "bgg-store-err-"));
    const db = createDatabase(join(dir, "test.db"));
    const storage = createStorageService(db);

    storage.collection.upsertCollectionEntries(storage.db, [
      entry({
        collId: 1,
        bggId: 1,
        name: "Ark Nova",
        wishlist: true,
        wishlistPriority: 1,
      }),
    ]);

    const result = await queryWishlistStoreMatch(db, {
      stores: ["gamenerdz", "miniaturemarket"],
      maxItems: 5,
      forceRefresh: true,
      searchers: {
        gamenerdz: async () => {
          throw new Error("GN blocked");
        },
        miniaturemarket: async () => [
          offer({
            store: "miniaturemarket",
            name: "Ark Nova",
            price: 54.99,
            url: "https://www.miniaturemarket.com/ark-nova.html",
          }),
        ],
      },
    });

    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].store).toBe("gamenerdz");
    expect(result.matches).toHaveLength(1);
    expect(result.matches[0].offers[0].store).toBe("miniaturemarket");
  });

  it("does not strong-match wrong edition or publisher conflict", async () => {
    const dir = mkdtempSync(join(tmpdir(), "bgg-store-fp-"));
    const db = createDatabase(join(dir, "test.db"));
    const storage = createStorageService(db);
    const now = new Date().toISOString();

    storage.collection.upsertCollectionEntries(storage.db, [
      entry({
        collId: 1,
        bggId: 440606,
        name: "Compile: Main 2",
        wishlist: true,
        wishlistPriority: 1,
      }),
      entry({
        collId: 2,
        bggId: 192827,
        name: "Rum",
        wishlist: true,
        wishlistPriority: 2,
      }),
    ]);

    storage.games.upsertGame(storage.db, {
      bggId: 440606,
      name: "Compile: Main 2",
      yearPublished: 2025,
      minPlayers: 2,
      maxPlayers: 2,
      playingTime: 30,
      minPlayTime: 20,
      maxPlayTime: 30,
      weight: 2.3,
      imageUrl: null,
      thumbnailUrl: null,
      description: null,
      designers: ["Michael Yang"],
      artists: [],
      publishers: ["Synapses Games"],
      mechanics: [],
      categories: [],
      languageDependence: null,
      bggRating: 8,
      bggRank: null,
      thingSyncedAt: now,
    });

    const result = await queryWishlistStoreMatch(db, {
      maxItems: 10,
      forceRefresh: true,
      searchers: {
        gamenerdz: async (query) => {
          if (/compile/i.test(query)) {
            return [
              offer({
                store: "gamenerdz",
                name: "Compile: Main 1",
                url: "https://www.gamenerdz.com/compile-main-1",
                publisher: "Greater Than Games, LLC",
              }),
            ];
          }
          if (/rum/i.test(query)) {
            return [
              offer({
                store: "gamenerdz",
                name: "Runnin Rum & Speakin Easy RPG",
                url: "https://www.gamenerdz.com/runnin-rum",
                publisher: "Evil Genius Games",
              }),
            ];
          }
          return [];
        },
        miniaturemarket: async (query) => {
          if (/rum/i.test(query)) {
            return [
              offer({
                store: "miniaturemarket",
                name: "Bones Black: Skeletal Rum Runners",
                url: "https://www.miniaturemarket.com/bones-rum.html",
                publisher: "Reaper Miniatures",
              }),
            ];
          }
          return [];
        },
      },
    });

    expect(result.matches).toHaveLength(0);
    expect(result.noOffer + result.ambiguous.length).toBe(2);
  });
});
