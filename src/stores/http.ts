const DEFAULT_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36";

const DEFAULT_ACCEPT_LANGUAGE = "es-ES,es;q=0.9,en-US;q=0.8,en;q=0.7";

const HTML_ACCEPT =
  "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8";

/** Default cap so a hung store cannot stall a whole wishlist scan. */
export const STORE_FETCH_TIMEOUT_MS = 20_000;

const RETRYABLE_STATUS = new Set([403, 408, 425, 429, 500, 502, 503, 504]);

let lastRequestAt = 0;
const cookieJars = new Map<string, Map<string, string>>();
const warmedOrigins = new Set<string>();

export function getStoreUserAgent(): string {
  return process.env.STORE_USER_AGENT?.trim() || DEFAULT_USER_AGENT;
}

export function getStoreRequestDelayMs(): number {
  const raw = Number(process.env.STORE_REQUEST_DELAY_MS ?? 2000);
  return Number.isFinite(raw) && raw >= 0 ? raw : 2000;
}

export function getStoreFetchTimeoutMs(): number {
  const raw = Number(process.env.STORE_FETCH_TIMEOUT_MS ?? STORE_FETCH_TIMEOUT_MS);
  return Number.isFinite(raw) && raw > 0 ? raw : STORE_FETCH_TIMEOUT_MS;
}

export function getStoreFetchRetries(): number {
  const raw = Number(process.env.STORE_FETCH_RETRIES ?? 2);
  return Number.isFinite(raw) && raw >= 0 ? Math.min(5, Math.floor(raw)) : 2;
}

export interface StoreFetchOptions {
  /** Extra attempts after the first. Default 2 (3 tries total). */
  retries?: number;
  timeoutMs?: number;
  /**
   * GET this URL once per origin to collect public session cookies
   * (PrestaShop / Magento / Cloudflare `__cf_bm` when issued without a JS
   * challenge). Not a captcha solver.
   */
  warmupUrl?: string;
}

function originOf(url: string): string {
  return new URL(url).origin;
}

function cookieHeaderFor(url: string): string | null {
  const jar = cookieJars.get(originOf(url));
  if (!jar || jar.size === 0) return null;
  return [...jar.entries()].map(([name, value]) => `${name}=${value}`).join("; ");
}

function rememberCookies(url: string, res: Response): void {
  const origin = originOf(url);
  const setCookies =
    typeof res.headers.getSetCookie === "function"
      ? res.headers.getSetCookie()
      : [];
  if (setCookies.length === 0) return;
  const jar = cookieJars.get(origin) ?? new Map<string, string>();
  for (const header of setCookies) {
    const pair = header.split(";", 1)[0] ?? "";
    const eq = pair.indexOf("=");
    if (eq <= 0) continue;
    const name = pair.slice(0, eq).trim();
    const value = pair.slice(eq + 1).trim();
    if (!name) continue;
    if (!value || /^deleted$/i.test(value)) {
      jar.delete(name);
      continue;
    }
    jar.set(name, value);
  }
  cookieJars.set(origin, jar);
}

export function isCloudflareChallenge(
  res: Response,
  bodyText?: string | null,
): boolean {
  const mitigated = res.headers.get("cf-mitigated");
  if (mitigated && /challenge/i.test(mitigated)) return true;
  if (!bodyText) return false;
  return /just a moment\.\.\.|cf-browser-verification|challenge-platform|cdn-cgi\/challenge/i.test(
    bodyText,
  );
}

export function describeStoreHttpStatus(
  res: Response,
  bodyText?: string | null,
): string {
  if (isCloudflareChallenge(res, bodyText)) {
    return `HTTP ${res.status} (Cloudflare challenge)`;
  }
  return `HTTP ${res.status}`;
}

export function describeStoreNetworkError(error: unknown): string {
  if (error instanceof Error) {
    if (error.name === "AbortError" || error.name === "TimeoutError") {
      return "timeout";
    }
    const cause = (error as { cause?: { code?: string; message?: string } })
      .cause;
    const extra = cause?.code || cause?.message;
    const base = error.message || error.name;
    return extra && extra !== base ? `${base} (${extra})` : base;
  }
  return String(error);
}

function isCallerAbort(error: unknown, parent?: AbortSignal | null): boolean {
  return (
    error instanceof Error &&
    error.name === "AbortError" &&
    parent?.aborted === true
  );
}

function isRetryableNetworkError(error: unknown): boolean {
  if (!(error instanceof Error)) return true;
  if (error.name === "AbortError" && !/timeout/i.test(error.message)) {
    return false;
  }
  return true;
}

function mergeAbortSignals(
  timeoutMs: number,
  parent?: AbortSignal | null,
): { signal: AbortSignal; timeout: AbortSignal } {
  const timeout = AbortSignal.timeout(timeoutMs);
  if (!parent) return { signal: timeout, timeout };
  return { signal: AbortSignal.any([timeout, parent]), timeout };
}

async function waitForRateLimit(): Promise<void> {
  const delayMs = getStoreRequestDelayMs();
  const now = Date.now();
  const wait = lastRequestAt + delayMs - now;
  if (wait > 0) {
    await new Promise((resolve) => setTimeout(resolve, wait));
  }
  lastRequestAt = Date.now();
}

function applyBrowserHeaders(url: string, init: RequestInit): Headers {
  const headers = new Headers(init.headers);
  if (!headers.has("User-Agent")) {
    headers.set("User-Agent", getStoreUserAgent());
  }
  if (!headers.has("Accept-Language")) {
    headers.set("Accept-Language", DEFAULT_ACCEPT_LANGUAGE);
  }
  if (!headers.has("Accept")) {
    headers.set("Accept", HTML_ACCEPT);
  }
  if (!headers.has("Referer")) {
    headers.set("Referer", `${originOf(url)}/`);
  }
  const method = (init.method ?? "GET").toUpperCase();
  if (!headers.has("Origin") && (method !== "GET" && method !== "HEAD")) {
    headers.set("Origin", originOf(url));
  }
  if (!headers.has("Cookie")) {
    const cookie = cookieHeaderFor(url);
    if (cookie) headers.set("Cookie", cookie);
  }
  return headers;
}

async function fetchOnce(
  url: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  const headers = applyBrowserHeaders(url, init);
  const { signal, timeout } = mergeAbortSignals(timeoutMs, init.signal);
  try {
    const res = await fetch(url, { ...init, headers, signal, redirect: "follow" });
    rememberCookies(url, res);
    return res;
  } catch (error) {
    if (
      error instanceof Error &&
      (error.name === "AbortError" || error.name === "TimeoutError") &&
      timeout.aborted &&
      !init.signal?.aborted
    ) {
      throw new Error(`timeout after ${timeoutMs}ms`);
    }
    throw error;
  }
}

async function warmupOnce(warmupUrl: string, timeoutMs: number): Promise<void> {
  const origin = originOf(warmupUrl);
  if (warmedOrigins.has(origin)) return;
  warmedOrigins.add(origin);
  try {
    await waitForRateLimit();
    const res = await fetchOnce(
      warmupUrl,
      {
        method: "GET",
        headers: {
          Accept: HTML_ACCEPT,
          "Upgrade-Insecure-Requests": "1",
          "Sec-Fetch-Dest": "document",
          "Sec-Fetch-Mode": "navigate",
          "Sec-Fetch-Site": "none",
        },
      },
      timeoutMs,
    );
    await res.arrayBuffer();
  } catch {
    // Warmup is best-effort: a Cloudflare challenge here must not skip the search.
  }
}

function retryDelayMs(attempt: number): number {
  if (getStoreRequestDelayMs() === 0) return 0;
  return Math.min(2000, 250 * 2 ** attempt);
}

export async function rateLimitedFetch(
  url: string,
  init: RequestInit = {},
  options: StoreFetchOptions = {},
): Promise<Response> {
  const timeoutMs = options.timeoutMs ?? getStoreFetchTimeoutMs();
  const retries = options.retries ?? getStoreFetchRetries();

  if (options.warmupUrl) {
    await warmupOnce(options.warmupUrl, timeoutMs);
  }

  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    if (attempt > 0) {
      await new Promise((resolve) => setTimeout(resolve, retryDelayMs(attempt - 1)));
    }
    try {
      await waitForRateLimit();
      const res = await fetchOnce(url, init, timeoutMs);
      if (res.ok) return res;
      if (isCloudflareChallenge(res)) {
        return res;
      }
      if (attempt < retries && RETRYABLE_STATUS.has(res.status)) {
        lastError = new Error(describeStoreHttpStatus(res));
        continue;
      }
      return res;
    } catch (error) {
      lastError = error;
      if (isCallerAbort(error, init.signal)) throw error;
      if (attempt >= retries || !isRetryableNetworkError(error)) {
        throw new Error(
          `network error: ${describeStoreNetworkError(error)}`,
        );
      }
    }
  }
  throw new Error(`network error: ${describeStoreNetworkError(lastError)}`);
}

/** Reset delay clock, cookies and warmup (tests). */
export function resetStoreRateLimit(): void {
  lastRequestAt = 0;
  cookieJars.clear();
  warmedOrigins.clear();
}
