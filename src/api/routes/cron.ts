import { Hono } from "hono";
import { createBggClient } from "../../bgg/client.js";
import { createMarketFetchFn } from "../../bgg/marketplace.js";
import { loadConfig, requireBggToken } from "../../config/index.js";
import { runMarketWatchCron } from "../../query/market-price-watch.js";
import { createResendDigestSender } from "../../notify/resend.js";
import { getDb } from "../context.js";
import { verifyCronSecret } from "../cron-auth.js";

export const cronRoutes = new Hono();

cronRoutes.post("/market-watches", async (c) => {
  if (!verifyCronSecret(c)) {
    return c.json({ message: "No autorizado" }, 401);
  }

  const db = getDb();
  let fetchMarket;
  try {
    const client = createBggClient(requireBggToken(loadConfig()));
    fetchMarket = createMarketFetchFn(client);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return c.json({ ok: false, message }, 503);
  }

  const sendDigest = process.env.RESEND_API_KEY?.trim()
    ? createResendDigestSender()
    : undefined;

  const result = await runMarketWatchCron(db, {
    fetchMarket,
    sendDigest,
  });

  return c.json(result, result.ok ? 200 : 500);
});
