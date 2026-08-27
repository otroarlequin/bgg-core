import { rateLimitedFetch } from "./http.js";
import {
  parseMiniatureMarketManufacturer,
  parseMiniatureMarketSuggestHtml,
} from "./parsers.js";
import type { StoreOffer } from "./types.js";

const DETAIL_ENRICH_LIMIT = 5;

export async function searchMiniatureMarket(
  query: string,
  options: { limit?: number; enrichManufacturer?: boolean } = {},
): Promise<StoreOffer[]> {
  const limit = options.limit ?? 12;
  const enrich = options.enrichManufacturer !== false;
  const params = new URLSearchParams({ search: query });
  const url = `https://www.miniaturemarket.com/suggest?${params}`;
  const res = await rateLimitedFetch(url, {
    headers: { Accept: "text/html,application/xhtml+xml" },
  });
  if (!res.ok) {
    throw new Error(`Miniature Market HTTP ${res.status}`);
  }
  const html = await res.text();
  const offers = parseMiniatureMarketSuggestHtml(html, limit);
  if (!enrich) return offers;
  return enrichMiniatureMarketPublishers(offers, DETAIL_ENRICH_LIMIT);
}

/**
 * Fetch product pages for top candidates and fill Manufacturer as publisher.
 * Failures leave publisher null; does not throw.
 */
export async function enrichMiniatureMarketPublishers(
  offers: StoreOffer[],
  maxDetails = DETAIL_ENRICH_LIMIT,
): Promise<StoreOffer[]> {
  const out: StoreOffer[] = [];
  let fetched = 0;

  for (const offer of offers) {
    if (fetched >= maxDetails || offer.publisher) {
      out.push(offer);
      continue;
    }
    fetched += 1;
    try {
      const res = await rateLimitedFetch(offer.url, {
        headers: { Accept: "text/html,application/xhtml+xml" },
      });
      if (!res.ok) {
        out.push(offer);
        continue;
      }
      const pageHtml = await res.text();
      const manufacturer = parseMiniatureMarketManufacturer(pageHtml);
      out.push({ ...offer, publisher: manufacturer });
    } catch {
      out.push(offer);
    }
  }

  return out;
}
