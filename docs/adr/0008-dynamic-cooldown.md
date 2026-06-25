# ADR-0008 — Dynamic Cooldown

- **Status:** Accepted · **Date:** 2026-06 · **Deciders:** Architect, Backend · **Linked docs:** `docs/COOLDOWN.md`, `docs/PRODUCT.md` §8, `docs/PRINCIPLES.md`

## 1. Context
Fairness is the soul of the product (`PRIN-FAIRNESS`): everyone must wait the same, and the system must survive load without per-user advantage.

## 2. Decision
**A global, per-tenant/canvas, load-based cooldown bounded 5–20 minutes, server-enforced, smoothed, and fail-closed.**
- **Load score** ∈ [0,1] from weighted normalized inputs (presence, placement rate, hot-path latency, WS pressure, infra latency, errors); mapped `cooldown = 5 + score×15`, clamped [5,20].
- **Smoothing/clamping:** EMA + max-step-per-recompute + hysteresis (no oscillation).
- **In-flight timers are fixed at placement time** (later global changes affect only future placements).
- **State in Redis/Valkey (ephemeral)**; durable history optional; **no durable truth depends on Redis**.
- **Fail-closed:** if cooldown state can't be verified, placements are rejected (never fail open).
- **No individual advantage** — no paid/role/streak path shortens any user's cooldown.

## 3. Consequences
+ Fair + load-adaptive; write-load naturally bounded (≈ activeUsers/cooldown). − Redis dependency on the hot path (mitigated by fail-closed + key protection).

## 4. Alternatives Considered
- **Fixed cooldown only:** rejected — can't adapt to load; worse fairness/strategy under spikes.
- **Per-user dynamic advantage:** rejected — violates equal power.
- **Client-side cooldown authority:** rejected — trivially bypassable; not server-authoritative.

## 5. Affected Docs / Contracts
`COOLDOWN.md` (`COOL-INV-*`), `API.md` (`429 COOLDOWN_ACTIVE`), `WEBSOCKETS.md` (`CooldownUpdated`), `@quad/core` (cooldown types), `PERFORMANCE.md` (B08).

## 6. Migration / Rollout Notes
Enforcement lands in M25; recompute job M26; fail-closed + display M27; presence/inputs M28.

## 7. Follow-Up Actions
**Deferred tuning:** final weights, linear vs piecewise mapping, α/max-step/interval, fallback default → `COOLDOWN.md` §24; Redis eviction-policy protection of cooldown keys → `DEPLOYMENT.md`.

## Document Control
- **Path:** `docs/adr/0008-dynamic-cooldown.md` · **Acceptance:** ☑ global/5–20/server-enforced ☑ load inputs+mapping ☑ smoothing/clamp ☑ in-flight fixed ☑ Redis ephemeral ☑ fail-closed ☑ no advantage ☑ alternatives ☑ tuning deferred.
