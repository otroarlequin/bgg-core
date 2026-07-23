import { BggClient } from "bgg-api-ts";

const BGG_API_BASE = "https://boardgamegeek.com/xmlapi2/";

export function createBggClient(token: string): BggClient {
  return new BggClient(BGG_API_BASE, token);
}

export type { BggClient };
