import { useEffect, useState, type FormEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ApiError,
  fetchSettings,
  triggerSync,
  updateSettings,
} from "../api/client";
import { AppModal } from "../components/AppModal";
import { ThemeSelect } from "../components/ThemeSelect";
import type { AppMode } from "../appMode";

function sourceLabel(source: "db" | "env" | null): string {
  if (source === "db") return "guardado en la app";
  if (source === "env") return "variable de entorno / secret";
  return "sin configurar";
}

export function SettingsPage({ mode = "personal" }: { mode?: AppMode }) {
  const isProfile = mode === "profile";
  const queryClient = useQueryClient();
  const settingsQuery = useQuery({
    queryKey: ["settings"],
    queryFn: fetchSettings,
    enabled: !isProfile,
  });

  const [usernameDraft, setUsernameDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingUsername, setPendingUsername] = useState<string | null>(null);

  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  useEffect(() => {
    if (settingsQuery.data?.bggUsername != null) {
      setUsernameDraft(settingsQuery.data.bggUsername);
    } else if (settingsQuery.data && settingsQuery.data.bggUsername == null) {
      setUsernameDraft("");
    }
  }, [settingsQuery.data]);

  async function persistUsername(next: string, confirmReplace?: boolean) {
    setSaving(true);
    setSaveError(null);
    setSaveMessage(null);
    try {
      const result = await updateSettings({
        bggUsername: next,
        confirmReplace,
      });
      setConfirmOpen(false);
      setPendingUsername(null);
      await queryClient.invalidateQueries({ queryKey: ["settings"] });
      if (result.wiped) {
        setSaveMessage(
          `Usuario «${result.bggUsername}» guardado. Se borraron colección y partidas; sincroniza de nuevo.`,
        );
        await queryClient.invalidateQueries();
      } else {
        setSaveMessage(`Usuario «${result.bggUsername}» guardado.`);
      }
    } catch (err) {
      if (
        err instanceof ApiError &&
        err.status === 409 &&
        err.body &&
        typeof err.body === "object" &&
        "requiresConfirm" in err.body
      ) {
        setPendingUsername(next);
        setConfirmOpen(true);
        return;
      }
      setSaveError(err instanceof Error ? err.message : "No se pudo guardar");
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveUsername(e: FormEvent) {
    e.preventDefault();
    const next = usernameDraft.trim();
    if (!next) {
      setSaveError("El username no puede estar vacío.");
      return;
    }
    await persistUsername(next);
  }

  async function handleSync() {
    setSyncing(true);
    setSyncMessage(null);
    try {
      const result = await triggerSync();
      if (!result.ok) {
        setSyncMessage(result.message ?? "Sync falló");
        return;
      }
      const parts: string[] = [];
      if (result.username) parts.push(`@${result.username}`);
      if (result.collection) {
        parts.push(
          `colección ${result.collection.count} (${result.collection.incremental ? "incr." : "full"})`,
        );
      }
      if (result.plays) {
        parts.push(
          `partidas ${result.plays.count} (${result.plays.incremental ? "incr." : "full"})`,
        );
      }
      parts.push(`${(result.durationMs / 1000).toFixed(1)}s`);
      setSyncMessage(`Sync OK: ${parts.join(" · ")}`);
      await queryClient.invalidateQueries();
    } catch (err) {
      setSyncMessage(err instanceof Error ? err.message : "Error al sincronizar");
    } finally {
      setSyncing(false);
    }
  }

  const settings = settingsQuery.data;
  const current = settings?.bggUsername ?? null;
  const dirty =
    usernameDraft.trim().toLowerCase() !== (current ?? "").toLowerCase();

  if (isProfile) {
    return (
      <div className="space-y-6">
        <div className="rounded-xl border border-border bg-surface-raised/60 p-4">
          <h2 className="text-lg font-semibold text-ink">Configuración</h2>
          <p className="mt-1 text-sm text-muted">
            En perfil temporal solo puedes cambiar la apariencia. La sesión y el
            username se gestionan en la barra superior / Salir.
          </p>
        </div>
        <section className="rounded-xl border border-border bg-surface-raised/40 p-4">
          <h3 className="text-sm font-semibold text-ink">Apariencia</h3>
          <p className="mt-1 text-xs text-muted">
            Se guarda en este navegador (localStorage).
          </p>
          <div className="mt-4 max-w-xs">
            <ThemeSelect showLabel />
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-border bg-surface-raised/60 p-4">
        <h2 className="text-lg font-semibold text-ink">Configuración</h2>
        <p className="mt-1 text-sm text-muted">
          Cuenta BGG, sincronización y apariencia.
        </p>
      </div>

      <section className="rounded-xl border border-border bg-surface-raised/40 p-4">
        <h3 className="text-sm font-semibold text-ink">Cuenta BGG</h3>
        <p className="mt-1 text-xs text-muted">
          Username usado al sincronizar. Se guarda en la base de datos y tiene
          prioridad sobre <code className="text-ink-soft">BGG_USERNAME</code> del
          entorno. Si cambias de usuario y ya hay datos, se borran colección y
          partidas (se conservan duels y reviews).
        </p>

        {settingsQuery.isLoading ? (
          <p className="mt-4 text-sm text-muted">Cargando…</p>
        ) : settingsQuery.isError ? (
          <p className="mt-4 text-sm text-red-400">
            {settingsQuery.error instanceof Error
              ? settingsQuery.error.message
              : "No se pudieron cargar los ajustes"}
          </p>
        ) : (
          <form className="mt-4 space-y-3" onSubmit={(e) => void handleSaveUsername(e)}>
            <div>
              <label
                htmlFor="bgg-username"
                className="block text-xs font-medium text-muted"
              >
                Username BGG
              </label>
              <input
                id="bgg-username"
                name="bggUsername"
                value={usernameDraft}
                onChange={(e) => setUsernameDraft(e.target.value)}
                autoComplete="username"
                spellCheck={false}
                className="mt-1 w-full max-w-sm rounded-lg border border-border bg-surface-card px-3 py-2 text-sm text-ink outline-none focus:border-accent"
                placeholder="tu-usuario-bgg"
              />
              <p className="mt-1 text-xs text-muted-dim">
                Actual:{" "}
                {current ? (
                  <>
                    <span className="text-ink-soft">{current}</span> (
                    {sourceLabel(settings?.bggUsernameSource ?? null)})
                  </>
                ) : (
                  <span className="text-ink-soft">sin configurar</span>
                )}
              </p>
            </div>
            <button
              type="submit"
              disabled={saving || !dirty || !usernameDraft.trim()}
              className="min-h-11 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-ink hover:bg-accent-hover disabled:opacity-50 md:min-h-0"
            >
              {saving ? "Guardando…" : "Guardar username"}
            </button>
            {saveMessage ? (
              <p className="text-sm text-accent-secondary">{saveMessage}</p>
            ) : null}
            {saveError ? (
              <p className="text-sm text-red-400">{saveError}</p>
            ) : null}
          </form>
        )}
      </section>

      <section className="rounded-xl border border-border bg-surface-raised/40 p-4">
        <h3 className="text-sm font-semibold text-ink">Sincronización</h3>
        <p className="mt-1 text-xs text-muted">
          Descarga colección y partidas desde BGG hacia esta instancia (incremental).
          No toca duels ni purchase reviews.
        </p>
        <div className="mt-4 flex flex-col items-start gap-2">
          <button
            type="button"
            onClick={() => void handleSync()}
            disabled={syncing || !current}
            className="min-h-11 rounded-lg border border-border bg-surface-card px-4 py-2 text-sm font-medium text-accent hover:border-accent/50 hover:bg-surface disabled:opacity-50 md:min-h-0"
          >
            {syncing ? "Sincronizando…" : "Sincronizar con BGG"}
          </button>
          {!current ? (
            <p className="text-xs text-muted">
              Configura un username arriba antes de sincronizar.
            </p>
          ) : null}
          {syncMessage ? (
            <p className="max-w-xl text-sm text-muted">{syncMessage}</p>
          ) : null}
        </div>
      </section>

      <section className="rounded-xl border border-border bg-surface-raised/40 p-4">
        <h3 className="text-sm font-semibold text-ink">Apariencia</h3>
        <p className="mt-1 text-xs text-muted">
          Elige la paleta de la app. Ónix y Grafito son neutros; Cartón es la
          paleta cálida original. Se guarda en este navegador.
        </p>
        <div className="mt-4 max-w-xs">
          <ThemeSelect showLabel />
        </div>
      </section>

      <AppModal
        open={confirmOpen}
        title="Cambiar usuario BGG"
        onClose={() => {
          if (saving) return;
          setConfirmOpen(false);
          setPendingUsername(null);
        }}
        primaryAction={{
          label: saving ? "Confirmando…" : "Borrar y cambiar",
          onClick: () => {
            if (!pendingUsername || saving) return;
            void persistUsername(pendingUsername, true);
          },
        }}
        secondaryAction={{
          label: "Cancelar",
          onClick: () => {
            if (saving) return;
            setConfirmOpen(false);
            setPendingUsername(null);
          },
        }}
      >
        <p>
          Vas a cambiar de{" "}
          <span className="font-medium text-ink">
            {current ?? "—"}
          </span>{" "}
          a{" "}
          <span className="font-medium text-ink">{pendingUsername}</span>.
        </p>
        <p>
          Se borrarán la colección y las partidas sincronizadas (y el estado de
          sync). Se conservan duels y purchase reviews. El cache de juegos no se
          elimina.
        </p>
        <p>Después tendrás que sincronizar de nuevo con el usuario nuevo.</p>
      </AppModal>
    </div>
  );
}
