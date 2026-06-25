<!-- TEMPLATE: copy to a bugfix task/PR description. Reusable bugfix. -->
# Bugfix — `<short title>`

> Reminders: **minimal fix + regression test** · **tests before claims** (commands + results) · **contract changes update `@quad/core` + docs/specs same-PR** · **stop, don't guess** on contract/auth/security/cooldown/tenant/event-sourcing/moderation changes. Conforms to `ENGINEERING_WORKFLOW.md`, `TESTING.md`.

- **Severity:** `<low|med|high|critical>` · **Owner lane:** `<...>` · **Linked:** `<milestone/spec/docs>`

## 1. Bug Summary
`<what's wrong, observed impact, affected subsystem/tenant>`

## 2. Reproduction
`<exact steps / inputs / environment>`

## 3. Expected vs Actual
- **Expected:** `<...>` · **Actual:** `<...>`

## 4. Root Cause
`<the actual cause, not the symptom>`

## 5. Minimal Fix Plan
`<smallest change that fixes the cause; no unrelated rewrites>`

## 6. Regression Tests
`<test that fails before / passes after; critical-subsystem matrix item if applicable>`

## 7. Affected Docs / Contracts
`<any contract/behavior change → @quad/core + doc/spec same-PR>`

## 8. Impacts (if any)
`<security/performance/privacy (no DC3)/tenant isolation>`

## 9. Verification Evidence
`<commands run + results; no fabricated results>`

## 10. Stop Conditions
`<if the fix touches a guarded area or a contract → stop + review/ADR>`

## Document Control
- **Acceptance:** ☑ root cause identified ☑ minimal fix ☑ regression test ☑ evidence ☑ docs updated if contract touched.
