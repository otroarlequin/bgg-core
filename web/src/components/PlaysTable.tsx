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
    <div className="overflow-hidden rounded-xl border border-border">
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
                    play.incomplete
                      ? "bg-accent/10"
                      : "bg-surface/40"
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
                  <td className="px-4 py-3 tabular-nums text-ink-soft">{play.quantity}</td>
                  <td className="px-4 py-3">
                    {winner === "—" ? (
                      <span className="text-muted-dim">—</span>
                    ) : (
                      <span className="font-medium text-accent-secondary">{winner}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-ink-soft">{play.location || "—"}</td>
                </tr>
                {expanded ? (
                  <tr
                    key={`${play.playId}-detail`}
                    className="border-t border-border bg-surface-raised/40"
                  >
                    <td colSpan={5} className="px-4 py-3">
                      {play.comments ? (
                        <p className="mb-2 text-ink-soft">{play.comments}</p>
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
                    </td>
                  </tr>
                ) : null}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
