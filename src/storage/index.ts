import type { Db } from "./database.js";
import * as appSettingsRepo from "./repos/app-settings.js";
import * as collectionRepo from "./repos/collection.js";
import * as duelRepo from "./repos/duel.js";
import * as gamesRepo from "./repos/games.js";
import * as playsRepo from "./repos/plays.js";
import * as purchaseReviewsRepo from "./repos/purchase-reviews.js";
import * as syncStateRepo from "./repos/sync-state.js";

export interface StorageService {
  db: Db;
  games: typeof gamesRepo;
  collection: typeof collectionRepo;
  plays: typeof playsRepo;
  syncState: typeof syncStateRepo;
  duel: typeof duelRepo;
  purchaseReviews: typeof purchaseReviewsRepo;
  appSettings: typeof appSettingsRepo;
}

export function createStorageService(db: Db): StorageService {
  return {
    db,
    games: gamesRepo,
    collection: collectionRepo,
    plays: playsRepo,
    syncState: syncStateRepo,
    duel: duelRepo,
    purchaseReviews: purchaseReviewsRepo,
    appSettings: appSettingsRepo,
  };
}

export { createDatabase, type Db } from "./database.js";
