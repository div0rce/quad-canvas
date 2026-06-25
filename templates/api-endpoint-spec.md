<!-- TEMPLATE: copy to specs/api/<endpoint>.md. Reusable REST endpoint spec. -->
# API Endpoint Spec — `<METHOD /api/v1/path>`

> Reminders: endpoints are **typed by `@quad/core`** (no duplicate DTOs) · **every endpoint must appear in `API.md`** (update same-PR) · **no implementation before `START IMPLEMENTATION`** · **stop, don't guess** on contract changes. Tenant-neutral. Conforms to `API.md`.

- **Status:** `<draft|ready>` · **Owner lane:** Backend · **Milestone:** `<M##>` · **Linked docs:** `API.md`, `<...>`

## 1. Purpose / Scope
`<what this endpoint does>` — **Non-goals:** `<...>`

## 2. Method / Path
`<METHOD>` `</api/v1/...>`

## 3. Auth Required
`<public | participant | moderator | admin | operator>` (enforced server-side)

## 4. Tenant Context
`<resolved active tenant | operator cross-tenant>`; cross-tenant access → `404`.

## 5. Request DTO (`@quad/core`)
`<Request/Query/CommandDTO name + fields (conceptual)>`

## 6. Response DTO (`@quad/core`)
`<ResponseDTO name + shape; collections use {data,page}>`

## 7. Error Codes
`<from API.md §8: VALIDATION_ERROR | UNAUTHENTICATED | FORBIDDEN | NOT_FOUND | CONFLICT | COOLDOWN_ACTIVE | RATE_LIMITED | INTERNAL>`

## 8. Idempotency Requirements
`<state-changing? requires Idempotency-Key; duplicate behavior>`

## 9. Security / Privacy Rules
`<authz; DC2-only output; no DC3; input validation; output filtering>`

## 10. Rate Limits
`<per identity/IP; distinct from COOLDOWN_ACTIVE>`

## 11. Dependencies / Impacts
- **Data/event:** `<projection read | command→event; → EVENT_SOURCING/DATABASE>`
- **WS:** `<broadcast produced? → WEBSOCKETS>` · **Performance:** `<budget B##>` · **Accessibility:** n/a (transport)

## 12. Tests Required
`<contract, route behavior, authz, tenant-isolation, idempotency, error-model, no-DC3>`

## 13. Acceptance Criteria · 14. Regression Risks · 15. Stop Conditions
`<...>` / `<...>` / `<contract change → ADR? auth/cooldown touch?>`

## Document Control
- **Path:** `specs/api/<endpoint>.md` · **Depends on:** `API.md`, `@quad/core` · **Acceptance:** ☑ in API.md catalog ☑ DTOs in core ☑ errors listed ☑ tenant-scoped ☑ tests.
