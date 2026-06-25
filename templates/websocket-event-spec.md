<!-- TEMPLATE: copy to specs/websockets/<message>.md. Reusable WS message/event spec. -->
# WebSocket Message Spec — `<MessageName>`

> Reminders: messages are **typed by `@quad/core`** with a `schemaVersion` (no untyped payloads) · **WS broadcasts only; no authoritative writes over WS** · update `WEBSOCKETS.md` same-PR · **no impl before `START IMPLEMENTATION`** · **stop, don't guess** on contract changes. Tenant-neutral.

- **Status:** `<draft|ready>` · **Owner lane:** Realtime · **Milestone:** `<M##>` · **Linked docs:** `WEBSOCKETS.md`, `EVENT_SOURCING.md`

## 1. Purpose / Scope · Non-goals
`<what this message conveys>` / `<not a command; not chat/DM>`

## 2. Message Name
`<MessageName>`

## 3. Direction
`<server→client | client→server>`

## 4. Auth / Subscription Requirements
`<authenticated connection; role for mod channel; subscription authz>`

## 5. Tenant / Canvas Scope
`<channel tenant:{id}:canvas:{canvasId} | :mod>`; no cross-tenant.

## 6. Payload Schema (`@quad/core`)
`<envelope: msgId, type, schemaVersion, tenantId/canvasId, seq?, payload, ts(display), correlationId?>` + `<payload fields>`. **No `DC3`; `DC2` only.**

## 7. Ordering / Sequence Rules
`<carries per-canvas seq? clients apply via monotonic guard; timestamps display-only>`

## 8. Reconnect Behavior
`<best-effort; convergence via snapshot-on-reconnect; gap → resnapshot>`

## 9. Privacy Rules
`<DC2 only; presence = counts not identities>`

## 10. Dependencies / Impacts
- **Produced by:** `<event/command; → EVENT_SOURCING/BACKEND>` · **Performance:** `<fan-out budget B09>` · **Security:** `<origin/authz>`

## 11. Tests Required
`<contract, subscription authz, tenant isolation, reconnect convergence, duplicate/out-of-order, no-DC3>`

## 12. Acceptance Criteria · 13. Regression Risks · 14. Stop Conditions
`<...>` / `<...>` / `<new message type → schema + WEBSOCKETS.md update>`

## Document Control
- **Path:** `specs/websockets/<message>.md` · **Depends on:** `WEBSOCKETS.md`, `@quad/core` · **Acceptance:** ☑ typed+versioned ☑ scoped ☑ ordering/reconnect defined ☑ no-DC3 ☑ tests.
