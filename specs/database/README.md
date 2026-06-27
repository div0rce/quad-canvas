# `specs/database/`: Database & Migration Specs

Conventions for **schema/migration specs**. Conforms to `docs/DATABASE.md`, `docs/DEPLOYMENT.md`, `docs/DISASTER_RECOVERY.md`. Tenant-neutral.

- **What belongs here:** one spec per migration/schema change, objective, tables/indexes, expand/contract classification, backward compatibility, data-migration risk, backup/rollback/forward-fix, tenant-isolation checks, tests.
- **Template:** [`templates/database-migration-spec.md`](../../templates/database-migration-spec.md).
- **Owning doc:** `docs/DATABASE.md` (physical model).
- **Naming:** `specs/database/<NNNN>-<change-slug>.md` (ordered).
- **Required rules:**
  - **No schema change without a migration spec.**
  - **Classify expand/contract**: additive (expand) deploys before the app; contract only after the app stops using the old shape.
  - **Backup-first migrations**; **forward-fix** posture for data migrations.
  - **Tenant-isolation checks**: `tenant_id` present, tenant-scoped uniqueness.
  - **The event log is append-only**: no destructive migration on it.
- **Same-PR updates:** `docs/DATABASE.md` + this spec (+ `@quad/db` schema at implementation).
- **Tests/evidence:** migration up/down; expand/contract safety; tenant isolation; projection-rebuild if event/projection touched.
- **Stop conditions:** any data-loss/destructive-log risk → **stop + review**.
## Document Control
- **Path:** `specs/database/README.md` · **Template:** `templates/database-migration-spec.md` · **Depends on:** `DATABASE`, `DEPLOYMENT`, `DISASTER_RECOVERY`. · **Next:** `specs/events/README.md`.
