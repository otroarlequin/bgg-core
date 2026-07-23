import { Hono } from "hono";
import { createBggClient } from "../../bgg/client.js";
import {
  fetchAndCacheThing,
  parseBggGameInput,
  searchGames,
} from "../../bgg/lookup.js";
import { loadConfig, requireBggCredentials } from "../../config/index.js";
import { getDb } from "../context.js";
import { getCollectionEntryByBggId } from "../../storage/repos/collection.js";

export const bggRoutes = new Hono();

function getClient() {
  const config = loadConfig();
  const { token } = requireBggCredentials(config);
  return createBggClient(token);
}

bggRoutes.get("/search", async (c) => {
  const q = c.req.query("q")?.trim() ?? "";
  if (!q) return c.json({ items: [] });

  const parsedId = parseBggGameInput(q);
  if (parsedId != null) {
    return c.json({
      items: [{ bggId: parsedId, name: `BGG #${parsedId}`, yearPublished: null, type: "boardgame" }],
    });
  }

  try {
    const items = await searchGames(getClient(), q);
    return c.json({ items });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return c.json({ message, items: [] }, 400);
  }
});

bggRoutes.get("/thing/:id", async (c) => {
  const bggId = Number(c.req.param("id"));
  if (!Number.isFinite(bggId)) {
    return c.json({ message: "ID inválido" }, 400);
  }
  try {
    const game = await fetchAndCacheThing(getDb(), getClient(), bggId);
    const entry = getCollectionEntryByBggId(getDb(), bggId);
    return c.json({
      game,
      collectionStatus: entry
        ? {
            own: entry.own,
            wishlist: entry.wishlist,
            preordered: entry.preordered,
            wishlistPriority: entry.wishlistPriority,
          }
        : null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return c.json({ message }, 400);
  }
});
