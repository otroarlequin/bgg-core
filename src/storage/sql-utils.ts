export function sqlNull<T>(value: T | null | undefined): T | null {
  return value ?? null;
}

/**
 * Display title for collection rows joined to `games`.
 * A mapped "Unknown" from /thing must not hide a real collection XML name.
 */
export const SQL_RESOLVED_GAME_NAME = `COALESCE(NULLIF(g.name, 'Unknown'), NULLIF(ce.name, 'Unknown'), g.name, ce.name)`;
