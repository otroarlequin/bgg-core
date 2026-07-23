import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { summaryRoutes } from "./routes/summary.js";
import { collectionRoutes } from "./routes/collection.js";
import { playsRoutes } from "./routes/plays.js";
import { activitiesRoutes } from "./routes/activities.js";
import { bggRoutes } from "./routes/bgg.js";

const app = new Hono();

app.use(
  "/api/*",
  cors({
    origin: ["http://localhost:5173", "http://127.0.0.1:5173"],
  }),
);

app.get("/api/health", (c) => c.json({ ok: true }));

app.route("/api/summary", summaryRoutes);
app.route("/api/collection", collectionRoutes);
app.route("/api/plays", playsRoutes);
app.route("/api/activities", activitiesRoutes);
app.route("/api/bgg", bggRoutes);

const port = Number(process.env.PORT ?? 3001);

console.log(`BGG API escuchando en http://localhost:${port}`);

serve({ fetch: app.fetch, port });
