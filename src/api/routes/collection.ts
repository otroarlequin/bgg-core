import { Hono } from "hono";
import type { QueryCollectionParams } from "../../query/collection.js";
import { getQueryService } from "../context.js";

export const collectionRoutes = new Hono();

function parseCollectionParams(
  searchParams: URLSearchParams,
): QueryCollectionParams {
  const params: QueryCollectionParams = {};

  if (searchParams.has("own")) params.own = searchParams.get("own") === "true";
  if (searchParams.has("wishlist")) {
    params.wishlist = searchParams.get("wishlist") === "true";
  }
  if (searchParams.has("preordered")) {
    params.preordered = searchParams.get("preordered") === "true";
  }
  if (searchParams.has("minPlays")) {
    params.minPlays = Number(searchParams.get("minPlays"));
  }
  if (searchParams.has("includeExpansions")) {
    params.includeExpansions = searchParams.get("includeExpansions") === "true";
  }
  if (searchParams.has("designer")) {
    params.designer = searchParams.get("designer") ?? undefined;
  }
  if (searchParams.has("artist")) {
    params.artist = searchParams.get("artist") ?? undefined;
  }
  if (searchParams.has("publisher")) {
    params.publisher = searchParams.get("publisher") ?? undefined;
  }
  if (searchParams.has("categories")) {
    params.categories = searchParams.getAll("categories").filter(Boolean);
  }
  if (searchParams.has("mechanics")) {
    params.mechanics = searchParams.getAll("mechanics").filter(Boolean);
  }
  if (searchParams.has("languageDependence")) {
    params.languageDependence = searchParams.get("languageDependence") ?? undefined;
  }
  if (searchParams.has("players")) {
    params.players = Number(searchParams.get("players"));
  }
  if (searchParams.has("sortBy")) {
    params.sortBy = searchParams.get("sortBy") as QueryCollectionParams["sortBy"];
  }
  if (searchParams.has("limit")) {
    params.limit = Number(searchParams.get("limit"));
  }

  return params;
}

collectionRoutes.get("/facets", (c) => {
  const params = parseCollectionParams(new URL(c.req.url).searchParams);
  const facets = getQueryService().queryCollectionFacets(params);
  return c.json(facets);
});

collectionRoutes.get("/", (c) => {
  const params = parseCollectionParams(new URL(c.req.url).searchParams);
  const results = getQueryService().queryCollection(params);
  return c.json({ total: results.length, items: results });
});
