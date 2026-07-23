import { useEffect, useState } from "react";
import { fetchShelfOfShame } from "../../api/client";
import type { ShelfOfShameItem } from "../../api/types";
import { GameCard } from "../../components/GameCard";

export function ShelfOfShameActivity() {
  const [items, setItems] = useState<ShelfOfShameItem[]>([]);
  const [includeExpansions, setIncludeExpansions] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const result = await fetchShelfOfShame({ includeExpansions });
        if (!cancelled) setItems(result.items);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Error al cargar");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [includeExpansions]);

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-border bg-surface-raised/60 p-4">
        <h2 className="text-lg font-semibold text-ink">Shelf of shame</h2>
        <p className="mt-1 text-sm text-muted">
          Juegos owned sin partidas. Los más antiguos primero — toca jugarlos.
        </p>
        <label className="mt-4 flex min-h-11 items-center gap-2 text-sm text-ink-soft md:min-h-0">
          <input
            type="checkbox"
            checked={includeExpansions}
            onChange={(e) => setIncludeExpansions(e.target.checked)}
            className="h-4 w-4 accent-[var(--color-accent)]"
          />
          Incluir expansiones
        </label>
      </div>

      {error ? (
        <p className="rounded-xl border border-red-900 bg-red-950/40 p-4 text-red-200">
          {error}
        </p>
      ) : null}

      {loading ? (
        <p className="text-sm text-muted">Cargando…</p>
      ) : items.length === 0 ? (
        <p className="rounded-xl border border-border bg-surface-raised/40 p-4 text-sm text-muted">
          No hay juegos owned sin partidas. ¡Bien!
        </p>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-muted">
            {items.length} juego{items.length === 1 ? "" : "s"} en la lista
          </p>
          {items.map((item) => (
            <GameCard
              key={item.bggId}
              bggId={item.bggId}
              name={item.name}
              thumbnailUrl={item.thumbnailUrl}
              imageUrl={item.imageUrl}
              subtype={item.subtype}
              yearPublished={item.yearPublished}
              weight={item.weight}
              personalRating={item.personalRating}
              numPlays={item.numPlays}
              subtitle={
                item.lastModified
                  ? `En colección desde ~${item.lastModified.slice(0, 10)}`
                  : "Sin fecha de modificación"
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}
