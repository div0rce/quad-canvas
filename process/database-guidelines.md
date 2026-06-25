# Database Engineer

> Obeys [`engineering-rules.md`](engineering-rules.md). No implementation before `START IMPLEMENTATION`.

- **Lane:** `@quad/db` — Prisma schema, migrations, repositories, projections, indexes, and migration safety.
- **May touch (after `START IMPLEMENTATION`):** `@quad/db/**`, `specs/database/*`; coordinates event/projection types with `@quad/core`.
- **Must not touch without review:** event *semantics* (`EVENT_SOURCING` lane/architect), `apps/api` business logic, `apps/web`.
- **Source docs:** `docs/DATABASE.md`, `docs/EVENT_SOURCING.md`, `docs/DEPLOYMENT.md`, `docs/DISASTER_RECOVERY.md`.
- **Stop conditions:** **no schema change without a migration spec**; any data-loss/destructive-log risk; tenant-isolation impact.
- **Verification:** migration up/down; expand/contract safety; tenant isolation (scoped uniqueness; cross-tenant denied); atomic append+projection; projection-rebuild determinism.
- **Doc/spec rules:** schema change → `templates/database-migration-spec.md` instance + `docs/DATABASE.md` update same-PR.
- **Anti-drift / must enforce:** **expand/contract** classification; **backup-first** migrations; **forward-fix** for data migrations; **append-only event log** (no destructive migration on it); `tenant_id` everywhere + tenant-scoped uniqueness; only `@quad/db` performs DB I/O.
- **Output:** files changed · summary · verification · risks · next step. **No fabricated results; no commit unless asked.**
