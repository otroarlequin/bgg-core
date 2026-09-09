#!/usr/bin/env node
/**
 * On-demand summary of Fly machines for bgg-core + bgg-profile.
 * Requires flyctl on PATH and an authenticated session (`fly auth login`).
 */
import { spawnSync } from "node:child_process";

const APPS = ["bgg-core", "bgg-profile"];

function run(args) {
  const result = spawnSync("fly", args, {
    encoding: "utf8",
    shell: true,
  });
  return {
    ok: result.status === 0,
    status: result.status ?? 1,
    stdout: (result.stdout ?? "").trim(),
    stderr: (result.stderr ?? "").trim(),
  };
}

function section(title) {
  console.log(`\n=== ${title} ===`);
}

const version = run(["version"]);
if (!version.ok && !version.stdout && !version.stderr) {
  console.error("No se encontró `fly` en el PATH. Instala flyctl y ejecuta `fly auth login`.");
  process.exit(1);
}

section("flyctl");
console.log(version.stdout || version.stderr || "(sin salida)");

for (const app of APPS) {
  section(`${app} — status`);
  const status = run(["status", "-a", app]);
  if (status.ok) console.log(status.stdout);
  else console.log(status.stderr || status.stdout || `Error (exit ${status.status})`);

  section(`${app} — machines`);
  const machines = run(["machine", "list", "-a", app]);
  if (machines.ok) console.log(machines.stdout || "(sin máquinas)");
  else console.log(machines.stderr || machines.stdout || `Error (exit ${machines.status})`);

  section(`${app} — checks`);
  const checks = run(["checks", "list", "-a", app]);
  if (checks.ok) console.log(checks.stdout || "(sin checks)");
  else console.log(checks.stderr || checks.stdout || `Error (exit ${checks.status})`);
}

section("Atajos");
console.log("Tiempo real: https://fly-metrics.net  ·  dashboards: https://fly.io/dashboard");
console.log("Health: https://bgg-core.fly.dev/api/health  ·  https://bgg-profile.fly.dev/api/health");
