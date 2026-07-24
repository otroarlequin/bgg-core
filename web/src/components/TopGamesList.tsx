import type { TopGameSummary } from "../api/types";
import { GameCard } from "./GameCard";
import { ExportActions } from "./ExportActions";
import { copyText, downloadPng } from "../export/canvas";
import {
  renderTopPlayedCard,
  topPlayedPlainText,
} from "../export/topPlayedCard";

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

  const exportInput = { title, items, valueLabel, limit: 10 };

  return (
    <div className="rounded-xl border border-border bg-surface-raised/60 p-4">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <h3 className="font-medium text-ink">{title}</h3>
        <ExportActions
          onDownloadPng={async () => {
            const canvas = await renderTopPlayedCard(exportInput);
            const slug = title
              .toLowerCase()
              .replace(/[^a-z0-9]+/gi, "-")
              .replace(/^-|-$/g, "");
            downloadPng(canvas, `top-${slug || "jugados"}`);
          }}
          onCopyText={async () => {
            await copyText(topPlayedPlainText(exportInput));
          }}
        />
      </div>
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
