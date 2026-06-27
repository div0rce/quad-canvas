# Quad — Corpus Consistency Audit

> **Whole-corpus cross-reference + corpus-vs-implementation drift audit** (point-in-time, **2026-06-27**).
> Evidence-based: findings are verified against the real filesystem (`git ls-files`, targeted `rg`, route
> and migration listings), not asserted. The original audit gated the *start* of implementation; this
> revision audits the **built system** against its corpus.
>
> **Status:** the system is **built and merged to `main`** — the `@quad/*` packages, the `apps/api` and
> `apps/web` apps, realtime/auth/moderation/archive/replay/cooldown, M50s ops hardening, the CI gates,
> and a deployable full-stack compose + edge proxy. Milestone-group checkpoints **G1–G5 have passed** and
> all MVP acceptance criteria (`P-AC-1…13`) are met. The live current state is `CHECKPOINTS.md` §4 and
> `ACCEPTANCE_TRACEABILITY.md`. Tenant-neutral (Rutgers Quad = tenant #1).

---

## 1. Manifest Completeness

**Corpus** (`git ls-files`): docs **40**, ADRs **10**, templates **15**, spec READMEs **10**, `process/*` **20**, playbooks **6**. **Missing: none.**

**Implementation now present** (the original audit's "intentionally deferred" set):

| Layer | Present | Evidence |
| --- | --- | --- |
| Packages | `@quad/{core,config,db,realtime,render,ui,testing,eslint-config,tsconfig}` | `packages/*` |
| Apps | `apps/api`, `apps/web` | `apps/*/src` populated |
| API routes | admin · archives · auth · health · leaderboards · moderation · pixels · profiles · reports · session · ws | `apps/api/src/routes/*.ts` |
| Migrations | 4 additive (`init`, `nullable_event_new_color`, `index_pixel_events_actor`, `index_pixel_events_load`) | `packages/db/prisma/migrations/` |
| Scripts | `load-gate.mjs`, `dr-drill.sh`, `check-migrations.mjs`, `e2e-canvas.mjs` | `scripts/` |
| Deploy | `apps/{api,web}/Dockerfile`, `docker-compose.prod.yml`, `deploy/Caddyfile`, `.env.prod.example` | repo root + `deploy/` |
| Root config | `pnpm-lock.yaml`, `.gitignore`, `.nvmrc`, `tsconfig.base.json`, `.github/workflows/ci.yml` | present |

---

## 2. Naming / Package Consistency

- **Platform = Quad; Rutgers Quad = tenant #1** (config/example only) — no Rutgers literal in code/build config; tenant data lives in `@quad/config`. ✅
- **Deployable apps = `apps/web` / `apps/api`; packages = `@quad/*`** — the once-flagged stale `@quad/web`/`@quad/api` labels appear **only** in this audit and the historical `SPEC_PLAN.md` §8 tracking notes; no usage in code/config. **Nuance closed.** ✅
- **`@quad/core` = canonical shared-contract owner** — DTOs/events/ws/cooldown/tenant types declared once in `packages/core/src`; consumed by api + web + db; no duplicate definitions. ✅

---

## 3. Tenant-Model Consistency

| Check | Result |
| --- | --- |
| Tenant-neutral architecture; tenant from Host | ✅ resolved by the tenant plugin (`apps/api`) |
| No hardcoded Rutgers outside config | ✅ registry in `@quad/config` |
| **No default-tenant fallback** (`TENANT-INV-1`) | ✅ unknown host → 404 "No tenant" (verified via the edge e2e) |
| Cross-tenant access → `404` | ✅ integration tests ("enforces tenant isolation"), now **CI-gated** (`LG-6`) |
| Host-only cookies + tenant-scoped sessions | ✅ `apps/api/src/auth` |

---

## 4. Contract Consistency (corpus ↔ code)

| Check | Result |
| --- | --- |
| REST commands / WS broadcasts; no authoritative writes over WS | ✅ `routes/pixels.ts` write path; `routes/ws.ts` read/fan-out only |
| `PixelPlaced` / `PixelRolledBack` / `RegionRolledBack` event + message names | ✅ one spelling across `@quad/core`, docs, code |
| Per-canvas sequence ordering | ✅ advisory-locked append in `placement-repository.ts` |
| `COOLDOWN_ACTIVE` ≠ `RATE_LIMITED` (both 429, never conflated) | ✅ `@quad/core` error codes; cooldown vs rate-limit paths distinct |
| Idempotency on commands | ✅ `appendPlacement` replay-by-key |
| Append-only event log; projections derived | ✅ `pixel_events` + `pixels`; rollbacks are compensating events |
| Moderation via compensating events + atomic audit | ✅ `routes/moderation.ts`; `moderation_actions` FK-`RESTRICT`, no hard delete |
| Public replay/archive sanitized | ✅ `getPixelHistory` excludes rolled-back placements |

**No contract-term drift** between the docs and the implemented `@quad/core` contracts.

---

## 5. Privacy / Data-Class Consistency

- **`DC2` public attribution only; `DC3` (email) never in public surfaces, logs, metrics, or audit.** Verified: profiles/leaderboards/history return handle-only; access log + `/metrics` key on the route template, never the email; `e2e`/integration assert no `@` leaks. ✅

---

## 6. Security Consistency

| Check | Result |
| --- | --- |
| No anonymous writes | ✅ placement/report principal-gated → 401 (CI-gated, `LG-4`) |
| Email-verification sessions; revocable | ✅ `auth` + `revokeAllForUser` on suspend/ban |
| Security headers on every response; rate limiting; body limit | ✅ `plugins/security-headers`, `rate-limit/`, 16 KiB `bodyLimit` |
| High/critical dependency audit gates CI | ✅ `pnpm audit --audit-level high` step |

---

## 7. Cooldown / Fairness Consistency

Global per-canvas · bounded **5–20 min** (`clampCooldownMs`) · server-enforced · fail-closed · **load-based dynamic** value (`dynamicCooldownMs`, sliding-window rate counter — gradual, no oscillation) · in-flight timer fixed at placement · no individual advantage. Consistent across `COOLDOWN`, `ADR-0008`, and `apps/api/src/services/cooldown.ts` (`COOL-INV-*`). ✅

---

## 8. Rendering Consistency

`@quad/render` owns the engine only — no REST/WS I/O, no business logic; 2D canvas buffer + viewport math; `apps/web` owns transport, gestures (pan/zoom), and a11y wrappers. Consistent across `RENDERING`, `ADR-0005`, `packages/render/src` (`RENDER-INV-*`). ✅

---

## 9. Testing / Review / Process Consistency

One milestone per PR · tests before claims · integration on **real Postgres/Redis** (now in CI) · independent review · checkpoint gates required. Consistent across `ENGINEERING_WORKFLOW`, `MILESTONES`, `TESTING`, `REVIEW_PROCESS`, `process/*`, and the actual CI (`Security audit → Migration safety → Lint → Typecheck → Unit → Build → migrate-deploy → Integration → Load gate`). ✅

---

## 10. ADR Coverage

| ADR | Decision | Status |
| --- | --- | --- |
| 0001–0009 | record-decisions, repository, event-sourcing, websocket, rendering, auth, multi-tenancy, dynamic-cooldown, moderation/audit | **Accepted** |
| 0010 | Deployment target | **Proposed** — to be **Accepted before the live production deploy** (G6 / `LG-9`+deploy) |

ADRs record decisions and stay **Accepted**; their decisions are now reflected in the implemented system.

---

## 11. Implementation Audit (code ↔ contracts)

The original §11 audited that Phase 4 stayed scaffolding-only. That gate is past; the system is built. Current checks:

- **Migrations are additive** — `init` + nullable/index ALTERs; enforced per-PR by the `check:migrations` gate (rollback-safe). ✅
- **Secrets stay out of the repo** — only `.env.example` / `.env.prod.example` (no real values); `.gitignore` covers `.env*` with the example exceptions. ✅
- **CI exercises the real stack** — service-container Postgres + Redis, migrate-deploy, full integration suite + load gate. ✅
- **Deploy verified end-to-end** — compose + edge proxy build → migrate → `/readyz` 200 → web 200 (`DEPLOYMENT.md` §7/§9). ✅

---

## 12. Contradictions / Open Items

The original audit's non-blocking items are **resolved**:

| # | Original item | Now |
| --- | --- | --- |
| A | Stale `@quad/web`/`@quad/api` labels | Closed — no code/config usage (audit + SPEC_PLAN history only) |
| B | `--frozen-lockfile` with no lockfile | Resolved — `pnpm-lock.yaml` committed; CI uses `--frozen-lockfile` |
| C | Missing `.gitignore` / stray `.DS_Store` | Resolved — `.gitignore` added; no tracked `.DS_Store` |
| D | Missing `.nvmrc` / `tsconfig.base.json` | Resolved — both present |
| E | `LICENSE` undecided | Still **launch-gated** (no file; documented in `README` / `LAUNCH_PLAN`) |
| G | `ADR-0010` provider Proposed | Open by design — accept before the live deploy |
| H | CI scan tooling placeholder | Resolved — `pnpm audit` high/critical gate live |

**No blocking contradictions.** Remaining open items are launch-stage and external: `ADR-0010` provider + `LG-9` legal + the live deployment.

---

## 13. Milestone / Gate Status

The original §13/§14 (pre-implementation fixes + first-10-tasks plan) are **complete**. Current:

- **M0–M59** implemented across the milestone groups; **G1–G5 checkpoints PASSED** (`CHECKPOINTS.md` §4).
- **All MVP acceptance criteria `P-AC-1…13` met and verified** — pure logic unit-tested, DB-backed behaviour integration-tested, canvas interaction browser-e2e-tested (`ACCEPTANCE_TRACEABILITY.md`).
- **Launch gates:** `LG-1…8,10` implemented + verified (acceptance, content policy, moderation reversal, no-anon, load, security/isolation, archive/replay dry run, backup/restore drill, rollback-safety). **Remaining:** `LG-9` (legal/ToS/university approval) and a **live cloud deployment** — both external/organizational, not code tasks.

---

## 14. Final Decision

- **Corpus + implementation: ✅ consistent.** The docs and the built system agree; no drift detected.
- **Blocking contradictions: none.** Remaining work is launch-stage: `ADR-0010` provider, `LG-9` legal, and the live deployment.

---

## Document Control
- **Path:** `docs/CONSISTENCY_AUDIT.md`
- **Purpose:** Evidence-based whole-corpus + corpus-vs-implementation consistency audit.
- **Dependencies:** the entire corpus + the repo. **Consumed by:** `CHECKPOINTS.md`, launch go/no-go.
- **Acceptance checklist:** ☑ manifest (corpus + implementation, evidence) ☑ naming/package ☑ tenant model ☑ contract (corpus ↔ code) ☑ privacy/data-class ☑ security ☑ cooldown/fairness ☑ rendering ☑ testing/review/process ☑ ADR coverage ☑ implementation audit ☑ open items resolved ☑ milestone/gate status ☑ final decision.
