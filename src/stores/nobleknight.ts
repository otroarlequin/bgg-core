import { rateLimitedFetch } from "./http.js";
import { parseNobleKnightSearchJson } from "./parsers.js";
import type { StoreOffer } from "./types.js";

/** Public Zoovu search project embedded in the Noble Knight storefront. */
const DEFAULT_PROJECT_ID = "43167";

export function getNobleKnightProjectId(): string {
  return process.env.NOBLEKNIGHT_ZOOVU_PROJECT_ID?.trim() || DEFAULT_PROJECT_ID;
}

export async function searchNobleKnight(
  query: string,
  options: { limit?: number } = {},
): Promise<StoreOffer[]> {
  const limit = options.limit ?? 10;
  const params = new URLSearchParams({
    projectId: getNobleKnightProjectId(),
    query,
    // Accessories (inserts, playmats, sleeves) crowd results and get filtered out.
    limit: String(Math.max(limit * 2, 20)),
  });
  const url = `https://api.search.zoovu.com/search?${params}`;
  const res = await rateLimitedFetch(url, {
    headers: {
      Accept: "application/json",
      Origin: "https://www.nobleknight.com",
      Referer: "https://www.nobleknight.com/",
    },
  });
  if (!res.ok) {
    throw new Error(`Noble Knight HTTP ${res.status}`);
  }
  const json: unknown = await res.json();
  return parseNobleKnightSearchJson(json, limit);
}
