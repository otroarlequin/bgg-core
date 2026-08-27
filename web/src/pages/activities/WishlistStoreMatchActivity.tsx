import { useState } from "react";
import { postWishlistStoreMatch } from "../../api/client";
import type {
  ScoredStoreOffer,
  StoreId,
  WishlistStoreMatchResult,
} from "../../api/types";
import { BggLink } from "../../components/BggLink";

const STORE_OPTIONS: Array<{ id: StoreId; label: string }> = [
  { id: "gamenerdz", label: "Game Nerdz" },
  { id: "miniaturemarket", label: "Miniature Market" },
];

function formatPrice(offer: ScoredStoreOffer): string {
  if (offer.price == null) return "—";
  return `$${offer.price.toFixed(2)} ${offer.currency}`;
}

function stockLabel(inStock: boolean | null): string {
  if (inStock === true) return "En stock";
  if (inStock === false) return "Sin stock / preorder";
  return "Stock desconocido";
}

const WISHLIST_PRIORITY_LABELS: Record<number, string> = {
  1: "Must have",
  2: "Love to have",
  3: "Like to have",
  4: "Thinking about it",
  5: "Don't buy this",
};

function wishlistPriorityLabel(priority: number | null | undefined): string | null {
  if (priority == null) return null;
  return WISHLIST_PRIORITY_LABELS[priority] ?? `Prioridad ${priority}`;
}

export function WishlistStoreMatchActivity() {
  const [stores, setStores] = useState<StoreId[]>([
    "gamenerdz",
    "miniaturemarket",
  ]);
  const [inStockOnly, setInStockOnly] = useState(true);
  const [maxItems, setMaxItems] = useState(20);
  const [forceRefresh, setForceRefresh] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<WishlistStoreMatchResult | null>(null);

  function toggleStore(id: StoreId) {
    setStores((prev) => {
      if (prev.includes(id)) {
        const next = prev.filter((s) => s !== id);
        return next.length > 0 ? next : prev;
      }
      return [...prev, id];
    });
  }

  async function handleScan() {
    setLoading(true);
    setError(null);
    try {
      const data = await postWishlistStoreMatch({
        action: "scan",
        stores,
        inStockOnly,
        maxItems,
        forceRefresh,
      });
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al escanear tiendas");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold tracking-tight text-ink">
          Wishlist × tiendas
        </h2>
        <p className="mt-1 text-sm text-muted">
          Busca en vivo cada juego de tu wishlist en Game Nerdz y Miniature
          Market. Uso personal: rate limit + caché ~24h. Los resultados pueden
          desactualizarse.
        </p>
      </div>

      <div className="rounded-xl border border-border bg-surface-raised/60 p-4 space-y-4">
        <div className="flex flex-wrap gap-4">
          {STORE_OPTIONS.map((opt) => (
            <label key={opt.id} className="flex items-center gap-2 text-sm text-ink">
              <input
                type="checkbox"
                checked={stores.includes(opt.id)}
                onChange={() => toggleStore(opt.id)}
              />
              {opt.label}
            </label>
          ))}
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <label className="flex items-center gap-2 text-sm text-ink">
            <input
              type="checkbox"
              checked={inStockOnly}
              onChange={(e) => setInStockOnly(e.target.checked)}
            />
            Solo en stock
          </label>
          <label className="flex items-center gap-2 text-sm text-ink">
            <input
              type="checkbox"
              checked={forceRefresh}
              onChange={(e) => setForceRefresh(e.target.checked)}
            />
            Forzar refresh (ignora caché)
          </label>
          <label className="text-sm text-ink">
            <span className="mb-1 block text-muted">Máx. juegos</span>
            <input
              type="number"
              min={1}
              max={100}
              className="w-full rounded-lg border border-border bg-surface-card px-3 py-2"
              value={maxItems}
              onChange={(e) => setMaxItems(Number(e.target.value) || 20)}
            />
          </label>
        </div>

        <button
          type="button"
          disabled={loading || stores.length === 0}
          onClick={() => void handleScan()}
          className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-surface hover:bg-accent-hover disabled:opacity-50"
        >
          {loading ? "Buscando ofertas…" : "Buscar ofertas"}
        </button>
        {loading ? (
          <p className="text-xs text-muted">
            Puede tardar: hay delay entre peticiones para no saturar las tiendas.
          </p>
        ) : null}
      </div>

      {error ? (
        <p className="rounded-xl border border-red-900/60 bg-red-950/30 p-4 text-sm text-red-200">
          {error}
        </p>
      ) : null}

      {result ? (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-3 text-sm text-muted">
            <span>{result.message}</span>
            <span>· Escaneados: {result.scanned}</span>
            <span>· Caché: {result.cacheHits}</span>
            <span>· Red: {result.networkCalls}</span>
            <span>· Sin oferta: {result.noOffer}</span>
          </div>

          {result.errors.length > 0 ? (
            <div className="rounded-xl border border-border bg-surface-card p-3 text-sm text-muted">
              <p className="mb-1 font-medium text-ink-soft">Errores de red</p>
              <ul className="space-y-1">
                {result.errors.map((err) => (
                  <li key={`${err.store}-${err.query}`}>
                    {err.store}: {err.query} — {err.error}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <section className="space-y-3">
            <h3 className="text-lg font-semibold text-ink">
              Coincidencias ({result.matches.length})
            </h3>
            {result.matches.length === 0 ? (
              <p className="text-sm text-muted">Ninguna coincidencia fuerte.</p>
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                {result.matches.map((item) => (
                  <article
                    key={item.bggId}
                    className="rounded-xl border border-border bg-surface-raised/50 p-3"
                  >
                    <div className="flex gap-3">
                      {item.thumbnailUrl ? (
                        <img
                          src={item.thumbnailUrl}
                          alt=""
                          className="h-14 w-14 rounded-lg object-cover"
                        />
                      ) : (
                        <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-surface-card text-xs text-muted">
                          —
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <h4 className="font-medium text-ink">{item.name}</h4>
                        <div className="mt-1 flex flex-wrap gap-2 text-xs text-muted">
                          {wishlistPriorityLabel(item.wishlistPriority) ? (
                            <span>{wishlistPriorityLabel(item.wishlistPriority)}</span>
                          ) : null}
                          <BggLink bggId={item.bggId} />
                        </div>
                      </div>
                    </div>
                    <ul className="mt-3 space-y-2">
                      {item.offers.map((offer) => (
                        <li
                          key={`${offer.store}-${offer.url}`}
                          className="rounded-lg border border-border bg-surface-card px-3 py-2 text-sm"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="font-medium text-accent">
                              {offer.store === "gamenerdz"
                                ? "Game Nerdz"
                                : "Miniature Market"}
                            </span>
                            <span className="tabular-nums text-ink">
                              {formatPrice(offer)}
                            </span>
                          </div>
                          <p className="mt-0.5 truncate text-xs text-muted">
                            {offer.name}
                          </p>
                          {offer.publisher ? (
                            <p className="mt-0.5 truncate text-xs text-muted-dim">
                              {offer.publisher}
                            </p>
                          ) : null}
                          <div className="mt-1 flex flex-wrap gap-2 text-xs text-muted">
                            <span>{stockLabel(offer.inStock)}</span>
                            <span>score {(offer.score * 100).toFixed(0)}%</span>
                            <a
                              href={offer.url}
                              target="_blank"
                              rel="noreferrer"
                              className="text-accent hover:underline"
                            >
                              Ver en tienda
                            </a>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </article>
                ))}
              </div>
            )}
          </section>

          {result.ambiguous.length > 0 ? (
            <details className="rounded-xl border border-border bg-surface-raised/40 p-4">
              <summary className="cursor-pointer font-medium text-ink">
                Ambiguas ({result.ambiguous.length})
              </summary>
              <ul className="mt-3 space-y-3">
                {result.ambiguous.map((item) => (
                  <li key={item.bggId} className="text-sm">
                    <p className="font-medium text-ink-soft">
                      {item.name}
                      {wishlistPriorityLabel(item.wishlistPriority)
                        ? ` · ${wishlistPriorityLabel(item.wishlistPriority)}`
                        : ""}
                    </p>
                    <ul className="mt-1 space-y-1 text-xs text-muted">
                      {item.candidates.map((c) => (
                        <li key={`${c.store}-${c.url}`}>
                          [{c.store}] {c.name}
                          {c.publisher ? ` (${c.publisher})` : ""} —{" "}
                          {formatPrice(c)} ({(c.score * 100).toFixed(0)}%){" "}
                          <a
                            href={c.url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-accent hover:underline"
                          >
                            link
                          </a>
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ul>
            </details>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
