# ADR-0003: Event Sourcing

- **Status:** Accepted · **Date:** 2026-06 · **Deciders:** Architect, Backend · **Linked docs:** `docs/EVENT_SOURCING.md`, `docs/DATABASE.md`

## 1. Context
Quad's core promise is permanence, every action preserved, every pixel's story replayable, moderation reversible without erasing history (`PRIN-PERMANENCE`).

## 2. Decision
**An append-only event log is the source of truth; all read models are derived projections.**
- The **current canvas** is a projection; so are **profiles, leaderboards, heatmaps, analytics, replay, and archives**.
- **Moderation uses compensating events** (rollback/remove), never mutation or deletion of past events.
- Events carry a **per-canvas sequence** (authoritative order; timestamps display-only), an **idempotency key**, and a **`schemaVersion`**; evolution is additive with read-time **upcasting** (stored events never rewritten).
- Append + hot-projection update + idempotency record are **atomic**.

## 3. Consequences
+ Permanence/replay/audit fall out naturally; projections are rebuildable + verifiable. − Requires discipline (append-only, atomicity, idempotency) and projection-rebuild tooling.

## 4. Alternatives Considered
- **Mutable canvas table as source of truth:** rejected, loses history; breaks replay/audit.
- **Periodic snapshots only (no event log):** rejected, coarse history; no per-pixel story.

## 5. Affected Docs / Contracts
`EVENT_SOURCING.md` (semantics/`ES-INV-*`), `DATABASE.md` (storage/append-only), `@quad/core` (event schemas), `MODERATION.md`, `REPLAY.md`, `ARCHIVES.md`.

## 6. Migration / Rollout Notes
Event log + projection schema land in milestones M6/M11; checkpoints + keyframes in M40.

## 7. Follow-Up Actions
**Optional per-canvas hash chain** for tamper-evidence (`ES-INV-12`), adoption + algorithm to `SECURITY.md`/implementation. Checkpoint/snapshot cadence → implementation.

## Document Control
- **Path:** `docs/adr/0003-event-sourcing.md` · **Acceptance:** ☑ log=truth ☑ projections derived ☑ compensating events ☑ versioning/upcasting ☑ hash-chain follow-up ☑ alternatives.
