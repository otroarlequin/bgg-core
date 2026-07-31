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

/** Search BGG person records for designers (not boardgame titles). */
export async function searchDesigners(
  client: BggClient,
  query: string,
  limit = 5,
): Promise<Array<{ bggId: number; name: string }>> {
  const result = await client.search({
    query: query.trim(),
    type: "boardgamedesigner",
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
      name: primary?.value ?? query.trim(),
    };
  });
}

/**
 * Games linked from a designer person thing (inbound boardgame links when present).
 */
export async function fetchDesignerLinkedGameIds(
  client: BggClient,
  designerId: number,
  limit = 12,
): Promise<number[]> {
  const result = await client.getThing([designerId]);
  const items = result.items.item ?? [];
  const list = Array.isArray(items) ? items : [items];
  const item = list[0] as
    | {
        link?: Array<{ type?: string; id?: number | string; inbound?: boolean }>;
      }
    | undefined;
  if (!item?.link) return [];

  const links = Array.isArray(item.link) ? item.link : [item.link];
  const ids: number[] = [];
  const seen = new Set<number>();

  for (const link of links) {
    const type = String(link.type ?? "");
    if (type !== "boardgame" && type !== "boardgameexpansion") continue;
    const id = Number(link.id);
    if (!Number.isFinite(id) || seen.has(id)) continue;
    seen.add(id);
    ids.push(id);
    if (ids.length >= limit) break;
  }

  return ids;
}

export async function fetchHotBoardgameIds(
  client: BggClient,
  limit = 30,
): Promise<number[]> {
  const result = await client.getHot("boardgame");
  const items = result.items.item ?? [];
  const list = Array.isArray(items) ? items : [items];
  return list.slice(0, limit).map((item) => Number(item.id));
}

export async function fetchAndCacheThing(
  db: Db,
  client: BggClient,
  bggId: number,
): Promise<Game> {
  const games = await fetchAndCacheThings(db, client, [bggId]);
  const game = games[0];
  if (!game) {
    throw new Error(`No se encontró el juego BGG #${bggId}`);
  }
  return game;
}

/** Batch fetch/cache up to 20 things per BGG request. */
export async function fetchAndCacheThings(
  db: Db,
  client: BggClient,
  bggIds: number[],
): Promise<Game[]> {
  const unique = [...new Set(bggIds.filter((id) => Number.isFinite(id)))];
  if (unique.length === 0) return [];

  const syncedAt = new Date().toISOString();
  const games: Game[] = [];

  for (let i = 0; i < unique.length; i += 20) {
    const chunk = unique.slice(i, i + 20);
    const result = await client.getThing(chunk, { stats: true });
    const items = result.items.item ?? [];
    const list = Array.isArray(items) ? items : [items];
    for (const item of list) {
      const game = mapThingItemToGame(item, syncedAt);
      upsertGame(db, game);
      games.push(game);
    }
  }

  return games;
}
