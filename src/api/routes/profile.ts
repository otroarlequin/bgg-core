import { Hono } from "hono";
import { stream } from "hono/streaming";
import { getCookie, setCookie, deleteCookie } from "hono/cookie";
import { bootstrapProfileSync } from "../../profile/bootstrap-sync.js";
import {
  PROFILE_SESSION_COOKIE,
  PROFILE_SESSION_TTL_MS,
  assertCanCreateSession,
  createProfileSession,
  destroyProfileSession,
  getProfileSession,
  getSessionDb,
  listAllSessions,
  purgeExpiredSessions,
  sessionPublicView,
  updateSessionSyncMeta,
} from "../../profile/session-store.js";
import { runWithDbAsync } from "../context.js";

export const profileRoutes = new Hono();

function clientIp(c: {
  req: { header: (name: string) => string | undefined };
}): string {
  return (
    c.req.header("fly-client-ip") ??
    c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ??
    c.req.header("x-real-ip") ??
    "unknown"
  );
}

function adminPasswordConfigured(): string | null {
  const pw = process.env.PROFILE_ADMIN_PASSWORD?.trim();
  return pw && pw.length > 0 ? pw : null;
}

function assertAdmin(c: {
  req: { header: (name: string) => string | undefined };
  json: (body: unknown, status?: number) => Response;
}): Response | null {
  const expected = adminPasswordConfigured();
  if (!expected) {
    return c.json({ message: "Not found" }, 404);
  }

  const header = c.req.header("x-profile-admin-password");
  const auth = c.req.header("authorization");
  let provided = header?.trim() ?? "";
  if (!provided && auth?.toLowerCase().startsWith("basic ")) {
    try {
      const decoded = Buffer.from(auth.slice(6), "base64").toString("utf8");
      const colon = decoded.indexOf(":");
      provided = colon >= 0 ? decoded.slice(colon + 1) : decoded;
    } catch {
      provided = "";
    }
  }

  if (provided !== expected) {
    return c.json({ message: "Forbidden" }, 403);
  }
  return null;
}

profileRoutes.get("/session", (c) => {
  purgeExpiredSessions();
  const sid = getCookie(c, PROFILE_SESSION_COOKIE);
  if (!sid) {
    return c.json({ active: false });
  }
  const session = getProfileSession(sid);
  if (!session) {
    deleteCookie(c, PROFILE_SESSION_COOKIE, { path: "/" });
    return c.json({ active: false });
  }
  return c.json({ active: true, session: sessionPublicView(session) });
});

profileRoutes.post("/session", async (c) => {
  let body: { username?: string } = {};
  try {
    body = (await c.req.json()) as { username?: string };
  } catch {
    return c.json({ message: "JSON inválido" }, 400);
  }

  const username = (body.username ?? "").trim();
  if (!username) {
    return c.json({ message: "username es obligatorio." }, 400);
  }
  if (!/^[A-Za-z0-9_-]{1,50}$/.test(username)) {
    return c.json(
      {
        message:
          "Username inválido. Usa solo letras, números, guion o guion bajo (máx. 50).",
      },
      400,
    );
  }

  try {
    assertCanCreateSession(clientIp(c));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return c.json({ message }, 429);
  }

  const existingSid = getCookie(c, PROFILE_SESSION_COOKIE);
  if (existingSid) {
    destroyProfileSession(existingSid);
  }

  let session;
  try {
    session = createProfileSession(username);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return c.json({ message }, 503);
  }

  setCookie(c, PROFILE_SESSION_COOKIE, session.id, {
    path: "/",
    httpOnly: true,
    sameSite: "Lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: Math.floor(PROFILE_SESSION_TTL_MS / 1000),
  });

  c.header("Content-Type", "application/x-ndjson; charset=utf-8");
  c.header("Cache-Control", "no-cache");
  c.header("X-Accel-Buffering", "no");

  const db = getSessionDb(session);

  return stream(c, async (out) => {
    const writeLine = async (payload: unknown) => {
      await out.write(`${JSON.stringify(payload)}\n`);
    };

    try {
      await writeLine({
        type: "progress",
        stage: "session",
        label: "Sesión creada. Empezando sync con BGG…",
        percent: 5,
      });

      const sync = await runWithDbAsync(db, () =>
        bootstrapProfileSync(db, username, (event) => writeLine(event)),
      );

      updateSessionSyncMeta(session.id, {
        lastSyncAt: new Date().toISOString(),
        lastSyncOk: true,
        lastSyncError: null,
        lastSyncDurationMs: sync.durationMs,
      });
      const refreshed = getProfileSession(session.id) ?? session;

      await writeLine({
        type: "done",
        ok: true,
        session: sessionPublicView(refreshed),
        sync,
      });
    } catch (error) {
      destroyProfileSession(session.id);
      deleteCookie(c, PROFILE_SESSION_COOKIE, { path: "/" });
      const message = error instanceof Error ? error.message : String(error);
      await writeLine({ type: "error", ok: false, message });
    }
  });
});

/** Re-sync existing session (no wipe on partial failure). */
profileRoutes.post("/sync", async (c) => {
  const sid = getCookie(c, PROFILE_SESSION_COOKIE);
  if (!sid) {
    return c.json({ message: "No hay sesión activa." }, 401);
  }
  const session = getProfileSession(sid);
  if (!session) {
    deleteCookie(c, PROFILE_SESSION_COOKIE, { path: "/" });
    return c.json({ message: "Sesión expirada o inválida." }, 401);
  }

  // Renew cookie maxAge on activity
  setCookie(c, PROFILE_SESSION_COOKIE, session.id, {
    path: "/",
    httpOnly: true,
    sameSite: "Lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: Math.floor(PROFILE_SESSION_TTL_MS / 1000),
  });

  c.header("Content-Type", "application/x-ndjson; charset=utf-8");
  c.header("Cache-Control", "no-cache");
  c.header("X-Accel-Buffering", "no");

  const db = getSessionDb(session);
  const username = session.username;

  return stream(c, async (out) => {
    const writeLine = async (payload: unknown) => {
      await out.write(`${JSON.stringify(payload)}\n`);
    };

    try {
      await writeLine({
        type: "progress",
        stage: "session",
        label: "Actualizando datos desde BGG…",
        percent: 5,
      });

      const sync = await runWithDbAsync(db, () =>
        bootstrapProfileSync(db, username, (event) => writeLine(event)),
      );

      updateSessionSyncMeta(session.id, {
        lastSyncAt: new Date().toISOString(),
        lastSyncOk: true,
        lastSyncError: null,
        lastSyncDurationMs: sync.durationMs,
      });
      const refreshed = getProfileSession(session.id) ?? session;

      await writeLine({
        type: "done",
        ok: true,
        session: sessionPublicView(refreshed),
        sync,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      updateSessionSyncMeta(session.id, {
        lastSyncAt: new Date().toISOString(),
        lastSyncOk: false,
        lastSyncError: message,
      });
      await writeLine({ type: "error", ok: false, message });
    }
  });
});

profileRoutes.delete("/session", (c) => {
  const sid = getCookie(c, PROFILE_SESSION_COOKIE);
  if (sid) {
    destroyProfileSession(sid);
  }
  deleteCookie(c, PROFILE_SESSION_COOKIE, { path: "/" });
  return c.json({ ok: true });
});

// --- Hidden admin (requires PROFILE_ADMIN_PASSWORD) ---

profileRoutes.get("/admin/sessions", (c) => {
  const denied = assertAdmin(c);
  if (denied) return denied;
  purgeExpiredSessions();
  return c.json({ sessions: listAllSessions() });
});

profileRoutes.delete("/admin/sessions/:id", (c) => {
  const denied = assertAdmin(c);
  if (denied) return denied;
  const id = c.req.param("id");
  destroyProfileSession(id);
  return c.json({ ok: true });
});
