import { decodeHtmlEntities } from "../utils/html-entities.js";

export interface BrowseRankItem {
  rank: number;
  bggId: number;
  name: string;
  thumbnailUrl: string | null;
}

export type BrowsePageFetchFn = (page: number) => Promise<string>;

const BROWSE_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";

function browseUrl(page: number): string {
  return page <= 1
    ? "https://boardgamegeek.com/browse/boardgame"
    : `https://boardgamegeek.com/browse/boardgame/page/${page}`;
}

export async function defaultFetchBrowsePage(page: number): Promise<string> {
  const res = await fetch(browseUrl(page), {
    headers: {
      "User-Agent": BROWSE_UA,
      Accept: "text/html",
      "Accept-Language": "en-US,en;q=0.9",
    },
  });
  if (!res.ok) {
    throw new Error(`BGG browse HTTP ${res.status}`);
  }
  return res.text();
}

function extractBlockField(
  block: string,
  pattern: RegExp,
): string | null {
  const match = block.match(pattern);
  return match?.[1]?.trim() || null;
}

/**
 * Parse BGG /browse/boardgame HTML rows into rank + id + name + thumb.
 */
export function parseBrowseBoardgameHtml(html: string): BrowseRankItem[] {
  const blocks = html.split(/class="collection_rank"/i).slice(1);
  const items: BrowseRankItem[] = [];
  const seen = new Set<number>();

  for (const block of blocks) {
    const rankRaw = extractBlockField(block, /<a\s+name="(\d+)"/i);
    const rank = rankRaw ? Number(rankRaw) : NaN;
    const idRaw = extractBlockField(
      block,
      /href="\/boardgame\/(\d+)\/[^"]+"/i,
    );
    const bggId = idRaw ? Number(idRaw) : NaN;
    if (!Number.isFinite(rank) || rank < 1 || !Number.isFinite(bggId) || bggId < 1) {
      continue;
    }
    if (seen.has(bggId)) continue;
    seen.add(bggId);

    const nameRaw =
      extractBlockField(block, /class="primary"[^>]*>([^<]+)/i) ??
      extractBlockField(block, /alt="([^"]+)"/i);
    const thumb = extractBlockField(
      block,
      /<img[^>]+src="(https?:\/\/[^"]+)"/i,
    );

    items.push({
      rank,
      bggId,
      name: decodeHtmlEntities(nameRaw ?? `Juego #${bggId}`),
      thumbnailUrl: thumb,
    });
  }

  return items.sort((a, b) => a.rank - b.rank);
}

export async function fetchBrowseTop100(
  fetchPage: BrowsePageFetchFn = defaultFetchBrowsePage,
): Promise<BrowseRankItem[]> {
  const first = parseBrowseBoardgameHtml(await fetchPage(1));
  let merged = first;
  if (merged.length < 100) {
    const second = parseBrowseBoardgameHtml(await fetchPage(2));
    const seen = new Set(merged.map((item) => item.bggId));
    for (const item of second) {
      if (seen.has(item.bggId)) continue;
      seen.add(item.bggId);
      merged.push(item);
    }
    merged = merged.sort((a, b) => a.rank - b.rank);
  }
  return merged.filter((item) => item.rank >= 1 && item.rank <= 100).slice(0, 100);
}
