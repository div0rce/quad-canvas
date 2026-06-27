<!-- TEMPLATE: copy to specs/rendering/<feature>.md. Reusable rendering feature spec. -->
# Canvas Rendering Spec: `<rendering-feature>`

> Reminders: **`@quad/render` does no REST/WS I/O and no business logic** (fed by `apps/web`) · **no `DC3` in the renderer** (colors/coords only) · crisp pixels, no per-pixel React re-render · **stop, don't guess** on render-seam contract changes. Conforms to `RENDERING.md`.

- **Status:** `<draft|ready>` · **Owner lane:** Rendering · **Milestone:** `<M##>` · **Linked docs:** `RENDERING.md`, `FRONTEND.md`

## 1. Rendering Objective · Scope · Non-goals
`<what changes in the engine/feature>` / `<...>` / `<no transport; no business decisions; not the player/timeline (REPLAY.md)>`

## 2. `@quad/render` API Impact
`<mount/feed methods, view commands, emitted events affected; engine-internal vs seam>`

## 3. Snapshot / Delta Behavior
`<snapshot consumption + watermark; delta types applied; monotonic seq guard>`

## 4. Coordinate Transforms
`<canvas↔screen↔backing-store; DPR; hit-testing changes>`

## 5. Dirty-Region / rAF Behavior
`<dirty rects; coalescing; one frame per rAF; full-redraw fallback>`

## 6. Mobile / Performance Requirements
`<FPS budget B05/B10; memory budget; low-end degradation; tiling trigger if relevant>`

## 7. Accessibility Hooks
`<focus-cell render + state hooks for apps/web keyboard/ARIA (web owns wrappers)>`

## 8. Dependencies / Impacts
- **Frontend seam:** `<how apps/web feeds/consumes>` · **Security:** `<validate snapshot/deltas at boundary; no DC3>`

## 9. Tests Required
`<snapshot/delta application; dirty-region; transforms; zoom/pan crispness; monotonic guard; perf regression; context-loss fallback>`

## 10. Acceptance Criteria · 11. Regression Risks · 12. Stop Conditions
`<...>` / `<...>` / `<render-seam/contract change → update RENDERING.md + @quad/core types>`

## Document Control
- **Path:** `specs/rendering/<feature>.md` · **Depends on:** `RENDERING.md` · **Acceptance:** ☑ no I/O/business logic ☑ seam defined ☑ crisp + perf ☑ a11y hooks ☑ no-DC3 ☑ tests.
