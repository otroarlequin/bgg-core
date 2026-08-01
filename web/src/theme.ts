export type ThemeId = "onix" | "grafito" | "carton";

export const THEME_STORAGE_KEY = "bgg-core-theme";

export const themes: Array<{
  id: ThemeId;
  label: string;
  description: string;
}> = [
  {
    id: "onix",
    label: "Ónix",
    description: "Negro profundo, naranja vivo",
  },
  {
    id: "grafito",
    label: "Grafito",
    description: "Grises suaves, cobre clásico",
  },
  {
    id: "carton",
    label: "Cartón",
    description: "Marrón cálido original",
  },
];

export function isThemeId(value: string | null | undefined): value is ThemeId {
  return value === "onix" || value === "grafito" || value === "carton";
}

export function getStoredTheme(): ThemeId {
  try {
    const raw = localStorage.getItem(THEME_STORAGE_KEY);
    if (isThemeId(raw)) return raw;
  } catch {
    // ignore
  }
  return "onix";
}

export function applyTheme(theme: ThemeId): void {
  document.documentElement.dataset.theme = theme;
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // ignore
  }
}
