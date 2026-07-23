import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchSummary } from "../api/client";
import type { CollectionPreset } from "../collectionPresets";
import { StatCard } from "../components/StatCard";
import { TopGamesList } from "../components/TopGamesList";

interface SummaryPageProps {
  onNavigateToCollection: (preset: CollectionPreset) => void;
}

function Icon({ children }: { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {children}
    </svg>
  );
}

const icons = {
  total: (
    <Icon>
      <rect x="4" y="4" width="16" height="16" rx="2" />
      <path d="M4 10h16M10 4v16" />
    </Icon>
  ),
  owned: (
    <Icon>
      <path d="M12 3l8 4.5v9L12 21l-8-4.5v-9L12 3z" />
      <path d="M12 12l8-4.5M12 12v9M12 12L4 7.5" />
    </Icon>
  ),
  wishlist: (
    <Icon>
      <path d="M12 20s-7-4.4-7-10a4 4 0 017-2.5A4 4 0 0119 10c0 5.6-7 10-7 10z" />
    </Icon>
  ),
  preordered: (
    <Icon>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 8v4l3 2" />
    </Icon>
  ),
  plays: (
    <Icon>
      <path d="M8 4h8l2 4H6l2-4z" />
      <rect x="5" y="8" width="14" height="12" rx="1.5" />
      <circle cx="9" cy="14" r="1" fill="currentColor" stroke="none" />
      <circle cx="15" cy="14" r="1" fill="currentColor" stroke="none" />
    </Icon>
  ),
  unique: (
    <Icon>
      <rect x="3" y="5" width="10" height="14" rx="1.5" />
      <rect x="11" y="5" width="10" height="14" rx="1.5" />
    </Icon>
  ),
  expansions: (
    <Icon>
      <path d="M12 5v14M5 12h14" />
      <rect x="4" y="4" width="16" height="16" rx="2" />
    </Icon>
  ),
  hIndex: (
    <Icon>
      <path d="M4 18V8M10 18V4M16 18v-6M20 18H3" />
    </Icon>
  ),
};

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

  return (
    <div className="space-y-6">
      <section>
        <h2 className="mb-4 border-b border-border pb-2 text-xl font-bold tracking-tight text-ink">
          Colección
        </h2>
        <div className="grid grid-cols-2 gap-2.5 sm:gap-3 xl:grid-cols-4">
          <StatCard
            icon={icons.total}
            label="Total en colección"
            value={collection.total}
            onClick={() => onNavigateToCollection("all")}
          />
          <StatCard
            icon={icons.owned}
            label="Owned"
            value={collection.owned}
            onClick={() => onNavigateToCollection("owned")}
          />
          <StatCard
            icon={icons.wishlist}
            label="Wishlist"
            value={collection.wishlist}
            onClick={() => onNavigateToCollection("wishlist")}
          />
          <StatCard
            icon={icons.preordered}
            label="Preordered"
            value={collection.preordered}
            onClick={() => onNavigateToCollection("preordered")}
          />
        </div>
      </section>

      <section>
        <h2 className="mb-4 border-b border-border pb-2 text-xl font-bold tracking-tight text-ink">
          Partidas
        </h2>
        <div className="grid grid-cols-2 gap-2.5 sm:gap-3 xl:grid-cols-4">
          <StatCard icon={icons.plays} label="Partidas totales" value={plays.totalPlays} />
          <StatCard
            icon={icons.unique}
            label="Juegos únicos"
            value={plays.uniqueBaseGames}
            hint="Sin expansiones"
          />
          <StatCard
            icon={icons.expansions}
            label="Expansiones jugadas"
            value={plays.uniqueExpansions}
          />
          <StatCard
            icon={icons.hIndex}
            label="H-Index"
            value={plays.hIndex}
            hint="≥h juegos base con ≥h partidas"
          />
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
