import { Hono } from "hono";
import { loadConfig } from "../../config/index.js";
import {
  isBggSyncInFlight,
  runIncrementalBggSync,
} from "../../sync/incremental.js";
import { getDb } from "../context.js";

export const syncRoutes = new Hono();

export interface SyncApiResult {
  ok: boolean;
  message?: string;
  username?: string;
  collection?: { count: number; incremental: boolean };
  plays?: { count: number; incremental: boolean };
  durationMs: number;
}

syncRoutes.post("/", async (c) => {
  if (isBggSyncInFlight()) {
    return c.json(
      {
        ok: false,
        message: "Ya hay una sincronización en curso. Espera a que termine.",
        durationMs: 0,
      } satisfies SyncApiResult,
      409,
    );
  }

  let body: { collection?: boolean; plays?: boolean } = {};
  try {
    body = (await c.req.json()) as { collection?: boolean; plays?: boolean };
  } catch {
    // empty body is fine
  }

  const doCollection = body.collection !== false;
  const doPlays = body.plays !== false;
  if (!doCollection && !doPlays) {
    return c.json(
      {
        ok: false,
        message: "Nada que sincronizar (collection y plays desactivados).",
        durationMs: 0,
      } satisfies SyncApiResult,
      400,
    );
  }

  const started = Date.now();
  try {
    const result = await runIncrementalBggSync(getDb(), loadConfig(), {
      collection: doCollection,
      plays: doPlays,
    });
    return c.json({ ok: true, ...result } satisfies SyncApiResult);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return c.json(
      {
        ok: false,
        message,
        durationMs: Date.now() - started,
      } satisfies SyncApiResult,
      400,
    );
  }
});
