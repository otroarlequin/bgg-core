import { loadConfig } from "../config/index.js";
import { requireEffectiveBggCredentials } from "../config/bgg-username.js";
import { createBggClient } from "../bgg/index.js";
import { createDatabase, createStorageService } from "../storage/index.js";
import { syncThings } from "../sync/index.js";
import { getBooleanArg, parseArgs } from "./args.js";

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const force = getBooleanArg(args, "force");
  const config = loadConfig();
  const db = createDatabase(config.dbPath);
  const { token } = requireEffectiveBggCredentials(db, config);
  const client = createBggClient(token);
  const storage = createStorageService(db);

  console.log("Enriqueciendo juegos vía /thing...");
  const result = await syncThings(storage, client, { force });

  console.log(
    `Listo: ${result.synced} sincronizados, ${result.skipped} omitidos (${result.requested} solicitados).`,
  );
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
