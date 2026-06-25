# Contributing to Quad

Quad is built **spec-first**, primarily by engineering roles, milestone-by-milestone. This file is the contribution workflow. **Foundation built & merged** (workspace, `@quad/*` packages, `apps/web` / `apps/api` shells, `@quad/testing` harness); **product features build next, milestone-by-milestone** — no product behaviour ahead of its milestone.

## Source of truth
**The docs are the source of truth.** Code conforms to the corpus, not the other way around. If behavior and a doc disagree, the doc wins until explicitly changed. Read `docs/ENGINEERING_WORKFLOW.md` first.

## Workflow
1. **Pick a milestone** from `docs/MILESTONES.md` (one milestone = one PR).
2. **Read** the owning doc(s) + spec(s) + the matching `templates/*`.
3. **Branch** from the default branch (never commit straight to it).
4. **Implement** within your lane; keep package boundaries clean (`docs/CODE_QUALITY.md`).
5. **Test** — add the required tests (`docs/TESTING.md`); run lint/typecheck/unit/integration/relevant e2e.
6. **Update docs/specs in the same PR** for any contract/behavior change (update `@quad/core` + the owning doc; add an ADR if architectural).
7. **Open a PR** with the summary required by `templates/pr-review.md`; review per `docs/REVIEW_PROCESS.md`.

## Hard rules
- **One task per branch, one task per PR**; small, scoped diff (soft cap ~400 LOC / ~10 files).
- **No direct commits to the default branch** except emergency repository repair; merge only via PR.
- **All checks pass before merge** — CI `verify` (lint / typecheck / build / tests) green and branch up to date with `main`; the **PR description carries the verification evidence** (commands + real results).
- **Signed commits required** — `main` is protected and rejects unsigned/unverified commits; configure SSH (or GPG) commit signing before pushing.
- **Squash merge only** — merge commits and rebase merges are disabled; the squash title is work-descriptive (no task/milestone labels) and its body has no co-author trailers or tool/authorship fingerprints. The branch is deleted on merge.
- **Neutral commit history** — commit messages and files carry no tool/automation attribution.
- **Contract change ⇒ same-PR docs/spec update** (`@quad/core` is the single contract source).
- **Tests + evidence required** — claims need commands + real results; **no fabricated results**; critical subsystems are never manual-only.
- **No secrets / no production data** — ever, in code/tests/logs.
- **No `git commit` unless explicitly asked** by the owner.
- **No hardcoded tenants** (Rutgers = tenant #1 in config only).
- **No product behaviour ahead of its milestone** — the foundation is built; product features follow `docs/MILESTONES.md`.

## References
`docs/ENGINEERING_WORKFLOW.md` · `docs/MILESTONES.md` · `docs/REVIEW_PROCESS.md` · `docs/TESTING.md` · `docs/CODE_QUALITY.md` · `process/engineering-rules.md` · `ENGINEERING_CONTEXT.md`.

## License
To be selected before public launch (`docs/LAUNCH_PLAN.md`).
