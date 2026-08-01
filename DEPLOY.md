# Deploy en Fly.io

La app corre como un solo servicio: API Hono + UI estática (`web/dist`) + SQLite en un volumen.

Comandos de operación (sync, reconcile, arranque): ver también [docs/COMMANDS.md](./docs/COMMANDS.md) y la pestaña **Comandos** en la UI.

Hay **dos capas** de sincronización (on-demand, no continua):

1. **Sync BGG** — en **Configuración** (engranaje) o `POST /api/sync`: refresca colección/partidas desde BoardGameGeek **in-place** en la instancia donde estés (local o Fly). No toca duels/reviews. El username se puede editar en Configuración (SQLite); si no hay, usa `BGG_USERNAME`.
2. **Reconcile local ↔ Fly** — CLI (`db:status` / `db:pull` / `db:push`): alinea las dos SQLite cuando lo pidas (p. ej. al volver a casa tras usar Fly).

## Requisitos

- [Fly CLI](https://fly.io/docs/flyctl/install/) (`fly version`)
- Cuenta en [fly.io](https://fly.io) (`fly auth login`)
- Docker local (Fly construye la imagen)

## Primera vez

Desde la raíz del repo:

```bash
fly auth login
fly apps create bgg-core
fly volumes create bgg_data --region lax --size 1
fly secrets set APP_PASSWORD="tu-clave-compartida"
fly secrets set BGG_TOKEN="tu-token"
fly secrets set BGG_USERNAME="tu-usuario-bgg"
fly deploy
```

Si el nombre `bgg-core` está ocupado, cambia `app` en [`fly.toml`](./fly.toml) y vuelve a crear la app.

**Importante:** no uses el wizard de “Launch” de la UI si falla detectando el runtime. El repo ya trae `Dockerfile` + `fly.toml`; despliega desde la CLI.

Abre: `https://bgg-core.fly.dev` (o la URL que muestre `fly status`).  
El navegador pedirá usuario/contraseña: el **usuario puede ser cualquiera**; importa la contraseña (`APP_PASSWORD`).

## Actualizar el código

```bash
fly deploy
```

## Sync BGG (colección / partidas)

Preferido en Fly y en local: **Configuración** → **Sincronizar con BGG**, o:

```http
POST /api/sync
Content-Type: application/json

{ "collection": true, "plays": true }
```

Username: valor en Configuración (`PUT /api/settings`) o, si no hay, secret/env `BGG_USERNAME`. Token: `BGG_TOKEN`. Escribe solo tablas BGG (upsert); **nunca** reemplaza el archivo `.db` ni toca `duel_*` / `purchase_reviews`. Cambiar de usuario con datos existentes borra colección/partidas tras confirmación.

CLI local (equivalente; username DB → env):

```bash
npm run sync:collection
npm run sync:plays
npm run sync:things   # metadatos; no está en el botón
```

## Reconcile local ↔ Fly (datos de app)

Los duels y purchase reviews **no** se pueden recuperar desde BGG. Usa estos comandos on-demand:

```bash
npm run db:status    # reporte de discrepancias (no escribe)
npm run db:pull      # Fly → local (backup en data/backups/)
npm run db:push      # local → Fly (union + asserts; fail-closed)
```

`npm run db:upload` es un **alias deprecado** de `db:push`.

### Flujo al volver a casa

1. `npm run db:status` — ver si Fly tiene duels/reviews nuevos.
2. `npm run db:pull` — bajar datos de app a local.
3. Opcional: sync BGG en local si collection/plays remotos estaban adelante.
4. Si local tiene app data que Fly no: `db:status` → `db:push`.

### Política de merge

- Unión por clave estable; **nunca** borra filas de app en silencio.
- Conflicto (misma clave, distinto contenido): conserva **ambas** y loguea `CONFLICT kept both`.
- `--fail-on-conflict` aborta si hay conflictos.
- Push **exige** download remoto (o `--old <path>`). Si falla el download → **no sube** (salvo `--i-know-this-can-wipe-app-data`, peligroso).
- Tras el merge, asserts de counts; si fallan → aborta sin tocar Fly.

Opciones útiles:

```bash
npm run db:push -- --local-only --old ./tmp/remote.db --out ./data/bgg-merged.db
npm run db:push -- --skip-download --old ./tmp/remote.db
npm run db:status -- --app bgg-core --local ./data/bgg.db
```

La máquina debe estar encendida (abre la URL o `fly machine start`).

### Upload manual (evitar)

```bash
# PELIGRO: sin merge; puedes perder duel/reviews de prod
fly ssh console -a bgg-core -C "rm -f /data/bgg.db /data/bgg.db-wal /data/bgg.db-shm"
fly ssh sftp put ./data/bgg.db /data/bgg.db
fly apps restart bgg-core
```

## Healthcheck

`GET /api/health` responde sin auth (para checks de Fly) con `{ ok, dbOk, dbPath, collectionCount?, playsCount?, ts }`.

## Variables

| Variable | Uso |
|----------|-----|
| `APP_PASSWORD` | Basic Auth compartida (secret) |
| `BGG_TOKEN` | Secret: validador, hotness scout, **sync BGG** |
| `BGG_USERNAME` | Secret: default de username si aún no se guardó otro en Configuración (DB del volumen) |
| `BGG_DB_PATH` | Default `/data/bgg.db` |
| `WEB_ROOT` | Default `/app/web/dist` |

```bash
fly secrets set BGG_TOKEN="tu-token" BGG_USERNAME="tu-usuario" -a bgg-core
```

## Coste / sleep

Con `min_machines_running = 0` la máquina puede apagarse en idle (cold start de unos segundos al entrar desde el celular). El sync BGG y el reconcile son **on-demand** a propósito (no hay sync continuo).

## App pública Profile (visitantes)

Deploy **separado** del core personal: no monta el volumen `/data` de `bgg-core`. Cada visitante obtiene una SQLite temporal (TTL 6 h) tras indicar su username BGG en `/profile`.

```bash
fly apps create bgg-profile
fly secrets set BGG_TOKEN="tu-token" -a bgg-profile
fly deploy -c fly.profile.toml -a bgg-profile
```

- Dockerfile: `Dockerfile.profile` → `node dist/api/profile-server.js`
- Secrets: `BGG_TOKEN` (obligatorio). No uses el volumen ni la DB de la app personal.
- Rate limit: creaciones de sesión por IP; tope global de sesiones concurrentes.
- Local: `npm run dev:profile:all` y abre `http://localhost:5173/profile`.
