import type { ThemeId } from "../theme";
import { getStoredTheme } from "../theme";

export type ExportPalette = {
  surface: string;
  surfaceRaised: string;
  surfaceCard: string;
  border: string;
  accent: string;
  accentSecondary: string;
  ink: string;
  inkSoft: string;
  muted: string;
  mutedDim: string;
};

const byTheme: Record<ThemeId, ExportPalette> = {
  onix: {
    surface: "#050505",
    surfaceRaised: "#121212",
    surfaceCard: "#1a1a1a",
    border: "#333333",
    accent: "#e8943a",
    accentSecondary: "#6b7a5c",
    ink: "#f2f2f2",
    inkSoft: "#e0e0e0",
    muted: "#8c8c8c",
    mutedDim: "#5e5e5e",
  },
  grafito: {
    surface: "#0a0a0a",
    surfaceRaised: "#161616",
    surfaceCard: "#1e1e1e",
    border: "#2a2a2a",
    accent: "#c47a3a",
    accentSecondary: "#7a8a6a",
    ink: "#e8e8e8",
    inkSoft: "#d4d4d4",
    muted: "#9a9a9a",
    mutedDim: "#6e6e6e",
  },
  carton: {
    surface: "#1a1612",
    surfaceRaised: "#2a241c",
    surfaceCard: "#241e18",
    border: "#3d342a",
    accent: "#c47a3a",
    accentSecondary: "#8a9a6a",
    ink: "#f5efe6",
    inkSoft: "#e8dfd0",
    muted: "#a89880",
    mutedDim: "#7a6c58",
  },
};

/** Palette for canvas export; follows the active theme. */
export function getExportPalette(theme: ThemeId = getStoredTheme()): ExportPalette {
  return byTheme[theme];
}

/** @deprecated Prefer getExportPalette() so exports match the active theme. */
export const exportPalette = new Proxy({} as ExportPalette, {
  get(_target, prop: string) {
    const palette = getExportPalette();
    return palette[prop as keyof ExportPalette];
  },
});
