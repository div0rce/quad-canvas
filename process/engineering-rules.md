# Global Engineer Rules

**Every Quad engineer follows these rules** (they sit above any role file). They operationalize `docs/ENGINEERING_WORKFLOW.md`. Tenant-neutral (Rutgers Quad = tenant #1 example); versions → `docs/TECH_BASELINE.md`.

## The Rules
1. **Docs are the source of truth** — implement against the corpus; never invent product requirements.
2. **Spec-first** — every task traces to a spec + milestone.
3. **One milestone per PR** — small, scoped diff; no unrelated rewrites.
4. **Stop, don't guess** — on any stop condition, pause and ask with options + a recommendation.
5. **Same-PR docs/spec updates for contract changes** — update `@quad/core` + the owning doc/spec together (ADR if architectural).
6. **No secrets / no production data** — ever, in code, tests, or logs.
7. **No fabricated test results** — claims require commands + real results; report skips/failures honestly.
8. **No `git commit`/merge unless explicitly asked** — branch from default; never commit straight to it.
9. **No hardcoded tenants** outside `@quad/config`.
10. **No duplicate DTOs** — contracts only in `@quad/core`.
11. **No untyped WebSocket payloads** — typed + `schemaVersion`-ed in `@quad/core`.
12. **No DB writes outside repositories/services** (`@quad/db` owns DB I/O).
13. **No business logic in React components.**
14. **No moderation without audit** — compensating events + atomic `DC4` audit; no hard delete.
15. **No `DC3` in public surfaces or normal logs** — `DC2` only.
16. **No product behaviour ahead of its milestone** — the foundation is built; product features follow `docs/MILESTONES.md` and their checkpoint gates.

## Branch & Merge Discipline
- **One task per branch, one task per PR.** Branch/commit/PR names describe the *work*, not task/milestone numbers.
- **`main` is protected** — no direct pushes; changes land only through a PR (emergency repository repair excepted).
- **Signed commits are required** — configure SSH (or GPG) commit signing; unsigned/unverified commits cannot merge.
- **To merge:** CI `verify` (lint/typecheck/test/build) green and branch up to date with `main`; commits **verified/signed**; review threads resolved (including external review apps).
- **Neutral history** — no tool/automation/authorship attribution in commit messages, files, branch names, or PR text.
- **Docs move with the change** — a contract/behavior change updates `@quad/core` + the owning doc/spec **in the same PR**, not as a trailing cleanup.

## Stop Conditions (always)
Ambiguous product requirement · any API/WS/event/DB contract change · auth/security/cooldown/tenant/event-sourcing/moderation change · migration/data-loss risk · performance-budget risk · PR too large · missing tests.

## Required Output Format (every task)
1. **Files changed** · 2. **Summary** · 3. **Tests/verification** (commands + results) · 4. **Risks** · 5. **Next step**.

## Document Control
- **Path:** `process/engineering-rules.md` · **Depends on:** `ENGINEERING_WORKFLOW`, all Phase 1–3 docs. · **Next:** per-role guide files.
