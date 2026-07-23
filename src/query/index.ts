import type { Db } from "../storage/database.js";
import {
  queryCollection,
  queryCollectionFacets,
  type QueryCollectionParams,
  type CollectionFacets,
} from "./collection.js";
import {
  queryGamesPlayedInPeriod,
  queryPlays,
  queryPlayStats,
  type QueryGamesPlayedInPeriodParams,
  type QueryPlaysParams,
} from "./plays.js";
import {
  queryDashboardSummary,
  queryCollectionSummary,
  queryTopPlayedGames,
  type DashboardSummary,
} from "./summary.js";

export interface QueryService {
  queryCollection(params?: QueryCollectionParams): ReturnType<typeof queryCollection>;
  queryCollectionFacets(params?: QueryCollectionParams): CollectionFacets;
  queryPlays(params?: QueryPlaysParams): ReturnType<typeof queryPlays>;
  queryPlayStats(params?: QueryPlaysParams): ReturnType<typeof queryPlayStats>;
  queryGamesPlayedInPeriod(
    params: QueryGamesPlayedInPeriodParams,
  ): ReturnType<typeof queryGamesPlayedInPeriod>;
  queryDashboardSummary(): DashboardSummary;
}

export function createQueryService(db: Db): QueryService {
  return {
    queryCollection: (params) => queryCollection(db, params),
    queryCollectionFacets: (params) => queryCollectionFacets(db, params),
    queryPlays: (params) => queryPlays(db, params),
    queryPlayStats: (params) => queryPlayStats(db, params),
    queryGamesPlayedInPeriod: (params) => queryGamesPlayedInPeriod(db, params),
    queryDashboardSummary: () => queryDashboardSummary(db),
  };
}

export type {
  QueryCollectionParams,
  QueryGamesPlayedInPeriodParams,
  QueryPlaysParams,
  CollectionFacets,
};
export { queryCollection, queryCollectionFacets, queryGamesPlayedInPeriod, queryPlays, queryPlayStats };
export { queryDashboardSummary, queryCollectionSummary, queryTopPlayedGames };
export type { DashboardSummary, CollectionSummary, PlaysSummary, TopGameSummary } from "./summary.js";
