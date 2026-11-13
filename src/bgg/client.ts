import { BggClient } from "bgg-api-ts";
import { BGG_FETCH_TIMEOUT_MS, installBggFetchTimeout } from "./http.js";

const BGG_API_BASE = "https://boardgamegeek.com/xmlapi2/";

export function createBggClient(token: string): BggClient {
  // bgg-api-ts 1.0.0 hardcodes a 30s AbortController and has no timeout/fetch options.
  installBggFetchTimeout(BGG_FETCH_TIMEOUT_MS);
  return new BggClient(BGG_API_BASE, token);
}

export type { BggClient };
export { BGG_FETCH_TIMEOUT_MS } from "./http.js";
