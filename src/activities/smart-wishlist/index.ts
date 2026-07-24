import { createBggClient } from "../../bgg/client.js";
import { fetchAndCacheThing, searchGames } from "../../bgg/lookup.js";
import { loadConfig, requireBggToken } from "../../config/index.js";
import {
  attachDiscoverySuggestions,
  collectDiscoveryCandidates,
  querySmartWishlist,
  type SmartWishlistMode,
  type SmartWishlistParams,
  type SmartWishlistResult,
} from "../../query/smart-wishlist.js";
import type { Activity, ActivityContext } from "../types.js";

export interface SmartWishlistRunParams {
  mode?: SmartWishlistMode;
  includeWantToPlay?: boolean;
  includeExpansions?: boolean;
  includeDiscovery?: boolean;
  localLimit?: number;
  discoveryLimit?: number;
}

function tryGetClient(): ReturnType<typeof createBggClient> | null {
  try {
    return createBggClient(requireBggToken(loadConfig()));
  } catch {
    return null;
  }
}

export async function runSmartWishlist(
  params: SmartWishlistRunParams,
  ctx: ActivityContext,
): Promise<SmartWishlistResult> {
  const queryParams: SmartWishlistParams = {
    mode: params.mode ?? "balance",
    includeWantToPlay: params.includeWantToPlay !== false,
    includeExpansions: params.includeExpansions === true,
    localLimit: params.localLimit,
    discoveryLimit: params.discoveryLimit,
  };

  const base = querySmartWishlist(ctx.storage.db, queryParams);
  const includeDiscovery = params.includeDiscovery !== false;

  if (!includeDiscovery) {
    return {
      ...base,
      discoveryStatus: {
        available: false,
        message: "Discovery desactivado en esta consulta.",
      },
    };
  }

  const client = tryGetClient();
  if (!client) {
    return {
      ...base,
      discoveryStatus: {
        available: false,
        message:
          "Falta BGG_TOKEN: la priorización local funciona; los descubrimientos no.",
      },
    };
  }

  const { candidates, error } = await collectDiscoveryCandidates(
    ctx.storage.db,
    {
      searchGames: (query, limit) => searchGames(client, query, limit),
      fetchThing: async (bggId) => {
        const game = await fetchAndCacheThing(ctx.storage.db, client, bggId);
        return {
          bggId: game.bggId,
          name: game.name,
          yearPublished: game.yearPublished,
          thumbnailUrl: game.thumbnailUrl,
          thingType: game.thingType ?? null,
          designers: game.designers,
          mechanics: game.mechanics,
          categories: game.categories,
        };
      },
    },
    {
      includeExpansions: queryParams.includeExpansions,
    },
  );

  if (error && candidates.length === 0) {
    return {
      ...base,
      discoveryStatus: {
        available: false,
        message: `No se pudo completar discovery: ${error}`,
      },
    };
  }

  return attachDiscoverySuggestions(
    ctx.storage.db,
    {
      ...base,
      discoveryStatus: error
        ? {
            available: true,
            message: `Discovery parcial: ${error}`,
          }
        : { available: true },
    },
    candidates,
    queryParams,
  );
}

export const smartWishlistActivity: Activity<
  SmartWishlistRunParams,
  SmartWishlistResult
> = {
  id: "smart-wishlist",
  name: "Wishlist inteligente",
  kind: "analytical",
  description:
    "Prioriza tu wishlist según cómo juegas y sugiere descubrimientos acotados desde BGG.",
  async run(params, ctx) {
    return runSmartWishlist(params ?? {}, ctx);
  },
};
