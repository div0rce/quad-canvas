# ADR-0001: Record Architecture Decisions

- **Status:** Accepted · **Date:** 2026-06 · **Deciders:** Architect, Engineering · **Linked docs:** `docs/ENGINEERING_WORKFLOW.md`, `docs/REVIEW_PROCESS.md`, `templates/adr.md`

## 1. Context
Quad is built milestone-by-milestone by engineering roles from a doc corpus. Architecture-significant decisions must be durable, discoverable, and reviewable, not buried in chat or implied by code.

## 2. Decision
Use **Architecture Decision Records (ADRs)** in `docs/adr/` for every architecture-significant decision, authored from `templates/adr.md`.
- **Status lifecycle:** `Proposed → Accepted → (Superseded by ADR-#### | Deprecated)`.
- **An ADR is required when** a decision changes a contract, a cross-cutting boundary/invariant, a technology baseline, or a security/fairness/tenancy/persistence guarantee, i.e., the stop-condition surfaces in `ENGINEERING_WORKFLOW.md` §8.
- **Same-PR rule:** an ADR lands with the affected docs/contracts updated in the same PR; the governed doc references its ADR.

## 3. Consequences
+ Decisions are explicit, versioned, and linkable; reviewers can verify against them. − Slight overhead per significant decision (intended friction).

## 4. Alternatives Considered
- **No ADRs (decisions in chat/code):** rejected, causes loss of architectural context.
- **One giant decisions doc:** rejected, poor diffability/reference.

## 5. Affected Docs / Contracts
`docs/ENGINEERING_WORKFLOW.md` (stop conditions/ADR triggers), `docs/REVIEW_PROCESS.md` (reject if contract change lacks ADR), `templates/adr.md`.

## 6. Migration / Rollout Notes
None, process-only; applies going forward.

## 7. Follow-Up Actions
ADRs `0002–0010` formalize the existing corpus decisions; future significant changes add new ADRs.

## Document Control
- **Path:** `docs/adr/0001-record-architecture-decisions.md` · **Acceptance:** ☑ status ☑ lifecycle + when-required ☑ same-PR rule ☑ alternatives ☑ links.
