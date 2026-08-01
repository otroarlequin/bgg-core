import type { TopGameSummary } from "../api/types";
import {
  drawCover,
  drawFooter,
  fillBackground,
  loadImageForCanvas,
  roundRect,
  truncateText,
} from "./canvas";
import { exportPalette as P } from "./palette";

export interface TopPlayedExportInput {
  title: string;
  items: TopGameSummary[];
  valueLabel: string;
  limit?: number;
}

export function topPlayedPlainText(input: TopPlayedExportInput): string {
  const limit = input.limit ?? 10;
  const items = input.items.slice(0, limit);
  const lines = [`${input.title} — BGG Core`, ""];
  items.forEach((item, i) => {
    lines.push(`${i + 1}. ${item.name} — ${item.value} ${input.valueLabel}`);
  });
  return lines.join("\n");
}

export async function renderTopPlayedCard(
  input: TopPlayedExportInput,
): Promise<HTMLCanvasElement> {
  const limit = Math.min(input.limit ?? 10, 10);
  const items = input.items.slice(0, limit);
  const cover = 64;
  const rowH = 88;
  const headerH = 168;
  const footerH = 72;
  const w = 760;
  const h = headerH + items.length * rowH + footerH;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas no disponible");

  fillBackground(ctx, w, h);

  // Left accent spine (theme: accent + accent-secondary)
  ctx.fillStyle = P.accent;
  ctx.fillRect(0, 0, 8, h);
  ctx.globalAlpha = 0.55;
  ctx.fillStyle = P.accentSecondary;
  ctx.fillRect(8, 0, 3, h);
  ctx.globalAlpha = 1;

  // Header eyebrow
  ctx.fillStyle = P.accent;
  ctx.font = "700 15px system-ui, sans-serif";
  ctx.textAlign = "left";
  ctx.fillText("TOP JUGADOS", 48, 52);

  ctx.fillStyle = P.ink;
  ctx.font = "700 36px Georgia, 'Times New Roman', serif";
  ctx.fillText(truncateText(ctx, input.title, w - 120), 48, 100);

  ctx.fillStyle = P.muted;
  ctx.font = "500 16px system-ui, sans-serif";
  ctx.fillText(
    `${items.length} juego${items.length === 1 ? "" : "s"} · ${input.valueLabel}`,
    48,
    130,
  );

  // Accent rule
  ctx.fillStyle = "rgba(196,122,58,0.45)";
  ctx.fillRect(48, 148, 120, 2);

  // Preload covers in parallel
  const covers = await Promise.all(
    items.map((item) => loadImageForCanvas(item.thumbnailUrl)),
  );

  let y = headerH;
  for (let i = 0; i < items.length; i++) {
    const item = items[i]!;
    const isTop3 = i < 3;

    // Row plate
    roundRect(ctx, 36, y, w - 72, rowH - 12, 14);
    ctx.fillStyle = isTop3 ? "rgba(36,30,24,0.92)" : "rgba(30,26,22,0.75)";
    ctx.fill();
    ctx.strokeStyle = isTop3 ? "rgba(196,122,58,0.35)" : P.border;
    ctx.lineWidth = 1;
    ctx.stroke();

    // Rank disc
    const cx = 78;
    const cy = y + (rowH - 12) / 2;
    ctx.beginPath();
    ctx.arc(cx, cy, 18, 0, Math.PI * 2);
    ctx.fillStyle = isTop3 ? P.accent : P.surfaceRaised;
    ctx.fill();
    if (!isTop3) {
      ctx.strokeStyle = P.border;
      ctx.stroke();
    }
    ctx.fillStyle = isTop3 ? P.surface : P.inkSoft;
    ctx.font = "700 16px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(String(i + 1), cx, cy + 1);

    // Cover
    drawCover(ctx, covers[i] ?? null, 110, y + 10, cover, 10);

    // Name + meta
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = P.ink;
    ctx.font = isTop3
      ? "700 23px Georgia, 'Times New Roman', serif"
      : "600 21px Georgia, 'Times New Roman', serif";
    ctx.fillText(truncateText(ctx, item.name, 360), 192, y + 40);

    ctx.fillStyle = P.muted;
    ctx.font = "500 14px system-ui, sans-serif";
    ctx.fillText(`#${item.bggId}`, 192, y + 62);

    // Value block
    ctx.textAlign = "right";
    ctx.fillStyle = isTop3 ? P.accent : P.accentSecondary;
    ctx.font = "700 30px Georgia, 'Times New Roman', serif";
    ctx.fillText(String(item.value), w - 56, y + 42);
    ctx.fillStyle = P.mutedDim;
    ctx.font = "600 12px system-ui, sans-serif";
    ctx.fillText(input.valueLabel, w - 56, y + 62);

    y += rowH;
  }

  drawFooter(ctx, w, h);
  return canvas;
}
