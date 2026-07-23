# Changelog

Todos los cambios relevantes de este proyecto se documentan en este archivo.

El formato está basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/),
y el proyecto sigue [Versionado Semántico](https://semver.org/lang/es/).

## [Unreleased]

### Added
- Health enriquecido en `/api/health`: `dbOk`, `dbPath`, `collectionCount`, `playsCount`, `ts` (sin auth).
- CI GitHub Actions (Node 22): `npm test`, `build`, `build:web`.
- `npm run db:upload` (`scripts/upload-db.ts`): merge de `duel_sessions` / `duel_rounds` / `purchase_reviews` desde la DB remota antes de subir a Fly; documentado en `DEPLOY.md`.
- Actividad **Shelf of shame**: owned sin partidas, orden antiguos primero (`/api/activities/shelf-of-shame` + UI).
- Actividad **Qué jugar esta noche**: filtros jugadores/tiempo/peso + sugerencias con score y reshuffle (`/api/activities/what-to-play` + UI).
- Actividad **Calendario / rachas**: heatmap del último año, rachas y detalle por día (`/api/activities/play-calendar` + UI).
- `TASKS.md` con backlog (export/compartir, wishlist inteligente, auth cookie) y descartados.

### Changed
- Validador y Partidas: lista de cards en móvil (`md:` tabla); chips/botones con área táctil mayor en móvil.
- Hub de Actividades: entradas para las tres actividades nuevas.

## [0.1.1] — 2026-07-23

### Added
- Deploy en Fly.io: Dockerfile, `fly.toml`, volumen SQLite, UI servida desde la API, Basic Auth (`APP_PASSWORD`).
- Documentación de sync local + upload de `bgg.db` y secrets BGG ([DEPLOY.md](./DEPLOY.md)).
- `requireBggToken` para lookup/validador (el username solo es obligatorio en sync).
- Badges Base/Exp compactos en listas/tablas del validador de compras (matches, overlap, búsqueda).
- `subtype` en el candidato del validador (colección o tipo BGG `/thing`).

### Changed
- `fly.toml`: región `lax` y `build.dockerfile` explícito.
- Dockerfile: incluye migraciones SQL en la imagen.
- Validador: la descripción del candidato usa la altura de la card (menos scroll prematuro).
- `DEPLOY.md`: documenta `BGG_TOKEN` en Fly para el validador.

### Notes
- Sync de colección/partidas sigue siendo local; en Fly se publica el `.db` y, para el validador, el secret `BGG_TOKEN`.

## [0.1.0] — 2026-07-23

Primer release público del core local BGG + interfaz web.

### Added

#### Core / sync / datos
- Sincronización de colección, things y partidas desde la API de BoardGameGeek hacia SQLite local.
- CLI: `sync:collection`, `sync:things`, `sync:plays`, `query:collection`, `activity`, `activity:duel`.
- Configuración por `.env` (`BGG_TOKEN`, `BGG_USERNAME`) documentada en `SETUP.md`.
- API REST local (Hono) en el puerto 3001: summary, collection, plays, activities, bgg lookup.

#### Interfaz web (`web/`)
- App React + Vite + Tailwind con pestañas: Resumen, Colección, Partidas, Actividades.
- Paleta visual **Cartón y tinta** (tokens CSS: surface, accent, ink, muted, etc.).
- **Resumen:** totales de colección/partidas, H-Index, juegos únicos base vs expansiones, tops presencial vs virtual; StatCards clicables hacia colección con presets.
- **Colección:** filtros colapsables (estado, jugadores, créditos, taxonomía), ordenación, cards ricas con portada, stats, créditos, descripción, badge Base/Exp y link BGG.
- **Partidas:** filtros por fecha, resumen colapsable, tabla con thumbnail, ganador, badge de incompleta y detalle expandible.
- **Actividades — Duel ranking:** setup con filtros de pool, continuar/abandonar sesión, comparación pairwise y card de ganador destacada.
- **Actividades — Validador de compras:** búsqueda por URL/ID/nombre, análisis vs colección, overlaps por facetas, guardar/wishlist local.
- Componente estándar `BggLink` / `GameCard` / `GameSubtypeBadge` reutilizables.

#### Actividades (backend)
- Plugin pairwise duel con sesión persistida y filtros de pool.
- Plugin purchase validator (análisis de candidato vs colección).

### Notes

- Los datos locales (`*.db`, `.env`, `data/`) no se versionan.
- No se incluye exposición vía túnel/LAN en este release (retirado a propósito).

[Unreleased]: https://github.com/otroarlequin/bgg-core/compare/v0.1.1...HEAD
[0.1.1]: https://github.com/otroarlequin/bgg-core/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/otroarlequin/bgg-core/releases/tag/v0.1.0
