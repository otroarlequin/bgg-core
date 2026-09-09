/** Broadcast when Market alert unread state may have changed (scan / mark read). */
export const MARKET_ALERTS_CHANGED = "bgg-market-alerts-changed";

export function notifyMarketAlertsChanged(): void {
  window.dispatchEvent(new Event(MARKET_ALERTS_CHANGED));
}
