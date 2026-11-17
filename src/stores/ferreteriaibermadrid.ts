import { searchPrestashopStore } from "./prestashop.js";
import type { StoreOffer } from "./types.js";

export async function searchFerreteriaIbermadrid(
  query: string,
  options: { limit?: number } = {},
): Promise<StoreOffer[]> {
  return searchPrestashopStore(
    {
      store: "ferreteriaibermadrid",
      label: "Ferretería Ibermadrid",
      origin: "https://ferreteriaibermadrid.es",
      searchPath: "/busqueda",
      warmupPath: "/",
      extraParams: { controller: "search" },
    },
    query,
    options,
  );
}
