import { Fragment, useState } from "react";
import type { PlayItem, PlayPlayer } from "../api/types";
import { BggLink } from "./BggLink";

interface PlaysTableProps {
  items: PlayItem[];
}

function winnerLabel(players: PlayPlayer[]): string {
  const winners = players.filter((p) => p.win);
  if (winners.length === 0) return "—";
  if (winners.length > 1) {
    return winners.map((p) => p.name || p.username).join(", ");
  }
  return winners[0].name || winners[0].username || "—";
}

function PlayDetails({ play }: { play: PlayItem }) {
  return (
    <div className="space-y-2">
      {play.comments ? (
        <p className="text-ink-soft">{play.comments}</p>
      ) : null}
      {play.players.length > 0 ? (
        <ul className="space-y-1 text-muted">
          {play.players.map((p) => (
            <li
              key={`${p.playId}-${p.username}-${p.name}`}
              className={p.win ? "text-accent-secondary" : undefined}
            >
              {p.name || p.username}
              {p.win ? " (ganó)" : ""}
              {p.score ? ` — ${p.score} pts` : ""}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-muted-dim">Sin jugadores registrados.</p>
      )}
    </div>
  );
}

export function PlaysTable({ items }: PlaysTableProps) {
  const [expandedId, setExpandedId] = useState<number | null>(null);

  if (items.length === 0) {
    return (
      <p className="rounded-xl border border-border bg-surface-raised/60 p-4 text-sm text-muted-dim">
        No hay partidas para estos filtros.
      </p>
    );
  }

  return (
    <>
      <ul className="space-y-2 md:hidden">
        {items.map((play) => {
          const expanded = expandedId === play.playId;
          const winner = winnerLabel(play.players);
          return (
            <li key={play.playId}>
              <button
                type="button"
                onClick={() => setExpandedId(expanded ? null : play.playId)}
                className={`w-full rounded-xl border border-border p-3 text-left transition ${
                  play.incomplete
                    ? "bg-accent/10"
                    : "bg-surface/40 hover:bg-surface-card"
                }`}
              >
                <div className="flex gap-3">
                  <img
                    src={
                      play.thumbnailUrl ??
                      "https://placehold.co/40x40/2a241c/a89880?text=BGG"
                    }
                    alt=""
                    className="h-14 w-14 shrink-0 rounded-lg object-cover bg-surface-raised"
                  />
                  <div className="min-w-0 flex-1 space-y-1">
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
                      {play.date}
                      {play.quantity > 1 ? ` · ×${play.quantity}` : ""}
                      {play.location ? ` · ${play.location}` : ""}
                    </p>
                    <p className="text-xs text-ink-soft">
                      Ganador:{" "}
                      {winner === "—" ? (
                        <span className="text-muted-dim">—</span>
                      ) : (
                        <span className="font-medium text-accent-secondary">
                          {winner}
                        </span>
                      )}
                    </p>
                    {play.incomplete ? (
                      <span className="inline-block rounded-md border border-accent-muted/50 bg-accent/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-accent">
                        Incompleta
                      </span>
                    ) : null}
                  </div>
                </div>
              </button>
              {expanded ? (
                <div className="mt-1 rounded-xl border border-border bg-surface-raised/40 px-3 py-3 text-sm">
                  <PlayDetails play={play} />
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>

      <div className="hidden overflow-hidden rounded-xl border border-border md:block">
        <table className="min-w-full text-sm">
          <thead className="bg-surface-raised text-left text-muted">
            <tr>
              <th className="px-4 py-3">Fecha</th>
              <th className="px-4 py-3">Juego</th>
              <th className="px-4 py-3">Cant.</th>
              <th className="px-4 py-3">Ganador</th>
              <th className="px-4 py-3">Lugar</th>
            </tr>
          </thead>
          <tbody>
            {items.map((play) => {
              const expanded = expandedId === play.playId;
              const winner = winnerLabel(play.players);
              return (
                <Fragment key={play.playId}>
                  <tr
                    className={`cursor-pointer border-t border-border transition hover:bg-surface-card ${
                      play.incomplete ? "bg-accent/10" : "bg-surface/40"
                    }`}
                    onClick={() =>
                      setExpandedId(expanded ? null : play.playId)
                    }
                  >
                    <td className="px-4 py-3 whitespace-nowrap text-ink-soft">
                      <div className="flex flex-col gap-1">
                        <span>{play.date}</span>
                        {play.incomplete ? (
                          <span className="w-fit rounded-md border border-accent-muted/50 bg-accent/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-accent">
                            Incompleta
                          </span>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <img
                          src={
                            play.thumbnailUrl ??
                            "https://placehold.co/40x40/2a241c/a89880?text=BGG"
                          }
                          alt=""
                          className="h-10 w-10 shrink-0 rounded-md object-cover bg-surface-raised"
                        />
                        <div className="flex min-w-0 items-start gap-2">
                          <span className="min-w-0 font-medium text-ink">
                            {play.gameName}
                          </span>
                          <BggLink bggId={play.bggId} />
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 tabular-nums text-ink-soft">
                      {play.quantity}
                    </td>
                    <td className="px-4 py-3">
                      {winner === "—" ? (
                        <span className="text-muted-dim">—</span>
                      ) : (
                        <span className="font-medium text-accent-secondary">
                          {winner}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-ink-soft">
                      {play.location || "—"}
                    </td>
                  </tr>
                  {expanded ? (
                    <tr
                      key={`${play.playId}-detail`}
                      className="border-t border-border bg-surface-raised/40"
                    >
                      <td colSpan={5} className="px-4 py-3">
                        <PlayDetails play={play} />
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
