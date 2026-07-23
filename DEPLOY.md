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

Sube el archivo (la máquina debe estar encendida; si está dormida, abre la URL una vez o `fly machine start`):

```bash
# PowerShell / bash
fly ssh sftp put ./data/bgg.db /data/bgg.db
```

Luego reinicia para que SQLite reabra el archivo limpio:

```bash
fly apps restart bgg-core
```

**Ojo:** al reemplazar el `.db` pierdes datos solo-de-nube (p. ej. sesiones de duel / reviews del validador guardadas en prod). El sync local es la fuente de verdad de colección/partidas.

## Healthcheck

`GET /api/health` responde sin auth (para checks de Fly).

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
