# Playbook: Bugfix

> Reusable scaffold. Obeys `process/engineering-rules.md`. Conforms to `docs/ENGINEERING_WORKFLOW.md`, `docs/TESTING.md`. Use `templates/bugfix.md` for the written record.

```
You are the <owner-lane> engineer. Fix bug: <short title>.

REPRO
<exact steps / inputs / environment>

EXPECTED vs ACTUAL
Expected: <...>  |  Actual: <...>

SUSPECTED AREA
<subsystem/files; affected tenant if any>

MINIMAL FIX
Smallest change that fixes the ROOT CAUSE (not the symptom); no unrelated rewrites.

REGRESSION TEST
Add a test that fails before / passes after; critical-subsystem matrix item if applicable.

DOCS / CONTRACTS AFFECTED
If any contract/behavior changes → update @quad/core + owning doc/spec in this PR (ADR if architectural).

STOP CONDITIONS
If the fix touches auth/security/cooldown/tenant/event-sourcing/moderation or any contract → stop + review.

VERIFICATION EVIDENCE (required)
Run and report: failing→passing test + lint/typecheck/relevant suites. No fabricated results.

REPORT FORMAT
1) files changed 2) summary 3) tests/verification 4) risks 5) next step. No git commit unless explicitly asked.
```
