export type AppMode = "personal" | "profile";

/**
 * Profile Vite runs with `--mode profile` (port 5174) and always talks to the
 * profile API. Path `/profile` also marks profile when using the personal Vite
 * with referer-based proxy routing.
 */
export function detectAppMode(): AppMode {
  if (import.meta.env.MODE === "profile") return "profile";
  if (typeof window === "undefined") return "personal";
  if (window.location.pathname.startsWith("/profile")) return "profile";
  if (window.location.port === "5174") return "profile";
  return "personal";
}

export function isProfileAppMode(): boolean {
  return detectAppMode() === "profile";
}

/** Send browsers on profile Vite away from `/` (personal UI shell). */
export function ensureProfileEntryPath(): void {
  if (typeof window === "undefined") return;
  if (import.meta.env.MODE !== "profile") return;
  if (window.location.pathname.startsWith("/profile")) return;
  const next = `/profile${window.location.search}${window.location.hash}`;
  window.location.replace(next);
}

const USERNAME_KEY = "bgg-profile-username";

export function getStoredProfileUsername(): string {
  try {
    return localStorage.getItem(USERNAME_KEY) ?? "";
  } catch {
    return "";
  }
}

export function setStoredProfileUsername(username: string): void {
  try {
    localStorage.setItem(USERNAME_KEY, username);
  } catch {
    // ignore quota / private mode
  }
}
