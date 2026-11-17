import { isCloudflareChallengeError } from "./http.js";
import { searchPrestashopStore } from "./prestashop.js";
import type { StoreOffer } from "./types.js";

/**
 * Live Node probes (home IP, browser-like headers) saw Cloudflare
 * `cf-mitigated: challenge` on homepage, `/busqueda` ajax+HTML, sitemap,
 * CSS, images and `/api`. `robots.txt` is Cloudflare's content-signals
 * file, not a catalog. There is no unchallenged public search; we do not
 * solve JS challenges.
 */
export const IBERMADRID_CLOUDFLARE_ERROR =
  "Ferretería Ibermadrid no se puede consultar: Cloudflare bloquea el catálogo con un desafío JavaScript. No hay una búsqueda pública alternativa.";

export async function searchFerreteriaIbermadrid(
  query: string,
  options: { limit?: number } = {},
): Promise<StoreOffer[]> {
  try {
    return await searchPrestashopStore(
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
  } catch (error) {
    if (isCloudflareChallengeError(error)) {
      throw new Error(IBERMADRID_CLOUDFLARE_ERROR);
    }
    throw error;
  }
}
