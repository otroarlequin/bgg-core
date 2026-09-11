/** Broadcast when Market alert unread state may have changed (scan / mark read). */
export const MARKET_ALERTS_CHANGED = "bgg-market-alerts-changed";
export const MARKET_FOCUS_GAME = "bgg-market-focus-game";

/** Survives navigation: the activity may mount after the event already fired. */
let pendingFocusBggId: number | null = null;

export function notifyMarketAlertsChanged(): void {
  window.dispatchEvent(new Event(MARKET_ALERTS_CHANGED));
}

export function marketGameAnchorId(bggId: number): string {
  return `market-game-${bggId}`;
}

export function focusMarketGame(bggId: number): void {
  pendingFocusBggId = bggId;
  window.dispatchEvent(
    new CustomEvent(MARKET_FOCUS_GAME, { detail: { bggId } }),
  );
}

export function takePendingMarketFocus(): number | null {
  const id = pendingFocusBggId;
  pendingFocusBggId = null;
  return id;
}

export function scrollToMarketGame(bggId: number): void {
  const el = document.getElementById(marketGameAnchorId(bggId));
  if (!el) return;
  el.scrollIntoView({ behavior: "smooth", block: "center" });
}
