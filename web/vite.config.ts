import type { IncomingMessage } from "node:http";
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

function wantsProfileApi(req: IncomingMessage): boolean {
  const referer = req.headers.referer ?? "";
  const cookie = req.headers.cookie ?? "";
  return referer.includes("/profile") || cookie.includes("bgg_profile_sid=");
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const personalApi = env.BGG_API_PROXY_PERSONAL || "http://localhost:3001";
  const profileApi = env.BGG_API_PROXY_PROFILE || "http://localhost:3002";
  /** `--mode profile` forces profile API; otherwise route by Referer/cookie. */
  const defaultTarget =
    mode === "profile" || env.BGG_API_PROXY
      ? env.BGG_API_PROXY || profileApi
      : personalApi;

  return {
    plugins: [react(), tailwindcss()],
    server: {
      host: "127.0.0.1",
      port: mode === "profile" ? 5174 : 5173,
      strictPort: mode === "profile",
      proxy: {
        "/api": {
          target: defaultTarget,
          changeOrigin: true,
          router: (req) => {
            if (mode === "profile" || env.BGG_API_PROXY) {
              return defaultTarget;
            }
            return wantsProfileApi(req) ? profileApi : personalApi;
          },
        },
      },
    },
  };
});
