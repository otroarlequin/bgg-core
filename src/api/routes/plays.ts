import { Hono } from "hono";
import type { QueryPlaysParams } from "../../query/plays.js";
import { getQueryService } from "../context.js";

export const playsRoutes = new Hono();

function parsePlaysParams(searchParams: URLSearchParams): QueryPlaysParams {
  const params: QueryPlaysParams = {};
  if (searchParams.has("from")) params.from = searchParams.get("from") ?? undefined;
  if (searchParams.has("to")) params.to = searchParams.get("to") ?? undefined;
  if (searchParams.has("bggId")) params.bggId = Number(searchParams.get("bggId"));
  if (searchParams.has("includeIncomplete")) {
    params.includeIncomplete = searchParams.get("includeIncomplete") === "true";
  }
  return params;
}

playsRoutes.get("/", (c) => {
  const params = parsePlaysParams(new URL(c.req.url).searchParams);
  const results = getQueryService().queryPlays(params);
  return c.json({ total: results.length, items: results });
});

playsRoutes.get("/stats", (c) => {
  const params = parsePlaysParams(new URL(c.req.url).searchParams);
  const stats = getQueryService().queryPlayStats(params);
  return c.json({
    ...stats,
    totalHours: Math.round((stats.totalMinutes / 60) * 10) / 10,
  });
});
