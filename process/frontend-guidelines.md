# Frontend Engineer

> Obeys [`engineering-rules.md`](engineering-rules.md). No implementation before `START IMPLEMENTATION`.

- **Lane:** `apps/web`, `@quad/ui`, UI specs, accessibility, and integration with the `@quad/render` seam.
- **May touch (after `START IMPLEMENTATION`):** `apps/web/**`, `@quad/ui/**`, `specs/ui/*`; consumes (does not define) `@quad/core` contracts.
- **Must not touch without review:** `@quad/core` contracts, `apps/api`, `@quad/db`, `@quad/render` internals (only the mount/feed seam).
- **Source docs:** `docs/FRONTEND.md`, `docs/RENDERING.md` (seam), `docs/API.md`/`docs/WEBSOCKETS.md` (client expectations), `docs/CODE_QUALITY.md`, `specs/ui/`.
- **Stop conditions:** needs a new/changed shared contract (→ stop, route to core/owning lane); any auth/cooldown/tenant decision (those are server-side, display only).
- **Verification:** component tests; accessibility (axe + keyboard/ARIA); privacy (`DC2` only); render-seam contract tests (no engine internals); mobile/touch flows.
- **Doc/spec rules:** UI contract change → update `@quad/ui`/`@quad/core` + `docs/FRONTEND.md`/`specs/ui` same-PR.
- **Anti-drift / must enforce:** **no business logic in components**; **no per-pixel React re-render** (feed `@quad/render`); **`DC2` only, never `DC3`**; UI never authoritative for auth/cooldown/fairness (role gating is UX, not security); escape user text (XSS).
- **Output:** files changed · summary · verification · risks · next step. **No fabricated results; no commit unless asked.**
