import { useEffect, useState } from "react";
import {
  deleteMarketWatch,
  fetchMarketWatchWishlistOptions,
  fetchMarketWatches,
  patchMarketWatch,
  upsertMarketWatch,
} from "../../api/client";
import type { MarketPriceWatch, MarketWatchWishlistOption } from "../../api/types";
import { CollapsiblePanel } from "../CollapsiblePanel";

const CURRENCIES = ["USD", "EUR", "CAD", "GBP"];

function formatCeiling(watch: MarketPriceWatch): string {
  return `${watch.effectiveCeiling.toFixed(2)} ${watch.currency}`;
}

export function MarketPriceWatchesPanel() {
  const [watches, setWatches] = useState<MarketPriceWatch[]>([]);
  const [wishlist, setWishlist] = useState<MarketWatchWishlistOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedBggId, setSelectedBggId] = useState<number | "">("");
  const [maxPrice, setMaxPrice] = useState("");
  const [tolerancePct, setTolerancePct] = useState("10");
  const [currency, setCurrency] = useState("USD");
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

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
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar alertas");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  function resetForm() {
    setSelectedBggId("");
    setMaxPrice("");
    setTolerancePct("10");
    setCurrency("USD");
    setEditingId(null);
  }

  function startEdit(watch: MarketPriceWatch) {
    setEditingId(watch.bggId);
    setSelectedBggId(watch.bggId);
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
    const name = watch.gameName ?? String(watch.bggId);
    if (!window.confirm(`¿Eliminar alerta de precio para «${name}»?`)) return;
    try {
      await deleteMarketWatch(watch.bggId);
      if (editingId === watch.bggId) resetForm();
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al eliminar");
    }
  }

  const availableWishlist = wishlist.filter(
    (item) => editingId === item.bggId || !watches.some((w) => w.bggId === item.bggId),
  );

  return (
    <CollapsiblePanel
      title="Mis alertas de precio"
      defaultOpen={false}
      summary={
        watches.length > 0
          ? `${watches.length} juego(s) vigilados`
          : "Define umbrales por juego"
      }
      className="rounded-xl border border-border bg-surface-raised/60"
    >
      <div className="space-y-4">
        <p className="text-sm text-muted">
          Avisamos in-app y por email (si lo configuraste) cuando aparezca una
          oferta en tu moneda ≤ tu precio + tolerancia. Por defecto +10% (p. ej.
          50 → 55 USD). El cron en Fly revisa 2×/día solo estos juegos.
        </p>

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
                    <div className="min-w-0">
                      <p className="font-medium text-ink">
                        {watch.gameName ?? `#${watch.bggId}`}
                        {!watch.enabled ? (
                          <span className="ml-2 text-xs text-muted">(pausada)</span>
                        ) : null}
                      </p>
                      <p className="text-xs text-muted">
                        Objetivo {watch.maxPrice.toFixed(2)} {watch.currency} · +
                        {watch.tolerancePct}% → hasta {formatCeiling(watch)}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
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
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block text-sm text-ink sm:col-span-2">
                  <span className="mb-1 block text-muted">Juego (wishlist)</span>
                  <select
                    className="w-full rounded-lg border border-border bg-surface-card px-3 py-2"
                    value={selectedBggId}
                    onChange={(e) =>
                      setSelectedBggId(
                        e.target.value ? Number(e.target.value) : "",
                      )
                    }
                    disabled={editingId != null}
                  >
                    <option value="">— Elegir —</option>
                    {(editingId
                      ? wishlist.filter((w) => w.bggId === editingId)
                      : availableWishlist
                    ).map((item) => (
                      <option key={item.bggId} value={item.bggId}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                </label>
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

        {error ? (
          <p className="text-sm text-red-400">{error}</p>
        ) : null}
      </div>
    </CollapsiblePanel>
  );
}
