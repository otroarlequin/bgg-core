import { searchFerreteriaIbermadrid } from "./ferreteriaibermadrid.js";
import { searchGameNerdz } from "./gamenerdz.js";
import { searchMalditoGames } from "./malditogames.js";
import { searchMathom } from "./mathom.js";
import { searchMiniatureMarket } from "./miniaturemarket.js";
import { searchNobleKnight } from "./nobleknight.js";
import type { StoreId, StoreOffer } from "./types.js";

export type StoreSearchFn = (
  query: string,
  options?: { limit?: number },
) => Promise<StoreOffer[]>;

export const storeSearchers: Record<StoreId, StoreSearchFn> = {
  gamenerdz: searchGameNerdz,
  miniaturemarket: searchMiniatureMarket,
  nobleknight: searchNobleKnight,
  mathom: searchMathom,
  ferreteriaibermadrid: searchFerreteriaIbermadrid,
  malditogames: searchMalditoGames,
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
  parsePrestashopSearchJson,
} from "./parsers.js";
export { resetStoreRateLimit, getStoreRequestDelayMs } from "./http.js";
export { enrichMiniatureMarketPublishers } from "./miniaturemarket.js";
