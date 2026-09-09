import type { WatchMatchHit } from "../query/market-price-watch.js";

export interface MarketDigestEmailInput {
  to: string;
  hits: WatchMatchHit[];
}

export type SendMarketDigestFn = (
  input: MarketDigestEmailInput,
) => Promise<void>;

function formatPrice(price: number | null, currency: string | null): string {
  if (price == null) return "—";
  return `${price.toFixed(2)} ${currency ?? ""}`.trim();
}

export function buildMarketDigestText(hits: WatchMatchHit[]): string {
  const lines = [
    "BGG Core — alertas de precio en Market",
    "",
    `Se encontraron ${hits.length} oferta(s) nuevas dentro de tu umbral:`,
    "",
  ];

  for (const hit of hits) {
    lines.push(
      `• ${hit.gameName}`,
      `  Oferta: ${formatPrice(hit.listing.price, hit.listing.currency)}`,
      `  Umbral: ${hit.watch.maxPrice.toFixed(2)} ${hit.watch.currency} (+${hit.watch.tolerancePct}% → ${hit.ceiling.toFixed(2)})`,
      `  ${hit.listing.url}`,
      "",
    );
  }

  lines.push("—", "Gestiona tus alertas en BGG Core → Actividades → Wishlist × BGG Market.");
  return lines.join("\n");
}

export function buildMarketDigestHtml(hits: WatchMatchHit[]): string {
  const items = hits
    .map(
      (hit) =>
        `<li><strong>${escapeHtml(hit.gameName)}</strong><br/>` +
        `Oferta: ${escapeHtml(formatPrice(hit.listing.price, hit.listing.currency))}<br/>` +
        `Umbral: ${hit.watch.maxPrice.toFixed(2)} ${escapeHtml(hit.watch.currency)} ` +
        `(+${hit.watch.tolerancePct}% → ${hit.ceiling.toFixed(2)})<br/>` +
        `<a href="${escapeHtml(hit.listing.url)}">Ver en GeekMarket</a></li>`,
    )
    .join("");

  return `<p>Se encontraron <strong>${hits.length}</strong> oferta(s) nuevas dentro de tu umbral:</p><ul>${items}</ul>`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function createResendDigestSender(): SendMarketDigestFn {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.NOTIFY_FROM_EMAIL?.trim();
  if (!apiKey || !from) {
    return async () => {
      throw new Error(
        "RESEND_API_KEY y NOTIFY_FROM_EMAIL son requeridos para enviar email.",
      );
    };
  }

  return async ({ to, hits }) => {
    if (hits.length === 0) return;

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [to],
        subject: `BGG Market: ${hits.length} oferta(s) en tu umbral`,
        text: buildMarketDigestText(hits),
        html: buildMarketDigestHtml(hits),
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Resend ${res.status}: ${body.slice(0, 200)}`);
    }
  };
}
