import { useState, type ReactNode } from "react";
import { DuelActivity } from "./activities/DuelActivity";
import { PurchaseValidatorActivity } from "./activities/PurchaseValidatorActivity";
import { ShelfOfShameActivity } from "./activities/ShelfOfShameActivity";
import { WhatToPlayActivity } from "./activities/WhatToPlayActivity";
import { PlayCalendarActivity } from "./activities/PlayCalendarActivity";

type ActivityId =
  | "hub"
  | "pairwise-duel"
  | "purchase-validator"
  | "what-to-play"
  | "play-calendar"
  | "shelf-of-shame";

const activities: Array<{
  id: Exclude<ActivityId, "hub">;
  title: string;
  description: string;
  Icon: () => ReactNode;
}> = [
  {
    id: "pairwise-duel",
    title: "Duel ranking del periodo",
    description:
      "Compara juegos jugados en un periodo y elige el que más disfrutaste hasta coronar un ganador.",
    Icon: DuelIcon,
  },
  {
    id: "purchase-validator",
    title: "Validador de compras",
    description:
      "Analiza un juego de BGG frente a tu colección (owned, wishlist, preordered) para decidir si te interesa.",
    Icon: CartIcon,
  },
  {
    id: "what-to-play",
    title: "Qué jugar esta noche",
    description:
      "Sugiere 3–5 juegos según jugadores, tiempo y peso opcional, con un score simple.",
    Icon: DiceIcon,
  },
  {
    id: "play-calendar",
    title: "Calendario / rachas",
    description:
      "Heatmap de partidas del último año, racha actual y mejor racha.",
    Icon: CalendarIcon,
  },
  {
    id: "shelf-of-shame",
    title: "Shelf of shame",
    description:
      "Owned sin partidas, los más antiguos primero. Un empujón amable a sacarlos a mesa.",
    Icon: ShameIcon,
  },
];

function DuelIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6 text-accent" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M4 20 L10 8 L14 12 L20 4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M8 20h8" strokeLinecap="round" />
    </svg>
  );
}

function CartIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6 text-accent" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M3 5h2l2.5 11h10l2-7H8" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="10" cy="19" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="17" cy="19" r="1.2" fill="currentColor" stroke="none" />
    </svg>
  );
}

function DiceIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6 text-accent" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="4" y="4" width="16" height="16" rx="3" />
      <circle cx="9" cy="9" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="15" cy="9" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="9" cy="15" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="15" cy="15" r="1.2" fill="currentColor" stroke="none" />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6 text-accent" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="3.5" y="5" width="17" height="15" rx="2" />
      <path d="M3.5 10h17M8 3.5v3M16 3.5v3" strokeLinecap="round" />
      <path d="M8 14h2M12 14h2M16 14h.01M8 17h2M12 17h2" strokeLinecap="round" />
    </svg>
  );
}

function ShameIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6 text-accent" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M5 7h14v12H5z" />
      <path d="M8 7V5.5A1.5 1.5 0 0 1 9.5 4h5A1.5 1.5 0 0 1 16 5.5V7" />
      <path d="M9 12h6M9 15h4" strokeLinecap="round" />
    </svg>
  );
}

export function ActivitiesPage() {
  const [active, setActive] = useState<ActivityId>("hub");

  if (active !== "hub") {
    return (
      <div className="space-y-4">
        <button
          type="button"
          onClick={() => setActive("hub")}
          className="min-h-11 rounded-lg border border-border px-3 py-2 text-sm text-ink-soft hover:bg-surface-card md:min-h-0 md:py-1.5"
        >
          ← Actividades
        </button>
        {active === "pairwise-duel" ? <DuelActivity /> : null}
        {active === "purchase-validator" ? <PurchaseValidatorActivity /> : null}
        {active === "what-to-play" ? <WhatToPlayActivity /> : null}
        {active === "play-calendar" ? <PlayCalendarActivity /> : null}
        {active === "shelf-of-shame" ? <ShelfOfShameActivity /> : null}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="mb-1 text-xl font-bold tracking-tight text-ink">Actividades</h2>
        <p className="text-sm text-muted">
          Herramientas para explorar tu ludoteca y validar futuras compras.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {activities.map((activity) => (
          <button
            key={activity.id}
            type="button"
            onClick={() => setActive(activity.id)}
            className="rounded-2xl border border-border bg-surface-raised/60 p-5 text-left transition hover:border-accent/50 hover:bg-surface-card"
          >
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-surface-card">
              <activity.Icon />
            </div>
            <h3 className="text-lg font-semibold text-ink">{activity.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted">
              {activity.description}
            </p>
            <p className="mt-4 text-sm font-medium text-accent">Abrir →</p>
          </button>
        ))}
      </div>
    </div>
  );
}
