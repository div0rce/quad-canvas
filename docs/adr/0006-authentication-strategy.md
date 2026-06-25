# ADR-0006 — Authentication Strategy

- **Status:** Accepted · **Date:** 2026-06 · **Deciders:** Architect, Security, Backend · **Linked docs:** `docs/AUTHENTICATION.md`, `docs/SECURITY.md`, `docs/MULTI_TENANCY.md`, `docs/TECH_BASELINE.md`

## 1. Context
Quad requires verified university membership, no anonymous writes, and no custom passwords — across a Next.js client and a Fastify backend that is authoritative for REST **and** WebSockets.

## 2. Decision
**Auth.js `@auth/core` integrated in `apps/api`; email-verification for MVP; server-side revocable sessions; campus SSO/CAS later.**
- **No custom passwords** (email magic-link MVP → SSO).
- Eligibility = email domain ∈ the **resolved tenant's configured allowlist** (`@quad/config`); **session bound to one tenant**.
- **Opaque session token in an httpOnly + Secure + SameSite, host-only-per-tenant cookie**; session state server-side (revocable).
- **WS handshake auth via the session cookie + origin checks** (solves the browser no-custom-WS-header limitation).
- **Revoke on ban/suspension** (immediate).

## 3. Consequences
+ One auth authority = the tier that enforces everything; REST + WS validate one session; instant revocation. − More wiring (no off-the-shelf `@auth/fastify`); cookie auth requires CSRF care.

## 4. Alternatives Considered
- **Custom password auth:** rejected — forbidden; weaker security.
- **Frontend-only (Next.js) auth:** rejected — web becomes issuer; api must trust web tokens; WS still needs its own validation.
- **Anonymous writes:** rejected — violates `PRIN-IDENTITY`.

## 5. Affected Docs / Contracts
`AUTHENTICATION.md` (`AUTH-INV-*`), `SECURITY.md` (§7), `MULTI_TENANCY.md` (cookie scoping), `WEBSOCKETS.md` (handshake), `@quad/core` (session/identity types).

## 6. Migration / Rollout Notes
Auth lands in milestones M20–M23; SSO is post-MVP and additive (link existing users on first SSO login) — no canvas/event migration.

## 7. Follow-Up Actions
**Unresolved (deferred):** exact **CSRF scheme** (SameSite + token/double-submit) and **session-storage** specifics (Redis-backed vs short-JWT+revocation list); cookie-vs-first-message-token if subdomain cookie scoping is constrained → finalize in implementation + `SECURITY.md`. Public-handle policy → `PROFILES.md` (`P-Q-1`).

## Document Control
- **Path:** `docs/adr/0006-authentication-strategy.md` · **Acceptance:** ☑ `@auth/core` in api ☑ email MVP/no passwords ☑ revocable tenant-scoped sessions ☑ cookie+origin WS auth ☑ revoke-on-ban ☑ CSRF/session deferred items routed ☑ alternatives.
