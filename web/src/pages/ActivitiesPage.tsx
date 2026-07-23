import { useState, type ReactNode } from "react";
import { DuelActivity } from "./activities/DuelActivity";
import { PurchaseValidatorActivity } from "./activities/PurchaseValidatorActivity";

type ActivityId = "hub" | "pairwise-duel" | "purchase-validator";

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

export function ActivitiesPage() {
  const [active, setActive] = useState<ActivityId>("hub");

  if (active !== "hub") {
    return (
      <div className="space-y-4">
        <button
          type="button"
          onClick={() => setActive("hub")}
          className="rounded-lg border border-border px-3 py-1.5 text-sm text-ink-soft hover:bg-surface-card"
        >
          ← Actividades
        </button>
        {active === "pairwise-duel" ? <DuelActivity /> : null}
        {active === "purchase-validator" ? <PurchaseValidatorActivity /> : null}
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
