<!-- TEMPLATE: copy to a milestone tracker entry. Mirrors docs/MILESTONES.md §5 fields. -->
# Milestone `<M##>` — `<imperative title>`

> Reminders: **one milestone = one PR**, small diff, spec-linked · **contract changes update `@quad/core` + docs/specs same-PR** · **no implementation before `START IMPLEMENTATION`** · **stop, don't guess** on contract/auth/security/cooldown/tenant/event-sourcing/moderation/migration/perf-risk. Conforms to `MILESTONES.md`, `ENGINEERING_WORKFLOW.md`.

- **MVP?** `<yes | post-MVP>` · **Group:** `<M0–M9 | …>` · **Linked docs/specs:** `<linked-docs>`

## 1. Objective
`<what this milestone delivers>`

## 2. Owner Lane
`<Planner | Architect | Frontend | Backend | Database | Realtime | Rendering | Security | Testing | DevOps | Reviewer>`

## 3. Prerequisite Docs / Specs / Milestones
`<deps met before starting; no dependency on a later milestone>`

## 4. Allowed Files / Packages
`<apps/web · apps/api · @quad/core · @quad/db · @quad/realtime · @quad/render · @quad/config · @quad/ui — only what's needed>`

## 5. Forbidden Scope
`<what NOT to touch; no unrelated rewrites; no cross-lane drift>`

## 6. Contracts Touched
`<API/WS/event/DB/@quad/core types; → same-PR doc/spec updates + ADR if architectural>`

## 7. Implementation Outline
`<ordered steps; clean package boundaries>`

## 8. Acceptance Criteria
- [ ] `<testable; map to P-AC-*/spec where relevant>`

## 9. Required Tests
`<unit/integration/contract/e2e/security/perf/a11y; critical-subsystem matrix items; → TESTING.md>`

## 10. Risks / Stop Conditions
`<regression risks; which stop conditions apply>`

## 11. Rollback / Fix-Forward Note
`<app rollback safe? data migration forward-fix? expand/contract>`

## Document Control
- **Acceptance:** ☑ all §1–§11 fields ☑ deps met ☑ scope bounded ☑ tests listed ☑ contract→doc same-PR noted ☑ PR-sized.
