import { Hono } from "hono";

/**
 * Mounted on the personal server so /api/profile never looks like a generic 404.
 * Real sessions live on profile-server (:3002 / Fly bgg-profile).
 */
export const profileStubRoutes = new Hono();

profileStubRoutes.all("/*", (c) => {
  return c.json(
    {
      message:
        "Las sesiones de /profile no corren en la API personal. Arranca la API profile en el puerto 3002 (`npm run dev:profile` o `npm run dev:profile:all`) y recarga.",
      hint: "Personal :3001 · Profile :3002 · UI /profile",
    },
    503,
  );
});
