import { useState, type ReactNode } from "react";

interface CollapsiblePanelProps {
  title: string;
  defaultOpen?: boolean;
  children: ReactNode;
  /** Shown when collapsed, e.g. active filter count */
  summary?: string;
}

export function CollapsiblePanel({
  title,
  defaultOpen = true,
  children,
  summary,
}: CollapsiblePanelProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="rounded-xl border border-border bg-surface-raised/60">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
        aria-expanded={open}
      >
        <div className="min-w-0">
          <p className="text-sm font-semibold text-ink">{title}</p>
          {!open && summary ? (
            <p className="mt-0.5 truncate text-xs text-muted-dim">{summary}</p>
          ) : null}
        </div>
        <span className="shrink-0 text-xs font-medium text-accent">
          {open ? "Ocultar" : "Mostrar"}
        </span>
      </button>
      {open ? <div className="border-t border-border p-4">{children}</div> : null}
    </div>
  );
}
