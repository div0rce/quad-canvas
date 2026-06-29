# Database Migration Spec: `lifecycle-event-payload`

- **Status:** ready · **Owner lane:** Database · **Milestone:** convergence bugfix · **Linked docs:** `DATABASE.md`, `EVENT_SOURCING.md`, `API.md`, `WEBSOCKETS.md`

## 1. Migration Objective · Scope · Non-goals

Allow canonical canvas lifecycle events to participate in the existing per-canvas ordered event log.
Make coordinate columns nullable for non-pixel events and add a JSON payload column. No event is
rewritten and no separate stream is introduced.

## 2. Tables / Indexes Affected

`pixel_events`: widen `x`/`y` from required to nullable; add nullable `payload JSONB`. Existing indexes
and uniqueness constraints remain.

## 3. Expand/Contract Classification

Expand: nullable column addition plus removal of two NOT NULL constraints.

## 4. Backward Compatibility

The previous app continues inserting non-null pixel coordinates and ignores the new column. Existing
queries filtered by coordinates continue to exclude lifecycle rows.

## 5. Data-Migration Risk

None; no backfill or table rewrite is required for the nullable JSON column and constraint widening.

## 6. Backup / Rollback / Forward-Fix Plan

Use the normal pre-deploy backup. The schema is rollback-safe for the prior app. Forward-fix event
reader defects; never remove or rewrite lifecycle events after append.

## 7. Tenant Isolation Checks

Lifecycle events retain required `tenant_id` and `canvas_id`; existing tenant-scoped idempotency and
per-canvas sequence uniqueness remain intact.

## 8. Impacts

- **API/WS/event:** implements existing lifecycle event and ordered WS contracts.
- **Performance:** negligible nullable payload storage; existing hot indexes unchanged.
- **Security:** lifecycle history becomes immutable and attributable in the same guarded log.

## 9. Tests Required

Migration deploy; create/freeze/archive append correctly ordered events atomically with state and audit;
idempotent retries append once; replay/snapshot readers tolerate null coordinates.

## 10. Acceptance Criteria · 11. Regression Risks · 12. Stop Conditions

Existing placement/replay tests stay green and lifecycle regression tests prove event/state/audit
atomicity. Main risk is a reader assuming every event has coordinates; typecheck and replay tests gate
that risk. Any destructive rewrite of historical events is forbidden.

## Document Control

- **Path:** `specs/database/0002-lifecycle-event-payload.md` · **Depends on:** `DATABASE.md`, `EVENT_SOURCING.md` · **Acceptance:** expand classified; rollback-safe; tenant-scoped; append-only history preserved; regression tests required.
