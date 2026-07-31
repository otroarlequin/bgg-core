import { createBggClient } from "../../bgg/client.js";
import {
  fetchAndCacheThings,
  fetchHotBoardgameIds,
} from "../../bgg/lookup.js";
import { loadConfig, requireBggToken } from "../../config/index.js";
import {
  runHotnessScoutQuery,
  type HotnessScoutParams,
  type HotnessScoutResult,
} from "../../query/hotness-scout.js";
import {
  buildPlayProfile,
  type SmartWishlistMode,
} from "../../query/smart-wishlist.js";
import type { Activity, ActivityContext } from "../types.js";

export interface HotnessScoutRunParams {
  mode?: SmartWishlistMode;
  includeExpansions?: boolean;
  hotLimit?: number;
  maxThings?: number;
  limit?: number;
}

function tryGetClient() {
  try {
    return createBggClient(requireBggToken(loadConfig()));
  } catch {
    return null;
  }
}

export async function runHotnessScout(
  params: HotnessScoutRunParams,
  ctx: ActivityContext,
): Promise<HotnessScoutResult> {
  const mode = params.mode ?? "balance";
  const queryParams: HotnessScoutParams = {
    mode,
    includeExpansions: params.includeExpansions === true,
    hotLimit: params.hotLimit,
    maxThings: params.maxThings,
    limit: params.limit,
  };

  const client = tryGetClient();
  if (!client) {
    const { profile } = buildPlayProfile(ctx.storage.db);
    return {
      status: {
        ok: false,
        message:
          "Falta BGG_TOKEN: sin él no se puede leer la hot list de BGG.",
      },
      mode,
      hotRankTotal: 0,
      candidatesFetched: 0,
      alreadyOwnedSkipped: 0,
      suggestions: [],
      profile,
    };
  }

  return runHotnessScoutQuery(
    ctx.storage.db,
    {
      fetchHotGameIds: (limit) => fetchHotBoardgameIds(client, limit),
      fetchThings: async (bggIds) => {
        const games = await fetchAndCacheThings(
          ctx.storage.db,
          client,
          bggIds,
        );
        return games.map((game) => ({
          bggId: game.bggId,
          name: game.name,
          yearPublished: game.yearPublished,
          thumbnailUrl: game.thumbnailUrl,
          thingType: game.thingType ?? null,
          designers: game.designers,
          mechanics: game.mechanics,
          categories: game.categories,
        }));
      },
    },
    queryParams,
  );
}

export const hotnessScoutActivity: Activity<
  HotnessScoutRunParams,
  HotnessScoutResult
> = {
  id: "hotness-scout",
  name: "Hotness scout",
  kind: "analytical",
  description:
    "Compara la hot list de BGG con tu colección owned para descubrir candidatos con encaje.",
  async run(params, ctx) {
    return runHotnessScout(params ?? {}, ctx);
  },
};
