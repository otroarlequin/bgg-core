import type { StoreOffer } from "./types.js";

interface StorePassProduct {
  name?: string;
  display_name?: string;
  price?: number;
  current_price?: number;
  usd_price?: number;
  stock?: number;
  totalInventory?: number;
  availability?: string;
  url?: string;
  sku?: string;
  product_data?: {
    publishers?: string[];
  };
  productLineData?: {
    publishers?: string[];
  };
}

interface StorePassSearchResponse {
  products?: StorePassProduct[];
  count?: number;
}

function firstPublisher(product: StorePassProduct): string | null {
  const fromData = product.product_data?.publishers;
  if (Array.isArray(fromData) && fromData[0]?.trim()) {
    return fromData[0].trim();
  }
  const fromLine = product.productLineData?.publishers;
  if (Array.isArray(fromLine) && fromLine[0]?.trim()) {
    return fromLine[0].trim();
  }
  return null;
}

export function parseGameNerdzSearchJson(
  raw: unknown,
  limit = 10,
): StoreOffer[] {
  const data = raw as StorePassSearchResponse;
  const products = Array.isArray(data.products) ? data.products : [];
  const offers: StoreOffer[] = [];

  for (const product of products.slice(0, limit)) {
    const name = (product.display_name || product.name || "").trim();
    if (!name) continue;
    const url = product.url?.trim();
    if (!url) continue;

    const stock = Number(product.stock ?? product.totalInventory ?? 0);
    const priceRaw =
      product.price ?? product.usd_price ?? product.current_price ?? null;
    const price =
      priceRaw != null && Number.isFinite(Number(priceRaw))
        ? Number(priceRaw)
        : null;

    offers.push({
      store: "gamenerdz",
      name,
      price,
      currency: "USD",
      url,
      sku: product.sku?.trim() || null,
      inStock: stock > 0,
      publisher: firstPublisher(product),
    });
  }

  return offers;
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (_, n: string) =>
      String.fromCodePoint(Number(n)),
    );
}

/**
 * Parse Miniature Market /suggest HTML fragment into offers.
 */
export function parseMiniatureMarketSuggestHtml(
  html: string,
  limit = 12,
): StoreOffer[] {
  const offers: StoreOffer[] = [];
  const itemRe =
    /<li class="search-suggest-product[\s\S]*?<\/li>/gi;
  const items = html.match(itemRe) ?? [];

  for (const item of items) {
    if (offers.length >= limit) break;

    const linkMatch = item.match(
      /href="([^"]+)"[\s\S]*?title="([^"]+)"[\s\S]*?class="search-suggest-product-link"|href="([^"]+)"[^>]*class="search-suggest-product-link"[^>]*title="([^"]+)"/i,
    );
    let url = "";
    let title = "";
    if (linkMatch) {
      url = (linkMatch[1] || linkMatch[3] || "").trim();
      title = decodeHtmlEntities((linkMatch[2] || linkMatch[4] || "").trim());
    }
    if (!url || !title) {
      const alt = item.match(
        /class="search-suggest-product-link"[^>]*href="([^"]+)"[^>]*title="([^"]+)"/i,
      );
      if (alt) {
        url = alt[1].trim();
        title = decodeHtmlEntities(alt[2].trim());
      }
    }
    if (!url || !title) continue;

    if (url.startsWith("/")) {
      url = `https://www.miniaturemarket.com${url}`;
    }

    const priceMatch = item.match(
      /search-suggest-product-price[^>]*>\s*\$?\s*([\d,]+(?:\.\d{2})?)/i,
    );
    const price = priceMatch
      ? Number(priceMatch[1].replace(/,/g, ""))
      : null;

    const skuMatch = url.match(/\/([A-Z0-9][A-Z0-9.\-]+)$/i);
    const isPreorder = /\bpreorder\b/i.test(title);

    offers.push({
      store: "miniaturemarket",
      name: title,
      price: price != null && Number.isFinite(price) ? price : null,
      currency: "USD",
      url,
      sku: skuMatch?.[1] ?? null,
      inStock: isPreorder ? false : true,
      publisher: null,
    });
  }

  return offers;
}

/**
 * Extract Manufacturer from Miniature Market product detail HTML
 * (Product Details section).
 */
export function parseMiniatureMarketManufacturer(html: string): string | null {
  // Common Magento-ish patterns: label "Manufacturer" then value link/text
  const patterns = [
    /Manufacturer<\/(?:th|td|dt|span|div)>\s*<(?:td|dd|span|div)[^>]*>\s*(?:<a[^>]*>)?\s*([^<]+)/i,
    /data-th="Manufacturer"[^>]*>\s*(?:<a[^>]*>)?\s*([^<]+)/i,
    /itemprop="brand"[^>]*>\s*(?:<[^>]+>)?\s*([^<]+)/i,
    /Manufacturer[^<]{0,40}<\/[^>]+>\s*<[^>]+>\s*(?:<a[^>]*>)?\s*([A-Za-z0-9][^<]{1,80})/i,
  ];

  for (const re of patterns) {
    const m = html.match(re);
    if (m?.[1]) {
      const value = decodeHtmlEntities(m[1].trim());
      if (value && !/^manufacturer$/i.test(value)) return value;
    }
  }
  return null;
}
