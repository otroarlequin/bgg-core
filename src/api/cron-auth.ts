import { timingSafeEqual } from "node:crypto";
import type { Context } from "hono";

function safeEqual(a: string, b: string): boolean {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) return false;
  return timingSafeEqual(aBuf, bBuf);
}

export function verifyCronSecret(c: Context): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;

  const header = c.req.header("authorization");
  if (!header?.startsWith("Bearer ")) return false;

  const provided = header.slice("Bearer ".length).trim();
  return safeEqual(provided, secret);
}

export function isValidCronRequest(c: Context): boolean {
  return c.req.path.startsWith("/api/cron/") && verifyCronSecret(c);
}
