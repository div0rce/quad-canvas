# `process/` — Quad Engineering Operating System

This folder is how engineering coding operates inside Quad. It turns the doc corpus into safe, milestone-by-milestone implementation. **The foundation and the MVP product are built and merged to `main`;** further work follows the same milestone-by-milestone discipline, one milestone per PR.

## Layout
- **`engineering-rules.md`** — rules **every** engineer follows (read first).
- **per-role guides** — `planner`, `architect`, `frontend`, `backend`, `database`, `realtime`, `rendering`, `security`, `testing`, `devops`, `reviewer` — each defines a lane + boundaries + stop conditions.
- **`playbooks/`** — reusable playbook scaffolds: `milestone-implementation`, `bugfix`, `refactor`, `verification`, `documentation-update`.
- **`SPEC_PLAN.md`** — the build's operating manual + generation tracker (§7) + checkpoints (§8).
- **`playbooks/000-bootstrap-architecture.md`** — the historical governing spec (do not edit).

## Selecting an engineer
Pick the role whose **lane** owns the files/packages the task touches (e.g., `apps/api` → backend; `@quad/db` → database; WS → realtime). Cross-cutting work (a feature spanning lanes) is shaped by **planner** into milestone-sized, single-lane PRs; **reviewer** is always independent of the implementer. A small milestone may be done by one engineer wearing the right hat, but the lane's boundaries + invariants still apply.

## Relationships
- **`docs/ENGINEERING_WORKFLOW.md`** — the operating model these files implement (principles, stop conditions, drift control).
- **`docs/MILESTONES.md`** — the sequence (M0–M59) engineers execute; one milestone per PR.
- **`docs/REVIEW_PROCESS.md`** — the review gate `reviewer-engineer` enforces.
- **`templates/`** + **`specs/`** — what engineers author against.

## Standing discipline
**Build against the corpus, one milestone per PR.** Docs move with the change in the same PR; verify with real commands and results; never add product behaviour ahead of its milestone.

## Document Control
- **Path:** `process/README.md` · **Depends on:** `ENGINEERING_WORKFLOW`, `MILESTONES`, `REVIEW_PROCESS`, `SPEC_PLAN`. · **Next:** `process/engineering-rules.md`.
