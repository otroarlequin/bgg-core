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
} from "./types";

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) {
    const text = await res.text();
    let message = text || `HTTP ${res.status}`;
    try {
      const parsed = JSON.parse(text) as { message?: string };
      if (parsed.message) message = parsed.message;
    } catch {
      // keep text
    }
    throw new Error(message);
  }
  return res.json() as Promise<T>;
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
