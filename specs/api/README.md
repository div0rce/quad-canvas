# `specs/api/` — REST Endpoint Specs

Conventions for **REST endpoint specs**. Conforms to `docs/API.md`, `docs/BACKEND.md`, `docs/SECURITY.md`. Tenant-neutral.

- **What belongs here:** one spec per endpoint (or tightly-related group) — method/path, auth level, tenant context, request/response DTOs, error codes, idempotency, rate limits, security/privacy, tests.
- **Template:** [`templates/api-endpoint-spec.md`](../../templates/api-endpoint-spec.md).
- **Owning doc:** `docs/API.md` (the contract) + `docs/BACKEND.md` (handling).
- **Naming:** `specs/api/<method>-<path-slug>.md`.
- **Required rules:**
  - **Every endpoint must appear in `docs/API.md`** (no undocumented endpoints).
  - **Request/response DTOs live in `@quad/core`** (no duplicate/untyped DTOs).
  - **Endpoints are tenant-scoped**; cross-tenant access → `404`.
  - **State-changing endpoints define idempotency** (`Idempotency-Key`).
  - **`COOLDOWN_ACTIVE` and `RATE_LIMITED` stay distinct** (both `429`, different codes).
  - **No `DC3` in public/participant responses** (`DC2` only).
- **Same-PR updates:** `@quad/core` DTOs + `docs/API.md` + this spec, together.
- **Tests/evidence:** contract, route behavior, authz, tenant-isolation, idempotency, error-model, no-`DC3` (`docs/TESTING.md`).
- **Stop conditions:** any contract change → stop + (ADR if architectural). **No implementation before `START IMPLEMENTATION`.**

## Document Control
- **Path:** `specs/api/README.md` · **Template:** `templates/api-endpoint-spec.md` · **Depends on:** `API`, `BACKEND`, `SECURITY`, `@quad/core`. · **Next:** `specs/websockets/README.md`.
