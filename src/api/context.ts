import { loadConfig } from "../config/index.js";
import { createQueryService, type QueryService } from "../query/index.js";
import { queryDashboardSummary } from "../query/summary.js";
import { createActivityContext } from "../activities/context.js";
import { createDatabase } from "../storage/database.js";
import type { ActivityContext } from "../activities/types.js";
import type { Db } from "../storage/database.js";

let db: Db | null = null;
let queryService: QueryService | null = null;
let activityContext: ActivityContext | null = null;

export function getDb(): Db {
  if (!db) {
    const config = loadConfig();
    db = createDatabase(config.dbPath);
  }
  return db;
}

export function getQueryService(): QueryService {
  if (!queryService) {
    queryService = createQueryService(getDb());
  }
  return queryService;
}

export function getActivityContext(): ActivityContext {
  if (!activityContext) {
    activityContext = createActivityContext();
  }
  return activityContext;
}

export function getDashboard() {
  return queryDashboardSummary(getDb());
}
