import type {
  CollectionEntry,
  Game,
  GameSubtype,
  Play,
  PlayPlayer,
} from "../domain/types.js";
import {
  decodeHtmlEntities,
  decodeHtmlEntitiesNullable,
  stripHtmlToText,
} from "../utils/html-entities.js";

/** Shapes from bgg-api-ts XML responses (partial). */
interface BggName {
  value: string;
  type?: string;
}

interface BggLink {
  type?: string;
  value?: string;
}

interface BggCollectionItem {
  collid: string | number;
  objectid: string | number;
  subtype?: string;
  name?: BggName[];
  yearpublished?: string | number;
  image?: string;
  thumbnail?: string;
  stats?: {
    rating?: {
      value?: string | number;
      average?: string | number | { value?: string | number };
      bayesaverage?: string | number | { value?: string | number };
      ranks?: {
        rank?: Array<{ type?: string; name?: string; value?: string | number }>;
      };
    };
    numplays?: string | number;
  };
  status?: {
    own?: string | number | boolean;
    preowned?: string | number | boolean;
    fortrade?: string | number | boolean;
    want?: string | number | boolean;
    wanttoplay?: string | number | boolean;
    wanttobuy?: string | number | boolean;
    wishlist?: string | number | boolean;
    preordered?: string | number | boolean;
    hasparts?: string | number | boolean;
    wantparts?: string | number | boolean;
    comment?: string;
    wishlistpriority?: string | number;
    lastmodified?: string;
  };
  numplays?: string | number;
  comment?: string;
}

interface BggThingItem {
  id: string | number;
  name?: BggName[];
  yearpublished?: { value?: string | number };
  minplayers?: { value?: string | number };
  maxplayers?: { value?: string | number };
  playingtime?: { value?: string | number };
  minplaytime?: { value?: string | number };
  maxplaytime?: { value?: string | number };
  image?: string;
  thumbnail?: string;
  description?: string;
  link?: BggLink[];
  poll?: BggPoll | BggPoll[];
  statistics?: {
    ratings?: {
      average?: { value?: string | number };
      averageweight?: { value?: string | number };
      ranks?: {
        rank?: Array<{ type?: string; name?: string; value?: string | number }> | { type?: string; name?: string; value?: string | number };
      };
    };
  };
}

interface BggPlayItem {
  id: string | number;
  date: string;
  quantity?: string | number;
  length?: string | number;
  location?: string;
  incomplete?: string | number | boolean;
  nowinstats?: string | number | boolean;
  comments?: string;
  item?: { objectid?: string | number; id?: string | number; name?: string } | Array<{ objectid?: string | number; id?: string | number; name?: string }>;
  players?: {
    player?: BggPlayPlayer | BggPlayPlayer[];
  };
}

interface BggPlayPlayer {
  username?: string;
  userid?: string | number;
  name?: string;
  score?: string;
  win?: string | number | boolean;
  color?: string;
  rating?: string | number;
}

interface BggPollResult {
  value?: string;
  level?: string | number;
  numvotes?: string | number;
}

interface BggPollResultsGroup {
  numplayers?: number | string;
  result?: BggPollResult | BggPollResult[];
}

interface BggPoll {
  name?: string;
  results?: BggPollResultsGroup | BggPollResultsGroup[];
}

function flattenPollResults(
  results: BggPollResultsGroup | BggPollResultsGroup[] | undefined,
): BggPollResult[] {
  if (!results) return [];
  const groups = Array.isArray(results) ? results : [results];
  const flattened: BggPollResult[] = [];
  for (const group of groups) {
    const items = group.result;
    if (!items) continue;
    flattened.push(...(Array.isArray(items) ? items : [items]));
  }
  return flattened;
}

function toBool(value: unknown): boolean {
  return value === true || value === "1" || value === 1;
}

function toInt(value: unknown): number | null {
  if (value === undefined || value === null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function toFloat(value: unknown): number | null {
  if (value === undefined || value === null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function getPrimaryName(names: unknown): string {
  if (!names) return "Unknown";
  if (typeof names === "string") return decodeHtmlEntities(names);
  if (typeof names === "object" && names !== null && "value" in names && !Array.isArray(names)) {
    return decodeHtmlEntities(String((names as BggName).value));
  }
  const list = Array.isArray(names) ? names : [names];
  if (list.length === 0) return "Unknown";
  const primary = list.find(
    (n) => typeof n === "object" && n !== null && (n as BggName).type === "primary",
  ) as BggName | undefined;
  const first = list[0] as BggName | undefined;
  return decodeHtmlEntities(primary?.value ?? first?.value ?? "Unknown");
}

function extractLinkValues(
  links: Array<{ type?: string; value?: string }> | undefined,
  type: string,
): string[] {
  if (!links) return [];
  return links.filter((l) => l.type === type).map((l) => decodeHtmlEntities(l.value ?? "")).filter(Boolean);
}

function extractBoardgameRank(thing: BggThingItem): number | null {
  const ranks = thing.statistics?.ratings?.ranks?.rank;
  if (!ranks) return null;
  const list = Array.isArray(ranks) ? ranks : [ranks];
  const boardgame = list.find((r) => r.type === "subtype" && r.name === "boardgame");
  const value = boardgame?.value;
  if (value === undefined || value === "Not Ranked") return null;
  return toInt(value);
}

export function mapCollectionItemToEntry(
  item: BggCollectionItem,
  syncedAt: string,
): CollectionEntry {
  const stats = item.stats;
  const status = item.status;
  const subtype = (item.subtype ?? "boardgame") as GameSubtype;

  return {
    collId: Number(item.collid),
    bggId: Number(item.objectid),
    subtype,
    name: String(getPrimaryName(item.name)),
    yearPublished: toInt(item.yearpublished),
    imageUrl: item.image ?? null,
    thumbnailUrl: item.thumbnail ?? null,
    own: toBool(status?.own),
    prevOwned: toBool(status?.preowned),
    forTrade: toBool(status?.fortrade),
    want: toBool(status?.want),
    wantToPlay: toBool(status?.wanttoplay),
    wantToBuy: toBool(status?.wanttobuy),
    wishlist: toBool(status?.wishlist),
    preordered: toBool(status?.preordered),
    hasParts: toBool(status?.hasparts),
    wantParts: toBool(status?.wantparts),
    personalRating: toFloat(stats?.rating?.value),
    comment: item.comment ?? null,
    wishlistPriority: toInt(status?.wishlistpriority),
    numPlays: toInt(item.numplays) ?? 0,
    bggRating: toFloat(
      typeof stats?.rating?.average === "object"
        ? stats?.rating?.average?.value
        : stats?.rating?.average,
    ),
    bggRank: toInt(item.stats?.rating?.ranks?.rank?.[0]?.value),
    lastModified: status?.lastmodified ?? null,
    syncedAt,
  };
}

function extractLanguageDependence(thing: BggThingItem): string | null {
  const polls = thing.poll;
  if (!polls) return null;
  const list = Array.isArray(polls) ? polls : [polls];
  const poll = list.find((p) => p.name === "language_dependence");
  if (!poll) return null;

  const results = flattenPollResults(poll.results);
  if (results.length === 0) return null;

  let best: BggPollResult | null = null;
  let bestVotes = -1;
  for (const result of results) {
    const votes = toInt(result.numvotes) ?? 0;
    if (votes > bestVotes) {
      best = result;
      bestVotes = votes;
    }
  }
  return decodeHtmlEntitiesNullable(best?.value?.trim() || null);
}

export function mapThingItemToGame(item: BggThingItem, syncedAt: string): Game {
  return {
    bggId: Number(item.id),
    name: getPrimaryName(item.name),
    yearPublished: toInt(item.yearpublished?.value),
    minPlayers: toInt(item.minplayers?.value),
    maxPlayers: toInt(item.maxplayers?.value),
    playingTime: toInt(item.playingtime?.value),
    minPlayTime: toInt(item.minplaytime?.value),
    maxPlayTime: toInt(item.maxplaytime?.value),
    weight: toFloat(item.statistics?.ratings?.averageweight?.value),
    imageUrl: item.image ?? null,
    thumbnailUrl: item.thumbnail ?? null,
    description: stripHtmlToText(item.description),
    designers: extractLinkValues(item.link, "boardgamedesigner"),
    artists: extractLinkValues(item.link, "boardgameartist"),
    publishers: extractLinkValues(item.link, "boardgamepublisher"),
    mechanics: extractLinkValues(item.link, "boardgamemechanic"),
    categories: extractLinkValues(item.link, "boardgamecategory"),
    languageDependence: extractLanguageDependence(item),
    bggRating: toFloat(item.statistics?.ratings?.average?.value),
    bggRank: extractBoardgameRank(item),
    thingSyncedAt: syncedAt,
  };
}

export function mapPlayItem(
  play: BggPlayItem,
  syncedAt: string,
): { play: Play; players: PlayPlayer[] } {
  const playId = Number(play.id);
  const item = Array.isArray(play.item) ? play.item[0] : play.item;
  const mappedPlay: Play = {
    playId,
    bggId: Number(item?.objectid ?? item?.id ?? 0),
    gameName: decodeHtmlEntities(item?.name ?? "Unknown"),
    date: play.date,
    quantity: toInt(play.quantity) ?? 1,
    length: toInt(play.length) ?? 0,
    location: play.location ?? "",
    incomplete: toBool(play.incomplete),
    nowinstats: toBool(play.nowinstats),
    comments: play.comments ?? null,
    syncedAt,
  };

  const rawPlayers = play.players?.player;
  const playerList = rawPlayers
    ? Array.isArray(rawPlayers)
      ? rawPlayers
      : [rawPlayers]
    : [];

  const players: PlayPlayer[] = playerList.map((p) => ({
    playId,
    username: p.username ?? "",
    userid: toInt(p.userid),
    name: p.name ?? "",
    score: p.score ?? "",
    win: toBool(p.win),
    color: p.color ?? "",
    rating: toInt(p.rating),
  }));

  return { play: mappedPlay, players };
}

export function chunkArray<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

export function subtractDays(isoDate: string, days: number): string {
  const date = new Date(`${isoDate}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
}

export function formatModifiedSince(isoDateTime: string): string {
  return isoDateTime.slice(0, 10);
}
