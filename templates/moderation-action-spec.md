<!-- TEMPLATE: copy to specs/moderation/<action>.md. Reusable moderation action spec. -->
# Moderation Action Spec — `<action-name>`

> Reminders: **no hard delete — visible state changes via compensating events** · **every action writes an audit entry atomically with its effect** · **no placement-power advantage** · public surfaces sanitized · **no impl before `START IMPLEMENTATION`** · **stop, don't guess** on moderation/audit changes. Conforms to `MODERATION.md`, `EVENT_SOURCING.md`.

- **Status:** `<draft|ready>` · **Owner lane:** Moderation/Backend · **Milestone:** `<M##>` · **Linked docs:** `MODERATION.md`

## 1. Action Name · Scope · Non-goals
`<rollback pixel | region | remove artwork | suspend | ban | reverse | ...>` / `<...>` / `<no hard delete; no fairness bypass>`

## 2. Actor / Permission
`<moderator | tenant admin | operator>`; tenant-scoped; gated (two-person/admin) if destructive.

## 3. Target Type
`<pixel | region | artwork | user | report>`

## 4. Compensating Event Impact
`<which compensating event(s) produced; projection effect; original event preserved>`

## 5. Audit Fields
`<actor, action, target, reason, timestamp, tenantId, related event>` — `DC4`, append-only, atomic with effect.

## 6. Approval / Two-Person-Review Needs
`<required for wide rollback / mass removal / permanent ban?>`

## 7. Public Sanitization Behavior
`<removed content not re-exposed in public replay/visible state; raw gated>`

## 8. Reversal / Appeal Posture
`<reversible via new compensating event + audit; prior audit retained; appeal path>`

## 9. Impacts
- **WS:** `<ModerationActionApplied / sanitized public update>` · **Privacy:** `<DC2 public; DC3 never>` · **Security:** `<least privilege; audited>`

## 10. Tests Required
`<permission; atomic audit (audit-fail aborts); compensating-event correctness; no-hard-delete; sanitized replay; tenant isolation>`

## 11. Acceptance Criteria · 12. Regression Risks · 13. Stop Conditions
`<...>` / `<...>` / `<new destructive action / audit change → ADR-0009 + MODERATION.md update>`

## Document Control
- **Path:** `specs/moderation/<action>.md` · **Depends on:** `MODERATION.md`, `EVENT_SOURCING.md` · **Acceptance:** ☑ compensating event ☑ atomic audit ☑ no hard delete ☑ sanitized public ☑ gated if destructive ☑ tests.
