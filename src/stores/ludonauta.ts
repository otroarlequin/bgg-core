import {
  TITLE_AMBIGUOUS_MIN,
  TITLE_MATCH_THRESHOLD,
  scoreTitleMatch,
} from "../utils/title-match.js";
import {
  describeStoreHttpStatus,
  isCloudflareChallenge,
  rateLimitedFetch,
} from "./http.js";
import {
  LUDONAUTA_ORIGIN,
  isLudonautaUrl,
  ludonautaSearchUrl,
  parseLudonautaOfferTable,
  parseLudonautaSearchHtml,
  type LudonautaSearchHit,
} from "./ludonauta-parse.js";
import type { StoreOffer } from "./types.js";

const HTML_ACCEPT =
  "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8";

async function fetchLudonautaHtml(url: string): Promise<string> {
  if (!isLudonautaUrl(url)) {
    throw new Error("Ludonauta: URL fuera de ludonauta.es");
  }
  let res: Response;
  try {
    res = await rateLimitedFetch(
      url,
      {
        method: "GET",
        headers: {
          Accept: HTML_ACCEPT,
          Referer: `${LUDONAUTA_ORIGIN}/`,
        },
      },
      { warmupUrl: `${LUDONAUTA_ORIGIN}/` },
    );
  } catch (error) {
    throw new Error(
      `Ludonauta ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  const text = await res.text();
  if (!res.ok || isCloudflareChallenge(res, text)) {
    throw new Error(`Ludonauta ${describeStoreHttpStatus(res, text)}`);
  }
  return text;
}

function pickHitsToFetch(
  hits: LudonautaSearchHit[],
  query: string,
  productPages: number,
): LudonautaSearchHit[] {
  const ranked = hits
    .map((hit) => ({ hit, score: scoreTitleMatch(query, hit.name) }))
    .filter((row) => row.score >= TITLE_AMBIGUOUS_MIN)
    .sort((a, b) => b.score - a.score || a.hit.name.localeCompare(b.hit.name, "es"));

  const strong = ranked.filter((row) => row.score >= TITLE_MATCH_THRESHOLD);
  const chosen = (strong.length > 0 ? strong : ranked.slice(0, 1)).slice(
    0,
    productPages,
  );
  return chosen.map((row) => row.hit);
}

export async function searchLudonauta(
  query: string,
  options: { limit?: number; productPages?: number } = {},
): Promise<StoreOffer[]> {
  const limit = options.limit ?? 10;
  const productPages = Math.min(3, Math.max(1, options.productPages ?? 2));
  const q = query.trim();
  if (!q) return [];

  const searchHtml = await fetchLudonautaHtml(ludonautaSearchUrl(q));

  const hits = parseLudonautaSearchHtml(searchHtml).slice(0, limit);
  const toFetch = pickHitsToFetch(hits, q, productPages);
  const offers: StoreOffer[] = [];
  const seen = new Set<string>();

  const pushOffers = (list: StoreOffer[]) => {
    for (const offer of list) {
      const key = `${offer.store}\0${offer.url}`;
      if (seen.has(key)) continue;
      seen.add(key);
      offers.push(offer);
    }
  };

  for (const hit of toFetch) {
    try {
      const pageHtml = await fetchLudonautaHtml(hit.url);
      const tableOffers = parseLudonautaOfferTable(pageHtml, hit.name, {
        lineSubProduct: hit.lineSubProduct,
      });
      pushOffers(tableOffers.length > 0 ? tableOffers : hit.previewOffers);
    } catch {
      pushOffers(hit.previewOffers);
    }
  }

  if (offers.length === 0) {
    for (const hit of hits) pushOffers(hit.previewOffers);
  }

  return offers;
}
