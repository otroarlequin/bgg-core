import { rateLimitedFetch } from "./http.js";
import { parseGameNerdzSearchJson } from "./parsers.js";
import type { StoreOffer } from "./types.js";

/** Public StorePass store id embedded in Game Nerdz storefront. */
const DEFAULT_STORE_ID = "OvpVz0pNlL";

export function getGameNerdzStoreId(): string {
  return process.env.GAMENERDZ_STORE_ID?.trim() || DEFAULT_STORE_ID;
}

export async function searchGameNerdz(
  query: string,
  options: { limit?: number } = {},
): Promise<StoreOffer[]> {
  const limit = options.limit ?? 10;
  const storeId = getGameNerdzStoreId();
  const params = new URLSearchParams({
    store_id: storeId,
    name: query,
    limit: String(limit),
    product_line: "All",
  });
  const url = `https://store.storepass.co/saas/search?${params}`;
  const res = await rateLimitedFetch(url, {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) {
    throw new Error(`Game Nerdz HTTP ${res.status}`);
  }
  const json: unknown = await res.json();
  return parseGameNerdzSearchJson(json, limit);
}
