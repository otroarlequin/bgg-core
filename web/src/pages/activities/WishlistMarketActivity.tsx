import { useEffect, useState } from "react";
import { postWishlistMarket } from "../../api/client";
import type {
  MarketAlert,
  MarketListing,
  MarketSortBy,
  WishlistMarketResult,
} from "../../api/types";
import { BggLink } from "../../components/BggLink";
import { CollapsiblePanel } from "../../components/CollapsiblePanel";
import { MarketPriceWatchesPanel } from "../../components/MarketPriceWatchesPanel";
import { notifyMarketAlertsChanged } from "../../marketAlertsEvents";

const CONDITION_OPTIONS = [
  { id: "new", label: "New" },
  { id: "likenew", label: "Like new" },
  { id: "verygood", label: "Very good" },
  { id: "good", label: "Good" },
  { id: "acceptable", label: "Acceptable" },
];

const SORT_OPTIONS: Array<{ id: MarketSortBy; label: string }> = [
  { id: "priceAsc", label: "Precio ↑" },
  { id: "priceDesc", label: "Precio ↓" },
  { id: "dateDesc", label: "Más recientes" },
  { id: "name", label: "Nombre" },
];

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

function formatPrice(listing: Pick<MarketListing, "price" | "currency">): string {
  if (listing.price == null) return "—";
  const cur = listing.currency ?? "";
  return `${listing.price.toFixed(2)} ${cur}`.trim();
}

export function WishlistMarketActivity() {
  const [maxItems, setMaxItems] = useState(40);
  const [forceRefresh, setForceRefresh] = useState(false);
  const [maxPrice, setMaxPrice] = useState<string>("");
  const [conditions, setConditions] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState<MarketSortBy>("priceAsc");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<WishlistMarketResult | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const data = await postWishlistMarket({
          action: "status",
          maxItems,
          sortBy,
          conditions: conditions.length ? conditions : undefined,
          maxPrice: maxPrice.trim() ? Number(maxPrice) : undefined,
        });
        setResult(data);
      } catch {
        // silent on first load — user can scan
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- initial cache hydrate only
  }, []);

  function toggleCondition(id: string) {
    setConditions((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id],
    );
  }

  async function handleScan() {
    setLoading(true);
    setError(null);
    try {
      const data = await postWishlistMarket({
        action: "scan",
        forceRefresh,
        maxItems,
        conditions: conditions.length ? conditions : undefined,
        maxPrice: maxPrice.trim() ? Number(maxPrice) : undefined,
        sortBy,
      });
      setResult(data);
      notifyMarketAlertsChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al consultar Market");
    } finally {
      setLoading(false);
    }
  }

  async function handleMarkAllRead() {
    try {
      const data = await postWishlistMarket({ action: "markAlertsRead" });
      setResult((prev) =>
        prev
          ? {
              ...prev,
              alerts: data.alerts,
              alertsUnread: data.alertsUnread,
              message: data.message,
            }
          : data,
      );
      notifyMarketAlertsChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al marcar alertas");
    }
  }

  async function handleMarkOne(alert: MarketAlert) {
    try {
      const data = await postWishlistMarket({
        action: "markAlertsRead",
        alertIds: [alert.id],
      });
      setResult((prev) =>
        prev
          ? {
              ...prev,
              alerts: data.alerts,
              alertsUnread: data.alertsUnread,
            }
          : data,
      );
      notifyMarketAlertsChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al marcar alerta");
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold tracking-tight text-ink">
          Wishlist × BGG Market
        </h2>
        <p className="mt-1 text-sm text-muted">
          Listings oficiales de GeekMarket por bggId (sin scrapear vendedor). Scan
          on-demand con caché ~12h; las novedades quedan como alertas in-app.
        </p>
      </div>

      <div className="space-y-4 rounded-xl border border-border bg-surface-raised/60 p-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="flex items-center gap-2 text-sm text-ink">
            <input
              type="checkbox"
              checked={forceRefresh}
              onChange={(e) => setForceRefresh(e.target.checked)}
            />
            Forzar refresh
          </label>
          <label className="text-sm text-ink">
            <span className="mb-1 block text-muted">Máx. juegos</span>
            <input
              type="number"
              min={1}
              max={100}
              className="w-full rounded-lg border border-border bg-surface-card px-3 py-2"
              value={maxItems}
              onChange={(e) => setMaxItems(Number(e.target.value) || 40)}
            />
          </label>
          <label className="text-sm text-ink">
            <span className="mb-1 block text-muted">Precio máx.</span>
            <input
              type="number"
              min={0}
              step={0.01}
              placeholder="Sin límite"
              className="w-full rounded-lg border border-border bg-surface-card px-3 py-2"
              value={maxPrice}
              onChange={(e) => setMaxPrice(e.target.value)}
            />
          </label>
        </div>

        <div>
          <p className="mb-2 text-sm text-muted">Condición</p>
          <div className="flex flex-wrap gap-3">
            {CONDITION_OPTIONS.map((opt) => (
              <label
                key={opt.id}
                className="flex items-center gap-2 text-sm text-ink"
              >
                <input
                  type="checkbox"
                  checked={conditions.includes(opt.id)}
                  onChange={() => toggleCondition(opt.id)}
                />
                {opt.label}
              </label>
            ))}
          </div>
        </div>

        <label className="block text-sm text-ink">
          <span className="mb-1 block text-muted">Orden</span>
          <select
            className="w-full rounded-lg border border-border bg-surface-card px-3 py-2 sm:max-w-xs"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as MarketSortBy)}
          >
            {SORT_OPTIONS.map((opt) => (
              <option key={opt.id} value={opt.id}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>

        <button
          type="button"
          disabled={loading}
          onClick={() => void handleScan()}
          className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-surface hover:bg-accent-hover disabled:opacity-50"
        >
          {loading ? "Consultando Market…" : "Buscar en Market"}
        </button>
        {loading ? (
          <p className="text-xs text-muted">
            Lotes de hasta 20 juegos; BGG puede imponer espera entre requests.
          </p>
        ) : null}
      </div>

      <MarketPriceWatchesPanel />

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
            <span>· Sin oferta: {result.noListing}</span>
            {result.newAlerts > 0 ? (
              <span>· Nuevas alertas: {result.newAlerts}</span>
            ) : null}
          </div>

          {result.errors.length > 0 ? (
            <div className="rounded-xl border border-border bg-surface-card p-3 text-sm text-muted">
              <p className="mb-1 font-medium text-ink-soft">Errores</p>
              <ul className="space-y-1">
                {result.errors.map((err) => (
                  <li key={`${err.batch}-${err.error}`}>
                    {err.batch}: {err.error}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {result.alerts.length > 0 ? (
            <CollapsiblePanel
              title={`Novedades (${result.alertsUnread})`}
              defaultOpen={false}
              summary={
                result.alertsUnread > 0
                  ? `${result.alertsUnread} sin revisar — pulsa Mostrar`
                  : "Sin pendientes"
              }
              className="rounded-xl border border-accent/30 bg-accent-muted/30"
              actions={
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    void handleMarkAllRead();
                  }}
                  className="rounded-lg border border-border px-3 py-1.5 text-xs text-ink-soft hover:bg-surface-card"
                >
                  Marcar leídas
                </button>
              }
            >
              <ul className="space-y-2">
                {result.alerts.map((alert) => (
                  <li
                    key={alert.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-surface-card px-3 py-2 text-sm"
                  >
                    <div className="min-w-0">
                      <p className="font-medium text-ink">{alert.gameName}</p>
                      <p className="text-xs text-muted">
                        {formatPrice(alert)}
                        {alert.condition ? ` · ${alert.condition}` : ""}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <a
                        href={alert.url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-accent hover:underline"
                      >
                        Ver
                      </a>
                      <button
                        type="button"
                        onClick={() => void handleMarkOne(alert)}
                        className="text-xs text-muted hover:text-ink"
                      >
                        Leída
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </CollapsiblePanel>
          ) : null}

          <section className="space-y-3">
            <h3 className="text-lg font-semibold text-ink">
              Ofertas ({result.matches.length})
            </h3>
            {result.matches.length === 0 ? (
              <p className="text-sm text-muted">
                Ninguna oferta con los filtros actuales (o aún no hay caché: pulsa
                Buscar).
              </p>
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
                            <span>
                              {wishlistPriorityLabel(item.wishlistPriority)}
                            </span>
                          ) : null}
                          <BggLink bggId={item.bggId} />
                        </div>
                      </div>
                    </div>
                    <ul className="mt-3 space-y-2">
                      {item.listings.map((listing) => (
                        <li
                          key={`${item.bggId}-${listing.listingKey}`}
                          className="rounded-lg border border-border bg-surface-card px-3 py-2 text-sm"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="tabular-nums text-ink">
                              {formatPrice(listing)}
                            </span>
                            <a
                              href={listing.url}
                              target="_blank"
                              rel="noreferrer"
                              className="text-accent hover:underline"
                            >
                              GeekMarket
                            </a>
                          </div>
                          <p className="mt-0.5 text-xs text-muted">
                            {listing.condition ?? "condición ?"}
                            {listing.listDate ? ` · ${listing.listDate}` : ""}
                          </p>
                        </li>
                      ))}
                    </ul>
                  </article>
                ))}
              </div>
            )}
          </section>
        </div>
      ) : null}
    </div>
  );
}
