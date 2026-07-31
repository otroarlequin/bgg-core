# Comandos de operación — bgg-core

Referencia de comandos para controlar la app en local y en Fly.  
En la UI también está la pestaña **Comandos** con este mismo resumen.

## Arranque local

```bash
npm install
npm install --prefix web
cp .env.example .env   # BGG_TOKEN + BGG_USERNAME

npm run dev            # API :3001 + web :5173
npm run dev:api        # Solo API
npm run dev:web        # Solo Vite
```

## Sync con BoardGameGeek

Refresca colección y partidas **en la instancia donde estés** (local o Fly). No toca duels ni purchase reviews.

| Cómo | Comando / acción |
|------|------------------|
| UI | Botón **Sincronizar con BGG** (header) |
| API | `POST /api/sync` con body opcional `{ "collection": true, "plays": true }` |
| CLI colección | `npm run sync:collection` (`--full` para completa) |
| CLI partidas | `npm run sync:plays` (`--full` para completa) |
| CLI metadatos | `npm run sync:things` (`--force` para re-sync; no está en el botón) |

En Fly hace falta `BGG_TOKEN` y `BGG_USERNAME` como secrets.

## Reconcile local ↔ Fly

Dos SQLite (PC y volumen Fly). Se alinean **solo cuando lo pidas** (protege duels / reviews).

```bash
npm run db:status    # Reporte de discrepancias (no escribe)
npm run db:pull      # Fly → local (backup en data/backups/)
npm run db:push      # local → Fly (unión + asserts; fail-closed)
```

`npm run db:upload` es alias deprecado de `db:push`.

### Al volver a casa

1. `npm run db:status`
2. `npm run db:pull` si Fly tiene datos de app nuevos
3. Opcional: sync BGG en local si collection/plays remotos iban adelante
4. `npm run db:push` solo si local tiene app data que Fly no

### Flags útiles

```bash
npm run db:status -- --app bgg-core --local ./data/bgg.db
npm run db:push -- --fail-on-conflict
npm run db:push -- --skip-download --old ./tmp/remote.db
npm run db:push -- --local-only --old ./tmp/remote.db --out ./data/bgg-merged.db
```

`--i-know-this-can-wipe-app-data` permite push sin remoto: **peligroso**, puede borrar duels/reviews de prod.

## Deploy (Fly.io)

Detalle completo: [DEPLOY.md](../DEPLOY.md).

```bash
fly deploy
fly secrets set BGG_TOKEN="…" BGG_USERNAME="…" APP_PASSWORD="…" -a bgg-core
fly apps restart bgg-core
fly machine start -a bgg-core   # si está dormida
```

## Otros CLI

```bash
npm run query:collection -- --own --min-rating 8
npm run activity:duel -- create --from 2026-01-01 --to 2026-06-30
npm test
npm run build:all
```

## Qué no hacer

- No subas un `.db` local a Fly con `sftp put` manual sin merge: puedes perder `duel_*` y `purchase_reviews`.
- No uses sync continuo/cron: el diseño es on-demand para no gastar Fly ni rate limit de BGG.
