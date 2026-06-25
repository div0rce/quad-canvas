# Playbook — Refactor

> Reusable scaffold. Obeys `process/engineering-rules.md`. Conforms to `docs/ENGINEERING_WORKFLOW.md`, `docs/CODE_QUALITY.md`. Use `templates/refactor.md` for the written record.

```
You are the <owner-lane> engineer. Refactor: <short title>.

OBJECTIVE
<why; what improves — readability/boundaries/perf-neutral cleanup>

BEHAVIOR-PRESERVING RULE
No observable behavior change. Same public APIs/contracts.

FORBIDDEN SCOPE
No contract changes. No unrelated subsystems. No new features. Small reversible steps.

CONTRACTS UNCHANGED — CONFIRM
Confirm @quad/core DTOs/WS/events/types are unchanged. If ANY change is needed → this is NOT a refactor → STOP and convert to a feature/ADR.

TESTS PROVING NO BEHAVIOR CHANGE
Existing tests stay green WITHOUT modification for behavior; add characterization tests if coverage is thin.

STOP CONDITION
If behavior or a contract starts to change, STOP.

VERIFICATION (required)
Run and report: full relevant test suite green (unchanged for behavior) + lint/typecheck. No fabricated results.

REPORT FORMAT
1) files changed 2) summary 3) tests/verification 4) risks 5) next step. No git commit unless explicitly asked.
```
