# Database Migration Spec: `append-only-guards`

- **Status:** ready · **Owner lane:** Database · **Milestone:** convergence bugfix · **Linked docs:** `DATABASE.md`, `EVENT_SOURCING.md`, `MODERATION.md`, `DEPLOYMENT.md`

## 1. Migration Objective · Scope · Non-goals

Enforce the existing immutable-log contract in PostgreSQL by rejecting `UPDATE`, `DELETE`, and
`TRUNCATE` against `pixel_events` and `moderation_actions`. Scope is limited to mutation guards; it
does not reshape either table, rewrite data, or change event/audit semantics.

## 2. Tables / Indexes Affected

`pixel_events` and `moderation_actions`: two triggers per table plus one shared trigger function. No
columns, indexes, constraints, or rows change.

## 3. Expand/Contract Classification

Expand: additive and backward-compatible. Existing applications only insert/read these tables.

## 4. Backward Compatibility

Rollback-safe for the previous application because it has no legitimate update/delete/truncate path
for either immutable log. Inserts and reads are unchanged.

## 5. Data-Migration Risk

None. No scan, backfill, transform, or table rewrite. Trigger creation takes brief metadata locks.

## 6. Backup / Rollback / Forward-Fix Plan

Take the normal pre-deploy backup. If a legitimate write path is unexpectedly blocked, forward-fix
that path to append a compensating record; do not weaken or remove immutability as an application fix.

## 7. Tenant Isolation Checks

No tenant data or scoping changes. Guards apply uniformly to every tenant row.

## 8. Impacts

- **API/WS/event:** no wire change; enforces existing event/audit invariants.
- **Performance:** inserts/reads unaffected; forbidden operations fail before mutation.
- **Security:** prevents ordinary database sessions from silently rewriting or erasing DC1/DC4 history.

## 9. Tests Required

Migration deploy; direct update/delete/truncate attempts against both tables must fail; rows remain;
normal placement/moderation inserts and projection behavior remain green.

## 10. Acceptance Criteria · 11. Regression Risks · 12. Stop Conditions

Applies cleanly and all six forbidden-operation probes fail. Risk: test cleanup and controlled DBA
recovery must explicitly disable user triggers. Any evidence of a legitimate production mutation path
or data-loss requirement is a stop condition requiring review.

## Document Control

- **Path:** `specs/database/0001-append-only-guards.md` · **Depends on:** `DATABASE.md` · **Acceptance:** expand classified; rollback plan; tenant isolation unchanged; event log not destructively altered; direct mutation tests present.
