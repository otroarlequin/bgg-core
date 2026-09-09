import { Hono } from "hono";
import { loadConfig } from "../../config/index.js";
import { getEffectiveBggUsername } from "../../config/bgg-username.js";
import {
  hasBggUserData,
  setStoredBggUsername,
  wipeBggUserData,
} from "../../storage/repos/app-settings.js";
import {
  getNotificationSettings,
  setMarketWatchCronEnabled,
  setNotifyEmail,
} from "../../storage/repos/notification-settings.js";
import { getDb } from "../context.js";

export const settingsRoutes = new Hono();

export interface SettingsResponse {
  bggUsername: string | null;
  bggUsernameSource: "db" | "env" | null;
  hasCollectionData: boolean;
  hasPlaysData: boolean;
  notifyEmail: string | null;
  marketWatchCronEnabled: boolean;
  resendConfigured: boolean;
}

settingsRoutes.get("/", (c) => {
  const db = getDb();
  const config = loadConfig();
  const { username, source } = getEffectiveBggUsername(db, config);
  const flags = hasBggUserData(db);
  const notifications = getNotificationSettings(db);
  const body: SettingsResponse = {
    bggUsername: username,
    bggUsernameSource: source,
    ...flags,
    ...notifications,
  };
  return c.json(body);
});

settingsRoutes.put("/", async (c) => {
  let body: {
    bggUsername?: string;
    confirmReplace?: boolean;
    notifyEmail?: string | null;
    marketWatchCronEnabled?: boolean;
  } = {};
  try {
    body = (await c.req.json()) as typeof body;
  } catch {
    return c.json({ message: "JSON inválido" }, 400);
  }

  const db = getDb();
  const config = loadConfig();

  if (body.notifyEmail !== undefined) {
    const email = body.notifyEmail?.trim() ?? "";
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return c.json({ message: "Email de notificaciones inválido" }, 400);
    }
    setNotifyEmail(db, email || null);
  }

  if (body.marketWatchCronEnabled !== undefined) {
    setMarketWatchCronEnabled(db, body.marketWatchCronEnabled === true);
  }

  const usernameInput = body.bggUsername?.trim();
  if (!usernameInput) {
    const after = getEffectiveBggUsername(db, config);
    const afterFlags = hasBggUserData(db);
    const notifications = getNotificationSettings(db);
    return c.json({
      ok: true,
      wiped: false,
      bggUsername: after.username,
      bggUsernameSource: after.source,
      ...afterFlags,
      ...notifications,
    });
  }

  const next = usernameInput;
  if (!/^[A-Za-z0-9_-]{1,50}$/.test(next)) {
    return c.json(
      {
        message:
          "Username inválido. Usa solo letras, números, guion o guion bajo (máx. 50).",
      },
      400,
    );
  }

  const current = getEffectiveBggUsername(db, config);
  const changing =
    !current.username ||
    current.username.toLowerCase() !== next.toLowerCase();
  const flags = hasBggUserData(db);
  const hasData = flags.hasCollectionData || flags.hasPlaysData;

  if (changing && hasData && body.confirmReplace !== true) {
    const fromLabel = current.username
      ? `«${current.username}»`
      : "sin username";
    return c.json(
      {
        message:
          `Cambiar de ${fromLabel} a «${next}» borrará colección y partidas sincronizadas (se conservan duels y reviews). Confirma con confirmReplace: true.`,
        requiresConfirm: true,
        previousUsername: current.username,
        nextUsername: next,
        ...flags,
      },
      409,
    );
  }

  if (changing && hasData && body.confirmReplace === true) {
    wipeBggUserData(db);
  }

  setStoredBggUsername(db, next);
  const after = getEffectiveBggUsername(db, config);
  const afterFlags = hasBggUserData(db);
  const notifications = getNotificationSettings(db);
  return c.json({
    ok: true,
    wiped: Boolean(changing && hasData && body.confirmReplace === true),
    bggUsername: after.username,
    bggUsernameSource: after.source,
    ...afterFlags,
    ...notifications,
  });
});
