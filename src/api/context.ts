import { AsyncLocalStorage } from "node:async_hooks";
import { loadConfig } from "../config/index.js";
import { createQueryService, type QueryService } from "../query/index.js";
import { queryDashboardSummary } from "../query/summary.js";
import { createActivityContext } from "../activities/context.js";
import { createDatabase } from "../storage/database.js";
import type { ActivityContext } from "../activities/types.js";
import type { Db } from "../storage/database.js";

const dbAls = new AsyncLocalStorage<Db>();

let defaultDb: Db | null = null;

/** DB of the current request (profile session) or the personal default. */
export function getDb(): Db {
  const scoped = dbAls.getStore();
  if (scoped) return scoped;
  if (!defaultDb) {
    const config = loadConfig();
    defaultDb = createDatabase(config.dbPath);
  }
  return defaultDb;
}

export function runWithDb<T>(db: Db, fn: () => T): T {
  return dbAls.run(db, fn);
}

export async function runWithDbAsync<T>(
  db: Db,
  fn: () => Promise<T>,
): Promise<T> {
  return dbAls.run(db, fn);
}

export function getQueryService(): QueryService {
  return createQueryService(getDb());
}

export function getActivityContext(): ActivityContext {
  return createActivityContext({ db: getDb() });
}

export function getDashboard() {
  return queryDashboardSummary(getDb());
}
