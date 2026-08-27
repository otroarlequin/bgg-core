import { createBggClient } from "../../bgg/client.js";
import {
  fetchAndCacheThing,
  parseBggGameInput,
  searchGames,
} from "../../bgg/lookup.js";
import { loadConfig, requireBggToken } from "../../config/index.js";
import {
  buildGameCompare,
  MAX_COMPARE_SLOTS,
  type GameCompareResult,
} from "../../query/game-compare.js";
import type { Activity, ActivityContext } from "../types.js";

export interface GameCompareParams {
  action: "resolve" | "compare";
  input?: string;
  bggIds?: number[];
}

export interface GameCompareOutput {
  message: string;
  bggId?: number;
  searchResults?: Array<{
    bggId: number;
    name: string;
    yearPublished: number | null;
    type: string;
  }>;
  compare?: GameCompareResult;
  maxSlots?: number;
}

function getClient() {
  const config = loadConfig();
  return createBggClient(requireBggToken(config));
}

export async function runGameCompare(
  params: GameCompareParams,
  ctx: ActivityContext,
): Promise<GameCompareOutput> {
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

  if (action === "compare") {
    const rawIds = params.bggIds ?? [];
    const bggIds = [...new Set(rawIds.filter((id) => Number.isFinite(id)))];
    if (bggIds.length === 0) {
      return {
        message: "Añade al menos un juego para comparar.",
        maxSlots: MAX_COMPARE_SLOTS,
        compare: buildGameCompare(ctx.storage.db, []),
      };
    }
    if (bggIds.length > MAX_COMPARE_SLOTS) {
      return {
        message: `Máximo ${MAX_COMPARE_SLOTS} juegos por comparación.`,
        maxSlots: MAX_COMPARE_SLOTS,
      };
    }

    const client = getClient();
    const games = [];
    for (const id of bggIds) {
      games.push(await fetchAndCacheThing(ctx.storage.db, client, id));
    }

    const compare = buildGameCompare(ctx.storage.db, games);
    return {
      message:
        games.length === 1
          ? "Juego cargado. Añade otro a la derecha para comparar."
          : `Comparación de ${games.length} juegos.`,
      compare,
      maxSlots: MAX_COMPARE_SLOTS,
    };
  }

  return { message: `Acción desconocida: ${action}` };
}

export const gameCompareActivity: Activity<
  GameCompareParams,
  GameCompareOutput
> = {
  id: "game-compare",
  name: "Comparador de juegos",
  kind: "analytical",
  description:
    "Compara hasta 4 juegos de BGG lado a lado: ficha técnica, similitud y diferencias.",
  run: runGameCompare,
};
