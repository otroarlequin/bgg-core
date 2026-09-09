# bgg-core

App para sincronizar, explorar y analizar tu ludoteca de [BoardGameGeek](https://boardgamegeek.com): colección, partidas y actividades (duelo, validador, wishlist, market, etc.).

Stack: **TypeScript** · **SQLite** · **Hono** (API) · **React + Vite + Tailwind** (UI).

**Hito actual: [0.3.0 — Profile compartido](./CHANGELOG.md#030--2026-09-09)** — la variante multi-visitante se comparte con más personas vía Profile, junto al core personal.

## Dos productos

| | Personal (`bgg-core`) | Profile (`bgg-profile`) |
|---|---|---|
| Idea | Tu ludoteca, SQLite durable | Visitantes, sesión temporal |
| Local | [http://127.0.0.1:5173/](http://127.0.0.1:5173/) | [http://127.0.0.1:5174/profile](http://127.0.0.1:5174/profile) |
| Fly | [bgg-core.fly.dev](https://bgg-core.fly.dev) | [bgg-profile.fly.dev/profile](https://bgg-profile.fly.dev/profile) |
| Arranque | `npm run dev` | `npm run dev:profile:all` |

No abras la raíz de `:5174` como si fuera personal: ese Vite es modo Profile.

## Requisitos

- Node.js 20+
- Aplicación BGG no comercial + token (detalle en [SETUP.md](./SETUP.md))

## Instalación rápida

```bash
npm install
npm install --prefix web
cp .env.example .env   # completar BGG_TOKEN y BGG_USERNAME
```

Sincroniza datos locales (una vez configurado el token):

```bash
npm run sync:collection
npm run sync:things
npm run sync:plays
```

## Interfaz web (Personal)

```bash
npm run dev
```

Abre [http://localhost:5173](http://localhost:5173). La UI habla con la API local vía proxy `/api` → `localhost:3001`.

| Pestaña | Qué hace |
|---------|----------|
| **Resumen** | Totales de colección/partidas, H-Index, tops (presencial vs virtual) |
| **Colección** | Filtros, ordenación y cards ricas (stats, créditos, Base/Exp, link BGG) |
| **Partidas** | Historial filtrable por fechas, ganadores e incompletas |
| **Actividades** | Diez herramientas (validador, comparador, wishlist, market, duel, mesa…) |
| **Comandos** | Referencia de operación (sync BGG, reconcile local↔Fly, deploy) |
| **Configuración** (⚙) | Cuenta BGG, sync, temas, alertas Market / price watches |

Catálogo detallado de actividades: **[docs/ACTIVITIES.md](./docs/ACTIVITIES.md)**.

## Comandos de operación

Guía completa (arranque, sync BGG, reconcile, deploy, wipe de sesiones Profile, flags):

→ **[docs/COMMANDS.md](./docs/COMMANDS.md)**

```bash
npm run sync:collection && npm run sync:plays && npm run sync:things
npm run db:status && npm run db:pull   # o db:push
npm run fly:status                     # resumen máquinas Fly
npm run dev
npm run dev:profile:all
npm test && npm run build:all
```

Deploy y secrets: **[DEPLOY.md](./DEPLOY.md)**.

## Arquitectura

Capas `BGG → sync → SQLite → query → Hono → React`, dos productos, trust boundaries:

→ **[docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md)**  
→ Diagrama interactivo: **[docs/architecture/bgg-core-runtime.html](./docs/architecture/bgg-core-runtime.html)**

```
src/sync/        Ingesta BGG → SQLite
src/query/       Consultas locales
src/api/         REST (Hono); personal vs profile-server
src/activities/  Actividades (duel, validador, comparador, …)
src/profile/     Sesiones temporales (solo app Profile)
docs/            Guías de operación, actividades y arquitectura
web/             UI React (temas Ónix / Grafito / Cartón)
```

Datos sensibles y locales (`*.db`, `.env`, `data/`) **no** van al repositorio (ver `.gitignore`).

## Changelog

Los cambios relevantes se documentan en [CHANGELOG.md](./CHANGELOG.md). Antes de publicar a GitHub se revisa ese archivo.

## Licencia / uso

Proyecto personal / no comercial. Respeta los [términos de la API de BGG](https://boardgamegeek.com/wiki/page/BGG_XML_API2) y el uso del token de tu aplicación registrada.
