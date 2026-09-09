import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import type { MarketListing } from "../src/bgg/marketplace.js";
import {
  effectivePriceCeiling,
  listingMatchesWatch,
  runMarketWatchCron,
} from "../src/query/market-price-watch.js";
import { createDatabase } from "../src/storage/index.js";
import {
  upsertMarketPriceWatch,
  deleteMarketPriceWatch,
  getMarketPriceWatch,
} from "../src/storage/repos/market-price-watches.js";
import {
  setMarketWatchCronEnabled,
  setNotifyEmail,
} from "../src/storage/repos/notification-settings.js";
import { hasWatchNotification } from "../src/storage/repos/market-watch-notifications.js";
import { countUnreadMarketAlerts } from "../src/storage/repos/market-alerts.js";

function listing(
  partial: Partial<MarketListing> & Pick<MarketListing, "listingKey" | "price">,
): MarketListing {
  return {
    currency: "USD",
    condition: "new",
    listDate: null,
    notes: null,
    url: `https://boardgamegeek.com/market/product/${partial.listingKey}`,
    ...partial,
  };
}

describe("effectivePriceCeiling", () => {
  it("adds tolerance percent", () => {
    expect(effectivePriceCeiling(50, 10)).toBe(55);
    expect(effectivePriceCeiling(100, 5)).toBe(105);
  });
});

describe("listingMatchesWatch", () => {
  const watch = { maxPrice: 50, tolerancePct: 10, currency: "USD" };

  it("matches at ceiling with tolerance", () => {
    expect(listingMatchesWatch(listing({ listingKey: "1", price: 55 }), watch)).toBe(
      true,
    );
  });

  it("rejects just above ceiling", () => {
    expect(
      listingMatchesWatch(listing({ listingKey: "2", price: 55.01 }), watch),
    ).toBe(false);
  });

  it("rejects other currency", () => {
    expect(
      listingMatchesWatch(
        listing({ listingKey: "3", price: 40, currency: "EUR" }),
        watch,
      ),
    ).toBe(false);
  });

  it("rejects null price", () => {
    expect(
      listingMatchesWatch(
        listing({ listingKey: "4", price: null as unknown as number }),
        watch,
      ),
    ).toBe(false);
  });
});

describe("market price watch CRUD", () => {
  it("upserts, patches and deletes", () => {
    const db = createDatabase(
      join(mkdtempSync(join(tmpdir(), "bgg-watch-")), "test.db"),
    );
    db.exec(
      `INSERT INTO collection_entries (coll_id, bgg_id, name, subtype, wishlist, synced_at)
       VALUES (1, 123, 'Test Game', 'boardgame', 1, datetime('now'))`,
    );

    const created = upsertMarketPriceWatch(db, {
      bggId: 123,
      maxPrice: 50,
      tolerancePct: 10,
      currency: "USD",
    });
    expect(created.maxPrice).toBe(50);
    expect(created.tolerancePct).toBe(10);

    const updated = upsertMarketPriceWatch(db, {
      bggId: 123,
      maxPrice: 45,
      tolerancePct: 15,
    });
    expect(updated.maxPrice).toBe(45);
    expect(updated.tolerancePct).toBe(15);

    expect(deleteMarketPriceWatch(db, 123)).toBe(true);
    expect(getMarketPriceWatch(db, 123)).toBeNull();
  });
});

describe("runMarketWatchCron", () => {
  it("creates alerts and dedupes on second run", async () => {
    const db = createDatabase(
      join(mkdtempSync(join(tmpdir(), "bgg-cron-")), "test.db"),
    );
    db.exec(
      `INSERT INTO collection_entries (coll_id, bgg_id, name, subtype, wishlist, synced_at)
       VALUES (1, 266192, 'Wingspan', 'boardgame', 1, datetime('now'))`,
    );
    upsertMarketPriceWatch(db, {
      bggId: 266192,
      maxPrice: 50,
      tolerancePct: 10,
      currency: "USD",
    });
    setMarketWatchCronEnabled(db, true);

    const fetchMarket = vi.fn(async () => [
      {
        bggId: 266192,
        name: "Wingspan",
        listings: [
          listing({ listingKey: "111", price: 54 }),
          listing({ listingKey: "222", price: 60 }),
        ],
      },
    ]);

    const sendDigest = vi.fn(async () => {});

    const first = await runMarketWatchCron(db, {
      fetchMarket,
      sendDigest,
      force: true,
    });
    expect(first.ok).toBe(true);
    expect(first.listingsMatched).toBe(1);
    expect(first.newAlerts).toBe(1);
    expect(countUnreadMarketAlerts(db)).toBe(1);
    expect(hasWatchNotification(db, 266192, "111")).toBe(true);

    const second = await runMarketWatchCron(db, {
      fetchMarket,
      sendDigest,
      force: true,
    });
    expect(second.newAlerts).toBe(0);
    expect(fetchMarket).toHaveBeenCalledTimes(1);
  });

  it("sends digest when email configured", async () => {
    const db = createDatabase(
      join(mkdtempSync(join(tmpdir(), "bgg-mail-")), "test.db"),
    );
    db.exec(
      `INSERT INTO collection_entries (coll_id, bgg_id, name, subtype, wishlist, synced_at)
       VALUES (1, 1, 'Game', 'boardgame', 1, datetime('now'))`,
    );
    upsertMarketPriceWatch(db, { bggId: 1, maxPrice: 20, currency: "USD" });
    setNotifyEmail(db, "user@example.com");

    const sendDigest = vi.fn(async () => {});
    await runMarketWatchCron(db, {
      fetchMarket: async () => [
        {
          bggId: 1,
          name: "Game",
          listings: [listing({ listingKey: "9", price: 18 })],
        },
      ],
      sendDigest,
      force: true,
    });

    expect(sendDigest).toHaveBeenCalledTimes(1);
    expect(sendDigest.mock.calls[0][0].to).toBe("user@example.com");
  });

  it("skips when cron disabled", async () => {
    const db = createDatabase(
      join(mkdtempSync(join(tmpdir(), "bgg-skip-")), "test.db"),
    );
    setMarketWatchCronEnabled(db, false);
    upsertMarketPriceWatch(db, { bggId: 1, maxPrice: 10, currency: "USD" });

    const result = await runMarketWatchCron(db, {
      fetchMarket: async () => [],
    });
    expect(result.skipped).toBe(true);
    expect(result.reason).toBe("market_watch_cron_disabled");
  });
});

describe("verifyCronSecret", () => {
  it("accepts valid bearer and rejects invalid", async () => {
    const prev = process.env.CRON_SECRET;
    process.env.CRON_SECRET = "test-secret";
    const { verifyCronSecret } = await import("../src/api/cron-auth.js");
    const { Hono } = await import("hono");

    const app = new Hono();
    app.post("/test", (c) => c.json({ ok: verifyCronSecret(c) }));

    const okRes = await app.request("/test", {
      method: "POST",
      headers: { Authorization: "Bearer test-secret" },
    });
    expect(await okRes.json()).toEqual({ ok: true });

    const badRes = await app.request("/test", {
      method: "POST",
      headers: { Authorization: "Bearer wrong" },
    });
    expect(await badRes.json()).toEqual({ ok: false });

    process.env.CRON_SECRET = prev;
  });
});
