import { config as loadEnv } from "dotenv";
import { mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

loadEnv();

const projectRoot = resolve(
  fileURLToPath(new URL("../..", import.meta.url)),
);

export interface AppConfig {
  bggToken: string | null;
  bggUsername: string | null;
  dbPath: string;
  outputDir: string;
  projectRoot: string;
}

export function loadConfig(): AppConfig {
  const dbPath = resolve(
    projectRoot,
    process.env.BGG_DB_PATH ?? join("data", "bgg.db"),
  );
  const outputDir = resolve(
    projectRoot,
    process.env.BGG_OUTPUT_DIR ?? join("output"),
  );

  mkdirSync(dirname(dbPath), { recursive: true });
  mkdirSync(outputDir, { recursive: true });

  return {
    bggToken: process.env.BGG_TOKEN ?? null,
    bggUsername: process.env.BGG_USERNAME ?? null,
    dbPath,
    outputDir,
    projectRoot,
  };
}

export function requireBggToken(config: AppConfig): string {
  if (!config.bggToken) {
    throw new Error(
      "BGG_TOKEN es requerido para buscar/consultar juegos en BGG (p. ej. validador de compras). Configúralo en .env o como secret en Fly.",
    );
  }
  return config.bggToken;
}

export function requireBggCredentials(config: AppConfig): {
  token: string;
  username: string;
} {
  const token = requireBggToken(config);
  if (!config.bggUsername) {
    throw new Error(
      "BGG_USERNAME es requerido para sincronizar colección/partidas. Copia .env.example a .env y completa los valores. Ver SETUP.md.",
    );
  }
  return { token, username: config.bggUsername };
}
