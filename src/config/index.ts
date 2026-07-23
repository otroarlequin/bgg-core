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

export function requireBggCredentials(config: AppConfig): {
  token: string;
  username: string;
} {
  if (!config.bggToken || !config.bggUsername) {
    throw new Error(
      "BGG_TOKEN y BGG_USERNAME son requeridos. Copia .env.example a .env y completa los valores. Ver SETUP.md.",
    );
  }
  return { token: config.bggToken, username: config.bggUsername };
}
