import { searchGameNerdz } from "./gamenerdz.js";
import { searchLudonauta } from "./ludonauta.js";
import { searchMalditoGames } from "./malditogames.js";
import { searchMathom } from "./mathom.js";
import { searchMiniatureMarket } from "./miniaturemarket.js";
import { searchNobleKnight } from "./nobleknight.js";
import type { StoreOffer, StoreSourceId } from "./types.js";

export type StoreSearchFn = (
  query: string,
  options?: { limit?: number },
) => Promise<StoreOffer[]>;

export const storeSearchers: Record<StoreSourceId, StoreSearchFn> = {
  gamenerdz: searchGameNerdz,
  miniaturemarket: searchMiniatureMarket,
  nobleknight: searchNobleKnight,
  mathom: searchMathom,
  malditogames: searchMalditoGames,
  ludonauta: searchLudonauta,
};

export * from "./types.js";
export {
  classifyNobleKnightCondition,
  parseGameNerdzSearchJson,
  parseLocalizedPrice,
  parseMalditoGamesSearchJson,
  parseMiniatureMarketSuggestHtml,
  parseMiniatureMarketManufacturer,
  parseNobleKnightSearchJson,
  parsePrestashopSearchHtml,
  parsePrestashopSearchJson,
} from "./parsers.js";
export {
  isIbermadridHost,
  isLudonautaUrl,
  ludonautaSearchUrl,
  mapLudonautaShop,
  parseLudonautaOfferTable,
  parseLudonautaSearchHtml,
} from "./ludonauta-parse.js";
export {
  describeStoreHttpStatus,
  describeStoreNetworkError,
  getStoreRequestDelayMs,
  isCloudflareChallenge,
  rateLimitedFetch,
  resetStoreRateLimit,
} from "./http.js";
export { enrichMiniatureMarketPublishers } from "./miniaturemarket.js";
