# Quad — MVP Acceptance Traceability (`LG-1`)

> Maps each MVP product acceptance criterion (`P-AC-1…P-AC-13`, defined in `PRODUCT.md`) to its
> implementation and the verification that proves it. This is the evidence for launch gate **`LG-1`**.
>
> **`LG-1` requires *all* `P-AC-1…13` to pass, so `LG-1` is NOT passed while any row is partial.** Status
> is reported **honestly**: ✅ met (implemented + verified), ◑ partial (core implemented + verified, with
> a named sub-capability still outstanding). The partials below are the precise blockers for `LG-1`.

| # | Criterion (abbrev.) | Status | Implementation / verification | If ◑: what remains |
|---|---|---|---|---|
| `P-AC-1` | Only a verified member can place; non-members cannot | ✅ | Verification front-door + principal-gated placement; **anon → 401** (integration) | — |
| `P-AC-2` | A placement updates all viewers in real time | ✅ | WS fan-out of `PixelPlaced`; "fan-out" WS integration test | — |
| `P-AC-3` | Cooldown identical for all tenant users **and always within 5–20 min** | ✅ | Global per-canvas cooldown; the production composition **clamps** the configured fixed value into 5–20 (`clampCooldownMs`, unit-tested), and the dynamic path is bounded by construction | — |
| `P-AC-4` | Cooldown moves with load **and changes gradually (no oscillation)** | ◑ | Load-responsive + clamped (`dynamicCooldownMs`, monotonic; integration) | The 60-s fixed window resets abruptly (can step/oscillate) — add smoothing (sliding window / EWMA) |
| `P-AC-5` | **Quick-look** handle+time, **full history on click**; email never shown | ◑ | Full ordered history on click (inspector, sanitized DC2; integration) | The separate lightweight **quick-look** (handle+time on hover/preview) is not built |
| `P-AC-6` | Profile shows term + lifetime stats and a heatmap | ✅ | Profile returns lifetime + current-term counts + a **per-day contribution histogram**; the page shows the stats + a **contribution heatmap** (`heatLevel` buckets, unit-tested) (integration) | — |
| `P-AC-7` | Leaderboards rank real attributable activity; resist gaming | ✅ | Rank by count; banned/handle-less omitted; allow-listed category/window (integration) | — |
| `P-AC-8` | Term-end freeze + archive (final image, stats, replay), browsable | ✅ | Freeze/archive; downloadable PNG final image; faithful replay; **term statistics** (`/archives/{term}/stats`: totals, participants, DC2 top placers) on the archive page; browsable (integration) | — |
| `P-AC-9` | Replay reproduces the sequence; play/pause/scrub/speed/jump | ✅ | `reconstructAt` (faithful; integration); player play/pause/scrub/jump + **0.5×–4× speed** (`frameInterval`, unit-tested) | — |
| `P-AC-10` | **Every** moderation action reversible, history intact, audited; no hard delete | ✅ | All actions reversible-by-design — content `rollback`, member `reinstate`, report **`reopen_report`** (→ back to open); all audited, append-only, no hard delete (integration) | — (a console "view resolved + reopen" view is a non-blocking UX follow-up) |
| `P-AC-11` | Mobile flows (**touch place, pinch-zoom, drag-pan**) + desktop | ◑ | Tap-to-place works on touch; desktop flows complete | Pinch-zoom + drag-pan gestures |
| `P-AC-12` | No Rutgers value hardcoded; tenant is configuration | ✅ | `@quad/config` registry; host→tenant resolution; no default tenant (tests; `CONSISTENCY_AUDIT.md`) | — |
| `P-AC-13` | One tenant's data never visible to another | ✅ | Tenant-id scoping on every path; "tenant isolation" integration — **CI-gated** (`LG-6`) | — |

## Summary

**10 of 13 fully met and verified** (`P-AC-1, 2, 3, 6, 7, 8, 9, 10, 12, 13`). **3 partial** — core
implemented + verified, with one named sub-capability outstanding each (cooldown smoothing, quick-look
preview, mobile pinch-zoom/drag-pan).

**`LG-1` is NOT yet passed** — it requires *all* `P-AC-1…13`. The eight partials above are its exact
remaining work; each is tracked as its own follow-up milestone.

---

**Related:** `PRODUCT.md` (criteria), `LAUNCH_PLAN.md` (`LG-1`), `CHECKPOINTS.md` §4 (gate status).
