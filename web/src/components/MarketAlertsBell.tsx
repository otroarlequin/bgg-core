import { useEffect, useRef, useState } from "react";
import { postWishlistMarket } from "../api/client";
import type { MarketAlert } from "../api/types";
import {
  MARKET_ALERTS_CHANGED,
  notifyMarketAlertsChanged,
} from "../marketAlertsEvents";

function BellIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      aria-hidden
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M15 17h5l-1.4-1.4A2 2 0 0118 14.2V11a6 6 0 10-12 0v3.2c0 .5-.2 1-.6 1.4L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
      />
    </svg>
  );
}

function formatAlertPrice(alert: MarketAlert): string {
  if (alert.price == null) return "—";
  const cur = alert.currency ?? "";
  return `${alert.price.toFixed(2)} ${cur}`.trim();
}

interface MarketAlertsBellProps {
  onOpenMarketActivity: () => void;
}

export function MarketAlertsBell({ onOpenMarketActivity }: MarketAlertsBellProps) {
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [alerts, setAlerts] = useState<MarketAlert[]>([]);
  const [loading, setLoading] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  async function refresh() {
    try {
      const data = await postWishlistMarket({ action: "listAlerts" });
      setUnread(data.alertsUnread);
      setAlerts(data.alerts);
    } catch {
      setUnread(0);
      setAlerts([]);
    }
  }

  useEffect(() => {
    void refresh();
    const onChanged = () => void refresh();
    window.addEventListener(MARKET_ALERTS_CHANGED, onChanged);
    return () => window.removeEventListener(MARKET_ALERTS_CHANGED, onChanged);
  }, []);

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  async function toggleOpen() {
    const next = !open;
    setOpen(next);
    if (next) {
      setLoading(true);
      await refresh();
      setLoading(false);
    }
  }

  async function markAllRead() {
    try {
      const data = await postWishlistMarket({ action: "markAlertsRead" });
      setUnread(data.alertsUnread);
      setAlerts(data.alerts);
      notifyMarketAlertsChanged();
    } catch {
      // keep panel open; user can retry
    }
  }

  async function markOne(alert: MarketAlert) {
    try {
      const data = await postWishlistMarket({
        action: "markAlertsRead",
        alertIds: [alert.id],
      });
      setUnread(data.alertsUnread);
      setAlerts(data.alerts);
      notifyMarketAlertsChanged();
    } catch {
      // ignore
    }
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => void toggleOpen()}
        title="Notificaciones Market"
        aria-label={
          unread > 0
            ? `Notificaciones Market, ${unread} sin leer`
            : "Notificaciones Market"
        }
        aria-expanded={open}
        aria-haspopup="dialog"
        className={`relative inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg transition md:min-h-0 md:min-w-0 md:p-2.5 ${
          open
            ? "bg-accent text-surface"
            : "bg-surface-card text-ink-soft hover:bg-border hover:text-accent"
        }`}
      >
        <BellIcon />
        {unread > 0 ? (
          <span
            className={`absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold leading-none ring-2 ring-surface-raised ${
              open
                ? "bg-surface text-accent"
                : "bg-accent text-surface"
            }`}
          >
            {unread > 99 ? "99+" : unread}
          </span>
        ) : null}
      </button>

      {open ? (
        <div
          role="dialog"
          aria-label="Novedades de BGG Market"
          className="absolute right-0 z-40 mt-2 w-[min(100vw-2rem,22rem)] rounded-xl border border-border bg-surface-raised shadow-lg"
        >
          <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2.5">
            <p className="text-sm font-semibold text-ink">
              Market {unread > 0 ? `(${unread})` : ""}
            </p>
            {unread > 0 ? (
              <button
                type="button"
                onClick={() => void markAllRead()}
                className="text-xs text-accent hover:underline"
              >
                Marcar leídas
              </button>
            ) : null}
          </div>

          <div className="max-h-72 overflow-y-auto">
            {loading ? (
              <p className="px-3 py-4 text-sm text-muted">Cargando…</p>
            ) : alerts.length === 0 ? (
              <p className="px-3 py-4 text-sm text-muted">
                Sin novedades. Escanea Wishlist × BGG Market para detectar
                ofertas nuevas.
              </p>
            ) : (
              <ul className="divide-y divide-border">
                {alerts.map((alert) => (
                  <li key={alert.id} className="px-3 py-2.5">
                    <p className="text-sm font-medium text-ink">{alert.gameName}</p>
                    <p className="text-xs text-muted">
                      {formatAlertPrice(alert)}
                      {alert.condition ? ` · ${alert.condition}` : ""}
                    </p>
                    <div className="mt-1.5 flex gap-3">
                      <a
                        href={alert.url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-accent hover:underline"
                      >
                        Ver oferta
                      </a>
                      <button
                        type="button"
                        onClick={() => void markOne(alert)}
                        className="text-xs text-muted hover:text-ink"
                      >
                        Leída
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="border-t border-border p-2">
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                onOpenMarketActivity();
              }}
              className="w-full rounded-lg px-3 py-2 text-left text-sm text-ink-soft hover:bg-surface-card"
            >
              Ir a Wishlist × BGG Market
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
