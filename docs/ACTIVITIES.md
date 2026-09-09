# Actividades — bgg-core

Catálogo de las actividades de producto: objetivo, funcionamiento y dependencias.

Las actividades **no** son plugins de terceros. Cada una suele tener:

1. Lógica en `src/query/` y/o `src/activities/<id>/`
2. Ruta en `src/api/routes/activities.ts` (o página solo-UI con query dedicada)
3. Página en `web/src/pages/activities/`
4. Entrada en el hub [`web/src/pages/ActivitiesPage.tsx`](../web/src/pages/ActivitiesPage.tsx)

| Disponibilidad | Significado |
|----------------|-------------|
| **Personal** | Core (`bgg-core`): SQLite durable, Basic Auth |
| **Profile** | Visitante: cookie de sesión; sin persistencia de duels/reviews/wishlist durable |

Documentos relacionados: [ARCHITECTURE.md](./ARCHITECTURE.md), [COMMANDS.md](./COMMANDS.md), [README.md](../README.md).

---

## Validador de compras

| | |
|--|--|
| **ID** | `purchase-validator` |
| **Objetivo** | Decidir si un juego de BGG encaja con tu colección (owned, wishlist, preordered) antes de comprarlo. |
| **Cómo** | Busca por URL/ID/nombre; analiza overlaps por facetas (mecánicas, categorías, diseñadores…); muestra pool de solapes filtrable; opcionalmente guarda review o marca wishlist. |
| **Deps** | `BGG_TOKEN` para lookup si el juego no está en SQLite local. |
| **Personal** | Persistencia de reviews / wishlist local. |
| **Profile** | Análisis sí; `persist: false` — no guarda durable. |

---

## Comparador de juegos

| | |
|--|--|
| **ID** | `game-compare` |
| **Objetivo** | Confrontar hasta 4 títulos lado a lado (ficha, similitud, diferencias). |
| **Cómo** | Resuelve juegos por búsqueda BGG; calcula similitud Jaccard sobre facetas; resalta atributos que difieren; columnas de ancho uniforme. |
| **Deps** | Datos locales y/o lookup BGG (`BGG_TOKEN`). |
| **Personal / Profile** | Disponible en ambos (sin persistir comparaciones). |

---

## Hotness scout

| | |
|--|--|
| **ID** | `hotness-scout` |
| **Objetivo** | Ver qué de la hot list de BGG encaja con tu mesa owned. |
| **Cómo** | Descarga hot list; puntúa frente al perfil owned; excluye owned; marca wishlist/preordered. |
| **Deps** | `BGG_TOKEN` (llamada de red a BGG). |
| **Personal / Profile** | Ambos. |

---

## Wishlist inteligente

| | |
|--|--|
| **ID** | `smart-wishlist` |
| **Objetivo** | Priorizar wishlist / want-to-play según cómo juegas y huecos de la mesa. |
| **Cómo** | Análisis **local** (sin discovery de red): perfil + gaps; modos Equilibrio / Más de lo mismo / Cubre huecos; razones tipadas; chips de huecos como filtro OR. |
| **Deps** | Colección + wishlist ya sincronizadas. |
| **Personal / Profile** | Ambos (solo lectura/priorización). |

---

## Wishlist × tiendas

| | |
|--|--|
| **ID** | `wishlist-store-match` |
| **Objetivo** | Cruzar wishlist con stock/precio en Game Nerdz y Miniature Market. |
| **Cómo** | Búsqueda en vivo por ítem; match estricto por título/editorial; caché SQLite 24h; rate limit. |
| **Deps** | Red a tiendas; pensado para uso **personal local** (no Amazon ni CSV). |
| **Personal** | Sí. |
| **Profile** | Puede estar limitado por política de producto / rate; no es el foco de visitantes. |

---

## Wishlist × BGG Market

| | |
|--|--|
| **ID** | `wishlist-market` |
| **Objetivo** | Ver ofertas de GeekMarket para ítems de wishlist y detectar novedades al escanear. |
| **Cómo** | Consulta marketplace BGG; filtra condición/orden; alerta in-app de novedades; se combina con **price watches** (umbrales + cron). |
| **Deps** | `BGG_TOKEN`; en Personal, cron opcional (`CRON_SECRET`, Resend). |
| **Personal** | Sí + watches/cron/email. |
| **Profile** | Escaneo de sesión; sin cron durable del visitante. |

---

## Duel ranking del periodo

| | |
|--|--|
| **ID** | `pairwise-duel` |
| **Objetivo** | Elegir el juego más disfrutado de un periodo por comparaciones pairwise hasta coronar ganador. |
| **Cómo** | Crea sesión con filtros de pool; eliges entre dos; avanza hasta completar; export PNG/texto del ganador (Personal). |
| **Deps** | Partidas sincronizadas en el periodo. |
| **Personal** | Sesiones persistidas en SQLite (`duel_*`). |
| **Profile** | Sesión efímera (no durable en el volumen del Core). |

---

## Qué jugar esta noche

| | |
|--|--|
| **ID** | `what-to-play` |
| **Objetivo** | Sugerir 3–5 juegos para la mesa de hoy. |
| **Cómo** | Filtros de jugadores, tiempo, peso, categorías, mecánicas, idioma; score simple; reshuffle; `poolTotal` refleja el pool filtrado real. |
| **Deps** | Colección owned (+ things). |
| **Personal / Profile** | Ambos. |

---

## Shelf of shame

| | |
|--|--|
| **ID** | `shelf-of-shame` |
| **Objetivo** | Empujar a sacar a mesa los owned sin partidas (más antiguos primero). |
| **Cómo** | Lista owned sin plays; orden por antigüedad en colección. |
| **Deps** | Colección + partidas. |
| **Personal / Profile** | Ambos. |

---

## Calendario / rachas

| | |
|--|--|
| **ID** | `play-calendar` |
| **Objetivo** | Ver ritmo de juego: heatmap, racha actual y mejor racha. |
| **Cómo** | Heatmap del último año (presets 1/3/6/12 meses); detalle expandible por día; sin scroll horizontal forzado. |
| **Deps** | Partidas sincronizadas. |
| **Personal / Profile** | Ambos (Profile suele tener ~1 año de plays). |

---

## Relacionado (no es actividad del hub)

| Pieza | Rol |
|-------|-----|
| **Price watches** | Umbrales de precio en Configuración; campana; cron GitHub Actions → `/api/cron/market-watches`. Solo Personal. |
| **Export / compartir** | PNG + texto en duel y tops del resumen (Personal). |
