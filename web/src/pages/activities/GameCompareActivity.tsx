import { useState, type FormEvent } from "react";
import { postGameCompare } from "../../api/client";
import type {
  BggSearchHit,
  CompareGameColumn,
  GameCompareResult,
} from "../../api/types";
import { AppModal } from "../../components/AppModal";
import { BggLink } from "../../components/BggLink";
import { GameSubtypeBadge } from "../../components/GameSubtypeBadge";

/** Keep in sync with src/query/game-compare.ts */
export const MAX_COMPARE_SLOTS = 4;

function SimilarityBar({ percent }: { percent: number | null }) {
  if (percent == null) {
    return <span className="text-xs text-muted-dim">Base</span>;
  }
  const width = Math.max(0, Math.min(100, percent));
  return (
    <div className="space-y-1">
      <div className="h-2 overflow-hidden rounded-full bg-surface-card">
        <div
          className="h-full rounded-full bg-accent"
          style={{ width: `${width}%` }}
        />
      </div>
      <p className="text-xs tabular-nums text-ink-soft">{percent}%</p>
    </div>
  );
}

function GameHeaderCell({
  game,
  onRemove,
}: {
  game: CompareGameColumn;
  onRemove: () => void;
}) {
  return (
    <div className="flex w-full flex-col items-center gap-2 px-2 py-2">
      <div className="relative shrink-0">
        <img
          src={
            game.thumbnailUrl ??
            game.imageUrl ??
            "https://placehold.co/72x72/2a241c/a89880?text=BGG"
          }
          alt=""
          className="h-16 w-16 rounded-lg object-cover bg-surface-card"
        />
        {game.subtype ? (
          <div className="absolute -bottom-1 -right-1">
            <GameSubtypeBadge subtype={game.subtype} size="sm" />
          </div>
        ) : null}
      </div>
      <div className="flex w-full items-start justify-center gap-1">
        <p className="min-w-0 flex-1 text-center text-sm font-medium leading-snug text-ink [overflow-wrap:anywhere]">
          {game.name}
        </p>
        <BggLink bggId={game.bggId} />
      </div>
      <button
        type="button"
        onClick={onRemove}
        className="rounded border border-border px-2 py-0.5 text-xs text-muted hover:border-red-500/40 hover:text-red-400"
        title="Quitar de la comparación"
      >
        Quitar
      </button>
    </div>
  );
}

export function GameCompareActivity() {
  const [bggIds, setBggIds] = useState<number[]>([]);
  const [compare, setCompare] = useState<GameCompareResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [addOpen, setAddOpen] = useState(false);
  const [input, setInput] = useState("");
  const [searchResults, setSearchResults] = useState<BggSearchHit[]>([]);
  const [resolving, setResolving] = useState(false);

  const canAdd = bggIds.length < MAX_COMPARE_SLOTS;
  const games = compare?.games ?? [];

  async function refreshCompare(ids: number[]) {
    if (ids.length === 0) {
      setCompare(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await postGameCompare({ action: "compare", bggIds: ids });
      if (!result.compare) {
        throw new Error(result.message || "No se pudo comparar");
      }
      setCompare(result.compare);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al comparar");
    } finally {
      setLoading(false);
    }
  }

  async function appendGame(bggId: number) {
    if (bggIds.includes(bggId)) {
      setError("Ese juego ya está en la comparación.");
      return;
    }
    if (bggIds.length >= MAX_COMPARE_SLOTS) {
      setError(`Máximo ${MAX_COMPARE_SLOTS} juegos.`);
      return;
    }
    const next = [...bggIds, bggId];
    setBggIds(next);
    setAddOpen(false);
    setInput("");
    setSearchResults([]);
    await refreshCompare(next);
  }

  async function handleResolve(e?: FormEvent) {
    e?.preventDefault();
    setResolving(true);
    setError(null);
    setSearchResults([]);
    try {
      const result = await postGameCompare({
        action: "resolve",
        input,
      });
      if (
        result.bggId != null &&
        (!result.searchResults || result.searchResults.length <= 1)
      ) {
        await appendGame(result.bggId);
        return;
      }
      if (result.searchResults && result.searchResults.length > 0) {
        setSearchResults(result.searchResults);
        return;
      }
      setError(result.message || "Sin resultados");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al buscar");
    } finally {
      setResolving(false);
    }
  }

  async function removeGame(bggId: number) {
    const next = bggIds.filter((id) => id !== bggId);
    setBggIds(next);
    await refreshCompare(next);
  }

  const gameCount = Math.max(games.length, 1);

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-border bg-surface-raised/60 p-4">
        <h2 className="text-lg font-semibold text-ink">Comparador de juegos</h2>
        <p className="mt-1 text-sm text-muted">
          Elige hasta {MAX_COMPARE_SLOTS} títulos de BGG y compáralos lado a
          lado (ficha, similitud y diferencias).
        </p>
        {compare?.meanSimilarityVsBasePercent != null && games.length > 1 ? (
          <p className="mt-2 text-sm text-ink-soft">
            Similitud media vs el primero:{" "}
            <span className="font-semibold text-accent">
              {compare.meanSimilarityVsBasePercent}%
            </span>
          </p>
        ) : null}
      </div>

      {error ? (
        <p className="rounded-xl border border-red-900 bg-red-950/40 p-4 text-red-200">
          {error}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center justify-end gap-2">
        {canAdd ? (
          <button
            type="button"
            disabled={loading || resolving}
            onClick={() => {
              setError(null);
              setAddOpen(true);
            }}
            className="rounded-lg border border-dashed border-accent/50 bg-accent-muted/20 px-4 py-2 text-sm font-medium text-accent hover:border-accent hover:bg-accent-muted/40 disabled:opacity-50"
          >
            + Añadir juego
          </button>
        ) : (
          <p className="text-xs text-muted-dim">
            Máximo {MAX_COMPARE_SLOTS} juegos. Quita uno para añadir otro.
          </p>
        )}
      </div>

      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full table-fixed border-collapse text-sm">
          <colgroup>
            <col className="w-28" />
            {Array.from({ length: gameCount }, (_, i) => (
              <col key={games[i]?.bggId ?? `empty-${i}`} />
            ))}
          </colgroup>
          <thead>
            <tr className="border-b border-border bg-surface-raised">
              <th className="sticky left-0 z-10 bg-surface-raised px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-dim">
                Juego
              </th>
              {games.length > 0 ? (
                games.map((game) => (
                  <th
                    key={game.bggId}
                    className="align-bottom font-normal"
                  >
                    <GameHeaderCell
                      game={game}
                      onRemove={() => void removeGame(game.bggId)}
                    />
                  </th>
                ))
              ) : (
                <th className="px-4 py-8 text-center text-sm font-normal text-muted">
                  Pulsa <span className="text-accent">+ Añadir juego</span>{" "}
                  para empezar.
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {games.length > 0 ? (
              <tr className="border-b border-border/80">
                <th className="sticky left-0 z-10 bg-surface px-3 py-2 text-left text-xs font-medium text-muted">
                  Similitud vs 1.º
                </th>
                {games.map((game) => (
                  <td key={`sim-${game.bggId}`} className="px-3 py-2 align-middle">
                    <SimilarityBar percent={game.similarityVsBasePercent} />
                  </td>
                ))}
              </tr>
            ) : null}

            {(compare?.rows ?? []).map((row) => (
              <tr
                key={row.key}
                className={`border-b border-border/60 ${
                  row.differs ? "bg-accent-muted/25" : "bg-surface/30"
                }`}
              >
                <th className="sticky left-0 z-10 bg-inherit px-3 py-2 text-left text-xs font-medium text-muted">
                  {row.label}
                  {row.differs ? (
                    <span className="ml-1 text-accent" title="Valores distintos">
                      *
                    </span>
                  ) : null}
                </th>
                {row.values.map((value, i) => (
                  <td
                    key={`${row.key}-${games[i]?.bggId ?? i}`}
                    className="px-3 py-2 text-center align-top text-ink-soft [overflow-wrap:anywhere]"
                  >
                    {value ?? "—"}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {compare && games.length > 0 ? (
        <div className="space-y-4">
          {compare.tagGroups.map((group) => (
            <section
              key={group.label}
              className="rounded-xl border border-border bg-surface-raised/40 p-4"
            >
              <h3 className="text-sm font-semibold text-ink">{group.label}</h3>
              {group.shared.length > 0 ? (
                <div className="mt-2">
                  <p className="text-xs text-muted">En común</p>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {group.shared.map((tag) => (
                      <span
                        key={tag}
                        className="rounded-lg border border-accent/30 bg-accent/10 px-2 py-1 text-xs text-accent"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="mt-2 text-xs text-muted-dim">Sin solapamiento.</p>
              )}
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {group.uniqueByGame.map((u) =>
                  u.values.length > 0 ? (
                    <div key={`${group.label}-${u.bggId}`}>
                      <p className="text-xs text-muted">Solo en {u.name}</p>
                      <div className="mt-1 flex flex-wrap gap-1.5">
                        {u.values.map((tag) => (
                          <span
                            key={tag}
                            className="rounded-lg border border-border bg-surface-card px-2 py-1 text-xs text-ink-soft"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  ) : null,
                )}
              </div>
            </section>
          ))}
        </div>
      ) : null}

      {loading ? (
        <p className="text-sm text-muted" aria-live="polite">
          Actualizando comparación…
        </p>
      ) : null}

      <AppModal
        open={addOpen}
        title="Añadir juego"
        onClose={() => {
          if (resolving) return;
          setAddOpen(false);
          setSearchResults([]);
          setInput("");
        }}
        primaryAction={{
          label: resolving ? "Buscando…" : "Buscar",
          onClick: () => {
            if (resolving || !input.trim()) return;
            void handleResolve();
          },
        }}
      >
        <form
          onSubmit={(e) => void handleResolve(e)}
          className="space-y-3"
        >
          <label
            htmlFor="game-compare-input"
            className="mb-1 block text-sm text-muted"
          >
            Nombre, URL o ID de BGG
          </label>
          <input
            id="game-compare-input"
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-ink"
            placeholder="https://boardgamegeek.com/boardgame/…"
            disabled={resolving}
            autoFocus
          />
        </form>
        {searchResults.length > 0 ? (
          <ul className="mt-4 max-h-64 divide-y divide-border overflow-y-auto rounded-lg border border-border">
            {searchResults.map((hit) => (
              <li key={hit.bggId}>
                <button
                  type="button"
                  disabled={resolving || loading}
                  onClick={() => void appendGame(hit.bggId)}
                  className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left hover:bg-surface-raised/60 disabled:opacity-50"
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <GameSubtypeBadge subtype={hit.type} size="sm" />
                    <span className="truncate font-medium text-ink">
                      {hit.name}
                    </span>
                  </span>
                  <span className="shrink-0 text-xs text-muted-dim">
                    {hit.yearPublished ?? "—"}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </AppModal>
    </div>
  );
}
