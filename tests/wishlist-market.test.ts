import { readFileSync } from "node:fs";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type { CollectionEntry } from "../src/domain/types.js";
import {
  parseMarketplaceThingPayload,
  type MarketListing,
} from "../src/bgg/marketplace.js";
import {
  filterAndSortListings,
  queryWishlistMarket,
  sortMarketMatches,
} from "../src/query/wishlist-market.js";
import { createDatabase, createStorageService } from "../src/storage/index.js";
import {
  countUnreadMarketAlerts,
  insertMarketAlertIfNew,
} from "../src/storage/repos/market-alerts.js";
import { upsertMarketPriceWatch } from "../src/storage/repos/market-price-watches.js";

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

describe("marketplace parser (fixture)", () => {
  it("parses thing marketplace listings", () => {
    const raw = JSON.parse(
      readFileSync(join(fixturesDir, "marketplace-thing.json"), "utf8"),
    );
    const results = parseMarketplaceThingPayload(raw);
    expect(results).toHaveLength(3);
    expect(results[0].name).toBe("Wingspan");
    expect(results[0].listings).toHaveLength(3);
    expect(results[0].listings[0].listingKey).toBe("111");
    expect(results[0].listings[2].url).toBe(
      "https://boardgamegeek.com/market/product/333",
    );
    expect(results[1].listings).toHaveLength(0);
    expect(results[2].listings).toHaveLength(1);
    expect(results[2].listings[0].listingKey).toBe("999");
  });
});

describe("filterAndSortListings", () => {
  const sample: MarketListing[] = [
    {
      listingKey: "a",
      price: 50,
      currency: "USD",
      condition: "new",
      listDate: "2025-01-02",
      notes: null,
      url: "https://boardgamegeek.com/geekmarket/product/a",
    },
    {
      listingKey: "b",
      price: 30,
      currency: "USD",
      condition: "verygood",
      listDate: "2025-01-03",
      notes: null,
      url: "https://boardgamegeek.com/geekmarket/product/b",
    },
    {
      listingKey: "c",
      price: 40,
      currency: "EUR",
      condition: "new",
      listDate: "2025-01-01",
      notes: null,
      url: "https://boardgamegeek.com/geekmarket/product/c",
    },
  ];

  it("sorts by price ascending by default", () => {
    const sorted = filterAndSortListings(sample, { sortBy: "priceAsc" });
    expect(sorted.map((l) => l.listingKey)).toEqual(["b", "c", "a"]);
  });

  it("sorts games by wishlist priority (interest)", () => {
    const matches = sortMarketMatches(
      [
        {
          bggId: 2,
          name: "Beta",
          thumbnailUrl: null,
          wishlistPriority: 3,
          listings: [
            {
              listingKey: "b",
              price: 10,
              currency: "USD",
              condition: "new",
              listDate: null,
              notes: null,
              url: "https://example.com/b",
            },
          ],
        },
        {
          bggId: 1,
          name: "Alpha",
          thumbnailUrl: null,
          wishlistPriority: 1,
          listings: [
            {
              listingKey: "a",
              price: 90,
              currency: "USD",
              condition: "new",
              listDate: null,
              notes: null,
              url: "https://example.com/a",
            },
          ],
        },
      ],
      "priority",
    );
    expect(matches.map((m) => m.bggId)).toEqual([1, 2]);
  });

  it("filters by condition and maxPrice", () => {
    const filtered = filterAndSortListings(sample, {
      conditions: ["new"],
      maxPrice: 45,
      sortBy: "priceAsc",
    });
    expect(filtered).toHaveLength(1);
    expect(filtered[0].listingKey).toBe("c");
  });
});

describe("queryWishlistMarket alerts + cache", () => {
  it("caches listings and only alerts for price watches", async () => {
    const dir = mkdtempSync(join(tmpdir(), "bgg-market-"));
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
    ]);

    const listings: MarketListing[] = [
      {
        listingKey: "111",
        price: 45,
        currency: "USD",
        condition: "new",
        listDate: null,
        notes: null,
        url: "https://boardgamegeek.com/geekmarket/product/111",
      },
      {
        listingKey: "222",
        price: 39.5,
        currency: "USD",
        condition: "verygood",
        listDate: null,
        notes: null,
        url: "https://boardgamegeek.com/geekmarket/product/222",
      },
    ];

    let fetchCalls = 0;
    const first = await queryWishlistMarket(db, {
      maxItems: 10,
      sortBy: "priceAsc",
      fetchMarket: async () => {
        fetchCalls += 1;
        return [{ bggId: 266192, name: "Wingspan", listings }];
      },
    });

    expect(fetchCalls).toBe(1);
    expect(first.matches).toHaveLength(1);
    expect(first.matches[0].listings[0].price).toBe(39.5);
    expect(first.newAlerts).toBe(0);
    expect(countUnreadMarketAlerts(db)).toBe(0);

    const second = await queryWishlistMarket(db, {
      maxItems: 10,
      sortBy: "priceAsc",
      fetchMarket: async () => {
        fetchCalls += 1;
        return [{ bggId: 266192, name: "Wingspan", listings }];
      },
    });

    expect(fetchCalls).toBe(1);
    expect(second.cacheHits).toBe(1);
    expect(second.networkCalls).toBe(0);
    expect(second.newAlerts).toBe(0);

    upsertMarketPriceWatch(db, {
      bggId: 266192,
      maxPrice: 50,
      tolerancePct: 10,
      currency: "USD",
    });

    const watched = await queryWishlistMarket(db, {
      maxItems: 10,
      cacheOnly: true,
    });
    expect(watched.newAlerts).toBe(2);
    expect(countUnreadMarketAlerts(db)).toBe(2);

    const insertedAgain = insertMarketAlertIfNew(db, {
      bggId: 266192,
      listingKey: "111",
      gameName: "Wingspan",
      price: 45,
      currency: "USD",
      condition: "new",
      url: listings[0].url,
    });
    expect(insertedAgain).toBe(false);

    const withNew = await queryWishlistMarket(db, {
      maxItems: 10,
      forceRefresh: true,
      fetchMarket: async () => [
        {
          bggId: 266192,
          name: "Wingspan",
          listings: [
            ...listings,
            {
              listingKey: "999",
              price: 20,
              currency: "USD",
              condition: "new",
              listDate: null,
              notes: null,
              url: "https://boardgamegeek.com/geekmarket/product/999",
            },
          ],
        },
      ],
    });
    expect(withNew.newAlerts).toBe(1);
    expect(countUnreadMarketAlerts(db)).toBe(3);
  });

  it("cacheOnly never calls fetchMarket", async () => {
    const dir = mkdtempSync(join(tmpdir(), "bgg-market-co-"));
    const db = createDatabase(join(dir, "test.db"));
    const storage = createStorageService(db);
    storage.collection.upsertCollectionEntries(storage.db, [
      entry({
        collId: 1,
        bggId: 1,
        name: "Test",
        wishlist: true,
        wishlistPriority: 1,
      }),
    ]);

    let called = false;
    const result = await queryWishlistMarket(db, {
      cacheOnly: true,
      fetchMarket: async () => {
        called = true;
        return [];
      },
    });
    expect(called).toBe(false);
    expect(result.networkCalls).toBe(0);
    expect(result.matches).toHaveLength(0);
  });
});
