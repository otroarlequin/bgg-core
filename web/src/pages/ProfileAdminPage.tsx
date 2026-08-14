import { useCallback, useEffect, useState, type FormEvent } from "react";
import {
  ApiError,
  fetchProfileAdminSessions,
  killProfileAdminSession,
  type ProfileAdminSessionView,
} from "../api/client";

const ADMIN_PW_KEY = "bgg-profile-admin-pw";

function readStoredPassword(): string {
  try {
    return sessionStorage.getItem(ADMIN_PW_KEY) ?? "";
  } catch {
    return "";
  }
}

function storePassword(pw: string): void {
  try {
    sessionStorage.setItem(ADMIN_PW_KEY, pw);
  } catch {
    // ignore
  }
}

function clearStoredPassword(): void {
  try {
    sessionStorage.removeItem(ADMIN_PW_KEY);
  } catch {
    // ignore
  }
}

function formatBytes(n: number | null): string {
  if (n == null) return "—";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export function ProfileAdminPage() {
  const [password, setPassword] = useState(readStoredPassword);
  const [draft, setDraft] = useState("");
  const [sessions, setSessions] = useState<ProfileAdminSessionView[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [killing, setKilling] = useState<string | null>(null);

  const load = useCallback(async (pw: string) => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchProfileAdminSessions(pw);
      setSessions(result.sessions);
      storePassword(pw);
      setPassword(pw);
    } catch (err) {
      if (err instanceof ApiError && (err.status === 403 || err.status === 404)) {
        clearStoredPassword();
        setPassword("");
        setSessions([]);
        setError(
          err.status === 404
            ? "Admin no disponible (password no configurado en el servidor)."
            : "Password incorrecto.",
        );
      } else {
        setError(err instanceof Error ? err.message : "Error al listar");
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (password) void load(password);
  }, [password, load]);

  async function handleLogin(e: FormEvent) {
    e.preventDefault();
    const next = draft.trim();
    if (!next) {
      setError("Indica el password de admin.");
      return;
    }
    await load(next);
  }

  async function handleKill(id: string) {
    if (!password) return;
    if (!window.confirm(`¿Aniquilar sesión ${id.slice(0, 8)}…?`)) return;
    setKilling(id);
    setError(null);
    try {
      await killProfileAdminSession(password, id);
      await load(password);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo aniquilar");
    } finally {
      setKilling(null);
    }
  }

  if (!password) {
    return (
      <div className="min-h-screen bg-surface">
        <div className="mx-auto max-w-md px-4 py-16">
          <h1 className="text-2xl font-bold text-ink">Admin Profile</h1>
          <p className="mt-2 text-sm text-muted">
            Acceso restringido. No forma parte de la app pública.
          </p>
          <form
            onSubmit={(e) => void handleLogin(e)}
            className="mt-6 space-y-4 rounded-xl border border-border bg-surface-raised/50 p-5"
          >
            <div>
              <label
                htmlFor="admin-pw"
                className="block text-xs font-medium text-muted"
              >
                Password
              </label>
              <input
                id="admin-pw"
                type="password"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                autoComplete="current-password"
                className="mt-1 w-full rounded-lg border border-border bg-surface-card px-3 py-2 text-sm text-ink outline-none focus:border-accent"
              />
            </div>
            <button
              type="submit"
              disabled={loading || !draft.trim()}
              className="min-h-11 w-full rounded-lg bg-accent px-4 py-2 text-sm font-medium text-ink hover:bg-accent-hover disabled:opacity-50"
            >
              {loading ? "Entrando…" : "Entrar"}
            </button>
            {error ? <p className="text-sm text-red-400">{error}</p> : null}
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface">
      <div className="mx-auto max-w-5xl px-4 py-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-ink">Admin Profile</h1>
            <p className="mt-1 text-sm text-muted">
              {sessions.length} sesión{sessions.length === 1 ? "" : "es"} activa
              {sessions.length === 1 ? "" : "s"}
            </p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => void load(password)}
              disabled={loading}
              className="rounded-lg border border-border bg-surface-card px-3 py-2 text-sm text-ink hover:border-accent/50 disabled:opacity-50"
            >
              {loading ? "Cargando…" : "Refrescar"}
            </button>
            <button
              type="button"
              onClick={() => {
                clearStoredPassword();
                setPassword("");
                setSessions([]);
                setDraft("");
              }}
              className="rounded-lg border border-border px-3 py-2 text-sm text-muted hover:text-ink"
            >
              Cerrar
            </button>
          </div>
        </div>

        {error ? <p className="mt-4 text-sm text-red-400">{error}</p> : null}

        <div className="mt-6 overflow-x-auto rounded-xl border border-border">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-border bg-surface-raised text-xs text-muted">
              <tr>
                <th className="px-3 py-2 font-medium">Id</th>
                <th className="px-3 py-2 font-medium">User</th>
                <th className="px-3 py-2 font-medium">Acceso</th>
                <th className="px-3 py-2 font-medium">Expira</th>
                <th className="px-3 py-2 font-medium">Sync</th>
                <th className="px-3 py-2 font-medium">DB</th>
                <th className="px-3 py-2 font-medium" />
              </tr>
            </thead>
            <tbody>
              {sessions.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-3 py-6 text-center text-muted"
                  >
                    Sin sesiones
                  </td>
                </tr>
              ) : (
                sessions.map((s) => (
                  <tr
                    key={s.id}
                    className="border-b border-border/60 last:border-0"
                  >
                    <td className="px-3 py-2 font-mono text-xs text-ink-soft">
                      {s.idShort}
                    </td>
                    <td className="px-3 py-2 text-ink">{s.username}</td>
                    <td className="px-3 py-2 text-xs text-muted">
                      {new Date(s.lastAccessAt).toLocaleString()}
                    </td>
                    <td className="px-3 py-2 text-xs text-muted">
                      {new Date(s.expiresAt).toLocaleString()}
                    </td>
                    <td className="px-3 py-2 text-xs">
                      {s.lastSyncOk === true ? (
                        <span className="text-accent-secondary">OK</span>
                      ) : s.lastSyncOk === false ? (
                        <span
                          className="text-red-400"
                          title={s.lastSyncError ?? undefined}
                        >
                          Error
                        </span>
                      ) : (
                        <span className="text-muted-dim">—</span>
                      )}
                      {s.lastSyncError ? (
                        <p
                          className="mt-0.5 max-w-[12rem] truncate text-red-400/80"
                          title={s.lastSyncError}
                        >
                          {s.lastSyncError}
                        </p>
                      ) : null}
                    </td>
                    <td className="px-3 py-2 text-xs text-muted">
                      {formatBytes(s.dbBytes)}
                    </td>
                    <td className="px-3 py-2">
                      <button
                        type="button"
                        onClick={() => void handleKill(s.id)}
                        disabled={killing === s.id}
                        className="rounded border border-red-500/40 px-2 py-1 text-xs text-red-400 hover:bg-red-500/10 disabled:opacity-50"
                      >
                        {killing === s.id ? "…" : "Aniquilar"}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
