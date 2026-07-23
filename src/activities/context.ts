import { loadConfig } from "../config/index.js";
import { createQueryService } from "../query/index.js";
import { createDatabase, createStorageService } from "../storage/index.js";
import type { ActivityContext } from "./types.js";

export function createActivityContext(
  overrides: Partial<Pick<ActivityContext, "outputDir">> = {},
): ActivityContext {
  const config = loadConfig();
  const db = createDatabase(config.dbPath);
  const storage = createStorageService(db);
  const queries = createQueryService(db);

  return {
    queries,
    storage,
    outputDir: overrides.outputDir ?? config.outputDir,
  };
}
