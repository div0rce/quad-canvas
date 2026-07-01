# UI Component Spec: `Design system (tokens + primitives)`

> Reminders: **no business logic in React components** (orchestrate only) · **`DC2` only, never `DC3`** · types from `@quad/core`/`@quad/ui` · **stop, don't guess** on contract changes. Conforms to `FRONTEND.md`.

- **Status:** `ready` · **Owner lane:** Frontend · **Linked docs:** `FRONTEND.md`, `RENDERING.md`, `CODE_QUALITY.md`

## 1. Component Purpose · Scope · Non-goals

The **visual language** the web app is skinned in: a "paper + ink" retro-pixel system — a warm paper field, hard near-black borders, flat offset shadows (no blur), two display faces, and one tenant-derived accent. It is realized as a **token layer + a set of presentational primitives** that every screen composes from, so no screen re-invents colours, type, borders, or shadows.

**Scope:** the design tokens, the type scale, and the reusable `.quad-*` primitive classes + the thin React wrappers (`AppBar`, `PixelLogo`) that consume them. **Non-goals:** no business decisions, no data fetching, no direct API/WS ownership — these are pure presentation.

**Where it lives (resolution of `FRONTEND.md` §19 "design-system tokens"):**

- **Tokens + `.quad-*` primitive classes:** `apps/web/src/app/globals.css` (`:root` for the neutral, tenant-independent scale; `body` for the accent derivation).
- **React primitives:** `apps/web/src/components/ui/` (`app-bar.tsx`, `pixel-logo.tsx`); the user chip is `auth/session-badge.tsx`.
- **Promotion to `@quad/ui` is deferred.** `@quad/ui` is currently an empty skeleton with no consumers; the tokens/primitives stay **app-local** until a dedicated change first extracts shared components across apps. Keeping them app-local avoids cross-package `transpilePackages` plumbing the visual layer does not yet need (`CODE_QUALITY` no-scope-creep).

## 2. Props / Contracts

**Tokens (CSS custom properties).**

- Surfaces: `--paper` `#f2f1ec`, `--surface` `#fff`, `--canvas-well` `#f4f4f4`.
- Ink + muted scale: `--ink` `#141414`, `--ink-strong`, `--ink-soft`, `--muted`, `--muted-label`, `--muted-tag`, `--muted-faint`, `--muted-fainter`, `--muted-on-disabled`, `--disabled-bg`.
- Hairlines/rails: `--hairline`, `--hairline-2`, `--rail`.
- Fixed semantic/status colours (NOT tenant-derived): `--live-green`, `--live-red`, `--status-blue`, `--status-sky`, `--status-orange`, `--pumpkin`, `--silver`, `--bronze`.
- Structure: `--border-structural` (3px), `--border-component` (2px); flat shadows `--shadow-board/lg/card/md/sm/xs` (e.g. `7px 7px 0 var(--ink)`).
- Type: `--font-pixel` (Press Start 2P) and `--font-mono` (VT323), wired via `next/font/google` in `layout.tsx`; `body` uses `--font-mono`, the `.quad-pixel` class uses `--font-pixel` for titles/numbers/wordmark.

**Tenant accent (the one config-driven token group).** The server injects `--tenant-primary` on `<body>` (from `PublicTenant.themePrimary`; neutral `FALLBACK_PRIMARY` for unknown hosts). The accent is derived from it **in CSS**, declared on `body` so it tracks the injected value:

- `--qa` = `var(--tenant-primary, var(--ink))`
- `--qa-strong` = `color-mix(in srgb, var(--qa) 78%, #000)`
- `--qa-tint` = `color-mix(in srgb, var(--qa) 18%, #fff)`
- `--qa-tint2` = `color-mix(in srgb, var(--qa) 7%, #fff)`

No campus colour is ever hardcoded (`FE-INV-6`, `PRIN-CONFIG-OVER-CODE`). The 32-colour **canvas palette** is separate tenant config in `@quad/config` (`P-CANVAS-4`) — it is data, never CSS custom properties.

**App shell — full-bleed.** Every screen is a full-bleed app screen, not a boxed card: `.quad-page` is a full-viewport flex column and `.quad-surface` is a transparent, borderless frame so the **app bar spans edge to edge** and content sits on the paper field below it. The design-board caption `.quad-board-label` is a design-tool artifact and is **not rendered in the app** (`display:none`); the app bar plus each screen's own heading carry context. The **live canvas** is its own full-viewport shell (`.quad-canvas-page` → `.quad-canvas-body` grid → `.quad-canvas-col` + rail + footer); the stage **fills its column** (`.quad-canvas-stage` is `100% × 100%`), collapsing to a stacked, scrollable layout under the mobile breakpoint.

**Primitive classes (presentation only).** `.quad-page` (full-bleed screen), `.quad-surface` (full-bleed frame), `.quad-panel` (paper texture), `.quad-card` (+`--sm/--card/--lg/--flat`), `.quad-btn` (+`--primary/--lg`, native `:disabled`), `.quad-pill` (+`--accent/--paper/--flush`), `.quad-badge`, `.quad-dot` + `.quad-blink`, `.quad-swatch` (+`--selected`), `.quad-eyebrow`, `.quad-stat-label`/`.quad-stat-value`, `.quad-segmented`, `.quad-nav`/`.quad-navlink` (+`--active`), `.quad-chip`/`.quad-avatar`, `.quad-hud` (+`--ink`)/`.quad-hud-btn`, `.quad-tooltip`, `.quad-marquee`, `.quad-canvas` (`image-rendering: pixelated`), plus the live-canvas layout (`.quad-canvas-page/-main/-body/-col/-rail/-footer`).

**Interaction.** Clickable primitives are tactile: `.quad-btn`/`.quad-hud-btn`/`.quad-swatch` lift on `:hover` and press toward their shadow on `:active` (primary buttons darken to `--qa-strong` on hover); nav links darken on hover; all via short transitions on transform/shadow/colour, disabled controls excluded.

**React wrappers.** `AppBar({ variant?: 'light'|'dark', tenantLabel?, nav?: {label,href,active?}[], right?: ReactNode, logoSize? })` — the mark + wordmark link to `/` (home); `PixelLogo({ size? })`; `SessionBadge` renders the user chip (signed in) or a sign-in button.

## 3. State Ownership

No authoritative state. Tokens are static; the accent is a derived reflection of server-injected tenant config; primitives are stateless presentation. Screens own their own local UI state as before.

## 4. Accessibility Requirements

- Primitives carry no a11y *logic*; each screen keeps its `role`/`aria-*`/labels. Interactive primitives reuse native elements (`<button>`, `<a>`, `<input>`) so focus/keyboard work by default; the segmented toggle marks the active option with `aria-pressed`.
- **Colour is never the only signal:** status uses dot + text, the active nav adds an underline, the active toggle changes fill *and* is `aria-pressed`.
- The blinking dot/marquee animations are decorative and short; reduced-motion handling is a screen-level concern (`FRONTEND.md` §10).
- Contrast: ink-on-paper and white-on-accent meet AA for the chrome; tenants supplying a low-contrast `--tenant-primary` is a config concern (`MULTI_TENANCY.md`).

## 5. Performance Expectations

Plain global CSS + inline style objects (no Tailwind/CSS-in-JS/CSS Modules added — matches the existing tree). Fonts are self-hosted at build time via `next/font` (no render-blocking third-party request, no layout shift). `.quad-canvas` preserves `image-rendering: pixelated` (`RENDER-INV-6`); no global `image-rendering` override ships.

## 6. Forbidden Business Logic

None present — tokens/primitives make no validity, cooldown, authority, or membership decisions; role-gated chrome (e.g. the dark moderation bar) is UX, not security (`FE-INV-10`).

## 7. Data / Privacy Exposure

`DC2` only (handles/display names) where primitives surface identity (the user chip, avatars). No `DC3`. **Data-honesty rule:** where the source design shows information with no backing field or endpoint, screens **omit it rather than fabricate** — those gaps are recorded per screen (see the screen specs / `FRONTEND.md` §4 data sources), not invented in the UI.

## 8. Dependencies / Impacts

- **Render seam:** none directly; `.quad-canvas` is the class the canvas surfaces wear.
- **Config:** consumes `--tenant-primary` from the layout's tenant resolution and the palette from `@quad/config`.
- **Security:** primitives render only escaped React children; no `dangerouslySetInnerHTML`.

## 9. Tests Required

Token/primitive presence is exercised indirectly by component + a11y tests of the screens that use them (`TESTING.md`); the visual layer adds no new logic to unit-test. Build + typecheck gate the token/font wiring.

## 10. Acceptance Criteria · 11. Regression Risks · 12. Stop Conditions

- **Acceptance:** screens compose from these primitives; the accent tracks `--tenant-primary` (no hardcoded campus colour); fonts load build-time; pixel crispness preserved.
- **Regression risks:** aliasing the accent on `:root` instead of `body` would pin it to the fallback; a global `image-rendering` reset would blur the canvas. Both are guarded against here.
- **Stop conditions:** a primitive that needs to be shared across apps → stop and promote to `@quad/ui` (update `FRONTEND.md` + this spec); a screen needing a tenant fact not in `PublicTenant` (e.g. accepted email domains) → stop and extend `@quad/config`, do not hardcode.

## Document Control
- **Path:** `specs/ui/DesignSystem.md` · **Depends on:** `FRONTEND.md`, `RENDERING.md`, `CODE_QUALITY.md` · **Acceptance:** ☑ no business logic ☑ a11y defined ☑ DC2-only ☑ state ownership clear ☑ tokens/primitives + accent derivation documented ☑ `@quad/ui` promotion deferral recorded.
