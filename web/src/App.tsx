import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { SummaryPage } from "./pages/SummaryPage";
import { CollectionPage } from "./pages/CollectionPage";
import { PlaysPage } from "./pages/PlaysPage";
import { ActivitiesPage } from "./pages/ActivitiesPage";
import { CommandsPage } from "./pages/CommandsPage";
import { triggerSync } from "./api/client";
import type { CollectionQueryParams } from "./api/types";
import {
  type CollectionPreset,
  collectionFiltersFromPreset,
} from "./collectionPresets";

type TabId = "summary" | "collection" | "plays" | "activities" | "commands";

const tabs: Array<{ id: TabId; label: string }> = [
  { id: "summary", label: "Resumen" },
  { id: "collection", label: "Colección" },
  { id: "plays", label: "Partidas" },
  { id: "activities", label: "Actividades" },
  { id: "commands", label: "Comandos" },
];

export default function App() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<TabId>("summary");
  const [collectionFilters, setCollectionFilters] = useState<CollectionQueryParams>(
    () => collectionFiltersFromPreset("owned"),
  );
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  function goToCollection(preset: CollectionPreset) {
    setCollectionFilters(collectionFiltersFromPreset(preset));
    setActiveTab("collection");
  }

  async function handleSync() {
    setSyncing(true);
    setSyncMessage(null);
    try {
      const result = await triggerSync();
      if (!result.ok) {
        setSyncMessage(result.message ?? "Sync falló");
        return;
      }
      const parts: string[] = [];
      if (result.collection) {
        parts.push(
          `colección ${result.collection.count} (${result.collection.incremental ? "incr." : "full"})`,
        );
      }
      if (result.plays) {
        parts.push(
          `partidas ${result.plays.count} (${result.plays.incremental ? "incr." : "full"})`,
        );
      }
      parts.push(`${(result.durationMs / 1000).toFixed(1)}s`);
      setSyncMessage(`Sync OK: ${parts.join(" · ")}`);
      await queryClient.invalidateQueries();
    } catch (err) {
      setSyncMessage(err instanceof Error ? err.message : "Error al sincronizar");
    } finally {
      setSyncing(false);
    }
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
          <div className="flex flex-col items-stretch gap-2 sm:items-end">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => void handleSync()}
                disabled={syncing}
                className="min-h-11 rounded-lg border border-border bg-surface-card px-3 py-2 text-sm font-medium text-accent hover:border-accent/50 hover:bg-surface disabled:opacity-50 md:min-h-0"
              >
                {syncing ? "Sincronizando…" : "Sincronizar con BGG"}
              </button>
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
            {syncMessage ? (
              <p className="max-w-md text-right text-xs text-muted">{syncMessage}</p>
            ) : null}
          </div>
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
        {activeTab === "commands" ? <CommandsPage /> : null}
      </main>
    </div>
  );
}
