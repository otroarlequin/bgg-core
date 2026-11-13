import { afterEach, describe, expect, it, vi } from "vitest";
import {
  BGG_FETCH_TIMEOUT_MS,
  fetchWithTimeout,
  installBggFetchTimeout,
  isBggRequest,
} from "../src/bgg/http.js";

function hangingFetch(_input: Parameters<typeof fetch>[0], init?: RequestInit): Promise<Response> {
  return new Promise((_resolve, reject) => {
    const signal = init?.signal;
    if (!signal) return;
    if (signal.aborted) {
      const err = new Error("aborted");
      err.name = "AbortError";
      reject(err);
      return;
    }
    signal.addEventListener("abort", () => {
      const err = new Error("aborted");
      err.name = "AbortError";
      reject(err);
    });
  });
}

describe("isBggRequest", () => {
  it("matches BGG API, browse, and geekdo image hosts", () => {
    expect(isBggRequest("https://boardgamegeek.com/xmlapi2/search")).toBe(true);
    expect(isBggRequest("https://boardgamegeek.com/browse/boardgame")).toBe(true);
    expect(isBggRequest("https://cf.geekdo-images.com/foo.jpg")).toBe(true);
    expect(isBggRequest("https://example.com/foo")).toBe(false);
  });
});

describe("fetchWithTimeout", () => {
  it("uses a 15s default timeout", () => {
    expect(BGG_FETCH_TIMEOUT_MS).toBe(15_000);
  });

  it("aborts hanging requests and throws a Spanish timeout error", async () => {
    await expect(
      fetchWithTimeout("https://boardgamegeek.com/browse/boardgame", {}, 30, hangingFetch),
    ).rejects.toThrow(/expiró tras 30ms/);
  });

  it("does not treat a caller abort as a BGG timeout", async () => {
    const controller = new AbortController();
    const pending = fetchWithTimeout(
      "https://boardgamegeek.com/xmlapi2/thing",
      { signal: controller.signal },
      5_000,
      hangingFetch,
    );
    controller.abort();
    await expect(pending).rejects.toMatchObject({ name: "AbortError" });
  });
});

describe("installBggFetchTimeout", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("times out BGG URLs and leaves other hosts alone", async () => {
    const other = vi.fn().mockResolvedValue(new Response("ok"));
    globalThis.fetch = ((input: Parameters<typeof fetch>[0], init?: RequestInit) => {
      if (isBggRequest(input)) return hangingFetch(input, init);
      return other(input, init);
    }) as typeof fetch;

    installBggFetchTimeout(25);

    await expect(fetch("https://boardgamegeek.com/xmlapi2/hot")).rejects.toThrow(
      /expiró tras 25ms/,
    );
    await expect(fetch("https://example.com/health")).resolves.toBeInstanceOf(Response);
    expect(other).toHaveBeenCalledOnce();
  });
});
