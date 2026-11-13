/** Default cap for outbound BGG HTTP so a hung XML API / browse page cannot stall forever. */
export const BGG_FETCH_TIMEOUT_MS = 15_000;

const TIMED_FETCH_MARK = "__bggTimedFetch";

export function isAbortError(error: unknown): boolean {
  return (
    error instanceof Error &&
    (error.name === "AbortError" || error.name === "TimeoutError")
  );
}

type FetchInput = Parameters<typeof fetch>[0];

export function isBggRequest(input: FetchInput): boolean {
  const raw =
    typeof input === "string"
      ? input
      : input instanceof URL
        ? input.href
        : input.url;
  try {
    const host = new URL(raw, "https://boardgamegeek.com").hostname.toLowerCase();
    return (
      host === "boardgamegeek.com" ||
      host.endsWith(".boardgamegeek.com") ||
      host === "geekdo-images.com" ||
      host.endsWith(".geekdo-images.com")
    );
  } catch {
    return false;
  }
}

function mergeAbortSignals(
  timeoutMs: number,
  parent?: AbortSignal | null,
): { signal: AbortSignal; timeout: AbortSignal } {
  const timeout = AbortSignal.timeout(timeoutMs);
  if (!parent) return { signal: timeout, timeout };
  return { signal: AbortSignal.any([timeout, parent]), timeout };
}

/**
 * `fetch` with AbortSignal.timeout. Use for browse HTML, image proxy, and tests.
 * `bgg-api-ts` 1.0.0 hardcodes 30s and does not accept a custom fetch; wrap it via
 * {@link installBggFetchTimeout}.
 */
export async function fetchWithTimeout(
  input: FetchInput,
  init: RequestInit = {},
  timeoutMs: number = BGG_FETCH_TIMEOUT_MS,
  fetchImpl: typeof fetch = globalThis.fetch,
): Promise<Response> {
  const { signal, timeout } = mergeAbortSignals(timeoutMs, init.signal);
  try {
    return await fetchImpl(input, { ...init, signal });
  } catch (error) {
    if (isAbortError(error) && timeout.aborted && !init.signal?.aborted) {
      throw new Error(`La petición a BGG expiró tras ${timeoutMs}ms`);
    }
    throw error;
  }
}

/**
 * Wrap global fetch so `BggClient` (which always calls `fetch`) also respects
 * {@link BGG_FETCH_TIMEOUT_MS}. Only boardgamegeek.com / geekdo-images.com URLs
 * are timed; other hosts pass through.
 */
export function installBggFetchTimeout(
  timeoutMs: number = BGG_FETCH_TIMEOUT_MS,
): void {
  const current = globalThis.fetch as typeof fetch & {
    [TIMED_FETCH_MARK]?: boolean;
  };
  if (current[TIMED_FETCH_MARK]) return;

  const inner = current.bind(globalThis);
  const wrapped = ((input: FetchInput, init?: RequestInit) => {
    if (!isBggRequest(input)) return inner(input, init);
    return fetchWithTimeout(input, init ?? {}, timeoutMs, inner);
  }) as typeof fetch & { [TIMED_FETCH_MARK]?: boolean };
  wrapped[TIMED_FETCH_MARK] = true;
  globalThis.fetch = wrapped;
}
