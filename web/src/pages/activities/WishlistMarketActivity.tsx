import { useEffect, useMemo, useState } from "react";
import { postWishlistMarket } from "../../api/client";
import type {
  GameSortBy,
  ListingSortBy,
  MarketAlert,
  MarketListing,
  WishlistMarketGameMatch,
  WishlistMarketResult,
} from "../../api/types";
import { BggLink } from "../../components/BggLink";
import { CollapsiblePanel } from "../../components/CollapsiblePanel";
import { MarketPriceWatchesPanel } from "../../components/MarketPriceWatchesPanel";
import {
  displayGameName,
  marketConditionLabel,
  wishlistPriorityLabel,
} from "../../marketLabels";
import {
  MARKET_FOCUS_GAME,
  marketGameAnchorId,
  notifyMarketAlertsChanged,
  scrollToMarketGame,
  takePendingMarketFocus,
} from "../../marketAlertsEvents";

const CONDITION_OPTIONS = [
  { id: "new", label: "Nuevo" },
  { id: "likenew", label: "Como nuevo" },
  { id: "verygood", label: "Muy bueno" },
  { id: "good", label: "Bueno" },
  { id: "acceptable", label: "Aceptable" },
];

const GAME_SORT_OPTIONS: Array<{ id: GameSortBy; label: string }> = [
  { id: "priority", label: "Interés (wishlist)" },
  { id: "priceAsc", label: "Precio más bajo" },
  { id: "priceDesc", label: "Precio más alto" },
  { id: "name", label: "Nombre" },
];

const LISTING_SORT_OPTIONS: Array<{ id: ListingSortBy; label: string }> = [
  { id: "priceAsc", label: "Precio ↑" },
  { id: "priceDesc", label: "Precio ↓" },
  { id: "dateDesc", label: "Más recientes" },
];

const LISTINGS_PREVIEW = 3;

function formatPrice(listing: Pick<MarketListing, "price" | "currency">): string {
  if (listing.price == null) return "—";
  const cur = listing.currency ?? "";
  return `${listing.price.toFixed(2)} ${cur}`.trim();
}

function sortListings(
  listings: MarketListing[],
  sortBy: ListingSortBy,
): MarketListing[] {
  return [...listings].sort((a, b) => {
    if (sortBy === "dateDesc") {
      return (b.listDate ?? "").localeCompare(a.listDate ?? "");
    }
    const ap = a.price;
    const bp = b.price;
    if (ap == null && bp == null) return 0;
    if (ap == null) return 1;
    if (bp == null) return -1;
    return sortBy === "priceDesc" ? bp - ap : ap - bp;
  });
}

function sortGames(
  matches: WishlistMarketGameMatch[],
  gameSort: GameSortBy,
): WishlistMarketGameMatch[] {
  return [...matches].sort((a, b) => {
    if (gameSort === "priority") {
      const ap = a.wishlistPriority ?? 99;
      const bp = b.wishlistPriority ?? 99;
      if (ap !== bp) return ap - bp;
      return a.name.localeCompare(b.name, "es", { sensitivity: "base" });
    }
    if (gameSort === "name") {
      return a.name.localeCompare(b.name, "es", { sensitivity: "base" });
    }
    const ap = a.listings[0]?.price;
    const bp = b.listings[0]?.price;
    if (ap == null && bp == null) {
      return a.name.localeCompare(b.name, "es", { sensitivity: "base" });
    }
    if (ap == null) return 1;
    if (bp == null) return -1;
    return gameSort === "priceDesc" ? bp - ap : ap - bp;
  });
}

function applyDisplayFilters(
  matches: WishlistMarketGameMatch[],
  conditions: string[],
  listingSort: ListingSortBy,
  gameSort: GameSortBy,
): WishlistMarketGameMatch[] {
  const filtered = matches
    .map((item) => {
      const listings = conditions.length
        ? item.listings.filter(
            (l) => l.condition != null && conditions.includes(l.condition),
          )
        : item.listings;
      return { ...item, listings: sortListings(listings, listingSort) };
    })
    .filter((item) => item.listings.length > 0);
  return sortGames(filtered, gameSort);
}

function OfferListings({
  item,
}: {
  item: WishlistMarketGameMatch;
}) {
  const [expanded, setExpanded] = useState(false);
  const extra = item.listings.length - LISTINGS_PREVIEW;
  const visible = expanded
    ? item.listings
    : item.listings.slice(0, LISTINGS_PREVIEW);

  return (
    <>
      <ul className="mt-3 space-y-2">
        {visible.map((listing) => (
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
                Ver en Market
              </a>
            </div>
            <p className="mt-0.5 text-xs text-muted">
              {marketConditionLabel(listing.condition)}
              {listing.listDate ? ` · ${listing.listDate}` : ""}
            </p>
          </li>
        ))}
      </ul>
      {extra > 0 ? (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-2 text-xs text-accent hover:underline"
        >
          {expanded
            ? "Mostrar menos"
            : `Mostrar ${extra} oferta${extra === 1 ? "" : "s"} más`}
        </button>
      ) : null}
    </>
  );
}

export function WishlistMarketActivity() {
  const [forceRefresh, setForceRefresh] = useState(false);
  const [conditions, setConditions] = useState<string[]>([]);
  const [gameSort, setGameSort] = useState<GameSortBy>("priority");
  const [listingSort, setListingSort] = useState<ListingSortBy>("priceAsc");
  const [loading, setLoading] = useState(false);
  const [hydrating, setHydrating] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<WishlistMarketResult | null>(null);
  const [watchPrefill, setWatchPrefill] = useState<number | null>(null);
  const [watchIds, setWatchIds] = useState<Set<number>>(new Set());
  const [focusedBggId, setFocusedBggId] = useState<number | null>(null);

  async function reloadCache(opts?: { silent?: boolean }) {
    if (!opts?.silent) setHydrating(true);
    try {
      const data = await postWishlistMarket({ action: "status" });
      setResult(data);
      notifyMarketAlertsChanged();
    } catch (err) {
      if (!opts?.silent) {
        setError(
          err instanceof Error ? err.message : "Error al cargar la caché",
        );
      }
    } finally {
      setHydrating(false);
    }
  }

  useEffect(() => {
    void reloadCache({ silent: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- hydrate once
  }, []);

  useEffect(() => {
    const pending = takePendingMarketFocus();
    if (pending) setFocusedBggId(pending);
  }, []);

  const displayMatches = useMemo(() => {
    if (!result) return [];
    return applyDisplayFilters(
      result.matches,
      conditions,
      listingSort,
      gameSort,
    );
  }, [result, conditions, listingSort, gameSort]);

  useEffect(() => {
    function onFocus(e: Event) {
      const bggId = (e as CustomEvent<{ bggId: number }>).detail?.bggId;
      if (!bggId) return;
      takePendingMarketFocus();
      setFocusedBggId(bggId);
    }
    window.addEventListener(MARKET_FOCUS_GAME, onFocus);
    return () => window.removeEventListener(MARKET_FOCUS_GAME, onFocus);
  }, []);

  useEffect(() => {
    if (hydrating || focusedBggId == null) return;
    const t = window.setTimeout(() => scrollToMarketGame(focusedBggId), 80);
    return () => window.clearTimeout(t);
  }, [hydrating, focusedBggId, displayMatches]);

  function goToGameOffers(bggId: number) {
    setFocusedBggId(bggId);
  }

  const focusedHasCachedOffers =
    focusedBggId != null &&
    (result?.matches.some((item) => item.bggId === focusedBggId) ?? false);
  const focusedIsVisible =
    focusedBggId != null &&
    displayMatches.some((item) => item.bggId === focusedBggId);

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
        sortBy: listingSort,
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
          Al entrar se muestran las ofertas en caché. «Actualizar Market» solo
          hace falta para pedir datos nuevos a BGG. Las notificaciones son de
          tus alertas de precio, no de cada oferta que aparezca.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-4 rounded-xl border border-border bg-surface-raised/60 px-4 py-3">
        <button
          type="button"
          disabled={loading}
          onClick={() => void handleScan()}
          className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-surface hover:bg-accent-hover disabled:opacity-50"
        >
          {loading ? "Actualizando…" : "Actualizar Market"}
        </button>
        <label className="flex max-w-md items-start gap-2 text-xs text-muted">
          <input
            type="checkbox"
            className="mt-0.5"
            checked={forceRefresh}
            onChange={(e) => setForceRefresh(e.target.checked)}
          />
          <span>
            Ignorar caché y volver a pedir a BGG (más lento; úsalo si
            sospechas ofertas nuevas).
          </span>
        </label>
        {loading ? (
          <p className="w-full text-xs text-muted">
            Consulta en lotes de 20. Una wishlist grande puede tardar el
            primer pase.
          </p>
        ) : hydrating ? (
          <p className="text-xs text-muted">Cargando ofertas en caché…</p>
        ) : null}
      </div>

      <MarketPriceWatchesPanel
        prefillBggId={watchPrefill}
        onPrefillConsumed={() => setWatchPrefill(null)}
        onFocusGame={goToGameOffers}
        onWatchSaved={() => void reloadCache({ silent: true })}
        onWatchesChange={(watches) =>
          setWatchIds(new Set(watches.map((w) => w.bggId)))
        }
      />

      <div className="space-y-4 rounded-xl border border-border bg-surface-raised/60 p-4">
        <p className="text-sm font-medium text-ink">Filtrar y ordenar</p>
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

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm text-ink">
            <span className="mb-1 block text-muted">Ordenar juegos</span>
            <select
              className="w-full rounded-lg border border-border bg-surface-card px-3 py-2"
              value={gameSort}
              onChange={(e) => setGameSort(e.target.value as GameSortBy)}
            >
              {GAME_SORT_OPTIONS.map((opt) => (
                <option key={opt.id} value={opt.id}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm text-ink">
            <span className="mb-1 block text-muted">Ordenar ofertas</span>
            <select
              className="w-full rounded-lg border border-border bg-surface-card px-3 py-2"
              value={listingSort}
              onChange={(e) => setListingSort(e.target.value as ListingSortBy)}
            >
              {LISTING_SORT_OPTIONS.map((opt) => (
                <option key={opt.id} value={opt.id}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>
        </div>
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
              title={`Alertas de precio (${result.alertsUnread})`}
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
                      <p className="font-medium text-ink">
                        {displayGameName(alert.gameName, alert.bggId)}
                      </p>
                      <p className="text-xs text-muted">
                        {formatPrice(alert)}
                        {alert.condition
                          ? ` · ${marketConditionLabel(alert.condition)}`
                          : ""}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => goToGameOffers(alert.bggId)}
                        className="text-accent hover:underline"
                      >
                        Ver ofertas
                      </button>
                      <a
                        href={alert.url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-muted hover:text-ink"
                      >
                        Market
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

          {focusedBggId != null && result && !hydrating && !focusedIsVisible ? (
            <p className="rounded-xl border border-border bg-surface-card px-4 py-3 text-sm text-muted">
              {focusedHasCachedOffers ? (
                <>
                  Este juego tiene ofertas en caché, pero los filtros actuales
                  las ocultan.{" "}
                  <button
                    type="button"
                    onClick={() => setConditions([])}
                    className="text-accent hover:underline"
                  >
                    Quitar filtros de condición
                  </button>
                </>
              ) : (
                <>
                  No hay ofertas en caché para este juego. Pulsa «Actualizar
                  Market» si quieres pedir datos nuevos a BGG.
                </>
              )}
            </p>
          ) : null}

          <section className="space-y-3">
            <h3 className="text-lg font-semibold text-ink">
              Ofertas ({displayMatches.length})
            </h3>
            {displayMatches.length === 0 ? (
              <p className="text-sm text-muted">
                Ninguna oferta con los filtros actuales
                {result.scanned === 0 || result.cacheHits === 0
                  ? " (si es la primera vez, pulsa Actualizar Market)."
                  : "."}
              </p>
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                {displayMatches.map((item) => (
                  <article
                    id={marketGameAnchorId(item.bggId)}
                    key={item.bggId}
                    className={`scroll-mt-4 rounded-xl border bg-surface-raised/50 p-3 ${
                      focusedBggId === item.bggId
                        ? "border-accent ring-2 ring-accent/40"
                        : "border-border"
                    }`}
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
                        <h4 className="font-medium text-ink">
                          {displayGameName(item.name, item.bggId)}
                        </h4>
                        <div className="mt-1 flex flex-wrap gap-2 text-xs text-muted">
                          {wishlistPriorityLabel(item.wishlistPriority) ? (
                            <span>
                              {wishlistPriorityLabel(item.wishlistPriority)}
                            </span>
                          ) : null}
                          <span>
                            {item.listings.length} oferta
                            {item.listings.length === 1 ? "" : "s"}
                          </span>
                          <BggLink bggId={item.bggId} />
                          <button
                            type="button"
                            onClick={() => setWatchPrefill(item.bggId)}
                            title={
                              watchIds.has(item.bggId)
                                ? "Editar alerta de precio"
                                : "Crear alerta de precio"
                            }
                            className="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold tracking-wide text-accent hover:bg-accent/10 hover:text-accent-hover"
                          >
                            {watchIds.has(item.bggId) ? "Alerta ✎" : "Alerta +"}
                          </button>
                        </div>
                      </div>
                    </div>
                    <OfferListings item={item} />
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
