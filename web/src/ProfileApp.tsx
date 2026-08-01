import { useEffect, useState, type FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  ApiError,
  createProfileSession,
  endProfileSession,
  fetchProfileSession,
  type ProfileSessionView,
  type ProfileSyncResult,
} from "./api/client";
import {
  getStoredProfileUsername,
  setStoredProfileUsername,
} from "./appMode";
import App from "./App";

export function ProfileApp() {
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<ProfileSessionView | null>(null);
  const [username, setUsername] = useState(getStoredProfileUsername);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastSync, setLastSync] = useState<ProfileSyncResult | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const healthRes = await fetch("/api/health", { credentials: "include" });
        const health = (await healthRes.json()) as { mode?: string; ok?: boolean };
        if (cancelled) return;
        if (health.mode !== "profile") {
          setError(
            `Esta pestaña no está hablando con la API profile (:3002). ` +
              `Cierra el Vite personal (:5173) y abre http://localhost:5174/profile ` +
              `(npm run dev:profile:all). Ahora mismo el proxy apunta a la API personal.`,
          );
          setLoading(false);
          return;
        }
        const result = await fetchProfileSession();
        if (cancelled) return;
        if (result.active && result.session) {
          setSession(result.session);
          setUsername(result.session.username);
        }
      } catch {
        if (!cancelled) {
          setSession(null);
          setError(
            "No se pudo contactar la API profile. ¿Está en marcha en :3002? Usa npm run dev:profile:all y abre http://localhost:5174/profile",
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleStart(e: FormEvent) {
    e.preventDefault();
    const next = username.trim();
    if (!next) {
      setError("Indica tu username de BoardGameGeek.");
      return;
    }
    setStarting(true);
    setError(null);
    setLastSync(null);
    try {
      const result = await createProfileSession(next);
      if (!result.ok || !result.session) {
        setError(result.message ?? "No se pudo crear la sesión.");
        return;
      }
      setStoredProfileUsername(next);
      setSession(result.session);
      setLastSync(result.sync ?? null);
      await queryClient.invalidateQueries();
    } catch (err) {
      const raw = err instanceof Error ? err.message : "Error al sincronizar";
      const needsProfileApi =
        err instanceof ApiError &&
        (err.status === 503 || err.status === 404) &&
        (/API personal|Ruta no encontrada|profile/i.test(raw) ||
          /3002/.test(raw));
      setError(
        needsProfileApi
          ? `${raw} — Arranca la API profile: npm run dev:profile (puerto 3002) o npm run dev:profile:all`
          : raw,
      );
    } finally {
      setStarting(false);
    }
  }

  async function handleLogout() {
    try {
      await endProfileSession();
    } catch {
      // still clear local UI
    }
    setSession(null);
    setLastSync(null);
    await queryClient.clear();
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface text-muted">
        Cargando perfil temporal…
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-surface">
        <div className="mx-auto flex max-w-lg flex-col gap-6 px-4 py-16">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted">
              BGG Profile
            </p>
            <h1 className="mt-2 text-3xl font-bold text-ink">
              Explora tu colección
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-muted">
              Indica tu username de BoardGameGeek. Sincronizaremos colección,
              partidas y metadatos en una sesión temporal (unas 6 horas de
              inactividad). No se guarda una cuenta durable ni se mezclan datos
              con otros visitantes.
            </p>
          </div>

          <form
            onSubmit={(e) => void handleStart(e)}
            className="space-y-4 rounded-xl border border-border bg-surface-raised/50 p-5"
          >
            <div>
              <label
                htmlFor="profile-username"
                className="block text-xs font-medium text-muted"
              >
                Username BGG
              </label>
              <input
                id="profile-username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                spellCheck={false}
                className="mt-1 w-full rounded-lg border border-border bg-surface-card px-3 py-2 text-sm text-ink outline-none focus:border-accent"
                placeholder="tu-usuario-bgg"
                disabled={starting}
              />
            </div>
            <button
              type="submit"
              disabled={starting || !username.trim()}
              className="min-h-11 w-full rounded-lg bg-accent px-4 py-2 text-sm font-medium text-ink hover:bg-accent-hover disabled:opacity-50"
            >
              {starting
                ? "Sincronizando (puede tardar)…"
                : "Entrar y sincronizar"}
            </button>
            {error ? <p className="text-sm text-red-400">{error}</p> : null}
          </form>

          <p className="text-xs text-muted-dim">
            Se usa el token BGG del servidor con rate limit. Duels y análisis del
            validador viven solo en esta sesión; no hay historial guardado.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="border-b border-accent/30 bg-accent-muted/40 px-4 py-2 text-center text-xs text-ink-soft sm:text-sm">
        Sesión temporal de{" "}
        <span className="font-medium text-ink">{session.username}</span>
        {" · "}
        expira ~{new Date(session.expiresAt).toLocaleString()}
        {lastSync ? (
          <>
            {" · "}
            sync {lastSync.collection.count} juegos / {lastSync.plays.count}{" "}
            partidas ({(lastSync.durationMs / 1000).toFixed(0)}s)
          </>
        ) : null}
        {" · "}
        <button
          type="button"
          onClick={() => void handleLogout()}
          className="font-medium text-accent underline-offset-2 hover:underline"
        >
          Salir y borrar sesión
        </button>
      </div>
      <App mode="profile" />
    </div>
  );
}
