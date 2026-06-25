# Quad — Product Principles

> **These are the non-negotiable laws of the product.** Every feature, spec, milestone, design, and line of code must conform. A principle is not a preference to be traded away for convenience or growth — it is a constraint the product is defined by. When a proposed feature conflicts with a principle, **the feature changes or dies, not the principle.**
>
> Principles are *product law*; they sit above [`PRODUCT.md`](PRODUCT.md) (which says what to build) and govern [`NON_GOALS.md`](NON_GOALS.md) (what we refuse to build). Architecture docs implement these; they do not get to reinterpret them.
>
> **Naming:** the platform is **Quad**; **Rutgers Quad** is tenant #1. "The university"/"the tenant" means any tenant. Each law has a stable ID (`PRIN-*`) for specs/reviews to cite.

---

## Precedence

When two principles tension against each other, resolve in this order:

**`PRIN-FAIRNESS` → `PRIN-IDENTITY` → `PRIN-PERMANENCE` → `PRIN-ISOLATION` → everything else.**

**Fairness wins every tie.** If making something faster, prettier, more engaging, or more profitable would make it less fair, fairness wins. This is the soul of the product (`P-VISION-1`).

---

## The Laws

### `PRIN-FAIRNESS` — Fairness above everything

**Law.** Every participant has identical power over the canvas at all times. No money, status, seniority, social connection, activity level, or administrative favor grants more influence than any other verified student has.

**Why.** Quad's entire premise is a level playing field where a campus collectively decides what the canvas becomes (`P-VISION-1`). The moment influence can be bought or granted, the artwork stops being the community's and the experiment is dead.

**Requires.** Identical cooldown for everyone in a tenant at any instant (`P-COOL-1`, `P-COOL-6`); equal placement rights on every cell/color/region (`P-CANVAS-6`); leaderboards and profiles that reward only real, attributable effort (`P-LEAD-4`).

**Forbids.** Any mechanism — paid, earned, or assigned — that shortens a cooldown, grants extra/priority placements, reserves regions, or weights one account's pixel over another's.

---

### `PRIN-EQUAL-POWER` — One account, one pixel, one cooldown

**Law.** A participant is exactly one verified human with one account, who places one pixel per action and waits the one global cooldown.

**Why.** Equal power is meaningless if a person can multiply themselves or batch placements. This law operationalizes fairness at the unit level.

**Requires.** One account per real student (`P-ABUSE-1`); a single pixel per placement (`P-CANVAS-3`); the global, bounded cooldown as the universal throttle (`P-COOL-1`…`P-COOL-7`).

**Forbids.** Multi-accounting as a feature, bulk/scripted placement, "place N pixels at once," or per-user cooldown personalization.

---

### `PRIN-IDENTITY` — Identity and accountability, never anonymity

**Law.** Participation requires verified membership of the tenant university, and every pixel is permanently attributable to the account that placed it.

**Why.** A safe, accountable community of real classmates — not anonymous internet actors — is what makes the canvas trustworthy and moderatable (`P-VISION-4`). Accountability is also the foundation that lets moderation be precise and reversible.

**Requires.** Verified-membership gating (`P-JOURNEY-1`, `P-TENANT-2`); attribution on every cell (`P-ATTR-1`); traceability of every placement (`P-ABUSE-5`).

**Forbids.** Anonymous or guest placement; unattributable pixels; participation by non-members.

**Bounded by privacy.** Accountability is internal-first: identities are attributable to moderators/admins and shown publicly only as a tenant-defined **public handle** — **never the full email** (`P-ATTR-3`, `P-ATTR-4`). Accountability does not mean public exposure of sensitive identifiers.

---

### `PRIN-PERMANENCE` — Preserve every action forever

**Law.** Every placement and every consequential action is preserved permanently. History is appended, never silently overwritten or destroyed.

**Why.** The product's lasting value is a faithful, permanent record of a campus's term — the per-pixel story, the replay, the archive (`P-VISION-3`). If history can vanish, the artifact is untrustworthy.

**Requires.** Full per-pixel history (`P-ATTR-5`), faithful replays (`P-REPLAY-3`), permanent archives (`P-ARCH-1`), and term canvases that are never deleted (`P-LIFE-7`).

**Forbids.** Hard deletion of history, rewriting past events, or any "cleanup" that loses the record. (See `PRIN-NO-INVISIBLE-LOSS` for how moderation coexists with this.)

---

### `PRIN-ISOLATION` — Each tenant is self-contained

**Law.** Every university's accounts, pixels, canvases, leaderboards, profiles, reports, archives, and configuration are fully isolated. No participant acts in, and no data leaks across, another tenant.

**Why.** Quad is a platform of independent campus experiments, not one shared internet canvas. Isolation protects each community's integrity, safety, and privacy, and is what makes "Rutgers is just tenant #1" true (`P-VISION-5`, `P-TENANT-7`).

**Requires.** Tenant-scoped membership, data, boards, and archives (`P-TENANT-3`…`P-TENANT-7`, `P-AC-13`); no cross-tenant participation (`P-TENANT-4`).

**Forbids.** Cross-tenant placement; global cross-university leaderboards/data in a way that breaks isolation; any default that mixes tenant data.

---

### `PRIN-CONFIG-OVER-CODE` — Multi-tenant by configuration, never by hardcoding

**Law.** Tenant-specific facts (name, branding, domains, palette, dimensions, term schedule, cooldown bounds, moderators) live in configuration. Platform behavior contains no tenant-specific assumptions.

**Why.** Onboarding the next university must be a configuration change, not a rewrite (`P-VISION-5`, `P-ADMIN-8`). Hardcoding Rutgers anywhere quietly turns the platform into a single-tenant app.

**Requires.** All Rutgers facts expressed as tenant #1 config (`P-TENANT-5`); adding a tenant via config (`P-ADMIN-8`); verified by `CONSISTENCY_AUDIT.md` (`P-AC-12`).

**Forbids.** "Rutgers" (or any tenant) embedded in platform logic, UI strings, defaults, or branching.

---

### `PRIN-MOBILE-FIRST` — Designed for phones first

**Law.** Every participant-facing experience is designed and validated for mobile touch use first, then enhanced for desktop.

**Why.** Most students will use Quad on a phone; a desktop-first product that's "also okay on mobile" fails the majority (`P-USER-1`).

**Requires.** Touch placement, pinch-zoom, drag-pan, responsive layout as first-class (`P-CANVAS-8`, `P-AC-11`).

**Forbids.** Core flows that only work well with a mouse/keyboard; mobile treated as a degraded afterthought.

---

### `PRIN-ALIVE` — Always alive and instantaneous

**Law.** The canvas reflects the community in real time; interaction feels immediate.

**Why.** The magic is watching a living, shared space change as classmates act (`P-VISION-2`). Lag or staleness breaks the sense of a collective moment.

**Requires.** Real-time propagation of placements (`P-CANVAS-7`, `P-AC-2`) and an immediate-feeling placement experience within the platform's latency budget (defined in `PERFORMANCE.md`, not here).

**Forbids.** Polling-driven staleness or interactions that feel sluggish on supported devices. (Performance *numbers* are an engineering budget; the *principle* is the felt experience.)

---

### `PRIN-NO-PAY-TO-WIN` — No monetized or earned advantage

**Law.** Nothing a person can buy, earn, or be granted changes their power over the canvas.

**Why.** A direct corollary of fairness; called out as its own law because monetization pressure is the most likely future attempt to erode fairness.

**Requires.** Any future monetization (if ever) must be strictly non-influencing (e.g., the product takes no money for placement advantage at all in scope today).

**Forbids.** Premium tiers, supporter perks, ads that grant placements, "boosts," cosmetic items that affect placement, or priority queues. (Enforced as anti-backdoor rules in `NON_GOALS.md`.)

---

### `PRIN-NO-ANON` — No anonymous participation

**Law.** No one places a pixel without verified tenant membership tied to an identity.

**Why.** Anonymity removes accountability and invites abuse the community can't trace; it is incompatible with `PRIN-IDENTITY`.

**Requires.** Verification before any write action (`P-JOURNEY-1`, `P-AC-1`).

**Forbids.** Guest placement, throwaway accounts, or write access before verification. (Read-only visibility for non-members is an open product question, `P-Q-2`, and does not violate this law as long as it grants no placement power.)

---

### `PRIN-NO-INVISIBLE-LOSS` — Moderation is reversible and audited; history never vanishes silently

**Law.** Moderation changes what the canvas *shows*, never what *happened*. Every moderation action is reversible-by-design and recorded in an audit log; nothing is hard-deleted.

**Why.** Safety (removing offensive content) and permanence (`PRIN-PERMANENCE`) must coexist. The resolution: moderation overlays/reverts visible state while preserving the underlying record, with a tamper-evident audit trail (`P-VISION-3`, `P-MOD-1`).

**Requires.** Reversible tools, mandatory audit entries, and no destruction of history (`P-MOD-4`, `P-MOD-5`); immutable archives after term close (`P-MOD-7`).

**Forbids.** Any moderation path that destroys history, acts without an audit entry, or cannot be undone/explained.

---

## Applying the Principles

- **Specs & reviews must cite the principles they touch.** A feature spec that affects placement cites `PRIN-FAIRNESS`/`PRIN-EQUAL-POWER`; a moderation spec cites `PRIN-NO-INVISIBLE-LOSS`; etc.
- **A principle conflict is a stop condition.** If implementation seems to require violating a principle, the engineer/engineer **stops and escalates** rather than shipping the violation (ties to the governance stop-conditions in `ENGINEERING_WORKFLOW.md`).
- **Changing a principle is a heavyweight act.** Principles change only by explicit product-owner decision, recorded as an ADR, with downstream docs updated in the same change. They are not edited to unblock a feature.

---

## Document control

- **Path:** `docs/PRINCIPLES.md`
- **Purpose:** The non-negotiable product laws that govern every decision in Quad; the constitution that `PRODUCT.md`, `NON_GOALS.md`, and all architecture/specs must obey.
- **Dependencies:** `docs/PRODUCT.md` (requirement IDs cited throughout). **Governs:** `NON_GOALS.md` and every downstream spec/architecture doc.
- **Acceptance checklist:** ☑ all user-listed laws present (fairness, equal power, identity/accountability, permanence, tenant isolation, mobile-first, no pay-to-win, no anonymous participation, no invisible history loss) + alive/instant + config-over-code ☑ precedence stated (fairness wins) ☑ each law has why/requires/forbids ☑ `P-*` IDs cited ☑ product-level only (no architecture/versions) ☑ tenant-neutral.
- **Open questions:** read-only access for non-members (`P-Q-2`); public-handle exposure policy (`P-Q-1`).
- **Next recommended:** `docs/NON_GOALS.md` (this batch).
