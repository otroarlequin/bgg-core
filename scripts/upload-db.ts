/**
 * @deprecated Use `npm run db:push` instead.
 * Kept as a thin alias for backwards compatibility.
 */
process.env.DB_RECONCILE_CMD = "push";
await import("./db-reconcile.ts");
