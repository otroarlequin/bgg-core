export function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded-lg bg-surface-card ${className}`.trim()}
      aria-hidden
    />
  );
}

export function GameCardSkeleton() {
  return (
    <div className="flex gap-4 overflow-hidden rounded-xl border border-border bg-surface-card p-3.5">
      <Skeleton className="h-28 w-28 shrink-0 sm:h-32 sm:w-32" />
      <div className="min-w-0 flex-1 space-y-2.5">
        <Skeleton className="h-5 w-2/3" />
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-4/5" />
        <div className="grid grid-cols-2 gap-2 pt-1 sm:grid-cols-4">
          <Skeleton className="h-8" />
          <Skeleton className="h-8" />
          <Skeleton className="h-8" />
          <Skeleton className="h-8" />
        </div>
      </div>
    </div>
  );
}

export function CollectionGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div
      className="grid gap-4 lg:grid-cols-2"
      aria-busy="true"
      aria-live="polite"
    >
      <span className="sr-only">Cargando colección…</span>
      {Array.from({ length: count }, (_, index) => (
        <GameCardSkeleton key={index} />
      ))}
    </div>
  );
}

export function StatCardsSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-4">
      {Array.from({ length: count }, (_, index) => (
        <div
          key={index}
          className="flex flex-col items-center rounded-xl border border-border bg-surface-raised/70 px-3 py-4"
        >
          <Skeleton className="h-3 w-16" />
          <Skeleton className="mt-2 h-8 w-12" />
        </div>
      ))}
    </div>
  );
}

export function PlaysTableSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div aria-busy="true" aria-live="polite">
      <span className="sr-only">Cargando partidas…</span>
      <ul className="space-y-2 md:hidden">
        {Array.from({ length: Math.min(rows, 4) }, (_, index) => (
          <li
            key={index}
            className="flex gap-3 rounded-xl border border-border bg-surface/40 p-3"
          >
            <Skeleton className="h-14 w-14 shrink-0 rounded-lg" />
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          </li>
        ))}
      </ul>
      <div className="hidden overflow-hidden rounded-xl border border-border md:block">
        <div className="space-y-0">
          <div className="bg-surface-raised px-4 py-3">
            <Skeleton className="h-3 w-40" />
          </div>
          {Array.from({ length: rows }, (_, index) => (
            <div
              key={index}
              className="flex items-center gap-3 border-t border-border bg-surface/40 px-4 py-3"
            >
              <Skeleton className="h-10 w-10 shrink-0 rounded-md" />
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="ml-auto h-4 w-16" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function PageSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true" aria-live="polite">
      <span className="sr-only">Cargando…</span>
      <Skeleton className="h-20 w-full rounded-xl" />
      <CollectionGridSkeleton count={4} />
    </div>
  );
}
