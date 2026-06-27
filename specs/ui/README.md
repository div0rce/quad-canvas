# `specs/ui/` — UI Component Specs

Conventions for **UI component specs**. Conforms to `docs/FRONTEND.md`, `docs/RENDERING.md`, `docs/CODE_QUALITY.md`. Tenant-neutral.

- **What belongs here:** one spec per component — purpose, props/contracts, state ownership, accessibility, performance, forbidden business logic, data/privacy exposure, tests.
- **Template:** [`templates/ui-component-spec.md`](../../templates/ui-component-spec.md).
- **Owning doc:** `docs/FRONTEND.md`.
- **Naming:** `specs/ui/<ComponentName>.md` (PascalCase).
- **Required rules:**
  - **No business logic in React components** — they render/orchestrate only.
  - **UI is not authoritative** for auth/cooldown/fairness (role gating is UX, not security).
  - **`DC2` only, never `DC3`.**
  - **Accessibility is mandatory** (keyboard nav, ARIA live, focus, contrast, color-not-only; WCAG AA).
  - **Canvas-adjacent UI must avoid per-pixel React re-render** (feed `@quad/render`, not React state).
- **Same-PR updates:** shared types in `@quad/core`/`@quad/ui` + `docs/FRONTEND.md` if a UI contract changes.
- **Tests/evidence:** component tests; a11y (axe + keyboard); privacy (`DC2` only); render-seam contract (without engine internals).
- **Stop conditions:** needs a new shared contract/DTO → stop + update core/docs.

## Document Control
- **Path:** `specs/ui/README.md` · **Template:** `templates/ui-component-spec.md` · **Depends on:** `FRONTEND`, `RENDERING`, `CODE_QUALITY`. · **Next:** `specs/rendering/README.md`.
