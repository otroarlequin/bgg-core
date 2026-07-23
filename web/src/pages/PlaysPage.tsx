import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchPlays, fetchPlayStats } from "../api/client";
import type { PlaysQueryParams } from "../api/types";
import { CollapsiblePanel } from "../components/CollapsiblePanel";
import { PlaysTable } from "../components/PlaysTable";
import { StatCard } from "../components/StatCard";

export function PlaysPage() {
  const [filters, setFilters] = useState<PlaysQueryParams>({});
  const [applied, setApplied] = useState(filters);

  const { data, isLoading, error } = useQuery({
    queryKey: ["plays", applied],
    queryFn: () => fetchPlays(applied),
  });

  const statsQuery = useQuery({
    queryKey: ["plays-stats", applied],
    queryFn: () => fetchPlayStats(applied),
  });

  const statsSummary = statsQuery.data
    ? `${statsQuery.data.totalPlays} partidas · H-Index ${statsQuery.data.hIndex}`
    : undefined;

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border bg-surface-raised/60 p-4">
        <div className="grid gap-3 md:grid-cols-2">
          <label className="text-sm">
            <span className="mb-1 block text-muted">Desde</span>
            <input
              type="date"
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-ink"
              value={filters.from ?? ""}
              onChange={(e) => setFilters({ ...filters, from: e.target.value || undefined })}
            />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-muted">Hasta</span>
            <input
              type="date"
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-ink"
              value={filters.to ?? ""}
              onChange={(e) => setFilters({ ...filters, to: e.target.value || undefined })}
            />
          </label>
        </div>
        <button
          type="button"
          onClick={() => setApplied(filters)}
          className="mt-4 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-surface hover:bg-accent-hover"
        >
          Filtrar
        </button>
      </div>

      {statsQuery.data ? (
        <CollapsiblePanel
          title="Resumen"
          defaultOpen={false}
          summary={statsSummary}
        >
          <div className="grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-4">
            <StatCard label="Partidas" value={statsQuery.data.totalPlays} />
            <StatCard
              label="Juegos únicos"
              value={statsQuery.data.uniqueBaseGames}
              hint="Sin expansiones"
            />
            <StatCard
              label="Expansiones"
              value={statsQuery.data.uniqueExpansions}
            />
            <StatCard
              label="H-Index"
              value={statsQuery.data.hIndex}
              hint="≥h juegos base con ≥h partidas"
            />
          </div>
        </CollapsiblePanel>
      ) : null}

      {isLoading ? <p className="text-muted">Cargando partidas...</p> : null}
      {error ? (
        <p className="rounded-xl border border-red-900 bg-red-950/40 p-4 text-red-200">
          Error al cargar partidas.
        </p>
      ) : null}
      {data ? <PlaysTable items={data.items} /> : null}
    </div>
  );
}
