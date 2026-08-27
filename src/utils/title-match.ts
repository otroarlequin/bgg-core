const NOISE_TOKENS = new Set([
  "the",
  "a",
  "an",
  "and",
  "of",
  "edition",
  "ed",
  "deluxe",
  "kickstarter",
  "ks",
  "board",
  "game",
  "games",
  "expansion",
  "exp",
  "with",
  "pack",
]);

export function normalizeTitle(text: string): string {
  return text
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Keep noise-filtered tokens; preserve numeric edition markers (1, 2, 10). */
export function titleTokens(text: string, dropNoise = true): string[] {
  const tokens = normalizeTitle(text).split(" ").filter(Boolean);
  if (!dropNoise) return tokens;
  const filtered = tokens.filter(
    (t) => !NOISE_TOKENS.has(t) && (t.length > 1 || /^\d+$/.test(t)),
  );
  return filtered.length > 0 ? filtered : tokens;
}

function jaccard(a: string[], b: string[]): number {
  if (a.length === 0 || b.length === 0) return 0;
  const setA = new Set(a);
  const setB = new Set(b);
  let inter = 0;
  for (const t of setA) {
    if (setB.has(t)) inter += 1;
  }
  const union = setA.size + setB.size - inter;
  return union === 0 ? 0 : inter / union;
}

function numericTokens(tokens: string[]): string[] {
  return tokens.filter((t) => /^\d+$/.test(t));
}

function tokenSetEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const setB = new Set(b);
  return a.every((t) => setB.has(t));
}

/**
 * Score similarity between wishlist game title and store product title.
 * 1.0 = exact normalized match. Uses token overlap only (no raw substring).
 */
export function scoreTitleMatch(wishlistName: string, offerName: string): number {
  const a = normalizeTitle(wishlistName);
  const b = normalizeTitle(offerName);
  if (!a || !b) return 0;
  if (a === b) return 1;

  const tokensA = titleTokens(wishlistName);
  const tokensB = titleTokens(offerName);
  if (tokensA.length === 0 || tokensB.length === 0) return 0;

  if (tokenSetEqual(tokensA, tokensB)) return 1;

  // Distinct edition numbers (Main 2 vs Main 1) → hard reject
  const numsA = numericTokens(tokensA);
  const numsB = numericTokens(tokensB);
  if (numsA.length > 0 && numsB.length > 0) {
    const setB = new Set(numsB);
    const setA = new Set(numsA);
    const conflict =
      numsA.some((n) => !setB.has(n)) || numsB.some((n) => !setA.has(n));
    if (conflict) return 0.45;
  }

  let score = jaccard(tokensA, tokensB);

  const hit = tokensA.filter((t) => tokensB.includes(t)).length;
  const coverage = hit / tokensA.length;
  const extra = tokensB.length - tokensA.length;

  // Token-level containment (all wishlist tokens in offer), not string includes
  if (coverage === 1) {
    if (extra <= 2) {
      score = Math.max(score, 0.94);
    } else if (tokensA.length <= 2) {
      // Short titles (Rum) must not validate long unrelated products
      score = Math.min(score, 0.55);
    } else {
      score = Math.max(score, 0.75);
    }
  } else if (coverage >= 0.8 && tokensA.length >= 2) {
    score = Math.max(score, 0.8 + coverage * 0.08);
  }

  // Offer title fully contained in wishlist (rare) with similar length
  const offerInWishlist = tokensB.every((t) => tokensA.includes(t));
  if (offerInWishlist && tokensA.length <= tokensB.length + 2) {
    score = Math.max(score, 0.9);
  }

  return Math.min(1, score);
}

/** Normalize publisher / manufacturer names for comparison. */
export function normalizePublisher(text: string): string {
  return normalizeTitle(text)
    .replace(/\b(llc|ltd|inc|co|company|games?|publishing|editions?)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Adjust title score with publisher signal.
 * Match → slight boost; clear conflict → cap below strong threshold; missing data → unchanged.
 */
export function applyPublisherSignal(
  titleScore: number,
  bggPublishers: string[],
  offerPublisher: string | null | undefined,
): number {
  if (!offerPublisher?.trim() || bggPublishers.length === 0) {
    return titleScore;
  }

  const offerNorm = normalizePublisher(offerPublisher);
  if (!offerNorm) return titleScore;

  const bggNorms = bggPublishers
    .map((p) => normalizePublisher(p))
    .filter(Boolean);

  const matched = bggNorms.some(
    (p) =>
      p === offerNorm ||
      p.includes(offerNorm) ||
      offerNorm.includes(p),
  );

  if (matched) {
    return Math.min(1, titleScore + 0.08);
  }

  // Conflict: keep title signal but never strong-match on publisher mismatch alone
  return Math.min(titleScore, 0.78);
}

export const TITLE_MATCH_THRESHOLD = 0.9;
export const TITLE_AMBIGUOUS_MIN = 0.7;

export function buildSearchQuery(gameName: string): string {
  // Drop subtitle after colon/emdash for cleaner store search
  const base = gameName.split(/[:–—]/)[0]?.trim() || gameName;
  return base.slice(0, 80);
}
