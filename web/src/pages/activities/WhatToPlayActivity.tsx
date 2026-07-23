import { useState } from "react";
import { postWhatToPlay } from "../../api/client";
import type { WhatToPlaySuggestion } from "../../api/types";
import { GameCard } from "../../components/GameCard";

export function WhatToPlayActivity() {
  const [players, setPlayers] = useState(2);
  const [maxTime, setMaxTime] = useState(90);
  const [maxWeight, setMaxWeight] = useState("");
  const [ownedOnly, setOwnedOnly] = useState(true);
  const [includeExpansions, setIncludeExpansions] = useState(false);
  const [suggestions, setSuggestions] = useState<WhatToPlaySuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);

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
        count: 5,
        seed: reshuffle ? Date.now() : undefined,
      });
      setSuggestions(result.suggestions);
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
          Filtra por mesa y tiempo; te proponemos 3–5 opciones con un score
          simple.
        </p>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="text-sm">
            <span className="mb-1 block text-muted">Jugadores</span>
            <input
              type="number"
              min={1}
              max={20}
              value={players}
              onChange={(e) => setPlayers(Number(e.target.value) || 1)}
              className="w-full rounded-lg border border-border bg-surface px-3 py-2.5 md:py-2"
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
          Ningún juego encaja con estos filtros. Prueba más tiempo o menos peso.
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
