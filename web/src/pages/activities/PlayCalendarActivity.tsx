import { useCallback, useEffect, useMemo, useState } from "react";
import { fetchPlayCalendar, fetchPlays } from "../../api/client";
import type { PlayCalendarResult, PlayItem, PlayPlayer } from "../../api/types";
import { BggLink } from "../../components/BggLink";

const WEEKDAY_LABELS = ["L", "M", "X", "J", "V", "S", "D"] as const;
const MONTH_SHORT = [
  "ene",
  "feb",
  "mar",
  "abr",
  "may",
  "jun",
  "jul",
  "ago",
  "sep",
  "oct",
  "nov",
  "dic",
] as const;

function formatLocalIso(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function isoToday(): string {
  return formatLocalIso(new Date());
}

/** Restar meses en calendario local (evita desfaces UTC). */
function isoMonthsAgo(months: number): string {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setMonth(d.getMonth() - months);
  return formatLocalIso(d);
}

const RANGE_PRESETS = [
  { id: "1m", label: "Último mes", months: 1 },
  { id: "3m", label: "Últimos 3 meses", months: 3 },
  { id: "6m", label: "Últimos 6 meses", months: 6 },
  { id: "1y", label: "Último año", months: 12 },
] as const;

function addDays(iso: string, delta: number): string {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

function weekdayMondayFirst(iso: string): number {
  const d = new Date(`${iso}T12:00:00Z`);
  return (d.getUTCDay() + 6) % 7;
}

function intensityClass(count: number, max: number): string {
  if (count <= 0) return "bg-surface-card/50 hover:bg-surface-card";
  const t = max <= 1 ? 1 : count / max;
  if (t < 0.25) return "bg-accent/30 hover:bg-accent/40";
  if (t < 0.5) return "bg-accent/50 hover:bg-accent/60";
  if (t < 0.75) return "bg-accent/75 hover:bg-accent/85";
  return "bg-accent hover:brightness-110";
}

function formatLongDate(iso: string): string {
  const d = new Date(`${iso}T12:00:00Z`);
  return d.toLocaleDateString("es", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}

function winnerLabel(players: PlayPlayer[]): string {
  const winners = players.filter((p) => p.win);
  if (winners.length === 0) return "—";
  return winners.map((p) => p.name || p.username).join(", ");
}

type DayCell = { date: string; count: number };

type WeekMeta = {
  days: Array<DayCell | null>;
  /** Month of first real day in the week (0–11), or null if empty. */
  month: number | null;
  year: number | null;
  monthBoundary: boolean;
  yearBoundary: boolean;
};

export function PlayCalendarActivity() {
  const [fromInput, setFromInput] = useState(() => isoMonthsAgo(12));
  const [toInput, setToInput] = useState(() => isoToday());
  const [appliedFrom, setAppliedFrom] = useState(() => isoMonthsAgo(12));
  const [appliedTo, setAppliedTo] = useState(() => isoToday());
  const [calendar, setCalendar] = useState<PlayCalendarResult | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [dayPlays, setDayPlays] = useState<PlayItem[]>([]);
  const [expandedPlayId, setExpandedPlayId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [dayLoading, setDayLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadCalendar = useCallback(async (from: string, to: string) => {
    setError(null);
    setSelected(null);
    setDayPlays([]);
    setExpandedPlayId(null);
    setRefreshing(true);
    try {
      const result = await fetchPlayCalendar({ from, to });
      setCalendar(result);
      setFromInput(result.from);
      setToInput(result.to);
      setAppliedFrom(result.from);
      setAppliedTo(result.to);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadCalendar(isoMonthsAgo(12), isoToday());
  }, [loadCalendar]);

  const activePresetId = useMemo(() => {
    if (appliedTo !== isoToday()) return null;
    for (const preset of RANGE_PRESETS) {
      if (appliedFrom === isoMonthsAgo(preset.months)) return preset.id;
    }
    return null;
  }, [appliedFrom, appliedTo]);

  const countByDate = useMemo(() => {
    const map = new Map<string, number>();
    if (!calendar) return map;
    for (const d of calendar.days) map.set(d.date, d.playCount);
    return map;
  }, [calendar]);

  const maxCount = useMemo(() => {
    let m = 0;
    for (const v of countByDate.values()) m = Math.max(m, v);
    return m;
  }, [countByDate]);

  const weeks = useMemo((): WeekMeta[] => {
    if (!calendar) return [];
    const cells: Array<DayCell | null> = [];
    const pad = weekdayMondayFirst(calendar.from);
    for (let i = 0; i < pad; i++) cells.push(null);
    for (let d = calendar.from; d <= calendar.to; d = addDays(d, 1)) {
      cells.push({ date: d, count: countByDate.get(d) ?? 0 });
    }
    while (cells.length % 7 !== 0) cells.push(null);

    const columns: WeekMeta[] = [];
    for (let i = 0; i < cells.length; i += 7) {
      const days = cells.slice(i, i + 7);
      const first = days.find((c) => c != null) ?? null;
      const month = first ? Number(first.date.slice(5, 7)) - 1 : null;
      const year = first ? Number(first.date.slice(0, 4)) : null;
      columns.push({
        days,
        month,
        year,
        monthBoundary: false,
        yearBoundary: false,
      });
    }

    for (let i = 0; i < columns.length; i++) {
      const cur = columns[i]!;
      const prev = i > 0 ? columns[i - 1]! : null;
      if (!prev || cur.month == null) continue;
      if (prev.month != null && cur.month !== prev.month) {
        cur.monthBoundary = true;
      }
      if (prev.year != null && cur.year != null && cur.year !== prev.year) {
        cur.yearBoundary = true;
        cur.monthBoundary = true;
      }
    }
    return columns;
  }, [calendar, countByDate]);

  const headerCells = useMemo(() => {
    return weeks.map((week, wi) => {
      const first = week.days.find((c) => c != null);
      if (!first) return { weekIndex: wi, label: "", yearLabel: null as string | null };
      const month = Number(first.date.slice(5, 7)) - 1;
      const year = first.date.slice(0, 4);
      const showMonth =
        wi === 0 ||
        week.monthBoundary ||
        (weeks[wi - 1]?.month != null && weeks[wi - 1]!.month !== month);
      return {
        weekIndex: wi,
        label: showMonth ? (MONTH_SHORT[month] ?? "") : "",
        yearLabel: week.yearBoundary ? year : wi === 0 ? year : null,
      };
    });
  }, [weeks]);

  function applyRange() {
    if (!fromInput || !toInput) {
      setError("Indica fecha desde y hasta");
      return;
    }
    if (fromInput > toInput) {
      setError("La fecha desde no puede ser posterior a hasta");
      return;
    }
    void loadCalendar(fromInput, toInput);
  }

  function applyPreset(months: number) {
    const from = isoMonthsAgo(months);
    const to = isoToday();
    setFromInput(from);
    setToInput(to);
    void loadCalendar(from, to);
  }

  async function selectDay(date: string, count: number) {
    setSelected(date);
    setExpandedPlayId(null);
    if (count <= 0) {
      setDayPlays([]);
      return;
    }
    setDayLoading(true);
    try {
      const result = await fetchPlays({ from: date, to: date });
      setDayPlays(result.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar el día");
      setDayPlays([]);
    } finally {
      setDayLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-border bg-surface-raised/60 p-4">
        <h2 className="text-lg font-semibold text-ink">Calendario / rachas</h2>
        <p className="mt-1 text-sm text-muted">
          Partidas por día en el rango elegido. Pulsa un día para ver el detalle
          (jugadores, lugar, comentarios).
        </p>
      </div>

      {error ? (
        <p className="rounded-xl border border-red-900 bg-red-950/40 p-4 text-red-200">
          {error}
        </p>
      ) : null}

      <div className="rounded-xl border border-border bg-surface-raised/60 p-4">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-dim">
          Periodo
        </p>
        <div className="mb-3 flex flex-wrap gap-2">
          {RANGE_PRESETS.map((preset) => {
            const active = activePresetId === preset.id;
            return (
              <button
                key={preset.id}
                type="button"
                disabled={loading || refreshing}
                onClick={() => applyPreset(preset.months)}
                className={`min-h-10 rounded-lg border px-3 py-2 text-sm transition md:min-h-0 ${
                  active
                    ? "border-accent bg-accent/15 font-medium text-accent"
                    : "border-border bg-surface/60 text-ink-soft hover:border-accent/50 hover:text-ink"
                } disabled:opacity-50`}
              >
                {preset.label}
              </button>
            );
          })}
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-sm">
            <span className="mb-1 block text-muted">Desde</span>
            <input
              type="date"
              value={fromInput}
              onChange={(e) => setFromInput(e.target.value)}
              className="rounded-lg border border-border bg-surface px-3 py-2"
            />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-muted">Hasta</span>
            <input
              type="date"
              value={toInput}
              onChange={(e) => setToInput(e.target.value)}
              className="rounded-lg border border-border bg-surface px-3 py-2"
            />
          </label>
          <button
            type="button"
            onClick={applyRange}
            disabled={loading || refreshing}
            className="min-h-11 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-surface hover:bg-accent-hover disabled:opacity-50 md:min-h-0"
          >
            {refreshing ? "Aplicando…" : "Aplicar"}
          </button>
        </div>
      </div>

      {loading && !calendar ? (
        <p className="text-sm text-muted">Cargando…</p>
      ) : calendar ? (
        <div
          className={`space-y-6 transition-opacity ${refreshing ? "opacity-60" : "opacity-100"}`}
        >
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Racha actual" value={String(calendar.currentStreak)} />
            <Stat label="Mejor racha" value={String(calendar.bestStreak)} />
            <Stat
              label="Días con partida"
              value={String(calendar.daysWithPlays)}
            />
            <Stat label="Partidas" value={String(calendar.totalPlays)} />
          </div>

          <div className="rounded-xl border border-border bg-surface-raised/40 p-3 sm:p-4">
            <div className="flex w-full gap-1.5">
              <div className="flex w-5 shrink-0 flex-col pt-9">
                {WEEKDAY_LABELS.map((d, i) => (
                  <span
                    key={d}
                    className={`flex flex-1 items-center justify-end pr-0.5 text-[9px] font-medium text-muted-dim sm:text-[10px] ${
                      i % 2 === 1 ? "opacity-100" : "invisible"
                    }`}
                  >
                    {d}
                  </span>
                ))}
              </div>

              <div className="min-w-0 flex-1">
                {/* Month / year header — same column count as weeks */}
                <div
                  className="mb-1 grid"
                  style={{
                    gridTemplateColumns: `repeat(${weeks.length}, minmax(0, 1fr))`,
                    columnGap: "2px",
                  }}
                >
                  {headerCells.map((h) => (
                    <div
                      key={`h-${h.weekIndex}`}
                      className="relative h-8 min-w-0 overflow-visible"
                    >
                      {h.yearLabel ? (
                        <span
                          className={`absolute -top-0.5 left-0 z-[1] whitespace-nowrap rounded bg-surface-raised/90 px-1 text-[9px] font-bold tabular-nums text-accent sm:text-[10px] ${
                            h.weekIndex > 0
                              ? "border-l-2 border-accent pl-1"
                              : ""
                          }`}
                        >
                          {h.yearLabel}
                        </span>
                      ) : null}
                      {h.label ? (
                        <span className="absolute bottom-0 left-0 text-[9px] font-semibold uppercase tracking-wide text-muted sm:text-[10px]">
                          {h.label}
                        </span>
                      ) : null}
                    </div>
                  ))}
                </div>

                <div
                  className="grid"
                  style={{
                    gridTemplateColumns: `repeat(${weeks.length}, minmax(0, 1fr))`,
                    columnGap: "2px",
                  }}
                >
                  {weeks.map((week, wi) => (
                    <div
                      key={wi}
                      className={[
                        "flex min-w-0 flex-col gap-0.5",
                        week.yearBoundary
                          ? "border-l-2 border-accent pl-0.5"
                          : week.monthBoundary
                            ? "border-l border-border/80 pl-0.5"
                            : "",
                      ].join(" ")}
                    >
                      {week.days.map((cell, di) => {
                        if (!cell) {
                          return (
                            <span
                              key={`e-${wi}-${di}`}
                              className="aspect-square w-full rounded-[2px] bg-transparent"
                            />
                          );
                        }
                        const active = selected === cell.date;
                        return (
                          <button
                            key={cell.date}
                            type="button"
                            title={`${cell.date}: ${cell.count} partida${cell.count === 1 ? "" : "s"}`}
                            aria-pressed={active}
                            onClick={() =>
                              void selectDay(cell.date, cell.count)
                            }
                            className={[
                              "aspect-square w-full min-w-0 rounded-[2px] transition",
                              intensityClass(cell.count, maxCount),
                              active
                                ? "z-10 ring-2 ring-accent-secondary ring-offset-1 ring-offset-surface scale-[1.15]"
                                : "hover:brightness-110",
                            ].join(" ")}
                          />
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
              <span>
                {calendar.from} → {calendar.to}
              </span>
              <div className="flex items-center gap-1.5">
                <span className="text-muted-dim">Menos</span>
                <span className="h-2.5 w-2.5 rounded-[2px] bg-surface-card/50" />
                <span className="h-2.5 w-2.5 rounded-[2px] bg-accent/30" />
                <span className="h-2.5 w-2.5 rounded-[2px] bg-accent/50" />
                <span className="h-2.5 w-2.5 rounded-[2px] bg-accent/75" />
                <span className="h-2.5 w-2.5 rounded-[2px] bg-accent" />
                <span className="text-muted-dim">Más</span>
              </div>
            </div>
          </div>

          {selected ? (
            <div className="overflow-hidden rounded-xl border-2 border-accent-secondary/70 bg-surface-raised/60 shadow-[inset_0_0_0_1px_rgba(138,154,106,0.25)]">
              <div className="border-b border-accent-secondary/40 bg-accent-secondary/15 px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-accent-secondary">
                  Fecha seleccionada
                </p>
                <h3 className="mt-0.5 text-lg font-bold capitalize text-ink sm:text-xl">
                  {formatLongDate(selected)}
                </h3>
                <p className="mt-1 font-mono text-xs text-muted">{selected}</p>
              </div>
              <div className="p-4">
                {dayLoading ? (
                  <p className="text-sm text-muted">Cargando…</p>
                ) : dayPlays.length === 0 ? (
                  <p className="text-sm text-muted">Sin partidas ese día.</p>
                ) : (
                  <ul className="space-y-2">
                    {dayPlays.map((play) => {
                      const expanded = expandedPlayId === play.playId;
                      const winner = winnerLabel(play.players);
                      return (
                        <li key={play.playId}>
                          <button
                            type="button"
                            onClick={() =>
                              setExpandedPlayId(expanded ? null : play.playId)
                            }
                            className={`flex w-full items-center gap-3 rounded-lg border border-border p-2.5 text-left transition hover:bg-surface-card ${
                              play.incomplete
                                ? "bg-accent/10"
                                : "bg-surface/40"
                            }`}
                          >
                            <img
                              src={
                                play.thumbnailUrl ??
                                "https://placehold.co/40x40/2a241c/a89880?text=BGG"
                              }
                              alt=""
                              className="h-12 w-12 shrink-0 rounded-lg object-cover"
                            />
                            <div className="min-w-0 flex-1 space-y-0.5">
                              <div className="flex items-start gap-2">
                                <span className="min-w-0 flex-1 font-medium leading-snug text-ink">
                                  {play.gameName}
                                </span>
                                <span
                                  onClick={(e) => e.stopPropagation()}
                                  onKeyDown={(e) => e.stopPropagation()}
                                >
                                  <BggLink bggId={play.bggId} />
                                </span>
                              </div>
                              <p className="text-xs text-muted">
                                {play.quantity > 1 ? `×${play.quantity} · ` : ""}
                                {play.location || "Sin lugar"}
                                {winner !== "—"
                                  ? ` · Ganó: ${winner}`
                                  : ""}
                              </p>
                              {play.incomplete ? (
                                <span className="inline-block rounded-md border border-accent-muted/50 bg-accent/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-accent">
                                  Incompleta
                                </span>
                              ) : null}
                              <p className="text-[11px] text-muted-dim">
                                {expanded
                                  ? "Ocultar detalle ▲"
                                  : "Ver detalle de la partida ▼"}
                              </p>
                            </div>
                          </button>
                          {expanded ? (
                            <div className="mt-1 rounded-lg border border-border bg-surface-raised/50 px-3 py-3 text-sm">
                              {play.comments ? (
                                <p className="mb-2 text-ink-soft">
                                  {play.comments}
                                </p>
                              ) : null}
                              {play.length > 0 ? (
                                <p className="mb-2 text-xs text-muted">
                                  Duración: {play.length} min
                                </p>
                              ) : null}
                              {play.players.length > 0 ? (
                                <ul className="space-y-1 text-muted">
                                  {play.players.map((p) => (
                                    <li
                                      key={`${p.playId}-${p.username}-${p.name}`}
                                      className={
                                        p.win
                                          ? "text-accent-secondary"
                                          : undefined
                                      }
                                    >
                                      {p.name || p.username}
                                      {p.win ? " (ganó)" : ""}
                                      {p.score ? ` — ${p.score} pts` : ""}
                                    </li>
                                  ))}
                                </ul>
                              ) : (
                                <p className="text-muted-dim">
                                  Sin jugadores registrados.
                                </p>
                              )}
                            </div>
                          ) : null}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-dim">
              Selecciona un día en el calendario para ver el detalle.
            </p>
          )}
        </div>
      ) : null}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-surface/50 px-3 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-dim">
        {label}
      </p>
      <p className="mt-1 text-2xl font-bold tabular-nums text-accent">{value}</p>
    </div>
  );
}
