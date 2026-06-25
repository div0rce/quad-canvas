<!-- TEMPLATE: copy to specs/events/<EventName>.md. Reusable event-sourcing event spec. -->
# Domain Event Spec — `<EventName>`

> Reminders: events are **append-only & immutable** (rollbacks are new compensating events) · **declared in `@quad/core`**, versioned · update `EVENT_SOURCING.md` same-PR · **no impl before `START IMPLEMENTATION`** · **stop, don't guess** on event-sourcing changes. Conforms to `EVENT_SOURCING.md`, `DATABASE.md`.

- **Status:** `<draft|ready>` · **Owner lane:** Backend · **Milestone:** `<M##>` · **Linked docs:** `EVENT_SOURCING.md`

## 1. Event Name (past-tense fact)
`<PixelPlaced | PixelRolledBack | ...>`

## 2. Producer
`<which command/handler appends it>`

## 3. Payload (`@quad/core`, conceptual)
`<envelope: id, tenantId, canvasId, actorId(→DC2), type, payload, metadata(no DC3), ts(display), seq, idempotencyKey, schemaVersion>` + `<type-specific fields>`

## 4. Tenant / Canvas Scope
`<tenant- and canvas-scoped; per-canvas sequence>`

## 5. Sequence / Idempotency Rules
`<assigned per-canvas seq at append; idempotency-key dedupe; one charge if placement>`

## 6. Projection Effects
`<which projections update (pixels/user_stats/leaderboards/analytics); atomic with append?>`

## 7. Replay / Archive / Moderation Implications
`<replay order; sanitized public if compensating; archive inclusion>`

## 8. Compatibility / Upcasting Notes
`<schemaVersion; additive changes only; upcast old payloads at read; never rewrite stored events>`

## 9. Impacts
- **Security/privacy:** `<no DC3; actor via DC2>` · **Performance:** `<append/projection budget B07>`

## 10. Tests Required
`<append-only; ordering; idempotency; projection correctness; rebuild determinism; schema-version compat>`

## 11. Acceptance Criteria · 12. Regression Risks · 13. Stop Conditions
`<...>` / `<...>` / `<new/changed event → ADR if architectural; never mutate past events>`

## Document Control
- **Path:** `specs/events/<EventName>.md` · **Depends on:** `EVENT_SOURCING.md`, `@quad/core` · **Acceptance:** ☑ append-only ☑ versioned ☑ scoped ☑ projection/replay defined ☑ no-DC3 ☑ tests.
