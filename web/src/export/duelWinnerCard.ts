import type { GamePeriodSummary } from "../api/types";
import {
  drawCover,
  drawFooter,
  fillBackground,
  loadImageForCanvas,
  truncateText,
} from "./canvas";
import { exportPalette as P } from "./palette";

export interface DuelWinnerExportInput {
  winner: GamePeriodSummary;
  periodFrom: string;
  periodTo: string;
}

export function duelWinnerPlainText(input: DuelWinnerExportInput): string {
  const { winner, periodFrom, periodTo } = input;
  const lines = [
    `Campeón del periodo — BGG Core`,
    `${periodFrom} → ${periodTo}`,
    "",
    winner.name,
    `${winner.playCount} partidas`,
  ];
  if (winner.personalRating != null) {
    lines.push(`Rating ★ ${winner.personalRating}`);
  }
  if (winner.wins != null && winner.winRate != null) {
    lines.push(
      `Victorias ${winner.wins} (${Math.round(winner.winRate * 100)}%)`,
    );
  }
  if (winner.designers?.length) {
    lines.push(winner.designers.join(", "));
  }
  lines.push("", `https://boardgamegeek.com/boardgame/${winner.bggId}`);
  return lines.join("\n");
}

export async function renderDuelWinnerCard(
  input: DuelWinnerExportInput,
): Promise<HTMLCanvasElement> {
  const { winner, periodFrom, periodTo } = input;
  const w = 720;
  const h = 960;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas no disponible");

  fillBackground(ctx, w, h);

  ctx.fillStyle = P.accent;
  ctx.font = "700 22px system-ui, sans-serif";
  ctx.textAlign = "left";
  ctx.fillText("CAMPEÓN DEL PERIODO", 48, 64);

  ctx.fillStyle = P.muted;
  ctx.font = "500 20px system-ui, sans-serif";
  ctx.fillText(`${periodFrom}  →  ${periodTo}`, 48, 98);

  const img = await loadImageForCanvas(
    winner.imageUrl ?? winner.thumbnailUrl,
  );
  const coverSize = 400;
  drawCover(ctx, img, (w - coverSize) / 2, 140, coverSize);

  ctx.fillStyle = P.ink;
  ctx.font = "700 40px Georgia, 'Times New Roman', serif";
  ctx.textAlign = "center";
  const name = truncateText(ctx, winner.name, w - 96);
  ctx.fillText(name, w / 2, 600);

  if (winner.designers?.length) {
    ctx.fillStyle = P.muted;
    ctx.font = "500 20px system-ui, sans-serif";
    ctx.fillText(
      truncateText(ctx, winner.designers.join(", "), w - 96),
      w / 2,
      640,
    );
  }

  const stats: string[] = [`${winner.playCount} partidas`];
  if (winner.personalRating != null) {
    stats.push(`★ ${winner.personalRating}`);
  }
  if (winner.weight != null) {
    stats.push(`Peso ${winner.weight.toFixed(1)}`);
  }
  if (winner.winRate != null) {
    stats.push(`${Math.round(winner.winRate * 100)}% wins`);
  }

  ctx.fillStyle = P.accentSecondary;
  ctx.font = "600 22px system-ui, sans-serif";
  ctx.fillText(stats.join("   ·   "), w / 2, 700);

  ctx.fillStyle = P.border;
  ctx.fillRect(48, 760, w - 96, 1);

  ctx.fillStyle = P.inkSoft;
  ctx.font = "500 18px system-ui, sans-serif";
  ctx.fillText("Elegido en Duel ranking · BGG Core", w / 2, 810);

  drawFooter(ctx, w, h);
  return canvas;
}
