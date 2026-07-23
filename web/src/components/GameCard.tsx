import type { ReactNode } from "react";
import { BggLink } from "./BggLink";
import { GameSubtypeBadge, normalizeSubtype } from "./GameSubtypeBadge";

interface GameCardProps {
  bggId: number;
  name: string;
  thumbnailUrl?: string | null;
  imageUrl?: string | null;
  personalRating?: number | null;
  bggRating?: number | null;
  numPlays?: number;
  weight?: number | null;
  designers?: string[];
  artists?: string[];
  publishers?: string[];
  description?: string | null;
  yearPublished?: number | null;
  minPlayers?: number | null;
  maxPlayers?: number | null;
  playingTime?: number | null;
  minPlayTime?: number | null;
  maxPlayTime?: number | null;
  /** Free-form subtitle (e.g. date range). Prefer `subtype` for BGG type. */
  subtitle?: string;
  /** BGG subtype: boardgame | boardgameexpansion */
  subtype?: string | null;
  /** Featured layout: large cover + richer stats (e.g. duel winner). */
  variant?: "default" | "featured";
  wins?: number;
  winRate?: number | null;
  totalMinutes?: number;
}

function formatPlayers(min?: number | null, max?: number | null): string | null {
  if (min == null && max == null) return null;
  if (min != null && max != null) {
    return min === max ? `${min}` : `${min}–${max}`;
  }
  return String(min ?? max);
}

function formatTime(
  playingTime?: number | null,
  minPlayTime?: number | null,
  maxPlayTime?: number | null,
): string | null {
  if (minPlayTime != null && maxPlayTime != null && minPlayTime !== maxPlayTime) {
    return `${minPlayTime}–${maxPlayTime} min`;
  }
  if (playingTime != null) return `${playingTime} min`;
  if (minPlayTime != null) return `${minPlayTime} min`;
  if (maxPlayTime != null) return `${maxPlayTime} min`;
  return null;
}

function truncate(text: string, max = 140): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  return `${clean.slice(0, max - 1).trimEnd()}…`;
}

function PlayersIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="currentColor" aria-hidden>
      <circle cx="9" cy="7" r="2.5" />
      <path d="M3.5 17.5c0-3 2.2-5 5.5-5s5.5 2 5.5 5v.5H3.5v-.5z" />
      <circle cx="16.5" cy="8" r="2" opacity="0.85" />
      <path d="M13.2 17.5c.4-2.2 2-3.7 4.3-3.7 2.2 0 3.8 1.3 4 3.2v.5h-8.3v-.5z" opacity="0.85" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 8v4.5l3 1.5" strokeLinecap="round" />
    </svg>
  );
}

function WeightIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="currentColor" aria-hidden>
      <path d="M8 7h8l1.5 3H6.5L8 7zm-2 4h12v2H6v-2zm1 3h10l-1 5H8l-1-5z" />
    </svg>
  );
}

function StarIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="currentColor" aria-hidden>
      <path d="M12 3.5l2.4 4.9 5.4.8-3.9 3.8.9 5.4L12 15.8 7.2 18.4l.9-5.4L4.2 9.2l5.4-.8L12 3.5z" />
    </svg>
  );
}

function MetaItem({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-accent">{label}</p>
      <p className="truncate text-sm text-ink-soft">{value}</p>
    </div>
  );
}

export function GameCard({
  bggId,
  name,
  thumbnailUrl,
  imageUrl,
  personalRating,
  bggRating,
  numPlays,
  weight,
  designers,
  artists,
  publishers,
  description,
  yearPublished,
  minPlayers,
  maxPlayers,
  playingTime,
  minPlayTime,
  maxPlayTime,
  subtitle,
  subtype,
  variant = "default",
  wins,
  winRate,
  totalMinutes,
}: GameCardProps) {
  const knownSubtype = normalizeSubtype(subtype);
  const isExpansion = knownSubtype === "boardgameexpansion";
  const players = formatPlayers(minPlayers, maxPlayers);
  const time = formatTime(playingTime, minPlayTime, maxPlayTime);
  const cover =
    imageUrl ??
    thumbnailUrl ??
    "https://placehold.co/200x200/2a241c/a89880?text=BGG";

  const frameShadow = isExpansion
    ? "shadow-[inset_3px_0_0_0_#8a9a6a,inset_0_2px_0_0_#8a9a6a,inset_0_-2px_0_0_#8a9a6a]"
    : knownSubtype
      ? "shadow-[inset_3px_0_0_0_#c47a3a,inset_0_2px_0_0_#c47a3a,inset_0_-2px_0_0_#c47a3a]"
      : "";

  const borderClass = isExpansion
    ? "border-accent-secondary-muted/50"
    : knownSubtype
      ? "border-accent-muted/45"
      : "border-border";

  if (variant === "featured") {
    return (
      <div
        className={`overflow-hidden rounded-2xl border bg-surface-card text-left ${borderClass} ${frameShadow}`}
      >
        <div className="relative aspect-square w-full bg-surface-raised sm:aspect-[4/3]">
          <img src={cover} alt={name} className="h-full w-full object-cover" />
          <div className="absolute right-3 top-3">
            <BggLink
              bggId={bggId}
              className="bg-surface/80 px-2 py-1 text-xs backdrop-blur"
            />
          </div>
          {knownSubtype ? (
            <div className="absolute left-2 top-2">
              <GameSubtypeBadge subtype={knownSubtype} />
            </div>
          ) : null}
        </div>
        <div className="space-y-3 p-5">
          <div>
            <h3 className="text-2xl font-bold leading-snug text-ink">{name}</h3>
            {subtitle ? (
              <p className="mt-1 text-sm text-muted">{subtitle}</p>
            ) : null}
            {designers && designers.length > 0 ? (
              <p className="mt-1 text-sm text-muted-dim">{designers.join(", ")}</p>
            ) : null}
          </div>
          <div className="grid grid-cols-2 gap-2 text-sm">
            {numPlays != null ? (
              <div className="rounded-lg bg-surface/60 px-3 py-2">
                <p className="text-[11px] uppercase tracking-wide text-muted-dim">
                  Partidas
                </p>
                <p className="font-semibold text-ink">{numPlays}</p>
              </div>
            ) : null}
            {personalRating != null ? (
              <div className="rounded-lg bg-surface/60 px-3 py-2">
                <p className="text-[11px] uppercase tracking-wide text-muted-dim">
                  Rating
                </p>
                <p className="font-semibold text-ink">★ {personalRating}</p>
              </div>
            ) : null}
            {weight != null ? (
              <div className="rounded-lg bg-surface/60 px-3 py-2">
                <p className="text-[11px] uppercase tracking-wide text-muted-dim">
                  Peso
                </p>
                <p className="font-semibold text-ink">{weight.toFixed(2)}</p>
              </div>
            ) : null}
            {winRate != null ? (
              <div className="rounded-lg bg-surface/60 px-3 py-2">
                <p className="text-[11px] uppercase tracking-wide text-muted-dim">
                  Victorias
                </p>
                <p className="font-semibold text-accent-secondary">
                  {wins ?? 0} ({Math.round(winRate * 100)}%)
                </p>
              </div>
            ) : null}
            {totalMinutes != null ? (
              <div className="rounded-lg bg-surface/60 px-3 py-2">
                <p className="text-[11px] uppercase tracking-wide text-muted-dim">
                  Tiempo
                </p>
                <p className="font-semibold text-ink">{totalMinutes} min</p>
              </div>
            ) : null}
            {bggRating != null ? (
              <div className="rounded-lg bg-surface/60 px-3 py-2">
                <p className="text-[11px] uppercase tracking-wide text-muted-dim">
                  BGG rating
                </p>
                <p className="font-semibold text-ink">{bggRating.toFixed(1)}</p>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    );
  }

  const stats: Array<{ icon: ReactNode; text: string; title: string }> = [];
  if (players) {
    stats.push({
      icon: <PlayersIcon />,
      text: `${players} jug.`,
      title: "Jugadores",
    });
  }
  if (time) {
    stats.push({ icon: <ClockIcon />, text: time, title: "Duración" });
  }
  if (weight != null) {
    stats.push({
      icon: <WeightIcon />,
      text: weight.toFixed(2),
      title: "Peso",
    });
  }
  if (bggRating != null) {
    stats.push({
      icon: <StarIcon />,
      text: bggRating.toFixed(1),
      title: "Rating BGG",
    });
  }
  if (personalRating != null) {
    stats.push({
      icon: <span aria-hidden>★</span>,
      text: String(personalRating),
      title: "Rating personal",
    });
  }
  if (numPlays != null) {
    stats.push({
      icon: null,
      text: `${numPlays} partidas`,
      title: "Partidas",
    });
  }

  return (
    <div
      className={`flex gap-4 overflow-hidden rounded-xl border bg-surface-card p-3.5 ${borderClass} ${frameShadow}`}
    >
      <div className="relative shrink-0">
        <img
          src={cover}
          alt={name}
          className="h-28 w-28 rounded-lg object-cover bg-surface-raised sm:h-32 sm:w-32"
        />
        {knownSubtype ? (
          <div className="absolute -left-1.5 -top-1.5">
            <GameSubtypeBadge subtype={knownSubtype} />
          </div>
        ) : null}
      </div>

      <div className="min-w-0 flex-1 space-y-2.5">
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <h3 className="text-base font-semibold leading-snug text-ink sm:text-lg">
              {name}
            </h3>
            <div className="mt-1 h-px w-12 bg-accent/50" />
          </div>
          <BggLink bggId={bggId} />
        </div>

        {subtitle ? <p className="text-xs text-muted">{subtitle}</p> : null}

        {stats.length > 0 ? (
          <div className="flex flex-wrap gap-x-3 gap-y-1.5 text-xs text-accent">
            {stats.map((s) => (
              <span
                key={s.title}
                title={s.title}
                className="inline-flex items-center gap-1 font-medium"
              >
                {s.icon}
                <span className="text-ink-soft">{s.text}</span>
              </span>
            ))}
          </div>
        ) : null}

        {description ? (
          <p className="line-clamp-2 text-sm leading-snug text-muted">
            {truncate(description)}
          </p>
        ) : null}

        <div className="grid grid-cols-2 gap-x-3 gap-y-2 border-t border-border/80 pt-2 sm:grid-cols-4">
          {designers && designers.length > 0 ? (
            <MetaItem label="Diseño" value={designers.join(", ")} />
          ) : null}
          {artists && artists.length > 0 ? (
            <MetaItem label="Arte" value={artists.join(", ")} />
          ) : null}
          {publishers && publishers.length > 0 ? (
            <MetaItem label="Editorial" value={publishers[0]} />
          ) : null}
          {yearPublished != null ? (
            <MetaItem label="Año" value={String(yearPublished)} />
          ) : null}
        </div>
      </div>
    </div>
  );
}
