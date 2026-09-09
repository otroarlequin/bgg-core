import { Hono } from "hono";
import {
  deleteMarketPriceWatch,
  getMarketPriceWatch,
  listMarketPriceWatches,
  patchMarketPriceWatch,
  upsertMarketPriceWatch,
} from "../../storage/repos/market-price-watches.js";
import {
  effectivePriceCeiling,
  listWishlistForPriceWatches,
} from "../../query/market-price-watch.js";
import { getDb } from "../context.js";

export const marketWatchesRoutes = new Hono();

function gameNameFor(db: ReturnType<typeof getDb>, bggId: number): string | null {
  const row = db
    .prepare(`SELECT name FROM collection_entries WHERE bgg_id = ? LIMIT 1`)
    .get(bggId) as { name: string } | undefined;
  return row?.name ?? null;
}

function enrichWatch(db: ReturnType<typeof getDb>, watch: NonNullable<ReturnType<typeof getMarketPriceWatch>>) {
  return {
    ...watch,
    gameName: gameNameFor(db, watch.bggId),
    effectiveCeiling: effectivePriceCeiling(watch.maxPrice, watch.tolerancePct),
  };
}

marketWatchesRoutes.get("/", (c) => {
  const db = getDb();
  const watches = listMarketPriceWatches(db).map((w) => enrichWatch(db, w));
  return c.json({ watches });
});

marketWatchesRoutes.get("/wishlist-options", (c) => {
  const db = getDb();
  const wishlist = listWishlistForPriceWatches(db).map((item) => ({
    bggId: item.bggId,
    name: item.name,
    wishlistPriority: item.wishlistPriority,
    thumbnailUrl: item.thumbnailUrl,
  }));
  return c.json({ wishlist });
});

marketWatchesRoutes.put("/:bggId", async (c) => {
  const bggId = Number(c.req.param("bggId"));
  if (!Number.isFinite(bggId) || bggId <= 0) {
    return c.json({ message: "bggId inválido" }, 400);
  }

  let body: {
    maxPrice?: number;
    tolerancePct?: number;
    currency?: string;
    enabled?: boolean;
  };
  try {
    body = (await c.req.json()) as typeof body;
  } catch {
    return c.json({ message: "JSON inválido" }, 400);
  }

  if (body.maxPrice == null || !Number.isFinite(body.maxPrice) || body.maxPrice <= 0) {
    return c.json({ message: "maxPrice debe ser un número positivo" }, 400);
  }

  if (
    body.tolerancePct != null &&
    (!Number.isFinite(body.tolerancePct) || body.tolerancePct < 0 || body.tolerancePct > 100)
  ) {
    return c.json({ message: "tolerancePct debe estar entre 0 y 100" }, 400);
  }

  const db = getDb();
  const onWishlist = db
    .prepare(
      `SELECT 1 FROM collection_entries WHERE bgg_id = ? AND wishlist = 1 LIMIT 1`,
    )
    .get(bggId);
  if (!onWishlist) {
    return c.json({ message: "El juego debe estar en tu wishlist" }, 400);
  }

  try {
    const watch = upsertMarketPriceWatch(db, {
      bggId,
      maxPrice: body.maxPrice,
      tolerancePct: body.tolerancePct,
      currency: body.currency,
      enabled: body.enabled,
    });
    return c.json({ watch: enrichWatch(db, watch) });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return c.json({ message }, 400);
  }
});

marketWatchesRoutes.patch("/:bggId", async (c) => {
  const bggId = Number(c.req.param("bggId"));
  if (!Number.isFinite(bggId) || bggId <= 0) {
    return c.json({ message: "bggId inválido" }, 400);
  }

  let body: {
    maxPrice?: number;
    tolerancePct?: number;
    currency?: string;
    enabled?: boolean;
  };
  try {
    body = (await c.req.json()) as typeof body;
  } catch {
    return c.json({ message: "JSON inválido" }, 400);
  }

  const db = getDb();
  const watch = patchMarketPriceWatch(db, bggId, body);
  if (!watch) {
    return c.json({ message: "Alerta no encontrada" }, 404);
  }
  return c.json({ watch: enrichWatch(db, watch) });
});

marketWatchesRoutes.delete("/:bggId", (c) => {
  const bggId = Number(c.req.param("bggId"));
  if (!Number.isFinite(bggId) || bggId <= 0) {
    return c.json({ message: "bggId inválido" }, 400);
  }

  const db = getDb();
  const deleted = deleteMarketPriceWatch(db, bggId);
  if (!deleted) {
    return c.json({ message: "Alerta no encontrada" }, 404);
  }
  return c.json({ ok: true });
});
