import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchCollectionFacets, postDuelAction } from "../../api/client";
import type { DuelOutput, DuelPoolFilters, DuelSession } from "../../api/types";
import { BGG_LANGUAGE_DEPENDENCE_LEVELS } from "../../constants/language-dependence";
import { CollapsiblePanel } from "../../components/CollapsiblePanel";
import { DuelComparisonView } from "../../components/DuelComparison";
import {
  FilterNumberInput,
  FilterSelect,
  MultiFilterSelect,
} from "../../components/FilterField";
import { GameCard } from "../../components/GameCard";

type DuelStep = "setup" | "duel" | "winner";

const defaultFilters: DuelPoolFilters = {
  includeExpansions: true,
  ownedOnly: false,
  excludeVirtual: false,
};

function filtersSummary(filters: DuelPoolFilters): string {
  const bits: string[] = [];
  if (filters.ownedOnly) bits.push("solo owned");
  if (filters.excludeVirtual) bits.push("sin virtual");
  if (filters.includeExpansions === false) bits.push("sin expansiones");
  if (filters.designer) bits.push(filters.designer);
  if (filters.players != null) bits.push(`${filters.players} jug.`);
  if (filters.maxWeight != null) bits.push(`peso ≤${filters.maxWeight}`);
  if (filters.mechanics?.length) bits.push(`${filters.mechanics.length} mec.`);
  if (filters.categories?.length) bits.push(`${filters.categories.length} cat.`);
  if (filters.languageDependence) bits.push("idioma");
  return bits.length > 0 ? bits.join(" · ") : "Sin filtros extra";
}

export function DuelActivity() {
  const [from, setFrom] = useState("2026-01-01");
  const [to, setTo] = useState("2026-06-30");
  const [minPlays, setMinPlays] = useState(1);
  const [filters, setFilters] = useState<DuelPoolFilters>(defaultFilters);
  const [step, setStep] = useState<DuelStep>("setup");
  const [output, setOutput] = useState<DuelOutput | null>(null);
  const [activeSession, setActiveSession] = useState<DuelSession | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: facets } = useQuery({
    queryKey: ["collection-facets", { own: filters.ownedOnly || undefined }],
    queryFn: () =>
      fetchCollectionFacets({
        own: filters.ownedOnly || undefined,
        includeExpansions: filters.includeExpansions,
      }),
  });

  useEffect(() => {
    void refreshActiveSession();
  }, []);

  async function refreshActiveSession() {
    try {
      const result = await postDuelAction({ action: "status" });
      setActiveSession(result.session?.status === "active" ? result.session : null);
    } catch {
      setActiveSession(null);
    }
  }

  async function runAction(body: Parameters<typeof postDuelAction>[0]) {
    setLoading(true);
    setError(null);
    try {
      const result = await postDuelAction(body);
      setOutput(result);
      if (result.winner) {
        setStep("winner");
        setActiveSession(null);
      } else if (result.duel) {
        setStep("duel");
      } else if (result.session) {
        setStep("duel");
        setActiveSession(
          result.session.status === "active" ? result.session : null,
        );
        const next = await postDuelAction({
          action: "next",
          sessionId: result.session.id,
        });
        setOutput(next);
        if (next.winner) {
          setStep("winner");
          setActiveSession(null);
        } else if (next.duel) {
          setStep("duel");
        }
      }
      return result;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error en la actividad");
      throw err;
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate(force = false) {
    try {
      await runAction({
        action: "create",
        from,
        to,
        minPlays,
        force,
        filters,
      });
      await refreshActiveSession();
    } catch {
      // error already set
    }
  }

  async function handleContinue() {
    if (!activeSession) return;
    try {
      await runAction({ action: "next", sessionId: activeSession.id });
    } catch {
      // error already set
    }
  }

  async function handleAbandon() {
    setLoading(true);
    setError(null);
    try {
      await postDuelAction({
        action: "abandon",
        sessionId: activeSession?.id,
      });
      setActiveSession(null);
      setOutput(null);
      setStep("setup");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al abandonar");
    } finally {
      setLoading(false);
    }
  }

  async function handleChoose(winnerBggId: number) {
    if (!output?.session && !output?.duel) return;
    const sessionId = output.session?.id ?? output.duel?.sessionId;
    try {
      const result = await runAction({
        action: "choose",
        sessionId,
        winnerBggId,
      });
      if (result.winner) return;
      if (result.session?.status === "active") {
        const next = await runAction({
          action: "next",
          sessionId: result.session.id,
        });
        if (next.winner) setStep("winner");
        else if (!next.duel) setStep("winner");
      }
    } catch {
      // error already set
    }
  }

  function handleReset() {
    setStep("setup");
    setOutput(null);
    setError(null);
    void refreshActiveSession();
  }

  const options = facets ?? {
    designers: [],
    artists: [],
    publishers: [],
    categories: [],
    mechanics: [],
    languageDependence: [...BGG_LANGUAGE_DEPENDENCE_LEVELS],
    playersMin: 1,
    playersMax: 12,
  };

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-border bg-surface-raised/60 p-4">
        <h2 className="text-lg font-semibold text-ink">Duel ranking del periodo</h2>
        <p className="mt-1 text-sm text-muted">
          Compara juegos jugados en un periodo y elige cuál disfrutaste más hasta
          encontrar el mejor del periodo.
        </p>
      </div>

      {step === "setup" ? (
        <div className="space-y-4">
          {activeSession ? (
            <div className="rounded-xl border border-accent-muted/50 bg-accent/15 p-4 text-sm text-ink">
              <p className="font-medium text-accent">
                Hay un torneo activo #{activeSession.id} (
                {activeSession.remainingBggIds.length} juegos restantes)
              </p>
              <p className="mt-1 text-muted">
                {activeSession.periodFrom} → {activeSession.periodTo}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => void handleContinue()}
                  className="rounded-lg bg-accent px-3 py-2 text-sm font-medium text-surface hover:bg-accent-hover disabled:opacity-50"
                >
                  Continuar
                </button>
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => void handleAbandon()}
                  className="rounded-lg border border-border px-3 py-2 text-sm text-ink-soft hover:bg-surface-card disabled:opacity-50"
                >
                  Abandonar
                </button>
              </div>
            </div>
          ) : null}

          <div className="rounded-xl border border-border bg-surface-raised/60 p-4">
            <div className="grid gap-3 md:grid-cols-3">
              <label className="text-sm">
                <span className="mb-1 block text-muted">Desde</span>
                <input
                  type="date"
                  className="w-full rounded-lg border border-border bg-surface px-3 py-2"
                  value={from}
                  onChange={(e) => setFrom(e.target.value)}
                />
              </label>
              <label className="text-sm">
                <span className="mb-1 block text-muted">Hasta</span>
                <input
                  type="date"
                  className="w-full rounded-lg border border-border bg-surface px-3 py-2"
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                />
              </label>
              <label className="text-sm">
                <span className="mb-1 block text-muted">Partidas mín. por juego</span>
                <input
                  type="number"
                  min={1}
                  className="w-full rounded-lg border border-border bg-surface px-3 py-2"
                  value={minPlays}
                  onChange={(e) => setMinPlays(Number(e.target.value) || 1)}
                />
              </label>
            </div>
          </div>

          <CollapsiblePanel
            title="Filtros del torneo"
            defaultOpen={false}
            summary={filtersSummary(filters)}
          >
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={filters.ownedOnly ?? false}
                    onChange={(e) =>
                      setFilters({ ...filters, ownedOnly: e.target.checked })
                    }
                  />
                  Solo owned
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={filters.includeExpansions !== false}
                    onChange={(e) =>
                      setFilters({
                        ...filters,
                        includeExpansions: e.target.checked,
                      })
                    }
                  />
                  Incluir expansiones
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={filters.excludeVirtual ?? false}
                    onChange={(e) =>
                      setFilters({
                        ...filters,
                        excludeVirtual: e.target.checked,
                      })
                    }
                  />
                  Excluir virtuales (TTS/BGA)
                </label>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <FilterSelect
                  label="Diseñador"
                  options={options.designers}
                  value={filters.designer}
                  onChange={(designer) => setFilters({ ...filters, designer })}
                />
                <FilterSelect
                  label="Dependencia del idioma"
                  options={options.languageDependence}
                  value={filters.languageDependence}
                  placeholder="Todas"
                  onChange={(languageDependence) =>
                    setFilters({ ...filters, languageDependence })
                  }
                />
                <FilterNumberInput
                  label="Jugadores"
                  value={filters.players}
                  onChange={(players) => setFilters({ ...filters, players })}
                />
                <FilterNumberInput
                  label="Peso máx."
                  value={filters.maxWeight}
                  onChange={(maxWeight) => setFilters({ ...filters, maxWeight })}
                />
              </div>

              <div className="grid gap-3 lg:grid-cols-2">
                <MultiFilterSelect
                  label="Categorías"
                  options={options.categories}
                  values={filters.categories ?? []}
                  onChange={(categories) =>
                    setFilters({
                      ...filters,
                      categories: categories.length > 0 ? categories : undefined,
                    })
                  }
                />
                <MultiFilterSelect
                  label="Mecánicas"
                  options={options.mechanics}
                  values={filters.mechanics ?? []}
                  onChange={(mechanics) =>
                    setFilters({
                      ...filters,
                      mechanics: mechanics.length > 0 ? mechanics : undefined,
                    })
                  }
                />
              </div>
            </div>
          </CollapsiblePanel>

          <button
            type="button"
            disabled={loading}
            onClick={() => void handleCreate(Boolean(activeSession))}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-surface hover:bg-accent-hover disabled:opacity-50"
          >
            {activeSession ? "Abandonar e iniciar nuevo" : "Iniciar torneo"}
          </button>
        </div>
      ) : null}

      {error ? (
        <p className="rounded-xl border border-red-900 bg-red-950/40 p-4 text-red-200">
          {error}
        </p>
      ) : null}

      {output?.message ? (
        <p className="text-center text-sm text-muted">{output.message}</p>
      ) : null}

      {step === "duel" && output?.duel ? (
        <div className="space-y-3">
          <button
            type="button"
            disabled={loading}
            onClick={() => void handleAbandon()}
            className="rounded-lg border border-border px-3 py-1.5 text-sm text-muted hover:bg-surface-card"
          >
            Abandonar torneo
          </button>
          <DuelComparisonView
            duel={output.duel}
            loading={loading}
            onChoose={(id) => void handleChoose(id)}
          />
        </div>
      ) : null}

      {step === "winner" && output?.winner ? (
        <div className="mx-auto max-w-lg space-y-4 text-center">
          <h3 className="text-2xl font-bold text-accent">
            Mejor juego del periodo
          </h3>
          <GameCard
            variant="featured"
            bggId={output.winner.bggId}
            name={output.winner.name}
            thumbnailUrl={output.winner.thumbnailUrl}
            imageUrl={output.winner.imageUrl}
            personalRating={output.winner.personalRating}
            numPlays={output.winner.playCount}
            weight={output.winner.weight}
            designers={output.winner.designers}
            subtitle={`${output.winner.firstPlay} → ${output.winner.lastPlay}`}
            wins={output.winner.wins}
            winRate={output.winner.winRate}
            totalMinutes={output.winner.totalMinutes}
          />
          <button
            type="button"
            onClick={handleReset}
            className="rounded-lg border border-border px-4 py-2 text-sm hover:bg-surface-card"
          >
            Nuevo torneo
          </button>
        </div>
      ) : null}
    </div>
  );
}
