const DEFAULT_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";

let lastRequestAt = 0;

export function getStoreRequestDelayMs(): number {
  const raw = Number(process.env.STORE_REQUEST_DELAY_MS ?? 2000);
  return Number.isFinite(raw) && raw >= 0 ? raw : 2000;
}

export async function rateLimitedFetch(
  url: string,
  init: RequestInit = {},
): Promise<Response> {
  const delayMs = getStoreRequestDelayMs();
  const now = Date.now();
  const wait = lastRequestAt + delayMs - now;
  if (wait > 0) {
    await new Promise((resolve) => setTimeout(resolve, wait));
  }
  lastRequestAt = Date.now();

  const headers = new Headers(init.headers);
  if (!headers.has("User-Agent")) {
    headers.set("User-Agent", DEFAULT_USER_AGENT);
  }
  if (!headers.has("Accept-Language")) {
    headers.set("Accept-Language", "en-US,en;q=0.9");
  }

  return fetch(url, { ...init, headers });
}

/** Reset delay clock (tests). */
export function resetStoreRateLimit(): void {
  lastRequestAt = 0;
}
