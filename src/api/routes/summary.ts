import { Hono } from "hono";
import { getDashboard } from "../context.js";

export const summaryRoutes = new Hono();

summaryRoutes.get("/", (c) => {
  return c.json(getDashboard());
});
