# bgg-core

App local para sincronizar, explorar y analizar tu ludoteca de [BoardGameGeek](https://boardgamegeek.com): colección, partidas y actividades (duelo y validador de compras).

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
| **Actividades** | Duel ranking del periodo y validador de compras vs tu colección |

### Scripts útiles

```bash
npm run dev          # API + web
npm run dev:api      # Solo API (puerto 3001)
npm run dev:web      # Solo Vite (puerto 5173)
npm run build:web    # Build de producción del frontend
```

## CLI

La sincronización con BGG es por CLI (rate limits / tokens):

```bash
npm run sync:collection      # Colección (--full para completa)
npm run sync:things          # Metadatos /thing (--force para re-sync)
npm run sync:plays           # Partidas (--full para completa)
npm run query:collection     # Consulta local (--own --min-rating 8)
npm run activity:duel        # Duel ranking por terminal
npm test
```

### Ejemplo duel ranking (CLI)

```bash
npm run activity:duel -- create --from 2026-01-01 --to 2026-06-30
npm run activity:duel -- next
npm run activity:duel -- choose --winner 12345
npm run activity:duel -- result
```

## Arquitectura

```
src/sync/        Ingesta BGG → SQLite
src/query/       Consultas locales
src/api/         REST local (Hono)
src/activities/  Plugins (duel, validador de compras, …)
web/             UI React (paleta Cartón y tinta)
```

Datos sensibles y locales (`*.db`, `.env`, `data/`) **no** van al repositorio (ver `.gitignore`).

## Deploy (Fly.io)

Para acceder desde el celular o compartir con amigos: ver [DEPLOY.md](./DEPLOY.md)  
(API + UI + volumen SQLite, sync local y upload de `bgg.db`, contraseña compartida).

## Changelog

Los cambios relevantes se documentan en [CHANGELOG.md](./CHANGELOG.md). Antes de publicar a GitHub se revisa ese archivo.

## Licencia / uso

Proyecto personal / no comercial. Respeta los [términos de la API de BGG](https://boardgamegeek.com/wiki/page/BGG_XML_API2) y el uso del token de tu aplicación registrada.
