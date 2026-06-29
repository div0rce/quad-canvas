# syntax=docker/dockerfile:1
# Production image for apps/web (Next.js standalone). Multi-stage: build the web + its @quad/* workspace
# deps, then ship a node:22-slim runtime with only the traced standalone output. The browser reaches
# the API same-origin via the edge proxy (DEPLOYMENT.md §9); NEXT_PUBLIC_API_BASE defaults to ''.

FROM node:22-slim AS build
RUN corepack enable
WORKDIR /app
# Keep dependency installation cacheable across source-only edits. pnpm needs every workspace
# manifest to resolve workspace links, while application/config sources are copied afterward.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY --parents apps/*/package.json packages/*/package.json ./
RUN --mount=type=cache,id=pnpm-store,target=/root/.local/share/pnpm/store pnpm install --frozen-lockfile
COPY . .
# Build only web + its workspace deps (it doesn't depend on @quad/db, so no Prisma generate needed).
RUN pnpm exec turbo run build --filter=web

FROM node:22-slim AS runtime
ENV NODE_ENV=production
# Next standalone server honours HOSTNAME/PORT.
ENV HOSTNAME=0.0.0.0
ENV PORT=3000
WORKDIR /app
# Standalone output (monorepo-rooted): the server + traced node_modules, plus static assets which Next
# requires be copied separately. No public/ dir in this app.
COPY --from=build /app/apps/web/.next/standalone ./
COPY --from=build /app/apps/web/.next/static ./apps/web/.next/static
EXPOSE 3000
USER node
# Liveness: the root page renders (no curl in slim — use node's fetch). Honours $PORT.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "apps/web/server.js"]
