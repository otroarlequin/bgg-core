import {
  useEffect,
  useId,
  useRef,
  type ReactNode,
} from "react";

export interface AppModalProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  /** Primary action (accent). */
  primaryAction?: {
    label: string;
    onClick: () => void;
  };
  /** Secondary action; defaults to Cerrar if omitted and primary exists. */
  secondaryAction?: {
    label: string;
    onClick: () => void;
  };
  /** Show a close (X) control in the header. Default true. */
  showCloseButton?: boolean;
}

/**
 * Modal estándar Cartón y tinta: overlay, panel raised, cierre Esc/backdrop.
 */
export function AppModal({
  open,
  title,
  onClose,
  children,
  primaryAction,
  secondaryAction,
  showCloseButton = true,
}: AppModalProps) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    panelRef.current?.focus();
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  const secondary = secondaryAction ?? {
    label: "Cerrar",
    onClick: onClose,
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center"
      role="presentation"
    >
      <button
        type="button"
        aria-label="Cerrar diálogo"
        className="absolute inset-0 bg-surface/80 backdrop-blur-[2px]"
        onClick={onClose}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="relative z-10 w-full max-w-md rounded-2xl border border-border bg-surface-raised p-5 shadow-lg outline-none"
      >
        <div className="mb-3 flex items-start justify-between gap-3">
          <h2 id={titleId} className="text-lg font-semibold text-ink">
            {title}
          </h2>
          {showCloseButton ? (
            <button
              type="button"
              onClick={onClose}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border text-muted hover:bg-surface-card hover:text-ink"
              aria-label="Cerrar"
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
              </svg>
            </button>
          ) : null}
        </div>

        <div className="space-y-3 text-sm leading-relaxed text-ink-soft">
          {children}
        </div>

        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={secondary.onClick}
            className="min-h-11 rounded-lg border border-border px-4 py-2 text-sm text-ink-soft hover:bg-surface-card md:min-h-0"
          >
            {secondary.label}
          </button>
          {primaryAction ? (
            <button
              type="button"
              onClick={primaryAction.onClick}
              className="min-h-11 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-ink hover:bg-accent-hover md:min-h-0"
            >
              {primaryAction.label}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
