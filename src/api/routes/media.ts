import { Hono } from "hono";

export const mediaRoutes = new Hono();

const ALLOWED_HOST_SUFFIXES = [
  "geekdo-images.com",
  "boardgamegeek.com",
  "cf.geekdo-images.com",
];

function isAllowedImageUrl(raw: string): boolean {
  try {
    const u = new URL(raw);
    if (u.protocol !== "https:" && u.protocol !== "http:") return false;
    const host = u.hostname.toLowerCase();
    return ALLOWED_HOST_SUFFIXES.some(
      (suffix) => host === suffix || host.endsWith(`.${suffix}`),
    );
  } catch {
    return false;
  }
}

/**
 * Same-origin image proxy so canvas export can draw BGG covers without CORS taint.
 * Only allows known BGG CDN hosts.
 */
mediaRoutes.get("/proxy", async (c) => {
  const raw = c.req.query("url")?.trim() ?? "";
  if (!raw || !isAllowedImageUrl(raw)) {
    return c.json({ message: "URL de imagen no permitida" }, 400);
  }

  try {
    const upstream = await fetch(raw, {
      headers: {
        Accept: "image/*,*/*;q=0.8",
        "User-Agent": "bgg-core-export/0.1",
      },
    });
    if (!upstream.ok) {
      return c.json({ message: `Upstream ${upstream.status}` }, 502);
    }
    const contentType = upstream.headers.get("content-type") ?? "image/jpeg";
    if (!contentType.startsWith("image/")) {
      return c.json({ message: "La respuesta no es una imagen" }, 502);
    }
    const bytes = await upstream.arrayBuffer();
    return new Response(bytes, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=86400",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return c.json({ message }, 502);
  }
});
