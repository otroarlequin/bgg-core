import { useEffect, useMemo, useState } from "react";
import { fetchInsights } from "../../api/client";
import type {
  InsightsResult,
  InsightsTop100Item,
  InsightsYearBucket,
} from "../../api/types";
import { bggGameUrl } from "../../components/BggLink";

function formatHours(hours: number): string {
  return `${hours.toFixed(1)} h`;
}

function formatPct(rate: number | null): string {
  if (rate == null) return "—";
  return `${Math.round(rate * 100)}%`;
}

function trackingDate(iso: string | null): string | null {
  if (!iso) return null;
  return iso.slice(0, 10);
}

function YearBars({ yearly }: { yearly: InsightsYearBucket[] }) {
  const max = Math.max(1, ...yearly.map((item) => item.plays));
  return (
    <div className="flex items-end gap-2 overflow-x-auto pb-1">
      {yearly.map((item) => {
        const height = Math.max(8, Math.round((item.plays / max) * 96));
        return (
          <div
            key={item.year}
            className="flex w-12 shrink-0 flex-col items-center gap-1"
          >
            <span className="text-[10px] tabular-nums text-muted">
              {item.plays}
            </span>
            <div
              className="w-7 rounded-t bg-accent"
              style={{ height }}
              title={`${item.year}: ${item.plays} partidas`}
            />
            <span className="text-xs tabular-nums text-ink-soft">
              {item.year}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function Mosaic({ items }: { items: InsightsTop100Item[] }) {
  const byRank = new Map(items.map((item) => [item.rank, item]));
  const slots = Array.from({ length: 100 }, (_, i) => byRank.get(i + 1) ?? null);

  return (
    <div className="grid grid-cols-10 gap-1 sm:gap-1.5">
      {slots.map((item, index) => {
        const rank = index + 1;
        if (!item) {
          return (
            <div
              key={rank}
              className="aspect-square rounded-md bg-surface-card"
              title={`#${rank}`}
            />
          );
        }
        const href = bggGameUrl(item.bggId);
        return (
          <a
            key={item.bggId}
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            title={`#${item.rank} ${item.name}${item.owned ? " · owned" : ""}`}
            className={`aspect-square overflow-hidden rounded-md bg-surface-card ${
              item.owned ? "" : "opacity-25 grayscale"
            }`}
          >
            {item.thumbnailUrl ? (
              <img
                src={item.thumbnailUrl}
                alt=""
                className="h-full w-full object-cover"
              />
            ) : (
              <span className="flex h-full items-center justify-center text-[10px] text-muted">
                #{item.rank}
              </span>
            )}
          </a>
        );
      })}
    </div>
  );
}

function Histogram({
  items,
  labelFor,
}: {
  items: Array<{ id: string; plays: number }>;
  labelFor: (id: string) => string;
}) {
  const max = Math.max(1, ...items.map((item) => item.plays));
  return (
    <ul className="space-y-2">
      {items.map((item) => (
        <li key={item.id} className="flex items-center gap-3 text-sm">
          <span className="w-16 shrink-0 text-muted">{labelFor(item.id)}</span>
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-card">
            <div
              className="h-full rounded-full bg-accent"
              style={{ width: `${Math.round((item.plays / max) * 100)}%` }}
            />
          </div>
          <span className="w-8 shrink-0 text-right tabular-nums text-ink-soft">
            {item.plays}
          </span>
        </li>
      ))}
    </ul>
  );
}

export function InsightsActivity() {
  const [year, setYear] = useState<number | null>(null);
  const [data, setData] = useState<InsightsResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const result = await fetchInsights(
          year != null ? { year } : {},
        );
        if (!cancelled) setData(result);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Error al cargar Insights");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [year]);

  const yearOptions = useMemo(() => {
    const years = data?.years ?? [];
    return years;
  }, [data]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold tracking-tight text-ink">Insights</h2>
        <p className="mt-1 text-sm text-muted">
          Cómo juegas, año a año, y qué tanto del top 100 BGG está en tu estantería.
          El pasado de wishlist → owned no existe en BGG; a partir de ahora sí
          registramos esos cambios en cada sync.
        </p>
      </div>

      {data?.isProfile ? (
        <p className="rounded-xl border border-border bg-surface-card px-4 py-3 text-sm text-muted">
          En Profile el historial de partidas suele ser de ~1 año. Las series
          largas están en Personal.
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setYear(null)}
          className={`rounded-lg px-3 py-1.5 text-sm ${
            year == null
              ? "bg-accent text-surface"
              : "bg-surface-card text-ink-soft hover:bg-border"
          }`}
        >
          Todos
        </button>
        {yearOptions.map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => setYear(option)}
            className={`rounded-lg px-3 py-1.5 text-sm tabular-nums ${
              year === option
                ? "bg-accent text-surface"
                : "bg-surface-card text-ink-soft hover:bg-border"
            }`}
          >
            {option}
          </button>
        ))}
      </div>

      {error ? (
        <p className="rounded-xl border border-red-900/60 bg-red-950/30 p-4 text-sm text-red-200">
          {error}
        </p>
      ) : null}

      {loading && !data ? (
        <p className="text-sm text-muted">Cargando insights…</p>
      ) : null}

      {data ? (
        <>
          <section className="space-y-4 rounded-xl border border-border bg-surface-raised/60 p-4">
            <h3 className="text-lg font-semibold text-ink">Por año</h3>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Stat label="Partidas" value={String(data.selected.plays)} />
              <Stat label="Juegos únicos" value={String(data.selected.uniqueGames)} />
              <Stat label="Horas" value={formatHours(data.selected.hours)} />
              <Stat label="H-index" value={String(data.selected.hIndex)} />
            </div>
            {data.yearly.length > 0 ? (
              <YearBars yearly={data.yearly} />
            ) : (
              <p className="text-sm text-muted">Aún no hay partidas sincronizadas.</p>
            )}

            <div>
              <h4 className="mb-2 text-sm font-medium text-ink">
                Debuts en mesa
                {data.selected.debuts.length > 0
                  ? ` (${data.selected.debuts.length})`
                  : ""}
              </h4>
              {data.selected.debuts.length === 0 ? (
                <p className="text-sm text-muted">
                  Ningún juego tuvo su primera partida en este recorte.
                </p>
              ) : (
                <ul className="grid gap-2 sm:grid-cols-2">
                  {data.selected.debuts.map((item) => (
                    <li
                      key={item.bggId}
                      className="flex items-center gap-3 rounded-lg border border-border bg-surface-card px-3 py-2"
                    >
                      {item.thumbnailUrl ? (
                        <img
                          src={item.thumbnailUrl}
                          alt=""
                          className="h-10 w-10 rounded-md object-cover"
                        />
                      ) : (
                        <div className="h-10 w-10 rounded-md bg-surface-raised" />
                      )}
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-ink">
                          {item.name}
                        </p>
                        <p className="text-xs text-muted">
                          {item.firstPlay} · {item.playCount} partida
                          {item.playCount === 1 ? "" : "s"}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div>
              <h4 className="mb-2 text-sm font-medium text-ink">
                Owned sin partidas ({data.selected.unplayedOwned.count})
              </h4>
              {data.selected.unplayedOwned.count === 0 ? (
                <p className="text-sm text-muted">Nada pendiente en la estantería.</p>
              ) : (
                <p className="text-sm text-muted">
                  {data.selected.unplayedOwned.sample
                    .map((item) => item.name)
                    .join(" · ")}
                  {data.selected.unplayedOwned.count > 8 ? "…" : ""}
                </p>
              )}
            </div>

            <div className="rounded-lg border border-border bg-surface-card/60 px-3 py-3">
              <h4 className="text-sm font-medium text-ink">
                Cambios de colección
              </h4>
              <p className="mt-1 text-xs text-muted">
                {data.selected.trackingSince
                  ? `Registramos flags desde ${trackingDate(data.selected.trackingSince)}. El historial anterior a esa fecha no existe.`
                  : "Aún no hay baseline: el próximo sync de colección empezará a guardar wishlist ↔ owned."}
              </p>
              {data.selected.ownedThisPeriod.length === 0 ? (
                <p className="mt-2 text-sm text-muted">
                  Ningún paso a owned rastreado en este recorte.
                </p>
              ) : (
                <ul className="mt-2 space-y-2">
                  {data.selected.ownedThisPeriod.map((item) => (
                    <li key={`${item.bggId}-${item.ownedAt}`} className="text-sm text-ink">
                      <span className="font-medium">{item.name}</span>
                      <span className="text-muted">
                        {" "}
                        · owned {item.ownedAt.slice(0, 10)}
                        {item.daysWishlistToOwned != null
                          ? ` · ${item.daysWishlistToOwned} días desde wishlist`
                          : ""}
                        {item.daysOwnedToFirstPlay != null
                          ? ` · ${item.daysOwnedToFirstPlay} días hasta la 1ª partida`
                          : ""}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>

          <section className="space-y-3 rounded-xl border border-border bg-surface-raised/60 p-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h3 className="text-lg font-semibold text-ink">Top 100 BGG</h3>
              <p className="text-sm text-muted">
                {data.top100.items.length > 0
                  ? `${data.top100.owned} / ${data.top100.items.length} owned`
                  : "Sin lista"}
              </p>
            </div>
            {data.top100.error ? (
              <p className="text-sm text-muted">
                No se pudo leer el browse de BGG: {data.top100.error}
              </p>
            ) : null}
            {data.top100.items.length > 0 ? (
              <Mosaic items={data.top100.items} />
            ) : !data.top100.error ? (
              <p className="text-sm text-muted">Cargando mosaico…</p>
            ) : null}
          </section>

          <section className="space-y-4 rounded-xl border border-border bg-surface-raised/60 p-4">
            <h3 className="text-lg font-semibold text-ink">Jugadores</h3>
            <div className="grid gap-6 lg:grid-cols-2">
              <div>
                <h4 className="mb-2 text-sm font-medium text-ink">
                  Con quién juego
                </h4>
                {data.players.companions.length === 0 ? (
                  <p className="text-sm text-muted">
                    No hay compañeros en las partidas de este recorte.
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {data.players.companions.map((person) => (
                      <li
                        key={person.key}
                        className="rounded-lg border border-border bg-surface-card px-3 py-2 text-sm"
                      >
                        <p className="font-medium text-ink">{person.displayName}</p>
                        <p className="text-xs text-muted">
                          {person.playsTogether} partidas · {person.uniqueGames}{" "}
                          juegos · win {formatPct(person.winRate)}
                          {person.avgWeight != null
                            ? ` · peso ${person.avgWeight.toFixed(1)}`
                            : ""}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div className="space-y-4">
                <div>
                  <h4 className="mb-2 text-sm font-medium text-ink">
                    Número de jugadores
                  </h4>
                  <Histogram
                    items={data.players.playerCounts}
                    labelFor={(id) => (id === "6+" ? "6+" : `${id} jug.`)}
                  />
                </div>
                <div>
                  <h4 className="mb-2 text-sm font-medium text-ink">
                    Peso de lo jugado
                    {data.players.avgWeight != null
                      ? ` · media ${data.players.avgWeight.toFixed(2)}`
                      : ""}
                  </h4>
                  <Histogram
                    items={data.players.weightBuckets}
                    labelFor={(id) => {
                      const bucket = data.players.weightBuckets.find(
                        (item) => item.id === id,
                      );
                      return bucket?.label ?? id;
                    }}
                  />
                </div>
              </div>
            </div>
          </section>

          <section className="space-y-3 rounded-xl border border-border bg-surface-raised/60 p-4">
            <h3 className="text-lg font-semibold text-ink">Curiosidades</h3>
            <ul className="grid gap-2 text-sm text-ink-soft sm:grid-cols-2">
              <li>
                Más repetido:{" "}
                <span className="text-ink">
                  {data.curiosities.mostPlayed
                    ? `${data.curiosities.mostPlayed.name} (${data.curiosities.mostPlayed.plays})`
                    : "—"}
                </span>
              </li>
              <li>
                Solo vs multi:{" "}
                <span className="text-ink">
                  {data.curiosities.soloPlays} / {data.curiosities.multiPlays}
                </span>
              </li>
              <li>
                Mecánica más jugada:{" "}
                <span className="text-ink">
                  {data.curiosities.topMechanic?.name ?? "—"}
                </span>
              </li>
              <li>
                Categoría más jugada:{" "}
                <span className="text-ink">
                  {data.curiosities.topCategory?.name ?? "—"}
                </span>
              </li>
              <li>
                Racha actual:{" "}
                <span className="text-ink">
                  {data.curiosities.currentStreak} día
                  {data.curiosities.currentStreak === 1 ? "" : "s"}
                </span>
              </li>
            </ul>
          </section>
        </>
      ) : null}

      {loading && data ? (
        <p className="text-xs text-muted">Actualizando recorte…</p>
      ) : null}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-surface-card px-3 py-2">
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-0.5 text-lg font-semibold tabular-nums text-ink">{value}</p>
    </div>
  );
}
