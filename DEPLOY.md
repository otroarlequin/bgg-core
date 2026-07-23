# Deploy en Fly.io

La app corre como un solo servicio: API Hono + UI estática (`web/dist`) + SQLite en un volumen.

Sync con BGG se hace **en tu PC**; luego subes `data/bgg.db` al volumen.

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
fly deploy
```

Si el nombre `bgg-core` está ocupado, cambia `app` en [`fly.toml`](./fly.toml) y vuelve a crear la app.

**Importante:** no uses el wizard de “Launch” de la UI si falla detectando el runtime. El repo ya trae `Dockerfile` + `fly.toml`; despliega desde la CLI:

```bash
fly auth login
fly apps create bgg-core --org personal   # o el org que uses
fly volumes create bgg_data --region lax --size 1
fly secrets set APP_PASSWORD="tu-clave-compartida"
fly deploy
```

Abre: `https://bgg-core.fly.dev` (o la URL que muestre `fly status`).  
El navegador pedirá usuario/contraseña: el **usuario puede ser cualquiera**; importa la contraseña (`APP_PASSWORD`).

## Actualizar el código

```bash
fly deploy
```

## Actualizar la base de datos (tras sync local)

En tu máquina:

```bash
npm run sync:collection
npm run sync:things
npm run sync:plays
```

Sube el archivo **preservando** datos de app en Fly (`duel_sessions`, `duel_rounds`, `purchase_reviews`):

```bash
npm run db:upload
```

El script descarga el `.db` remoto, fusiona esas tablas en tu sync local, hace `rm` + `sftp put` y reinicia la app. Si no hay DB remota, solo sube la local.

Opciones útiles:

```bash
npm run db:upload -- --local-only --old ./tmp/remote.db   # merge sin subir
npm run db:upload -- --skip-download --old ./tmp/remote.db
npm run db:upload -- --app bgg-core --new ./data/bgg.db
```

La máquina debe estar encendida (abre la URL o `fly machine start`).

Upload manual (sin merge; **pierdes** duel/reviews de prod):

```bash
fly ssh console -a bgg-core -C "rm -f /data/bgg.db /data/bgg.db-wal /data/bgg.db-shm"
fly ssh sftp put ./data/bgg.db /data/bgg.db
fly apps restart bgg-core
```

El sync local sigue siendo la fuente de verdad de colección/partidas.

## Healthcheck

`GET /api/health` responde sin auth (para checks de Fly) con `{ ok, dbOk, dbPath, collectionCount?, playsCount?, ts }`.

## Variables

| Variable | Uso |
|----------|-----|
| `APP_PASSWORD` | Basic Auth compartida (secret) |
| `BGG_TOKEN` | Secret: búsqueda/thing en el validador de compras |
| `BGG_USERNAME` | Opcional en Fly (solo sync local) |
| `BGG_DB_PATH` | Default `/data/bgg.db` |
| `WEB_ROOT` | Default `/app/web/dist` |

Para el validador en producción:

```bash
fly secrets set BGG_TOKEN="tu-token" -a bgg-core
```

## Coste / sleep

Con `min_machines_running = 0` la máquina puede apagarse en idle (cold start de unos segundos al entrar desde el celular).
