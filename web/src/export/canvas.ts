import { exportPalette as P } from "./palette";

export function downloadPng(canvas: HTMLCanvasElement, filename: string): void {
  const link = document.createElement("a");
  link.download = filename.endsWith(".png") ? filename : `${filename}.png`;
  link.href = canvas.toDataURL("image/png");
  link.click();
}

export async function copyText(text: string): Promise<void> {
  await navigator.clipboard.writeText(text);
}

function toProxyUrl(url: string): string {
  if (url.startsWith("/api/")) return url;
  if (url.startsWith("blob:") || url.startsWith("data:")) return url;
  return `/api/media/proxy?url=${encodeURIComponent(url)}`;
}

/**
 * Load image via same-origin proxy (blob) so canvas is not CORS-tainted
 * and Basic Auth credentials are sent in production.
 */
export async function loadImageForCanvas(
  url: string | null | undefined,
): Promise<HTMLImageElement | null> {
  if (!url) return null;
  try {
    const res = await fetch(toProxyUrl(url), { credentials: "same-origin" });
    if (!res.ok) return null;
    const blob = await res.blob();
    if (!blob.type.startsWith("image/")) return null;
    const objectUrl = URL.createObjectURL(blob);
    return await new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(objectUrl);
        resolve(img);
      };
      img.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        resolve(null);
      };
      img.src = objectUrl;
    });
  } catch {
    return null;
  }
}

export function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

export function fillBackground(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
): void {
  const grad = ctx.createLinearGradient(0, 0, w * 0.3, h);
  grad.addColorStop(0, "#211c16");
  grad.addColorStop(0.55, P.surface);
  grad.addColorStop(1, "#2e261e");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  // Soft vignette
  const vig = ctx.createRadialGradient(
    w * 0.5,
    h * 0.35,
    40,
    w * 0.5,
    h * 0.5,
    Math.max(w, h) * 0.75,
  );
  vig.addColorStop(0, "rgba(196,122,58,0.06)");
  vig.addColorStop(1, "rgba(0,0,0,0.35)");
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, w, h);

  // Fine paper grain
  ctx.save();
  ctx.globalAlpha = 0.035;
  for (let i = 0; i < 1400; i++) {
    const x = Math.random() * w;
    const y = Math.random() * h;
    ctx.fillStyle = Math.random() > 0.5 ? "#fff" : "#000";
    ctx.fillRect(x, y, 1.2, 1.2);
  }
  ctx.restore();
}

export function drawFooter(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
): void {
  ctx.fillStyle = P.border;
  ctx.fillRect(48, h - 56, w - 96, 1);
  ctx.fillStyle = P.mutedDim;
  ctx.font = "500 16px Georgia, 'Times New Roman', serif";
  ctx.textAlign = "left";
  ctx.fillText("Cartón y tinta", 48, h - 28);
  ctx.textAlign = "right";
  ctx.fillText("BGG Core", w - 48, h - 28);
}

export function truncateText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let t = text;
  while (t.length > 1 && ctx.measureText(`${t}…`).width > maxWidth) {
    t = t.slice(0, -1);
  }
  return `${t}…`;
}

export function drawCover(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement | null,
  x: number,
  y: number,
  size: number,
  radius = 10,
): void {
  roundRect(ctx, x, y, size, size, radius);
  ctx.save();
  ctx.clip();
  if (img) {
    const scale = Math.max(size / img.width, size / img.height);
    const dw = img.width * scale;
    const dh = img.height * scale;
    ctx.drawImage(img, x + (size - dw) / 2, y + (size - dh) / 2, dw, dh);
  } else {
    ctx.fillStyle = P.surfaceCard;
    ctx.fillRect(x, y, size, size);
    ctx.fillStyle = P.mutedDim;
    ctx.font = "600 18px Georgia, serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("BGG", x + size / 2, y + size / 2);
  }
  ctx.restore();

  // Copper inset edge (left accent)
  ctx.strokeStyle = "rgba(196,122,58,0.55)";
  ctx.lineWidth = 2;
  roundRect(ctx, x + 1, y + 1, size - 2, size - 2, radius);
  ctx.stroke();
}
