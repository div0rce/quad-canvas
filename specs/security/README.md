# `specs/security/`: Security Specs

Conventions for **security specs**. Conforms to `docs/SECURITY.md`, `docs/AUTHENTICATION.md`, `docs/MULTI_TENANCY.md`, `docs/MODERATION.md`, `docs/TESTING.md`. Tenant-neutral.

- **What belongs here:** one spec per security-sensitive change or control, each linking **threat → mitigation → test** (the structure from `docs/SECURITY.md`). (No dedicated template; reuse `templates/test-plan-spec.md` for the test plan and `templates/feature-spec.md`/`templates/adr.md` as needed.)
- **Owning doc:** `docs/SECURITY.md` (threat model + mitigation matrix).
- **Naming:** `specs/security/<control-or-threat-slug>.md`.
- **Required rules:**
  - **Every spec links the threat (by surface/boundary `B*`), its mitigation, the owner, and the required tests.**
  - **No `DC3` leaks** (responses or logs); `DC2` only in public surfaces.
  - **Tenant isolation** verified (cross-tenant → `404`; no leakage).
  - **Auth/session/CSRF/origin/security tests** specified for affected paths.
- **Same-PR updates:** `docs/SECURITY.md` (mitigation matrix) + affected owning doc/spec; new control may need an ADR.
- **Tests/evidence:** authz, CSRF/origin, no-`DC3` (response + log), tenant isolation, event-log integrity, audit atomicity, cooldown-abuse, dependency/secret scanning.
- **Stop conditions:** **protected-area changes (auth/tenant/cooldown/event-sourcing/moderation/integrity) stop and likely require an ADR.**

## Document Control
- **Path:** `specs/security/README.md` · **Templates:** `test-plan-spec.md` (+ `feature-spec.md`/`adr.md`) · **Depends on:** `SECURITY`, `AUTHENTICATION`, `MULTI_TENANCY`, `MODERATION`, `TESTING`. · **Next:** `specs/moderation/README.md`.
