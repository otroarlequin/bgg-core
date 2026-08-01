# syntax=docker/dockerfile:1
# Public ephemeral profile app — no durable volume; sessions on local disk/tmp.

FROM node:22-bookworm-slim AS web-build
WORKDIR /app/web
COPY web/package.json web/package-lock.json ./
RUN npm ci
COPY web/ ./
RUN npm run build

FROM node:22-bookworm-slim AS api-build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
RUN npm run build && npm prune --omit=dev

FROM node:22-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV APP_MODE=profile
ENV HOST=0.0.0.0
ENV PORT=3001
ENV PROFILE_SESSIONS_DIR=/tmp/bgg-profile-sessions
ENV WEB_ROOT=/app/web/dist

COPY package.json package-lock.json ./
COPY --from=api-build /app/node_modules ./node_modules
COPY --from=api-build /app/dist ./dist
COPY src/storage/migrations ./dist/storage/migrations
COPY --from=web-build /app/web/dist ./web/dist

RUN mkdir -p /tmp/bgg-profile-sessions

EXPOSE 3001
CMD ["node", "dist/api/profile-server.js"]
