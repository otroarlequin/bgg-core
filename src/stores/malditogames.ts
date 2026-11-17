import {
  describeStoreHttpStatus,
  isCloudflareChallenge,
  rateLimitedFetch,
} from "./http.js";
import { parseMalditoGamesSearchJson } from "./parsers.js";
import type { StoreOffer } from "./types.js";

const MALDITO_ORIGIN = "https://tienda.malditogames.com";
const MALDITO_GRAPHQL = `${MALDITO_ORIGIN}/graphql`;

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
  let res: Response;
  try {
    res = await rateLimitedFetch(
      MALDITO_GRAPHQL,
      {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          "Accept-Language": "es-ES,es;q=0.9,en;q=0.8",
          Origin: MALDITO_ORIGIN,
          Referer: `${MALDITO_ORIGIN}/`,
          Store: "default",
          "Sec-Fetch-Dest": "empty",
          "Sec-Fetch-Mode": "cors",
          "Sec-Fetch-Site": "same-origin",
        },
        body: JSON.stringify({
          query: PRODUCTS_SEARCH_QUERY,
          variables: { query, pageSize: limit },
        }),
      },
      { warmupUrl: `${MALDITO_ORIGIN}/` },
    );
  } catch (error) {
    throw new Error(
      `Maldito Games ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  const text = await res.text();
  if (!res.ok || isCloudflareChallenge(res, text)) {
    throw new Error(`Maldito Games ${describeStoreHttpStatus(res, text)}`);
  }

  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error("Maldito Games respuesta no JSON");
  }

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
