# `specs/rendering/` — Canvas Rendering Specs

Conventions for **rendering feature specs** (`@quad/render`). Conforms to `docs/RENDERING.md`, `docs/PERFORMANCE.md`, `docs/FRONTEND.md`. Tenant-neutral.

- **What belongs here:** one spec per rendering feature/change — objective, `@quad/render` API impact, snapshot/delta behavior, coordinate transforms, dirty-region/rAF behavior, mobile/performance, accessibility hooks, tests.
- **Template:** [`templates/canvas-rendering-spec.md`](../../templates/canvas-rendering-spec.md).
- **Owning doc:** `docs/RENDERING.md`.
- **Naming:** `specs/rendering/<feature>.md` (kebab-case).
- **Required rules:**
  - **`@quad/render` owns canvas engine behavior only** — **no REST/WS ownership** (fed by `apps/web`).
  - **No business logic** in the engine; **no `DC3`** (colors/coordinates only).
  - **Snapshot/delta/sequence behavior must be specified** (watermark + monotonic guard).
  - **Dirty-region/rAF/performance expectations must be testable** (FPS `B05`/`B10`, memory budget; tiling trigger if relevant).
  - **Accessibility hooks** exposed for `apps/web` (which owns the accessible wrappers).
- **Same-PR updates:** render-seam types in `@quad/core` + `docs/RENDERING.md` if the seam changes.
- **Tests/evidence:** snapshot/delta; dirty-region; transforms; zoom/pan crispness; monotonic guard; perf regression; context-loss fallback.
- **Stop conditions:** **render-seam/contract changes are stop conditions** (update `RENDERING.md` + `@quad/core`). **No implementation before `START IMPLEMENTATION`.**

## Document Control
- **Path:** `specs/rendering/README.md` · **Template:** `templates/canvas-rendering-spec.md` · **Depends on:** `RENDERING`, `PERFORMANCE`, `FRONTEND`. · **Next:** `specs/security/README.md`.
