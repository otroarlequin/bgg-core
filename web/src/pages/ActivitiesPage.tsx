import { useEffect, useState, type ReactNode } from "react";
import { DuelActivity } from "./activities/DuelActivity";
import { PurchaseValidatorActivity } from "./activities/PurchaseValidatorActivity";
import { ShelfOfShameActivity } from "./activities/ShelfOfShameActivity";
import { WhatToPlayActivity } from "./activities/WhatToPlayActivity";
import { PlayCalendarActivity } from "./activities/PlayCalendarActivity";
import { SmartWishlistActivity } from "./activities/SmartWishlistActivity";
import { HotnessScoutActivity } from "./activities/HotnessScoutActivity";
import { GameCompareActivity } from "./activities/GameCompareActivity";
import { WishlistStoreMatchActivity } from "./activities/WishlistStoreMatchActivity";
import { WishlistMarketActivity } from "./activities/WishlistMarketActivity";
import { InsightsActivity } from "./activities/InsightsActivity";
import { postWishlistMarket } from "../api/client";

type ActivityId =
  | "hub"
  | "insights"
  | "pairwise-duel"
  | "purchase-validator"
  | "game-compare"
  | "what-to-play"
  | "play-calendar"
  | "shelf-of-shame"
  | "smart-wishlist"
  | "hotness-scout"
  | "wishlist-store-match"
  | "wishlist-market";

export type ActivitiesFocus = Exclude<ActivityId, "hub">;

type ActivityTile = {
  id: Exclude<ActivityId, "hub">;
  title: string;
  description: string;
  Icon: () => ReactNode;
};

const activityGroups: Array<{ title: string; items: ActivityTile[] }> = [
  {
    title: "Mesa",
    items: [
      {
        id: "what-to-play",
        title: "Qué jugar esta noche",
        description: "3–5 sugerencias según jugadores, tiempo y peso.",
        Icon: DiceIcon,
      },
      {
        id: "shelf-of-shame",
        title: "Shelf of shame",
        description: "Owned sin partidas, los más antiguos primero.",
        Icon: ShameIcon,
      },
      {
        id: "play-calendar",
        title: "Calendario / rachas",
        description: "Heatmap del último año, racha actual y mejor racha.",
        Icon: CalendarIcon,
      },
    ],
  },
  {
    title: "Wishlist",
    items: [
      {
        id: "smart-wishlist",
        title: "Wishlist inteligente",
        description: "Prioriza según cómo juegas y los huecos de tu mesa.",
        Icon: WishlistIcon,
      },
      {
        id: "wishlist-store-match",
        title: "Wishlist × tiendas",
        description: "Precio y stock en Game Nerdz y Miniature Market.",
        Icon: StoreIcon,
      },
      {
        id: "wishlist-market",
        title: "Wishlist × BGG Market",
        description: "Ofertas de GeekMarket y alertas de precio.",
        Icon: MarketIcon,
      },
    ],
  },
  {
    title: "Descubrir",
    items: [
      {
        id: "purchase-validator",
        title: "Validador de compras",
        description: "¿Encaja este juego con tu colección?",
        Icon: CartIcon,
      },
      {
        id: "game-compare",
        title: "Comparador de juegos",
        description: "Hasta 4 títulos lado a lado: ficha y solapes.",
        Icon: CompareIcon,
      },
      {
        id: "hotness-scout",
        title: "Hotness scout",
        description: "La hot list de BGG frente a tu mesa owned.",
        Icon: HotnessIcon,
      },
    ],
  },
  {
    title: "Analizar",
    items: [
      {
        id: "insights",
        title: "Insights",
        description: "Año a año, top 100 BGG y con quién juegas.",
        Icon: InsightsIcon,
      },
      {
        id: "pairwise-duel",
        title: "Duel ranking del periodo",
        description: "Elige el más disfrutado hasta coronar un ganador.",
        Icon: DuelIcon,
      },
    ],
  },
];

const iconClass = "h-10 w-10 text-accent";

function DuelIcon() {
  return (
    <svg viewBox="0 0 24 24" className={iconClass} fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M4 20 L10 8 L14 12 L20 4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M8 20h8" strokeLinecap="round" />
    </svg>
  );
}

function CartIcon() {
  return (
    <svg viewBox="0 0 24 24" className={iconClass} fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M3 5h2l2.5 11h10l2-7H8" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="10" cy="19" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="17" cy="19" r="1.2" fill="currentColor" stroke="none" />
    </svg>
  );
}

function CompareIcon() {
  return (
    <svg viewBox="0 0 24 24" className={iconClass} fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="3" y="4" width="7" height="16" rx="1.5" />
      <rect x="14" y="4" width="7" height="16" rx="1.5" />
      <path d="M6.5 9h0.01M6.5 12h0.01M6.5 15h0.01" strokeLinecap="round" />
      <path d="M17.5 9h0.01M17.5 12h0.01M17.5 15h0.01" strokeLinecap="round" />
    </svg>
  );
}

function DiceIcon() {
  return (
    <svg viewBox="0 0 24 24" className={iconClass} fill="none" stroke="currentColor" strokeWidth="1.8">
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
    <svg viewBox="0 0 24 24" className={iconClass} fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="3.5" y="5" width="17" height="15" rx="2" />
      <path d="M3.5 10h17M8 3.5v3M16 3.5v3" strokeLinecap="round" />
      <path d="M8 14h2M12 14h2M16 14h.01M8 17h2M12 17h2" strokeLinecap="round" />
    </svg>
  );
}

function ShameIcon() {
  return (
    <svg viewBox="0 0 24 24" className={iconClass} fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M5 7h14v12H5z" />
      <path d="M8 7V5.5A1.5 1.5 0 0 1 9.5 4h5A1.5 1.5 0 0 1 16 5.5V7" />
      <path d="M9 12h6M9 15h4" strokeLinecap="round" />
    </svg>
  );
}

function WishlistIcon() {
  return (
    <svg viewBox="0 0 24 24" className={iconClass} fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M8 4h9l-1.5 14H9.5L8 4z" strokeLinejoin="round" />
      <path d="M10 8h6M10.5 12h5M11 16h4" strokeLinecap="round" />
      <path d="M7 7H5.5A1.5 1.5 0 0 0 4 8.5v9A1.5 1.5 0 0 0 5.5 19H14" strokeLinecap="round" />
    </svg>
  );
}

function StoreIcon() {
  return (
    <svg viewBox="0 0 24 24" className={iconClass} fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M4 10h16l-1 10H5L4 10z" strokeLinejoin="round" />
      <path d="M3 10l2-5h14l2 5" strokeLinejoin="round" />
      <path d="M10 14h4" strokeLinecap="round" />
    </svg>
  );
}

function MarketIcon() {
  return (
    <svg viewBox="0 0 24 24" className={iconClass} fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M4 7h16v12H4z" strokeLinejoin="round" />
      <path d="M8 7V5.5A2.5 2.5 0 0 1 10.5 3h3A2.5 2.5 0 0 1 16 5.5V7" />
      <path d="M8 12h8M8 15h5" strokeLinecap="round" />
    </svg>
  );
}

function InsightsIcon() {
  return (
    <svg viewBox="0 0 24 24" className={iconClass} fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M4 18V9M9 18V5M14 18v-7M19 18V7" strokeLinecap="round" />
      <path d="M3 19h18" strokeLinecap="round" />
    </svg>
  );
}

function HotnessIcon() {
  return (
    <svg viewBox="0 0 24 24" className={iconClass} fill="none" stroke="currentColor" strokeWidth="1.8">
      <path
        d="M12 3c1.5 3 1 5.5-.5 7.5C13 11 15 12.5 15 16a3 3 0 1 1-6 0c0-2.2 1.2-3.8 2.2-5C10.5 9.5 10 6.5 12 3z"
        strokeLinejoin="round"
      />
      <path d="M9 18.5c.8 1 1.8 1.5 3 1.5s2.2-.5 3-1.5" strokeLinecap="round" />
    </svg>
  );
}

export function ActivitiesPage({
  initialFocus = null,
  onConsumedInitialFocus,
}: {
  initialFocus?: ActivitiesFocus | null;
  onConsumedInitialFocus?: () => void;
} = {}) {
  const [active, setActive] = useState<ActivityId>("hub");
  const [validatorBggId, setValidatorBggId] = useState<number | null>(null);
  const [marketUnread, setMarketUnread] = useState(0);

  useEffect(() => {
    if (!initialFocus) return;
    setActive(initialFocus);
    onConsumedInitialFocus?.();
    // Solo reaccionar al focus entrante; el callback del padre puede ser inline.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional
  }, [initialFocus]);

  useEffect(() => {
    if (active !== "hub") return;
    void (async () => {
      try {
        const data = await postWishlistMarket({ action: "listAlerts" });
        setMarketUnread(data.alertsUnread);
      } catch {
        setMarketUnread(0);
      }
    })();
  }, [active]);

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
        {active === "purchase-validator" ? (
          <PurchaseValidatorActivity
            initialBggId={validatorBggId ?? undefined}
            onConsumedInitialBggId={() => setValidatorBggId(null)}
          />
        ) : null}
        {active === "game-compare" ? <GameCompareActivity /> : null}
        {active === "smart-wishlist" ? (
          <SmartWishlistActivity
            onOpenValidator={(bggId) => {
              setValidatorBggId(bggId);
              setActive("purchase-validator");
            }}
          />
        ) : null}
        {active === "hotness-scout" ? (
          <HotnessScoutActivity
            onOpenValidator={(bggId) => {
              setValidatorBggId(bggId);
              setActive("purchase-validator");
            }}
          />
        ) : null}
        {active === "wishlist-store-match" ? (
          <WishlistStoreMatchActivity />
        ) : null}
        {active === "wishlist-market" ? <WishlistMarketActivity /> : null}
        {active === "insights" ? <InsightsActivity /> : null}
        {active === "what-to-play" ? <WhatToPlayActivity /> : null}
        {active === "play-calendar" ? <PlayCalendarActivity /> : null}
        {active === "shelf-of-shame" ? <ShelfOfShameActivity /> : null}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="mb-1 text-xl font-bold tracking-tight text-ink">Actividades</h2>
        <p className="text-sm text-muted">
          Herramientas para explorar tu ludoteca y validar futuras compras.
        </p>
      </div>
      <div className="space-y-5">
        {activityGroups.map((group) => (
          <section key={group.title}>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
              {group.title}
            </h3>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {group.items.map((activity) => (
                <button
                  key={activity.id}
                  type="button"
                  onClick={() => setActive(activity.id)}
                  className="group relative flex min-h-11 items-start gap-4 rounded-xl border border-border bg-surface-raised/60 px-4 py-3.5 text-left transition hover:border-accent/50 hover:bg-surface-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
                >
                  {activity.id === "wishlist-market" && marketUnread > 0 ? (
                    <span className="absolute right-2.5 top-2.5 rounded-full bg-accent px-2 py-0.5 text-xs font-semibold text-surface">
                      {marketUnread > 99 ? "99+" : marketUnread}
                    </span>
                  ) : null}
                  <div className="mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center">
                    <activity.Icon />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-base font-semibold leading-snug text-ink">
                      {activity.title}
                    </h3>
                    <p className="mt-1 line-clamp-2 text-sm leading-snug text-muted">
                      {activity.description}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
