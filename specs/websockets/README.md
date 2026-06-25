# `specs/websockets/` — WebSocket Message Specs

Conventions for **WS message/event specs**. Conforms to `docs/WEBSOCKETS.md`, `docs/EVENT_SOURCING.md`, `docs/SECURITY.md`. Tenant-neutral.

- **What belongs here:** one spec per WS message — name, direction, auth/subscription, tenant/canvas scope, payload schema, ordering, reconnect, privacy, tests.
- **Template:** [`templates/websocket-event-spec.md`](../../templates/websocket-event-spec.md).
- **Owning doc:** `docs/WEBSOCKETS.md`.
- **Naming:** `specs/websockets/<MessageName>.md` (PascalCase message name).
- **Required rules:**
  - **WS broadcasts live updates only** — **no authoritative placement writes over WS** (placement is REST).
  - **Payloads are typed + `schemaVersion`-ed in `@quad/core`** (no untyped messages).
  - **Per-canvas sequence ordering**; clients apply via a monotonic guard (timestamps display-only).
  - **Reconnect converges via REST snapshot** (pub/sub is best-effort).
  - **No `DC3`**; `DC2` only; presence = counts, not identities.
- **Same-PR updates:** `@quad/core` message types + `docs/WEBSOCKETS.md` + this spec.
- **Tests/evidence:** contract, subscription authz, tenant isolation, reconnect convergence, duplicate/out-of-order, no-`DC3`.
- **Stop conditions:** new/changed message contract → stop + update; **no implementation before `START IMPLEMENTATION`.**

## Document Control
- **Path:** `specs/websockets/README.md` · **Template:** `templates/websocket-event-spec.md` · **Depends on:** `WEBSOCKETS`, `EVENT_SOURCING`, `SECURITY`, `@quad/core`. · **Next:** `specs/database/README.md`.
