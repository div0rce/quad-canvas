# ADR-0004 — WebSocket Strategy

- **Status:** Accepted · **Date:** 2026-06 · **Deciders:** Architect, Realtime · **Linked docs:** `docs/WEBSOCKETS.md`, `docs/API.md`, `docs/EVENT_SOURCING.md`

## 1. Context
The canvas must feel alive at thousands of concurrent users (`PRIN-ALIVE`) while keeping a single, well-validated authoritative write path.

## 2. Decision
**REST accepts commands; WebSockets broadcast live updates only; Redis/Valkey pub/sub fans out across instances; convergence is via REST snapshot-on-(re)connect.**
- **No authoritative writes over WS** (placement is the REST command).
- Canvas-changing messages carry the **per-canvas sequence**; clients apply via a monotonic guard (timestamps display-only).
- **Reconnect/gap → re-fetch the REST snapshot** (pub/sub is best-effort; durability stays in Postgres).
- **No polling** for the live canvas.

## 3. Consequences
+ One validated write lane; horizontal WS scale via pub/sub; correctness despite best-effort delivery. − Requires snapshot-on-reconnect + monotonic guard discipline; fan-out latency is the scaling watch-item.

## 4. Alternatives Considered
- **Polling:** rejected — stale, wasteful, not "alive."
- **Authoritative WS commands:** rejected — splits the write path; weakens validation/fairness.
- **DB pub/sub only (no Redis):** rejected — couples realtime to the DB; poorer fan-out.

## 5. Affected Docs / Contracts
`WEBSOCKETS.md` (`WS-INV-*`), `API.md` (§16 no-polling), `EVENT_SOURCING.md` (ordering), `@quad/core` (WS message types), `PERFORMANCE.md` (fan-out budget B09).

## 6. Migration / Rollout Notes
WS server + pub/sub land in milestones M14–M15; reconnect convergence M18.

## 7. Follow-Up Actions
WS-handshake auth mechanism → `ADR-0006`; compression/heartbeat tuning → `PERFORMANCE.md`/`OPERATIONS.md`; Redis vs Valkey + topology → `ADR-0010`.

## Document Control
- **Path:** `docs/adr/0004-websocket-strategy.md` · **Acceptance:** ☑ REST-commands/WS-broadcast ☑ no WS writes ☑ per-canvas seq ☑ snapshot reconnect ☑ Redis=transport ☑ alternatives.
