import type { BggClient } from "./client.js";
import { mapThingItemToGame } from "./mappers.js";
import type { Game } from "../domain/types.js";
import type { Db } from "../storage/database.js";
import { upsertGame } from "../storage/repos/games.js";

export interface BggSearchResult {
  bggId: number;
  name: string;
  yearPublished: number | null;
  type: string;
}

/**
 * Parse a BGG URL, numeric ID, or return null if it looks like a name query.
 */
export function parseBggGameInput(input: string): number | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  if (/^\d+$/.test(trimmed)) {
    return Number(trimmed);
  }

  try {
    const url = new URL(trimmed);
    const match = url.pathname.match(
      /\/(boardgame|boardgameexpansion|boardgameaccessory)\/(\d+)/i,
    );
    if (match) return Number(match[2]);
  } catch {
    // not a URL
  }

  // Relative path pasted without host
  const pathMatch = trimmed.match(
    /(?:^|\/)(boardgame|boardgameexpansion|boardgameaccessory)\/(\d+)/i,
  );
  if (pathMatch) return Number(pathMatch[2]);

  return null;
}

export async function searchGames(
  client: BggClient,
  query: string,
  limit = 20,
): Promise<BggSearchResult[]> {
  const result = await client.search({
    query: query.trim(),
    type: ["boardgame", "boardgameexpansion"],
  });
  const items = result.items.item ?? [];
  const list = Array.isArray(items) ? items : [items];

  return list.slice(0, limit).map((item) => {
    const names = item.name ?? [];
    const nameList = Array.isArray(names) ? names : [names];
    const primary =
      nameList.find((n) => n.type === "primary") ?? nameList[0];
    return {
      bggId: Number(item.id),
      name: primary?.value ?? "Unknown",
      yearPublished: item.yearpublished?.value ?? null,
      type: String(item.type),
    };
  });
}

export async function fetchAndCacheThing(
  db: Db,
  client: BggClient,
  bggId: number,
): Promise<Game> {
  const result = await client.getThing([bggId], { stats: true });
  const items = result.items.item ?? [];
  const list = Array.isArray(items) ? items : [items];
  const item = list[0];
  if (!item) {
    throw new Error(`No se encontró el juego BGG #${bggId}`);
  }
  const game = mapThingItemToGame(item, new Date().toISOString());
  upsertGame(db, game);
  return game;
}
