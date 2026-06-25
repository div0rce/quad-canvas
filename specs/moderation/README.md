# `specs/moderation/` — Moderation Action Specs

Conventions for **moderation action specs**. Conforms to `docs/MODERATION.md`, `docs/EVENT_SOURCING.md`, `docs/SECURITY.md`, `docs/ARCHIVES.md`. Tenant-neutral.

- **What belongs here:** one spec per moderation action — actor/permission, target type, compensating-event impact, audit fields, approval/two-person-review needs, public sanitization, reversal/appeal posture, tests.
- **Template:** [`templates/moderation-action-spec.md`](../../templates/moderation-action-spec.md).
- **Owning doc:** `docs/MODERATION.md`.
- **Naming:** `specs/moderation/<action-slug>.md`.
- **Required rules:**
  - **No hard delete** — visible state changes via **compensating events**.
  - **Compensating event + audit entry commit atomically** (audit-write failure aborts the action).
  - **Gated destructive actions** (wide rollback / mass removal / permanent ban → admin approval / two-person review).
  - **Public sanitization** — removed content never re-exposed; raw history role-gated.
  - **Reversal/appeal posture** — actions reversible; prior audit retained.
- **Same-PR updates:** `@quad/core` (compensating event types) + `docs/MODERATION.md`/`docs/EVENT_SOURCING.md` + this spec.
- **Tests/evidence:** permission; atomic audit; compensating-event correctness; no-hard-delete; sanitized replay; tenant isolation.
- **Stop conditions:** **moderation/audit changes are stop conditions** (ADR-0009 if architectural). **No implementation before `START IMPLEMENTATION`.**

## Document Control
- **Path:** `specs/moderation/README.md` · **Template:** `templates/moderation-action-spec.md` · **Depends on:** `MODERATION`, `EVENT_SOURCING`, `SECURITY`, `ARCHIVES`. · **Next:** `specs/testing/README.md`.
