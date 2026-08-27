import { searchGameNerdz } from "./gamenerdz.js";
import { searchMiniatureMarket } from "./miniaturemarket.js";
import type { StoreId, StoreOffer } from "./types.js";

export type StoreSearchFn = (
  query: string,
  options?: { limit?: number },
) => Promise<StoreOffer[]>;

export const storeSearchers: Record<StoreId, StoreSearchFn> = {
  gamenerdz: searchGameNerdz,
  miniaturemarket: searchMiniatureMarket,
};

export * from "./types.js";
export {
  parseGameNerdzSearchJson,
  parseMiniatureMarketSuggestHtml,
  parseMiniatureMarketManufacturer,
} from "./parsers.js";
export { resetStoreRateLimit, getStoreRequestDelayMs } from "./http.js";
export { enrichMiniatureMarketPublishers } from "./miniaturemarket.js";
