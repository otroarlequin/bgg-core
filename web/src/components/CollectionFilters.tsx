import { useQuery } from "@tanstack/react-query";
import type { ReactNode } from "react";
import type { CollectionFacets, CollectionQueryParams } from "../api/types";
import { fetchCollectionFacets } from "../api/client";
import { BGG_LANGUAGE_DEPENDENCE_LEVELS } from "../constants/language-dependence";
import {
  FilterNumberInput,
  FilterSelect,
  MultiFilterSelect,
} from "./FilterField";

interface CollectionFiltersProps {
  value: CollectionQueryParams;
  onChange: (next: CollectionQueryParams) => void;
}

function getFacetScope(filters: CollectionQueryParams): CollectionQueryParams {
  return {
    own: filters.own,
    wishlist: filters.wishlist,
    preordered: filters.preordered,
    minPlays: filters.minPlays,
    includeExpansions: filters.includeExpansions,
  };
}

function PlayersSlider({
  min,
  max,
  value,
  onChange,
}: {
  min: number;
  max: number;
  value?: number;
  onChange: (next: number | undefined) => void;
}) {
  const active = value != null;
  const sliderValue = value ?? min;

  return (
    <div className="text-sm">
      <div className="mb-1 flex items-center justify-between text-muted">
        <span>Número de jugadores</span>
        <div className="flex items-center gap-2">
          <span className="font-medium text-ink">
            {active ? `${value} jugadores` : "Todos"}
          </span>
          {active ? (
            <button
              type="button"
              onClick={() => onChange(undefined)}
              aria-label="Limpiar filtro"
              className="rounded px-1 text-muted-dim hover:text-ink"
            >
              ×
            </button>
          ) : null}
        </div>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={1}
        value={sliderValue}
        disabled={!active && min === max}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-accent"
      />
      <div className="mt-1 flex justify-between text-xs text-muted-dim">
        <span>{min}</span>
        <span>{max}</span>
      </div>
      <label className="mt-2 flex items-center gap-2 text-ink-soft">
        <input
          type="checkbox"
          checked={active}
          onChange={(e) => onChange(e.target.checked ? min : undefined)}
        />
        Filtrar por jugadores
      </label>
    </div>
  );
}

function FilterGroup({
  title,
  children,
  className = "",
}: {
  title: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-dim">
        {title}
      </h3>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 text-ink-soft">{children}</div>
    </div>
  );
}

export function CollectionFilters({ value, onChange }: CollectionFiltersProps) {
  const facetScope = getFacetScope(value);
  const { data: facets } = useQuery({
    queryKey: ["collection-facets", facetScope],
    queryFn: () => fetchCollectionFacets(facetScope),
  });

  const emptyFacets: CollectionFacets = {
    designers: [],
    artists: [],
    publishers: [],
    categories: [],
    mechanics: [],
    languageDependence: [...BGG_LANGUAGE_DEPENDENCE_LEVELS],
    playersMin: 1,
    playersMax: 12,
  };
  const options = facets ?? emptyFacets;

  return (
    <div className="space-y-4">
      <FilterGroup title="Estado">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={value.own ?? false}
            onChange={(e) => onChange({ ...value, own: e.target.checked || undefined })}
          />
          Solo owned
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={value.wishlist ?? false}
            onChange={(e) =>
              onChange({ ...value, wishlist: e.target.checked || undefined })
            }
          />
          Wishlist
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={value.preordered ?? false}
            onChange={(e) =>
              onChange({ ...value, preordered: e.target.checked || undefined })
            }
          />
          Preordered
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={value.includeExpansions ?? true}
            onChange={(e) =>
              onChange({
                ...value,
                includeExpansions: e.target.checked,
              })
            }
          />
          Incluir expansiones
        </label>
      </FilterGroup>

      <FilterGroup title="Juego">
        <FilterNumberInput
          label="Partidas mín."
          value={value.minPlays}
          onChange={(minPlays) => onChange({ ...value, minPlays })}
        />
        <FilterSelect
          label="Dependencia del idioma"
          options={options.languageDependence}
          value={value.languageDependence}
          placeholder="Todas"
          onChange={(languageDependence) => onChange({ ...value, languageDependence })}
        />
        <div className="sm:col-span-2">
          <PlayersSlider
            min={options.playersMin}
            max={options.playersMax}
            value={value.players}
            onChange={(players) => onChange({ ...value, players })}
          />
        </div>
      </FilterGroup>

      <FilterGroup title="Créditos">
        <FilterSelect
          label="Diseñador(es)"
          options={options.designers}
          value={value.designer}
          onChange={(designer) => onChange({ ...value, designer })}
        />
        <FilterSelect
          label="Artista(s)"
          options={options.artists}
          value={value.artist}
          onChange={(artist) => onChange({ ...value, artist })}
        />
        <FilterSelect
          label="Publisher"
          options={options.publishers}
          value={value.publisher}
          onChange={(publisher) => onChange({ ...value, publisher })}
        />
      </FilterGroup>

      <div>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-dim">
          Taxonomía
        </h3>
        <div className="grid gap-3 lg:grid-cols-2">
          <MultiFilterSelect
            label="Categorías"
            options={options.categories}
            values={value.categories ?? []}
            onChange={(categories) =>
              onChange({
                ...value,
                categories: categories.length > 0 ? categories : undefined,
              })
            }
          />
          <MultiFilterSelect
            label="Mecánicas"
            options={options.mechanics}
            values={value.mechanics ?? []}
            onChange={(mechanics) =>
              onChange({
                ...value,
                mechanics: mechanics.length > 0 ? mechanics : undefined,
              })
            }
          />
        </div>
      </div>
    </div>
  );
}
