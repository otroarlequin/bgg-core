import { rateLimitedFetch } from "./http.js";
import { parsePrestashopSearchJson } from "./parsers.js";
import type { StoreOffer } from "./types.js";

export async function searchFerreteriaIbermadrid(
  query: string,
  options: { limit?: number } = {},
): Promise<StoreOffer[]> {
  const limit = options.limit ?? 10;
  const params = new URLSearchParams({
    controller: "search",
    s: query,
    ajax: "1",
  });
  const url = `https://ferreteriaibermadrid.es/busqueda?${params}`;
  const res = await rateLimitedFetch(url, {
    headers: {
      Accept: "application/json",
      "X-Requested-With": "XMLHttpRequest",
      "Accept-Language": "es-ES,es;q=0.9",
    },
  });
  if (!res.ok) {
    throw new Error(`Ferretería Ibermadrid HTTP ${res.status}`);
  }
  const json: unknown = await res.json();
  return parsePrestashopSearchJson(json, "ferreteriaibermadrid", limit);
}
