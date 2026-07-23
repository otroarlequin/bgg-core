import { createBggClient } from "../../bgg/client.js";
import {
  fetchAndCacheThing,
  parseBggGameInput,
  searchGames,
} from "../../bgg/lookup.js";
import { loadConfig, requireBggCredentials } from "../../config/index.js";
import {
  analyzePurchaseCandidate,
  queryFacetMatches,
  type MatchFacet,
  type PurchaseAnalysis,
} from "../../query/purchase-validator.js";
import type { PurchaseDecision } from "../../storage/repos/purchase-reviews.js";
import type { Activity, ActivityContext } from "../types.js";

export interface PurchaseValidatorParams {
  action: "resolve" | "analyze" | "matches" | "save" | "wishlist";
  input?: string;
  bggId?: number;
  facet?: MatchFacet;
  value?: string;
  all?: boolean;
  notes?: string;
  decision?: PurchaseDecision;
  wishlistPriority?: number;
  overlapScore?: number;
  snapshot?: unknown;
}

export interface PurchaseValidatorOutput {
  message: string;
  bggId?: number;
  searchResults?: Array<{
    bggId: number;
    name: string;
    yearPublished: number | null;
    type: string;
  }>;
  analysis?: PurchaseAnalysis;
  matches?: ReturnType<typeof queryFacetMatches>;
  savedReviewId?: number;
}

function getClient() {
  const config = loadConfig();
  const { token } = requireBggCredentials(config);
  return createBggClient(token);
}

export async function runPurchaseValidator(
  params: PurchaseValidatorParams,
  ctx: ActivityContext,
): Promise<PurchaseValidatorOutput> {
  const { action } = params;

  if (action === "resolve") {
    const input = params.input?.trim() ?? "";
    if (!input) {
      return { message: "Indica un nombre, URL o ID de BGG." };
    }
    const parsedId = parseBggGameInput(input);
    if (parsedId != null) {
      return {
        message: `Juego identificado: #${parsedId}`,
        bggId: parsedId,
      };
    }
    const client = getClient();
    const searchResults = await searchGames(client, input);
    if (searchResults.length === 0) {
      return { message: "Sin resultados en BGG para esa búsqueda." };
    }
    if (searchResults.length === 1) {
      return {
        message: `Encontrado: ${searchResults[0].name}`,
        bggId: searchResults[0].bggId,
        searchResults,
      };
    }
    return {
      message: `${searchResults.length} resultados. Elige uno.`,
      searchResults,
    };
  }

  if (action === "analyze") {
    const bggId = params.bggId;
    if (bggId == null) {
      return { message: "Falta bggId para analizar." };
    }
    const client = getClient();
    const game = await fetchAndCacheThing(ctx.storage.db, client, bggId);
    const analysis = analyzePurchaseCandidate(ctx.storage.db, game);
    return {
      message: analysis.alreadyInCollection
        ? "Este juego ya está en tu colección."
        : "Análisis listo.",
      bggId,
      analysis,
    };
  }

  if (action === "matches") {
    const bggId = params.bggId;
    const facet = params.facet;
    const value = params.value;
    if (!facet || !value) {
      return { message: "Faltan facet y value." };
    }
    const matches = queryFacetMatches(ctx.storage.db, facet, value, {
      limit: params.all ? 0 : 10,
      excludeBggId: bggId,
    });
    return {
      message: `${matches.total} coincidencias para ${facet}: ${value}`,
      matches,
    };
  }

  if (action === "save") {
    const bggId = params.bggId;
    if (bggId == null) {
      return { message: "Falta bggId para guardar." };
    }
    const review = ctx.storage.purchaseReviews.insertPurchaseReview(
      ctx.storage.db,
      {
        bggId,
        notes: params.notes,
        decision: params.decision,
        overlapScore: params.overlapScore,
        snapshot: params.snapshot ?? {},
      },
    );
    return {
      message: "Análisis guardado.",
      bggId,
      savedReviewId: review.id,
    };
  }

  if (action === "wishlist") {
    const bggId = params.bggId;
    const priority = params.wishlistPriority ?? 3;
    if (bggId == null) {
      return { message: "Falta bggId para wishlist." };
    }
    const game = ctx.storage.games.getGameById(ctx.storage.db, bggId);
    if (!game) {
      return {
        message: "El juego no está en caché local. Analízalo primero.",
      };
    }
    ctx.storage.collection.upsertLocalWishlist(ctx.storage.db, {
      bggId: game.bggId,
      name: game.name,
      yearPublished: game.yearPublished,
      imageUrl: game.imageUrl,
      thumbnailUrl: game.thumbnailUrl,
      bggRating: game.bggRating,
      bggRank: game.bggRank,
      wishlistPriority: Math.min(5, Math.max(1, priority)),
      comment: params.notes ?? null,
    });
    return {
      message:
        "Añadido a wishlist local (prioridad " +
        priority +
        "). No se sincroniza con BGG automáticamente.",
      bggId,
    };
  }

  return { message: `Acción desconocida: ${action}` };
}

export const purchaseValidatorActivity: Activity<
  PurchaseValidatorParams,
  PurchaseValidatorOutput
> = {
  id: "purchase-validator",
  name: "Validador de compras",
  kind: "analytical",
  description:
    "Compara un juego candidato de BGG con tu colección para explorar similitudes.",
  run: runPurchaseValidator,
};
