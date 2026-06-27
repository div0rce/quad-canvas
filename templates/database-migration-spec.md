<!-- TEMPLATE: copy to specs/database/<migration>.md. Reusable migration spec. -->
# Database Migration Spec — `<migration-name>`

> Reminders: **no schema change without this spec** · **migrations run as a controlled step, not app boot; backup-first** · **the event log is append-only — no destructive migration on it** · update `DATABASE.md` same-PR · **stop, don't guess** on data-loss risk. Conforms to `DATABASE.md`, `DEPLOYMENT.md`.

- **Status:** `<draft|ready>` · **Owner lane:** Database · **Milestone:** `<M##>` · **Linked docs:** `DATABASE.md`, `DEPLOYMENT.md`

## 1. Migration Objective · Scope · Non-goals
`<what changes & why>` / `<bounded scope>` / `<not refactoring unrelated tables>`

## 2. Tables / Indexes Affected
`<tables, columns, indexes, partitions>`

## 3. Expand/Contract Classification
`<expand (additive, backward-compatible) | contract (drop old, after app no longer uses it)>`

## 4. Backward Compatibility
`<is the app rollback-safe against this schema? (must be for expand)>`

## 5. Data-Migration Risk
`<none | backfill | transform>`; volume; locking; online vs offline.

## 6. Backup / Rollback / Forward-Fix Plan
`<backup before migrate; rollback limits; forward-fix preference for data migrations>`

## 7. Tenant Isolation Checks
`<tenant_id present; tenant-scoped uniqueness; no cross-tenant exposure; RLS if used>`

## 8. Impacts
- **API/WS/event:** `<contracts touched? → same-PR doc/spec>` · **Performance:** `<hot-path/index impact>` · **Security:** `<DC* exposure>`

## 9. Tests Required
`<migration up/down; expand/contract safety; tenant isolation; projection-rebuild if event/projection touched>`

## 10. Acceptance Criteria · 11. Regression Risks · 12. Stop Conditions
`<applies cleanly; app compatible>` / `<...>` / `<any data-loss/destructive-log risk → STOP + review>`

## Document Control
- **Path:** `specs/database/<migration>.md` · **Depends on:** `DATABASE.md` · **Acceptance:** ☑ expand/contract classified ☑ backup/rollback plan ☑ tenant isolation ☑ event log not destructively altered ☑ tests.
