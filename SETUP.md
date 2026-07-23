# Configuración inicial (Fase 0)

Antes de sincronizar datos reales de BoardGameGeek:

1. Registra una aplicación **no comercial** en [boardgamegeek.com/applications](https://boardgamegeek.com/applications).
2. Espera la aprobación (puede tardar una semana o más).
3. Genera un token desde la página de tu aplicación.
4. Copia `.env.example` a `.env` y completa:
   - `BGG_TOKEN` — token Bearer
   - `BGG_USERNAME` — tu nombre de usuario BGG

```bash
cp .env.example .env
npm install
npm run sync:collection
npm run sync:things
npm run sync:plays
```

Sin token, los comandos de sync fallarán con un error claro. Puedes ejecutar `npm test` con fixtures locales mientras esperas.
