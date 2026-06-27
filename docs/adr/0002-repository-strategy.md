# ADR-0002: Repository Strategy

- **Status:** Accepted · **Date:** 2026-06 · **Deciders:** Architect · **Linked docs:** `docs/ARCHITECTURE.md`, `process/SPEC_PLAN.md` §1, `docs/CODE_QUALITY.md`, `docs/TECH_BASELINE.md`

## 1. Context
An engineering product spanning client, server, shared contracts, and infra needs one coherent source of truth where a contract change and all its consumers move together. Versions are pinned only in `docs/TECH_BASELINE.md`.

## 2. Decision
**Monorepo + pnpm workspaces + Turborepo + Docker-first local dev + spec-first implementation.**
- **`@quad/core`** is the single source of shared contracts (DTOs, WS payloads, domain events, cooldown/tenant types).
- Deployable apps: **`apps/web`** (Next.js) and **`apps/api`** (Fastify). Packages: **`@quad/core`, `@quad/db`, `@quad/realtime`, `@quad/render`, `@quad/config`, `@quad/ui`, `@quad/testing`**.
- Dependencies point inward to `@quad/core` (leaf); `apps/web` has no DB access.

## 3. Consequences
+ Atomic cross-package PRs; type-enforced contracts kill duplicate/untyped payloads; fast cached CI; reproducible infra. − Single repo needs boundary discipline (enforced by `CODE_QUALITY.md` fitness checks).

## 4. Alternatives Considered
- **Multi-repo:** rejected, scatters contracts, invites drift, blocks atomic changes.
- **App-only repo (no shared packages):** rejected, forces duplicated DTOs.
- **Untyped shared code:** rejected, violates strict-typing quality bar.

## 5. Affected Docs / Contracts
`ARCHITECTURE.md` (§3–§4), `CODE_QUALITY.md` (boundary rules), `TECH_BASELINE.md` (pnpm/Turbo majors), `DEPLOYMENT.md`.

## 6. Migration / Rollout Notes
Root config (`package.json`/`pnpm-workspace.yaml`/`turbo.json`/`tsconfig.base.json`) is scaffolded in the Phase-4 root-config batch; package skeletons land at `START IMPLEMENTATION` (milestones M0–M9).

## 7. Follow-Up Actions
Phase-4 root config; fitness checks enforcing dependency direction (`CODE_QUALITY.md` §7).

## Document Control
- **Path:** `docs/adr/0002-repository-strategy.md` · **Acceptance:** ☑ decision ☑ `@quad/core` single source ☑ apps/packages ☑ alternatives ☑ versions referenced not declared.
