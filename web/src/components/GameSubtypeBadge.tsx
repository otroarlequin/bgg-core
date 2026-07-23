/** BGG collection subtypes → visual identity. */

export type KnownGameSubtype = "boardgame" | "boardgameexpansion";

export function normalizeSubtype(subtype?: string | null): KnownGameSubtype | null {
  if (subtype === "boardgame" || subtype === "boardgameexpansion") return subtype;
  return null;
}

function MeepleIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden fill="currentColor">
      <circle cx="12" cy="6.5" r="3.2" />
      <path d="M5.5 19.5c0-4.2 2.9-6.8 6.5-6.8s6.5 2.6 6.5 6.8V20.5H5.5v-1z" />
    </svg>
  );
}

/** Expansion: meeple + plus. */
function ExpansionIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden fill="currentColor">
      <circle cx="9.5" cy="7" r="2.6" />
      <path d="M4.2 18.2c0-3.4 2.3-5.5 5.3-5.5s5.3 2.1 5.3 5.5v.8H4.2v-.8z" />
      <path
        fillRule="evenodd"
        d="M17.5 11.25a.75.75 0 0 1 .75.75v2h2a.75.75 0 0 1 0 1.5h-2v2a.75.75 0 0 1-1.5 0v-2h-2a.75.75 0 0 1 0-1.5h2v-2a.75.75 0 0 1 .75-.75z"
        clipRule="evenodd"
      />
    </svg>
  );
}

interface GameSubtypeBadgeProps {
  subtype?: string | null;
  className?: string;
}

/** Circular subtype badge (card-3 placement style, cartón y tinta colors). */
export function GameSubtypeBadge({
  subtype,
  className = "",
}: GameSubtypeBadgeProps) {
  const kind = normalizeSubtype(subtype);
  if (!kind) return null;

  const isExpansion = kind === "boardgameexpansion";
  const label = isExpansion ? "Expansión" : "Juego base";
  const shortLabel = isExpansion ? "EXP" : "BASE";

  const palette = isExpansion
    ? "border-accent-secondary/50 bg-accent-secondary text-surface shadow-accent-secondary/40"
    : "border-accent/50 bg-accent text-surface shadow-accent/40";

  return (
    <span
      title={label}
      className={`inline-flex h-11 w-11 flex-col items-center justify-center rounded-full border-2 shadow-lg ${palette} ${className}`}
    >
      {isExpansion ? (
        <ExpansionIcon className="h-3.5 w-3.5" />
      ) : (
        <MeepleIcon className="h-3.5 w-3.5" />
      )}
      <span className="mt-0.5 text-[7px] font-black leading-none tracking-wider">
        {shortLabel}
      </span>
      <span className="sr-only">{label}</span>
    </span>
  );
}
