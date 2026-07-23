import { createMiddleware } from "hono/factory";
import { timingSafeEqual } from "node:crypto";

function safeEqual(a: string, b: string): boolean {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) return false;
  return timingSafeEqual(aBuf, bBuf);
}

/**
 * Shared-password Basic Auth.
 * - Skip when APP_PASSWORD is unset (local dev).
 * - Always allow GET /api/health (Fly checks).
 */
export function sharedPasswordAuth() {
  return createMiddleware(async (c, next) => {
    if (c.req.method === "GET" && c.req.path === "/api/health") {
      return next();
    }

    const password = process.env.APP_PASSWORD;
    if (!password) {
      return next();
    }

    const header = c.req.header("authorization");
    if (!header?.startsWith("Basic ")) {
      return c.text("Authentication required", 401, {
        "WWW-Authenticate": 'Basic realm="bgg-core"',
      });
    }

    let decoded: string;
    try {
      decoded = Buffer.from(header.slice(6), "base64").toString("utf8");
    } catch {
      return c.text("Invalid authorization", 401, {
        "WWW-Authenticate": 'Basic realm="bgg-core"',
      });
    }

    const colon = decoded.indexOf(":");
    const provided =
      colon === -1 ? decoded : decoded.slice(colon + 1);

    if (!safeEqual(provided, password)) {
      return c.text("Invalid credentials", 401, {
        "WWW-Authenticate": 'Basic realm="bgg-core"',
      });
    }

    return next();
  });
}
