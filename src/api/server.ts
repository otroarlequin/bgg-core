import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { existsSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { sharedPasswordAuth } from "./auth.js";
import { summaryRoutes } from "./routes/summary.js";
import { collectionRoutes } from "./routes/collection.js";
import { playsRoutes } from "./routes/plays.js";
import { activitiesRoutes } from "./routes/activities.js";
import { bggRoutes } from "./routes/bgg.js";
import { loadConfig } from "../config/index.js";

const config = loadConfig();
const webRoot = resolve(
  process.env.WEB_ROOT ?? join(config.projectRoot, "web", "dist"),
);
const serveWeb = existsSync(join(webRoot, "index.html"));

const app = new Hono();

app.use("*", sharedPasswordAuth());

app.use(
  "/api/*",
  cors({
    origin: [
      "http://localhost:5173",
      "http://127.0.0.1:5173",
      ...(process.env.CORS_ORIGIN ? [process.env.CORS_ORIGIN] : []),
    ],
  }),
);

app.get("/api/health", (c) => c.json({ ok: true }));

app.route("/api/summary", summaryRoutes);
app.route("/api/collection", collectionRoutes);
app.route("/api/plays", playsRoutes);
app.route("/api/activities", activitiesRoutes);
app.route("/api/bgg", bggRoutes);

if (serveWeb) {
  // serveStatic root is relative to cwd; rewrite absolute WEB_ROOT → relative.
  const staticRoot = relative(process.cwd(), webRoot) || ".";
  app.use(
    "*",
    serveStatic({
      root: staticRoot,
    }),
  );
  app.use(
    "*",
    serveStatic({
      root: staticRoot,
      path: "index.html",
    }),
  );
  console.log(`UI estática desde ${webRoot}`);
} else {
  console.log(
    `Sin UI estática (no hay ${join(webRoot, "index.html")}). Solo API.`,
  );
}

const port = Number(process.env.PORT ?? 3001);
const host = process.env.HOST ?? "0.0.0.0";

console.log(`BGG API escuchando en http://${host}:${port}`);
console.log(`SQLite: ${config.dbPath}`);

serve({ fetch: app.fetch, port, hostname: host });
