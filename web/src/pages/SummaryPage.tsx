import { useQuery } from "@tanstack/react-query";
import { fetchSummary } from "../api/client";
import type { CollectionPreset } from "../collectionPresets";
import { TopGamesList } from "../components/TopGamesList";

interface SummaryPageProps {
  onNavigateToCollection: (preset: CollectionPreset) => void;
}

function Metric({
  label,
  value,
  hint,
  onClick,
}: {
  label: string;
  value: string | number;
  hint?: string;
  onClick?: () => void;
}) {
  const content = (
    <>
      <span className="text-xs text-muted">{label}</span>
      <span className="mt-0.5 text-lg font-semibold tabular-nums tracking-tight text-ink">
        {value}
      </span>
      {hint ? (
        <span className="text-[11px] leading-snug text-muted-dim">{hint}</span>
      ) : null}
    </>
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="flex flex-col items-start rounded-lg px-2 py-1.5 text-left transition hover:bg-surface-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
      >
        {content}
      </button>
    );
  }

  return (
    <div className="flex flex-col items-start px-2 py-1.5">{content}</div>
  );
}

export function SummaryPage({ onNavigateToCollection }: SummaryPageProps) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["summary"],
    queryFn: fetchSummary,
  });

  if (isLoading) {
    return <p className="text-muted">Cargando resumen...</p>;
  }

  if (error || !data) {
    return (
      <p className="rounded-xl border border-red-900 bg-red-950/40 p-4 text-red-200">
        No se pudo cargar el resumen. ¿Está corriendo la API (`npm run dev:api`)?
      </p>
    );
  }

  const { collection, plays } = data;
  const rating =
    collection.avgPersonalRating != null
      ? collection.avgPersonalRating.toFixed(1)
      : "—";

  return (
    <div className="space-y-5">
      <section className="grid gap-3 lg:grid-cols-2">
        <div className="rounded-xl border border-border bg-surface-raised/60 px-3 py-3">
          <h2 className="mb-1 px-2 text-xs font-semibold uppercase tracking-wide text-muted">
            Colección
          </h2>
          <div className="grid grid-cols-3 gap-x-2 sm:grid-cols-6">
            <Metric
              label="Total"
              value={collection.total}
              onClick={() => onNavigateToCollection("all")}
            />
            <Metric
              label="Owned"
              value={collection.owned}
              onClick={() => onNavigateToCollection("owned")}
            />
            <Metric
              label="Wishlist"
              value={collection.wishlist}
              onClick={() => onNavigateToCollection("wishlist")}
            />
            <Metric
              label="Preordered"
              value={collection.preordered}
              onClick={() => onNavigateToCollection("preordered")}
            />
            <Metric label="Want to play" value={collection.wantToPlay} />
            <Metric label="Rating medio" value={rating} hint="Tus notas" />
          </div>
        </div>

        <div className="rounded-xl border border-border bg-surface-raised/60 px-3 py-3">
          <h2 className="mb-1 px-2 text-xs font-semibold uppercase tracking-wide text-muted">
            Partidas
          </h2>
          <div className="grid grid-cols-3 gap-x-2 sm:grid-cols-6">
            <Metric label="Totales" value={plays.totalPlays} />
            <Metric
              label="Juegos"
              value={plays.uniqueBaseGames}
              hint="Sin expansiones"
            />
            <Metric label="Expansiones" value={plays.uniqueExpansions} />
            <Metric
              label="Horas"
              value={plays.totalHours.toFixed(0)}
              hint="Tiempo logueado"
            />
            <Metric
              label="H-index"
              value={plays.hIndex}
              hint="≥h bases con ≥h plays"
            />
            <Metric
              label="Únicos"
              value={plays.uniqueGames}
              hint="Con expansiones"
            />
          </div>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <TopGamesList
          title="Más jugados (presencial)"
          items={plays.topPlayedPhysical}
          valueLabel="partidas"
        />
        <TopGamesList
          title="Más jugados (virtual)"
          items={plays.topPlayedVirtual}
          valueLabel="partidas"
        />
      </section>
    </div>
  );
}
