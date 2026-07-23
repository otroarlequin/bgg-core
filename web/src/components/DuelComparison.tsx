import type { DuelComparison, GamePeriodSummary } from "../api/types";
import { BggLink } from "./BggLink";

interface DuelComparisonProps {
  duel: DuelComparison;
  onChoose: (winnerBggId: number) => void;
  loading?: boolean;
}

function CandidateCard({
  candidate,
  onChoose,
  loading,
}: {
  candidate: GamePeriodSummary;
  onChoose: () => void;
  loading?: boolean;
}) {
  return (
    <div className="flex h-full min-h-[28rem] flex-1 flex-col rounded-2xl border border-border bg-surface-raised/80 p-5">
      <div className="relative mx-auto">
        <img
          src={
            candidate.imageUrl ??
            candidate.thumbnailUrl ??
            "https://placehold.co/240x240/1e293b/94a3b8?text=BGG"
          }
          alt={candidate.name}
          className="h-40 w-40 shrink-0 rounded-xl object-cover bg-surface-card"
        />
        <div className="absolute right-1 top-1">
          <BggLink bggId={candidate.bggId} className="bg-surface/80 backdrop-blur" />
        </div>
      </div>
      <h3 className="mt-4 min-h-[3.5rem] text-center text-xl font-semibold leading-snug text-ink">
        {candidate.name}
      </h3>
      <button
        type="button"
        disabled={loading}
        onClick={onChoose}
        className="mt-3 shrink-0 rounded-xl bg-accent px-4 py-3 font-semibold text-surface hover:bg-accent-hover disabled:opacity-50"
      >
        Elijo este
      </button>
      {candidate.designers.length > 0 ? (
        <p className="mt-3 text-center text-sm text-muted">
          {candidate.designers.join(", ")}
        </p>
      ) : (
        <p className="mt-3 text-center text-sm text-transparent select-none">—</p>
      )}
      <div className="mt-4 flex-1 space-y-2 text-sm text-ink-soft">
        <p>
          Partidas en el periodo: <strong>{candidate.playCount}</strong>
        </p>
        <p>
          Tiempo total: <strong>{candidate.totalMinutes} min</strong>
        </p>
        <p>
          Periodo jugado: {candidate.firstPlay} → {candidate.lastPlay}
        </p>
        {candidate.personalRating != null ? (
          <p>
            Rating personal: <strong>{candidate.personalRating}</strong>
          </p>
        ) : null}
        {candidate.weight != null ? (
          <p>
            Peso: <strong>{candidate.weight.toFixed(2)}</strong>
          </p>
        ) : null}
        {candidate.winRate != null ? (
          <p>
            Victorias: <strong>{candidate.wins}</strong> (
            {Math.round(candidate.winRate * 100)}%)
          </p>
        ) : null}
      </div>
    </div>
  );
}

export function DuelComparisonView({
  duel,
  onChoose,
  loading,
}: DuelComparisonProps) {
  return (
    <div>
      <p className="mb-4 text-center text-muted">
        Duelo #{duel.roundNumber} · {duel.remainingCount} juegos en competencia
      </p>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-stretch">
        <CandidateCard
          candidate={duel.candidateA}
          onChoose={() => onChoose(duel.candidateA.bggId)}
          loading={loading}
        />
        <div className="flex items-center justify-center text-2xl font-bold text-accent">
          VS
        </div>
        <CandidateCard
          candidate={duel.candidateB}
          onChoose={() => onChoose(duel.candidateB.bggId)}
          loading={loading}
        />
      </div>
    </div>
  );
}
