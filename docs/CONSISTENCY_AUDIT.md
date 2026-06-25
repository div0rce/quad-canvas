# Quad — Corpus Consistency Audit (Phase 5)

> **Whole-corpus cross-reference / contract-drift audit before any implementation.** Evidence-based: findings below were verified against the real filesystem (file listing + targeted `grep`) on **2026-06-24**, not asserted. This document also contains the proposed **first-10 implementation tasks** (plan only). **No implementation has begun — `START IMPLEMENTATION` remains ungiven.**
>
> **Method:** `find` for manifest completeness; `grep` for label/contract/privacy/tenant consistency across `docs/`, `process/`, `templates/`, `specs/`, and root config. Tenant-neutral (Rutgers Quad = tenant #1).

---

## 1. Manifest Completeness

Counts verified: **docs 37**, **docs/adr 10**, **templates 15**, **specs READMEs 10**, **engineering (top) 14**, **process/playbooks 6** (incl. the historical bootstrap playbook). `docs/CONSISTENCY_AUDIT.md` is this file.

| Group | Expected | Present | Status |
| --- | --- | --- | --- |
| Root files | `README`, `CONTRIBUTING`, `ENGINEERING_CONTEXT`, `.env.example`, `docker-compose.yml`, `package.json`, `pnpm-workspace.yaml`, `turbo.json`, `.github/workflows/ci.yml` | all 9 | ✅ |
| Product docs | `PRODUCT`, `PRINCIPLES`, `NON_GOALS`, `ROADMAP`, `LAUNCH_PLAN` | 5 | ✅ |
| Tech baseline | `TECH_BASELINE` | 1 | ✅ |
| Architecture docs | `ARCHITECTURE`, `SYSTEM_CONTEXT`, `FRONTEND`, `BACKEND`, `DATABASE`, `EVENT_SOURCING`, `API`, `WEBSOCKETS`, `AUTHENTICATION`, `MULTI_TENANCY`, `COOLDOWN`, `RENDERING`, `MODERATION` + derived `REPLAY`, `ARCHIVES`, `ANALYTICS`, `LEADERBOARDS`, `PROFILES`, `HEATMAPS` | 19 | ✅ |
| Engineering/process | `SECURITY`, `PERFORMANCE`, `DEPLOYMENT`, `ENGINEERING_WORKFLOW`, `MILESTONES`, `CHECKPOINTS`, `TESTING`, `OBSERVABILITY`, `OPERATIONS`, `DISASTER_RECOVERY`, `CODE_QUALITY`, `REVIEW_PROCESS` | 12 | ✅ |
| Templates | 15 listed in manifest | 15 | ✅ |
| Specs READMEs | 10 | 10 | ✅ |
| `process/*` engineers + playbooks | `README`, `engineering-rules`, 11 role guides, 5 playbooks (+ `SPEC_PLAN`, bootstrap playbook) | all | ✅ |
| ADRs | `0001–0010` | 10 | ✅ |

**Missing:** none of the promised corpus files.
**Intentionally deferred (until `START IMPLEMENTATION`):** all `apps/*` and `packages/*` source/skeletons; lockfile; generated/build outputs.
**Recommended before `START IMPLEMENTATION` (not yet created — see §13):** `.gitignore`, `.nvmrc`, `LICENSE` (or explicit launch-gate), `tsconfig.base.json`, lockfile (post-install), package/app skeletons (post-gate).

---

## 2. Naming / Package Consistency

- **Platform = Quad; Rutgers Quad = tenant #1** (example/config) — consistent; "Rutgers" appears in 45 files only as tenant-#1/example, and in build/config **only** as commented examples in `.env.example` (no hardcoding in `package.json`/`turbo.json`/`docker-compose.yml`/`ci.yml`). ✅
- **Repo dir remains `rutgers-canvas`** (historical), code tenant-neutral. ✅
- **Deployable apps = `apps/web` / `apps/api`; packages = `@quad/*`** — verified: a repo-wide grep for `@quad/web`/`@quad/api` returns **zero usages in corpus content**; the only matches are the **self-referential tracking notes in `process/SPEC_PLAN.md` §8** that flag this very nuance. **Resolution: the stale-label nuance is effectively closed** — no doc/spec/scaffolding/config uses the stale labels. (Optional tidy: trim the historical tracking notes; non-blocking.) ✅
- **`@quad/core` = canonical shared-contract owner** — asserted consistently across `ARCHITECTURE`/`BACKEND`/`API`/`WEBSOCKETS`/`EVENT_SOURCING`/`CODE_QUALITY` + specs. ✅
- **`apps/web`/`apps/api` are package *targets only*** until implementation (no source exists). ✅

---

## 3. Tenant-Model Consistency

| Check | Result |
| --- | --- |
| Tenant-neutral architecture | ✅ (`MULTI_TENANCY`, `ARCHITECTURE` §8) |
| No hardcoded Rutgers outside config/examples | ✅ (build/config clean; only `.env.example` comments) |
| **No default-tenant fallback** | ✅ (`TENANT-INV-1`; "no default tenant" in 8 files) |
| Unknown host ≠ silent Rutgers | ✅ (unknown host → no context/landing) |
| Cross-tenant reads → `404` | ✅ ("404" in 14 files; `API-INV-11`, `TENANT-INV-2`) |
| Host-only cookies + tenant-scoped sessions | ✅ (`AUTHENTICATION` §9, `MULTI_TENANCY` §9, `ADR-0006/0007`) |
| Operator cross-tenant actions audited | ✅ (`B5`, `TENANT-INV-6`) |

---

## 4. Contract Consistency

Cross-checked `API`/`WEBSOCKETS`/`EVENT_SOURCING`/`DATABASE`/`AUTHENTICATION`/`MULTI_TENANCY`/`COOLDOWN`/`MODERATION`/`RENDERING` + templates/specs:

| Check | Result |
| --- | --- |
| REST commands / WS broadcasts; **no authoritative writes over WS** | ✅ (`API` §16, `WEBSOCKETS` §10, `ADR-0004`) |
| **`PixelPlaced`** + event/message names consistent | ✅ (cross-doc token extraction — see evidence below) |
| **Per-canvas sequence** ordering naming | ✅ (10 files; `ES-INV-4`/`WS-INV-4`/`RENDER-INV-4`) |
| **`COOLDOWN_ACTIVE` vs `RATE_LIMITED`** distinct | ✅ (10 / 9 files; `API` §8, `COOLDOWN`, `ADR-0008`) |
| Idempotency-key rules | ✅ (`API-INV-6`, `ES-INV-6`, `DB-INV-8`) |
| **Append-only** event log | ✅ (21 files; `ES-INV-2`, `DB-INV-1`) |
| Projections as derived read models | ✅ (`EVENT_SOURCING`/`DATABASE` + all derived-feature `*-INV-1`) |
| Moderation via **compensating events + audit** | ✅ ("compensating event" in 16 files; `MOD-INV-1/2`) |
| Replay/archive public **sanitization** terminology | ✅ (`EVENT_SOURCING` §15, `REPLAY`, `ARCHIVES`, `MODERATION`) |
| No duplicate DTOs outside `@quad/core` | ✅ (asserted; enforceable via `CODE_QUALITY` §7 fitness check at impl) |

**Catalog-name evidence (not just presence counts):** a cross-doc token extraction over `docs/` of the full event/WS/error catalog found **no variant spellings** — each name appears with one canonical spelling across the docs that must agree (`EVENT_SOURCING` §7 ↔ `WEBSOCKETS` §8 ↔ `API` §8/§12 ↔ `MODERATION`/`RENDERING`/`REPLAY`). Two near-collisions were checked and are **intentional, not drift:**
- **`ModerationActionRecorded`** (domain/audit *event*, `EVENT_SOURCING`) vs **`ModerationActionApplied`** (WS broadcast *message*, `MODERATION`/`WEBSOCKETS`) — distinct concepts by design.
- **`CanvasSnapshot`** vs **`CanvasSnapshotAvailable`** — both defined in `WEBSOCKETS` §8 (optional inline payload vs the "fetch a fresh snapshot" signal).

**Error codes** (`COOLDOWN_ACTIVE`, `RATE_LIMITED`, `WS_*`, …) extract with consistent spellings; `COOLDOWN_ACTIVE` and `RATE_LIMITED` remain distinct. **No contract-term drift detected.** (Authoritative type *declarations* will live in `@quad/core` at implementation; this audit verifies the documented names are mutually consistent.)

---

## 5. Privacy / Data-Class Consistency

- **`DC2` public attribution only; no `DC3` in public surfaces** — consistent (`DC3` referenced in 45 files, `DC2` in 30, always with the boundary rule). ✅
- **No `DC3` in normal logs/metrics/traces** — `OBSERVABILITY` §3/§9, `SECURITY` §16, `BE-INV-10`. ✅
- **`DC4` audit separate from `DC5` telemetry** — `OBSERVABILITY`, `SECURITY`, `MODERATION`. ✅
- **Raw replay/history gated; public replay/archive sanitized** — `EVENT_SOURCING`/`REPLAY`/`ARCHIVES`/`MODERATION`. ✅

---

## 6. Security Consistency

| Check | Result |
| --- | --- |
| No anonymous writes | ✅ (`PRIN-NO-ANON`, `SEC-INV-2`, `AUTH-INV-1`) |
| No custom passwords; email MVP / SSO later | ✅ (`AUTHENTICATION`, `ADR-0006`) |
| Server-side revocable sessions | ✅ (`AUTHENTICATION` §9, revoke-on-ban) |
| Cookie + origin WS auth | ✅ (`WEBSOCKETS` §5, `AUTHENTICATION` §11) |
| CSRF/session-storage unresolved items tracked | ✅ (deferred to `ADR-0006`; flagged here §12/§13) |
| Protected-area changes stop + may need ADR | ✅ (`ENGINEERING_WORKFLOW` §8, `security-engineer`) |
| Security tests required for protected areas | ✅ (`SECURITY` §18, `TESTING` §5) |

---

## 7. Cooldown / Fairness Consistency
Global per tenant/canvas · bounded **5–20 min** · server-enforced · Redis/Valkey ephemeral · **fail-closed** · in-flight timers fixed at placement · **no individual advantage** — all consistent across `COOLDOWN`, `PRODUCT` §8, `BACKEND` §13, `API` §8, `WEBSOCKETS` §17, `ADR-0008` (`COOL-INV-1…12`). ✅

---

## 8. Rendering Consistency
`@quad/render` owns the engine only · **no REST/WS I/O** · no business logic · 2D Canvas baseline · dirty-region/rAF · crisp pixels · `apps/web` owns accessibility wrappers · WebGL/tiling deferred to evidence — consistent across `RENDERING`, `FRONTEND` (seam), `ADR-0005`, `specs/rendering` (`RENDER-INV-1…11`). ✅

---

## 9. Testing / Review / Process Consistency
One milestone per PR · tests before claims · no fabricated results · integration on **real Postgres/Redis** · missing tests **or** docs can block merge · independent reviewer · **no commit/merge unless asked** · checkpoint gates required · no skipped critical gates — consistent across `ENGINEERING_WORKFLOW`, `MILESTONES`, `TESTING`, `REVIEW_PROCESS`, `CODE_QUALITY`, `CHECKPOINTS`, `process/*`. ✅

---

## 10. ADR Coverage

| ADR | Decision | Status |
| --- | --- | --- |
| 0001 | Record architecture decisions | **Accepted** |
| 0002 | Repository strategy | **Accepted** |
| 0003 | Event sourcing | **Accepted** |
| 0004 | WebSocket strategy | **Accepted** |
| 0005 | Rendering strategy | **Accepted** |
| 0006 | Authentication strategy | **Accepted** |
| 0007 | Multi-tenancy | **Accepted** |
| 0008 | Dynamic cooldown | **Accepted** |
| 0009 | Moderation & auditability | **Accepted** |
| 0010 | Deployment target | **Proposed** |

- **Additional ADRs needed before implementation?** No new ADR is *required* to start foundation work; the deferred sub-decisions (CSRF/session storage `0006`, RLS/config-sync `0007`, cooldown tuning `0008`, gating/retention/post-archive `0009`) are amendments to existing ADRs and can be resolved when their milestone arrives.
- **`ADR-0010` must be Accepted before production deployment** (gate G6 / `LG-*`). ✅ tracked.

---

## 11. Scaffolding Audit (Phase 4 stayed scaffolding-only)

- No app/package implementation; **no `apps/*` or `packages/*` source** present (verified by file listing). ✅
- `docker-compose.yml` defines **datastores only** (Postgres/Redis + commented MinIO) — **no app services**. ✅
- No real secrets (`.env.example` placeholders only; comments forbid committing real secrets). ✅
- No lockfile / install output / migrations / tests / source. ✅
- Root config is task/workspace/CI scaffolding only. ✅
- **Non-blocking gaps flagged:** `.gitignore`, `.nvmrc`, `LICENSE`, `tsconfig.base.json`; `ci.yml` `--frozen-lockfile` with no lockfile yet; `packageManager` patch reconciliation; CI scan-tooling placeholders; `ADR-0010` provider unresolved; **stray `specs/.DS_Store`** present (should be ignored/removed).

---

## 12. Contradictions Found

| # | Issue | Severity | Affected files | Recommendation | Owner phase |
| --- | --- | --- | --- | --- | --- |
| A | Stale `@quad/web`/`@quad/api` labels | **follow-up (resolved)** | `process/SPEC_PLAN.md` §8 notes only (no real usage) | Optionally trim tracking notes; corpus content already correct | Phase 5 (optional) |
| B | `ci.yml` `--frozen-lockfile` but no lockfile | **non-blocking** | `.github/workflows/ci.yml` | Reconcile when lockfile is generated at `START IMPLEMENTATION` | Task 2 |
| C | Missing `.gitignore` (+ stray `.DS_Store`) | **non-blocking** | repo root, `specs/.DS_Store` | Add `.gitignore`; remove `.DS_Store` | Task 1 |
| D | Missing `.nvmrc` / `tsconfig.base.json` | **non-blocking** | repo root | Add before TS package work | Task 1 |
| E | `LICENSE` undecided | **non-blocking** | repo root | Decide or keep explicitly launch-gated (`LAUNCH_PLAN`) | Task 1 / launch |
| F | `packageManager` example patch (`pnpm@10.0.0`) | **non-blocking** | `package.json` | Reconcile to installed patch | Task 2 |
| G | `ADR-0010` provider Proposed | **non-blocking (blocks prod)** | `docs/adr/0010` | Accept before production (G6) | M54–M59 |
| H | CI scan tooling = placeholder | **non-blocking** | `.github/workflows/ci.yml` | Choose SCA/secret-scan tools | DevOps/impl |
| I | **Mermaid syntax not yet linted** | **non-blocking** | all docs (~40 diagrams) | Run a mermaid lint (or render-check) pass; watch hexagon `{{…}}`, `alt/else/end`, and `[...]` labels containing `(`/`×`/quotes | Phase-5 follow-up / impl CI |
| J | **Relative doc links not yet verified** | **non-blocking** | cross-doc `[...](../..)` links | Run a markdown link-check | Phase-5 follow-up / impl CI |

**No blocking contradictions found.** All items are non-blocking scaffolding follow-ups or intended deferrals. **Note on verification scope:** this audit verified manifest completeness, naming/label, tenant, contract-catalog, privacy, security, cooldown, rendering, process, ADR, and scaffolding consistency via filesystem + grep evidence; it did **not** lint Mermaid syntax or check relative-link integrity (items I/J) — both are cheap follow-ups, runnable as a `scripts/` doc-lint in CI at implementation.

---

## 13. Required Fixes Before `START IMPLEMENTATION`

**Done (applied 2026-06-24, scaffolding/hygiene only):**
- ✅ Added `.gitignore` (ignores `.env`*, `node_modules`, `dist`/`.next`/`.turbo`/build, coverage, logs, `.DS_Store`, generated; keeps `.env.example`).
- ✅ Removed stray `specs/.DS_Store`.
- ✅ Added `.nvmrc` (`22`, per `TECH_BASELINE`).
- ✅ Added strict `tsconfig.base.json` (module/moduleResolution/jsx/paths left per-package).
- ✅ `LICENSE` kept **launch-gated** (no file; documented in `README.md` + `LAUNCH_PLAN.md`).
- ✅ `ci.yml` install softened to `pnpm install` with a TODO to restore `--frozen-lockfile` once the lockfile exists.

**Task 2 — ✅ completed (2026-06-24, `START IMPLEMENTATION`):**
- ✅ Installed pnpm **10.0.0** (`npm i -g pnpm@10`; corepack not bundled with this Homebrew Node).
- ✅ `pnpm install` generated **`pnpm-lock.yaml`** (resolved `turbo 2.10.0`, `typescript 5.9.3` — align with `TECH_BASELINE` majors).
- ✅ `pnpm install --frozen-lockfile` passes (exit 0) → `ci.yml` install **restored to `pnpm install --frozen-lockfile`**.
- ✅ `packageManager` (`pnpm@10.0.0`) already matches the installed pnpm — no change needed.
- ℹ️ Lockfile is generated but **uncommitted** (no commit until the owner asks).

**Optional (non-blocking):** trim the historical `@quad/web`/`@quad/api` tracking notes in `SPEC_PLAN.md` §8 (no real usage remains).

---

## 14. First-10 Implementation Tasks (PLAN ONLY — not implementation)

Dependency-ordered, milestone-aligned, foundation-first. **Each runs only after `START IMPLEMENTATION`.** Common to all: obey `process/engineering-rules.md`; one milestone/PR; tests + evidence (no fabrication); contract change ⇒ `@quad/core` + docs same-PR; no commit unless asked.

| # | Milestone | Lane | Objective | Allowed files/packages | Forbidden scope | Prereq docs/specs/templates | Tests/verification | Stop conditions | Deliverable | MVP-blocking |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | M0 | DevOps | Root hygiene: `.gitignore` (+rm `.DS_Store`), `.nvmrc`, `tsconfig.base.json`, license decision placeholder | those root files | app/package source | `DEPLOYMENT`, `TECH_BASELINE`, `CODE_QUALITY` | repo lints clean; `.env`/`node_modules` ignored | license ambiguity → keep launch-gated | clean repo hygiene baseline | ✅ |
| 2 | M0 | DevOps | Install + generate lockfile; reconcile `packageManager` patch; align `ci.yml` frozen-lockfile | `package.json`, lockfile, `ci.yml` | app/package source | `TECH_BASELINE`, `DEPLOYMENT` §14 | `pnpm install` succeeds; CI install step green | toolchain version mismatch → reconcile to baseline | reproducible install + green CI install | ✅ |
| 3 | M0 | DevOps/Architect | Workspace **package skeletons only** (empty `apps/*`, `packages/*` with `package.json`+`tsconfig`) | `apps/web`, `apps/api`, `@quad/*` shells | any business logic | `ARCHITECTURE` §3, `CODE_QUALITY` §4 | `pnpm -r build` no-ops green; boundaries resolve | boundary/dep-direction violation → stop | workspace graph builds | ✅ |
| 4 | M3 | Architect | `@quad/core` skeleton — contract namespaces (domain/dto/events/ws/cooldown/tenant) as typed stubs | `@quad/core` | I/O, tenant literals | `ARCHITECTURE` §7, `EVENT_SOURCING`, `API`, `WEBSOCKETS` | typecheck; importable by web+api | needs a real contract decision → ADR | canonical contract package (stubs) | ✅ |
| 5 | M4 | Backend | `@quad/config` skeleton — tenant registry + palette + env validation shape (Rutgers = tenant #1 config) | `@quad/config` | tenant literals in logic | `MULTI_TENANCY`, `TECH_BASELINE` | config validates at load; tenant-neutral | default-tenant temptation → stop (none allowed) | tenant config package (stub) | ✅ |
| 6 | M5 | Database | `@quad/db` skeleton — Prisma setup + tenants/users/memberships/canvases schema + migration runner (no event log yet) | `@quad/db` | event-log semantics (M6), business logic | `DATABASE`, `templates/database-migration-spec` | migrate up/down; tenant-scoped uniqueness | schema change w/o migration spec → stop | DB foundation (no events) | ✅ |
| 7 | M8 | Backend | `apps/api` skeleton — Fastify app + plugins (config/tenant-resolver/error/health) + `/healthz` `/readyz` | `apps/api` | domain logic, event append (later) | `BACKEND`, `API`, `MULTI_TENANCY` | health/readiness 200; tenant context attached | unknown-host handling ambiguity → stop | runnable api shell | ✅ |
| 8 | M9 | Frontend | `apps/web` skeleton — Next.js app + tenant theme provider + shell (no canvas) | `apps/web`, `@quad/ui` | business logic, canvas engine | `FRONTEND`, `MULTI_TENANCY` | tenant-branded shell renders from config | needs shared contract → stop, add to core | runnable web shell | ✅ |
| 9 | M7 | Testing | `@quad/testing` harness + Dockerized integration base (real PG/Redis) | `@quad/testing`, test config | app feature tests (later) | `TESTING`, `docker-compose.yml` | sample integration test hits real PG+Redis | no real datastore available → stop | test harness ready | ✅ |
| 10 | G1 | Planner/Reviewer | **G1 Foundation checkpoint prep** — verify M0–M9 skeletons against the gate; record checkpoint | `templates/checkpoint.md` instance | new feature code | `CHECKPOINTS` G1, `MILESTONES` §13 | all skeletons build/lint/typecheck green; evidence captured | any gate criterion unmet → fix-forward | G1 pass record | ✅ |

> Tasks expand into full `templates/milestone.md` instances at execution. This list is a **plan**, not implementation; no files were created for it this turn.

---

## 15. Final Decision

- **Corpus status: ✅ PASS with non-blocking follow-ups.**
- **Implementation may start** once the owner explicitly says **`START IMPLEMENTATION`** — beginning with Tasks 1–2 (root hygiene + lockfile) before package skeletons.
- **Blocking contradictions: none.** All open items are non-blocking scaffolding follow-ups or intended deferrals (`ADR-0010` must reach Accepted before *production*, not before starting foundation work).
- **Recommended next playbook after this audit:** either *"apply the §13 pre-implementation fixes"* (Task 1–2 as a small scaffolding PR) **or** *"`START IMPLEMENTATION`"* to begin the first-10 tasks in order.

---

## Document Control
- **Path:** `docs/CONSISTENCY_AUDIT.md`
- **Purpose:** Evidence-based whole-corpus verification + the first-10 implementation tasks plan; the final gate before implementation.
- **Dependencies:** the entire corpus + `process/SPEC_PLAN.md`. **Consumed by:** the owner's go/no-go for `START IMPLEMENTATION`; `MILESTONES.md` (first tasks); `CHECKPOINTS.md` (G1).
- **Acceptance checklist:** ☑ manifest completeness (evidence) ☑ naming/package consistency (stale-label nuance resolved by grep) ☑ tenant model ☑ contract consistency ☑ privacy/data-class ☑ security ☑ cooldown/fairness ☑ rendering ☑ testing/review/process ☑ ADR coverage ☑ scaffolding-only audit ☑ contradictions table (none blocking) ☑ pre-impl fixes ☑ first-10 tasks plan ☑ final decision.
- **Next recommended:** owner decision — apply §13 fixes, then `START IMPLEMENTATION`.
