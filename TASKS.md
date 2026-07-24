# TASKS

Backlog y decisiones de producto para bgg-core.

## Pendiente

1. **Publicar CI en GitHub** — commit local `856aa54` listo; falta `gh auth refresh -s workflow` y `git push`.

## Diferido

- **Auth por sesión / cookie:** dejar Basic Auth y pasar a login con cookie/sesión compartida (mejor UX móvil).
- **Export “sugerencia de la noche”:** tarjeta PNG de Qué jugar esta noche (descartado en v1; se puede retomar).
- **Export Shelf of shame / validador / heatmap:** no en v1.

## Descartado

- **Comparador 1v1 de dos juegos:** confrontar dos títulos concretos lado a lado (fuera de alcance; el duel ranking ya cubre comparación pairwise en un pool).

## Hecho reciente

### Internos / plataforma
- Deploy Fly + Basic Auth + secrets BGG para el validador.
- Health enriquecido (`dbOk`, counts, `ts`).
- `npm run db:upload` con merge de `duel_sessions` / `duel_rounds` / `purchase_reviews`.
- Tests de overlap validador / filtros duel / queries nuevas.
- Workflow CI escrito (Node 22); **aún no está en el remoto**.

### UI
- Paleta Cartón y tinta; `GameCard` / `BggLink` / badges Base–Exp.
- Mobile: matches del validador y partidas como cards; targets táctiles mayores.

### Actividades
- Duel ranking + Validador de compras (previos).
- **Shelf of shame** — owned sin partidas, antiguos primero.
- **Qué jugar esta noche** — score + reshuffle; filtros jugadores (rango amplio), tiempo, peso, categorías, mecánicas, idioma; pool filtrado real + indicador `poolTotal`.
- **Calendario / rachas** — heatmap horizontal sin scroll H, etiquetas de mes, separadores mes/año, presets (1/3/6/12 meses), filtro de fechas, detalle de partida expandible en la misma vista.
- **Wishlist inteligente** — perfil + gaps, ranking local con razones, modos, discovery BGG acotado (diseñadores) con degradación sin token.
- **Export / compartir (v1)** — PNG + texto: ganador del duel; tops presencial/virtual del resumen.
