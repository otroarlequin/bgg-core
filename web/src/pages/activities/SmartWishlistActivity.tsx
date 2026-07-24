import { useEffect, useState } from "react";
import { fetchSmartWishlist } from "../../api/client";
import type {
  SmartWishlistMode,
  SmartWishlistResult,
  SmartWishlistSuggestion,
} from "../../api/types";
import { BggLink } from "../../components/BggLink";

function SuggestionRow({
  item,
  onAnalyze,
}: {
  item: SmartWishlistSuggestion;
  onAnalyze: (bggId: number) => void;
}) {
  return (
    <article className="rounded-xl border border-border bg-surface-raised/50 p-4">
      <div className="flex gap-3">
        {item.thumbnailUrl ? (
          <img
            src={item.thumbnailUrl}
            alt=""
            className="h-14 w-14 shrink-0 rounded-lg object-cover"
          />
        ) : (
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-surface-card text-xs text-muted">
            —
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="text-base font-semibold text-ink">{item.name}</h3>
            <span className="tabular-nums text-sm font-medium text-accent">
              {item.score}
            </span>
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted">
            {item.yearPublished ? <span>{item.yearPublished}</span> : null}
            {item.source === "discovery" ? (
              <span className="rounded bg-surface-card px-1.5 py-0.5 text-ink-soft">
                Nuevo para ti
              </span>
            ) : null}
            {item.wishlistPriority != null ? (
              <span>Prioridad wishlist {item.wishlistPriority}</span>
            ) : null}
          </div>
          <ul className="mt-3 space-y-1.5">
            {item.reasons.map((reason) => (
              <li key={`${item.bggId}-${reason.kind}-${reason.headline}`}>
                <p className="text-sm leading-snug text-ink">{reason.headline}</p>
                {reason.detail ? (
                  <p className="text-xs text-muted">{reason.detail}</p>
                ) : null}
              </li>
            ))}
          </ul>
          <div className="mt-3 flex flex-wrap gap-3 text-sm">
            <BggLink bggId={item.bggId} />
            <button
              type="button"
              onClick={() => onAnalyze(item.bggId)}
              className="text-accent hover:underline"
            >
              Analizar en validador
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}

export function SmartWishlistActivity() {
  const [mode, setMode] = useState<SmartWishlistMode>("balance");
  const [includeWantToPlay, setIncludeWantToPlay] = useState(true);
  const [includeExpansions, setIncludeExpansions] = useState(false);
  const [includeDiscovery, setIncludeDiscovery] = useState(true);
  const [data, setData] = useState<SmartWishlistResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [analyzeHint, setAnalyzeHint] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const result = await fetchSmartWishlist({
          mode,
          includeWantToPlay,
          includeExpansions,
          includeDiscovery,
        });
        if (!cancelled) setData(result);
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
  }, [mode, includeWantToPlay, includeExpansions, includeDiscovery]);

  function onAnalyze(bggId: number) {
    setAnalyzeHint(
      `Abre el Validador de compras e introduce el ID ${bggId} (o pégalo desde BGG).`,
    );
  }

  const gapChips = data?.gaps.filter((g) => g.kind !== "saturated").slice(0, 6) ?? [];

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-border bg-surface-raised/60 p-4">
        <h2 className="text-lg font-semibold text-ink">Wishlist inteligente</h2>
        <p className="mt-1 text-sm leading-relaxed text-muted">
          Prioriza lo que ya marcaste según cómo juegas, señala huecos de tu mesa y,
          si hay token BGG, sugiere unos pocos descubrimientos anclados a tu perfil.
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
          <label className="flex min-h-11 items-center gap-2 text-sm text-ink-soft md:min-h-0">
            <input
              type="checkbox"
              checked={includeDiscovery}
              onChange={(e) => setIncludeDiscovery(e.target.checked)}
              className="h-4 w-4 accent-[var(--color-accent)]"
            />
            Descubrimientos BGG
          </label>
        </div>
      </div>

      {error ? (
        <p className="rounded-xl border border-red-900 bg-red-950/40 p-4 text-red-200">
          {error}
        </p>
      ) : null}

      {analyzeHint ? (
        <p className="rounded-xl border border-border bg-surface-card/80 p-3 text-sm text-ink-soft">
          {analyzeHint}
        </p>
      ) : null}

      {loading ? (
        <p className="text-sm text-muted">
          {includeDiscovery
            ? "Calculando perfil y consultando BGG…"
            : "Calculando perfil…"}
        </p>
      ) : null}

      {!loading && data ? (
        <>
          <section className="space-y-3">
            <h3 className="text-base font-semibold text-ink">Tu mesa</h3>
            <p className="text-sm leading-relaxed text-ink-soft">
              {data.profile.summary}
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
            {gapChips.length > 0 ? (
              <div>
                <p className="mb-2 text-sm text-ink-soft">Huecos que detectamos</p>
                <div className="flex flex-wrap gap-2">
                  {gapChips.map((g) => (
                    <span
                      key={`${g.facet}-${g.value}`}
                      className="rounded-lg border border-border bg-surface-card px-2.5 py-1 text-xs text-ink"
                    >
                      {g.value}
                      <span className="ml-1 text-muted">
                        ({g.kind === "strong" ? "fuerte" : "suave"})
                      </span>
                    </span>
                  ))}
                </div>
              </div>
            ) : null}
          </section>

          <section className="space-y-3">
            <h3 className="text-base font-semibold text-ink">
              Prioridades en tu wishlist
            </h3>
            {data.localSuggestions.length === 0 ? (
              <p className="rounded-xl border border-border bg-surface-raised/40 p-4 text-sm text-muted">
                No hay wishlist ni want-to-play local (no owned). Marca juegos en
                colección o en el validador.
              </p>
            ) : (
              <div className="space-y-3">
                {data.localSuggestions.map((item) => (
                  <SuggestionRow
                    key={`local-${item.bggId}`}
                    item={item}
                    onAnalyze={onAnalyze}
                  />
                ))}
              </div>
            )}
          </section>

          <section className="space-y-3">
            <h3 className="text-base font-semibold text-ink">Descubrimientos</h3>
            {!data.discoveryStatus.available ? (
              <p className="rounded-xl border border-border bg-surface-raised/40 p-4 text-sm text-muted">
                {data.discoveryStatus.message ??
                  "Descubrimientos no disponibles ahora."}
              </p>
            ) : data.discoverySuggestions.length === 0 ? (
              <p className="rounded-xl border border-border bg-surface-raised/40 p-4 text-sm text-muted">
                {data.discoveryStatus.message ??
                  "No encontramos descubrimientos claros con tu perfil actual."}
              </p>
            ) : (
              <div className="space-y-3">
                {data.discoveryStatus.message ? (
                  <p className="text-xs text-muted">{data.discoveryStatus.message}</p>
                ) : null}
                {data.discoverySuggestions.map((item) => (
                  <SuggestionRow
                    key={`disc-${item.bggId}`}
                    item={item}
                    onAnalyze={onAnalyze}
                  />
                ))}
              </div>
            )}
          </section>
        </>
      ) : null}
    </div>
  );
}
