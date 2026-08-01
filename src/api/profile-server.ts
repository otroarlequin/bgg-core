import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { existsSync, mkdirSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { getCookie, deleteCookie } from "hono/cookie";
import { createMiddleware } from "hono/factory";
import { loadConfig } from "../config/index.js";
import {
  PROFILE_SESSION_COOKIE,
  getProfileSession,
  getSessionDb,
  purgeExpiredSessions,
} from "../profile/session-store.js";
import { runWithDbAsync } from "./context.js";
import { summaryRoutes } from "./routes/summary.js";
import { collectionRoutes } from "./routes/collection.js";
import { playsRoutes } from "./routes/plays.js";
import { activitiesRoutes } from "./routes/activities.js";
import { bggRoutes } from "./routes/bgg.js";
import { mediaRoutes } from "./routes/media.js";
import { profileRoutes } from "./routes/profile.js";

process.env.APP_MODE = "profile";

const config = loadConfig();
const sessionsDir =
  process.env.PROFILE_SESSIONS_DIR ??
  join(config.projectRoot, "data", "profile-sessions");
mkdirSync(sessionsDir, { recursive: true });
process.env.PROFILE_SESSIONS_DIR = sessionsDir;

const webRoot = resolve(
  process.env.WEB_ROOT ?? join(config.projectRoot, "web", "dist"),
);
const serveWeb = existsSync(join(webRoot, "index.html"));

const app = new Hono();

app.use(
  "/api/*",
  cors({
    origin: [
      "http://localhost:5173",
      "http://127.0.0.1:5173",
      ...(process.env.CORS_ORIGIN ? [process.env.CORS_ORIGIN] : []),
    ],
    credentials: true,
  }),
);

app.get("/api/health", (c) => {
  purgeExpiredSessions();
  return c.json({
    ok: true,
    mode: "profile",
    ts: new Date().toISOString(),
  });
});

app.route("/api/profile", profileRoutes);

const requireProfileSession = createMiddleware(async (c, next) => {
  if (c.req.path.startsWith("/api/profile")) {
    return next();
  }
  if (c.req.path === "/api/health") {
    return next();
  }
  if (!c.req.path.startsWith("/api/")) {
    return next();
  }

  purgeExpiredSessions();
  const sid = getCookie(c, PROFILE_SESSION_COOKIE);
  if (!sid) {
    return c.json(
      {
        message:
          "Sesión de perfil no encontrada. Entra en /profile e indica tu username BGG.",
      },
      401,
    );
  }
  const session = getProfileSession(sid);
  if (!session) {
    deleteCookie(c, PROFILE_SESSION_COOKIE, { path: "/" });
    return c.json(
      { message: "Sesión expirada o inválida. Vuelve a entrar en /profile." },
      401,
    );
  }

  const db = getSessionDb(session);
  await runWithDbAsync(db, async () => {
    await next();
  });
});

app.use("/api/*", requireProfileSession);

app.route("/api/summary", summaryRoutes);
app.route("/api/collection", collectionRoutes);
app.route("/api/plays", playsRoutes);
app.route("/api/activities", activitiesRoutes);
app.route("/api/bgg", bggRoutes);
app.route("/api/media", mediaRoutes);

// Redirect root to /profile for the public app.
app.get("/", (c) => c.redirect("/profile", 302));

if (serveWeb) {
  const staticRoot = relative(process.cwd(), webRoot) || ".";
  app.use(
    "*",
    serveStatic({
      root: staticRoot,
    }),
  );
  app.use("*", async (c, next) => {
    if (c.req.path.startsWith("/api/")) {
      return c.json({ message: `Ruta no encontrada: ${c.req.path}` }, 404);
    }
    await next();
  });
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
    `Sin UI estática (no hay ${join(webRoot, "index.html")}). Solo API profile.`,
  );
}

const port = Number(process.env.PORT ?? 3002);
const host = process.env.HOST ?? "0.0.0.0";

console.log(`BGG Profile API en http://${host}:${port}`);
console.log(`Sesiones temporales: ${sessionsDir}`);
console.log(`Modo: profile (sin volumen durable compartido)`);

serve({ fetch: app.fetch, port, hostname: host });
