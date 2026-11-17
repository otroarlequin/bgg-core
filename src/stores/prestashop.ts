import {
  describeStoreHttpStatus,
  isCloudflareChallenge,
  rateLimitedFetch,
} from "./http.js";
import {
  parsePrestashopSearchHtml,
  parsePrestashopSearchJson,
} from "./parsers.js";
import type { StoreId, StoreOffer } from "./types.js";

const AJAX_ACCEPT = "application/json, text/javascript, */*; q=0.01";
const HTML_ACCEPT =
  "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8";

export interface PrestashopSearchConfig {
  store: StoreId;
  label: string;
  origin: string;
  searchPath: string;
  warmupPath: string;
  extraParams?: Record<string, string>;
}

function storeHttpError(label: string, res: Response, body?: string): Error {
  return new Error(`${label} ${describeStoreHttpStatus(res, body)}`);
}

function offersFromAjaxText(
  res: Response,
  text: string,
  store: StoreId,
  limit: number,
): StoreOffer[] | null {
  if (isCloudflareChallenge(res, text)) return null;
  try {
    const json: unknown = JSON.parse(text);
    return parsePrestashopSearchJson(json, store, limit);
  } catch {
    const htmlOffers = parsePrestashopSearchHtml(text, store, limit);
    return htmlOffers.length > 0 ? htmlOffers : null;
  }
}

/**
 * Browser-like PrestaShop 1.7 search: homepage warmup for public cookies,
 * ajax `?ajax=1` like the storefront XHR, then HTML search if ajax is blocked.
 */
export async function searchPrestashopStore(
  config: PrestashopSearchConfig,
  query: string,
  options: { limit?: number } = {},
): Promise<StoreOffer[]> {
  const limit = options.limit ?? 10;
  const extra = config.extraParams ?? {};
  const ajaxParams = new URLSearchParams({ ...extra, s: query, ajax: "1" });
  const htmlParams = new URLSearchParams({ ...extra, s: query });
  const ajaxUrl = `${config.origin}${config.searchPath}?${ajaxParams}`;
  const htmlUrl = `${config.origin}${config.searchPath}?${htmlParams}`;
  const warmupUrl = `${config.origin}${config.warmupPath}`;

  let ajaxError: Error | null = null;

  try {
    const ajaxRes = await rateLimitedFetch(
      ajaxUrl,
      {
        headers: {
          Accept: AJAX_ACCEPT,
          "X-Requested-With": "XMLHttpRequest",
          "Accept-Language": "es-ES,es;q=0.9,en;q=0.8",
          Referer: htmlUrl,
          Origin: config.origin,
          "Sec-Fetch-Dest": "empty",
          "Sec-Fetch-Mode": "cors",
          "Sec-Fetch-Site": "same-origin",
        },
      },
      { warmupUrl },
    );
    const ajaxText = await ajaxRes.text();
    if (ajaxRes.ok) {
      const offers = offersFromAjaxText(ajaxRes, ajaxText, config.store, limit);
      if (offers) return offers;
    }
    ajaxError = storeHttpError(config.label, ajaxRes, ajaxText);
  } catch (error) {
    ajaxError =
      error instanceof Error
        ? new Error(`${config.label} ${error.message}`)
        : new Error(`${config.label} ${String(error)}`);
  }

  let htmlRes: Response;
  try {
    htmlRes = await rateLimitedFetch(htmlUrl, {
      headers: {
        Accept: HTML_ACCEPT,
        "Accept-Language": "es-ES,es;q=0.9,en;q=0.8",
        Referer: warmupUrl,
        "Upgrade-Insecure-Requests": "1",
        "Sec-Fetch-Dest": "document",
        "Sec-Fetch-Mode": "navigate",
        "Sec-Fetch-Site": "same-origin",
      },
    });
  } catch (error) {
    throw ajaxError ??
      (error instanceof Error
        ? new Error(`${config.label} ${error.message}`)
        : new Error(`${config.label} ${String(error)}`));
  }

  const html = await htmlRes.text();
  if (htmlRes.ok && !isCloudflareChallenge(htmlRes, html)) {
    return parsePrestashopSearchHtml(html, config.store, limit);
  }

  throw ajaxError ?? storeHttpError(config.label, htmlRes, html);
}
