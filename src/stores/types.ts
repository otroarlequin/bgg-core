export type StoreId = "gamenerdz" | "miniaturemarket";

export const STORE_IDS: StoreId[] = ["gamenerdz", "miniaturemarket"];

export const STORE_LABELS: Record<StoreId, string> = {
  gamenerdz: "Game Nerdz",
  miniaturemarket: "Miniature Market",
};

export interface StoreOffer {
  store: StoreId;
  name: string;
  price: number | null;
  currency: string;
  url: string;
  sku: string | null;
  inStock: boolean | null;
  /** Store publisher / Manufacturer when known. */
  publisher: string | null;
}

export interface StoreSearchResult {
  store: StoreId;
  query: string;
  offers: StoreOffer[];
  fetchedAt: string;
}

export interface StoreSearchError {
  store: StoreId;
  query: string;
  error: string;
}
