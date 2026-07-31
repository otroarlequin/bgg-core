import { Hono } from "hono";
import { createBggClient } from "../../bgg/client.js";
import {
  loadConfig,
  requireBggCredentials,
} from "../../config/index.js";
import { createStorageService } from "../../storage/index.js";
import { syncCollection, syncPlays } from "../../sync/index.js";
import { getDb } from "../context.js";

export const syncRoutes = new Hono();

let syncInFlight = false;

export interface SyncApiResult {
  ok: boolean;
  message?: string;
  collection?: { count: number; incremental: boolean };
  plays?: { count: number; incremental: boolean };
  durationMs: number;
}

syncRoutes.post("/", async (c) => {
  if (syncInFlight) {
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
  syncInFlight = true;
  try {
    const config = loadConfig();
    const { token, username } = requireBggCredentials(config);
    const client = createBggClient(token);
    const storage = createStorageService(getDb());

    const result: SyncApiResult = {
      ok: true,
      durationMs: 0,
    };

    if (doCollection) {
      result.collection = await syncCollection(storage, client, username, {
        incremental: true,
      });
    }
    if (doPlays) {
      result.plays = await syncPlays(storage, client, username, {
        incremental: true,
      });
    }

    result.durationMs = Date.now() - started;
    return c.json(result);
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
  } finally {
    syncInFlight = false;
  }
});
