<!-- TEMPLATE: copy to a refactor task/PR description. Reusable refactor. -->
# Refactor — `<short title>`

> Reminders: **behavior-preserving, no contract drift, no scope creep** · **no speculative rewrites** · tests stay green · **stop, don't guess** if a "refactor" starts changing a contract/behavior (that's a feature/ADR, not a refactor). Conforms to `ENGINEERING_WORKFLOW.md`, `CODE_QUALITY.md`.

- **Owner lane:** `<...>` · **Linked:** `<milestone/docs>`

## 1. Refactor Objective
`<why; what improves (readability/boundaries/perf-neutral cleanup)>`

## 2. Behavior Preserved
`<explicit statement: no observable behavior change; same public APIs/contracts>`

## 3. Forbidden Scope
`<no contract changes; no unrelated subsystems; no new features>`

## 4. Contracts Unchanged — Confirmation
`<confirm @quad/core DTOs/WS/events/types unchanged; if any change → this is NOT a refactor → stop>`

## 5. Tests Proving No Behavior Change
`<existing tests unchanged and green; add characterization tests if coverage is thin>`

## 6. Risk Assessment
`<what could subtly break; package-boundary/fitness impact>`

## 7. Rollback / Fix-Forward
`<small reversible steps; app rollback safe>`

## 8. Stop Conditions
`<contract/behavior change discovered → stop, convert to feature/ADR>`

## Document Control
- **Acceptance:** ☑ behavior preserved ☑ contracts unchanged ☑ tests green (no test changes for behavior) ☑ scoped/small ☑ no drift.
