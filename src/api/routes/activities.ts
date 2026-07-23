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
