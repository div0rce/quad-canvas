<!-- TEMPLATE: copy to specs/testing/<feature-or-milestone>.md. Reusable test plan. -->
# Test Plan — `<feature-or-milestone>`

> Reminders: **tests before claims** (commands + results) · **critical subsystems never manual-only** · **integration uses real Postgres/Redis** · **no production data / no fabricated results** · **no impl before `START IMPLEMENTATION`**. Conforms to `TESTING.md`.

- **Status:** `<draft|ready>` · **Owner lane:** Testing · **Milestone:** `<M##>` · **Linked docs:** `TESTING.md`, `<spec>`

## 1. Feature / Milestone Under Test · Scope · Non-goals
`<what>` / `<...>` / `<out of scope>`

## 2. Test Layers Required
`<typecheck/static · unit · integration · contract · e2e · security · performance · migration · accessibility · smoke>` (mark which apply)

## 3. Critical-Subsystem Matrix Checks (`TESTING.md` §5)
`<event sourcing | DB/projections | API | WS | auth | tenancy | cooldown | rendering | moderation/audit | replay/archive | analytics | deployment — which apply + what to verify>`

## 4. Fixtures / Data Policy
`<synthetic fixtures via @quad/testing; tenant-scoped; Rutgers as example seed; no production data; no DC3>`

## 5. Commands to Run
`<lint/typecheck/test/integration/e2e/perf/security commands>`

## 6. Expected Results
`<pass criteria per layer; budget thresholds B##; expected error codes>`

## 7. Merge-Blocking Criteria
`<which failures block merge (TESTING.md §7)>`

## 8. Acceptance Criteria · 9. Risks · 10. Stop Conditions
`<coverage of acceptance criteria>` / `<flaky/perf risk>` / `<missing tests for a touched critical subsystem → block>`

## Document Control
- **Path:** `specs/testing/<...>.md` · **Depends on:** `TESTING.md` · **Acceptance:** ☑ layers chosen ☑ matrix checks ☑ commands+expected ☑ merge-blocking ☑ no-prod-data/no-fabrication.
