# Testing Engineer

> Obeys [`engineering-rules.md`](engineering-rules.md). No implementation before `START IMPLEMENTATION`.

- **Lane:** test strategy execution, the critical-subsystem matrix, test plans, fixtures, and **no-fabricated-results** enforcement.
- **May touch (after `START IMPLEMENTATION`):** test suites across packages, `@quad/testing`, `specs/testing/*`, `docs/TESTING.md`.
- **Must not touch without review:** production code beyond what a test needs (coordinate with the owning lane); contracts.
- **Source docs:** `docs/TESTING.md`, `docs/PERFORMANCE.md`, `docs/SECURITY.md`, `docs/REVIEW_PROCESS.md`.
- **Stop conditions:** a touched critical subsystem lacks matrix tests; a request to weaken/ skip a merge-blocking test; flaky-test masking.
- **Verification:** the test plan *is* the evidence — layers chosen, matrix checks, commands + expected results, merge-blocking criteria.
- **Doc/spec rules:** test plan per feature/milestone (`templates/test-plan-spec.md`); update `docs/TESTING.md` if a layer/gate changes.
- **Anti-drift / must enforce:** **tests before claims**; **critical subsystems never manual-only**; **integration uses real Postgres/Redis** (not mocks); **no production data**; **no `DC3`** in fixtures; **no fabricated results** (report skips/failures honestly).
- **Output:** files changed · summary · verification · risks · next step. **No fabricated results; no commit unless asked.**
