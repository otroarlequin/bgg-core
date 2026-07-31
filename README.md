# bgg-core

App local para sincronizar, explorar y analizar tu ludoteca de [BoardGameGeek](https://boardgamegeek.com): colección, partidas y actividades (duelo, validador, wishlist, hotness, etc.).

Stack: **TypeScript** · **SQLite** · **Hono** (API) · **React + Vite + Tailwind** (UI).

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

## Interfaz web

```bash
npm run dev
```

Abre [http://localhost:5173](http://localhost:5173). La UI habla con la API local vía proxy `/api` → `localhost:3001`.

| Pestaña | Qué hace |
|---------|----------|
| **Resumen** | Totales de colección/partidas, H-Index, tops (presencial vs virtual) |
| **Colección** | Filtros, ordenación y cards ricas (stats, créditos, Base/Exp, link BGG) |
| **Partidas** | Historial filtrable por fechas, ganadores e incompletas |
| **Actividades** | Duel, validador, wishlist inteligente, hotness scout, etc. |
| **Comandos** | Referencia de operación (sync BGG, reconcile local↔Fly, deploy) |

Botón **Sincronizar con BGG** en el header: refresca colección + partidas (`POST /api/sync`).

## Comandos de operación

Guía completa (arranque, sync BGG, reconcile, deploy, flags):

→ **[docs/COMMANDS.md](./docs/COMMANDS.md)**

Resumen rápido:

```bash
# Sync BGG (también: botón en la UI / POST /api/sync)
npm run sync:collection
npm run sync:plays
npm run sync:things

# Reconcile local ↔ Fly (datos de app: duels, reviews)
npm run db:status
npm run db:pull
npm run db:push

# App local
npm run dev
npm test
npm run build:all
```

Deploy y secrets Fly: **[DEPLOY.md](./DEPLOY.md)**.

## Arquitectura

```
src/sync/        Ingesta BGG → SQLite
src/query/       Consultas locales
src/api/         REST local (Hono)
src/activities/  Plugins (duel, validador, …)
docs/            Guías de operación
web/             UI React (paleta Cartón y tinta)
```

Datos sensibles y locales (`*.db`, `.env`, `data/`) **no** van al repositorio (ver `.gitignore`).

## Changelog

Los cambios relevantes se documentan en [CHANGELOG.md](./CHANGELOG.md). Antes de publicar a GitHub se revisa ese archivo.

## Licencia / uso

Proyecto personal / no comercial. Respeta los [términos de la API de BGG](https://boardgamegeek.com/wiki/page/BGG_XML_API2) y el uso del token de tu aplicación registrada.
