/**
 * Bidirectional reconcile between local SQLite and Fly.
 *
 *   npm run db:status
 *   npm run db:pull
 *   npm run db:push
 *   npm run db:upload   (alias deprecado de db:push)
 *
 * Flags:
 *   --app bgg-core
 *   --local ./data/bgg.db
 *   --fail-on-conflict
 *   --i-know-this-can-wipe-app-data   (permite push sin remoto; PELIGROSO)
 *   --skip-download --old ./tmp/remote.db
 *   --local-only --out ./data/bgg-merged.db   (merge a archivo, no sube)
 */
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  unlinkSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { DatabaseSync } from "node:sqlite";
import { loadConfig } from "../src/config/index.js";
import {
  assertNoAppDataLoss,
  compareAppDatabases,
  unionAppTablesInto,
} from "../src/storage/reconcile-app-tables.js";

type Command = "status" | "pull" | "push";

function checkpointSqlite(dbPath: string): void {
  const db = new DatabaseSync(dbPath);
  try {
    db.exec("PRAGMA wal_checkpoint(TRUNCATE)");
  } finally {
    db.close();
  }
}

function argValue(flag: string): string | undefined {
  const idx = process.argv.indexOf(flag);
  if (idx === -1) return undefined;
  return process.argv[idx + 1];
}

function hasFlag(flag: string): boolean {
  return process.argv.includes(flag);
}

function fly(args: string[]): ReturnType<typeof spawnSync> {
  // shell:false keeps -C / paths intact on Windows (shell:true concatenates poorly).
  return spawnSync("fly", args, {
    encoding: "utf8",
    shell: false,
    stdio: ["ignore", "pipe", "pipe"],
  });
}

/** flyctl on Windows often exits 1 with "Controlador no válido" after a successful SSH cmd. */
function flyOk(result: ReturnType<typeof spawnSync>): boolean {
  if (result.status === 0) return true;
  const err = String(result.stderr || result.stdout || "");
  return /Controlador no v|Invalid handle/i.test(err);
}

function resolveCommand(): Command {
  const fromEnv = process.env.DB_RECONCILE_CMD;
  if (fromEnv === "status" || fromEnv === "pull" || fromEnv === "push") {
    return fromEnv;
  }
  const arg = process.argv[2];
  if (arg === "status" || arg === "pull" || arg === "push") return arg;
  if (arg === "upload") return "push";
  // npm run db:status passes nothing useful sometimes — infer from npm_lifecycle_event
  const life = process.env.npm_lifecycle_event;
  if (life === "db:status") return "status";
  if (life === "db:pull") return "pull";
  if (life === "db:push" || life === "db:upload") return "push";
  return "status";
}

function downloadRemote(
  appName: string,
  destPath: string,
): { ok: true } | { ok: false; stderr: string } {
  const get = fly([
    "ssh",
    "sftp",
    "get",
    "/data/bgg.db",
    destPath,
    "-a",
    appName,
  ]);
  if (get.status === 0 && existsSync(destPath)) return { ok: true };
  return {
    ok: false,
    stderr: String(get.stderr || get.stdout || "sftp get failed").trim(),
  };
}

function uploadRemote(appName: string, localPath: string): void {
  console.log("Replacing remote DB...");
  // Upload to a temp path first: fly sftp will not overwrite existing files.
  // Run remote commands via `sh -c` so compound ops work (and Windows doesn't
  // treat `rm -f` as flyctl flags).
  const putIncoming = fly([
    "ssh",
    "sftp",
    "put",
    localPath,
    "/data/bgg-incoming.db",
    "-a",
    appName,
  ]);
  if (!flyOk(putIncoming)) {
    console.error(putIncoming.stderr || putIncoming.stdout || "sftp put failed");
    process.exit(1);
  }
  // Two simple remote cmds avoid nested-quote breakage on Windows spawn.
  const rm = fly([
    "ssh",
    "console",
    "-a",
    appName,
    "-C",
    "rm -f /data/bgg.db /data/bgg.db-wal /data/bgg.db-shm",
  ]);
  if (!flyOk(rm)) {
    console.error(rm.stderr || rm.stdout || "remote rm failed");
    process.exit(1);
  }
  const mv = fly([
    "ssh",
    "console",
    "-a",
    appName,
    "-C",
    "mv /data/bgg-incoming.db /data/bgg.db",
  ]);
  if (!flyOk(mv)) {
    console.error(mv.stderr || mv.stdout || "remote mv failed");
    process.exit(1);
  }
  console.log("Uploaded. Restarting app...");
  const restart = fly(["apps", "restart", appName]);
  if (!flyOk(restart)) {
    console.error(restart.stderr || "restart failed");
    process.exit(1);
  }
}

function timestamp(): string {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

function main(): void {
  const command = resolveCommand();
  const config = loadConfig();
  const localDb = resolve(argValue("--local") ?? argValue("--new") ?? config.dbPath);
  const appName = argValue("--app") ?? "bgg-core";
  const failOnConflict = hasFlag("--fail-on-conflict");
  const allowWipe = hasFlag("--i-know-this-can-wipe-app-data");
  const skipDownload = hasFlag("--skip-download");
  const localOnly = hasFlag("--local-only");
  let oldDb = argValue("--old") ? resolve(argValue("--old")!) : undefined;

  if (!existsSync(localDb)) {
    console.error(`Local DB not found: ${localDb}`);
    process.exit(1);
  }

  const workDir = mkdtempSync(join(tmpdir(), "bgg-reconcile-"));
  const remotePath = join(workDir, "bgg-remote.db");

  if (!oldDb) {
    if (skipDownload) {
      console.error("--skip-download requiere --old <path> a una DB remota.");
      process.exit(1);
    }
    console.log(`Downloading remote DB from Fly (${appName})...`);
    const dl = downloadRemote(appName, remotePath);
    if (!dl.ok) {
      if (command === "push" && allowWipe) {
        console.warn(
          "WARNING: no se pudo descargar remoto y usaste --i-know-this-can-wipe-app-data. Subiendo local sin merge.",
        );
        console.warn(dl.stderr);
        if (!localOnly) uploadRemote(appName, localDb);
        else console.log("local-only: nada que subir");
        return;
      }
      console.error(
        "No se pudo descargar la DB remota. Abortando (fail-closed). Usa --old <path> o --i-know-this-can-wipe-app-data solo si sabes lo que haces.",
      );
      console.error(dl.stderr);
      process.exit(1);
    }
    oldDb = remotePath;
    console.log("Remote DB downloaded");
  }

  if (!oldDb || !existsSync(oldDb)) {
    console.error("DB remota no disponible.");
    process.exit(1);
  }

  const report = compareAppDatabases(localDb, oldDb, "local", "remote");
  for (const line of report.lines) console.log(line);

  if (command === "status") {
    console.log("\n(Sin cambios. Usa db:pull o db:push para aplicar.)");
    return;
  }

  if (
    failOnConflict &&
    (report.sessionConflicts > 0 || report.reviewConflicts > 0)
  ) {
    console.error(
      `--fail-on-conflict: hay ${report.sessionConflicts} conflictos de sesión y ${report.reviewConflicts} de reviews. Abortando.`,
    );
    process.exit(1);
  }

  if (command === "pull") {
    const backupDir = join(config.projectRoot, "data", "backups");
    mkdirSync(backupDir, { recursive: true });
    const backupPath = join(backupDir, `bgg.local.${timestamp()}.db`);
    copyFileSync(localDb, backupPath);
    console.log(`Backup local → ${backupPath}`);

    const merge = unionAppTablesInto(localDb, oldDb);
    console.log(
      `Pull merge: +${merge.sessionsInserted} sessions, +${merge.roundsInserted} rounds, +${merge.reviewsInserted} reviews, conflictsKeptBoth=${merge.conflictsKeptBoth}`,
    );
    for (const line of merge.log) console.log(`  ${line}`);
    console.log(
      "Listo. Datos de app de Fly estánidos en local. Si collection/plays remotos estaban adelante, ejecuta sync BGG en local.",
    );
    return;
  }

  // push
  checkpointSqlite(localDb);
  const mergedPath = join(workDir, "bgg-merged.db");
  copyFileSync(localDb, mergedPath);
  console.log("Merging remote app tables into local copy (union)...");
  const merge = unionAppTablesInto(mergedPath, oldDb);
  console.log(
    `Push merge: +${merge.sessionsInserted} sessions, +${merge.roundsInserted} rounds, +${merge.reviewsInserted} reviews, conflictsKeptBoth=${merge.conflictsKeptBoth}`,
  );
  for (const line of merge.log) console.log(`  ${line}`);

  const assert = assertNoAppDataLoss(mergedPath, oldDb);
  if (!assert.ok) {
    console.error(assert.message);
    process.exit(1);
  }
  console.log("Assert OK: no app data loss vs remote.");

  if (localOnly) {
    const out = resolve(
      argValue("--out") ?? join(config.projectRoot, "data", "bgg-merged.db"),
    );
    mkdirSync(dirname(out), { recursive: true });
    copyFileSync(mergedPath, out);
    console.log(`Wrote merged DB to ${out}`);
    return;
  }

  checkpointSqlite(mergedPath);
  uploadRemote(appName, mergedPath);
  try {
    unlinkSync(mergedPath);
  } catch {
    // ignore
  }
  console.log("Done.");
}

main();
