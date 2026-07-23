import { useState } from "react";
import { SummaryPage } from "./pages/SummaryPage";
import { CollectionPage } from "./pages/CollectionPage";
import { PlaysPage } from "./pages/PlaysPage";
import { ActivitiesPage } from "./pages/ActivitiesPage";
import type { CollectionQueryParams } from "./api/types";
import {
  type CollectionPreset,
  collectionFiltersFromPreset,
} from "./collectionPresets";

type TabId = "summary" | "collection" | "plays" | "activities";

const tabs: Array<{ id: TabId; label: string }> = [
  { id: "summary", label: "Resumen" },
  { id: "collection", label: "Colección" },
  { id: "plays", label: "Partidas" },
  { id: "activities", label: "Actividades" },
];

export default function App() {
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
            <h1 className="text-2xl font-bold text-ink">BGG Core</h1>
            <p className="text-sm text-muted">
              Tu colección y partidas de BoardGameGeek
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
      </main>
    </div>
  );
}
