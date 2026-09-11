import {
  defaultFetchBrowsePage,
  fetchBrowseTop100,
  type BrowsePageFetchFn,
} from "../../bgg/browse-ranks.js";
import {
  buildTop100Section,
  queryInsights,
  type InsightsResult,
} from "../../query/insights.js";
import {
  getBggTop100Cache,
  setBggTop100Cache,
} from "../../storage/repos/bgg-top-ranks-cache.js";
import type { Activity, ActivityContext } from "../types.js";

export interface InsightsRunParams {
  year?: number;
  fetchBrowsePage?: BrowsePageFetchFn;
}

export async function runInsights(
  params: InsightsRunParams,
  ctx: ActivityContext,
): Promise<InsightsResult> {
  const local = queryInsights(ctx.storage.db, { year: params.year });
  const db = ctx.storage.db;
  let top100 = buildTop100Section(db, [], null, null);

  try {
    const cached = getBggTop100Cache(db);
    if (cached) {
      top100 = buildTop100Section(db, cached.items, cached.fetchedAt);
    } else {
      const items = await fetchBrowseTop100(
        params.fetchBrowsePage ?? defaultFetchBrowsePage,
      );
      const fetchedAt = setBggTop100Cache(db, items);
      top100 = buildTop100Section(db, items, fetchedAt);
    }
  } catch (error) {
    top100 = buildTop100Section(
      db,
      [],
      null,
      error instanceof Error ? error.message : String(error),
    );
  }

  return {
    ...local,
    top100,
    isProfile: process.env.APP_MODE === "profile",
  };
}

export const insightsActivity: Activity<InsightsRunParams, InsightsResult> = {
  id: "insights",
  name: "Insights",
  kind: "analytical",
  description:
    "Partidas por año, mosaico del top 100 BGG y con quién (y a qué peso) sueles jugar.",
  async run(params, ctx) {
    return runInsights(params ?? {}, ctx);
  },
};
