import { useEffect, useState } from "react";
import { fetchHotnessScout } from "../../api/client";
import type {
  HotnessScoutResult,
  SmartWishlistMode,
  SmartWishlistSuggestion,
} from "../../api/types";
import { AppModal } from "../../components/AppModal";
import { BggLink } from "../../components/BggLink";

function SuggestionCard({
  item,
  onAnalyze,
}: {
  item: SmartWishlistSuggestion;
  onAnalyze: (item: SmartWishlistSuggestion) => void;
}) {
  const reasons = item.reasons.slice(0, 3);

  return (
    <article className="flex h-full flex-col rounded-xl border border-border bg-surface-raised/50 p-3">
      <div className="flex gap-2.5">
        {item.thumbnailUrl ? (
          <img
            src={item.thumbnailUrl}
            alt=""
            className="h-12 w-12 shrink-0 rounded-lg object-cover"
          />
        ) : (
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-surface-card text-xs text-muted">
            —
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h3 className="text-sm font-semibold leading-snug text-ink">
              {item.name}
            </h3>
            <span className="shrink-0 tabular-nums text-sm font-medium text-accent">
              {item.score}
            </span>
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-muted">
            {item.yearPublished ? <span>{item.yearPublished}</span> : null}
            {item.discoverySeed ? (
              <span className="rounded bg-surface-card px-1.5 py-0.5 text-ink-soft">
                {item.discoverySeed}
              </span>
            ) : (
              <span className="rounded bg-surface-card px-1.5 py-0.5 text-ink-soft">
                Hot list
              </span>
            )}
          </div>
        </div>
      </div>

      {reasons.length > 0 ? (
        <ul className="mt-2.5 flex-1 space-y-1">
          {reasons.map((reason) => (
            <li key={`${item.bggId}-${reason.kind}-${reason.headline}`}>
              <p className="text-xs leading-snug text-ink">{reason.headline}</p>
            </li>
          ))}
        </ul>
      ) : (
        <div className="flex-1" />
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <BggLink bggId={item.bggId} />
        <button
          type="button"
          onClick={() => onAnalyze(item)}
          className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium text-accent hover:border-accent/50 hover:bg-surface-card md:min-h-0"
        >
          <svg
            viewBox="0 0 24 24"
            className="h-3.5 w-3.5 shrink-0"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            aria-hidden
          >
            <path
              d="M9 6h10v12H9zM5 9h4M5 15h4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path d="M14 10l3 2-3 2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Analizar en validador
        </button>
      </div>
    </article>
  );
}

export function HotnessScoutActivity({
  onOpenValidator,
}: {
  onOpenValidator: (bggId: number) => void;
}) {
  const [mode, setMode] = useState<SmartWishlistMode>("balance");
  const [includeExpansions, setIncludeExpansions] = useState(false);
  const [data, setData] = useState<HotnessScoutResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [validatorModal, setValidatorModal] =
    useState<SmartWishlistSuggestion | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      setData(null);

      try {
        const result = await fetchHotnessScout({ mode, includeExpansions });
        if (cancelled) return;
        setData(result);
        if (!result.status.ok && result.status.message) {
          setError(result.status.message);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Error al cargar");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [mode, includeExpansions]);

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-border bg-surface-raised/60 p-4">
        <h2 className="text-lg font-semibold text-ink">Hotness scout</h2>
        <p className="mt-1 text-sm leading-relaxed text-muted">
          Toma la hot list de BGG, excluye lo que ya tienes owned y puntúa el resto
          contra el perfil de tu colección (mecánicas, diseñadores, categorías).
          Así ves si lo que está de moda encaja con tu mesa.
        </p>

        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
          <label className="block text-sm text-ink-soft">
            Modo de score
            <select
              value={mode}
              onChange={(e) => setMode(e.target.value as SmartWishlistMode)}
              className="mt-1 block min-h-11 w-full rounded-lg border border-border bg-surface-card px-3 py-2 text-ink sm:min-w-[12rem] md:min-h-0"
            >
              <option value="balance">Equilibrio</option>
              <option value="more">Más de lo mismo</option>
              <option value="gaps">Cubre huecos</option>
            </select>
          </label>
          <label className="flex min-h-11 items-center gap-2 text-sm text-ink-soft md:min-h-0">
            <input
              type="checkbox"
              checked={includeExpansions}
              onChange={(e) => setIncludeExpansions(e.target.checked)}
              className="h-4 w-4 accent-[var(--color-accent)]"
            />
            Incluir expansiones
          </label>
        </div>
      </div>

      {error ? (
        <p className="rounded-xl border border-red-900 bg-red-950/40 p-4 text-red-200">
          {error}
        </p>
      ) : null}

      {loading ? (
        <p className="text-sm text-muted">
          Leyendo hot list de BGG y comparando con tu colección…
        </p>
      ) : null}

      {!loading && data?.status.ok ? (
        <>
          <section className="space-y-2">
            <h3 className="text-base font-semibold text-ink">Tu mesa (owned)</h3>
            <p className="text-sm text-muted">
              {data.profile.ownedCount} owned · hot list {data.hotRankTotal} ·
              omitidos por owned {data.alreadyOwnedSkipped} · fetched{" "}
              {data.candidatesFetched}
            </p>
            {data.profile.topMechanics.length > 0 ? (
              <p className="text-sm text-muted">
                Mecánicas:{" "}
                {data.profile.topMechanics.map((m) => m.value).join(" · ")}
              </p>
            ) : null}
            {data.profile.topDesigners.length > 0 ? (
              <p className="text-sm text-muted">
                Diseñadores:{" "}
                {data.profile.topDesigners.map((d) => d.value).join(" · ")}
              </p>
            ) : null}
          </section>

          <section className="space-y-3">
            <h3 className="text-base font-semibold text-ink">
              Candidatos hot vs tu colección
            </h3>
            {data.suggestions.length === 0 ? (
              <p className="rounded-xl border border-border bg-surface-raised/40 p-4 text-sm text-muted">
                {data.status.message ??
                  "No hay candidatos puntuables. Prueba otro modo o sync de things."}
              </p>
            ) : (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {data.suggestions.map((item) => (
                  <SuggestionCard
                    key={`hot-${item.bggId}`}
                    item={item}
                    onAnalyze={setValidatorModal}
                  />
                ))}
              </div>
            )}
          </section>
        </>
      ) : null}

      <AppModal
        open={validatorModal != null}
        title="Abrir en el validador"
        onClose={() => setValidatorModal(null)}
        primaryAction={
          validatorModal
            ? {
                label: "Ir al validador",
                onClick: () => {
                  const id = validatorModal.bggId;
                  setValidatorModal(null);
                  onOpenValidator(id);
                },
              }
            : undefined
        }
      >
        {validatorModal ? (
          <>
            <div className="flex gap-3 rounded-xl border border-border bg-surface-card/80 p-3">
              {validatorModal.thumbnailUrl ? (
                <img
                  src={validatorModal.thumbnailUrl}
                  alt=""
                  className="h-16 w-16 shrink-0 rounded-lg object-cover"
                />
              ) : (
                <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg bg-surface-raised text-xs text-muted">
                  —
                </div>
              )}
              <div className="min-w-0">
                <p className="font-semibold text-ink">{validatorModal.name}</p>
                <p className="mt-1 text-xs text-muted">
                  {[
                    validatorModal.yearPublished,
                    `BGG #${validatorModal.bggId}`,
                    `Score ${validatorModal.score}`,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </div>
            </div>
            <p>
              Se abrirá el validador de compras con este juego ya seleccionado para
              compararlo con tu colección.
            </p>
          </>
        ) : null}
      </AppModal>
    </div>
  );
}
