import { useEffect, useState } from "react";
import {
  applyTheme,
  getStoredTheme,
  themes,
  type ThemeId,
} from "../theme";

export function ThemeSelect({ showLabel = false }: { showLabel?: boolean }) {
  const [theme, setTheme] = useState<ThemeId>(() => getStoredTheme());

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const current = themes.find((t) => t.id === theme);

  return (
    <label className="block text-sm text-ink-soft">
      {showLabel ? (
        <span className="mb-1 block text-muted">Tema visual</span>
      ) : (
        <span className="sr-only">Tema visual</span>
      )}
      <select
        value={theme}
        onChange={(e) => setTheme(e.target.value as ThemeId)}
        className="mt-0 block min-h-11 w-full rounded-lg border border-border bg-surface-card px-3 py-2 text-sm text-ink md:min-h-0"
        aria-label="Tema visual"
        title={current?.description}
      >
        {themes.map((t) => (
          <option key={t.id} value={t.id}>
            {t.label}
          </option>
        ))}
      </select>
      {showLabel && current ? (
        <p className="mt-1.5 text-xs text-muted-dim">{current.description}</p>
      ) : null}
    </label>
  );
}
