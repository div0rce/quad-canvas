<!-- TEMPLATE: copy into a PR review. Mirrors docs/REVIEW_PROCESS.md. -->
# PR Review — `<PR title / M##>`

> Reminders: **evidence over claims** · a reviewer **can reject for missing docs or tests alone** · review is **independent** (reviewer ≠ implementer) · **no merge/commit unless explicitly asked**; never directly to the default branch. Conforms to `REVIEW_PROCESS.md`.

- **Reviewer:** `<role>` · **Milestone/Spec:** `<M## / spec>`

## 1. Checklist
- [ ] **Milestone/spec linked** (`<M## / spec>`)
- [ ] **Scope correct** — one milestone, no unrelated rewrites, within size caps (~400 LOC / ~10 files)
- [ ] **Contracts touched listed** (`API/WS/event/DB/@quad/core`)
- [ ] **Docs/specs updated** for any contract/behavior change (same PR); ADR if architectural
- [ ] **Tests present** for the change + touched critical subsystems (`TESTING.md` matrix)
- [ ] **Tests run with results** included (no fabricated results)
- [ ] **Security/performance impacts considered** (`SECURITY.md` / `PERFORMANCE.md` budgets)
- [ ] **Tenant neutrality** preserved (no hardcoded tenant; config-driven)
- [ ] **No forbidden patterns** / fitness checks pass (`CODE_QUALITY.md` §5)

## 2. Required Evidence (in PR summary)
`<files changed · milestone/spec link · contracts touched · test commands+results · security/perf notes · doc/spec diffs · risks · follow-ups>`

## 3. Rejection Reasons (check any that apply)
- [ ] missing/failing tests · [ ] missing/contradicted docs · [ ] drift/forbidden pattern · [ ] scope creep/oversized · [ ] contract change without ADR · [ ] unverifiable claims · [ ] tenant hardcoding · [ ] security/perf regression

## 4. Approval Decision
`<APPROVE | REQUEST CHANGES | REJECT>` — `<specific, actionable reasons>`

## 5. Follow-Up Work
`<out-of-scope items → new milestones/issues, not scope creep here>`

## Document Control
- **Acceptance:** ☑ checklist complete ☑ evidence verified ☑ reasons specific ☑ merge only when asked.
