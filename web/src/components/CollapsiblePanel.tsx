import { useState, type ReactNode } from "react";

interface CollapsiblePanelProps {
  title: string;
  defaultOpen?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: ReactNode;
  /** Shown when collapsed, e.g. active filter count */
  summary?: string;
  /** Extra controls next to Mostrar/Ocultar (stopPropagation if clickable). */
  actions?: ReactNode;
  className?: string;
}

export function CollapsiblePanel({
  title,
  defaultOpen = true,
  open: openProp,
  onOpenChange,
  children,
  summary,
  actions,
  className = "rounded-xl border border-border bg-surface-raised/60",
}: CollapsiblePanelProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultOpen);
  const open = openProp ?? uncontrolledOpen;

  function setOpen(next: boolean) {
    if (openProp === undefined) setUncontrolledOpen(next);
    onOpenChange?.(next);
  }

  return (
    <div className={className}>
      <div className="flex w-full items-center gap-2 px-4 py-3">
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="flex min-w-0 flex-1 items-center justify-between gap-3 text-left"
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
        {actions ? <div className="shrink-0">{actions}</div> : null}
      </div>
      {open ? <div className="border-t border-border p-4">{children}</div> : null}
    </div>
  );
}
