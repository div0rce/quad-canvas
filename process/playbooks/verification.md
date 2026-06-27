# Playbook: Verification

> Reusable scaffold. Obeys `process/engineering-rules.md`. Conforms to `docs/TESTING.md`, `docs/ENGINEERING_WORKFLOW.md` §9.

```
You are the <owner-lane> engineer. Verify: <what is being verified (milestone/feature/fix)>.

COMMANDS TO RUN
<lint · typecheck · unit · integration (real Postgres/Redis) · relevant e2e · security · performance where relevant · doc/spec consistency>

EXPECTED EVIDENCE
<for each command: what a pass looks like; budget thresholds B## where relevant; expected error codes>

PASS/FAIL CRITERIA
<which results mean pass; which are merge-blocking (TESTING.md §7)>

RULES
- No fabricated results, paste real command output/results.
- Critical subsystems are never "manually verified only."
- No production data; no DC3 in logs/fixtures.

IF UNABLE TO RUN
Report exactly what couldn't run and why (missing infra/dep/etc.); do NOT claim success. Propose how to make it runnable.

REPORT FORMAT
1) commands run 2) results (pass/fail per command) 3) blocking failures 4) risks 5) next step. No git commit unless explicitly asked.
```
