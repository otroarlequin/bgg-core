import { createHash, randomBytes } from "node:crypto";
import { existsSync, mkdirSync, rmSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { createDatabase, type Db } from "../storage/database.js";

export const PROFILE_SESSION_COOKIE = "bgg_profile_sid";

/** Idle TTL: 6 hours since last activity. */
export const PROFILE_SESSION_TTL_MS = 6 * 60 * 60 * 1000;

const MAX_SESSIONS_GLOBAL = Number(process.env.PROFILE_MAX_SESSIONS ?? 40);
const MAX_CREATES_PER_IP_HOUR = Number(
  process.env.PROFILE_MAX_CREATES_PER_IP_HOUR ?? 5,
);

export interface ProfileSession {
  id: string;
  username: string;
  dbPath: string;
  createdAt: number;
  lastAccessAt: number;
}

interface RateBucket {
  timestamps: number[];
}

const sessions = new Map<string, ProfileSession>();
const openDbs = new Map<string, Db>();
const createsByIp = new Map<string, RateBucket>();

function sessionsRoot(): string {
  const root =
    process.env.PROFILE_SESSIONS_DIR ??
    join(process.cwd(), "data", "profile-sessions");
  mkdirSync(root, { recursive: true });
  return root;
}

function pruneRateBucket(bucket: RateBucket, windowMs: number): void {
  const cutoff = Date.now() - windowMs;
  bucket.timestamps = bucket.timestamps.filter((t) => t >= cutoff);
}

export function assertCanCreateSession(ip: string): void {
  const key = ip || "unknown";
  let bucket = createsByIp.get(key);
  if (!bucket) {
    bucket = { timestamps: [] };
    createsByIp.set(key, bucket);
  }
  pruneRateBucket(bucket, 60 * 60 * 1000);
  if (bucket.timestamps.length >= MAX_CREATES_PER_IP_HOUR) {
    throw new Error(
      `Límite de sesiones por hora alcanzado (${MAX_CREATES_PER_IP_HOUR}). Prueba más tarde.`,
    );
  }
  bucket.timestamps.push(Date.now());
}

export function createProfileSession(username: string): ProfileSession {
  purgeExpiredSessions();
  if (sessions.size >= MAX_SESSIONS_GLOBAL) {
    throw new Error(
      "Hay demasiadas sesiones temporales activas. Intenta en unos minutos.",
    );
  }

  const id = randomBytes(24).toString("hex");
  const safeUser = String(username)
    .replace(/[^A-Za-z0-9_-]/g, "_")
    .slice(0, 40);
  const hash = createHash("sha256").update(id).digest("hex").slice(0, 12);
  const dbPath = join(sessionsRoot(), `${safeUser}-${hash}.db`);
  createDatabase(dbPath); // ensure schema
  const now = Date.now();
  const session: ProfileSession = {
    id,
    username,
    dbPath,
    createdAt: now,
    lastAccessAt: now,
  };
  sessions.set(id, session);
  return session;
}

export function getProfileSession(id: string): ProfileSession | null {
  const session = sessions.get(id);
  if (!session) return null;
  if (Date.now() - session.lastAccessAt > PROFILE_SESSION_TTL_MS) {
    destroyProfileSession(id);
    return null;
  }
  session.lastAccessAt = Date.now();
  return session;
}

export function getSessionDb(session: ProfileSession): Db {
  let db = openDbs.get(session.id);
  if (!db) {
    db = createDatabase(session.dbPath);
    openDbs.set(session.id, db);
  }
  return db;
}

export function destroyProfileSession(id: string): void {
  const session = sessions.get(id);
  const db = openDbs.get(id);
  if (db) {
    try {
      db.close();
    } catch {
      // ignore
    }
    openDbs.delete(id);
  }
  sessions.delete(id);
  if (session?.dbPath && existsSync(session.dbPath)) {
    try {
      unlinkSync(session.dbPath);
    } catch {
      try {
        rmSync(session.dbPath, { force: true });
      } catch {
        // ignore
      }
    }
  }
  for (const suffix of ["-wal", "-shm"]) {
    const side = `${session?.dbPath ?? ""}${suffix}`;
    if (session?.dbPath && existsSync(side)) {
      try {
        unlinkSync(side);
      } catch {
        // ignore
      }
    }
  }
}

export function purgeExpiredSessions(): void {
  const now = Date.now();
  for (const [id, session] of sessions) {
    if (now - session.lastAccessAt > PROFILE_SESSION_TTL_MS) {
      destroyProfileSession(id);
    }
  }
}

export function getSessionCookieValue(cookieHeader: string | undefined): string | null {
  if (!cookieHeader) return null;
  const parts = cookieHeader.split(";");
  for (const part of parts) {
    const [rawKey, ...rest] = part.trim().split("=");
    if (rawKey === PROFILE_SESSION_COOKIE) {
      return decodeURIComponent(rest.join("="));
    }
  }
  return null;
}

export function sessionPublicView(session: ProfileSession) {
  const expiresAt = session.lastAccessAt + PROFILE_SESSION_TTL_MS;
  return {
    username: session.username,
    createdAt: new Date(session.createdAt).toISOString(),
    lastAccessAt: new Date(session.lastAccessAt).toISOString(),
    expiresAt: new Date(expiresAt).toISOString(),
    ttlMs: PROFILE_SESSION_TTL_MS,
  };
}
