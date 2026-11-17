import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  isCloudflareChallenge,
  isCloudflareChallengeError,
  rateLimitedFetch,
  resetStoreRateLimit,
} from "../src/stores/http.js";
import {
  IBERMADRID_CLOUDFLARE_ERROR,
  searchFerreteriaIbermadrid,
} from "../src/stores/ferreteriaibermadrid.js";
import { searchMalditoGames } from "../src/stores/malditogames.js";
import { searchMathom } from "../src/stores/mathom.js";

const fixturesDir = join(
  dirname(fileURLToPath(import.meta.url)),
  "fixtures",
  "stores",
);

const mathomAjax = readFileSync(join(fixturesDir, "mathom-search.json"), "utf8");
const mathomHtml = readFileSync(join(fixturesDir, "mathom-search.html"), "utf8");
const malditoJson = readFileSync(
  join(fixturesDir, "malditogames-search.json"),
  "utf8",
);

const CF_HTML = `<!DOCTYPE html><html><head><title>Just a moment...</title></head><body>challenge-platform</body></html>`;

const originalFetch = globalThis.fetch;

type MockCall = {
  url: string;
  method: string;
  headers: Record<string, string>;
};

function headerMap(init?: RequestInit): Record<string, string> {
  const headers = new Headers(init?.headers);
  const out: Record<string, string> = {};
  for (const [key, value] of headers) out[key.toLowerCase()] = value;
  return out;
}

function jsonResponse(body: string, status = 200, extra?: HeadersInit): Response {
  return new Response(body, {
    status,
    headers: { "content-type": "application/json", ...extra },
  });
}

function htmlResponse(body: string, status = 200, extra?: HeadersInit): Response {
  return new Response(body, {
    status,
    headers: { "content-type": "text/html; charset=utf-8", ...extra },
  });
}

function cfResponse(): Response {
  return htmlResponse(CF_HTML, 403, { "cf-mitigated": "challenge" });
}

describe("store HTTP", () => {
  const calls: MockCall[] = [];
  let queue: Array<Response | Error | ((url: string, init?: RequestInit) => Response | Error)>;

  beforeEach(() => {
    process.env.STORE_REQUEST_DELAY_MS = "0";
    process.env.STORE_FETCH_RETRIES = "2";
    process.env.STORE_FETCH_TIMEOUT_MS = "20000";
    resetStoreRateLimit();
    calls.length = 0;
    queue = [];
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      calls.push({
        url,
        method: (init?.method ?? "GET").toUpperCase(),
        headers: headerMap(init),
      });
      const next = queue.shift();
      if (!next) {
        throw new Error(`unexpected fetch: ${url}`);
      }
      const resolved = typeof next === "function" ? next(url, init) : next;
      if (resolved instanceof Error) throw resolved;
      return resolved;
    }) as typeof fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    resetStoreRateLimit();
    delete process.env.STORE_REQUEST_DELAY_MS;
    delete process.env.STORE_FETCH_RETRIES;
    delete process.env.STORE_FETCH_TIMEOUT_MS;
  });

  it("detects Cloudflare challenge pages", () => {
    const res = cfResponse();
    expect(isCloudflareChallenge(res, CF_HTML)).toBe(true);
    expect(isCloudflareChallenge(jsonResponse("{}", 403), "{}")).toBe(false);
    expect(isCloudflareChallengeError(new Error("HTTP 403 (Cloudflare challenge)"))).toBe(
      true,
    );
    expect(isCloudflareChallengeError(new Error(IBERMADRID_CLOUDFLARE_ERROR))).toBe(
      true,
    );
    expect(isCloudflareChallengeError(new Error("GN blocked"))).toBe(false);
  });

  it("sends a current Chrome UA, Referer and cookies on the next request", async () => {
    const headers = new Headers({ "content-type": "text/html" });
    headers.append("Set-Cookie", "PHPSESSID=abc123; Path=/; HttpOnly");
    headers.append("Set-Cookie", "PrestaShop-x=token; Path=/");
    queue.push(new Response("ok", { status: 200, headers }));
    queue.push(jsonResponse("{}"));

    await rateLimitedFetch("https://mathom.es/es/");
    await rateLimitedFetch("https://mathom.es/es/buscar?s=Wingspan&ajax=1", {
      headers: { Accept: "application/json" },
    });

    expect(calls[0].headers["user-agent"]).toMatch(/Chrome\/142/);
    expect(calls[0].headers["accept-language"]).toMatch(/es-ES/);
    expect(calls[0].headers["referer"]).toBe("https://mathom.es/");
    expect(calls[1].headers["cookie"]).toContain("PHPSESSID=abc123");
    expect(calls[1].headers["cookie"]).toContain("PrestaShop-x=token");
    expect(calls[1].headers["referer"]).toBe("https://mathom.es/");
  });

  it("retries a network error and then succeeds", async () => {
    process.env.STORE_FETCH_RETRIES = "2";
    queue.push(new TypeError("fetch failed"));
    queue.push(jsonResponse('{"ok":true}'));

    const res = await rateLimitedFetch("https://tienda.malditogames.com/graphql", {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
    });
    expect(res.ok).toBe(true);
    expect(calls).toHaveLength(2);
    expect(calls[0].headers["origin"]).toBe("https://tienda.malditogames.com");
  });

  it("does not retry a Cloudflare challenge", async () => {
    queue.push(cfResponse());
    const res = await rateLimitedFetch("https://ferreteriaibermadrid.es/busqueda?s=Wingspan&ajax=1");
    expect(res.status).toBe(403);
    expect(isCloudflareChallenge(res)).toBe(true);
    expect(calls).toHaveLength(1);
  });

  it("falls back to Mathom HTML search when ajax is challenged", async () => {
    queue.push(htmlResponse("<html>mathom</html>", 200, { "set-cookie": "PHPSESSID=m1; Path=/" }));
    queue.push(cfResponse());
    queue.push(htmlResponse(mathomHtml));

    const offers = await searchMathom("Wingspan", { limit: 10 });
    expect(offers[0]).toMatchObject({
      store: "mathom",
      name: "Wingspan",
      price: 48.4,
      inStock: true,
    });
    expect(calls.map((c) => c.url)).toEqual([
      "https://mathom.es/es/",
      "https://mathom.es/es/buscar?s=Wingspan&ajax=1",
      "https://mathom.es/es/buscar?s=Wingspan",
    ]);
    expect(calls[1].headers["x-requested-with"]).toBe("XMLHttpRequest");
    expect(calls[1].headers["referer"]).toBe(
      "https://mathom.es/es/buscar?s=Wingspan",
    );
    expect(calls[1].headers["cookie"]).toContain("PHPSESSID=m1");
  });

  it("parses Mathom ajax JSON after a homepage warmup", async () => {
    queue.push(htmlResponse("<html>mathom</html>"));
    queue.push(jsonResponse(mathomAjax));

    const offers = await searchMathom("Wingspan");
    expect(offers[0]).toMatchObject({
      store: "mathom",
      name: "Wingspan",
      publisher: "Maldito Games",
      inStock: true,
    });
    expect(calls).toHaveLength(2);
  });

  it("keeps Ibermadrid Cloudflare errors per store", async () => {
    queue.push(cfResponse()); // warmup
    queue.push(cfResponse()); // ajax
    queue.push(cfResponse()); // html fallback

    await expect(searchFerreteriaIbermadrid("Wingspan")).rejects.toThrow(
      IBERMADRID_CLOUDFLARE_ERROR,
    );
    expect(calls[1].url).toContain("ferreteriaibermadrid.es/busqueda");
    expect(calls[1].url).toContain("ajax=1");
    expect(calls[1].url).toContain("controller=search");
  });

  it("retries Maldito GraphQL fetch failed after warmup", async () => {
    queue.push(htmlResponse("<html>maldito</html>"));
    queue.push(new TypeError("fetch failed"));
    queue.push(jsonResponse(malditoJson));

    const offers = await searchMalditoGames("Matchbox");
    expect(offers[0]).toMatchObject({
      store: "malditogames",
      name: "Wingspan",
      currency: "EUR",
    });
    expect(calls[0].url).toBe("https://tienda.malditogames.com/");
    expect(calls[1].url).toBe("https://tienda.malditogames.com/graphql");
    expect(calls[1].method).toBe("POST");
    expect(calls[1].headers["store"]).toBe("default");
    expect(calls[1].headers["origin"]).toBe("https://tienda.malditogames.com");
    expect(calls[2].url).toBe("https://tienda.malditogames.com/graphql");
  });

  it("surfaces Maldito network errors after retries", async () => {
    process.env.STORE_FETCH_RETRIES = "1";
    queue.push(htmlResponse("<html>maldito</html>"));
    queue.push(new TypeError("fetch failed"));
    queue.push(new TypeError("fetch failed"));

    await expect(searchMalditoGames("Matchbox")).rejects.toThrow(
      /Maldito Games network error: fetch failed/,
    );
  });
});
