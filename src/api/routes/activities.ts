import { Hono } from "hono";
import { runPairwiseDuel } from "../../activities/pairwise-duel/index.js";
import type { PairwiseDuelParams } from "../../activities/pairwise-duel/index.js";
import {
  runPurchaseValidator,
  type PurchaseValidatorParams,
} from "../../activities/purchase-validator/index.js";
import { getActivityContext } from "../context.js";

export const activitiesRoutes = new Hono();

activitiesRoutes.post("/pairwise-duel", async (c) => {
  const body = (await c.req.json()) as PairwiseDuelParams;
  try {
    const result = await runPairwiseDuel(body, getActivityContext());
    return c.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return c.json({ message }, 400);
  }
});

activitiesRoutes.get("/pairwise-duel/status", async (c) => {
  const sessionId = c.req.query("sessionId");
  const result = await runPairwiseDuel(
    {
      action: "status",
      sessionId: sessionId ? Number(sessionId) : undefined,
    },
    getActivityContext(),
  );
  return c.json(result);
});

activitiesRoutes.post("/purchase-validator", async (c) => {
  const body = (await c.req.json()) as PurchaseValidatorParams;
  try {
    const result = await runPurchaseValidator(body, getActivityContext());
    return c.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return c.json({ message }, 400);
  }
});

activitiesRoutes.get("/shelf-of-shame", (c) => {
  const includeExpansions = c.req.query("includeExpansions") === "true";
  const limitRaw = c.req.query("limit");
  const limit = limitRaw ? Number(limitRaw) : undefined;
  const ctx = getActivityContext();
  const items = ctx.queries.queryShelfOfShame({
    includeExpansions,
    limit: Number.isFinite(limit) ? limit : undefined,
  });
  return c.json({ total: items.length, items });
});

activitiesRoutes.post("/what-to-play", async (c) => {
  const body = (await c.req.json()) as {
    players?: number;
    maxTimeMinutes?: number;
    maxWeight?: number;
    ownedOnly?: boolean;
    includeExpansions?: boolean;
    count?: number;
    seed?: number;
  };
  const players = Number(body.players);
  const maxTimeMinutes = Number(body.maxTimeMinutes);
  if (!Number.isFinite(players) || players < 1) {
    return c.json({ message: "players debe ser un número >= 1" }, 400);
  }
  if (!Number.isFinite(maxTimeMinutes) || maxTimeMinutes < 1) {
    return c.json({ message: "maxTimeMinutes debe ser un número >= 1" }, 400);
  }
  const ctx = getActivityContext();
  const suggestions = ctx.queries.queryWhatToPlay({
    players,
    maxTimeMinutes,
    maxWeight:
      body.maxWeight !== undefined && Number.isFinite(Number(body.maxWeight))
        ? Number(body.maxWeight)
        : undefined,
    ownedOnly: body.ownedOnly,
    includeExpansions: body.includeExpansions,
    count: body.count,
    seed: body.seed,
  });
  return c.json({ total: suggestions.length, suggestions });
});

activitiesRoutes.get("/play-calendar", (c) => {
  const from = c.req.query("from") || undefined;
  const to = c.req.query("to") || undefined;
  const ctx = getActivityContext();
  return c.json(ctx.queries.queryPlayCalendar({ from, to }));
});

activitiesRoutes.get("/play-calendar/day", (c) => {
  const date = c.req.query("date");
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return c.json({ message: "date requerido (YYYY-MM-DD)" }, 400);
  }
  const ctx = getActivityContext();
  const items = ctx.queries.queryPlaysOnDate(date);
  return c.json({ date, total: items.length, items });
});
