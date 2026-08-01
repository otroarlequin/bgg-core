import { useState } from "react";
import { SummaryPage } from "./pages/SummaryPage";
import { CollectionPage } from "./pages/CollectionPage";
import { PlaysPage } from "./pages/PlaysPage";
import { ActivitiesPage } from "./pages/ActivitiesPage";
import { CommandsPage } from "./pages/CommandsPage";
import { SettingsPage } from "./pages/SettingsPage";
import type { CollectionQueryParams } from "./api/types";
import type { AppMode } from "./appMode";
import {
  type CollectionPreset,
  collectionFiltersFromPreset,
} from "./collectionPresets";

type TabId =
  | "summary"
  | "collection"
  | "plays"
  | "activities"
  | "commands"
  | "settings";

function GearIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      aria-hidden
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
      />
    </svg>
  );
}

export default function App({ mode = "personal" }: { mode?: AppMode }) {
  const isProfile = mode === "profile";
  const tabs: Array<{ id: Exclude<TabId, "settings">; label: string }> = [
    { id: "summary", label: "Resumen" },
    { id: "collection", label: "Colección" },
    { id: "plays", label: "Partidas" },
    { id: "activities", label: "Actividades" },
    ...(isProfile
      ? []
      : [{ id: "commands" as const, label: "Comandos" }]),
  ];

  const [activeTab, setActiveTab] = useState<TabId>("summary");
  const [collectionFilters, setCollectionFilters] = useState<CollectionQueryParams>(
    () => collectionFiltersFromPreset("owned"),
  );

  function goToCollection(preset: CollectionPreset) {
    setCollectionFilters(collectionFiltersFromPreset(preset));
    setActiveTab("collection");
  }

  return (
    <div className="min-h-screen bg-surface">
      <header className="border-b border-border bg-surface-raised/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-ink">
              {isProfile ? "BGG Profile" : "BGG Core"}
            </h1>
            <p className="text-sm text-muted">
              {isProfile
                ? "Sesión temporal — colección y partidas desde BGG"
                : "Tu colección y partidas de BoardGameGeek"}
            </p>
          </div>
          <nav className="flex flex-wrap gap-2">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
                  activeTab === tab.id
                    ? "bg-accent text-surface"
                    : "bg-surface-card text-ink-soft hover:bg-border"
                }`}
              >
                {tab.label}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setActiveTab("settings")}
              title="Configuración"
              aria-label="Configuración"
              aria-pressed={activeTab === "settings"}
              className={`inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg transition md:min-h-0 md:min-w-0 md:p-2.5 ${
                activeTab === "settings"
                  ? "bg-accent text-surface"
                  : "bg-surface-card text-ink-soft hover:bg-border hover:text-accent"
              }`}
            >
              <GearIcon />
            </button>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6">
        {activeTab === "summary" ? (
          <SummaryPage onNavigateToCollection={goToCollection} />
        ) : null}
        {activeTab === "collection" ? (
          <CollectionPage filters={collectionFilters} onChangeFilters={setCollectionFilters} />
        ) : null}
        {activeTab === "plays" ? <PlaysPage /> : null}
        {activeTab === "activities" ? <ActivitiesPage /> : null}
        {activeTab === "commands" && !isProfile ? <CommandsPage /> : null}
        {activeTab === "settings" ? <SettingsPage mode={mode} /> : null}
      </main>
    </div>
  );
}
