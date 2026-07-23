/** Detects virtual play locations (Tabletop Simulator / Board Game Arena). */
export function isVirtualLocation(location: string): boolean {
  const loc = location.trim().toLowerCase();
  if (!loc) return false;
  if (loc.includes("tabletop simulator") || loc.includes("board game arena")) {
    return true;
  }
  return /\btts\b/.test(loc) || /\bbga\b/.test(loc);
}

/**
 * SQLite WHERE fragment: true when location looks virtual (TTS / BGA).
 * Uses `p.location` as column reference.
 */
export const SQL_VIRTUAL_LOCATION = `(
  INSTR(LOWER(p.location), 'tabletop simulator') > 0
  OR INSTR(LOWER(p.location), 'board game arena') > 0
  OR LOWER(TRIM(p.location)) = 'tts'
  OR LOWER(TRIM(p.location)) = 'bga'
  OR INSTR(' ' || LOWER(REPLACE(REPLACE(p.location, '-', ' '), '/', ' ')) || ' ', ' tts ') > 0
  OR INSTR(' ' || LOWER(REPLACE(REPLACE(p.location, '-', ' '), '/', ' ')) || ' ', ' bga ') > 0
)`;
