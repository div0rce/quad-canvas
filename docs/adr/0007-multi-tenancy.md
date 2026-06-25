# ADR-0007 — Multi-Tenancy

- **Status:** Accepted · **Date:** 2026-06 · **Deciders:** Architect · **Linked docs:** `docs/MULTI_TENANCY.md`, `docs/DATABASE.md`, `docs/AUTHENTICATION.md`, `docs/SECURITY.md`

## 1. Context
Quad is a platform of independent campus experiments; Rutgers is the first, not a special case (`P-VISION-5`). Onboarding the next university must be configuration, not a rewrite.

## 2. Decision
**Tenant-neutral platform with host/subdomain tenant resolution, no default tenant, and config-driven onboarding.**
- **Rutgers Quad is tenant #1 — config only**; no tenant literals in platform logic.
- **Unknown host → no tenant context** (platform landing/reject); **cross-tenant reads return `404`** (no existence leak).
- **Host-only-per-tenant cookies**; **tenant-scoped data + uniqueness** (`tenant_id` everywhere; uniqueness never spans tenants).
- **Operator-only cross-tenant actions, audited** (`B5`).
- `@quad/config` is the source of tenant settings; Postgres holds the relational tenant record.

## 3. Consequences
+ Adding a tenant = config + data; structural isolation; "Rutgers = tenant #1" is true. − Requires tenant context on every path + onboarding discipline.

## 4. Alternatives Considered
- **Hardcoded Rutgers:** rejected — turns the platform single-tenant.
- **Default-tenant fallback:** rejected — hides misrouting; a hardcoding back-door.
- **Separate codebase per school:** rejected — unmaintainable; defeats the platform thesis.

## 5. Affected Docs / Contracts
`MULTI_TENANCY.md` (`TENANT-INV-*`), `DATABASE.md` (tenant scoping), `AUTHENTICATION.md` (tenant-bound sessions/cookies), `SECURITY.md` (isolation threats), `@quad/config`.

## 6. Migration / Rollout Notes
Tenant resolution lands in M10; isolation enforcement + tests in M24; onboarding flow per `MULTI_TENANCY.md` §14.

## 7. Follow-Up Actions
**Deferred:** RLS adoption for DB-layer isolation hardening (`SECURITY.md`/implementation); config↔DB sync/drift handling (`OPERATIONS.md`); custom-domain provisioning + TLS (`ADR-0010`/`DEPLOYMENT.md`); term-cadence generalization (`P-Q-4`).

## Document Control
- **Path:** `docs/adr/0007-multi-tenancy.md` · **Acceptance:** ☑ tenant-neutral/config-driven ☑ host resolution + no default ☑ cross-tenant→404 ☑ host-only cookies ☑ tenant-scoped data ☑ operator-only cross-tenant ☑ RLS deferred ☑ alternatives.
