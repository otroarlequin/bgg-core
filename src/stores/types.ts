export const STORE_SOURCE_IDS = [
  "gamenerdz",
  "miniaturemarket",
  "nobleknight",
  "mathom",
  "malditogames",
  "ludonauta",
] as const;

/** Checkbox / searcher identity. Ludonauta expands into per-shop offers. */
export type StoreSourceId = (typeof STORE_SOURCE_IDS)[number];

/**
 * Shop identity on an offer. Direct searchers plus slugs mapped from
 * Ludonauta (amazon, ferreteria-ibermadrid, …).
 */
export type StoreId = StoreSourceId | (string & {});

/** ISO 3166-1 alpha-2 country of the shop, not the product origin. */
export type StoreCountry = "US" | "ES";

export type StoreCurrency = "USD" | "EUR";

export interface StoreInfo {
  id: StoreId;
  label: string;
  country: StoreCountry;
  currency: StoreCurrency;
}

export const STORES: readonly StoreInfo[] = [
  { id: "gamenerdz", label: "Game Nerdz", country: "US", currency: "USD" },
  {
    id: "miniaturemarket",
    label: "Miniature Market",
    country: "US",
    currency: "USD",
  },
  { id: "nobleknight", label: "Noble Knight", country: "US", currency: "USD" },
  { id: "mathom", label: "Mathom", country: "ES", currency: "EUR" },
  {
    id: "malditogames",
    label: "Maldito Games",
    country: "ES",
    currency: "EUR",
  },
  {
    id: "ludonauta",
    label: "Ludonauta (comparador)",
    country: "ES",
    currency: "EUR",
  },
];

export const STORE_IDS: StoreSourceId[] = [...STORE_SOURCE_IDS];

export const STORE_BY_ID: Record<string, StoreInfo> = Object.fromEntries(
  STORES.map((store) => [store.id, store]),
);

export const STORE_LABELS: Record<string, string> = Object.fromEntries(
  STORES.map((store) => [store.id, store.label]),
);

export const STORE_COUNTRIES: Record<string, StoreCountry> = Object.fromEntries(
  STORES.map((store) => [store.id, store.country]),
);

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
  /** Display name when `store` is a Ludonauta slug not in `STORES`. */
  storeLabel?: string | null;
  storeCountry?: StoreCountry | null;
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
