# Arquitectura — bgg-core

App hecha en **TypeScript** de punta a punta: backend Node y frontend React. No hay Python, Rails ni un framework tipo Next.js.

Documentos relacionados: [README.md](../README.md), [ACTIVITIES.md](./ACTIVITIES.md), [COMMANDS.md](./COMMANDS.md), [DEPLOY.md](../DEPLOY.md), [SETUP.md](../SETUP.md).

**Diagrama de runtime (Archify):** [bgg-core-runtime.html](./architecture/bgg-core-runtime.html) · especificación [bgg-core.runtime.architecture.json](./architecture/bgg-core.runtime.architecture.json).

## Vista general

Hay **dos productos** con el mismo código:

| | Personal (`bgg-core`) | Profile (`bgg-profile`) |
|---|---|---|
| Idea | Tu ludoteca, SQLite durable | Visitantes, sesión temporal |
| Local | API `:3001` + Vite `:5173` | API `:3002` + Vite `:5174/profile` |
| Fly | `bgg-core.fly.dev` | `bgg-profile.fly.dev/profile` |
| Entrada | `src/api/server.ts` | `src/api/profile-server.ts` |
| Docker | `Dockerfile` | `Dockerfile.profile` |

**No** abrir `http://127.0.0.1:5174/` (raíz): ese Vite es modo Profile; la UI “personal” ahí habla con la API Profile y falla (p. ej. `/api/settings`).

Flujo de datos:

```
BGG XML API  →  sync  →  SQLite  →  query  →  Hono REST  →  React
```

## Lenguaje y runtime

- **TypeScript 5** + **Node 20+** (en Fly, **Node 22**).
- Módulos ESM (`"type": "module"`).
- En local el API corre con **tsx** (TypeScript directo). En producción se compila con `tsc` y se sirve `dist/`.
- SQLite nativo de Node: `node:sqlite` (`DatabaseSync`). No hay Prisma ni `better-sqlite3`.
- WAL + foreign keys al abrir la base (`src/storage/database.ts`).

## Backend (`src/`)

| Carpeta | Rol |
|---------|-----|
| `src/bgg/` | Cliente BGG (`bgg-api-ts`) + mappers XML → dominio |
| `src/sync/` | Ingesta: colección, partidas, things (metadatos) |
| `src/storage/` | SQLite, migraciones, repos |
| `src/query/` | Consultas y análisis (resumen, validador, comparador, wishlist…) |
| `src/activities/` | Actividades de producto (duel, validador, comparador…) |
| `src/api/` | HTTP REST con **Hono** |
| `src/profile/` | Sesiones Profile: TTL, cuota, meta, bootstrap de sync |
| `src/cli/` | Sync y actividades por terminal |
| `src/domain/` | Tipos de dominio (`Game`, `CollectionEntry`, `Play`…) |
| `src/config/` | Entorno, token BGG, username efectivo |

**HTTP:** [Hono](https://hono.dev) + `@hono/node-server`. En producción también sirve `web/dist` estático.

**Auth personal:** Basic Auth compartida (`APP_PASSWORD`). **Profile:** cookie `bgg_profile_sid` + admin con `PROFILE_ADMIN_PASSWORD` (sin password → 404, no se anuncia).

**API externa:** solo BoardGameGeek (`xmlapi2` + `BGG_TOKEN`). No hay Postgres, Redis ni cola.

**Aislamiento de DB (Profile):** `AsyncLocalStorage` en `src/api/context.ts`. Cada request de visitante usa su SQLite de sesión; el Core personal usa un `defaultDb` en `BGG_DB_PATH`.

### Rutas API típicas

| Prefijo | Uso |
|---------|-----|
| `GET /api/health` | Salud (personal incluye counts de DB) |
| `/api/summary`, `/api/collection`, `/api/plays` | Consultas de ludoteca |
| `/api/sync`, `/api/settings` | Solo Core personal |
| `/api/activities/*` | Duel, validador, comparador, market, etc. |
| `/api/market-watches` | Price watches (solo Core personal) |
| `/api/cron/*` | Cron acotado (Bearer `CRON_SECRET`; p. ej. market-watches) |
| `/api/profile/*` | Sesión, re-sync NDJSON, admin (solo Profile) |
| `/api/bgg`, `/api/media` | Lookup/proxy BGG y media |

## Frontend (`web/`)

| Pieza | Uso |
|-------|-----|
| **React 19** | UI |
| **Vite 6** | Dev server, build, proxy `/api` |
| **Tailwind CSS 4** | Estilos; tokens `--theme-*` en `web/src/index.css` |
| **TanStack React Query** | Fetch/caché de `/api/...` |

No hay React Router: las pestañas son estado local (`web/src/App.tsx`, `ActivitiesPage.tsx`). El cliente HTTP está en `web/src/api/client.ts`.

**Modo personal vs Profile:** `web/src/appMode.ts` — path `/profile`, puerto `5174` o `vite --mode profile`. En Vite Profile, `/` redirige a `/profile`.

**Temas:** `onix` (default), `grafito`, `carton`; persistidos en `localStorage` (`bgg-core-theme`). Semántica: Base = `accent`; Expansión = `accent-secondary`.

**Cursor:** I-beam solo en campos editables (regla global en `index.css`).

## Actividades (“plugins” internos)

No es un sistema de extensiones de terceros. Cada actividad suele ser:

1. Lógica en `src/query/` y/o `src/activities/<id>/`
2. Ruta en `src/api/routes/activities.ts`
3. Página en `web/src/pages/activities/`
4. Registro en `src/activities/registry.ts` (las que se listan como Activity)

Catálogo completo (objetivo, deps, Personal vs Profile): [ACTIVITIES.md](./ACTIVITIES.md).

Ejemplos: duel ranking, validador, comparador, wishlist inteligente / tiendas / BGG Market, hotness scout, qué jugar esta noche, calendario, shelf of shame.

## Herramientas de desarrollo y deploy

| Tool | Uso |
|------|-----|
| **Vitest** | Tests (`npm test`) |
| **concurrently** | API + Vite a la vez |
| **Docker** | Imagen de API + UI estática |
| **Fly.io** | Hosting + volumen SQLite (`/data`) |
| **GitHub Actions** | CI (test + build) + cron market-watch |
| **Resend** | Email opcional de digest de price watches |
| **dotenv** | `.env` local |
| **Archify** | Diagrama de arquitectura HTML/SVG |

Datos sensibles (`*.db`, `.env`, `data/`) no van al git (`.gitignore`).

**API externa de datos:** BoardGameGeek (`xmlapi2` + token). Las actividades de tiendas llaman además a Game Nerdz / Miniature Market (HTTP). No hay Postgres, Redis ni cola de mensajes.

### Arranque local

```bash
npm run dev              # Personal: :3001 + :5173
npm run dev:profile:all  # Profile: :3002 + :5174/profile
```

Al pedir **reiniciar** en local hay que levantar **ambas** stacks.

### Variables de entorno (resumen)

Personal: `BGG_TOKEN`, `BGG_USERNAME`, `BGG_DB_PATH`, `APP_PASSWORD`, `CORS_ORIGIN`; opcionales de market: `CRON_SECRET`, `RESEND_API_KEY`, `NOTIFY_FROM_EMAIL`.

Profile: las de sync BGG más `PROFILE_SESSIONS_DIR`, `PROFILE_SESSION_TTL_DAYS` (default 30), `PROFILE_MAX_SESSIONS` (10), `PROFILE_PLAYS_YEARS` (1), `PROFILE_ADMIN_PASSWORD`.

Detalle: [`.env.example`](../.env.example), [COMMANDS.md](./COMMANDS.md), [DEPLOY.md](../DEPLOY.md).

## Qué no hay (a propósito)

Prisma, Redux, GraphQL, ORM aparte, auth OAuth de BGG, persistencia durable de Profile en el volumen del Core personal.
