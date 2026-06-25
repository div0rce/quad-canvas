# `specs/testing/` — Test Plan Specs

Conventions for **test-plan specs**. Conforms to `docs/TESTING.md`, `docs/PERFORMANCE.md`, `docs/SECURITY.md`, `docs/REVIEW_PROCESS.md`. Tenant-neutral.

- **What belongs here:** one test plan per feature/milestone — layers required, critical-subsystem matrix checks, fixtures/data policy, commands, expected results, merge-blocking criteria.
- **Template:** [`templates/test-plan-spec.md`](../../templates/test-plan-spec.md).
- **Owning doc:** `docs/TESTING.md` (strategy + matrix).
- **Naming:** `specs/testing/<feature-or-milestone>.md`.
- **Required rules:**
  - **Tests before claims** — commands + results, never assertions.
  - **Critical subsystems never manual-only** (event sourcing/cooldown/auth/WS/rendering/moderation/tenant isolation).
  - **Integration uses real Postgres/Redis** (Dockerized), not mocks, for stateful behavior.
  - **No production data**; synthetic fixtures only; **no `DC3`** in fixtures.
  - **No fabricated results.**
  - **Merge-blocking criteria** stated explicitly.
- **Same-PR updates:** `docs/TESTING.md` if a layer/gate changes; the plan ships with the feature/milestone PR.
- **Tests/evidence:** the plan *is* the evidence contract — commands + expected outcomes + which failures block merge.
- **Stop conditions:** a touched critical subsystem lacking matrix tests → **block/stop**. **No implementation before `START IMPLEMENTATION`.**

## Document Control
- **Path:** `specs/testing/README.md` · **Template:** `templates/test-plan-spec.md` · **Depends on:** `TESTING`, `PERFORMANCE`, `SECURITY`, `REVIEW_PROCESS`. · **Next:** `process/*` role guides batch.
