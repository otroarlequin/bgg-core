#!/usr/bin/env node
/**
 * On-demand Fly cost helper for bgg-core + bgg-profile.
 *
 * Fly does NOT expose a public billing API (Cost Explorer is dashboard-only).
 * This script:
 *  1) Reads live machine/volume config via flyctl
 *  2) Estimates $ from published pricing (https://fly.io/docs/about/pricing/)
 *  3) Compares against the $5 personal-org collection threshold
 *  4) Prints the Billing / Cost Explorer URL (optional --open)
 *
 * Usage:
 *   npm run fly:cost
 *   npm run fly:cost -- --open
 *   npm run fly:cost -- --org personal --threshold 5
 */
import { spawnSync } from "node:child_process";

const APPS = ["bgg-core", "bgg-profile"];
const SECONDS_PER_MONTH = 30 * 24 * 3600;

/** Published shared-cpu-1x rates ($/second) by memory_mb — Fly pricing docs. */
const SHARED_CPU_1X_PER_SEC = {
  256: 0.00000078,
  512: 0.00000128,
  1024: 0.00000228,
  2048: 0.00000429,
};

const VOLUME_USD_PER_GB_MONTH = 0.15;
/** Stopped Machine rootfs approx. (docs: $0.15 / GB / 30d). */
const ROOTFS_USD_PER_GB_MONTH = 0.15;
/** Rough compressed image size used when Machine is stopped (GB). */
const ASSUMED_ROOTFS_GB = 0.08;

const DEFAULT_THRESHOLD = 5;
const DEFAULT_ORG = "personal";

function parseArgs(argv) {
  const out = {
    open: false,
    org: DEFAULT_ORG,
    threshold: DEFAULT_THRESHOLD,
    uptimes: [0.01, 0.05, 0.1],
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--open") out.open = true;
    else if (a === "--org") out.org = argv[++i] ?? DEFAULT_ORG;
    else if (a === "--threshold") {
      const n = Number(argv[++i]);
      if (Number.isFinite(n) && n > 0) out.threshold = n;
    }
  }
  return out;
}

function runFly(args) {
  return spawnSync("fly", args, {
    encoding: "utf8",
    shell: false,
  });
}

function flyJson(args) {
  const r = runFly(args);
  const text = `${r.stdout ?? ""}${r.stderr ?? ""}`.trim();
  if (r.status !== 0 && !text.startsWith("[") && !text.startsWith("{")) {
    return { ok: false, error: text || `fly exit ${r.status}` };
  }
  try {
    // fly sometimes prints warnings before JSON; find first [ or {
    const start = Math.min(
      ...["[", "{"].map((ch) => {
        const i = text.indexOf(ch);
        return i === -1 ? Number.POSITIVE_INFINITY : i;
      }),
    );
    if (!Number.isFinite(start)) {
      return { ok: false, error: text || "no JSON" };
    }
    return { ok: true, data: JSON.parse(text.slice(start)) };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

function money(n) {
  return `$${n.toFixed(2)}`;
}

function computeRatePerSec(guest) {
  if (!guest) return null;
  const kind = guest.cpu_kind ?? "shared";
  const cpus = guest.cpus ?? 1;
  const mem = guest.memory_mb ?? 256;
  if (kind === "shared" && cpus === 1 && SHARED_CPU_1X_PER_SEC[mem] != null) {
    return SHARED_CPU_1X_PER_SEC[mem];
  }
  // Fallback: scale from shared-1x 256MB by cpus and memory ratio (approx).
  const base = SHARED_CPU_1X_PER_SEC[256];
  return base * cpus * (mem / 256);
}

function monthFromPerSec(perSec, fractionUp = 1) {
  return perSec * SECONDS_PER_MONTH * fractionUp;
}

function openUrl(url) {
  const plat = process.platform;
  if (plat === "win32") {
    spawnSync("cmd", ["/c", "start", "", url], { shell: false, stdio: "ignore" });
  } else if (plat === "darwin") {
    spawnSync("open", [url], { stdio: "ignore" });
  } else {
    spawnSync("xdg-open", [url], { stdio: "ignore" });
  }
}

const opts = parseArgs(process.argv.slice(2));

const version = runFly(["version"]);
if (version.status !== 0 && !version.stdout && !version.stderr) {
  console.error("No se encontró `fly` en el PATH. Instala flyctl y `fly auth login`.");
  process.exit(1);
}

const billingUrl = `https://fly.io/dashboard/${encodeURIComponent(opts.org)}/billing`;

console.log("=== Fly cost (estimación on-demand) ===");
console.log(
  "Nota: Fly no publica API de factura. Cost Explorer del dashboard es la fuente de verdad.",
);
console.log(`Umbral personal (no cobran <): ${money(opts.threshold)}`);
console.log(`Billing / Cost Explorer: ${billingUrl}`);
console.log("");

/** @type {Array<{app:string, state:string, memMb:number, rate:number|null, volumeGb:number}>} */
const rows = [];

for (const app of APPS) {
  const machines = flyJson(["machine", "list", "-a", app, "-j"]);
  const volumes = flyJson(["volumes", "list", "-a", app, "-j"]);

  if (!machines.ok) {
    console.error(`[${app}] machines: ${machines.error}`);
    continue;
  }

  const list = Array.isArray(machines.data) ? machines.data : [];
  let volumeGb = 0;
  if (volumes.ok && Array.isArray(volumes.data)) {
    for (const v of volumes.data) {
      const size = Number(v.SizeGb ?? v.size_gb ?? v.Size ?? 0);
      // fly volumes list -j may use "Size" like 1
      volumeGb += Number.isFinite(size) ? size : 0;
    }
  } else {
    // Plain table fallback: count 1GB if mount present in machine config
    for (const m of list) {
      for (const mount of m.config?.mounts ?? []) {
        volumeGb += Number(mount.size_gb ?? 0) || 0;
      }
    }
  }

  if (list.length === 0) {
    console.log(`[${app}] (sin máquinas)`);
    rows.push({
      app,
      state: "none",
      memMb: 0,
      rate: null,
      volumeGb,
    });
    continue;
  }

  for (const m of list) {
    const guest = m.config?.guest ?? {};
    const memMb = guest.memory_mb ?? 0;
    const rate = computeRatePerSec(guest);
    const state = m.state ?? "unknown";
    console.log(
      `[${app}] machine ${m.id}  state=${state}  shared-cpu×${guest.cpus ?? "?"} ${memMb}MB  volume≈${volumeGb}GB`,
    );
    rows.push({ app, state, memMb, rate, volumeGb });
  }
}

const volumeByApp = new Map();
for (const r of rows) {
  volumeByApp.set(r.app, Math.max(volumeByApp.get(r.app) ?? 0, r.volumeGb));
}
const volumeFloorUnique = [...volumeByApp.values()].reduce(
  (s, gb) => s + gb * VOLUME_USD_PER_GB_MONTH,
  0,
);

const machineCount = rows.filter((r) => r.state !== "none").length;
const stoppedRootfsFloor = machineCount * ASSUMED_ROOTFS_GB * ROOTFS_USD_PER_GB_MONTH;

const alwaysOnCompute = rows.reduce((s, r) => {
  if (r.rate == null) return s;
  return s + monthFromPerSec(r.rate, 1);
}, 0);

console.log("\n=== Piso mensual (siempre se paga) ===");
console.log(`Volúmenes:     ${money(volumeFloorUnique)}  (${[...volumeByApp.entries()].map(([a, g]) => `${a} ${g}GB`).join(", ") || "0"})`);
console.log(`Rootfs parado: ${money(stoppedRootfsFloor)}  (≈${ASSUMED_ROOTFS_GB}GB/imagen × ${machineCount} máquinas)`);
console.log(`Piso estimado: ${money(volumeFloorUnique + stoppedRootfsFloor)}`);

console.log("\n=== Compute (solo mientras la VM está started) ===");
console.log(`Si estuvieran 100% on: ${money(alwaysOnCompute)}  ← con auto-stop esto NO pasa`);
for (const frac of opts.uptimes) {
  const compute = rows.reduce((s, r) => {
    if (r.rate == null) return s;
    return s + monthFromPerSec(r.rate, frac);
  }, 0);
  const total = volumeFloorUnique + stoppedRootfsFloor + compute;
  const pct = Math.round(frac * 100);
  const vs = opts.threshold - total;
  const flag = total < opts.threshold ? "OK bajo umbral" : "¡cerca/sobre umbral!";
  console.log(
    `Uptime ~${pct}%: compute ${money(compute)} + piso → total ~${money(total)}  (margen ${money(Math.max(0, vs))} vs ${money(opts.threshold)})  ${flag}`,
  );
}

console.log("\n=== Lectura rápida ===");
console.log(
  `Con auto-stop (min_machines_running=0), el bill real suele acercarse al piso (~${money(volumeFloorUnique + stoppedRootfsFloor)}), como tu mail de $0.36.`,
);
console.log(
  "Más visitas a Profile = más segundos started en bgg-profile (1GB ≈ $5.92/mes si nunca duerme).",
);
console.log(`Para el número exacto del mes: ${billingUrl}`);

if (opts.open) {
  openUrl(billingUrl);
  console.log("\nAbriendo Billing / Cost Explorer en el navegador…");
}
