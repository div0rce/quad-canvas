# ADR-0009 — Moderation & Auditability

- **Status:** Accepted · **Date:** 2026-06 · **Deciders:** Architect, Moderation, Security · **Linked docs:** `docs/MODERATION.md`, `docs/EVENT_SOURCING.md`, `docs/SECURITY.md`, `docs/ARCHIVES.md`

## 1. Context
Safety (removing offensive content) and permanence (never lose history) must coexist (`PRIN-NO-INVISIBLE-LOSS`), with accountable, reversible moderation.

## 2. Decision
**Moderation acts via compensating events plus an atomic audit entry; nothing is hard-deleted; public replay/archive surfaces are sanitized while raw history is role-gated.**
- **Reversible** — rollback/remove are new compensating events; originals preserved.
- **Atomic** — the effect (compensating event/ban) and the `DC4` audit row commit together; **audit-write failure aborts the action**.
- **Gated destructive actions** — wide/time-range rollback, mass removal, permanent ban require admin approval / two-person review.
- **No placement-power advantage** for any role; emergency levers are tenant-wide, audited, never per-user.
- **Public sanitized / raw gated** — public surfaces hide removed content; moderators/operators access raw under authorization.

## 3. Consequences
+ Safety without erasing history; precise, reversible, auditable moderation. − Requires atomic effect+audit + gating discipline; post-archive correction is an exceptional path.

## 4. Alternatives Considered
- **Hard delete:** rejected — destroys history; violates permanence.
- **Unaudited moderator tools:** rejected — no accountability.
- **Private-only moderation (no public sanitization):** rejected — either re-exposes content or hides that anything happened inconsistently.

## 5. Affected Docs / Contracts
`MODERATION.md` (`MOD-INV-*`), `EVENT_SOURCING.md` (compensating events), `SECURITY.md` (audit immutability), `ARCHIVES.md` (post-archive correction), `@quad/core` (moderation/audit types).

## 6. Migration / Rollout Notes
Moderation tools + atomic audit land in M34–M36; sanitized public surfaces verified M39.

## 7. Follow-Up Actions
**Deferred:** gated-action thresholds + two-person-review flow; **audit retention + legal hold**; **post-archive correction policy** (exceptional, operator-level) — finalize with legal (`LAUNCH_PLAN.md` `LG-9`). Reporter-notification policy (`P-Q-6`); moderator sourcing/ladder (`P-Q-5`).

## Document Control
- **Path:** `docs/adr/0009-moderation-and-auditability.md` · **Acceptance:** ☑ compensating events + atomic audit ☑ no hard delete ☑ gated destructive ☑ no placement advantage ☑ sanitized public/raw gated ☑ post-archive posture ☑ retention/legal deferred ☑ alternatives.
