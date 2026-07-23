import type { TopGameSummary } from "../api/types";
import { GameCard } from "./GameCard";

interface TopGamesListProps {
  title: string;
  items: TopGameSummary[];
  valueLabel: string;
}

export function TopGamesList({ title, items, valueLabel }: TopGamesListProps) {
  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-surface-raised/60 p-4">
        <h3 className="font-medium text-ink">{title}</h3>
        <p className="mt-2 text-sm text-muted-dim">Sin datos aún.</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-surface-raised/60 p-4">
      <h3 className="mb-3 font-medium text-ink">{title}</h3>
      <div className="space-y-2">
        {items.map((item) => (
          <GameCard
            key={item.bggId}
            bggId={item.bggId}
            name={item.name}
            thumbnailUrl={item.thumbnailUrl}
            subtitle={`${item.value} ${valueLabel}`}
          />
        ))}
      </div>
    </div>
  );
}
