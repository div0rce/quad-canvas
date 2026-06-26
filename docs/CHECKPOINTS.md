# Quad — Checkpoints

> **Engineering-process doc.** Owns the formal checkpoint gates and their pass/fail protocol. Conforms to [`MILESTONES.md`](MILESTONES.md), [`ENGINEERING_WORKFLOW.md`](ENGINEERING_WORKFLOW.md), [`LAUNCH_PLAN.md`](LAUNCH_PLAN.md), `process/SPEC_PLAN.md`. Does not rewrite any contract; contradictions → §7. No code/scaffolding; no versions; tenant-neutral (Rutgers Quad = tenant #1).

## 1. Purpose & Scope
Checkpoints are the **gates between phases/milestone-groups**: each defines what must be true before advancing, and what happens if it isn't. They make "don't lose the plot" enforceable. **In scope:** checkpoint list, template, pass/fail rules, contradiction handling, relationships. **Out of scope:** milestone content (`MILESTONES.md`), test detail (`TESTING.md`), launch gates' substance (`LAUNCH_PLAN.md`).

## 2. Responsibilities vs. Non-Responsibilities
| Checkpoints own | Don't own |
| --- | --- |
| Gate definitions + pass/fail protocol | Milestone content (`MILESTONES.md`) |
| Evidence + contradiction handling | Test matrix (`TESTING.md`) / launch substance (`LAUNCH_PLAN.md`) |

## 3. Principles
- **`C-DP-1` Gate before advancing** — a group/phase isn't "done" until its gate passes.
- **`C-DP-2` Fix-forward on failure** — fix and re-gate; never skip a critical gate.
- **`C-DP-3` Evidence required** — pass requires concrete evidence (tests/commands/results), not assertion (`PROC-INV-4`).
- **`C-DP-4` No skipped critical gates.**
- **`C-DP-5` No product behaviour ahead of its milestone** — the foundation is built; product features follow their milestone gates.

## 4. Checkpoint List
| Checkpoint | Gates | Recorded |
| --- | --- | --- |
| **Phase 1 — Product** | product/principles/non-goals/roadmap/launch coherent | `SPEC_PLAN.md` §8 ✅ |
| **Phase 2 — Architecture** | 19 arch docs consistent; invariants set | `SPEC_PLAN.md` §8 ✅ |
| **Phase 3 — Engineering/process** | security/perf/deploy/workflow/milestones/support complete + consistent | `SPEC_PLAN.md` §8 ✅ |
| **Phase 4 — Scaffolding** | templates/specs/engineers/ADRs/root config present | `SPEC_PLAN.md` §8 ✅ |
| **G1 Foundation** | workspace/CI/packages/app shells/db schema/testing harness green | **PASS** — §4a (2026-06-25) ✅ |
| **G2 Placement loop** | M10–M19 (place→event→projection→broadcast→render; reconnect converges) | **in progress** — backend placement (M10–M12) landed; WS/render/frontend (M14–M19) remain (§4b) ⏳ |
| **G3 Auth/tenant/fairness** | M20–M29 (verified membership, isolation, cooldown enforced+fair) | impl |
| **G4 Moderation** | M30–M39 (reversible+audited moderation; sanitized public surfaces) | impl |
| **G5 Replay/archive** | M40–M45 (archive dry-run + faithful replay proven) | impl |
| **G6 Launch readiness** | M50–M59 + all `LG-*` pass | impl |
| **Phase 5 — Consistency audit** | `CONSISTENCY_AUDIT.md` passes (whole corpus) | `CONSISTENCY_AUDIT.md` ✅ |

## 4a. Current State & G1 Foundation Readiness
*Snapshot for the foundation checkpoint — update as the foundation evolves.*

**Completed (merged to `main`):**
- **Specification corpus** complete (product / architecture / engineering-process docs, specs, templates, role guides, ADRs, consistency audit).
- **Workspace foundation** — pnpm + Turborepo, strict TypeScript (`tsconfig.base.json`), `.gitignore` / `.nvmrc` (Node 22), lockfile-based CI (`verify`).
- **Packages** — `@quad/core` (contracts), `@quad/config` (tenant registry/palette/env), `@quad/db` (Prisma schema + client/repositories), and leaf skeletons (`@quad/realtime` / `@quad/render` / `@quad/ui` / `@quad/eslint-config` / `@quad/tsconfig`).
- **Apps** — `apps/api` (Fastify health/readiness shell) and `apps/web` (Next tenant-aware shell).
- **`@quad/testing`** — local integration harness: tenant fixtures + **protocol-level** Postgres/Redis readiness, with unit + Docker-gated integration tests.
- **Repository protection** — `main` requires a PR, green `verify` (strict), and signed/verified commits; force-push and deletion are blocked.

**G1 result — PASS (2026-06-25).** Foundation verified end-to-end under Node 22:
- `pnpm install --frozen-lockfile` · `pnpm typecheck` · `pnpm build` · `pnpm check` (20/20) — all green (Turbo-orchestrated, so workspace deps build first).
- `@quad/testing` unit suite green (incl. readiness-timeout + credential-redaction tests); Docker-backed integration green — `docker compose up -d --wait postgres redis` → `pnpm --filter @quad/testing test:integration` (protocol-level Postgres `SELECT 1` + Redis `PING`) → `docker compose down`.
- `docker compose config` valid; CI `verify` required + strict on `main`; merges are squash-only.

**Expected G1 checks** (Node 22, Turbo-orchestrated so workspace deps build first): `pnpm install --frozen-lockfile` · `pnpm typecheck` · `pnpm build` · `pnpm check` · `docker compose config`. Docker-backed integration (separately): `docker compose up -d --wait postgres redis` → `pnpm --filter @quad/testing test:integration` → `docker compose down`.

**Local services available:** Docker + Compose with **Postgres 17** and **Redis 8** from `docker-compose.yml` (local-only creds; ports 5432 / 6379).

## 4b. G2 Placement Loop — in progress
**Landed (backend placement + read surface, M10–M13).** Server-authoritative `POST /api/v1/canvas/current/pixels`: validate (tenant → current **active** canvas → bounds → palette), then **one per-canvas-serialized transaction** (Postgres advisory lock) that enforces **idempotency replay + cooldown** and appends `PixelPlaced` + updates the projection atomically → `PlacePixelResultResponse`. **Read surface (M13):** `GET /api/v1/canvas/current` (metadata), `/snapshot` (projection for initial paint), `/pixels/{x}/{y}` (cell), and `/pixels/{x}/{y}/history` (cursor-paginated, oldest→newest) — all public, **DC2 attribution only**. Backed by `pixel_events` (append-only truth, FK-`RESTRICT`ed against deletion) + `pixels` (projection) tables (the repo's **first Prisma migration**).

- **Identity** is injected as a verified `Principal` at the service layer (`BE-INV-6`, `PRIN-NO-ANON`); the HTTP request→principal step (sessions) is owned by `AUTHENTICATION.md` / `ADR-0006` and deferred to the auth milestone, so write routes return **401** until then — no anonymous writes, no header bypass.
- **Cooldown** is a minimal fixed, fail-closed boundary derived from the event log; the dynamic load algorithm + Redis fast-path are deferred (`COOLDOWN.md`).
- **Realtime (M14–M15):** `@quad/realtime` holds a tenant-scoped subscription registry; `apps/api` serves a `@fastify/websocket` endpoint at `GET /api/v1/canvas/current/ws` — connect (tenant-resolved; unknown host → `WS_TENANT_MISMATCH` + close), `SubscribeCanvas` (tenant-scoped, acked; cross-tenant → `WS_FORBIDDEN`), and a server heartbeat. **Fan-out (M15):** a successful placement publishes `PixelPlaced` to a `RealtimeBus` — in-memory single-node, or **Redis pub/sub cross-node** — and each node delivers to its local subscribers via the registry. So **place → event → projection → broadcast → subscriber** works end-to-end (REST stays the only authoritative write path; Redis is transport only).
- **Render model (M16):** `@quad/render` holds a framework-agnostic `CanvasBuffer` — applies the REST snapshot (initial paint / reconnect base) + live `PixelPlaced` deltas with **seq-watermark dedupe** (reorder/duplicate-safe; the reconnect-convergence primitive) and dirty-region tracking — plus pure pan/zoom viewport math (screen↔cell, anchored zoom). Unit-tested in Node (no browser); the view layer draws dirty regions from it.
- **Web canvas (M17):** `apps/web` has a framework-agnostic `CanvasClient` (fetch metadata + snapshot, load the buffer, open the WS, `SubscribeCanvas`, apply `PixelPlaced` deltas) driven by a `'use client'` `CanvasView` that paints dirty regions to a `<canvas>` at `/canvas`. Network + socket are injected, so the controller is Node-unit-tested; `CanvasMetaResponse` now carries the canvas `id` for subscription. **Read/view only** — placement interaction is gated until auth (M20).
- **Reconnect convergence (M18):** `CanvasClient` subscribes **before** loading the snapshot (queuing deltas, so none are lost in the gap) and, on an unexpected close, backs off, reopens, re-fetches the snapshot (fresh watermark), resubscribes, and resumes — convergent by construction (the buffer's seq dedup drops anything the new snapshot already covers). Unit-tested with an injected scheduler/socket (reconnect + no-reconnect-after-stop).
- **Auth — session validation + principal (M20, in progress):** a server-authoritative **session store** (opaque 256-bit tokens, server-side state with TTL, immediate revocation — `AUTH-INV-8`; in-memory + Redis impls) and a fail-closed **principal resolver** (session + **active membership** → principal; wrong-tenant/expired/no-membership → null). An identity plugin reads the `quad_session` cookie and sets `request.principal`, so the placement route now **accepts authenticated writes** (the M10 401-stub lifts) while unauthenticated/no-membership stay `401`. Verified by Docker-backed integration tests. **Follow-on:** the domain-allowlisted magic-link **front-door** that issues sessions (find-or-create user+membership, rotate-on-auth), plus revoke-all-on-ban.
- Verified with Docker-backed integration tests: `pnpm --filter api test:integration` (21/21 — placement, the read surface, and WS subscribe/heartbeat/fan-out) and `pnpm --filter @quad/realtime test:integration` (cross-node Redis delivery); plus `@quad/realtime` + `@quad/render` + `web` (`CanvasClient`) unit tests, and a green `next build`.

**G2 — placement loop: functionally complete, verified per layer.** Every link — `place → PixelPlaced event → projection → broadcast → subscriber → buffer → painted canvas`, and reconnect convergence — is implemented and tested (server links via Docker-backed integration tests; render model + client orchestration + reconnect via unit tests). **Remaining (M19):** a full browser end-to-end (Playwright against running api+web — place a pixel, assert it repaints a live client) as the capstone before formally stamping **G2 = PASS**. That e2e belongs with the broader QA/e2e harness and needs the web↔api host wiring; tracked as a follow-on.

**Deferred (own milestones):** moderation, leaderboards, profiles, archives, heatmaps, full session auth, and **read visibility gating** (tenant `readOnlyViewing` / `archiveVisibility` on the public read endpoints) — visibility pairs with auth/membership, so reads are currently open per the documented public-read surface.

## 5. Checkpoint Template
Each checkpoint records: **scope · files/milestones covered · required evidence · tests/commands · risks · contradictions found · pass/fail decision · fix-forward actions.** (Phase checkpoints live in `SPEC_PLAN.md` §8; implementation gates G1–G6 are recorded against their milestone group.)

## 6. Pass/Fail Rules
- **Pass** = all gate criteria met **with evidence** and **no blocking contradictions**.
- **Fail** = any criterion unmet or a blocking contradiction found → **do not advance**; enter fix-forward (§7); re-run the gate.
- A gate may pass **with noted non-blocking risks** carried forward (logged, owned).

## 7. Contradiction Handling
If a checkpoint finds a contradiction with a settled doc: **stop, surface it explicitly**, and resolve via doc-update/ADR (`ENGINEERING_WORKFLOW.md` §15) — **never silently diverge**. Blocking contradiction ⇒ fail the gate until resolved.

## 8. Relationship to `MILESTONES.md`
Gates G1–G6 sit at the milestone-group boundaries defined in `MILESTONES.md` §13; a failed gate blocks the next group (`MILESTONE-INV-7`).

## 9. Relationship to `LAUNCH_PLAN.md`
**G6** is the operational expression of the `LAUNCH_PLAN.md` go/no-go gates (`LG-1…LG-10`); passing G6 = launch-ready.

## 10. Checkpoint Invariants (`CHECKPOINT-INV-*`)
- **`CHECKPOINT-INV-1`** No group/phase advances until its gate passes with evidence.
- **`CHECKPOINT-INV-2`** Failure → fix-forward + re-gate; critical gates are never skipped.
- **`CHECKPOINT-INV-3`** Contradictions are surfaced and resolved (doc/ADR), never silently bypassed.
- **`CHECKPOINT-INV-4`** Every checkpoint records evidence + a pass/fail decision.
- **`CHECKPOINT-INV-5`** G6 requires all `LG-*` launch gates.

## 11. Diagrams
```mermaid
flowchart LR
  GRP["group/phase complete"] --> CRIT{"criteria met + evidence + no blocking contradiction?"}
  CRIT -- yes --> ADV["advance"]
  CRIT -- no --> FF["fix-forward"] --> CRIT
```
```mermaid
flowchart LR
  FAIL["gate fail / contradiction"] --> SURF["surface explicitly"] --> FIX["doc/ADR/impl fix"] --> RE["re-run gate"]
```

## 12. Document Control
- **Path:** `docs/CHECKPOINTS.md` · **Purpose:** formal checkpoint gates + pass/fail protocol.
- **Dependencies:** `MILESTONES`, `ENGINEERING_WORKFLOW`, `LAUNCH_PLAN`, `SPEC_PLAN`. **Consumed by:** all phase/gate execution.
- **Acceptance:** ☑ checkpoint list (phases + G1–G6 + audit) ☑ template ☑ pass/fail ☑ contradiction handling ☑ rel to MILESTONES/LAUNCH ☑ `CHECKPOINT-INV-*` ☑ 2 diagrams ☑ no code/versions ☑ tenant-neutral.
- **Next:** `docs/TESTING.md`.
