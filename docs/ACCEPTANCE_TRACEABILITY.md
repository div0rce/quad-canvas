# Quad: MVP Acceptance Traceability (`LG-1`)

> Maps each MVP product acceptance criterion (`P-AC-1…P-AC-13`, defined in `PRODUCT.md`) to its
> implementation and the verification that proves it. This is the evidence for launch gate **`LG-1`**.
>
> **`LG-1` requires *all* `P-AC-1…13` to pass.** Every row below is **✅ met** (implemented + verified),
> so **`LG-1` is MET**. Status is reported honestly against that bar: ✅ met, or ◑ partial (core verified
> with a named sub-capability still outstanding) if any remained.

| # | Criterion (abbrev.) | Status | Implementation / verification | If ◑: what remains |
|---|---|---|---|---|
| `P-AC-1` | Only a verified member can place; non-members cannot | ✅ | Verification front-door + principal-gated placement; **anon → 401** (integration) | — |
| `P-AC-2` | A placement updates all viewers in real time | ✅ | WS fan-out of `PixelPlaced`; "fan-out" WS integration test | — |
| `P-AC-3` | Cooldown identical for all tenant users **and always within 5–20 min** | ✅ | Global per-canvas cooldown; the production composition **clamps** the configured fixed value into 5–20 (`clampCooldownMs`, unit-tested), and the dynamic path is bounded by construction | — |
| `P-AC-4` | Cooldown moves with load and changes gradually (no oscillation) | ✅ | Load-responsive + clamped (`dynamicCooldownMs`); the rate counter is a **2-bucket sliding window** that decays the load gradually across window boundaries (no abrupt reset → no oscillation), unit-tested | — |
| `P-AC-5` | Quick-look handle+time, full history on click; email never shown | ✅ | **Hover quick-look** (the cell's current handle · time, debounced, DC2; touch users get the same via tap→inspector) + full ordered history on click (inspector, sanitized); email never shown (`quickLookLabel` unit-tested) | — |
| `P-AC-6` | Profile shows term + lifetime stats and a heatmap | ✅ | Profile returns lifetime + current-term counts + a **per-day contribution histogram**; the page shows the stats + a **contribution heatmap** (`heatLevel` buckets, unit-tested) (integration) | — |
| `P-AC-7` | Leaderboards rank real attributable activity; resist gaming | ✅ | Rank by count; banned/handle-less omitted; allow-listed category/window (integration) | — |
| `P-AC-8` | Term-end freeze + archive (final image, stats, replay), browsable | ✅ | Freeze/archive; downloadable PNG final image; faithful replay; **term statistics** (`/archives/{term}/stats`: totals, participants, DC2 top placers) on the archive page; browsable (integration) | — |
| `P-AC-9` | Replay reproduces the sequence; play/pause/scrub/speed/jump | ✅ | `reconstructAt` (faithful; integration); player play/pause/scrub/jump + **0.5×–4× speed** (`frameInterval`, unit-tested) | — |
| `P-AC-10` | **Every** moderation action reversible, history intact, audited; no hard delete | ✅ | All actions reversible-by-design — content `rollback`, member `reinstate`, report **`reopen_report`** (→ back to open); all audited, append-only, no hard delete (integration) | — (a console "view resolved + reopen" view is a non-blocking UX follow-up) |
| `P-AC-11` | Mobile flows (touch place, pinch-zoom, drag-pan) + desktop | ✅ | Pointer-event gestures: one-pointer **drag-pan**, two-pointer **pinch-zoom**, wheel-zoom (zoom-to-cursor via `zoomAt`; `pinchScale`/`clampPan` unit-tested; pan only past a tap dead-zone; multi-pointer never taps); select on **pointer-up** so tap-to-place survives pointer capture. **Browser e2e** (`scripts/e2e-canvas.mjs`, Playwright/chromium vs the edge stack) passes: tap-to-select, wheel-zoom, drag-pan, select-after-gestures (deselect → re-tap), and a **two-finger pinch via real touch** (CDP — scale 1 → ~7.5) all confirmed | — |
| `P-AC-12` | No Rutgers value hardcoded; tenant is configuration | ✅ | `@quad/config` registry; host→tenant resolution; no default tenant (tests; `CONSISTENCY_AUDIT.md`) | — |
| `P-AC-13` | One tenant's data never visible to another | ✅ | Tenant-id scoping on every path; "tenant isolation" integration — **CI-gated** (`LG-6`) | — |

## Summary

**All 13 acceptance criteria are met and verified** (`P-AC-1…13`). The pure logic is unit-tested, the
DB-backed behaviour is integration-tested, and the canvas interaction (tap-to-place, pan, zoom) is
exercised by a **browser e2e** (`scripts/e2e-canvas.mjs`, Playwright/chromium against the full edge
stack) that passes, which also closes the deferred **M19** browser end-to-end milestone.

**`LG-1` (all MVP acceptance criteria pass) is MET**, every `P-AC-1…13` is implemented and verified.
What remains for full launch readiness lives outside the acceptance set: `LG-9` (legal/ToS/university
approval) and the live deployment itself.

---

**Related:** `PRODUCT.md` (criteria), `LAUNCH_PLAN.md` (`LG-1`), `CHECKPOINTS.md` §4 (gate status).
