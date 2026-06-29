# syntax=docker/dockerfile:1
# Production image for apps/api. Multi-stage: build the whole pnpm/Turbo workspace (the api depends
# on the @quad/* packages), generate the Prisma client, then ship a node:22-slim runtime with the
# built workspace. Run DB migrations separately (pnpm --filter @quad/db db:migrate:deploy), not at boot.

FROM node:22-slim AS api-base
# Prisma's Debian engine requires OpenSSL in both the generation/build stage and the runtime image.
RUN apt-get update -y \
  && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/*

FROM api-base AS build
RUN corepack enable
WORKDIR /app
# Install from lockfile + manifests first so source-only edits reuse the dependency layer. pnpm needs
# every workspace manifest here to resolve workspace links; copy the implementation afterward.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY --parents apps/*/package.json packages/*/package.json ./
RUN --mount=type=cache,id=pnpm-store,target=/root/.local/share/pnpm/store pnpm install --frozen-lockfile
COPY . .
# Turbo builds only the API dependency graph and runs @quad/db's Prisma generation task once. Then
# pnpm deploy creates portable app-specific trees instead of exporting the ~1 GiB development store.
RUN pnpm exec turbo run build --filter=api \
  && pnpm --filter api deploy --prod /prod/api \
  && pnpm --filter @quad/db deploy /prod/db

# Migration runner includes the Prisma CLI + schema/migrations, but not unrelated workspace apps.
FROM api-base AS migrate
WORKDIR /app
# Prisma 7 prepares its bundled schema engine in this tree on first invocation. Give the non-root
# runtime user ownership at image construction; no application directory should need chmod at boot.
COPY --chown=node:node --from=build /prod/db ./
USER node
# Invoke the CLI already bundled by `pnpm deploy` directly. Runtime migration must not resolve a
# package manager, contact the registry, or attempt to mutate the root-owned image filesystem.
CMD ["node", "node_modules/prisma/build/index.js", "migrate", "deploy"]

FROM api-base AS runtime
ENV NODE_ENV=production
# Default listen address inside the container (PORT/HOST overridable). DATABASE_URL/REDIS_URL/
# TRUST_PROXY are injected at deploy time.
ENV HOST=0.0.0.0
ENV PORT=3000
WORKDIR /app
# Ship only the API's production dependencies plus its built workspace packages and generated
# Prisma client. The deployed tree is portable and contains no test/build toolchain.
COPY --from=build /prod/api ./
# `pnpm deploy` rewrites the application manifest and currently omits `type: module`; restore the
# source manifest so Node loads the ESM entrypoint directly instead of warning and reparsing it.
COPY --from=build /app/apps/api/package.json ./package.json
EXPOSE 3000
USER node
# Liveness probe for the container runtime (no curl in slim — use node's fetch). Honors $PORT.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "dist/index.js"]
