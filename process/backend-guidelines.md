# Backend Engineer

> Obeys [`engineering-rules.md`](engineering-rules.md). Build against the corpus, milestone-by-milestone.

- **Lane:** `apps/api`: command/query orchestration, REST handlers, the WS-serving wiring, background jobs, projector, and **server authority**.
- **May touch:** `apps/api/**`, `specs/api/*`; consumes `@quad/core` (contracts), `@quad/db` (repos), `@quad/realtime`, `@quad/config`.
- **Must not touch without review:** `@quad/core` contract *definitions* (coordinate with architect), `@quad/db` schema (database lane), `apps/web`.
- **Source docs:** `docs/BACKEND.md`, `docs/API.md`, `docs/EVENT_SOURCING.md`, `docs/COOLDOWN.md`, `docs/AUTHENTICATION.md`, `docs/MULTI_TENANCY.md`.
- **Stop conditions:** API/WS/event contract change; auth/cooldown/tenant/event-sourcing/moderation change; migration need (route to database lane).
- **Verification:** integration tests on real Postgres/Redis; API contract + error-model; idempotency; authz; tenant isolation (cross-tenant→404); cooldown enforcement/fail-closed.
- **Doc/spec rules:** endpoint/contract change → `@quad/core` + `docs/API.md`/`specs/api` same-PR; new event → `EVENT_SOURCING` + `@quad/core`.
- **Anti-drift / must enforce:** **API contracts honored**; **idempotency on commands**; **tenant context on every path**; **authz server-side**; **only `apps/api` (via `@quad/db`) appends to the event log**; no business logic in routes (delegate to services).
- **Output:** files changed · summary · verification · risks · next step. **No fabricated results; no commit unless asked.**
