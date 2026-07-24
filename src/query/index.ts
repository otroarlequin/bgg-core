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
import {
  queryShelfOfShame,
  type ShelfOfShameParams,
} from "./shelf-of-shame.js";
import {
  queryWhatToPlay,
  type WhatToPlayParams,
} from "./what-to-play.js";
import {
  queryPlayCalendar,
  queryPlaysOnDate,
  type PlayCalendarParams,
} from "./play-calendar.js";

export interface QueryService {
  queryCollection(params?: QueryCollectionParams): ReturnType<typeof queryCollection>;
  queryCollectionFacets(params?: QueryCollectionParams): CollectionFacets;
  queryPlays(params?: QueryPlaysParams): ReturnType<typeof queryPlays>;
  queryPlayStats(params?: QueryPlaysParams): ReturnType<typeof queryPlayStats>;
  queryGamesPlayedInPeriod(
    params: QueryGamesPlayedInPeriodParams,
  ): ReturnType<typeof queryGamesPlayedInPeriod>;
  queryDashboardSummary(): DashboardSummary;
  queryShelfOfShame(
    params?: ShelfOfShameParams,
  ): ReturnType<typeof queryShelfOfShame>;
  queryWhatToPlay(params: WhatToPlayParams): ReturnType<typeof queryWhatToPlay>;
  queryPlayCalendar(
    params?: PlayCalendarParams,
  ): ReturnType<typeof queryPlayCalendar>;
  queryPlaysOnDate(date: string): ReturnType<typeof queryPlaysOnDate>;
}

export function createQueryService(db: Db): QueryService {
  return {
    queryCollection: (params) => queryCollection(db, params),
    queryCollectionFacets: (params) => queryCollectionFacets(db, params),
    queryPlays: (params) => queryPlays(db, params),
    queryPlayStats: (params) => queryPlayStats(db, params),
    queryGamesPlayedInPeriod: (params) => queryGamesPlayedInPeriod(db, params),
    queryDashboardSummary: () => queryDashboardSummary(db),
    queryShelfOfShame: (params) => queryShelfOfShame(db, params),
    queryWhatToPlay: (params) => queryWhatToPlay(db, params),
    queryPlayCalendar: (params) => queryPlayCalendar(db, params),
    queryPlaysOnDate: (date) => queryPlaysOnDate(db, date),
  };
}

export type {
  QueryCollectionParams,
  QueryGamesPlayedInPeriodParams,
  QueryPlaysParams,
  CollectionFacets,
  ShelfOfShameParams,
  WhatToPlayParams,
  PlayCalendarParams,
};
export { queryCollection, queryCollectionFacets, queryGamesPlayedInPeriod, queryPlays, queryPlayStats };
export { queryDashboardSummary, queryCollectionSummary, queryTopPlayedGames };
export { queryShelfOfShame } from "./shelf-of-shame.js";
export { queryWhatToPlay } from "./what-to-play.js";
export { queryPlayCalendar, queryPlaysOnDate } from "./play-calendar.js";
export type { DashboardSummary, CollectionSummary, PlaysSummary, TopGameSummary } from "./summary.js";
export type { ShelfOfShameItem } from "./shelf-of-shame.js";
export type { WhatToPlaySuggestion, WhatToPlayResult } from "./what-to-play.js";
export type {
  PlayCalendarResult,
  PlayCalendarDay,
  PlayCalendarDayPlay,
} from "./play-calendar.js";
