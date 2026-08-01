export type AppMode = "personal" | "profile";

export function detectAppMode(): AppMode {
  if (typeof window === "undefined") return "personal";
  return window.location.pathname.startsWith("/profile")
    ? "profile"
    : "personal";
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
