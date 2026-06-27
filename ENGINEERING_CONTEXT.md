# ENGINEERING_CONTEXT.md — Repo-Wide Engineering Entry Point

You are working in **Quad**, a multi-tenant collaborative pixel-canvas platform (Rutgers Quad = tenant #1, **config only**). This file is the entry point for engineering work. **The system is built and merged to `main`:** the `@quad/*` packages, the `apps/api` and `apps/web` apps, the realtime/auth/moderation/archive/cooldown subsystems, the CI gates, and a deployable full-stack compose + edge proxy. Continue **milestone-by-milestone against the corpus** (`docs/MILESTONES.md`); keep docs in lockstep and never add product behaviour ahead of its milestone.

## Read order (every task)
1. **`process/engineering-rules.md`** — the rules every engineer follows.
2. **The relevant role guide** — `process/<role>-guidelines.md` for the lane you're in (e.g., `apps/api` → `process/backend-guidelines.md`; `@quad/db` → `process/database-guidelines.md`).
3. **The relevant docs / specs / templates** — the owning subsystem doc(s) in `docs/`, the spec in `specs/`, and the scaffold in `templates/`.
4. **`docs/ENGINEERING_WORKFLOW.md`** — the operating model (principles, stop conditions, drift control).

## Standing rules
- **Docs are the source of truth** — implement against the corpus; never invent product requirements.
- **Stop, don't guess** — on any stop condition (ambiguity, contract/auth/security/cooldown/tenant/event-sourcing/moderation/migration/perf-risk change), pause and ask with options + a recommendation.
- **No fabricated verification** — claims need commands + real results.
- **No `git commit`/merge unless explicitly asked.**
- **No secrets / no production data.**
- **No product behaviour ahead of its milestone** — the system is built; further work follows `docs/MILESTONES.md`.

## Role selection guide
- Planning/sequencing → `process/planner-guidelines.md` · Architecture/ADRs → `process/architect-guidelines.md`
- `apps/web`/`@quad/ui` → `process/frontend-guidelines.md` · `apps/api` → `process/backend-guidelines.md` · `@quad/db` → `process/database-guidelines.md`
- WS/Redis → `process/realtime-guidelines.md` · `@quad/render` → `process/rendering-guidelines.md`
- Security/protected areas → `process/security-review.md` · Tests → `process/testing-guidelines.md` · Deploy/CI → `process/devops-guidelines.md`
- Independent review → `process/review-guidelines.md` (reviewer ≠ implementer)

## Output format (every task)
1. **Files changed** · 2. **Summary** · 3. **Tests/verification** (commands + results) · 4. **Risks** · 5. **Next step**.

## Where things live
- **Reusable playbooks:** `process/playbooks/*` (milestone-implementation, bugfix, refactor, verification, documentation-update).
- **Templates:** `templates/*` · **Specs:** `specs/*` · **Docs:** `docs/*` · **ADRs:** `docs/adr/*`.
- **Build plan / tracker:** `docs/MILESTONES.md`, `process/SPEC_PLAN.md` (§7 tracker, §8 checkpoints).
- **Versions:** only in `docs/TECH_BASELINE.md`.
