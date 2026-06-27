<!-- TEMPLATE: copy to specs/ui/<Component>.md. Reusable UI component spec. -->
# UI Component Spec — `<ComponentName>`

> Reminders: **no business logic in React components** (orchestrate only) · **`DC2` only, never `DC3`** · types from `@quad/core`/`@quad/ui` · **stop, don't guess** on contract changes. Conforms to `FRONTEND.md`.

- **Status:** `<draft|ready>` · **Owner lane:** Frontend · **Milestone:** `<M##>` · **Linked docs:** `FRONTEND.md`, `@quad/ui`

## 1. Component Purpose · Scope · Non-goals
`<what it renders>` / `<...>` / `<no business decisions; no direct API/WS ownership>`

## 2. Props / Contracts
`<prop names + types (from @quad/core where shared); events emitted>`

## 3. State Ownership
`<server-sourced (read-only) | local UI | derived; no authoritative state>`

## 4. Accessibility Requirements
`<keyboard nav, ARIA roles/live regions, focus management, contrast, color-not-only, reduced-motion; WCAG AA>`

## 5. Performance Expectations
`<render cost; no per-pixel re-render if canvas-adjacent; lazy-load if heavy; budget refs>`

## 6. Forbidden Business Logic
`<no validity/cooldown/authz decisions; gating is UX not security>`

## 7. Data / Privacy Exposure
`<DC2 only; no DC3; honor profile privacy>`

## 8. Dependencies / Impacts
- **Render seam:** `<mounts @quad/render? mount/feed only>` · **API/WS:** `<consumes via hooks>` · **Security:** `<escape user text (XSS)>`

## 9. Tests Required
`<component tests; a11y (axe + keyboard); privacy (DC2 only); render-seam contract (no internals)>`

## 10. Acceptance Criteria · 11. Regression Risks · 12. Stop Conditions
`<...>` / `<...>` / `<needs new contract/DTO → stop+update core/docs>`

## Document Control
- **Path:** `specs/ui/<Component>.md` · **Depends on:** `FRONTEND.md` · **Acceptance:** ☑ no business logic ☑ a11y defined ☑ DC2-only ☑ state ownership clear ☑ tests.
