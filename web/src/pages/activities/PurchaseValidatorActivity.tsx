import { useState } from "react";
import { postPurchaseValidator } from "../../api/client";
import type {
  BggSearchHit,
  CandidateGameView,
  FacetMatchesResult,
  MatchFacet,
  MatchGameRow,
  PurchaseAnalysis,
  PurchaseDecision,
} from "../../api/types";
import { BggLink } from "../../components/BggLink";
import { GameSubtypeBadge } from "../../components/GameSubtypeBadge";

type Step = "input" | "search" | "analysis";

const FACET_LABELS: Record<MatchFacet, string> = {
  designer: "Diseñador",
  artist: "Artista",
  publisher: "Publisher",
  mechanic: "Mecánica",
  category: "Categoría",
  languageDependence: "Idioma",
};

function StatusBadges({
  own,
  wishlist,
  preordered,
}: {
  own: boolean;
  wishlist: boolean;
  preordered: boolean;
}) {
  return (
    <div className="flex flex-wrap gap-1">
      {own ? (
        <span className="rounded bg-accent-secondary/20 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-accent-secondary">
          Owned
        </span>
      ) : null}
      {wishlist ? (
        <span className="rounded bg-accent/20 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-accent">
          Wishlist
        </span>
      ) : null}
      {preordered ? (
        <span className="rounded bg-muted-dim/25 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-ink-soft">
          Preordered
        </span>
      ) : null}
    </div>
  );
}

function Chip({
  label,
  active,
  onClick,
}: {
  label: string;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`min-h-10 rounded-lg border px-3 py-2 text-left text-xs transition md:min-h-0 md:px-2 md:py-1 ${
        active
          ? "border-accent bg-accent/15 text-accent"
          : "border-border bg-surface/60 text-ink-soft hover:border-accent/50 hover:text-ink"
      }`}
    >
      {label}
    </button>
  );
}

function ChipGroup({
  title,
  facet,
  values,
  active,
  onSelect,
}: {
  title: string;
  facet: MatchFacet;
  values: string[];
  active: { facet: MatchFacet; value: string } | null;
  onSelect: (facet: MatchFacet, value: string) => void;
}) {
  if (values.length === 0) return null;
  return (
    <div>
      <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-dim">
        {title}
      </p>
      <div className="flex flex-wrap gap-1.5">
        {values.map((value) => (
          <Chip
            key={`${facet}-${value}`}
            label={value}
            active={active?.facet === facet && active.value === value}
            onClick={() => onSelect(facet, value)}
          />
        ))}
      </div>
    </div>
  );
}

function MatchesTable({ items }: { items: MatchGameRow[] }) {
  if (items.length === 0) {
    return (
      <p className="rounded-xl border border-border bg-surface-raised/40 p-4 text-sm text-muted-dim">
        No hay juegos en tu colección con este valor.
      </p>
    );
  }

  const showSim = items.some((i) => i.similarity != null);

  return (
    <>
      <ul className="space-y-2 md:hidden">
        {items.map((item) => (
          <li
            key={item.bggId}
            className="rounded-xl border border-border bg-surface/40 p-3"
          >
            <div className="flex gap-3">
              <div className="relative shrink-0">
                <img
                  src={
                    item.thumbnailUrl ??
                    "https://placehold.co/40x40/2a241c/a89880?text=BGG"
                  }
                  alt=""
                  className="h-14 w-14 rounded-lg object-cover bg-surface-card"
                />
                <div className="absolute -bottom-1 -right-1">
                  <GameSubtypeBadge subtype={item.subtype} size="sm" />
                </div>
              </div>
              <div className="min-w-0 flex-1 space-y-1.5">
                <div className="flex items-start gap-2">
                  <p className="min-w-0 flex-1 font-medium leading-snug text-ink">
                    {item.name}
                  </p>
                  <BggLink bggId={item.bggId} />
                </div>
                <StatusBadges
                  own={item.own}
                  wishlist={item.wishlist}
                  preordered={item.preordered}
                />
                <p className="text-xs text-muted">
                  ★ {item.personalRating != null ? item.personalRating : "—"}
                  {" · "}
                  {item.numPlays} partidas
                  {" · "}
                  peso {item.weight != null ? item.weight.toFixed(1) : "—"}
                  {showSim && item.similarity != null
                    ? ` · sim ${Math.round(item.similarity * 100)}%`
                    : ""}
                </p>
              </div>
            </div>
          </li>
        ))}
      </ul>

      <div className="hidden overflow-hidden rounded-xl border border-border md:block">
        <table className="min-w-full text-sm">
          <thead className="bg-surface-raised text-left text-muted">
            <tr>
              <th className="px-3 py-2">Juego</th>
              <th className="px-3 py-2">Estado</th>
              <th className="px-3 py-2">Rating</th>
              <th className="px-3 py-2">Partidas</th>
              <th className="px-3 py-2">Peso</th>
              {showSim ? <th className="px-3 py-2">Sim.</th> : null}
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr
                key={item.bggId}
                className="border-t border-border bg-surface/40"
              >
                <td className="px-3 py-2">
                  <div className="flex items-center gap-2">
                    <div className="relative shrink-0">
                      <img
                        src={
                          item.thumbnailUrl ??
                          "https://placehold.co/40x40/2a241c/a89880?text=BGG"
                        }
                        alt=""
                        className="h-9 w-9 rounded object-cover bg-surface-card"
                      />
                      <div className="absolute -bottom-1 -right-1">
                        <GameSubtypeBadge subtype={item.subtype} size="sm" />
                      </div>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start gap-2">
                        <p className="min-w-0 truncate font-medium text-ink">
                          {item.name}
                        </p>
                        <BggLink bggId={item.bggId} />
                      </div>
                    </div>
                  </div>
                </td>
                <td className="px-3 py-2">
                  <StatusBadges
                    own={item.own}
                    wishlist={item.wishlist}
                    preordered={item.preordered}
                  />
                </td>
                <td className="px-3 py-2 tabular-nums text-ink-soft">
                  {item.personalRating != null ? item.personalRating : "—"}
                </td>
                <td className="px-3 py-2 tabular-nums text-ink-soft">
                  {item.numPlays}
                </td>
                <td className="px-3 py-2 tabular-nums text-ink-soft">
                  {item.weight != null ? item.weight.toFixed(1) : "—"}
                </td>
                {showSim ? (
                  <td className="px-3 py-2 tabular-nums text-accent">
                    {item.similarity != null
                      ? `${Math.round(item.similarity * 100)}%`
                      : "—"}
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function CandidatePanel({
  candidate,
  active,
  onSelect,
}: {
  candidate: CandidateGameView;
  active: { facet: MatchFacet; value: string } | null;
  onSelect: (facet: MatchFacet, value: string) => void;
}) {
  const players =
    candidate.minPlayers != null || candidate.maxPlayers != null
      ? `${candidate.minPlayers ?? "?"}-${candidate.maxPlayers ?? "?"} jugadores`
      : null;
  const time =
    candidate.playingTime != null
      ? `${candidate.playingTime} min`
      : candidate.minPlayTime != null || candidate.maxPlayTime != null
        ? `${candidate.minPlayTime ?? "?"}-${candidate.maxPlayTime ?? "?"} min`
        : null;

  return (
    <div className="rounded-2xl border border-border bg-surface-raised/80 p-4">
      <div className="grid gap-5 lg:grid-cols-2 lg:items-stretch">
        <div className="flex min-h-0 min-w-0 flex-col gap-3">
          <div className="flex gap-3">
            <div className="relative shrink-0">
              <img
                src={
                  candidate.imageUrl ??
                  candidate.thumbnailUrl ??
                  "https://placehold.co/120x120/2a241c/a89880?text=BGG"
                }
                alt={candidate.name}
                className="h-24 w-24 rounded-lg object-cover bg-surface-card"
              />
              {candidate.subtype ? (
                <div className="absolute -left-1.5 -top-1.5">
                  <GameSubtypeBadge subtype={candidate.subtype} size="sm" />
                </div>
              ) : null}
            </div>
            <div className="min-w-0 flex-1 space-y-1.5">
              <div className="flex items-start justify-between gap-2">
                <h3 className="text-xl font-bold leading-snug text-ink">
                  {candidate.name}
                </h3>
                <BggLink bggId={candidate.bggId} />
              </div>
              <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-ink-soft">
                {candidate.yearPublished != null ? (
                  <span>{candidate.yearPublished}</span>
                ) : null}
                {players ? <span>{players}</span> : null}
                {time ? <span>{time}</span> : null}
                {candidate.weight != null ? (
                  <span>peso {candidate.weight.toFixed(2)}</span>
                ) : null}
                {candidate.bggRating != null ? (
                  <span>BGG {candidate.bggRating.toFixed(2)}</span>
                ) : null}
                {candidate.bggRank != null ? (
                  <span>rank #{candidate.bggRank}</span>
                ) : null}
                {candidate.personalRating != null ? (
                  <span>★ {candidate.personalRating}</span>
                ) : null}
              </div>
              {candidate.collectionStatus ? (
                <StatusBadges
                  own={candidate.collectionStatus.own}
                  wishlist={candidate.collectionStatus.wishlist}
                  preordered={candidate.collectionStatus.preordered}
                />
              ) : null}
            </div>
          </div>
          {candidate.description ? (
            <div className="min-h-[14rem] flex-1 overflow-y-auto rounded-lg border border-border/60 bg-surface/40 p-3 lg:min-h-0">
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted">
                {candidate.description}
              </p>
            </div>
          ) : (
            <p className="text-sm text-muted-dim">Sin descripción disponible.</p>
          )}
        </div>

        <div className="min-w-0 space-y-3 border-t border-border pt-4 lg:border-l lg:border-t-0 lg:pl-5 lg:pt-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-dim">
            Atributos para validar
          </p>
          <ChipGroup
            title="Diseñadores"
            facet="designer"
            values={candidate.designers}
            active={active}
            onSelect={onSelect}
          />
          <ChipGroup
            title="Artistas"
            facet="artist"
            values={candidate.artists}
            active={active}
            onSelect={onSelect}
          />
          <ChipGroup
            title="Publishers"
            facet="publisher"
            values={candidate.publishers}
            active={active}
            onSelect={onSelect}
          />
          <ChipGroup
            title="Mecánicas"
            facet="mechanic"
            values={candidate.mechanics}
            active={active}
            onSelect={onSelect}
          />
          <ChipGroup
            title="Categorías"
            facet="category"
            values={candidate.categories}
            active={active}
            onSelect={onSelect}
          />
          {candidate.languageDependence ? (
            <ChipGroup
              title="Dependencia del idioma"
              facet="languageDependence"
              values={[candidate.languageDependence]}
              active={active}
              onSelect={onSelect}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}

export function PurchaseValidatorActivity() {
  const [step, setStep] = useState<Step>("input");
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchResults, setSearchResults] = useState<BggSearchHit[]>([]);
  const [analysis, setAnalysis] = useState<PurchaseAnalysis | null>(null);
  const [activeFacet, setActiveFacet] = useState<{
    facet: MatchFacet;
    value: string;
  } | null>(null);
  const [matches, setMatches] = useState<FacetMatchesResult | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [notes, setNotes] = useState("");
  const [decision, setDecision] = useState<PurchaseDecision>("sin_decision");
  const [wishlistPriority, setWishlistPriority] = useState(3);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  async function analyzeBggId(bggId: number, options?: { keepStatus?: boolean }) {
    setLoading(true);
    setError(null);
    if (!options?.keepStatus) setStatusMessage(null);
    try {
      const result = await postPurchaseValidator({ action: "analyze", bggId });
      if (!result.analysis) {
        throw new Error(result.message || "No se pudo analizar");
      }
      setAnalysis(result.analysis);
      setStep("analysis");
      setActiveFacet(null);
      setMatches(null);
      setShowAll(false);
      if (!options?.keepStatus) {
        setNotes("");
        setDecision("sin_decision");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al analizar");
    } finally {
      setLoading(false);
    }
  }

  async function handleResolve() {
    setLoading(true);
    setError(null);
    setStatusMessage(null);
    try {
      const result = await postPurchaseValidator({
        action: "resolve",
        input,
      });
      if (
        result.bggId != null &&
        (!result.searchResults || result.searchResults.length <= 1)
      ) {
        // analyzeBggId manages its own loading state
        setLoading(false);
        await analyzeBggId(result.bggId);
        return;
      }
      if (result.searchResults && result.searchResults.length > 0) {
        setSearchResults(result.searchResults);
        setStep("search");
        return;
      }
      setError(result.message || "Sin resultados");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al buscar");
    } finally {
      setLoading(false);
    }
  }

  async function handleFacet(facet: MatchFacet, value: string, all = false) {
    if (!analysis) return;
    setActiveFacet({ facet, value });
    setShowAll(all);
    setLoading(true);
    setError(null);
    try {
      const result = await postPurchaseValidator({
        action: "matches",
        bggId: analysis.candidate.bggId,
        facet,
        value,
        all,
      });
      setMatches(result.matches ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al filtrar");
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    if (!analysis) return;
    setLoading(true);
    setError(null);
    try {
      const result = await postPurchaseValidator({
        action: "save",
        bggId: analysis.candidate.bggId,
        notes: notes || undefined,
        decision,
        overlapScore: analysis.overlap.top10MeanPercent,
        snapshot: analysis,
      });
      setStatusMessage(result.message);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al guardar");
    } finally {
      setLoading(false);
    }
  }

  async function handleWishlist() {
    if (!analysis) return;
    setLoading(true);
    setError(null);
    try {
      const result = await postPurchaseValidator({
        action: "wishlist",
        bggId: analysis.candidate.bggId,
        wishlistPriority,
        notes: notes || undefined,
      });
      setStatusMessage(result.message);
      await analyzeBggId(analysis.candidate.bggId, { keepStatus: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error en wishlist");
    } finally {
      setLoading(false);
    }
  }

  function handleReset() {
    setStep("input");
    setAnalysis(null);
    setSearchResults([]);
    setActiveFacet(null);
    setMatches(null);
    setError(null);
    setStatusMessage(null);
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-border bg-surface-raised/60 p-4">
        <h2 className="text-lg font-semibold text-ink">Validador de compras</h2>
        <p className="mt-1 text-sm text-muted">
          Pega una URL/ID de BGG o busca por nombre. Compara atributos con tu
          colección (owned, wishlist y preordered).
        </p>
      </div>

      {step === "input" || step === "search" ? (
        <div className="rounded-xl border border-border bg-surface-raised/60 p-4">
          <label className="text-sm">
            <span className="mb-1 block text-muted">
              Nombre, URL o ID de BGG
            </span>
            <input
              type="text"
              className="w-full rounded-lg border border-border bg-surface px-3 py-2"
              placeholder="https://boardgamegeek.com/boardgame/13/catan"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void handleResolve();
              }}
            />
          </label>
          <button
            type="button"
            disabled={loading || !input.trim()}
            onClick={() => void handleResolve()}
            className="mt-4 min-h-11 rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-surface hover:bg-accent-hover disabled:opacity-50 md:min-h-0 md:py-2"
          >
            {loading ? "Buscando..." : "Analizar"}
          </button>
        </div>
      ) : null}

      {step === "search" ? (
        <div className="space-y-2">
          <p className="text-sm text-muted">Elige un resultado:</p>
          <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border">
            {searchResults.map((hit) => (
              <li key={hit.bggId}>
                <div className="flex items-center gap-2 bg-surface/40 px-4 py-3 hover:bg-surface-raised/60">
                  <GameSubtypeBadge subtype={hit.type} size="sm" />
                  <button
                    type="button"
                    disabled={loading}
                    onClick={() => void analyzeBggId(hit.bggId)}
                    className="flex min-w-0 flex-1 items-center justify-between gap-3 text-left"
                  >
                    <span className="font-medium text-ink">{hit.name}</span>
                    <span className="shrink-0 text-xs text-muted-dim">
                      {hit.yearPublished ?? "—"} · #{hit.bggId}
                    </span>
                  </button>
                  <BggLink bggId={hit.bggId} />
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {error ? (
        <p className="rounded-xl border border-red-900 bg-red-950/40 p-4 text-red-200">
          {error}
        </p>
      ) : null}

      {statusMessage ? (
        <p className="rounded-xl border border-accent-secondary-muted/50 bg-accent-secondary/15 p-3 text-sm text-accent-secondary">
          {statusMessage}
        </p>
      ) : null}

      {step === "analysis" && analysis ? (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <button
              type="button"
              onClick={handleReset}
              className="rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-surface-card"
            >
              Nuevo análisis
            </button>
          </div>

          {analysis.alreadyInCollection ? (
            <div className="rounded-xl border border-accent-muted/60 bg-accent/15 p-4 text-ink">
              <p className="font-semibold text-accent">Este juego ya está en tu colección</p>
              <p className="mt-1 text-sm text-muted">
                Puedes seguir explorando overlaps y atributos, pero ya forma parte
                de owned, wishlist o preordered.
              </p>
            </div>
          ) : null}

          <CandidatePanel
            candidate={analysis.candidate}
            active={activeFacet}
            onSelect={(facet, value) => void handleFacet(facet, value, false)}
          />

          {activeFacet ? (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-lg font-semibold text-ink">
                  {FACET_LABELS[activeFacet.facet]}:{" "}
                  <span className="text-accent">{activeFacet.value}</span>
                </h3>
                {matches && matches.total > 10 ? (
                  <button
                    type="button"
                    disabled={loading}
                    onClick={() =>
                      void handleFacet(
                        activeFacet.facet,
                        activeFacet.value,
                        !showAll,
                      )
                    }
                    className="rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-surface-card"
                  >
                    {showAll ? "Ver top 10" : `Ver todos (${matches.total})`}
                  </button>
                ) : null}
              </div>
              {matches ? (
                <p className="text-sm text-muted">
                  {matches.total} en colección · mostrando {matches.items.length}
                </p>
              ) : null}
              {matches ? <MatchesTable items={matches.items} /> : null}
            </div>
          ) : (
            <p className="text-sm text-muted-dim">
              Haz click en un diseñador, mecánica u otro atributo para ver
              coincidencias en tu colección.
            </p>
          )}

          <div className="rounded-xl border border-border bg-surface-raised/60 p-4">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-dim">
              Overlap con tu ludoteca
            </h3>
            <p className="mt-2 text-3xl font-bold text-accent">
              {analysis.overlap.top10MeanPercent}%
            </p>
            <p className="mt-1 text-sm text-muted">{analysis.overlap.hint}</p>
            {analysis.overlap.topSimilar.length > 0 ? (
              <div className="mt-4">
                <p className="mb-2 text-sm text-muted">
                  Top juegos más similares
                </p>
                <MatchesTable items={analysis.overlap.topSimilar} />
              </div>
            ) : null}
          </div>

          <div className="grid gap-4 rounded-xl border border-border bg-surface-raised/60 p-4 lg:grid-cols-2">
            <div className="space-y-3">
              <h3 className="font-semibold text-ink">Guardar análisis (opcional)</h3>
              <label className="block text-sm">
                <span className="mb-1 block text-muted">Decisión</span>
                <select
                  className="w-full rounded-lg border border-border bg-surface px-3 py-2"
                  value={decision}
                  onChange={(e) =>
                    setDecision(e.target.value as PurchaseDecision)
                  }
                >
                  <option value="sin_decision">Sin decisión</option>
                  <option value="interesado">Interesado</option>
                  <option value="esperar">Esperar</option>
                  <option value="descartar">Descartar</option>
                </select>
              </label>
              <label className="block text-sm">
                <span className="mb-1 block text-muted">Notas</span>
                <textarea
                  className="min-h-24 w-full rounded-lg border border-border bg-surface px-3 py-2"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Opcional (también se usan como comment de wishlist local)"
                />
              </label>
              <button
                type="button"
                disabled={loading}
                onClick={() => void handleSave()}
                className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-surface hover:bg-accent-hover disabled:opacity-50"
              >
                Guardar
              </button>
            </div>

            <div className="space-y-3">
              <h3 className="font-semibold text-ink">Wishlist local (opcional)</h3>
              <p className="text-xs text-muted-dim">
                Solo actualiza tu base local. No escribe en BoardGameGeek.
              </p>
              <label className="block text-sm">
                <span className="mb-1 block text-muted">
                  Prioridad de deseo (1–5)
                </span>
                <select
                  className="w-full rounded-lg border border-border bg-surface px-3 py-2"
                  value={wishlistPriority}
                  onChange={(e) => setWishlistPriority(Number(e.target.value))}
                >
                  <option value={1}>1 — Must have</option>
                  <option value={2}>2 — Love to have</option>
                  <option value={3}>3 — Like to have</option>
                  <option value={4}>4 — Thinking about it</option>
                  <option value={5}>5 — Don&apos;t buy this</option>
                </select>
              </label>
              <button
                type="button"
                disabled={loading}
                onClick={() => void handleWishlist()}
                className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-ink hover:bg-surface-card disabled:opacity-50"
              >
                Añadir a wishlist
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
