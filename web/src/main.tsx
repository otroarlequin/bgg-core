import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import App from "./App";
import { ProfileApp } from "./ProfileApp";
import { detectAppMode } from "./appMode";
import { applyTheme, getStoredTheme } from "./theme";
import "./index.css";

applyTheme(getStoredTheme());

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
    },
  },
});

const mode = detectAppMode();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      {mode === "profile" ? <ProfileApp /> : <App mode="personal" />}
    </QueryClientProvider>
  </StrictMode>,
);
