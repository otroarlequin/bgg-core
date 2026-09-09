import type { Db } from "../database.js";
import { getSetting, setSetting } from "./app-settings.js";

export const SETTING_NOTIFY_EMAIL = "notify_email";
export const SETTING_MARKET_WATCH_CRON_ENABLED = "market_watch_cron_enabled";

export function getNotifyEmail(db: Db): string | null {
  const value = getSetting(db, SETTING_NOTIFY_EMAIL)?.trim() ?? "";
  return value.length > 0 ? value : null;
}

export function setNotifyEmail(db: Db, email: string | null): void {
  if (!email?.trim()) {
    setSetting(db, SETTING_NOTIFY_EMAIL, "");
    return;
  }
  setSetting(db, SETTING_NOTIFY_EMAIL, email.trim());
}

export function getMarketWatchCronEnabled(db: Db): boolean {
  const value = getSetting(db, SETTING_MARKET_WATCH_CRON_ENABLED);
  if (value == null) return true;
  return value === "1" || value.toLowerCase() === "true";
}

export function setMarketWatchCronEnabled(db: Db, enabled: boolean): void {
  setSetting(db, SETTING_MARKET_WATCH_CRON_ENABLED, enabled ? "1" : "0");
}

export interface NotificationSettings {
  notifyEmail: string | null;
  marketWatchCronEnabled: boolean;
  resendConfigured: boolean;
}

export function getNotificationSettings(db: Db): NotificationSettings {
  return {
    notifyEmail: getNotifyEmail(db),
    marketWatchCronEnabled: getMarketWatchCronEnabled(db),
    resendConfigured: Boolean(process.env.RESEND_API_KEY?.trim()),
  };
}
