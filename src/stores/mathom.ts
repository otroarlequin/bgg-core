import { searchPrestashopStore } from "./prestashop.js";
import type { StoreOffer } from "./types.js";

export async function searchMathom(
  query: string,
  options: { limit?: number } = {},
): Promise<StoreOffer[]> {
  return searchPrestashopStore(
    {
      store: "mathom",
      label: "Mathom",
      origin: "https://mathom.es",
      searchPath: "/es/buscar",
      warmupPath: "/es/",
    },
    query,
    options,
  );
}
