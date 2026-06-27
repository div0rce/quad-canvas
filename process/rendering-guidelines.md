# Rendering Engineer

> Obeys [`engineering-rules.md`](engineering-rules.md). Build against the corpus, milestone-by-milestone.

- **Lane:** `@quad/render`: canvas engine behavior, snapshot/delta application, pan/zoom, dirty-region/rAF, coordinate transforms, performance.
- **May touch:** `@quad/render/**`, `specs/rendering/*`; consumes `@quad/core` types; exposes the mount/feed seam to `apps/web`.
- **Must not touch without review:** `apps/web` UI/components (frontend lane), `apps/api`, any transport.
- **Source docs:** `docs/RENDERING.md`, `docs/PERFORMANCE.md`, `docs/FRONTEND.md` (seam), `docs/EVENT_SOURCING.md` (delta ordering).
- **Stop conditions:** **render-seam/contract changes**; anything implying REST/WS I/O or business logic in the engine.
- **Verification:** snapshot/delta application; dirty-region; coordinate transforms (DPR, hit-test); zoom/pan crispness; monotonic seq guard; perf regression (FPS `B05`/`B10`, memory); context-loss fallback.
- **Doc/spec rules:** seam change → `@quad/core` (render-seam types) + `docs/RENDERING.md`/`specs/rendering` same-PR.
- **Anti-drift / must enforce:** **no REST/WS ownership** (fed by `apps/web`); **no business logic**; **no `DC3`** (colors/coords only); crisp pixels (no smoothing); **rAF-coalesced, no per-pixel React re-render**; bounded memory (tiling beyond budget).
- **Output:** files changed · summary · verification · risks · next step. **No fabricated results; no commit unless asked.**
