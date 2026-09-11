import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchCollectionFacets, fetchShelfOfShame } from "../../api/client";
import type { ShelfOfShameItem } from "../../api/types";
import { BGG_LANGUAGE_DEPENDENCE_LEVELS } from "../../constants/language-dependence";
import { bggGameUrl } from "../../components/BggLink";
import { CollapsiblePanel } from "../../components/CollapsiblePanel";
import {
  FilterNumberInput,
  FilterSelect,
  MultiFilterSelect,
} from "../../components/FilterField";

function filtersSummary(opts: {
  includeExpansions: boolean;
  players?: number;
  maxWeight?: number;
  categories: string[];
  mechanics: string[];
  languageDependence?: string;
}): string {
  const bits: string[] = [];
  if (opts.includeExpansions) bits.push("expansiones");
  if (opts.players != null) bits.push(`${opts.players} jug.`);
  if (opts.maxWeight != null) bits.push(`peso ≤${opts.maxWeight}`);
  if (opts.languageDependence) bits.push("idioma");
  if (opts.categories.length) bits.push(`${opts.categories.length} cat.`);
  if (opts.mechanics.length) bits.push(`${opts.mechanics.length} mec.`);
  return bits.length > 0 ? bits.join(" · ") : "Sin filtros extra";
}

export function ShelfOfShameActivity() {
  const [items, setItems] = useState<ShelfOfShameItem[]>([]);
  const [includeExpansions, setIncludeExpansions] = useState(false);
  const [players, setPlayers] = useState<number | undefined>();
  const [maxWeight, setMaxWeight] = useState<number | undefined>();
  const [categories, setCategories] = useState<string[]>([]);
  const [mechanics, setMechanics] = useState<string[]>([]);
  const [languageDependence, setLanguageDependence] = useState<
    string | undefined
  >();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { data: facets } = useQuery({
    queryKey: ["shelf-facets", includeExpansions],
    queryFn: () =>
      fetchCollectionFacets({
        own: true,
        includeExpansions,
      }),
  });

  const options = useMemo(
    () =>
      facets ?? {
        designers: [],
        artists: [],
        publishers: [],
        categories: [],
        mechanics: [],
        languageDependence: [...BGG_LANGUAGE_DEPENDENCE_LEVELS],
        playersMin: 1,
        playersMax: 12,
      },
    [facets],
  );

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const result = await fetchShelfOfShame({
          includeExpansions,
          players,
          maxWeight,
          categories: categories.length ? categories : undefined,
          mechanics: mechanics.length ? mechanics : undefined,
          languageDependence,
        });
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
  }, [
    includeExpansions,
    players,
    maxWeight,
    categories,
    mechanics,
    languageDependence,
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-ink">Shelf of shame</h2>
        <p className="mt-1 text-sm text-muted">
          Owned sin partidas. Los más antiguos primero — toca jugarlos.
        </p>
      </div>

      <CollapsiblePanel
        title="Filtros"
        defaultOpen={false}
        summary={filtersSummary({
          includeExpansions,
          players,
          maxWeight,
          categories,
          mechanics,
          languageDependence,
        })}
        className="rounded-xl border border-border bg-surface-raised/60"
      >
        <div className="space-y-4">
          <label className="flex min-h-11 items-center gap-2 text-sm text-ink-soft md:min-h-0">
            <input
              type="checkbox"
              checked={includeExpansions}
              onChange={(e) => setIncludeExpansions(e.target.checked)}
              className="h-4 w-4 accent-[var(--color-accent)]"
            />
            Incluir expansiones
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm">
              <span className="mb-1 block text-muted">Jugadores (caja)</span>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={options.playersMin || 1}
                  max={Math.max(options.playersMax, 12)}
                  value={players ?? ""}
                  placeholder="Todos"
                  onChange={(e) => {
                    const raw = e.target.value.trim();
                    if (!raw) {
                      setPlayers(undefined);
                      return;
                    }
                    const n = Number(raw);
                    setPlayers(Number.isFinite(n) ? n : undefined);
                  }}
                  className="w-full rounded-lg border border-border bg-surface px-3 py-2"
                />
                {players != null ? (
                  <button
                    type="button"
                    onClick={() => setPlayers(undefined)}
                    className="text-xs text-muted hover:text-ink"
                  >
                    Limpiar
                  </button>
                ) : null}
              </div>
            </label>
            <FilterNumberInput
              label="Peso máx."
              value={maxWeight}
              min={1}
              onChange={setMaxWeight}
            />
            <FilterSelect
              label="Dependencia del idioma"
              options={options.languageDependence}
              value={languageDependence}
              placeholder="Todas"
              onChange={setLanguageDependence}
            />
          </div>
          <div className="grid gap-3 lg:grid-cols-2">
            <MultiFilterSelect
              label="Categorías"
              options={options.categories}
              values={categories}
              onChange={setCategories}
            />
            <MultiFilterSelect
              label="Mecánicas"
              options={options.mechanics}
              values={mechanics}
              onChange={setMechanics}
            />
          </div>
        </div>
      </CollapsiblePanel>

      {error ? (
        <p className="rounded-xl border border-red-900 bg-red-950/40 p-4 text-red-200">
          {error}
        </p>
      ) : null}

      {loading ? (
        <p className="text-sm text-muted">Cargando…</p>
      ) : items.length === 0 ? (
        <p className="rounded-xl border border-border bg-surface-raised/40 p-4 text-sm text-muted">
          No hay juegos owned sin partidas con estos filtros. ¡Bien!
        </p>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-muted">
            {items.length} juego{items.length === 1 ? "" : "s"}
          </p>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:gap-3">
            {items.map((item) => (
              <a
                key={item.bggId}
                href={bggGameUrl(item.bggId)}
                target="_blank"
                rel="noopener noreferrer"
                title={
                  item.lastModified
                    ? `${item.name} · lastmodified BGG ${item.lastModified.slice(0, 10)} (no es fecha de compra)`
                    : item.name
                }
                className="group overflow-hidden rounded-lg border border-border bg-surface-card transition hover:border-accent/50"
              >
                <div className="aspect-square bg-surface-raised">
                  {item.thumbnailUrl || item.imageUrl ? (
                    <img
                      src={item.imageUrl ?? item.thumbnailUrl ?? ""}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center px-2 text-center text-[10px] text-muted">
                      {item.name}
                    </div>
                  )}
                </div>
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
