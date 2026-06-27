# Playbook: Milestone Implementation

> Reusable scaffold. Fill in and run **only after `START IMPLEMENTATION`**. Obeys `process/engineering-rules.md`. Conforms to `docs/ENGINEERING_WORKFLOW.md`, `docs/MILESTONES.md`.

```
You are the <owner-lane> engineer. Implement milestone <M##>, <title>.

GOAL
<one-line objective>

LINKED DOCS / SPECS
<MILESTONES.md M## · owning spec(s) · architecture doc(s)>

ALLOWED FILES / PACKAGES
<apps/* and/or @quad/* this milestone may touch>

FORBIDDEN FILES / SCOPE
<what NOT to touch; no unrelated rewrites; stay in lane>

CONTRACTS TOUCHED
<API/WS/event/DB/@quad/core, if any, update @quad/core + owning doc/spec in THIS PR (ADR if architectural)>

TESTS REQUIRED
<unit/integration(real PG+Redis)/contract/e2e/security/perf/a11y; critical-subsystem matrix items>

ACCEPTANCE CRITERIA
<testable; map to P-AC-*/spec>

STOP CONDITIONS
Stop and ask (options + recommendation) on: ambiguity · any contract change · auth/security/cooldown/tenant/event-sourcing/moderation · migration/data-loss · perf-budget risk · oversized PR · missing tests.

VERIFICATION OUTPUT (required)
Run and report with results: lint · typecheck · unit · integration · relevant e2e · security/perf where relevant · doc/spec consistency. No fabricated results.

DOC/SPEC UPDATE
Update docs/specs for any contract/behavior change in this PR.

REPORT FORMAT
1) files changed 2) summary 3) tests/verification (commands+results) 4) risks 5) next step. No git commit unless explicitly asked.
```
