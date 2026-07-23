import { loadConfig, requireBggCredentials } from "../config/index.js";
import { createBggClient } from "../bgg/index.js";
import { createDatabase, createStorageService } from "../storage/index.js";
import { syncThings } from "../sync/index.js";
import { getBooleanArg, parseArgs } from "./args.js";

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const force = getBooleanArg(args, "force");
  const config = loadConfig();
  requireBggCredentials(config);
  const client = createBggClient(config.bggToken!);
  const storage = createStorageService(createDatabase(config.dbPath));

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
