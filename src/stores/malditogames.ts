import { rateLimitedFetch } from "./http.js";
import { parseMalditoGamesSearchJson } from "./parsers.js";
import type { StoreOffer } from "./types.js";

const MALDITO_GRAPHQL = "https://tienda.malditogames.com/graphql";

const PRODUCTS_SEARCH_QUERY = `
query StoreSearch($query: String!, $pageSize: Int!) {
  products(search: $query, pageSize: $pageSize) {
    items {
      name
      sku
      url_key
      url_suffix
      url_rewrites { url }
      stock_status
      price_range {
        minimum_price {
          final_price { value currency }
        }
      }
    }
  }
}
`;

export async function searchMalditoGames(
  query: string,
  options: { limit?: number } = {},
): Promise<StoreOffer[]> {
  const limit = options.limit ?? 10;
  const res = await rateLimitedFetch(MALDITO_GRAPHQL, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "Accept-Language": "es-ES,es;q=0.9",
    },
    body: JSON.stringify({
      query: PRODUCTS_SEARCH_QUERY,
      variables: { query, pageSize: limit },
    }),
  });
  if (!res.ok) {
    throw new Error(`Maldito Games HTTP ${res.status}`);
  }
  const json: unknown = await res.json();
  const offers = parseMalditoGamesSearchJson(json, limit);
  const payload = json as { errors?: Array<{ message?: string }> };
  if (
    offers.length === 0 &&
    Array.isArray(payload.errors) &&
    payload.errors.length > 0
  ) {
    const message = payload.errors
      .map((err) => err.message)
      .filter(Boolean)
      .join("; ");
    throw new Error(`Maldito Games GraphQL: ${message || "error"}`);
  }
  return offers;
}
