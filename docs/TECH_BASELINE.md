# Quad — Technology Baseline

> **This is the single source of truth for technology versions and ecosystem assumptions.** No other doc or code file may independently declare a major version. When a version assumption changes, it changes *here first*, and dependent docs are updated in the same PR.
>
> **Scope:** *major-version assumptions and ecosystem constraints only.* Exact, pinned versions (with patch levels) live in each package's `package.json` and the committed `pnpm-lock.yaml`. This document tells an implementer *which major to install and what to watch for*; `package.json` records *exactly what was installed*.
>
> **Verification status:** Next.js, Prisma, and Auth.js baselines were verified against current documentation via Context7 on **2026-06-23**; the rest were confirmed as the workspace was built. The installed versions of record are the `package.json` files + lockfile. Use §5 when **bumping a major** to re-check the constraints below.

---

## 1. Why a baseline at all

Quad is built primarily by the engineering team across many milestones and many turns. Without one authoritative version list, engineers will silently assume different majors in different files — the classic "architecture drift" failure. This document removes that ambiguity: every engineer reads the same baseline, and any deviation requires an explicit edit here plus an ADR if it changes a contract.

Two principles:

1. **Pin the major, defer the patch.** We commit to a *major version line* (e.g., "Next.js 16.x") so APIs and breaking-change surfaces are known. The precise patch is whatever the lockfile resolves at install time.
2. **Anchor on Node.js.** The Node.js version is the binding constraint that every other tool's support window must intersect. We choose the Node major first, then confirm each tool supports it.

---

## 2. Version Baseline Matrix

| Technology | Assumed major (baseline) | Hard minimum | Role in Quad | Re-verify before impl? |
| --- | --- | --- | --- | --- |
| **Node.js** | **22 LTS** ("Jod"); 24 LTS also supported | 20.9.0 | Runtime for api, web build, tooling | ✅ |
| **TypeScript** | **5.9.x** | 5.4 | Language for all packages (strict) | ✅ |
| **pnpm** | **10.x** | 9.x | Workspace package manager | ✅ |
| **Turborepo** | **2.x** | 2.0 | Monorepo task graph + caching | ✅ |
| **Next.js** | **16.x** *(verified)* | 16.0 | `apps/web` framework | confirm patch |
| **React** | **19.x** | 18.2 (Next 16 floor) | UI library for `apps/web` | ✅ |
| **Fastify** | **5.x** | 5.0 | `apps/api` HTTP + WS server | ✅ |
| **Prisma** | **7.x** *(verified)* | 7.0 | ORM in `@quad/db` | confirm patch |
| **PostgreSQL** | **17** (18 acceptable) | 16 | Primary datastore (events + projections) | ✅ |
| **Redis** | **8.x** (7.4 acceptable) | 7.2 | Cooldown, pub/sub fan-out, presence | ✅ |
| **Auth.js** | **v5** (`@auth/core`, `next-auth@5`) *(verified)* | 5.0 | Authentication | confirm patch + Fastify path |
| **Vitest** | **3.x** | 2.x | Unit/integration test runner | ✅ |
| **Playwright** | **1.x** (latest) | 1.51 | E2E + browser tests | ✅ |
| **Docker** | Engine **28.x**, **Compose v2** | Engine 24 / Compose 2.20 | Local infra + delivery | ✅ |

*"Verified" = checked against current docs via Context7 on 2026-06-23. Others are assumptions pending §5 re-verification.*

---

## 3. Technology Decisions

### 3.1 Node.js — **22 LTS** (24 LTS acceptable)

**Why it belongs in Quad.** Single language across client, server, and tooling; mature ecosystem for Postgres, Redis, and WebSockets; native test runner and `fetch`/Web Streams reduce dependencies. We standardize on an **Active LTS** for production stability.

**Version assumption.** Node **22 LTS** is the baseline because it sits in the intersection of every other tool's support window (see §4). Node **24 LTS** is also acceptable. Pin via `.nvmrc` and `engines`.

**Compatibility risks.**
- ⚠️ **This machine's local Node is v26.3.0** — an *odd-numbered, non-LTS* release. Prisma 7's supported list is `^20.19.0 || ^22.12.0 || ^24.0.0`, which **does not include Node 26**. Developing on Node 26 risks unsupported-runtime errors from Prisma (and others). **Action: install Node 22 LTS (≥22.12) or 24 LTS for this project; do not develop on Node 26.**
- Native addons and some tools lag new majors; staying on LTS avoids this.

**Re-verify:** current Active LTS line and each tool's exact Node support range.

### 3.2 TypeScript — **5.9.x**

**Why it belongs.** Strong typing is a core quality bar (no `any` in the domain). TS is what makes `@quad/core` an *enforced* contract layer: web and api cannot diverge on DTO/event/WS shapes because the types won't compile.

**Version assumption.** **5.9.x** (Prisma 7 recommends 5.9.x; minimum 5.4). `strict: true`, `noUncheckedIndexedAccess`, and project references via `tsconfig.base.json`.

**Compatibility risks.**
- A native/Go-based TypeScript compiler ("TS 7") has been in development and may be in preview by implementation time. **Do not adopt it for the baseline**; keep `tsc` 5.9.x until it is GA and validated against our toolchain (ts-node/tsx, Vitest, Next, Prisma).
- ESM/`moduleResolution: bundler` vs `nodenext` interplay across packages — settle once in `tsconfig.base.json`.

**Re-verify:** latest stable 5.x; TS 7 GA status.

### 3.3 pnpm — **10.x**

**Why it belongs.** Strict, content-addressed store; first-class **workspaces** with a single lockfile and `workspace:*` internal deps that enforce package boundaries — exactly what keeps `@quad/core` the one canonical contract source.

**Version assumption.** **pnpm 10.x**, activated via Corepack (`packageManager` field in root `package.json`).

**Compatibility risks.** pnpm 10 changed lifecycle-script defaults (build scripts must be allow-listed) and some config keys vs pnpm 9 — note in DEPLOYMENT/CONTRIBUTING. Turbo + pnpm filtering syntax must match the installed pnpm major.

**Re-verify:** current pnpm major and Corepack pinning approach.

### 3.4 Turborepo — **2.x**

**Why it belongs.** Gives the monorepo a cached task graph (`build`/`lint`/`typecheck`/`test`) so CI stays fast as code grows and engineers get tight feedback loops. Remote caching optional later.

**Version assumption.** **Turborepo 2.x** (`turbo.json` with `tasks` key — renamed from `pipeline` in v2).

**Compatibility risks.** v2 config schema differs from v1 (`pipeline` → `tasks`); ensure docs/examples use v2 schema. Turbo must understand the installed pnpm workspace layout.

**Re-verify:** current Turbo 2.x minor and `turbo.json` schema.

### 3.5 Next.js — **16.x** *(verified via Context7)*

**Why it belongs.** App Router + React Server Components give a fast, SEO-friendly shell around the canvas; image/font optimization and route handlers cover the marketing/profile/leaderboard/replay pages. The live canvas itself is a client component talking to the Fastify WS server.

**Version assumption.** **Next.js 16.x** (current line is 16.2.x as of 2026-06-23). Confirmed facts:
- **Node.js ≥ 20.9.0** required (`engines`); Node 18 unsupported.
- **React peer range** `^18.2.0 || ^19.0.0` — we target React 19 (see §3.6).
- **Turbopack is the default bundler in v16.** (Stable for dev since 15; default in 16; webpack still selectable if needed.)
- Async request APIs from v15 persist: `cookies()`, `headers()`, `draftMode()`, and route `params`/`searchParams` are **Promises and must be awaited**.

**Compatibility risks.**
- ⚠️ **Turbopack-as-default** may surface incompatibilities with certain plugins/loaders or our canvas/worker tooling. Mitigation: validate the build early; fall back to webpack per-command only if a blocker appears, and record it.
- Auth.js integration lives at the Next layer *or* the Fastify layer — this cross-app decision is made in `AUTHENTICATION.md`/`ADR-0006`, not here.
- App Router async-params breaking change must be reflected in all `FRONTEND.md` examples.

**Re-verify:** latest 16.x patch; whether a newer major has shipped; Turbopack edge cases for our stack.

### 3.6 React — **19.x**

**Why it belongs.** UI library underpinning Next.js; React 19's `use`, Actions, and improved Suspense simplify data flows. The high-performance canvas is a custom imperative renderer (`@quad/render`) mounted in a React client component — React orchestrates, but **does not** re-render per pixel.

**Version assumption.** **React 19.x** (Next 16 floor is 18.2, but we standardize on 19). The optional **React Compiler** (`babel-plugin-react-compiler`) appears in Next 16 peer deps; treat as opt-in, evaluated for the non-canvas UI only.

**Compatibility risks.** React 19 type changes (e.g., `ref` as a prop, stricter JSX types) affect `@quad/ui`. Some third-party component libs may lag 19 — vet each before adding.

**Re-verify:** current React 19.x minor; compiler stability.

### 3.7 Fastify — **5.x**

**Why it belongs.** The product mandates Fastify (preferred) for REST + WebSockets. High throughput, schema-based validation/serialization (pairs naturally with our `@quad/core` contracts), and a strong plugin model (`@fastify/websocket`, `@fastify/redis`, `@fastify/rate-limit`, `@fastify/cors`, `@fastify/helmet`).

**Version assumption.** **Fastify 5.x** (requires Node 20+). JSON Schema validation drives request/response typing; we will generate or align schemas with `@quad/core` types.

**Compatibility risks.** Fastify 5 dropped older Node and changed some plugin APIs vs v4 — only use v5-compatible plugin majors. WebSocket backpressure/scaling is handled via Redis pub/sub fan-out (see `WEBSOCKETS.md`), not Fastify alone.

**Re-verify:** Fastify 5.x minor and the compatible major of each `@fastify/*` plugin.

### 3.8 Prisma — **7.x** *(verified via Context7)*

**Why it belongs.** Type-safe data access and a declarative migration system in `@quad/db`. Generated types complement `@quad/core` domain types. Prisma's migration workflow gives us auditable, spec-backed schema changes (no ad-hoc DDL).

**Version assumption.** **Prisma 7.x**. Confirmed facts:
- New generator: use `provider = "prisma-client"` (not the legacy `prisma-client-js`) with an explicit `output` path — ESM-friendly, generated into the repo.
- **Node.js** `^20.19.0 || ^22.12.0 || ^24.0.0`; **TypeScript 5.4+** (5.9.x recommended).

**Compatibility risks.**
- ⚠️ **Node 26 unsupported** by Prisma 7 (see §3.1) — the single most likely "works locally, breaks here" trap.
- The `prisma-client` generator outputs code to a path that must be git-ignored or committed consistently and resolvable by both `apps/api` and tests — settle in `DATABASE.md`.
- Event-sourcing append-only tables + heavy `PixelEvents` volume need careful indexing/partitioning; Prisma supports it but the schema design (in `DATABASE.md`) carries the weight, not the ORM default.

**Re-verify:** latest Prisma 7.x patch; generator output conventions; recommended connection pooling (driver adapters / external pooler).

### 3.9 PostgreSQL — **17** (18 acceptable)

**Why it belongs.** The durable store for the immutable event log *and* the derived projections. ACID guarantees protect event-sourcing invariants; rich indexing, partitioning, and JSON support fit pixel-event volume and analytics.

**Version assumption.** **PostgreSQL 17** as the conservative production target (18 acceptable if validated). Use partitioning for `PixelEvents` and appropriate indexes for hover/history/leaderboard queries (detailed in `DATABASE.md`).

**Compatibility risks.** Managed-Postgres provider may offer a specific major — align the baseline with the chosen provider in `DEPLOYMENT.md`/`ADR-0010`. Extensions (e.g., `pg_partman`, `pgcrypto`) availability varies by host.

**Re-verify:** provider-supported major; extension availability; logical-replication/backup features for DR.

### 3.10 Redis — **8.x** (7.4 acceptable)

**Why it belongs.** Three jobs: (1) the **global + per-user cooldown** state with low-latency reads/writes; (2) **pub/sub fan-out** so a pixel placement on one api instance reaches all WS clients across instances; (3) **presence** (concurrent-user counts feeding the cooldown load score).

**Version assumption.** **Redis 8.x** (7.4 acceptable). Redis 8 returned to an OSI-approved open-source license (AGPLv3) and folded in modules; this affects licensing posture and image choice.

**Compatibility risks.**
- ⚠️ **Licensing & forks:** between the SSPL/RSALv2 era and Redis 8's AGPLv3, plus the **Valkey** fork, the "redis" image lineage matters. Pick the image/license explicitly in `DEPLOYMENT.md`; Valkey is a drop-in candidate if AGPL is undesirable.
- Pub/sub is fire-and-forget; durability for fan-out is not guaranteed — design WS reconnect/snapshot to tolerate missed messages (see `WEBSOCKETS.md`).

**Re-verify:** current Redis major + license; whether Valkey is the preferred deployment; managed-provider version.

### 3.11 Auth.js — **v5** (`@auth/core` / `next-auth@5`) *(verified via Context7)*

**Why it belongs.** Product mandates Auth.js and forbids custom password auth. MVP uses **email verification restricted to university domains** (`@rutgers.edu`, `@scarletmail.rutgers.edu` for tenant #1); later swaps to official CAS/SSO via a provider — a config change, not a rewrite. Tenant-driven provider selection fits the multi-tenant model.

**Version assumption.** **Auth.js v5.** Confirmed facts:
- `@auth/core` is the **framework-agnostic, runtime-independent core**; framework packages are `@auth/*` (e.g., `@auth/express`), with `next-auth` (v5) being the Next.js integration (historical name).
- v5 requires **Next.js ≥ 14** for the Next integration, enforces stricter OAuth/OIDC, and **deprecates OAuth 1.0**.

**Compatibility risks.**
- ⚠️ **No first-class Fastify package.** Quad's backend is Fastify, but Auth.js is Next-centric. Two viable patterns — (a) auth at the **Next.js layer** (`next-auth@5`) issuing a session/JWT that Fastify REST **and the WebSocket handshake** validate, or (b) **`@auth/core`** mounted directly in Fastify via its request handler (no off-the-shelf adapter). **This decision is owned by `AUTHENTICATION.md` + `ADR-0006`, not this file.**
- **WebSocket auth:** browsers can't set custom headers on the WS handshake — token must travel via cookie or subprotocol/first-message; design carefully (security tests required).
- **Do not** use the Credentials/password provider (violates "never implement custom password authentication"). Use the email/magic-link provider for MVP.

**Re-verify:** Auth.js v5 stable status + latest packages; best-practice Fastify integration; CAS/SSO provider availability for universities.

### 3.12 Vitest — **3.x**

**Why it belongs.** Fast, ESM-native, Vite-powered unit/integration runner with a Jest-compatible API; great TS support and watch mode. Used across all packages for unit + integration layers (the heavy e2e/browser layer is Playwright).

**Version assumption.** **Vitest 3.x**. Workspace/projects config to run per-package suites; coverage via v8.

**Compatibility risks.** Vitest config can couple to a Vite major — keep versions aligned. For DB/Redis integration tests, use Dockerized services (Testcontainers or compose) rather than mocks for critical subsystems.

**Re-verify:** Vitest 3.x minor and its Vite peer; coverage provider.

### 3.13 Playwright — **1.x (latest)**

**Why it belongs.** Cross-browser E2E for canvas interaction (zoom/pan/place), auth flows, replay scrubbing, and mobile (touch) emulation. Also drives accessibility checks and visual snapshots.

**Version assumption.** **Playwright 1.x**, latest. Note Next 16 lists `@playwright/test ^1.51.1` as a peer — keep at/above that.

**Compatibility risks.** Bundled browser binaries must be installed in CI (cache them). Canvas pixel assertions need stable rendering and tolerance handling.

**Re-verify:** current Playwright 1.x; CI browser caching approach.

### 3.14 Docker — Engine **28.x**, Compose **v2**

**Why it belongs.** Docker-first local dev gives every engineer and CI run identical Postgres + Redis (+ apps) via `docker compose up`. Critical for event-sourcing and cooldown tests that need real services. Also the delivery artifact (images) for staging/prod.

**Version assumption.** Modern **Docker Engine (28.x)** and **Compose v2** (the `docker compose` plugin, not legacy `docker-compose`). Multi-stage Dockerfiles per app; `.dockerignore` discipline.

**Compatibility risks.**
- **Docker** is required for local infra + integration testing (the compose Postgres/Redis the integration suite runs against, and the production image builds).
- Apple Silicon vs amd64 image arch must match the deploy target (build multi-arch or pin platform).

**Re-verify:** installed Engine/Compose versions; base-image tags for Node/Postgres/Redis.

---

## 4. Cross-Cutting Compatibility Constraints

1. **Node is the binding constraint.** The intersection of all supported ranges is **Node 22 LTS (≥22.12)** or **Node 24 LTS**:
   - Next 16: `≥20.9.0`
   - Prisma 7: `^20.19.0 || ^22.12.0 || ^24.0.0`
   - Fastify 5: `≥20`
   - ⇒ **Node 22.12+ is the safe sweet spot.** Node 26 (this machine) is **outside Prisma's supported set** — do not use it for the project.
2. **ESM everywhere.** Prisma 7's `prisma-client` generator, Vitest, and modern Next favor ESM. Decide module resolution once in `tsconfig.base.json` and keep all packages consistent.
3. **Turbopack is Next 16's default** — validate the web build under Turbopack early; treat webpack as a documented fallback only.
4. **Async request APIs** (Next 15+): cookies/headers/params/searchParams are Promises — all `apps/web` server code must await them.
5. **Contracts before tools.** `@quad/core` types are the canonical contracts; Prisma-generated types and Fastify JSON schemas must *align with*, not redefine, them.

---

## 5. Major-Version Checklist (when bumping a major)

Run this before changing any major version below; reflect the result in the relevant `package.json` + lockfile, update §2 here in the same PR, and open an ADR if a contract is affected.

- [ ] **Node:** confirm current Active LTS; install 22.12+ or 24 LTS locally; pin `.nvmrc` + `engines`. Stop using Node 26.
- [ ] **Install Docker** (Engine + Compose v2) and verify `docker compose` works.
- [ ] **Re-confirm via Context7/official docs:** TypeScript, React, Fastify, Prisma (patch), Next.js (patch), pnpm, Turborepo, Vitest, Playwright, Redis, PostgreSQL current majors/patches.
- [ ] **Auth.js:** confirm v5 stable status + chosen Fastify/Next integration path (resolve in `AUTHENTICATION.md`/`ADR-0006`).
- [ ] **Redis:** confirm license/image choice (Redis 8 AGPL vs Valkey) and managed-provider version.
- [ ] **PostgreSQL:** confirm managed-provider major + required extensions for partitioning/DR.
- [ ] **Turbopack:** confirm the web build passes under the default bundler.
- [ ] Reconcile every `package.json` against this matrix; no file may declare a major not listed here.

---

## Document control

- **Path:** `docs/TECH_BASELINE.md`
- **Purpose:** The single authoritative source of technology major-version assumptions and ecosystem constraints for Quad; prevents version drift across the corpus and the future codebase.
- **Dependencies:** `docs/PRODUCT.md` (drives which capabilities the stack must serve), `process/SPEC_PLAN.md` (standing rule §0.3). Depended on by every version-specific doc: `ARCHITECTURE`, `FRONTEND`, `BACKEND`, `DATABASE`, `DEPLOYMENT`, and the root config.
- **Acceptance checklist:** ☑ all 14 technologies covered ☑ major-version assumption per tech ☑ "why it belongs" per tech ☑ compatibility risks per tech ☑ re-verify-before-impl notes ☑ exact patch versions deferred to `package.json` ☑ Context7-verified entries dated ☑ Node-intersection constraint stated ☑ no app code / package files created.
- **Open questions:** Auth.js Fastify-vs-Next integration path (→ `AUTHENTICATION.md`/`ADR-0006`); Redis vs Valkey (→ `DEPLOYMENT.md`); Postgres major + host (→ `DEPLOYMENT.md`/`ADR-0010`).
- **Next recommended:** `docs/PRODUCT.md`.

---

`NEXT STEP: ask me to continue with docs/PRODUCT.md`
