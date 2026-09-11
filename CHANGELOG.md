# Changelog

Todos los cambios relevantes de este proyecto se documentan en este archivo.

El formato está basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/),
y el proyecto sigue [Versionado Semántico](https://semver.org/lang/es/).

## [Unreleased]

### Added
- Actividad **Insights**: año a año (adquisiciones vs bajas), top 100 BGG frente a la mesa, distribución de jugadores/peso; `GET /api/activities/insights` + UI.
- Historial de estado de colección (`collection_status_events`) con baseline y diffs en sync.
- Caché de ranks del browse BGG (top 100) para Insights.
- Script `npm run fly:cost` para estimar coste de máquinas Fly.

### Changed
- **Wishlist × BGG Market:** caché al entrar (`action: "status"`), botón «Actualizar Market» aparte de filtros; notificaciones solo por alertas de precio (watches), no por cada listing; cards con «Alerta +/✎» y scroll a ofertas desde campana/watches.
- Hub **Actividades:** agrupado (Mesa / Wishlist / Descubrir / Analizar) y tiles/iconos más legibles.
- **Resumen:** paneles densos de métricas en lugar de StatCards enormes.
- **Qué jugar esta noche:** filtros se colapsan tras sugerir; botones de acción siempre visibles.
- **Shelf of shame:** filtros clásicos, grid de portadas; copy claro de que «En colección desde» es `last_modified` de BGG, no fecha de compra.
- **Validador de compras:** layout 50/50 ficha/atributos, descripción con tope de altura y scroll; filtros de overlap dentro del bloque Overlap.
- Pestaña **Comandos** oculta en deploys Fly (`*.fly.dev` / `*.fly.io`) y en modo Profile.

## [0.3.0] — 2026-09-09

Hito **Profile compartido**: la variante multi-visitante se publica como la versión compartida con más personas (`bgg-profile`), junto con el core personal. Incluye admin de sesiones, market watches y documentación de arquitectura/actividades.

### Added
- **BGG Profile** (deploy aparte): sesión por visitante (`/profile`), sync collection+plays+things, rate limit, SQLite en volumen; duel y validador sin persistencia durable; `Dockerfile.profile` + `fly.profile.toml`.
- Scripts locales `dev:profile` / `dev:profile:all` (API `:3002` + Vite `:5174`).
- Profile **Actualizar con BGG** (`POST /api/profile/sync` NDJSON) desde Configuración; fallo parcial conserva datos y `lastSyncError`.
- Profile **admin oculto** (`/profile/admin` + API list/kill) con `PROFILE_ADMIN_PASSWORD`.
- Actividad **Comparador de juegos**: hasta 4 títulos BGG lado a lado (ficha, similitud Jaccard, diferencias resaltadas); `POST /api/activities/game-compare`.
- Actividad **Wishlist × tiendas**: búsqueda en vivo en Game Nerdz y Miniature Market por ítem de wishlist, match por título, caché SQLite 24h y rate limit; `POST /api/activities/wishlist-store-match` (uso personal local; sin Amazon ni CSV).
- Actividad **Wishlist × BGG Market**: ofertas GeekMarket para la wishlist, novedades in-app al escanear; `POST /api/activities/wishlist-market`.
- **Price watches / alertas**: umbrales de precio (máx. 40), panel en Configuración, campana in-app; cron `POST /api/cron/market-watches` con `CRON_SECRET`; email opcional vía Resend; workflow GitHub Actions 2×/día.
- Documentación: [`docs/ACTIVITIES.md`](./docs/ACTIVITIES.md), diagrama Archify de runtime ([`docs/architecture/bgg-core-runtime.html`](./docs/architecture/bgg-core-runtime.html)), ampliación de arquitectura/comandos/deploy.
- Script on-demand `npm run fly:status` para resumen de máquinas `bgg-core` + `bgg-profile`.

### Changed
- Contexto de DB por request (`AsyncLocalStorage`) para aislar sesiones profile del core personal.
- Validador: `persist: false` / `APP_MODE=profile` bloquea save y wishlist durable.
- Proxy Vite: rutas desde `/profile` van a la API profile; stub claro en la API personal si falta `:3002`; modo Profile redirige `/` → `/profile`.
- **Profile:** TTL idle **30 días** (`PROFILE_SESSION_TTL_DAYS`); cuota **10** sesiones; partidas **1 año** (`PROFILE_PLAYS_YEARS`); things solo prioritarios; progreso NDJSON + barra en la UI.
- Hub **Actividades**: rejilla de 3 columnas, cards centradas (icono + título), tipografía más legible y orden reagrupado (validador / wishlist / mesa).
- **Wishlist × tiendas — matching:** score más estricto (tokens numéricos de edición, sin substring, umbrales 0.90/0.70); editorial BGG vs publisher GN y Manufacturer MM; prioridad en UI como texto BGG.
- Validador UX: tooltip de atributos, filtros de overlap (owned + expansiones por defecto), chips deseleccionables.

### Fixed
- `decodeHtmlEntities` / `stripHtmlToText` toleran payloads BGG no-string (evita `text.replace is not a function` al sincronizar plays/things).
- Profile en Fly: sesiones persistidas en volumen (`/data/sessions`) para sobrevivir reinicios; más RAM y grace period de health; UI vuelve al login si llega un 401 de sesión.
- Wishlist × tiendas: falsos positivos de título corto/edición (p. ej. Rum→miniaturas, Compile Main 2→Main 1).
- Cursor I-beam solo en campos editables (regla global CSS).

## [0.2.0] — 2026-07-31

Hito **core personal / single-tenant**: sync on-demand, configuración BGG, actividades, temas y reconcile local↔Fly. Punto estable al que regresar antes de la variante multi-visitante.

### Added
- Health enriquecido en `/api/health`: `dbOk`, `dbPath`, `collectionCount`, `playsCount`, `ts` (sin auth).
- CI GitHub Actions (Node 22): `npm test`, `build`, `build:web`.
- **Sync BGG on-demand:** `POST /api/sync` (colección + partidas incremental, lock, in-place).
- **Configuración BGG:** username editable en SQLite (`app_settings` / `GET`·`PUT /api/settings`), fallback a `BGG_USERNAME`; al cambiar de usuario con datos, wipe confirmado de colección/partidas/`sync_state` (conserva duels/reviews).
- **Reconcile local ↔ Fly:** `npm run db:status` / `db:pull` / `db:push` con unión de tablas de app, reporte de discrepancias, fail-closed y asserts anti-pérdida; `db:upload` queda como alias deprecado.
- Actividad **Shelf of shame**: owned sin partidas, orden antiguos primero (`/api/activities/shelf-of-shame` + UI).
- Actividad **Qué jugar esta noche**: filtros jugadores/tiempo/peso + sugerencias con score y reshuffle (`/api/activities/what-to-play` + UI).
- Actividad **Calendario / rachas**: heatmap del último año, rachas y detalle por día (`/api/activities/play-calendar` + UI).
- Actividad **Wishlist inteligente**: perfil de mesa + gaps, ranking de wishlist/want-to-play con razones tipadas, modos Equilibrio / Más de lo mismo / Cubre huecos (`/api/activities/smart-wishlist` + UI).
- Actividad **Hotness scout**: hot list de BGG puntuada contra el perfil owned (excluye owned; marca wishlist/preordered), API + UI (`/api/activities/hotness-scout`).
- Pestaña **Comandos** en la UI + [`docs/COMMANDS.md`](./docs/COMMANDS.md) en GitHub (sync BGG, reconcile local↔Fly, deploy).
- `TASKS.md` con backlog (export/compartir, wishlist inteligente, auth cookie) y descartados.

### Changed
- Sección **Configuración** (icono engranaje): cuenta BGG, sync on-demand y temas **Ónix** / **Grafito** / **Cartón** (`localStorage`); el botón sync sale del header.
- Sync API/CLI usan username efectivo DB → env e incluyen `username` en la respuesta de sync.
- Fallback SPA: rutas `/api/*` desconocidas responden JSON 404 (no `index.html`).
- Cards / badges Base–Exp: bordes y tintes con tokens de tema (sin hex fijos de Cartón).
- `DEPLOY.md`: sync BGG en Fly (username en UI o secret), reconcile bidireccional, y advertencias contra wipe de datos de app.
- Validador y Partidas: lista de cards en móvil (`md:` tabla); chips/botones con área táctil mayor en móvil.
- Hub de Actividades: entradas para las actividades nuevas (incl. wishlist inteligente y Hotness scout).
- **Qué jugar esta noche:** jugadores con rango de facets (hasta 30) + slider; filtros de categorías, mecánicas y dependencia del idioma (mismo patrón que duel/colección); el pool de sugerencias respeta esos filtros (`poolTotal` en la UI).
- Calendario / rachas: layout horizontal sin scroll H, presets de periodo (1/3/6/12 meses), separadores mes/año, detalle de partida expandible.
- `TASKS.md` actualizado con backlog priorizado y trabajo reciente.
- **Export / compartir (v1):** descarga PNG + copiar texto para ganador del duel y tops del resumen (presencial/virtual).
- **Wishlist inteligente:** copy de fit más honesto (colección vs partidas); owned sin partidas pesan poco; tags de capacidad BGG (p. ej. Solo/Solitaire) con peso bajo y sin headline engañoso.
- **Wishlist inteligente:** solo priorización local (sin llamadas BGG); discovery movido a Hotness scout; UI sin sección de descubrimientos; modal del validador con card del juego.
- **Wishlist inteligente UI:** sin summary duplicado; chips de huecos (mecánicas + diseñadores) como filtro OR; grid 2 cols; CTA validador con borde/icono; `coveredGaps` en sugerencias.
- **Wishlist inteligente / huecos:** chips solo accionables vs wishlist; peso de diseñador repartido entre co-autores; fallback a afinidades presentes en wishlist (`tasteFacets`).

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

[Unreleased]: https://github.com/otroarlequin/bgg-core/compare/v0.3.0...HEAD
[0.3.0]: https://github.com/otroarlequin/bgg-core/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/otroarlequin/bgg-core/compare/v0.1.1...v0.2.0
[0.1.1]: https://github.com/otroarlequin/bgg-core/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/otroarlequin/bgg-core/releases/tag/v0.1.0
