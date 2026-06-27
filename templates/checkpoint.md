<!-- TEMPLATE: copy to a checkpoint record. Mirrors docs/CHECKPOINTS.md §5 fields. -->
# Checkpoint Record: `<checkpoint name / Gx>`

> Reminders: **gate before advancing; fix-forward on failure** · **evidence required** (commands + results) · contradictions surfaced, never silently bypassed. Conforms to `CHECKPOINTS.md`.

- **Date:** `<YYYY-MM-DD>` · **Phase/Group:** `<...>` · **Linked:** `MILESTONES.md`, `<...>`

## 1. Scope
`<what this gate covers>`

## 2. Files / Milestones Covered
`<list>`

## 3. Required Evidence
`<what proves the gate (tests/commands/results, dry-runs, audits)>`

## 4. Tests / Commands Run
`<commands + outcomes>`

## 5. Risks
`<non-blocking risks carried forward, with owners>`

## 6. Contradictions
`<none found | list each + resolution path (doc/ADR)>`

## 7. Pass / Fail Decision
`<PASS | FAIL>` — `<rationale>`

## 8. Fix-Forward Actions
`<if FAIL or risks: actions + owners; re-gate plan>`

## Document Control
- **Acceptance:** ☑ scope+coverage ☑ evidence ☑ contradictions stated ☑ explicit pass/fail ☑ fix-forward if needed.
