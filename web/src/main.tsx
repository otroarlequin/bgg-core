import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import App from "./App";
import { ProfileApp } from "./ProfileApp";
import { ProfileAdminPage } from "./pages/ProfileAdminPage";
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
const isProfileAdmin =
  mode === "profile" &&
  typeof window !== "undefined" &&
  (window.location.pathname === "/profile/admin" ||
    window.location.pathname === "/profile/admin/");

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      {isProfileAdmin ? (
        <ProfileAdminPage />
      ) : mode === "profile" ? (
        <ProfileApp />
      ) : (
        <App mode="personal" />
      )}
    </QueryClientProvider>
  </StrictMode>,
);
