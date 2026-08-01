import type {
  CollectionItem,
  CollectionQueryParams,
  CollectionFacets,
  DashboardSummary,
  DuelOutput,
  DuelPoolFilters,
  PlayItem,
  PlayStats,
  PlaysQueryParams,
  PurchaseValidatorOutput,
  MatchFacet,
  PurchaseDecision,
  ShelfOfShameItem,
  WhatToPlaySuggestion,
  PlayCalendarResult,
  PlayCalendarDayPlay,
  SmartWishlistResult,
  SmartWishlistMode,
  HotnessScoutResult,
  SyncApiResult,
  AppSettings,
  UpdateSettingsResult,
} from "./types";

export class ApiError extends Error {
  status: number;
  body: unknown;

  constructor(status: number, message: string, body?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
  }
}

function isProfileMode(): boolean {
  return (
    typeof window !== "undefined" &&
    window.location.pathname.startsWith("/profile")
  );
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    credentials: isProfileMode() ? "include" : (init?.credentials ?? "same-origin"),
  });
  const text = await res.text();
  const contentType = res.headers.get("content-type") ?? "";
  const looksHtml =
    contentType.includes("text/html") ||
    /^\s*<(!doctype|html)/i.test(text);

  if (!res.ok) {
    let message = text || `HTTP ${res.status}`;
    let body: unknown;
    if (looksHtml) {
      message = `HTTP ${res.status} (HTML en lugar de JSON). ¿API desactualizada? Reinicia el servidor.`;
    } else {
      try {
        body = JSON.parse(text) as { message?: string };
        if (
          body &&
          typeof body === "object" &&
          "message" in body &&
          typeof (body as { message?: unknown }).message === "string"
        ) {
          message = (body as { message: string }).message;
        }
      } catch {
        // keep text
      }
    }
    if (isProfileMode() && res.status === 401) {
      window.dispatchEvent(
        new CustomEvent("bgg-profile-session-lost", { detail: { message } }),
      );
    }
    throw new ApiError(res.status, message, body);
  }

  if (looksHtml) {
    throw new ApiError(
      res.status,
      `La API devolvió HTML en ${url}. Reinicia el servidor local (npm run dev:api) o despliega la versión nueva.`,
    );
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    throw new ApiError(res.status, `JSON inválido desde ${url}`);
  }
}

function toQuery(params: object): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === "") continue;
    if (Array.isArray(value)) {
      for (const item of value) {
        if (item) search.append(key, String(item));
      }
      continue;
    }
    search.set(key, String(value));
  }
  const q = search.toString();
  return q ? `?${q}` : "";
}

export function fetchSummary(): Promise<DashboardSummary> {
  return fetchJson("/api/summary");
}

export function fetchCollection(
  params: CollectionQueryParams = {},
): Promise<{ total: number; items: CollectionItem[] }> {
  return fetchJson(`/api/collection${toQuery(params)}`);
}

export function fetchCollectionFacets(
  params: CollectionQueryParams = {},
): Promise<CollectionFacets> {
  return fetchJson(`/api/collection/facets${toQuery(params)}`);
}

export function fetchPlays(
  params: PlaysQueryParams = {},
): Promise<{ total: number; items: PlayItem[] }> {
  return fetchJson(`/api/plays${toQuery(params)}`);
}

export function fetchPlayStats(
  params: PlaysQueryParams = {},
): Promise<PlayStats> {
  return fetchJson(`/api/plays/stats${toQuery(params)}`);
}

export function postDuelAction(body: {
  action: "create" | "next" | "choose" | "result" | "status" | "abandon";
  from?: string;
  to?: string;
  minPlays?: number;
  sessionId?: number;
  winnerBggId?: number;
  force?: boolean;
  filters?: DuelPoolFilters;
}): Promise<DuelOutput> {
  return fetchJson("/api/activities/pairwise-duel", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export function postPurchaseValidator(body: {
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
}): Promise<PurchaseValidatorOutput> {
  return fetchJson("/api/activities/purchase-validator", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export function fetchShelfOfShame(params: {
  includeExpansions?: boolean;
  limit?: number;
} = {}): Promise<{ total: number; items: ShelfOfShameItem[] }> {
  return fetchJson(`/api/activities/shelf-of-shame${toQuery(params)}`);
}

export function postWhatToPlay(body: {
  players: number;
  maxTimeMinutes: number;
  maxWeight?: number;
  ownedOnly?: boolean;
  includeExpansions?: boolean;
  categories?: string[];
  mechanics?: string[];
  languageDependence?: string;
  count?: number;
  seed?: number;
}): Promise<{
  total: number;
  poolTotal: number;
  suggestions: WhatToPlaySuggestion[];
}> {
  return fetchJson("/api/activities/what-to-play", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export function fetchPlayCalendar(params: {
  from?: string;
  to?: string;
} = {}): Promise<PlayCalendarResult> {
  return fetchJson(`/api/activities/play-calendar${toQuery(params)}`);
}

export function fetchPlayCalendarDay(
  date: string,
): Promise<{ date: string; total: number; items: PlayCalendarDayPlay[] }> {
  return fetchJson(`/api/activities/play-calendar/day${toQuery({ date })}`);
}

export function fetchSmartWishlist(params: {
  mode?: SmartWishlistMode;
  includeWantToPlay?: boolean;
  includeExpansions?: boolean;
} = {}): Promise<SmartWishlistResult> {
  return fetchJson(`/api/activities/smart-wishlist${toQuery(params)}`);
}

export function fetchHotnessScout(params: {
  mode?: SmartWishlistMode;
  includeExpansions?: boolean;
} = {}): Promise<HotnessScoutResult> {
  return fetchJson(`/api/activities/hotness-scout${toQuery(params)}`);
}

export function triggerSync(params: {
  collection?: boolean;
  plays?: boolean;
} = {}): Promise<SyncApiResult> {
  return fetchJson("/api/sync", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
}

export function fetchSettings(): Promise<AppSettings> {
  return fetchJson("/api/settings");
}

export function updateSettings(params: {
  bggUsername: string;
  confirmReplace?: boolean;
}): Promise<UpdateSettingsResult> {
  return fetchJson("/api/settings", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
}

export interface ProfileSessionView {
  username: string;
  createdAt: string;
  lastAccessAt: string;
  expiresAt: string;
  ttlMs: number;
}

export interface ProfileSyncResult {
  username: string;
  collection: { count: number; incremental: boolean };
  plays: { count: number; incremental: boolean };
  things: { requested: number; synced: number; skipped: number };
  durationMs: number;
}

export function fetchProfileSession(): Promise<{
  active: boolean;
  session?: ProfileSessionView;
}> {
  return fetchJson("/api/profile/session");
}

export function createProfileSession(username: string): Promise<{
  ok: boolean;
  message?: string;
  session?: ProfileSessionView;
  sync?: ProfileSyncResult;
}> {
  return fetchJson("/api/profile/session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username }),
  });
}

export function endProfileSession(): Promise<{ ok: boolean }> {
  return fetchJson("/api/profile/session", { method: "DELETE" });
}
