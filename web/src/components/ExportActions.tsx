import { useState } from "react";

interface ExportActionsProps {
  busyLabel?: string;
  onDownloadPng: () => Promise<void>;
  onCopyText: () => Promise<void>;
  className?: string;
}

export function ExportActions({
  busyLabel = "Generando…",
  onDownloadPng,
  onCopyText,
  className = "",
}: ExportActionsProps) {
  const [busy, setBusy] = useState<"png" | "text" | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(kind: "png" | "text", fn: () => Promise<void>) {
    setBusy(kind);
    setError(null);
    setStatus(null);
    try {
      await fn();
      setStatus(kind === "png" ? "PNG descargado" : "Texto copiado");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo exportar");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className={`space-y-2 ${className}`}>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy != null}
          onClick={() => void run("png", onDownloadPng)}
          className="min-h-10 rounded-lg bg-accent px-3 py-2 text-sm font-medium text-surface hover:bg-accent-hover disabled:opacity-50"
        >
          {busy === "png" ? busyLabel : "Descargar PNG"}
        </button>
        <button
          type="button"
          disabled={busy != null}
          onClick={() => void run("text", onCopyText)}
          className="min-h-10 rounded-lg border border-border px-3 py-2 text-sm text-ink-soft hover:bg-surface-card disabled:opacity-50"
        >
          {busy === "text" ? busyLabel : "Copiar texto"}
        </button>
      </div>
      {status ? <p className="text-xs text-accent-secondary">{status}</p> : null}
      {error ? <p className="text-xs text-red-300">{error}</p> : null}
    </div>
  );
}
