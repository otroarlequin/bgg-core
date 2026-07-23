export function bggGameUrl(bggId: number): string {
  return `https://boardgamegeek.com/boardgame/${bggId}`;
}

interface BggLinkProps {
  bggId: number;
  className?: string;
  label?: string;
}

/** Standard external link to a game on BoardGameGeek. */
export function BggLink({
  bggId,
  className = "",
  label = "BGG ↗",
}: BggLinkProps) {
  return (
    <a
      href={bggGameUrl(bggId)}
      target="_blank"
      rel="noopener noreferrer"
      title="Ver en BoardGameGeek"
      className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold tracking-wide text-accent hover:bg-accent/10 hover:text-accent-hover ${className}`}
      onClick={(e) => e.stopPropagation()}
    >
      {label}
    </a>
  );
}
