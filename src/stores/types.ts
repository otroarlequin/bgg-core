export type StoreId = "gamenerdz" | "miniaturemarket" | "nobleknight";

export const STORE_IDS: StoreId[] = ["gamenerdz", "miniaturemarket", "nobleknight"];

export const STORE_LABELS: Record<StoreId, string> = {
  gamenerdz: "Game Nerdz",
  miniaturemarket: "Miniature Market",
  nobleknight: "Noble Knight",
};

/** new = factory new; sealed = still shrink-wrapped but box graded below mint. */
export type ConditionKind = "new" | "sealed" | "used";

/** One graded copy of a product (Noble Knight lists each condition separately). */
export interface StoreOfferVariant {
  /** Store grade code, e.g. "SW (MINT/New)", "VG+/NM" (box/contents). */
  condition: string;
  conditionKind: ConditionKind;
  price: number;
  quantity: number | null;
}

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
  /** Condition of the copy behind `price` (cheapest in-stock variant). */
  condition?: string | null;
  conditionKind?: ConditionKind | null;
  /** In-stock graded copies, cheapest first. */
  variants?: StoreOfferVariant[];
  /**
   * Listed only under a product line ("Jagged Earth" in "Spirit Island"), so
   * it is an expansion/spin-off of that line, never the base game itself.
   */
  lineSubProduct?: boolean;
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
