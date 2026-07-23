import { useEffect, useMemo, useState } from "react";
import { fetchPlayCalendar, fetchPlayCalendarDay } from "../../api/client";
import type {
  PlayCalendarDayPlay,
  PlayCalendarResult,
} from "../../api/types";
import { BggLink } from "../../components/BggLink";

function addDays(iso: string, delta: number): string {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

function weekdayMondayFirst(iso: string): number {
  const d = new Date(`${iso}T12:00:00Z`);
  return (d.getUTCDay() + 6) % 7; // Mon=0 … Sun=6
}

function intensityClass(count: number, max: number): string {
  if (count <= 0) return "bg-surface-card/40";
  const t = max <= 1 ? 1 : count / max;
  if (t < 0.25) return "bg-accent/25";
  if (t < 0.5) return "bg-accent/45";
  if (t < 0.75) return "bg-accent/70";
  return "bg-accent";
}

export function PlayCalendarActivity() {
  const [calendar, setCalendar] = useState<PlayCalendarResult | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [dayPlays, setDayPlays] = useState<PlayCalendarDayPlay[]>([]);
  const [loading, setLoading] = useState(true);
  const [dayLoading, setDayLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const result = await fetchPlayCalendar();
        if (!cancelled) setCalendar(result);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Error al cargar");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

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

  const weeks = useMemo(() => {
    if (!calendar) return [] as Array<Array<{ date: string; count: number } | null>>;
    const cells: Array<{ date: string; count: number } | null> = [];
    const pad = weekdayMondayFirst(calendar.from);
    for (let i = 0; i < pad; i++) cells.push(null);
    for (let d = calendar.from; d <= calendar.to; d = addDays(d, 1)) {
      cells.push({ date: d, count: countByDate.get(d) ?? 0 });
    }
    const rows: Array<Array<{ date: string; count: number } | null>> = [];
    for (let i = 0; i < cells.length; i += 7) {
      rows.push(cells.slice(i, i + 7));
    }
    return rows;
  }, [calendar, countByDate]);

  async function selectDay(date: string, count: number) {
    setSelected(date);
    if (count <= 0) {
      setDayPlays([]);
      return;
    }
    setDayLoading(true);
    try {
      const result = await fetchPlayCalendarDay(date);
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
          Partidas por día en el último año. Pulsa un día para ver qué jugaste.
        </p>
      </div>

      {error ? (
        <p className="rounded-xl border border-red-900 bg-red-950/40 p-4 text-red-200">
          {error}
        </p>
      ) : null}

      {loading || !calendar ? (
        <p className="text-sm text-muted">Cargando…</p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Racha actual" value={String(calendar.currentStreak)} />
            <Stat label="Mejor racha" value={String(calendar.bestStreak)} />
            <Stat label="Días con partida" value={String(calendar.daysWithPlays)} />
            <Stat label="Partidas" value={String(calendar.totalPlays)} />
          </div>

          <div className="overflow-x-auto rounded-xl border border-border bg-surface-raised/40 p-3">
            <div className="mb-2 flex gap-2 text-[10px] uppercase tracking-wide text-muted-dim">
              {["L", "M", "X", "J", "V", "S", "D"].map((d) => (
                <span key={d} className="w-3 text-center sm:w-3.5">
                  {d}
                </span>
              ))}
            </div>
            <div className="flex flex-col gap-1">
              {weeks.map((week, wi) => (
                <div key={wi} className="flex gap-1">
                  {week.map((cell, ci) => {
                    if (!cell) {
                      return (
                        <span
                          key={`e-${wi}-${ci}`}
                          className="h-3 w-3 rounded-sm bg-transparent sm:h-3.5 sm:w-3.5"
                        />
                      );
                    }
                    const active = selected === cell.date;
                    return (
                      <button
                        key={cell.date}
                        type="button"
                        title={`${cell.date}: ${cell.count}`}
                        onClick={() => void selectDay(cell.date, cell.count)}
                        className={`h-3 w-3 rounded-sm transition sm:h-3.5 sm:w-3.5 ${intensityClass(
                          cell.count,
                          maxCount,
                        )} ${active ? "ring-2 ring-accent-secondary ring-offset-1 ring-offset-surface" : ""}`}
                      />
                    );
                  })}
                </div>
              ))}
            </div>
            <p className="mt-3 text-xs text-muted">
              {calendar.from} → {calendar.to}
            </p>
          </div>

          {selected ? (
            <div className="rounded-xl border border-border bg-surface-raised/60 p-4">
              <h3 className="font-semibold text-ink">{selected}</h3>
              {dayLoading ? (
                <p className="mt-2 text-sm text-muted">Cargando…</p>
              ) : dayPlays.length === 0 ? (
                <p className="mt-2 text-sm text-muted">Sin partidas ese día.</p>
              ) : (
                <ul className="mt-3 space-y-2">
                  {dayPlays.map((play) => (
                    <li
                      key={play.playId}
                      className="flex items-center gap-3 rounded-lg border border-border bg-surface/40 p-2"
                    >
                      <img
                        src={
                          play.thumbnailUrl ??
                          "https://placehold.co/40x40/2a241c/a89880?text=BGG"
                        }
                        alt=""
                        className="h-10 w-10 rounded object-cover"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start gap-2">
                          <span className="min-w-0 truncate font-medium text-ink">
                            {play.gameName}
                          </span>
                          <BggLink bggId={play.bggId} />
                        </div>
                        {play.quantity > 1 ? (
                          <p className="text-xs text-muted">×{play.quantity}</p>
                        ) : null}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : null}
        </>
      )}
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
