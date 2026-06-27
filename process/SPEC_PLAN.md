# Quad: Architecture & Documentation Corpus Plan

> **This is the operating manual for building Quad.** It is the durable, in-repo home for the bootstrap "first response": repository strategy, the complete repository tree, the full documentation manifest, the generation order, the quality bar, and the engineering governance model. It exists so that no planning knowledge lives only in a chat log.
>
> **Codename:** `Quad` (packages `@quad/*`). **Tenant #1:** Rutgers. **Repo dir:** `quad-canvas` (tenant-neutral code).
>
> **Governing spec:** [`process/playbooks/000-bootstrap-architecture.md`](playbooks/000-bootstrap-architecture.md).

---

## 0. Standing Rules (approved amendments)

These rules govern every subsequent turn until the owner says otherwise.

1. **Write to the filesystem.** Every deliverable is written as a real repo file, not only shown in chat.
2. **Concise responses after file creation.** Each turn's chat reply: (a) files created/updated, (b) key decisions, (c) unresolved risks, (d) next recommended document/batch. The *content* lives in the files.
3. **Single version baseline.** `docs/TECH_BASELINE.md` is authored early (Phase 1, before any version-specific doc) and is the **only** place major versions/ecosystem assumptions for Next.js, React, TypeScript, Fastify, Prisma, PostgreSQL, Redis, Auth.js, Turborepo, pnpm, Playwright, Vitest, and Docker are declared. Versions must not be scattered elsewhere. Verify current majors via Context7 when authoring it.
4. **Consistency audit.** `docs/CONSISTENCY_AUDIT.md` is produced in Phase 5 and explicitly verifies: every promised file exists; package names consistent; tenant model consistent; API contracts match WebSocket/event/database terminology; no Rutgers hardcoding outside tenant config; no implementation started early; every ADR referenced where relevant; every subsystem has tests + checkpoints.
5. **Scaffolding-only config.** Phase-4 root config files may be created, but they remain scaffolding. No real application implementation. No invented/incomplete app code merely to make scripts pass.
6. **`@quad/core` owns canonical shared contracts:** domain types, DTOs, WebSocket payload schemas, domain event schemas, cooldown calculation types, and tenant config types. No duplicate/divergent definitions anywhere else.
7. **`apps/web` & `apps/api` are package targets only** until the corpus + milestone plan are complete, no real app logic.
8. **No-code rule holds until the explicit signal `START IMPLEMENTATION`.** Documentation/specs/templates/scaffolding only until then.

---

## 1. Repository Strategy

**Decision: Monorepo · pnpm workspaces · Turborepo · Docker-first local dev · spec-first implementation.** (Formalized in `docs/adr/0002-repository-strategy.md`.)

### Why this shape, optimized for *engineering* development

- **Monorepo = one source of truth, atomic cross-cutting PRs.** A pixel placement touches the event schema (`@quad/core`), the DB (`@quad/db`), the API (`apps/api`), the WS contract (`@quad/core`), and the renderer (`@quad/render`/`apps/web`) at once. In a monorepo an engineer changes a contract and all consumers in **one** PR, so the doc-and-contract-update-in-the-same-PR rule is enforceable. Multi-repo would scatter the contract and invite drift, the exact failure mode we must prevent.
- **Shared contracts in `@quad/core` kill duplicated/untyped payloads.** Both `apps/web` and `apps/api` import the same DTOs, WS schemas, and event types. An engineer physically cannot define a second, divergent `PixelPlaced` shape. This is the single biggest lever against architecture drift.
- **pnpm workspaces = strict, fast, content-addressed installs** with a single lockfile and enforced internal dependency boundaries (`workspace:*`). Deterministic for engineers and CI.
- **Turborepo = a task graph with caching.** `build`, `lint`, `typecheck`, `test` run in dependency order and cache, so CI gates stay fast even as the corpus of code grows, engineers get tight feedback loops.
- **Docker-first = reproducible infra.** An engineer (or CI) spins identical Postgres + Redis every run via `docker compose up`. Event-sourcing and cooldown tests need a real DB and a real Redis; Docker removes "works on my machine."
- **Spec-first = engineers code against a spec, not a vibe.** Each milestone references a spec in `specs/` whose acceptance criteria become the test list. This is what lets implementation proceed milestone-by-milestone without losing the plot.

### Boundaries (Clean Architecture)

`@quad/core` (pure domain, no I/O) ← depended on by everything. `@quad/db` wraps persistence behind repositories. `apps/api` orchestrates domain services + transport (REST/WS). `apps/web` is presentation only, **no business logic in components**. Dependencies point inward toward `@quad/core`; nothing in `core` imports an app or an adapter.

---

## 2. Complete Repository Tree

```text
quad-canvas/
├── README.md
├── CONTRIBUTING.md
├── ENGINEERING_CONTEXT.md                         # repo-wide role guides (entry point for the team)
├── LICENSE
├── .gitignore  .editorconfig  .nvmrc
├── .env.example
├── package.json                      # root scripts, workspaces, devDeps
├── pnpm-workspace.yaml
├── turbo.json
├── tsconfig.base.json
├── docker-compose.yml
├── .github/
│   └── workflows/
│       └── ci.yml
│
├── apps/
│   ├── web/                          # Next.js client (scaffolding until START IMPLEMENTATION)
│   │   ├── app/  components/  lib/  public/
│   │   ├── package.json  next.config.* tsconfig.json
│   │   └── tests/                    # component + Playwright specs (later)
│   └── api/                          # Fastify server (scaffolding until START IMPLEMENTATION)
│       ├── src/ (routes/ ws/ services/ projections/ jobs/ plugins/)
│       ├── package.json  tsconfig.json
│       └── tests/
│
├── packages/
│   ├── core/                         # @quad/core, CANONICAL CONTRACTS
│   │   └── src/ (domain/ dto/ events/ ws/ cooldown/ tenant/ index.ts)
│   ├── db/                           # @quad/db, Prisma schema + repositories
│   │   └── prisma/ (schema.prisma migrations/)  src/ (repositories/ client.ts)
│   ├── realtime/                     # @quad/realtime, WS + Redis pub/sub adapters
│   ├── render/                       # @quad/render, canvas rendering engine
│   ├── config/                       # @quad/config, tenant registry, palette, env validation
│   ├── ui/                           # @quad/ui, shared React components + design tokens
│   ├── testing/                      # @quad/testing, fixtures, factories, harnesses
│   ├── eslint-config/                # shared lint config
│   └── tsconfig/                     # shared tsconfig presets
│
├── docs/
│   ├── PRODUCT.md  PRINCIPLES.md  NON_GOALS.md  ROADMAP.md  LAUNCH_PLAN.md
│   ├── TECH_BASELINE.md
│   ├── ARCHITECTURE.md  SYSTEM_CONTEXT.md  FRONTEND.md  BACKEND.md
│   ├── DATABASE.md  EVENT_SOURCING.md  API.md  WEBSOCKETS.md
│   ├── AUTHENTICATION.md  MULTI_TENANCY.md  COOLDOWN.md  RENDERING.md  MODERATION.md
│   ├── REPLAY.md  ARCHIVES.md  ANALYTICS.md  LEADERBOARDS.md  PROFILES.md  HEATMAPS.md
│   ├── ENGINEERING_WORKFLOW.md  MILESTONES.md  CHECKPOINTS.md  TESTING.md
│   ├── SECURITY.md  PERFORMANCE.md  DEPLOYMENT.md  OBSERVABILITY.md
│   ├── OPERATIONS.md  DISASTER_RECOVERY.md  CODE_QUALITY.md  REVIEW_PROCESS.md
│   ├── CONSISTENCY_AUDIT.md
│   └── adr/
│       ├── 0001-record-architecture-decisions.md
│       ├── 0002-repository-strategy.md
│       ├── 0003-event-sourcing.md
│       ├── 0004-websocket-strategy.md
│       ├── 0005-rendering-strategy.md
│       ├── 0006-authentication-strategy.md
│       ├── 0007-multi-tenancy.md
│       ├── 0008-dynamic-cooldown.md
│       ├── 0009-moderation-and-auditability.md
│       └── 0010-deployment-target.md
│
├── specs/
│   ├── features/README.md   api/README.md        websockets/README.md
│   ├── database/README.md   events/README.md     ui/README.md
│   ├── rendering/README.md  security/README.md   moderation/README.md
│   └── testing/README.md
│
├── templates/
│   ├── feature-spec.md            api-endpoint-spec.md      websocket-event-spec.md
│   ├── database-migration-spec.md domain-event-spec.md      ui-component-spec.md
│   ├── canvas-rendering-spec.md   moderation-action-spec.md test-plan-spec.md
│   ├── adr.md  milestone.md  checkpoint.md  bugfix.md  refactor.md  pr-review.md
│
├── process/
│   ├── README.md
│   ├── SPEC_PLAN.md                # this file
│   ├── engineering-rules.md
│   ├── planner-guidelines.md  architect-guidelines.md  frontend-guidelines.md  backend-guidelines.md
│   ├── database-guidelines.md  realtime-guidelines.md  rendering-guidelines.md  security-review.md
│   ├── testing-guidelines.md   devops-guidelines.md     review-guidelines.md
│   └── playbooks/
│       ├── 000-bootstrap-architecture.md    # (exists)
│       ├── milestone-implementation.md  bugfix.md  refactor.md
│       └── verification.md  documentation-update.md
│
├── infra/                            # Dockerfiles, IaC, deploy assets (Phase 4 scaffolding)
├── tests/                            # cross-cutting e2e / load / integration
└── scripts/                          # doc lint, link check, mermaid check, seed helpers
```

---

## 3. Documentation Manifest

Every file the corpus will produce. **Owner** = the subsystem/role the doc primarily serves. **Pages** = rough target. **Phase** = generation phase (see §4). Status is tracked in §7.

### Root files

| Path | Purpose | Owner | Depends on | Pages | Phase |
| --- | --- | --- | --- | --- | --- |
| `README.md` | Public overview, status, quickstart | All | — | 3–5 | T1 ✅ |
| `process/SPEC_PLAN.md` | This corpus plan (strategy/tree/manifest/order/quality/governance) | Engineering | bootstrap playbook | 6–9 | T1 ✅ |
| `ENGINEERING_CONTEXT.md` | Repo-wide the team instructions; entry to `process/` | Engineering | ENGINEERING_WORKFLOW, engineering-rules | 2–4 | 4 |
| `CONTRIBUTING.md` | Contribution + PR workflow, checks, doc-update rule | Process | REVIEW_PROCESS, ENGINEERING_WORKFLOW | 2–3 | 4 |
| `.env.example` | All env vars (commented, no secrets) | DevOps | DEPLOYMENT, TECH_BASELINE | 1–2 | 4 |
| `docker-compose.yml` | Local Postgres+Redis+apps (scaffolding) | DevOps | DEPLOYMENT, TECH_BASELINE | 1–2 | 4 |
| `package.json` · `pnpm-workspace.yaml` · `turbo.json` · `tsconfig.base.json` | Workspace + task graph + TS base (scaffolding) | DevOps | ARCHITECTURE, TECH_BASELINE | 1–2 | 4 |
| `.github/workflows/ci.yml` | CI gates: lint/typecheck/test/build/e2e (scaffolding) | DevOps | TESTING, CODE_QUALITY | 1–2 | 4 |

### Product docs

| Path | Purpose | Owner | Depends on | Pages | Phase |
| --- | --- | --- | --- | --- | --- |
| `docs/PRODUCT.md` | Full product spec & requirements (the handoff, formalized) | Product | README | 6–10 | 1 |
| `docs/PRINCIPLES.md` | Non-negotiable values (fairness, equal power) | Product | PRODUCT | 2–3 | 1 |
| `docs/NON_GOALS.md` | Explicit exclusions (no chat/DMs/marketplace/NFTs…) | Product | PRODUCT | 1–2 | 1 |
| `docs/ROADMAP.md` | Phased delivery roadmap (MVP → beyond) | Product | PRODUCT, MILESTONES | 2–3 | 1 |
| `docs/LAUNCH_PLAN.md` | Launch readiness, license, semester timing, comms | Product | ROADMAP, DEPLOYMENT | 2–3 | 1 |

### Architecture docs

| Path | Purpose | Owner | Depends on | Pages | Phase |
| --- | --- | --- | --- | --- | --- |
| `docs/TECH_BASELINE.md` | **Single** source of versions/ecosystem assumptions | Architecture | PRODUCT | 2–3 | 1 |
| `docs/ARCHITECTURE.md` | System architecture, package boundaries, data flow, diagrams | Architecture | PRODUCT, TECH_BASELINE | 8–12 | 2 |
| `docs/SYSTEM_CONTEXT.md` | C4 context/container view, external actors | Architecture | ARCHITECTURE | 2–4 | 2 |
| `docs/FRONTEND.md` | Web app architecture, component hierarchy, state | Frontend | ARCHITECTURE, RENDERING | 5–8 | 2 |
| `docs/BACKEND.md` | API service architecture, services, jobs, plugins | Backend | ARCHITECTURE | 5–8 | 2 |
| `docs/DATABASE.md` | Schema, Prisma model, ERD, indexing, partitioning | Database | ARCHITECTURE, EVENT_SOURCING | 6–10 | 2 |
| `docs/EVENT_SOURCING.md` | Event log, projections, replay derivation, invariants | Backend | DATABASE | 6–10 | 2 |
| `docs/API.md` | Complete REST contract (all endpoints, DTOs, errors) | Backend | DATABASE, EVENT_SOURCING | 8–12 | 2 |
| `docs/WEBSOCKETS.md` | WS protocol, message contracts, lifecycle, reconnect | Realtime | EVENT_SOURCING, API | 6–9 | 2 |
| `docs/AUTHENTICATION.md` | Auth flow (email MVP → CAS/SSO), session, cross-app | Security | MULTI_TENANCY, API | 5–8 | 2 |
| `docs/MULTI_TENANCY.md` | Tenant model, routing, isolation, config-not-code | Architecture | DATABASE | 5–8 | 2 |
| `docs/COOLDOWN.md` | Dynamic global cooldown algorithm, smoothing, Redis | Backend | EVENT_SOURCING, WEBSOCKETS | 5–8 | 2 |
| `docs/RENDERING.md` | Canvas engine, dirty-region, zoom, batching, mobile | Rendering | FRONTEND, WEBSOCKETS | 6–10 | 2 |
| `docs/MODERATION.md` | Moderation tools, rollback, audit logs, attribution | Moderation | EVENT_SOURCING, DATABASE | 5–8 | 2 |
| `docs/REPLAY.md` | Replay engine (play/scrub/speed), generation | Backend | EVENT_SOURCING, ARCHIVES | 3–5 | 2 |
| `docs/ARCHIVES.md` | Semester freeze, archival, final image/stats | Backend | EVENT_SOURCING, DATABASE | 3–5 | 2 |
| `docs/ANALYTICS.md` | Stats pipeline, metrics derivation | Analytics | EVENT_SOURCING | 3–4 | 2 |
| `docs/LEADERBOARDS.md` | Leaderboard queries, caching, windows | Backend | DATABASE, ANALYTICS | 2–4 | 2 |
| `docs/PROFILES.md` | Profile stats, heatmap per user, streaks | Backend | ANALYTICS, DATABASE | 2–4 | 2 |
| `docs/HEATMAPS.md` | Heatmap generation (contested/edited/density) | Analytics | EVENT_SOURCING, ANALYTICS | 2–4 | 2 |

### Engineering / process docs

| Path | Purpose | Owner | Depends on | Pages | Phase |
| --- | --- | --- | --- | --- | --- |
| `docs/SECURITY.md` | Threat model + mitigations (full abuse model) | Security | AUTHENTICATION, API, WEBSOCKETS | 8–12 | 3 |
| `docs/PERFORMANCE.md` | Concrete, testable performance budgets | Performance | RENDERING, WEBSOCKETS, DATABASE | 4–6 | 3 |
| `docs/DEPLOYMENT.md` | Local/staging/prod, Docker, CI/CD, secrets, migrations | DevOps | ARCHITECTURE, TECH_BASELINE | 6–9 | 3 |
| `docs/ENGINEERING_WORKFLOW.md` | How the team works here: playbooks, stop conditions, drift control | Engineering | engineering-rules | 6–9 | 3 |
| `docs/MILESTONES.md` | Full milestone breakdown (objective→acceptance→tests→risks) | Process | all architecture docs | 8–14 | 3 |
| `docs/CHECKPOINTS.md` | Formal checkpoints + pass criteria + fix-forward | Process | MILESTONES | 3–5 | 3 |
| `docs/TESTING.md` | Test layers, tools, coverage, what blocks merge | Testing | all subsystem docs | 5–8 | 3 |
| `docs/OBSERVABILITY.md` | Logging, metrics, tracing, dashboards, alerts | Ops | DEPLOYMENT, PERFORMANCE | 3–5 | 3 |
| `docs/OPERATIONS.md` | Runbooks, on-call, semester rollover ops | Ops | DEPLOYMENT, OBSERVABILITY | 3–5 | 3 |
| `docs/DISASTER_RECOVERY.md` | Backups, RPO/RTO, restore drills, event-log integrity | Ops | DATABASE, EVENT_SOURCING | 3–4 | 3 |
| `docs/CODE_QUALITY.md` | Standards, linting, typing, architecture fitness rules | Process | ARCHITECTURE | 3–5 | 3 |
| `docs/REVIEW_PROCESS.md` | PR review protocol, size limits, required reviewers | Process | ENGINEERING_WORKFLOW, CODE_QUALITY | 2–4 | 3 |
| `docs/CONSISTENCY_AUDIT.md` | Cross-corpus verification report (see §0.4) | Engineering | entire corpus | 3–5 | 5 |

### Specs (`specs/*/README.md`)

| Path | Purpose | Depends on | Pages | Phase |
| --- | --- | --- | --- | --- |
| `specs/features/README.md` | Index + how to write a feature spec | templates, MILESTONES | 1–2 | 4 |
| `specs/api/README.md` | API spec conventions, error model | API.md, template | 1–2 | 4 |
| `specs/websockets/README.md` | WS spec conventions | WEBSOCKETS.md | 1–2 | 4 |
| `specs/database/README.md` | Migration spec conventions | DATABASE.md | 1–2 | 4 |
| `specs/events/README.md` | Domain event spec conventions | EVENT_SOURCING.md | 1–2 | 4 |
| `specs/ui/README.md` | UI component spec conventions | FRONTEND.md | 1–2 | 4 |
| `specs/rendering/README.md` | Rendering spec conventions | RENDERING.md | 1–2 | 4 |
| `specs/security/README.md` | Security spec conventions | SECURITY.md | 1–2 | 4 |
| `specs/moderation/README.md` | Moderation action spec conventions | MODERATION.md | 1–2 | 4 |
| `specs/testing/README.md` | Test plan spec conventions | TESTING.md | 1–2 | 4 |

### Templates (`templates/*.md`)

| Path | Purpose | Phase |
| --- | --- | --- |
| `feature-spec.md` · `api-endpoint-spec.md` · `websocket-event-spec.md` | Authoring scaffolds for features/API/WS | 4 |
| `database-migration-spec.md` · `domain-event-spec.md` · `ui-component-spec.md` | DB/event/UI scaffolds | 4 |
| `canvas-rendering-spec.md` · `moderation-action-spec.md` · `test-plan-spec.md` | Rendering/moderation/testing scaffolds | 4 |
| `adr.md` · `milestone.md` · `checkpoint.md` · `bugfix.md` · `refactor.md` · `pr-review.md` | Process scaffolds | 4 |

Each spec template includes: Purpose · Requirements · Non-goals · Data-model impact · API impact · WebSocket impact · Security impact · Performance impact · Accessibility impact · Tests required · Acceptance criteria · Regression risks.

### engineering role instructions (`process/*`)

| Path | Purpose | Phase |
| --- | --- | --- |
| `process/README.md` | Map of the engineer operating system | 4 |
| `process/engineering-rules.md` | Rules every engineer follows (guardrails, stop conditions) | 4 |
| `process/planner-guidelines.md` · `architect-guidelines.md` · `review-guidelines.md` | Planning/architecture/review roles | 4 |
| `process/frontend-guidelines.md` · `backend-guidelines.md` · `database-guidelines.md` | Build roles (web/api/db) | 4 |
| `process/realtime-guidelines.md` · `rendering-guidelines.md` · `security-review.md` | Realtime/rendering/security roles | 4 |
| `process/testing-guidelines.md` · `devops-guidelines.md` | Testing/DevOps roles | 4 |
| `process/playbooks/milestone-implementation.md` · `bugfix.md` · `refactor.md` · `verification.md` · `documentation-update.md` | Reusable task playbooks | 4 |

### ADRs (`docs/adr/*`)

| Path | Decision | Phase |
| --- | --- | --- |
| `0001-record-architecture-decisions.md` | Adopt ADRs | 4 |
| `0002-repository-strategy.md` | Monorepo/pnpm/Turbo/Docker/spec-first | 4 |
| `0003-event-sourcing.md` | Event log as source of truth + projections | 4 |
| `0004-websocket-strategy.md` | WS transport, fan-out via Redis pub/sub | 4 |
| `0005-rendering-strategy.md` | Canvas dirty-region rendering approach | 4 |
| `0006-authentication-strategy.md` | Auth.js email MVP → CAS/SSO; no custom passwords | 4 |
| `0007-multi-tenancy.md` | Tenant model & isolation strategy | 4 |
| `0008-dynamic-cooldown.md` | Global load-based cooldown algorithm | 4 |
| `0009-moderation-and-auditability.md` | Reversible, audited moderation; no hard deletes | 4 |
| `0010-deployment-target.md` | Deployment platform & topology | 4 |

### Diagrams (embedded as Mermaid inside the docs above)

System context · container · component (`ARCHITECTURE`/`SYSTEM_CONTEXT`); ERD (`DATABASE`); event flow + pixel-placement sequence (`EVENT_SOURCING`/`API`); WS lifecycle (`WEBSOCKETS`); cooldown sequence (`COOLDOWN`); replay sequence (`REPLAY`); moderation rollback sequence (`MODERATION`); auth flow (`AUTHENTICATION`); multi-tenant routing (`MULTI_TENANCY`); deployment + CI/CD (`DEPLOYMENT`).

---

## 4. Incremental Generation Plan

**Cadence: smart batching.** Big architecture docs are authored **solo** (full reasoning depth). Small, tightly-related files are **batched** per turn. A **checkpoint** ends each phase. Target ≈ **15–25 turns total**, not ~90.

| Phase | Turn(s) | Contents | Mode |
| --- | --- | --- | --- |
| **T1 — Bootstrap** | done | `README.md`, `process/SPEC_PLAN.md` | — |
| **1 — Product** | 2–3 | `TECH_BASELINE` (early) → `PRODUCT` (solo) → batch [`PRINCIPLES`, `NON_GOALS`, `ROADMAP`, `LAUNCH_PLAN`] | solo + 1 batch |
| **2 — Core architecture** | 10–14 | Solo, in dependency order: `ARCHITECTURE` → `SYSTEM_CONTEXT` → `FRONTEND` → `BACKEND` → `DATABASE` → `EVENT_SOURCING` → `API` → `WEBSOCKETS` → `AUTHENTICATION` → `MULTI_TENANCY` → `COOLDOWN` → `RENDERING` → `MODERATION`; then batch [`REPLAY`, `ARCHIVES`, `ANALYTICS`, `LEADERBOARDS`, `PROFILES`, `HEATMAPS`] | solo + 1 batch |
| **3 — Engineering/process** | 2–3 | Solo: `SECURITY`, `PERFORMANCE`, `DEPLOYMENT`, `ENGINEERING_WORKFLOW`, `MILESTONES`; batch [`CHECKPOINTS`, `TESTING`, `OBSERVABILITY`, `OPERATIONS`, `DISASTER_RECOVERY`, `CODE_QUALITY`, `REVIEW_PROCESS`] (`TESTING` may split out) | solo + 1 batch |
| **4 — Scaffolding contracts** | 4 | Batches: all `templates/*`; all `specs/*/README.md`; all `process/*` role guides; ADRs `0001–0010`; root config+docs (`CONTRIBUTING`, `ENGINEERING_CONTEXT.md`, `.env.example`, `docker-compose.yml`, `package.json`, `pnpm-workspace.yaml`, `turbo.json`, `ci.yml`) — **scaffolding only** | batched |
| **5 — Consistency** | 1 | `docs/CONSISTENCY_AUDIT.md` (review workflow) + first-10 implementation tasks | review |

**Dependency rule:** foundational contract docs precede their consumers (PRODUCT → ARCHITECTURE → DATABASE → EVENT_SOURCING → API → WEBSOCKETS → … → rendering/features). Generation order is topological, not the order the bootstrap playbook happened to list files.

### Checkpoint protocol (end of every phase)

Each checkpoint summarizes: **files generated · architectural decisions made · unresolved risks · contradictions found · whether revision is needed before continuing.** If a checkpoint reveals a contradiction, fix it before advancing (fix-forward).

### How to continue

Playbook **"continue"** (or *"continue with `<phase/doc>`"*) to advance to the next phase/batch. To override cadence for a turn, say *"do `<files>` solo"* or *"batch `<files>`"*. To begin coding only after the corpus is complete, say **`START IMPLEMENTATION`**.

---

## 5. Documentation Quality Bar

A doc is "done" only if an engineering engineer could implement against it **without guessing**. Concretely, every architecture/subsystem doc includes:

- **Purpose · Responsibilities · Data ownership · Public interfaces · Internal components · Failure modes · Tests · Performance constraints · Security considerations · Future expansion path.**
- **Named contracts**: exact type/field/event/endpoint names that match `@quad/core` and the other docs (no synonyms; `PixelPlaced` is `PixelPlaced` everywhere).
- **Testable claims**: every performance/SLA/security claim states how it is measured and what threshold blocks merge.
- **Diagrams in Mermaid** where a flow, sequence, schema, or topology is non-trivial.
- **Tenant-neutrality**: examples use tenant config; Rutgers appears only as "tenant #1 / example config," never as a hardcoded assumption.
- **Acceptance checklist + dependencies + next-file pointer** footer on every file (bootstrap requirement).

"Premium" overall = strict TypeScript (no `any` in domain), Clean Architecture + SOLID, event-driven core (event log is truth, projections derive), comprehensive automated testing of critical systems, accessibility, a real threat model, and zero invisible architecture.

---

## 6. engineering Implementation Governance Model

Applies during the (future) implementation phase; defined now so the corpus is built toward it. Full detail → `docs/ENGINEERING_WORKFLOW.md`, `process/engineering-rules.md`, `docs/REVIEW_PROCESS.md`.

### PR size limits
- One milestone = one PR. Soft cap ~400 changed lines of non-generated code / ~10 files. Larger ⇒ split the milestone. No milestone rewrites unrelated subsystems.

### Test requirements
- Every feature ships tests. Critical subsystems, **event sourcing, dynamic cooldown, authentication, WebSockets, rendering, moderation, multi-tenancy isolation**: must have automated tests; **never "manually verified only."** CI runs lint + typecheck + unit + integration + relevant e2e and must be green to merge.

### Documentation requirements
- **Contract change ⇒ doc/spec updated in the same PR.** No undocumented endpoints, WS events, schema changes, or behaviors. New endpoint/event ⇒ spec + `@quad/core` type + doc together.

### Stop conditions (ask for review, don't guess)
- Ambiguous/under-specified product requirement; any change to a public contract (API/WS/event/DB schema); changes to cooldown logic, auth, event-sourcing semantics, or tenant isolation; anything requiring a new ADR; a change that would exceed PR size limits.

### Regression prevention
- Architecture fitness checks (dependency direction, no business logic in components, no DB writes outside repositories). Event-sourcing changes require projection-rebuild tests. Performance-sensitive changes require the relevant `PERFORMANCE.md` budget test. Contract changes are type-enforced by `@quad/core`.

### Review protocol
- Every PR uses `templates/pr-review.md`: verifies spec linkage, acceptance criteria met, tests present + green, docs updated, guardrails respected, no scope creep. Reviewer can reject for missing tests or missing docs alone.

### Hard "never" rules (carried into code)
No undocumented endpoints · no schema change without a migration spec · no business logic in React components · no duplicated DTOs · no bypassing domain services · **no hardcoded tenant assumptions outside tenant config** · no untyped WebSocket payloads · no direct DB writes outside repositories/services · no untested event-sourcing changes · no architectural shortcuts · no hidden global state · no silent cooldown changes · no moderation without audit logs · no auth change without security tests · no rendering rewrite without performance tests · no API change without contract update · no WS event without a schema.

---

## 7. Generation Tracker

Legend: ✅ done · ⏳ in progress · ⬜ pending.

| Phase | Status | Files |
| --- | --- | --- |
| T1 — Bootstrap | ✅ | `README.md`, `process/SPEC_PLAN.md` |
| 1 — Product | ✅ | ✅ `TECH_BASELINE` · ✅ `PRODUCT` · ✅ batch [`PRINCIPLES`, `NON_GOALS`, `ROADMAP`, `LAUNCH_PLAN`] |
| 2 — Core architecture | ✅ | 13 solo docs (`ARCHITECTURE`→`MODERATION`) + derived batch [`REPLAY`, `ARCHIVES`, `ANALYTICS`, `LEADERBOARDS`, `PROFILES`, `HEATMAPS`]; **checkpoint ✅ (§8)** |
| 3 — Engineering/process | ✅ | solo [`SECURITY`, `PERFORMANCE`, `DEPLOYMENT`, `ENGINEERING_WORKFLOW`, `MILESTONES`] + batch [`CHECKPOINTS`, `TESTING`, `OBSERVABILITY`, `OPERATIONS`, `DISASTER_RECOVERY`, `CODE_QUALITY`, `REVIEW_PROCESS`]; **checkpoint ✅ (§8)** |
| 4 — Scaffolding contracts | ✅ | templates (15) + specs READMEs (10) + `process/*` (18) + ADRs `0001–0010` + root config (8) = **61 files, scaffolding-only**; **checkpoint ✅ (§8)** |
| 5 — Consistency | ✅ | `docs/CONSISTENCY_AUDIT.md` — **PASS w/ non-blocking follow-ups** + first foundation-tasks plan; **checkpoint ✅ (§8)**. Corpus cleared for `START IMPLEMENTATION`. |

### Implementation (post-corpus)
`START IMPLEMENTATION` was given and the system is **built and merged to `main`**, the `@quad/*` packages, the `apps/api` and `apps/web` apps (placement, realtime + presence, auth, moderation/admin, archives/replay, profiles/leaderboards, dynamic cooldown), the M50s ops hardening, the CI gates, and a deployable full-stack compose + edge proxy. Repository protection is active (PR-only, `verify` strict, signed/verified commits, no force-push/deletion). The **G1–G5 milestone-group checkpoints have passed** and all MVP acceptance criteria are met; the live current state is maintained in `docs/CHECKPOINTS.md` §4 and `docs/ACCEPTANCE_TRACEABILITY.md`. Remaining for full launch: `LG-9` (legal) and a live cloud deployment.

---

## 8. Phase Checkpoints

### Phase 1: Product ✅ (checkpoint)

- **Files generated:** `docs/TECH_BASELINE.md`, `docs/PRODUCT.md`, `docs/PRINCIPLES.md`, `docs/NON_GOALS.md`, `docs/ROADMAP.md`, `docs/LAUNCH_PLAN.md`.
- **Decisions made:**
  - **Layering enforced**: product truth (`PRODUCT`) is separated from architecture (deferred to Phase 2); `PRINCIPLES` is the constitution with **fairness as the tie-breaker**; `NON_GOALS` adds **anti-backdoor rules**; `ROADMAP` is **product-level (deep-before-broad)** with engineering sequencing deferred to `MILESTONES`; `LAUNCH_PLAN` defines **go/no-go `LG-1…LG-10`** incl. blocking legal + content-policy dependencies.
  - **Traceable ID system** established: `P-*` (product reqs), `PRIN-*` (laws), `NG-*` (non-goals), `LG-*` (launch gates), downstream specs/milestones/tests cite these.
  - **Single version source** = `TECH_BASELINE`; no doc repeats versions. Tenant-neutrality held throughout (Quad platform; Rutgers Quad = tenant #1).
- **Unresolved risks / open questions (carried into later phases):**
  - **Blocking launch deps:** content policy (`P-Q-11`), public-handle/data-exposure policy (`P-Q-1`), software license, university partnership/approval.
  - **Product:** non-member read-only viewing (`P-Q-2`), term-cadence generalization (`P-Q-4`), moderator sourcing/permission ladder (`P-Q-5`), device/IP limits vs shared campus networks (`P-Q-8`).
  - **Tech (from `TECH_BASELINE`):** Node 26 unsupported by Prisma 7 (use Node 22.12+/24); Docker not installed; **Auth.js↔Fastify integration path** → decide in `AUTHENTICATION.md`/`ADR-0006`.
- **Contradictions found:** none, `PRODUCT`/`PRINCIPLES`/`NON_GOALS`/`ROADMAP`/`LAUNCH_PLAN` are mutually consistent.
- **Revision needed before continuing?** **No.** Cleared to begin Phase 2 (core architecture), which must *conform to* these product docs, not redefine them.

### Phase 2: Core architecture ✅ (checkpoint)

- **Files generated (19):** `ARCHITECTURE`, `SYSTEM_CONTEXT`, `FRONTEND`, `BACKEND`, `DATABASE`, `EVENT_SOURCING`, `API`, `WEBSOCKETS`, `AUTHENTICATION`, `MULTI_TENANCY`, `COOLDOWN`, `RENDERING`, `MODERATION` (13 solo) + `REPLAY`, `ARCHIVES`, `ANALYTICS`, `LEADERBOARDS`, `PROFILES`, `HEATMAPS` (derived batch). Each carries an invariant set (`ARCH-INV`, `CTX-INV`, `FE-INV`, `BE-INV`, `DB-INV`, `ES-INV`, `API-INV`, `WS-INV`, `AUTH-INV`, `TENANT-INV`, `COOL-INV`, `RENDER-INV`, `MOD-INV`, `REPLAY-INV`, `ARCHIVE-INV`, `ANALYTICS-INV`, `LEADERBOARD-INV`, `PROFILE-INV`, `HEATMAP-INV`) + Mermaid diagrams + a document-control footer.
- **Architectural decisions made (settled):**
  - Quad is **tenant-neutral**; Rutgers Quad is tenant #1 **config only** (no default tenant; host/subdomain resolution).
  - **`@quad/core` owns all shared contracts**; **`apps/api` is the authoritative backend** (sole decision-maker + sole event-log writer).
  - **Event log is the source of truth**; current canvas, stats, leaderboards, heatmaps, replay, analytics are **projections** (rebuildable, never authoritative).
  - **REST accepts commands + serves snapshots/history; WebSockets broadcast live updates only** (no polling; per-canvas sequence ordering; snapshot-on-reconnect convergence).
  - **Auth authority in `apps/api` via `@auth/core`** (→ `ADR-0006`); **tenant-scoped, revocable sessions**; cookie + origin for the WS handshake; **host-only per-subdomain cookies**.
  - **Cooldown** dynamic, **global per tenant/canvas, bounded 5–20 min, server-enforced**, smoothed, **fail-closed**, no bypass.
  - **Rendering isolated in `@quad/render`**: no transport/business authority; generic feed; crisp; rAF-coalesced.
  - **Moderation = compensating events + atomic audit; no hard delete**; gated destructive actions; sanitized-public / gated-raw replay & archives; archives immutable after seal.
  - **No `DC3` in any public surface**; `DC2`-only attribution everywhere; no public shame/vandalism-incentive leaderboard categories.
- **Unresolved risks carried forward:** ADRs to finalize, `ADR-0005` rendering, `ADR-0006` auth, `ADR-0007` multi-tenancy, `ADR-0008` cooldown, `ADR-0009` moderation/audit/post-archive; snapshot encoding + replay/archive asset formats; public-handle policy + profile visibility defaults (`P-Q-1`); **security threat model / abuse / bot+multi-account mitigation** (`SECURITY.md`); performance budgets, cache TTLs, projection freshness/rebuild cadence (`PERFORMANCE.md`); deployment target, custom domains/TLS, Redis key-protection policy (`DEPLOYMENT.md`); the cross-cutting testing plan (`TESTING.md`).
- **Contradictions found:** **None blocking.** The 19 docs are mutually consistent (cross-tenant→404, `COOLDOWN_ACTIVE`≠`RATE_LIMITED`, sanitized-replay default, per-canvas sequence, snapshot-via-REST/deltas-via-WS, `@quad/core` contracts, `DC2`/`DC3` boundary all agree). One **minor naming nuance** to confirm in Phase 5 `CONSISTENCY_AUDIT`: deployable apps are `apps/web`/`apps/api` while the planning tree once labeled them `@quad/web`/`@quad/api`: reconcile labels (not a design conflict).
- **Revision needed before continuing?** **No.** Phase 2 is **cleared**. Proceed to Phase 3 (engineering/process), beginning with `docs/SECURITY.md`, which must conform to the settled architecture.

### Phase 3: Engineering/process ✅ (checkpoint)

- **Files generated (12):** `SECURITY`, `PERFORMANCE`, `DEPLOYMENT`, `ENGINEERING_WORKFLOW`, `MILESTONES` (solo) + `CHECKPOINTS`, `TESTING`, `OBSERVABILITY`, `OPERATIONS`, `DISASTER_RECOVERY`, `CODE_QUALITY`, `REVIEW_PROCESS` (batch). Invariant sets added: `SEC-INV`, `PERF-INV`, `DEPLOY-INV`, `PROC-INV`, `MILESTONE-INV`, `CHECKPOINT-INV`, `TEST-INV`, `OBS-INV`, `OPS-INV`, `DR-INV`, `QUALITY-INV`, `REVIEW-INV`.
- **Engineering/process decisions made:**
  - **Security** is threat-model-first, boundaries (`B*`) + data classes (`DC*`) + per-surface threats + a **mitigation matrix** (threat·boundary·mitigation·owner·tests·residual).
  - **Performance** budgets are **target + blocking threshold + measurement method** (`B01–B14`); write-load naturally bounded by cooldown; correctness never traded for speed.
  - **Deployment** is provider-neutral; **expand/contract** + backup-first migrations; rollback-ready stateless tiers; tenants by config; no default tenant.
  - **engineering workflow** enforces spec-first, **stop-not-guess**, no fabricated verification, **no commits unless asked**, and **no implementation before `START IMPLEMENTATION`**.
  - **Milestones** define **M0–M59**, gates **G1–G6**, MVP/post-MVP split, one milestone per PR.
  - **Checkpoints** require evidence; fix-forward on failure; G6 = `LG-*` go/no-go.
  - **Testing** makes critical-subsystem tests **merge-blocking**; integration uses **real Postgres/Redis**.
  - **Observability** separates telemetry (`DC5`) from audit (`DC4`); **no `DC3`** in logs/metrics/traces.
  - **Operations** = audited, tenant-scoped runbooks + emergency controls.
  - **DR** prioritizes event log + audit log; backups proven by **restore drills** (`LG-8`).
  - **Code quality** = strict TS, package boundaries, **architecture fitness checks**, forbidden-pattern enforcement.
  - **Review** requires evidence + tests + docs + scope control + **independent** review.
- **Unresolved risks carried forward:** Phase-4 concrete scaffolding (templates, specs, role guides, ADRs, root config, CI, `.env.example`, compose) + exact CI commands/tooling; exact RPO/RTO + provider failover (`ADR-0010`/DR); observability platform + retention windows (provider/deploy); security/dependency/secret scanning tooling (scaffolding); per-milestone spec expansions (Phase-4 `templates/milestone.md`); final consistency audit (Phase 5).
- **Contradictions found:** **None blocking.** The 12 Phase-3 docs are mutually consistent and consistent with Phase 1–2 (gate mapping, `DC4`/`DC5` separation, expand/contract↔DATABASE, DR↔`LG-8`, fitness↔`@quad/core` ownership all agree). Carried forward (non-blocking, for Phase-5 `CONSISTENCY_AUDIT`): the `apps/web`/`apps/api` vs `@quad/web`/`@quad/api` label nuance noted in the Phase-2 checkpoint.
- **Revision needed before continuing?** **No.** Phase 3 is **cleared**. Proceed to **Phase 4 (scaffolding contracts)**: templates/specs/engineers/ADRs/root config, **scaffolding-only** (no app implementation; `START IMPLEMENTATION` still pending).

### Phase 4: Scaffolding contracts ✅ (checkpoint)

- **Files generated (61):**
  - **Templates (15):** `templates/{feature-spec, api-endpoint-spec, websocket-event-spec, database-migration-spec, domain-event-spec, ui-component-spec, canvas-rendering-spec, moderation-action-spec, test-plan-spec, adr, milestone, checkpoint, bugfix, refactor, pr-review}.md`.
  - **Specs READMEs (10):** `specs/{features, api, websockets, database, events, ui, rendering, security, moderation, testing}/README.md`.
  - **`process/*` engineers + playbooks (18):** `process/README.md`, `process/engineering-rules.md`, 11 role guides (`planner`/`architect`/`frontend`/`backend`/`database`/`realtime`/`rendering`/`security`/`testing`/`devops`/`reviewer`), 5 playbooks (`process/playbooks/{milestone-implementation, bugfix, refactor, verification, documentation-update}.md`).
  - **ADRs (10):** `docs/adr/0001–0010` (`record-architecture-decisions`, `repository-strategy`, `event-sourcing`, `websocket-strategy`, `rendering-strategy`, `authentication-strategy`, `multi-tenancy`, `dynamic-cooldown`, `moderation-and-auditability`, `deployment-target`).
  - **Root config/docs (8):** `CONTRIBUTING.md`, `ENGINEERING_CONTEXT.md`, `.env.example`, `docker-compose.yml`, `package.json`, `pnpm-workspace.yaml`, `turbo.json`, `.github/workflows/ci.yml`.
- **Key decisions:** templates = reusable Markdown scaffolds only; specs READMEs = folder conventions (not concrete specs); `process/*` = operating instructions + playbook scaffolds; **ADRs `0001–0009` Accepted** (formalize settled decisions), **`0010` Proposed** (provider deferred); root config is **scaffolding-only**; **no app/package implementation, installs, lockfiles, generated files, app services, Dockerfiles, migrations, source, or tests created**; `START IMPLEMENTATION` remains ungiven; `apps/web`/`apps/api` = app targets, `@quad/*` = packages.
- **Unresolved risks (carried; non-blocking):** `ci.yml` uses `--frozen-lockfile` but no lockfile exists yet (reconcile before CI runs); no `.gitignore` (add: `.env`/`node_modules`/build/coverage/logs/caches/generated), `.nvmrc` (Node 22), `LICENSE` (→ `LAUNCH_PLAN`), or `tsconfig.base.json` (add before TS packages); reconcile `packageManager` patch to the installed toolchain; **`ADR-0010` provider** unresolved; CI security/dep/secret-scan **tooling** unresolved; `apps/web`/`@quad/web` label nuance → Phase-5 audit.
- **Contradictions found:** **None blocking.** All Phase-4 scaffolding is consistent with Phases 1–3 (uses settled package boundaries, version baseline, invariants, and the `START IMPLEMENTATION` gate). The items above are **non-blocking scaffolding gaps/follow-ups, not design contradictions** (e.g., frozen-lockfile-before-lockfile is intended scaffolding state, resolved at `START IMPLEMENTATION`).
- **Revision needed before continuing?** **No.** Phase 4 is **cleared**. Proceed to **Phase 5 (consistency audit + first-10 tasks)**. Implementation does **not** begin until the owner explicitly says `START IMPLEMENTATION`.

### Phase 5: Consistency audit ✅ (checkpoint)

- **Files generated:** `docs/CONSISTENCY_AUDIT.md` (evidence-based whole-corpus audit + the first-10 implementation-tasks plan).
- **Method:** verified against the real filesystem (file listing + targeted `grep`) on 2026-06-24, not asserted.
- **Decisions/findings:**
  - **Manifest complete**: docs 37 + adr 10 + templates 15 + specs 10 + `process/*` 14 + playbooks 6; no promised file missing.
  - **Stale-label nuance RESOLVED**: grep shows **zero `@quad/web`/`@quad/api` usages in corpus content**; the only matches are the self-referential tracking notes in this file's §8. Corpus uses `apps/web`/`apps/api` + `@quad/*` correctly.
  - **Contract/privacy/tenant/security/cooldown/rendering/process consistency verified**: incl. a **cross-doc catalog token extraction** (no variant spellings; `ModerationActionRecorded` event vs `ModerationActionApplied` WS message, and `CanvasSnapshot` vs `CanvasSnapshotAvailable`, confirmed **intentional**); `COOLDOWN_ACTIVE`≠`RATE_LIMITED`; append-only; compensating events; per-canvas sequence; `DC2`/`DC3`; no-default-tenant→404.
  - **No Rutgers hardcoding** in build/config (only `.env.example` example comments).
  - **ADR coverage:** `0001–0009` Accepted, `0010` Proposed (must reach Accepted before *production*, not before foundation work).
  - **Scaffolding-only confirmed** (no app/package source, no app services, no secrets, no lockfile/generated output).
- **Unresolved risks (non-blocking follow-ups):** **✅ applied 2026-06-24**: `.gitignore` (+ removed stray `specs/.DS_Store`), `.nvmrc` (`22`), strict `tsconfig.base.json`, `ci.yml` install softened to `pnpm install` (TODO: restore `--frozen-lockfile`); `LICENSE` kept launch-gated. **✅ Task 2 done (2026-06-24):** installed pnpm 10.0.0, generated `pnpm-lock.yaml` (turbo 2.10.0 / typescript 5.9.3), `--frozen-lockfile` passes + restored in `ci.yml`, `packageManager` already matched (lockfile uncommitted pending owner). **Other deferred:** CI scan tooling; `ADR-0010` provider; **Mermaid lint + relative-link check** (audit items I/J); optional trim of the §8 label-tracking notes.
- **Contradictions found:** **None blocking.** All open items are non-blocking scaffolding follow-ups or intended deferrals.
- **Revision needed?** **No.** **Corpus status: PASS with non-blocking follow-ups.** The documentation/architecture corpus is **cleared for `START IMPLEMENTATION`** (begin with Tasks 1–2 hygiene/lockfile, then package skeletons). Implementation begins only on the owner's explicit `START IMPLEMENTATION`.

---

### Document control

- **Path:** `process/SPEC_PLAN.md`
- **Purpose:** Durable home for the bootstrap planning corpus; operating manual for the engineering build.
- **Dependencies:** `process/playbooks/000-bootstrap-architecture.md`; every file in §3 is generated against this plan.
- **Acceptance checklist:** ☑ repo strategy stated & justified ☑ complete tree ☑ full manifest with path/purpose/owner/deps/pages/phase ☑ topological generation order ☑ quality bar ☑ governance model ☑ all 8 standing amendments captured.
- **Open questions:** Deployment target (cloud vendor), to be resolved in `ADR-0010`/`DEPLOYMENT.md`. Final license, `LAUNCH_PLAN.md`.
- **Next recommended:** **Corpus complete (all 5 phases ✅).** Owner decision, apply `CONSISTENCY_AUDIT.md` §13 pre-impl fixes (first-10 Tasks 1–2: hygiene + lockfile) **then** say **`START IMPLEMENTATION`** to begin the first-10 tasks in order. No implementation until that explicit signal.
