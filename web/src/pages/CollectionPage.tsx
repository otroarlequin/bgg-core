import { useQuery } from "@tanstack/react-query";
import { fetchCollection } from "../api/client";
import type { CollectionQueryParams } from "../api/types";
import { CollapsiblePanel } from "../components/CollapsiblePanel";
import { CollectionFilters } from "../components/CollectionFilters";
import { GameCard } from "../components/GameCard";

interface CollectionPageProps {
  filters: CollectionQueryParams;
  onChangeFilters: (next: CollectionQueryParams) => void;
}

function filtersSummary(filters: CollectionQueryParams): string {
  const bits: string[] = [];
  if (filters.own) bits.push("owned");
  if (filters.wishlist) bits.push("wishlist");
  if (filters.preordered) bits.push("preordered");
  if (filters.designer) bits.push(filters.designer);
  if (filters.players != null) bits.push(`${filters.players} jug.`);
  if (bits.length === 0) return "Sin filtros de estado";
  return bits.join(" · ");
}

export function CollectionPage({ filters, onChangeFilters }: CollectionPageProps) {
  const { data, isLoading, error, isFetching } = useQuery({
    queryKey: ["collection", filters],
    queryFn: () => fetchCollection(filters),
  });

  return (
    <div className="space-y-4">
      <CollapsiblePanel
        title="Filtros"
        defaultOpen={false}
        summary={filtersSummary(filters)}
      >
        <CollectionFilters value={filters} onChange={onChangeFilters} />
      </CollapsiblePanel>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-h-5">
          {isLoading ? <p className="text-muted">Buscando...</p> : null}
          {isFetching && !isLoading ? (
            <p className="text-xs text-muted-dim">Actualizando...</p>
          ) : null}
          {data && !isLoading ? (
            <p className="text-sm text-muted">{data.total} resultados</p>
          ) : null}
        </div>
        <label className="flex items-center gap-2 text-sm">
          <span className="text-muted">Ordenar</span>
          <select
            className="rounded-lg border border-border bg-surface px-2.5 py-1.5 text-sm text-ink"
            value={filters.sortBy ?? "name"}
            onChange={(e) =>
              onChangeFilters({
                ...filters,
                sortBy: e.target.value as CollectionQueryParams["sortBy"],
              })
            }
          >
            <option value="name">Nombre</option>
            <option value="rating">Rating</option>
            <option value="plays">Partidas</option>
            <option value="weight">Peso</option>
          </select>
        </label>
      </div>

      {error ? (
        <p className="rounded-xl border border-red-900 bg-red-950/40 p-4 text-red-200">
          Error al consultar la colección.
        </p>
      ) : null}

      {data ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {data.items.map((item) => (
            <GameCard
              key={item.collId}
              bggId={item.bggId}
              name={item.name}
              thumbnailUrl={item.thumbnailUrl}
              imageUrl={item.imageUrl}
              personalRating={item.personalRating}
              bggRating={item.bggRating}
              numPlays={item.numPlays}
              weight={item.gameWeight}
              designers={item.gameDesigners}
              artists={item.gameArtists}
              publishers={item.gamePublishers}
              description={item.gameDescription}
              yearPublished={item.yearPublished}
              minPlayers={item.minPlayers}
              maxPlayers={item.maxPlayers}
              playingTime={item.playingTime}
              minPlayTime={item.minPlayTime}
              maxPlayTime={item.maxPlayTime}
              subtype={item.subtype}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
