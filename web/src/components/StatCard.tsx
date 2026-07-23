import type { ReactNode } from "react";

interface StatCardProps {
  label: string;
  value: string | number;
  hint?: string;
  icon?: ReactNode;
  onClick?: () => void;
}

export function StatCard({ label, value, hint, icon, onClick }: StatCardProps) {
  const interactive = onClick != null;
  const className = [
    "flex flex-col items-center rounded-xl border border-border bg-surface-raised/70 px-3 py-4 text-center transition sm:px-4",
    interactive
      ? "cursor-pointer hover:border-accent/60 hover:bg-surface-card active:scale-[0.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      : "",
  ]
    .filter(Boolean)
    .join(" ");

  const content = (
    <>
      {icon ? (
        <div className="mb-2 flex h-9 w-9 items-center justify-center rounded-lg bg-surface-card text-accent">
          {icon}
        </div>
      ) : null}
      <p className="text-xs leading-snug text-muted sm:text-sm">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums tracking-tight text-ink">
        {value}
      </p>
      {hint ? (
        <p className="mt-1 max-w-[14rem] text-[11px] leading-snug text-muted-dim sm:text-xs">
          {hint}
        </p>
      ) : null}
      {interactive ? (
        <p className="mt-2 text-[11px] font-medium text-accent/90 sm:text-xs">
          Ver en colección
        </p>
      ) : null}
    </>
  );

  if (interactive) {
    return (
      <button type="button" onClick={onClick} className={`${className} w-full`}>
        {content}
      </button>
    );
  }

  return <div className={className}>{content}</div>;
}
