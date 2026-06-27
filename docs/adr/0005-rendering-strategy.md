# ADR-0005: Rendering Strategy

- **Status:** Accepted · **Date:** 2026-06 · **Deciders:** Architect, Rendering · **Linked docs:** `docs/RENDERING.md`, `docs/FRONTEND.md`, `docs/PERFORMANCE.md`

## 1. Context
The canvas must paint fast, pan/zoom smoothly with crisp pixels, and stay performant on mobile (`PRIN-MOBILE-FIRST`, `P-CANVAS-8`), without coupling rendering to transport or business logic.

## 2. Decision
**A dedicated, isolated `@quad/render` engine; 2D Canvas baseline with a 1px-per-cell offscreen buffer; dirty-region + `requestAnimationFrame` coalescing; WebGL/tiling deferred until performance evidence warrants.**
- The engine does **no REST/WS I/O and no business logic**; it is **fed** snapshot + deltas + view commands by `apps/web` and emits interaction events.
- `apps/web` owns UI **and accessibility wrappers**; the engine exposes focus-cell/state hooks.
- **Crisp pixels** (no smoothing); DPR-aware; deep-zoom culling.
- Decoupled from React (**no per-pixel re-render**).

## 3. Consequences
+ Cheap single-blit frames; high-activity coalescing; engine reusable for live + replay. − A future WebGL/tiling path is needed for very large canvases / weak devices.

## 4. Alternatives Considered
- **React per-pixel DOM:** rejected, catastrophic performance.
- **Renderer owning transport:** rejected, breaks separation; couples engine to REST/WS.
- **Immediate WebGL-only:** rejected, premature complexity; 2D meets MVP budgets.

## 5. Affected Docs / Contracts
`RENDERING.md` (`RENDER-INV-*`), `FRONTEND.md` (seam), `PERFORMANCE.md` (FPS/memory budgets), `@quad/core` (render-seam types).

## 6. Migration / Rollout Notes
Engine MVP lands in milestone M16; seam consumed by M17.

## 7. Follow-Up Actions
**WebGL/tiling upgrade trigger** = sustained sub-budget FPS or canvas size exceeding the memory cap, to be decided against `PERFORMANCE.md` evidence; snapshot encoding shape → `API.md`/implementation.

## Document Control
- **Path:** `docs/adr/0005-rendering-strategy.md` · **Acceptance:** ☑ isolated engine ☑ no I/O/business logic ☑ 2D baseline + dirty-region/rAF ☑ crisp/mobile ☑ WebGL/tiling deferred ☑ alternatives.
