import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchCollectionFacets, postWhatToPlay } from "../../api/client";
import type { WhatToPlaySuggestion } from "../../api/types";
import { BGG_LANGUAGE_DEPENDENCE_LEVELS } from "../../constants/language-dependence";
import { CollapsiblePanel } from "../../components/CollapsiblePanel";
import {
  FilterSelect,
  MultiFilterSelect,
} from "../../components/FilterField";
import { GameCard } from "../../components/GameCard";

const PLAYERS_MAX_CAP = 30;

function filtersSummary(opts: {
  categories: string[];
  mechanics: string[];
  languageDependence?: string;
}): string {
  const bits: string[] = [];
  if (opts.languageDependence) bits.push("idioma");
  if (opts.categories.length) bits.push(`${opts.categories.length} cat.`);
  if (opts.mechanics.length) bits.push(`${opts.mechanics.length} mec.`);
  return bits.length > 0 ? bits.join(" · ") : "Sin filtros de taxonomía";
}

export function WhatToPlayActivity() {
  const [players, setPlayers] = useState(2);
  const [maxTime, setMaxTime] = useState(90);
  const [maxWeight, setMaxWeight] = useState("");
  const [ownedOnly, setOwnedOnly] = useState(true);
  const [includeExpansions, setIncludeExpansions] = useState(false);
  const [categories, setCategories] = useState<string[]>([]);
  const [mechanics, setMechanics] = useState<string[]>([]);
  const [languageDependence, setLanguageDependence] = useState<
    string | undefined
  >();
  const [suggestions, setSuggestions] = useState<WhatToPlaySuggestion[]>([]);
  const [poolTotal, setPoolTotal] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);

  const { data: facets } = useQuery({
    queryKey: ["what-to-play-facets", ownedOnly, includeExpansions],
    queryFn: () =>
      fetchCollectionFacets({
        own: ownedOnly ? true : undefined,
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

  const playersMax = Math.min(
    Math.max(options.playersMax, 12),
    PLAYERS_MAX_CAP,
  );
  const playersMin = Math.max(1, options.playersMin || 1);

  useEffect(() => {
    if (players > playersMax) setPlayers(playersMax);
    if (players < playersMin) setPlayers(playersMin);
  }, [players, playersMax, playersMin]);

  async function loadSuggestions(reshuffle = false) {
    setLoading(true);
    setError(null);
    try {
      const weightNum = maxWeight.trim() === "" ? undefined : Number(maxWeight);
      const result = await postWhatToPlay({
        players,
        maxTimeMinutes: maxTime,
        maxWeight:
          weightNum !== undefined && Number.isFinite(weightNum)
            ? weightNum
            : undefined,
        ownedOnly,
        includeExpansions,
        categories: categories.length > 0 ? categories : undefined,
        mechanics: mechanics.length > 0 ? mechanics : undefined,
        languageDependence,
        count: 5,
        seed: reshuffle ? Date.now() : undefined,
      });
      setSuggestions(result.suggestions);
      setPoolTotal(result.poolTotal);
      setSearched(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al sugerir");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-border bg-surface-raised/60 p-4">
        <h2 className="text-lg font-semibold text-ink">Qué jugar esta noche</h2>
        <p className="mt-1 text-sm text-muted">
          Filtra por mesa, tiempo y taxonomía; te proponemos 3–5 opciones con un
          score simple.
        </p>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="text-sm">
            <span className="mb-1 block text-muted">
              Jugadores ({playersMin}–{playersMax})
            </span>
            <input
              type="number"
              min={playersMin}
              max={playersMax}
              value={players}
              onChange={(e) => {
                const n = Number(e.target.value) || playersMin;
                setPlayers(Math.min(playersMax, Math.max(playersMin, n)));
              }}
              className="w-full rounded-lg border border-border bg-surface px-3 py-2.5 md:py-2"
            />
            <input
              type="range"
              min={playersMin}
              max={playersMax}
              value={Math.min(playersMax, Math.max(playersMin, players))}
              onChange={(e) => setPlayers(Number(e.target.value))}
              className="mt-2 w-full accent-[var(--color-accent)]"
            />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-muted">Tiempo máx. (min)</span>
            <input
              type="number"
              min={15}
              max={480}
              step={15}
              value={maxTime}
              onChange={(e) => setMaxTime(Number(e.target.value) || 60)}
              className="w-full rounded-lg border border-border bg-surface px-3 py-2.5 md:py-2"
            />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-muted">Peso máx. (opcional)</span>
            <input
              type="number"
              min={1}
              max={5}
              step={0.1}
              placeholder="p. ej. 3.0"
              value={maxWeight}
              onChange={(e) => setMaxWeight(e.target.value)}
              className="w-full rounded-lg border border-border bg-surface px-3 py-2.5 md:py-2"
            />
          </label>
          <div className="flex flex-col justify-end gap-2 text-sm text-ink-soft">
            <label className="flex min-h-10 items-center gap-2 md:min-h-0">
              <input
                type="checkbox"
                checked={ownedOnly}
                onChange={(e) => setOwnedOnly(e.target.checked)}
                className="h-4 w-4 accent-[var(--color-accent)]"
              />
              Solo owned
            </label>
            <label className="flex min-h-10 items-center gap-2 md:min-h-0">
              <input
                type="checkbox"
                checked={includeExpansions}
                onChange={(e) => setIncludeExpansions(e.target.checked)}
                className="h-4 w-4 accent-[var(--color-accent)]"
              />
              Incluir expansiones
            </label>
          </div>
        </div>

        <div className="mt-4">
          <CollapsiblePanel
            title="Categorías, mecánicas e idioma"
            defaultOpen={false}
            summary={filtersSummary({
              categories,
              mechanics,
              languageDependence,
            })}
          >
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
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
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={loading}
            onClick={() => void loadSuggestions(false)}
            className="min-h-11 rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-surface hover:bg-accent-hover disabled:opacity-50 md:min-h-0 md:py-2"
          >
            {loading ? "Buscando…" : "Sugerir"}
          </button>
          {searched ? (
            <button
              type="button"
              disabled={loading}
              onClick={() => void loadSuggestions(true)}
              className="min-h-11 rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-ink hover:bg-surface-card disabled:opacity-50 md:min-h-0 md:py-2"
            >
              Otras sugerencias
            </button>
          ) : null}
        </div>
      </div>

      {error ? (
        <p className="rounded-xl border border-red-900 bg-red-950/40 p-4 text-red-200">
          {error}
        </p>
      ) : null}

      {searched && !loading && suggestions.length === 0 ? (
        <p className="rounded-xl border border-border bg-surface-raised/40 p-4 text-sm text-muted">
          Ningún juego encaja con estos filtros. Prueba más tiempo, menos peso o
          menos taxonomía.
        </p>
      ) : null}

      {searched && poolTotal != null && suggestions.length > 0 ? (
        <p className="text-sm text-muted">
          Pool filtrado: <span className="font-medium text-ink">{poolTotal}</span>{" "}
          juego{poolTotal === 1 ? "" : "s"} · mostrando {suggestions.length}
        </p>
      ) : null}

      <div className="space-y-3">
        {suggestions.map((s) => (
          <div key={s.bggId} className="space-y-1">
            <GameCard
              bggId={s.bggId}
              name={s.name}
              thumbnailUrl={s.thumbnailUrl}
              imageUrl={s.imageUrl}
              subtype={s.subtype}
              yearPublished={s.yearPublished}
              minPlayers={s.minPlayers}
              maxPlayers={s.maxPlayers}
              playingTime={s.playingTime}
              minPlayTime={s.minPlayTime}
              maxPlayTime={s.maxPlayTime}
              weight={s.weight}
              personalRating={s.personalRating}
              bggRating={s.bggRating}
              numPlays={s.numPlays}
              designers={s.designers}
              subtitle={`Score ${s.score}`}
            />
            {s.reasons.length > 0 ? (
              <p className="px-1 text-xs text-muted">
                {s.reasons.slice(0, 3).join(" · ")}
              </p>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}
