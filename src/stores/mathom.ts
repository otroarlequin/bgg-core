import { rateLimitedFetch } from "./http.js";
import { parsePrestashopSearchJson } from "./parsers.js";
import type { StoreOffer } from "./types.js";

export async function searchMathom(
  query: string,
  options: { limit?: number } = {},
): Promise<StoreOffer[]> {
  const limit = options.limit ?? 10;
  const params = new URLSearchParams({ s: query, ajax: "1" });
  const url = `https://mathom.es/es/buscar?${params}`;
  const res = await rateLimitedFetch(url, {
    headers: {
      Accept: "application/json",
      "X-Requested-With": "XMLHttpRequest",
      "Accept-Language": "es-ES,es;q=0.9",
    },
  });
  if (!res.ok) {
    throw new Error(`Mathom HTTP ${res.status}`);
  }
  const json: unknown = await res.json();
  return parsePrestashopSearchJson(json, "mathom", limit);
}
