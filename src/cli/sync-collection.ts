import { loadConfig } from "../config/index.js";
import { requireEffectiveBggCredentials } from "../config/bgg-username.js";
import { createBggClient } from "../bgg/index.js";
import { createDatabase, createStorageService } from "../storage/index.js";
import { syncCollection } from "../sync/index.js";
import { getBooleanArg, parseArgs } from "./args.js";

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const full = getBooleanArg(args, "full");
  const config = loadConfig();
  const db = createDatabase(config.dbPath);
  const { token, username, source } = requireEffectiveBggCredentials(db, config);
  const client = createBggClient(token);
  const storage = createStorageService(db);

  console.log(
    `Sincronizando colección de ${username} (fuente: ${source})...`,
  );
  const result = await syncCollection(storage, client, username, {
    incremental: !full,
  });

  console.log(
    `Listo: ${result.count} entradas (${result.incremental ? "incremental" : "completa"}).`,
  );
  console.log("Ejecuta npm run sync:things para enriquecer metadatos de juegos.");
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
