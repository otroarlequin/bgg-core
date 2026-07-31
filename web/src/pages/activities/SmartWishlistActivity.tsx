import { useEffect, useMemo, useState } from "react";
import { fetchSmartWishlist } from "../../api/client";
import type {
  SmartWishlistGap,
  SmartWishlistMode,
  SmartWishlistResult,
  SmartWishlistSuggestion,
} from "../../api/types";
import { AppModal } from "../../components/AppModal";
import { BggLink } from "../../components/BggLink";

function gapKey(gap: { facet: string; value: string }): string {
  return `${gap.facet}:${gap.value}`;
}

function SuggestionCard({
  item,
  onAnalyze,
}: {
  item: SmartWishlistSuggestion;
  onAnalyze: (item: SmartWishlistSuggestion) => void;
}) {
  const reasons = item.reasons.slice(0, 2);

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
            {item.wishlistPriority != null ? (
              <span>Prio {item.wishlistPriority}</span>
            ) : null}
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

export function SmartWishlistActivity({
  onOpenValidator,
}: {
  onOpenValidator: (bggId: number) => void;
}) {
  const [mode, setMode] = useState<SmartWishlistMode>("balance");
  const [includeWantToPlay, setIncludeWantToPlay] = useState(true);
  const [includeExpansions, setIncludeExpansions] = useState(false);
  const [data, setData] = useState<SmartWishlistResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [validatorModal, setValidatorModal] =
    useState<SmartWishlistSuggestion | null>(null);
  const [selectedGapKeys, setSelectedGapKeys] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      setData(null);
      setSelectedGapKeys([]);

      try {
        const result = await fetchSmartWishlist({
          mode,
          includeWantToPlay,
          includeExpansions,
        });
        if (cancelled) return;
        setData(result);
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
  }, [mode, includeWantToPlay, includeExpansions]);

  const filteredLocal = useMemo(() => {
    const items = data?.localSuggestions ?? [];
    if (selectedGapKeys.length === 0) return items;
    const selected = new Set(selectedGapKeys);
    return items.filter((item) => {
      const keys = [...(item.coveredGaps ?? []), ...(item.tasteFacets ?? [])];
      return keys.some((g) => selected.has(gapKey(g)));
    });
  }, [data?.localSuggestions, selectedGapKeys]);

  function toggleGap(gap: SmartWishlistGap) {
    const key = gapKey(gap);
    setSelectedGapKeys((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key],
    );
  }

  const mechanicGaps =
    data?.gaps.filter((g) => g.facet === "mechanic") ?? [];
  const designerGaps =
    data?.gaps.filter((g) => g.facet === "designer") ?? [];

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-border bg-surface-raised/60 p-4">
        <h2 className="text-lg font-semibold text-ink">Wishlist inteligente</h2>
        <p className="mt-1 text-sm leading-relaxed text-muted">
          Prioriza lo que ya marcaste según cómo juegas y filtra por huecos de tu
          mesa. Para descubrir juegos nuevos desde la hot list de BGG, usa Hotness
          scout.
        </p>

        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
          <label className="block text-sm text-ink-soft">
            Modo
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
              checked={includeWantToPlay}
              onChange={(e) => setIncludeWantToPlay(e.target.checked)}
              className="h-4 w-4 accent-[var(--color-accent)]"
            />
            Incluir want-to-play
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
        <p className="text-sm text-muted">Calculando perfil y prioridades…</p>
      ) : null}

      {!loading && data ? (
        <>
          <section className="space-y-3">
            <h3 className="text-base font-semibold text-ink">Tu mesa</h3>
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

            {data.gaps.length > 0 ? (
              <div className="space-y-2">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <div>
                    <p className="text-sm text-ink-soft">
                      Filtros para tu wishlist{" "}
                      <span className="text-muted">
                        (solo rasgos que aparecen en al menos un juego de la lista)
                      </span>
                    </p>
                    <p className="mt-0.5 text-xs text-muted">
                      Prioriza huecos de colección; si no hay solape, usa afinidades
                      presentes en tu wishlist.
                    </p>
                  </div>
                  {selectedGapKeys.length > 0 ? (
                    <button
                      type="button"
                      onClick={() => setSelectedGapKeys([])}
                      className="text-xs font-medium text-accent hover:underline"
                    >
                      Limpiar filtros
                    </button>
                  ) : null}
                </div>
                {mechanicGaps.length > 0 ? (
                  <div>
                    <p className="mb-1.5 text-xs uppercase tracking-wide text-muted-dim">
                      Mecánicas
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {mechanicGaps.map((g) => {
                        const active = selectedGapKeys.includes(gapKey(g));
                        return (
                          <button
                            key={gapKey(g)}
                            type="button"
                            onClick={() => toggleGap(g)}
                            className={`rounded-lg border px-2.5 py-1.5 text-xs transition ${
                              active
                                ? "border-accent bg-accent/15 text-accent"
                                : "border-border bg-surface-card text-ink hover:border-accent/40"
                            }`}
                          >
                            {g.value}
                            <span className="ml-1 text-muted">
                              ({g.kind === "strong" ? "fuerte" : "suave"})
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : null}
                {designerGaps.length > 0 ? (
                  <div>
                    <p className="mb-1.5 text-xs uppercase tracking-wide text-muted-dim">
                      Diseñadores
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {designerGaps.map((g) => {
                        const active = selectedGapKeys.includes(gapKey(g));
                        return (
                          <button
                            key={gapKey(g)}
                            type="button"
                            onClick={() => toggleGap(g)}
                            className={`rounded-lg border px-2.5 py-1.5 text-xs transition ${
                              active
                                ? "border-accent bg-accent/15 text-accent"
                                : "border-border bg-surface-card text-ink hover:border-accent/40"
                            }`}
                          >
                            {g.value}
                            <span className="ml-1 text-muted">
                              ({g.kind === "strong" ? "fuerte" : "suave"})
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : null}
              </div>
            ) : data.localSuggestions.length > 0 ? (
              <p className="text-sm text-muted">
                No hay huecos/afinidades compartidos entre tu perfil owned y esta
                wishlist (faltan facets de thing o poco solape).
              </p>
            ) : null}
          </section>

          <section className="space-y-3">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h3 className="text-base font-semibold text-ink">
                Prioridades en tu wishlist
              </h3>
              {data.localSuggestions.length > 0 ? (
                <p className="text-xs text-muted">
                  Mostrando {filteredLocal.length} de{" "}
                  {data.localSuggestions.length}
                </p>
              ) : null}
            </div>
            {data.localSuggestions.length === 0 ? (
              <p className="rounded-xl border border-border bg-surface-raised/40 p-4 text-sm text-muted">
                No hay wishlist ni want-to-play local (no owned). Marca juegos en
                colección o en el validador.
              </p>
            ) : filteredLocal.length === 0 ? (
              <p className="rounded-xl border border-border bg-surface-raised/40 p-4 text-sm text-muted">
                Ningún juego de tu wishlist cubre los huecos seleccionados.{" "}
                <button
                  type="button"
                  onClick={() => setSelectedGapKeys([])}
                  className="font-medium text-accent hover:underline"
                >
                  Limpiar filtros
                </button>
              </p>
            ) : (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {filteredLocal.map((item) => (
                  <SuggestionCard
                    key={`local-${item.bggId}`}
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
