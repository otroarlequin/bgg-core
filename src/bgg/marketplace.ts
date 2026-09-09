import type { BggClient } from "./client.js";
import { chunkArray } from "./mappers.js";

export interface MarketListing {
  listingKey: string;
  price: number | null;
  currency: string | null;
  condition: string | null;
  listDate: string | null;
  notes: string | null;
  url: string;
}

export interface MarketThingResult {
  bggId: number;
  name: string;
  listings: MarketListing[];
}

export type MarketFetchFn = (
  bggIds: number[],
) => Promise<MarketThingResult[]>;

/** BGG uses `/market/product/{id}`; older docs/fixtures may use `/geekmarket/product/`. */
const PRODUCT_ID_RE = /\/(?:geek)?market\/product\/(\d+)/i;
const BATCH_SIZE = 20;

interface RawListing {
  listdate?: { value?: string };
  price?: { currency?: string; value?: string | number };
  condition?: { value?: string };
  notes?: { value?: string };
  /** Live XML→JSON often yields an array of one link. */
  link?:
    | { href?: string; title?: string }
    | Array<{ href?: string; title?: string }>;
}

interface RawThingItem {
  id?: string | number;
  name?: Array<{ type?: string; value?: string }> | { type?: string; value?: string };
  /** Typings in bgg-api-ts say `marketplace`; live API returns `marketplacelistings`. */
  marketplace?: { listing?: RawListing | RawListing[] };
  marketplacelistings?: { listing?: RawListing | RawListing[] };
}

function asArray<T>(value: T | T[] | undefined | null): T[] {
  if (value == null) return [];
  return Array.isArray(value) ? value : [value];
}

function primaryName(item: RawThingItem): string {
  const names = asArray(item.name);
  const primary = names.find((n) => n.type === "primary") ?? names[0];
  return (primary?.value ?? `Thing ${item.id ?? "?"}`).trim();
}

export function listingKeyFromUrl(url: string): string {
  const match = url.match(PRODUCT_ID_RE);
  if (match?.[1]) return match[1];
  return url.trim();
}

function listingHref(raw: RawListing): string | null {
  const links = asArray(raw.link);
  for (const link of links) {
    const href = link?.href?.trim();
    if (href) return href;
  }
  return null;
}

export function mapMarketplaceListing(raw: RawListing): MarketListing | null {
  const href = listingHref(raw);
  if (!href) return null;
  const url = href.startsWith("http")
    ? href
    : `https://boardgamegeek.com${href.startsWith("/") ? "" : "/"}${href}`;
  const priceRaw = raw.price?.value;
  const price =
    priceRaw != null && Number.isFinite(Number(priceRaw))
      ? Number(priceRaw)
      : null;
  return {
    listingKey: listingKeyFromUrl(url),
    price,
    currency: raw.price?.currency?.trim() || null,
    condition: raw.condition?.value?.trim().toLowerCase() || null,
    listDate: raw.listdate?.value?.trim() || null,
    notes: raw.notes?.value?.trim() || null,
    url,
  };
}

function rawListingsFromItem(item: RawThingItem): RawListing[] {
  return asArray(
    item.marketplacelistings?.listing ?? item.marketplace?.listing,
  );
}

export function mapThingMarketplace(item: RawThingItem): MarketThingResult {
  const bggId = Number(item.id);
  const listings = rawListingsFromItem(item)
    .map(mapMarketplaceListing)
    .filter((l): l is MarketListing => l != null);
  return {
    bggId: Number.isFinite(bggId) ? bggId : 0,
    name: primaryName(item),
    listings,
  };
}

/**
 * Parse a BGG thing XML/JSON-shaped payload (from fixture or library) into market results.
 */
export function parseMarketplaceThingPayload(raw: unknown): MarketThingResult[] {
  const root = raw as {
    items?: { item?: RawThingItem | RawThingItem[] };
    item?: RawThingItem | RawThingItem[];
  };
  const items = asArray(root.items?.item ?? root.item);
  return items.map(mapThingMarketplace).filter((r) => r.bggId > 0);
}

export async function fetchMarketplaceForIds(
  client: BggClient,
  bggIds: number[],
): Promise<MarketThingResult[]> {
  const unique = [...new Set(bggIds.filter((id) => Number.isFinite(id) && id > 0))];
  const batches = chunkArray(unique, BATCH_SIZE);
  const out: MarketThingResult[] = [];

  for (const batch of batches) {
    if (batch.length === 0) continue;
    const result = await client.getThing(batch, { marketplace: true });
    const items = asArray(
      (result.items?.item ?? []) as RawThingItem | RawThingItem[],
    );
    for (const item of items) {
      out.push(mapThingMarketplace(item));
    }
  }

  return out;
}

export function createMarketFetchFn(client: BggClient): MarketFetchFn {
  return (ids) => fetchMarketplaceForIds(client, ids);
}
