import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createDatabase } from "../src/storage/index.js";
import { setSyncState } from "../src/storage/repos/sync-state.js";
import { isDailyBggSyncDue } from "../src/sync/incremental.js";

function tempDb() {
  return createDatabase(join(mkdtempSync(join(tmpdir(), "bgg-sync-cron-")), "test.db"));
}

describe("isDailyBggSyncDue", () => {
  const now = new Date("2026-11-08T20:00:00.000Z");

  it("is due when collection was never synced", () => {
    expect(isDailyBggSyncDue(tempDb(), now)).toEqual({
      due: true,
      lastSyncedAt: null,
    });
  });

  it("skips when synced within the interval", () => {
    const db = tempDb();
    setSyncState(db, "collection", "2026-11-08T08:00:00.000Z");
    expect(isDailyBggSyncDue(db, now).due).toBe(false);
  });

  it("is due once the interval has elapsed", () => {
    const db = tempDb();
    setSyncState(db, "collection", "2026-11-07T23:00:00.000Z");
    expect(isDailyBggSyncDue(db, now).due).toBe(true);
  });
});

describe("POST /api/cron/bgg-sync", () => {
  it("rejects requests without the cron secret", async () => {
    const prev = process.env.CRON_SECRET;
    process.env.CRON_SECRET = "test-secret";
    try {
      const { cronRoutes } = await import("../src/api/routes/cron.js");
      const res = await cronRoutes.request("/bgg-sync", {
        method: "POST",
        headers: { Authorization: "Bearer wrong" },
      });
      expect(res.status).toBe(401);
    } finally {
      process.env.CRON_SECRET = prev;
    }
  });
});
