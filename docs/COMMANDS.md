# Comandos de operación — bgg-core

Referencia de comandos para controlar la app en local y en Fly.  
En la UI también está la pestaña **Comandos** con este mismo resumen.

## Arranque local

```bash
npm install
npm install --prefix web
cp .env.example .env   # BGG_TOKEN + BGG_USERNAME

npm run dev            # API personal :3001 + web :5173
npm run dev:api        # Solo API personal
npm run dev:web        # Solo Vite (proxy → :3001)
npm run dev:profile:all  # API profile :3002 + Vite :5174 → http://localhost:5174/profile
```

> Si dejas `npm run dev` (personal) en :5173, **no** uses esa URL para profile: abre **http://localhost:5174/profile**.

### Profile: política de sesión y admin

| Variable | Default | Uso |
|----------|---------|-----|
| `PROFILE_SESSION_TTL_DAYS` | `30` | Idle TTL (días) |
| `PROFILE_MAX_SESSIONS` | `10` | Tope de sesiones en disco |
| `PROFILE_PLAYS_YEARS` | `1` | Años de partidas en sync |
| `PROFILE_ADMIN_PASSWORD` | — | Admin oculto; sin valor → 404 |
| `PROFILE_SESSIONS_DIR` | `data/profile-sessions` | Directorio de sesiones |

- Re-sync: Configuración → **Actualizar con BGG** (mismo progreso NDJSON que el login).
- Admin: `http://localhost:5174/profile/admin` (password en sessionStorage de la pestaña).
- Fly: `fly secrets set PROFILE_ADMIN_PASSWORD=… -a bgg-profile`

## Sync con BoardGameGeek

Refresca colección y partidas **en la instancia donde estés** (local o Fly). No toca duels ni purchase reviews.

El **username** efectivo es el guardado en Configuración (tabla `app_settings`) o, si no hay, `BGG_USERNAME` del entorno. Al cambiar de usuario en la UI con datos ya sincronizados, se pide confirmación y se borran colección/partidas/`sync_state` BGG (se conservan duels y reviews).

| Cómo | Comando / acción |
|------|------------------|
| UI | **Configuración** (engranaje) → **Sincronizar con BGG** + username editable |
| API settings | `GET` / `PUT /api/settings` (`confirmReplace` si cambia el usuario con datos) |
| API sync | `POST /api/sync` con body opcional `{ "collection": true, "plays": true }` |
| CLI colección | `npm run sync:collection` (`--full` para completa) |
| CLI partidas | `npm run sync:plays` (`--full` para completa) |
| CLI metadatos | `npm run sync:things` (`--force` para re-sync; no está en el botón) |

En Fly hace falta `BGG_TOKEN`. `BGG_USERNAME` sigue siendo el default hasta que guardes otro en Configuración (DB del volumen).

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
