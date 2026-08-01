import type { AppConfig } from "./index.js";
import type { Db } from "../storage/database.js";
import { getStoredBggUsername } from "../storage/repos/app-settings.js";

export type BggUsernameSource = "db" | "env";

export function getEffectiveBggUsername(
  db: Db,
  config: AppConfig,
): { username: string | null; source: BggUsernameSource | null } {
  const fromDb = getStoredBggUsername(db);
  if (fromDb) return { username: fromDb, source: "db" };
  const fromEnv = config.bggUsername?.trim() || null;
  if (fromEnv) return { username: fromEnv, source: "env" };
  return { username: null, source: null };
}

export function requireEffectiveBggCredentials(
  db: Db,
  config: AppConfig,
): { token: string; username: string; source: BggUsernameSource } {
  if (!config.bggToken) {
    throw new Error(
      "BGG_TOKEN es requerido para sincronizar. Configúralo en .env o como secret en Fly.",
    );
  }
  const { username, source } = getEffectiveBggUsername(db, config);
  if (!username || !source) {
    throw new Error(
      "BGG username no configurado. Defínelo en Configuración de la app o en BGG_USERNAME (.env / Fly secret).",
    );
  }
  return { token: config.bggToken, username, source };
}
