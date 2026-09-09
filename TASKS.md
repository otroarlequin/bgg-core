# TASKS

Backlog y decisiones de producto para bgg-core.

## Pendiente

_(vacío tras el release 0.3.0)_

## Diferido

- **Auth por sesión / cookie (Personal):** dejar Basic Auth y pasar a login con cookie/sesión compartida (mejor UX móvil).
- **Export “sugerencia de la noche”:** tarjeta PNG de Qué jugar esta noche (descartado en v1; se puede retomar).
- **Export Shelf of shame / validador / heatmap:** no en v1.
- **Comparador:** más de 4 slots, persistir comparaciones, export PNG.
- **Informe diario Fly automatizado:** Action/cron + email (opcional; hoy basta `fly:status` + fly-metrics.net).

## Descartado

- **Comparador 1v1 de dos juegos:** confrontar dos títulos concretos lado a lado (fuera de alcance; el duel ranking ya cubre comparación pairwise en un pool).

## Hecho reciente

### Hito 0.3.0 — Profile compartido
- Profile multi-visitante (TTL 30d, cuota 10, re-sync, admin, persistencia en volumen Fly).
- Comparador de juegos; Wishlist × tiendas; Wishlist × BGG Market + price watches/cron/Resend.
- Docs: ACTIVITIES, ARCHITECTURE + diagrama Archify, wipe de sesiones, `npm run fly:status`.
- CI + market-watch cron en GitHub Actions publicados con el push del hito.

### Internos / plataforma
- Deploy Fly + Basic Auth + secrets BGG.
- Health enriquecido (`dbOk`, counts, `ts`).
- Reconcile local ↔ Fly fail-closed.
- Tests de overlap validador / filtros duel / market / wishlist.

### UI
- Selector de tema (Ónix / Grafito / Cartón); `GameCard` / `BggLink` / badges Base–Exp.
- Mobile: matches del validador y partidas como cards; targets táctiles mayores.
- Hub Actividades en rejilla 3 columnas.

### Actividades
- Ver catálogo en [`docs/ACTIVITIES.md`](./docs/ACTIVITIES.md).
