import { createHash, randomBytes } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
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

function metaPath(id: string): string {
  return join(sessionsRoot(), `${id}.meta.json`);
}

function writeSessionMeta(session: ProfileSession): void {
  writeFileSync(metaPath(session.id), JSON.stringify(session), "utf8");
}

function readSessionMeta(id: string): ProfileSession | null {
  const path = metaPath(id);
  if (!existsSync(path)) return null;
  try {
    const raw = JSON.parse(readFileSync(path, "utf8")) as ProfileSession;
    if (
      !raw ||
      typeof raw.id !== "string" ||
      typeof raw.username !== "string" ||
      typeof raw.dbPath !== "string" ||
      typeof raw.createdAt !== "number" ||
      typeof raw.lastAccessAt !== "number"
    ) {
      return null;
    }
    return raw;
  } catch {
    return null;
  }
}

function listSessionMetas(): ProfileSession[] {
  const root = sessionsRoot();
  const out: ProfileSession[] = [];
  for (const name of readdirSync(root)) {
    if (!name.endsWith(".meta.json")) continue;
    const id = name.slice(0, -".meta.json".length);
    const meta = readSessionMeta(id);
    if (meta) out.push(meta);
  }
  return out;
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

function activeSessionCount(): number {
  purgeExpiredSessions();
  return listSessionMetas().length;
}

export function createProfileSession(username: string): ProfileSession {
  purgeExpiredSessions();
  if (activeSessionCount() >= MAX_SESSIONS_GLOBAL) {
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
  writeSessionMeta(session);
  return session;
}

/**
 * Resolve session by id. Reloads from disk after process/machine restart
 * so Fly auto-stop / OOM does not orphan a still-valid cookie.
 */
export function getProfileSession(id: string): ProfileSession | null {
  let session = sessions.get(id) ?? readSessionMeta(id);
  if (!session) return null;

  if (!existsSync(session.dbPath)) {
    destroyProfileSession(id);
    return null;
  }

  if (Date.now() - session.lastAccessAt > PROFILE_SESSION_TTL_MS) {
    destroyProfileSession(id);
    return null;
  }

  session.lastAccessAt = Date.now();
  sessions.set(id, session);
  writeSessionMeta(session);
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
  const session = sessions.get(id) ?? readSessionMeta(id);
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

  const meta = metaPath(id);
  if (existsSync(meta)) {
    try {
      unlinkSync(meta);
    } catch {
      // ignore
    }
  }

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
  const seen = new Set<string>();

  for (const [id, session] of sessions) {
    seen.add(id);
    if (now - session.lastAccessAt > PROFILE_SESSION_TTL_MS) {
      destroyProfileSession(id);
    }
  }

  for (const meta of listSessionMetas()) {
    if (seen.has(meta.id)) continue;
    if (now - meta.lastAccessAt > PROFILE_SESSION_TTL_MS) {
      destroyProfileSession(meta.id);
    } else if (!existsSync(meta.dbPath)) {
      destroyProfileSession(meta.id);
    } else {
      sessions.set(meta.id, meta);
    }
  }
}

export function getSessionCookieValue(
  cookieHeader: string | undefined,
): string | null {
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

/** Test helper: drop in-memory maps without deleting disk files. */
export function __resetMemoryForTests(): void {
  for (const db of openDbs.values()) {
    try {
      db.close();
    } catch {
      // ignore
    }
  }
  openDbs.clear();
  sessions.clear();
}
