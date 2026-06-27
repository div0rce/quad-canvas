# `specs/features/`: Feature Specs

Conventions for **product/application feature specs**. Conforms to `docs/PRODUCT.md`, `docs/PRINCIPLES.md`, `docs/NON_GOALS.md`, `docs/MILESTONES.md`. Tenant-neutral (Rutgers Quad = tenant #1 example).

- **What belongs here:** one spec per feature, linking product requirements (`P-*`/`PRIN-*`/`NG-*`), user stories, affected `apps/*` + `@quad/*` packages, acceptance criteria, and required tests. Each must identify **data-model / API / WS / security / performance / accessibility** impacts.
- **Template:** [`templates/feature-spec.md`](../../templates/feature-spec.md).
- **Owning doc:** `docs/PRODUCT.md` (product truth) + `docs/MILESTONES.md` (sequence).
- **Naming:** `specs/features/<feature-name>.md` (kebab-case, stable).
- **When required:** any user-facing feature before its milestone is implemented.
- **Same-PR updates:** any contract touched updates `@quad/core` + the owning doc/spec; new behavior updates docs (`PROC-INV-2`).
- **Tests/evidence:** acceptance criteria map to tests (`docs/TESTING.md` matrix); commands + results required.
- **Stop conditions:** **product ambiguity is a stop condition**: clarify before building; never invent requirements; check `NON_GOALS.md` anti-backdoor rules.

## Document Control
- **Path:** `specs/features/README.md` · **Template:** `templates/feature-spec.md` · **Depends on:** `PRODUCT`, `PRINCIPLES`, `NON_GOALS`, `MILESTONES`. · **Next:** `specs/api/README.md`.
