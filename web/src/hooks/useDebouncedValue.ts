import { useEffect, useState } from "react";

/** Wait `delayMs` after the last change before updating (search/typeahead). */
export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(id);
  }, [value, delayMs]);

  return debounced;
}

export const SEARCH_DEBOUNCE_MS = 300;

/**
 * Live BGG search should not fire on IDs/URLs (those wait for Analizar/Buscar)
 * or on a single character.
 */
export function shouldTypeaheadBggQuery(query: string): boolean {
  const trimmed = query.trim();
  if (trimmed.length < 2) return false;
  if (/^\d+$/.test(trimmed)) return false;
  if (/^https?:\/\//i.test(trimmed)) return false;
  if (/boardgame(?:expansion|accessory)?\/\d+/i.test(trimmed)) return false;
  return true;
}
