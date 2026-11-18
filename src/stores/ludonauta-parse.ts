import { parseLocalizedPrice } from "./parsers.js";
import type { StoreCountry, StoreId, StoreOffer } from "./types.js";

export const LUDONAUTA_ORIGIN = "https://www.ludonauta.es";

/** Direct shop origin we never fetch; Ludonauta lists it via Awin. */
export const IBERMADRID_HOST_RE = /(^|\.)ferreteriaibermadrid\.es$/i;

const SHOP_ALIASES: Record<string, StoreId> = {
  mathom: "mathom",
  "maldito-games": "malditogames",
  malditogames: "malditogames",
  "ferreteria-ibermadrid": "ferreteria-ibermadrid",
  ferreteriaibermadrid: "ferreteria-ibermadrid",
};

function decodeEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&laquo;/g, "«")
    .replace(/&raquo;/g, "»")
    .replace(/&euro;/g, "€")
    .replace(/&#(\d+);/g, (_, n: string) =>
      String.fromCodePoint(Number(n)),
    );
}

function stripTags(html: string): string {
  return decodeEntities(html.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim());
}

function slugifyShop(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function mapLudonautaShop(
  label: string,
  imageSrc = "",
): { id: StoreId; label: string; country: StoreCountry } {
  const fromImage = imageSrc.match(/tienda-([a-z0-9-]+)-\d+/i)?.[1] ?? "";
  const slug = fromImage || slugifyShop(label);
  const id = SHOP_ALIASES[slug] ?? slug;
  return { id, label, country: "ES" };
}

export function isIbermadridHost(url: string): boolean {
  try {
    return IBERMADRID_HOST_RE.test(new URL(url).hostname);
  } catch {
    return false;
  }
}

export function isLudonautaUrl(url: string, origin = LUDONAUTA_ORIGIN): boolean {
  try {
    const host = new URL(url, origin).hostname.replace(/^www\./i, "");
    return host === "ludonauta.es";
  } catch {
    return false;
  }
}

export function ludonautaSearchUrl(
  query: string,
  origin = LUDONAUTA_ORIGIN,
): string {
  const q = encodeURIComponent(query.trim().toLowerCase());
  return `${origin}/buscar/${q}`;
}

export function ludonautaGameUrl(
  pathOrUrl: string,
  origin = LUDONAUTA_ORIGIN,
): string | null {
  const raw = decodeEntities(pathOrUrl).trim();
  if (!raw) return null;
  try {
    const url = new URL(raw, `${origin}/`);
    if (!isLudonautaUrl(url.href, origin)) return null;
    if (!/^\/juegos-mesas\/[a-z0-9-]+/i.test(url.pathname)) return null;
    if (/\/juegos-mesas\/listar/i.test(url.pathname)) return null;
    return `${origin}${url.pathname}`;
  } catch {
    return null;
  }
}

function parseStock(row: string): boolean | null {
  const text = row.toLowerCase();
  if (/sin stock|agotado|out of stock/.test(text)) return false;
  if (/pre-venta|preventa|reposición|reposicion/.test(text)) return false;
  if (/en stock/.test(text)) return true;
  return null;
}

function firstHttpHref(row: string): string | null {
  const match = row.match(/href="(https?:[^"]+)"/i);
  if (!match?.[1]) return null;
  return decodeEntities(match[1]);
}

function shopLabelFromRow(row: string): string | null {
  const titled =
    row.match(/Ir a tienda:\s*«([^»]+)»/i) ??
    row.match(/Ir a oferta:\s*«([^»]+)»/i) ??
    row.match(/Ir a tienda:\s*&laquo;([^&]+)&raquo;/i);
  const label = titled?.[1]?.trim();
  return label ? decodeEntities(label) : null;
}

export function parseLudonautaOfferRows(
  html: string,
  gameName: string,
  options: { lineSubProduct?: boolean } = {},
): StoreOffer[] {
  const rows = html.match(/<tr\b[\s\S]*?<\/tr>/gi) ?? [];
  const offers: StoreOffer[] = [];
  const seen = new Set<string>();

  for (const row of rows) {
    const label = shopLabelFromRow(row);
    const img = row.match(/src="([^"]*tienda-[^"]+)"/i)?.[1] ?? "";
    if (!label && !img) continue;
    const shop = mapLudonautaShop(label ?? slugifyShop(img), img);
    const url = firstHttpHref(row);
    if (!url) continue;
    const key = `${shop.id}\0${url}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const priceChunk =
      row.match(/product-price[\s\S]*?<\/span>/i)?.[0] ??
      row.match(/product-price[\s\S]{0,200}/i)?.[0] ??
      "";
    const price = parseLocalizedPrice(stripTags(priceChunk));

    offers.push({
      store: shop.id,
      storeLabel: shop.label || label,
      storeCountry: shop.country,
      name: gameName,
      price,
      currency: "EUR",
      url,
      sku: null,
      inStock: parseStock(row),
      publisher: null,
      lineSubProduct: options.lineSubProduct === true,
    });
  }

  return offers;
}

export function parseLudonautaOfferTable(
  html: string,
  gameName: string,
  options: { lineSubProduct?: boolean } = {},
): StoreOffer[] {
  const table = html.match(
    /<table\b[^>]*\bid=["']juegos-mesas-tiendas["'][^>]*>[\s\S]*?<\/table>/i,
  );
  if (!table) return [];
  const heading =
    html.match(/<h1>\s*Comprar\s*«([^»]+)»/i)?.[1]?.trim() ||
    html.match(/<h1>\s*Comprar\s*&laquo;([^&]+)&raquo;/i)?.[1]?.trim();
  const name = heading ? decodeEntities(heading) : gameName;
  return parseLudonautaOfferRows(table[0], name, options);
}

export interface LudonautaSearchHit {
  name: string;
  url: string;
  productType: string | null;
  lineSubProduct: boolean;
  previewOffers: StoreOffer[];
}

function isExpansionType(productType: string | null): boolean {
  if (!productType) return false;
  if (/integraci/i.test(productType)) return false;
  return /expansi[oó]n/i.test(productType);
}

export function parseLudonautaSearchHtml(
  html: string,
  origin = LUDONAUTA_ORIGIN,
): LudonautaSearchHit[] {
  const boxes = html.split(/ibox-content\s+product-box/i).slice(1);
  const hits: LudonautaSearchHit[] = [];
  const seen = new Set<string>();

  for (const box of boxes) {
    const nameLink = box.match(
      /<a\b[^>]*class="[^"]*product-name[^"]*"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i,
    ) ?? box.match(
      /<a\b[^>]*href="([^"]+)"[^>]*class="[^"]*product-name[^"]*"[^>]*>([\s\S]*?)<\/a>/i,
    );
    if (!nameLink) continue;
    const url = ludonautaGameUrl(nameLink[1], origin);
    if (!url || seen.has(url)) continue;
    const name = stripTags(nameLink[2]);
    if (!name) continue;
    seen.add(url);

    const productTypeRaw = box.match(
      /<div class="product-type[^"]*">([\s\S]*?)<\/div>/i,
    )?.[1];
    const productType = productTypeRaw ? stripTags(productTypeRaw) : null;
    const lineSubProduct = isExpansionType(productType);
    const table = box.match(/<table\b[\s\S]*?<\/table>/i)?.[0] ?? "";
    const previewOffers = table
      ? parseLudonautaOfferRows(table, name, { lineSubProduct })
      : [];

    hits.push({ name, url, productType, lineSubProduct, previewOffers });
  }

  return hits;
}
