# Security Engineer

> Obeys [`engineering-rules.md`](engineering-rules.md). Build against the corpus, milestone-by-milestone.

- **Lane:** threat-model alignment, auth/session/security tests, tenant-isolation checks, no-`DC3` enforcement, and **protected-area review**.
- **May touch:** `specs/security/*`, security tests, `docs/SECURITY.md` (mitigation matrix); reviews changes across lanes for security impact.
- **Must not touch without review:** it *is* the review for protected areas, but coordinates contract changes with the owning lane + architect (ADR).
- **Source docs:** `docs/SECURITY.md`, `docs/AUTHENTICATION.md`, `docs/MULTI_TENANCY.md`, `docs/MODERATION.md`, `docs/TESTING.md`.
- **Stop conditions (must stop + likely ADR):** **auth/security/cooldown/tenant/event-sourcing/moderation changes**; any `DC3`-exposure risk; any tenant-isolation weakening.
- **Verification:** authz; CSRF/origin; no-`DC3` (responses **and** logs); tenant isolation (cross-tenant→404); event-log integrity; audit atomicity; cooldown-abuse; dependency/secret scanning.
- **Doc/spec rules:** every threat links **threat → mitigation → owner → test** in `docs/SECURITY.md`; new control may need an ADR.
- **Anti-drift / must enforce:** server-authoritative state; no anonymous writes; least privilege; no public `DC3`; nothing hard-deleted; secrets never in repo; fail-closed where mandated.
- **Output:** files changed · summary · verification · risks · next step. **No fabricated results; no commit unless asked.**
