# `specs/events/`: Domain Event Specs

Conventions for **event-sourcing event specs**. Conforms to `docs/EVENT_SOURCING.md`, `docs/DATABASE.md`, `docs/REPLAY.md`, `docs/ARCHIVES.md`, `docs/MODERATION.md`. Tenant-neutral.

- **What belongs here:** one spec per domain event, name, producer, payload, tenant/canvas scope, sequence/idempotency, projection effects, replay/archive/moderation implications, compatibility/upcasting, tests.
- **Template:** [`templates/domain-event-spec.md`](../../templates/domain-event-spec.md).
- **Owning doc:** `docs/EVENT_SOURCING.md` (semantics).
- **Naming:** `specs/events/<EventName>.md` (PascalCase, past-tense fact).
- **Required rules:**
  - **Events are append-only, immutable facts**: never updated/deleted.
  - **Compensating events handle rollback/moderation** (no hard delete).
  - **Event schemas live in `@quad/core`** and are **versioned** (`schemaVersion`; additive + upcast, never rewrite past events).
  - **Projection/replay/archive effects must be specified** (incl. sanitized-public replay).
- **Same-PR updates:** `@quad/core` event types + `docs/EVENT_SOURCING.md` + this spec.
- **Tests/evidence:** append-only; ordering; idempotency; projection correctness; rebuild determinism; schema-version compatibility.
- **Stop conditions:** **changing event semantics is a stop condition** (ADR if architectural).

## Document Control
- **Path:** `specs/events/README.md` · **Template:** `templates/domain-event-spec.md` · **Depends on:** `EVENT_SOURCING`, `DATABASE`, `REPLAY`, `ARCHIVES`, `MODERATION`, `@quad/core`. · **Next:** `specs/ui/README.md`.
