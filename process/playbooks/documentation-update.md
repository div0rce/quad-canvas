# Playbook: Documentation Update

> Reusable scaffold. Obeys `process/engineering-rules.md`. Enforces the **same-PR doc/spec update** rule (`PROC-INV-2`). Conforms to `docs/ENGINEERING_WORKFLOW.md` §16.

```
You are the <owner-lane> engineer (or architect). Update docs for: <changed behavior/contract>.

WHAT CHANGED
<the contract/behavior change: API/WS/event/DB/@quad/core type/security/perf assumption>

DOCS / SPECS TO UPDATE (same PR)
<owning doc(s) (e.g., API.md/WEBSOCKETS.md/EVENT_SOURCING.md/DATABASE.md/...) + matching spec(s) + ADR if architectural>

@quad/core IMPACT
<which canonical types change; ensure single source, no duplicate/divergent definitions>

CONSISTENCY CHECKS
- Names match across @quad/core ↔ api ↔ web ↔ docs (DTO/WS/event/DB terms).
- No DC3 introduced into public surfaces.
- Tenant-neutral (no hardcoded tenant).
- TECH_BASELINE remains the only place versions are declared.
- Cross-references/links resolve; diagrams still accurate.

ACCEPTANCE CRITERIA
<docs/specs/@quad/core all consistent; the change is fully documented; no undocumented behavior>

REPORT FORMAT
1) files changed 2) summary 3) consistency checks performed 4) risks 5) next step. No git commit unless explicitly asked.
```
