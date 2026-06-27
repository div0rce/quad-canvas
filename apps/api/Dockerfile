# syntax=docker/dockerfile:1
# Production image for apps/api. Multi-stage: build the whole pnpm/Turbo workspace (the api depends
# on the @quad/* packages), generate the Prisma client, then ship a node:22-slim runtime with the
# built workspace. Run DB migrations separately (pnpm --filter @quad/db db:migrate:deploy), not at boot.

FROM node:22-slim AS build
RUN corepack enable
WORKDIR /app
# Copy the workspace and install with the committed lockfile (reproducible).
COPY . .
RUN --mount=type=cache,id=pnpm-store,target=/root/.local/share/pnpm/store pnpm install --frozen-lockfile
# Generate the Prisma client (the @quad/db build imports it), then build api + its workspace deps.
RUN pnpm --filter @quad/db run db:generate
RUN pnpm run build

FROM node:22-slim AS runtime
ENV NODE_ENV=production
# Default listen address inside the container (PORT/HOST overridable). DATABASE_URL/REDIS_URL/
# TRUST_PROXY are injected at deploy time.
ENV HOST=0.0.0.0
ENV PORT=3000
WORKDIR /app
# Ship the built workspace (api + @quad/* dist, the generated Prisma client, and resolved
# node_modules). It includes dev dependencies — trimming to prod-only is a size optimization
# follow-up (pnpm's prune/deploy paths need a TTY or `inject-workspace-packages`, so they're avoided).
COPY --from=build /app ./
EXPOSE 3000
USER node
# Liveness probe for the container runtime (no curl in slim — use node's fetch). Honors $PORT.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "apps/api/dist/index.js"]
