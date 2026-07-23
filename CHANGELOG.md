# Changelog

Todos los cambios relevantes de este proyecto se documentan en este archivo.

El formato está basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/),
y el proyecto sigue [Versionado Semántico](https://semver.org/lang/es/).

## [Unreleased]

### Added
- Deploy en Fly.io: Dockerfile, `fly.toml`, volumen SQLite, UI servida desde la API.
- Auth por contraseña compartida (`APP_PASSWORD`, Basic Auth).
- Documentación de sync local + upload de `bgg.db` ([DEPLOY.md](./DEPLOY.md)).

## [0.1.0] — 2026-07-23

Primer release público del core local BGG + interfaz web.

### Added

#### Core / sync / datos
- Sincronización de colección, things y partidas desde la API de BoardGameGeek hacia SQLite local.
- CLI: `sync:collection`, `sync:things`, `sync:plays`, `query:collection`, `activity`, `activity:duel`.
- Configuración por `.env` (`BGG_TOKEN`, `BGG_USERNAME`) documentada en `SETUP.md`.
- API REST local (Hono) en el puerto 3001: summary, collection, plays, activities, bgg lookup.

#### Interfaz web (`web/`)
- App React + Vite + Tailwind con pestañas: Resumen, Colección, Partidas, Actividades.
- Paleta visual **Cartón y tinta** (tokens CSS: surface, accent, ink, muted, etc.).
- **Resumen:** totales de colección/partidas, H-Index, juegos únicos base vs expansiones, tops presencial vs virtual; StatCards clicables hacia colección con presets.
- **Colección:** filtros colapsables (estado, jugadores, créditos, taxonomía), ordenación, cards ricas con portada, stats, créditos, descripción, badge Base/Exp y link BGG.
- **Partidas:** filtros por fecha, resumen colapsable, tabla con thumbnail, ganador, badge de incompleta y detalle expandible.
- **Actividades — Duel ranking:** setup con filtros de pool, continuar/abandonar sesión, comparación pairwise y card de ganador destacada.
- **Actividades — Validador de compras:** búsqueda por URL/ID/nombre, análisis vs colección, overlaps por facetas, guardar/wishlist local.
- Componente estándar `BggLink` / `GameCard` / `GameSubtypeBadge` reutilizables.

#### Actividades (backend)
- Plugin pairwise duel con sesión persistida y filtros de pool.
- Plugin purchase validator (análisis de candidato vs colección).

### Notes

- Los datos locales (`*.db`, `.env`, `data/`) no se versionan.
- La UI se ejecuta en local (`npm run dev`); el hosting remoto se evaluará en un paso posterior.
- No se incluye exposición vía túnel/LAN en este release (retirado a propósito).

[Unreleased]: https://github.com/otroarlequin/bgg-core/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/otroarlequin/bgg-core/releases/tag/v0.1.0
