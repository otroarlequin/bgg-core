import { useEffect, useMemo, useState } from "react";
import {
  deleteMarketWatch,
  fetchMarketWatchWishlistOptions,
  fetchMarketWatches,
  patchMarketWatch,
  upsertMarketWatch,
} from "../api/client";
import type { MarketPriceWatch, MarketWatchWishlistOption } from "../api/types";
import {
  displayGameName,
  wishlistPriorityLabel,
} from "../marketLabels";
import { CollapsiblePanel } from "./CollapsiblePanel";

const CURRENCIES = ["USD", "EUR", "CAD", "GBP"];

function formatCeiling(watch: MarketPriceWatch): string {
  return `${watch.effectiveCeiling.toFixed(2)} ${watch.currency}`;
}

function formatPlayers(
  min?: number | null,
  max?: number | null,
): string | null {
  if (min == null && max == null) return null;
  if (min != null && max != null) {
    return min === max ? `${min} jug.` : `${min}–${max} jug.`;
  }
  return `${min ?? max} jug.`;
}

function WatchGameCard({
  name,
  thumbnailUrl,
  yearPublished,
  wishlistPriority,
  minPlayers,
  maxPlayers,
  gameWeight,
  selected,
  onSelect,
}: {
  name: string;
  thumbnailUrl?: string | null;
  yearPublished?: number | null;
  wishlistPriority?: number | null;
  minPlayers?: number | null;
  maxPlayers?: number | null;
  gameWeight?: number | null;
  selected?: boolean;
  onSelect?: () => void;
}) {
  const players = formatPlayers(minPlayers, maxPlayers);
  const interest = wishlistPriorityLabel(wishlistPriority);
  const meta = [
    yearPublished,
    players,
    gameWeight != null ? `Peso ${gameWeight.toFixed(1)}` : null,
    interest,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={!onSelect}
      className={`flex w-full gap-3 rounded-lg border px-3 py-2 text-left ${
        selected
          ? "border-accent bg-accent-muted/40"
          : "border-border bg-surface-card hover:border-accent/50"
      } ${onSelect ? "" : "cursor-default"}`}
    >
      {thumbnailUrl ? (
        <img
          src={thumbnailUrl}
          alt=""
          className="h-12 w-12 shrink-0 rounded-md object-cover"
        />
      ) : (
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md bg-surface-raised text-xs text-muted">
          —
        </div>
      )}
      <div className="min-w-0">
        <p className="truncate font-medium text-ink">{name}</p>
        {meta ? <p className="mt-0.5 text-xs text-muted">{meta}</p> : null}
      </div>
    </button>
  );
}

export function MarketPriceWatchesPanel({
  prefillBggId = null,
  onPrefillConsumed,
  onFocusGame,
  onWatchesChange,
  onWatchSaved,
}: {
  prefillBggId?: number | null;
  onPrefillConsumed?: () => void;
  onFocusGame?: (bggId: number) => void;
  onWatchesChange?: (watches: MarketPriceWatch[]) => void;
  onWatchSaved?: () => void;
}) {
  const [watches, setWatches] = useState<MarketPriceWatch[]>([]);
  const [wishlist, setWishlist] = useState<MarketWatchWishlistOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedBggId, setSelectedBggId] = useState<number | "">("");
  const [pickerQuery, setPickerQuery] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [tolerancePct, setTolerancePct] = useState("10");
  const [currency, setCurrency] = useState("USD");
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      const [watchData, wishlistData] = await Promise.all([
        fetchMarketWatches(),
        fetchMarketWatchWishlistOptions(),
      ]);
      setWatches(watchData.watches);
      setWishlist(wishlistData.wishlist);
      onWatchesChange?.(watchData.watches);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar alertas");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load once
  }, []);

  useEffect(() => {
    if (prefillBggId == null) return;
    const existing = watches.find((w) => w.bggId === prefillBggId);
    if (existing) startEdit(existing);
    else {
      setEditingId(null);
      setSelectedBggId(prefillBggId);
      setPickerQuery("");
      setMaxPrice("");
      setTolerancePct("10");
      setCurrency("USD");
    }
    setPanelOpen(true);
    onPrefillConsumed?.();
    window.setTimeout(() => {
      document
        .getElementById("market-price-watches")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 50);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- react to prefill only
  }, [prefillBggId]);

  function resetForm() {
    setSelectedBggId("");
    setPickerQuery("");
    setMaxPrice("");
    setTolerancePct("10");
    setCurrency("USD");
    setEditingId(null);
  }

  function startEdit(watch: MarketPriceWatch) {
    setEditingId(watch.bggId);
    setSelectedBggId(watch.bggId);
    setPickerQuery("");
    setMaxPrice(String(watch.maxPrice));
    setTolerancePct(String(watch.tolerancePct));
    setCurrency(watch.currency);
  }

  async function handleSubmit() {
    const bggId = Number(selectedBggId);
    const price = Number(maxPrice);
    const tolerance = Number(tolerancePct);
    if (!Number.isFinite(bggId) || bggId <= 0) {
      setError("Elige un juego de la wishlist");
      return;
    }
    if (!Number.isFinite(price) || price <= 0) {
      setError("Precio objetivo inválido");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await upsertMarketWatch(bggId, {
        maxPrice: price,
        tolerancePct: tolerance,
        currency,
        enabled: true,
      });
      resetForm();
      await refresh();
      onWatchSaved?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar");
    } finally {
      setSaving(false);
    }
  }

  async function toggleEnabled(watch: MarketPriceWatch) {
    try {
      await patchMarketWatch(watch.bggId, { enabled: !watch.enabled });
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al actualizar");
    }
  }

  async function handleDelete(watch: MarketPriceWatch) {
    const name = displayGameName(watch.gameName, watch.bggId);
    if (!window.confirm(`¿Eliminar alerta de precio para «${name}»?`)) return;
    try {
      await deleteMarketWatch(watch.bggId);
      if (editingId === watch.bggId) resetForm();
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al eliminar");
    }
  }

  const availableWishlist = useMemo(() => {
    const pool = editingId
      ? wishlist.filter((item) => item.bggId === editingId)
      : wishlist.filter((item) => !watches.some((w) => w.bggId === item.bggId));
    const q = pickerQuery.trim().toLowerCase();
    if (!q) return pool;
    return pool.filter((item) => item.name.toLowerCase().includes(q));
  }, [editingId, pickerQuery, watches, wishlist]);

  const selectedOption = wishlist.find((item) => item.bggId === selectedBggId);

  return (
    <div id="market-price-watches">
    <CollapsiblePanel
      title="Mis alertas de precio"
      open={panelOpen}
      onOpenChange={setPanelOpen}
      defaultOpen={false}
      summary={
        watches.length > 0
          ? `${watches.length} juego(s) vigilados`
          : "Define un precio objetivo por juego"
      }
      className="rounded-xl border border-border bg-surface-raised/60"
    >
      <div className="space-y-4">
        {loading ? (
          <p className="text-sm text-muted">Cargando…</p>
        ) : (
          <>
            {watches.length > 0 ? (
              <ul className="space-y-2">
                {watches.map((watch) => (
                  <li
                    key={watch.bggId}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-surface-card px-3 py-2 text-sm"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      {watch.thumbnailUrl ? (
                        <img
                          src={watch.thumbnailUrl}
                          alt=""
                          className="h-10 w-10 shrink-0 rounded-md object-cover"
                        />
                      ) : null}
                      <div className="min-w-0">
                        <p className="font-medium text-ink">
                          {displayGameName(watch.gameName, watch.bggId)}
                          {!watch.enabled ? (
                            <span className="ml-2 text-xs text-muted">
                              (pausada)
                            </span>
                          ) : null}
                        </p>
                        <p className="text-xs text-muted">
                          Objetivo {watch.maxPrice.toFixed(2)} {watch.currency} · +
                          {watch.tolerancePct}% → hasta {formatCeiling(watch)}
                          {wishlistPriorityLabel(watch.wishlistPriority)
                            ? ` · ${wishlistPriorityLabel(watch.wishlistPriority)}`
                            : ""}
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {onFocusGame ? (
                        <button
                          type="button"
                          onClick={() => onFocusGame(watch.bggId)}
                          className="text-xs text-accent hover:underline"
                        >
                          Ver ofertas
                        </button>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => startEdit(watch)}
                        className="text-xs text-accent hover:underline"
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        onClick={() => void toggleEnabled(watch)}
                        className="text-xs text-muted hover:text-ink"
                      >
                        {watch.enabled ? "Pausar" : "Activar"}
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleDelete(watch)}
                        className="text-xs text-red-400 hover:underline"
                      >
                        Eliminar
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted">Aún no tienes alertas de precio.</p>
            )}

            <div className="rounded-lg border border-border bg-surface-card/50 p-3">
              <p className="mb-3 text-sm font-medium text-ink">
                {editingId ? "Editar alerta" : "Nueva alerta"}
              </p>
              <div className="space-y-3">
                <div>
                  <span className="mb-1 block text-sm text-muted">
                    Juego de la wishlist
                  </span>
                  {editingId ? (
                    selectedOption ? (
                      <WatchGameCard
                        name={displayGameName(selectedOption.name, selectedOption.bggId)}
                        thumbnailUrl={selectedOption.thumbnailUrl}
                        yearPublished={selectedOption.yearPublished}
                        wishlistPriority={selectedOption.wishlistPriority}
                        minPlayers={selectedOption.minPlayers}
                        maxPlayers={selectedOption.maxPlayers}
                        gameWeight={selectedOption.gameWeight}
                      />
                    ) : (
                      <p className="text-sm text-muted">
                        {displayGameName(null, editingId)}
                      </p>
                    )
                  ) : (
                    <>
                      <input
                        type="search"
                        placeholder="Buscar por nombre…"
                        className="mb-2 w-full rounded-lg border border-border bg-surface-card px-3 py-2 text-sm"
                        value={pickerQuery}
                        onChange={(e) => setPickerQuery(e.target.value)}
                      />
                      <div className="grid max-h-72 gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
                        {availableWishlist.length === 0 ? (
                          <p className="text-sm text-muted sm:col-span-2">
                            {pickerQuery
                              ? "Ningún juego coincide con la búsqueda."
                              : "No quedan juegos de wishlist sin alerta."}
                          </p>
                        ) : (
                          availableWishlist.map((item) => (
                            <WatchGameCard
                              key={item.bggId}
                              name={displayGameName(item.name, item.bggId)}
                              thumbnailUrl={item.thumbnailUrl}
                              yearPublished={item.yearPublished}
                              wishlistPriority={item.wishlistPriority}
                              minPlayers={item.minPlayers}
                              maxPlayers={item.maxPlayers}
                              gameWeight={item.gameWeight}
                              selected={selectedBggId === item.bggId}
                              onSelect={() => setSelectedBggId(item.bggId)}
                            />
                          ))
                        )}
                      </div>
                    </>
                  )}
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  <label className="block text-sm text-ink">
                    <span className="mb-1 block text-muted">Precio objetivo</span>
                    <input
                      type="number"
                      min={0.01}
                      step={0.01}
                      className="w-full rounded-lg border border-border bg-surface-card px-3 py-2"
                      value={maxPrice}
                      onChange={(e) => setMaxPrice(e.target.value)}
                    />
                  </label>
                  <label className="block text-sm text-ink">
                    <span className="mb-1 block text-muted">Tolerancia (%)</span>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      step={1}
                      className="w-full rounded-lg border border-border bg-surface-card px-3 py-2"
                      value={tolerancePct}
                      onChange={(e) => setTolerancePct(e.target.value)}
                    />
                  </label>
                  <label className="block text-sm text-ink">
                    <span className="mb-1 block text-muted">Moneda</span>
                    <select
                      className="w-full rounded-lg border border-border bg-surface-card px-3 py-2"
                      value={currency}
                      onChange={(e) => setCurrency(e.target.value)}
                    >
                      {CURRENCIES.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void handleSubmit()}
                  className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-surface hover:bg-accent-hover disabled:opacity-50"
                >
                  {saving ? "Guardando…" : editingId ? "Actualizar" : "Crear alerta"}
                </button>
                {editingId ? (
                  <button
                    type="button"
                    onClick={resetForm}
                    className="rounded-lg border border-border px-4 py-2 text-sm text-ink-soft hover:bg-surface-card"
                  >
                    Cancelar
                  </button>
                ) : null}
              </div>
            </div>
          </>
        )}

        {error ? <p className="text-sm text-red-400">{error}</p> : null}
      </div>
    </CollapsiblePanel>
    </div>
  );
}
