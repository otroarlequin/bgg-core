import type {
  ConditionKind,
  StoreOffer,
  StoreOfferVariant,
} from "./types.js";

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

interface ZoovuDataPoint {
  key?: string;
  value?: unknown;
}

interface ZoovuProductVariant {
  name?: string;
  link?: string;
  dataPoints?: ZoovuDataPoint[];
}

interface ZoovuSearchResponse {
  searchResults?: Array<{
    type?: string;
    /** One inner array per product; each entry is a graded copy. */
    results?: ZoovuProductVariant[][];
  }>;
}

function zoovuData(variant: ZoovuProductVariant): Map<string, string> {
  const out = new Map<string, string>();
  for (const dp of variant.dataPoints ?? []) {
    if (!dp.key || dp.value == null) continue;
    out.set(dp.key, String(dp.value).trim());
  }
  return out;
}

/**
 * Noble Knight grade codes: "MINT/New" is factory new; "SW (...)" is still
 * shrink-wrapped; anything else ("VG+/NM" box/contents, "EX", "Fair") is used.
 */
export function classifyNobleKnightCondition(code: string): ConditionKind {
  const c = code.trim();
  if (/MINT\/New/i.test(c) || /^(MINT|New)$/i.test(c)) return "new";
  if (/^SW\b/i.test(c)) return "sealed";
  return "used";
}

/** Physical games; excludes playmats, inserts, sleeves, parts and "Collection" bundles. */
const NOBLE_KNIGHT_GAME_TYPES = new Set(["boxed game", "blister", "ziplock"]);

/**
 * NK names expansions without the base game ("Jagged Earth" in line "Spirit
 * Island"), so prefix the product line unless it is a generic shelf name.
 */
function nobleKnightMatchName(name: string, productLine: string | undefined): string {
  const line = productLine?.replace(/\([^)]*\)/g, "").trim();
  if (!line || /\b(games?|collections?|miscellaneous|promos?)\b/i.test(line)) {
    return name;
  }
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  if (norm(name).includes(norm(line))) return name;
  return `${line} - ${name}`;
}

/**
 * Parse Noble Knight's Zoovu search JSON. Each product groups its graded
 * copies; out-of-stock copies carry no price/condition and are dropped.
 */
export function parseNobleKnightSearchJson(
  raw: unknown,
  limit = 10,
): StoreOffer[] {
  const data = raw as ZoovuSearchResponse;
  const products =
    data.searchResults?.find((s) => s.type === "products")?.results ?? [];
  const offers: StoreOffer[] = [];

  for (const group of products) {
    if (offers.length >= limit) break;
    if (!Array.isArray(group) || group.length === 0) continue;

    const head = group[0];
    const rawName = head.name?.trim();
    const link = head.link?.trim();
    if (!rawName || !link) continue;
    const headData = zoovuData(head);
    if (headData.get("Category") !== "Board Games") continue;
    const productType = (headData.get("Product Types") ?? "").toLowerCase();
    if (!NOBLE_KNIGHT_GAME_TYPES.has(productType)) continue;
    const name = nobleKnightMatchName(rawName, headData.get("Product Line"));

    const variants: StoreOfferVariant[] = [];
    for (const copy of group) {
      const dp = zoovuData(copy);
      const condition = dp.get("Condition");
      const price = Number(dp.get("Price"));
      const quantity = Number(dp.get("Quantity"));
      const available = /in stock/i.test(dp.get("Available") ?? "");
      if (!condition || !Number.isFinite(price) || !available) continue;
      variants.push({
        condition,
        conditionKind: classifyNobleKnightCondition(condition),
        price,
        quantity: Number.isFinite(quantity) ? quantity : null,
      });
    }
    variants.sort((a, b) => a.price - b.price);
    const cheapest = variants[0] ?? null;

    offers.push({
      store: "nobleknight",
      name,
      price: cheapest?.price ?? null,
      currency: "USD",
      url: link.startsWith("http") ? link : `https://www.nobleknight.com${link}`,
      sku: headData.get("Product Code") || null,
      inStock: variants.length > 0,
      publisher: headData.get("Publisher") || null,
      condition: cheapest?.condition ?? null,
      conditionKind: cheapest?.conditionKind ?? null,
      variants,
      lineSubProduct: name !== rawName,
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
