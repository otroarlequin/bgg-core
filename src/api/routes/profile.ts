import { Hono } from "hono";
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
  purgeExpiredSessions,
  sessionPublicView,
} from "../../profile/session-store.js";
import { runWithDbAsync } from "../context.js";

export const profileRoutes = new Hono();

function clientIp(c: { req: { header: (name: string) => string | undefined } }): string {
  return (
    c.req.header("fly-client-ip") ??
    c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ??
    c.req.header("x-real-ip") ??
    "unknown"
  );
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

  const db = getSessionDb(session);
  try {
    const sync = await runWithDbAsync(db, () =>
      bootstrapProfileSync(db, username),
    );
    setCookie(c, PROFILE_SESSION_COOKIE, session.id, {
      path: "/",
      httpOnly: true,
      sameSite: "Lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: Math.floor(PROFILE_SESSION_TTL_MS / 1000),
    });
    return c.json({
      ok: true,
      session: sessionPublicView(session),
      sync,
    });
  } catch (error) {
    destroyProfileSession(session.id);
    const message = error instanceof Error ? error.message : String(error);
    return c.json({ ok: false, message }, 400);
  }
});

profileRoutes.delete("/session", (c) => {
  const sid = getCookie(c, PROFILE_SESSION_COOKIE);
  if (sid) {
    destroyProfileSession(sid);
  }
  deleteCookie(c, PROFILE_SESSION_COOKIE, { path: "/" });
  return c.json({ ok: true });
});
