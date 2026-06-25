# Quad — Non-Goals

> **These are the things Quad deliberately will not be.** A non-goal is a *product guarantee*, not a backlog item we haven't gotten to. Each entry says what is excluded, **why**, and the **anti-backdoor rules** that prevent the excluded feature from sneaking back in under a softer name.
>
> Non-goals are enforced by [`PRINCIPLES.md`](PRINCIPLES.md) and summarized at `P-NONGOAL-*` in [`PRODUCT.md`](PRODUCT.md). If a proposed feature matches a non-goal — or is a renamed version of one — it is rejected by default.
>
> **Naming:** Quad = platform; Rutgers Quad = tenant #1. Each non-goal has a stable ID (`NG-*`).

---

## How to read the anti-backdoor rules

Excluded features rarely return by their banned name. They return as "just a small thing" with a friendlier label. The **anti-backdoor rules** list the disguises each non-goal tends to wear. **If a feature matches a disguise, it is the banned thing.** The test is *function*, not *name*: does it create the excluded capability or effect? If yes, it's out.

---

## Communication & Social Non-Goals

### `NG-CHAT` — No chat
**Excluded:** real-time or threaded chat of any kind, channels, rooms.
**Why:** Quad's "conversation" is the canvas itself; chat invites harassment, heavy moderation burden, and off-mission scope. The product is expression through pixels, not messaging.
**Anti-backdoor:** no "canvas chat," "live room," "team coordination channel," "color-group chat," "ephemeral messages," or comment-like reply threads attached to anything.

### `NG-DM` — No direct messages
**Excluded:** private user-to-user messaging.
**Why:** DMs are a harassment and safety liability with no contribution to the collaborative-art mission, and they pull the product toward being a social network.
**Anti-backdoor:** no "say thanks," "nudge a user," "private notes to another user," or contact mechanisms surfaced from profiles/pixels.

### `NG-COMMENTS` — No comments
**Excluded:** comment threads on pixels, regions, profiles, archives, or replays.
**Why:** Comments recreate chat's moderation/harassment problems and clutter the artifact.
**Anti-backdoor:** no "reactions with text," "pixel captions by others," "annotations," or "discussion" surfaces. (Read-only attribution/history is **not** a comment — see scope note below.)

### `NG-SOCIAL-GRAPH` — No following / social graph
**Excluded:** follow/followers, friends, subscriptions to users.
**Why:** A social graph shifts focus from the shared canvas to interpersonal status games and creates new harassment vectors.
**Anti-backdoor:** no "follow this artist," "favorite a user," "notify me when X places," or friend lists. (Leaderboards rank *activity*, not relationships, and are fine — `NG` does not forbid leaderboards.)

---

## Economic Non-Goals

### `NG-MARKETPLACE` — No marketplace
**Excluded:** buying/selling/trading pixels, regions, colors, names, or any in-product asset.
**Why:** Markets convert equal influence into purchased influence — a direct assault on `PRIN-FAIRNESS`.
**Anti-backdoor:** no "claim/own a region," "reserve coordinates," "auction a spot," or trading of any in-canvas entity.

### `NG-PURCHASE-POWER` — No purchasing pixels or placement advantage
**Excluded:** paying to place more, faster, sooner, or with priority.
**Why:** This is pay-to-win, forbidden by `PRIN-NO-PAY-TO-WIN`.
**Anti-backdoor:** no "extra pixels," "skip/shorten the cooldown," "priority placement," "supporter pixels," "boosts," "power-ups," "energy refills," or "founder perks" that touch placement.

### `NG-PAYMENTS` — No payments / monetary features
**Excluded:** in-product payments, tips, subscriptions, or stores in MVP and as a fairness-affecting mechanism ever.
**Why:** Keeps the product clean of monetization pressure that erodes fairness; donations/sponsorship, if ever explored, must be strictly non-influencing and out of current scope.
**Anti-backdoor:** no "tip the artist," "premium membership," "remove ads for $," "cosmetic store" that affects placement, or any spend that changes canvas power.

### `NG-CRYPTO` — No cryptocurrency
**Excluded:** tokens, coins, wallets, on-chain anything.
**Why:** Off-mission, adds speculation/scam surface, and re-introduces purchased influence and complexity for no student benefit.
**Anti-backdoor:** no "canvas token," "points redeemable for value," "wallet connect," or blockchain-backed ownership/provenance.

### `NG-NFT` — No NFTs
**Excluded:** minting, owning, or selling pixels/regions/artwork as NFTs.
**Why:** Converts the shared, equal, communal artwork into private speculative property — antithetical to fairness and permanence-as-shared-record.
**Anti-backdoor:** no "mint your pixel," "own a piece of the canvas," "collectible drops," or tradable provenance certificates.

---

## Content & Identity Non-Goals

### `NG-MACHINE-ART` — No machine-generated artwork features
**Excluded:** generating, auto-filling, or stamping artwork via automated generation; importing machine-generated images onto the canvas as a feature.
**Why:** The point is *human* collective effort, one pixel at a time. Machine-generated art bypasses the labor and equality that make the result meaningful.
**Anti-backdoor:** no "auto-fill," "generate a template and auto-place," "image-to-pixels importer," "bot-assisted drawing," or scripted mass placement dressed as a tool. (This reinforces the anti-bot stance in `P-ABUSE-3`.)

### `NG-ANON` — No anonymous participation
**Excluded:** placing pixels without verified, identified tenant membership.
**Why:** Anonymity removes accountability and is incompatible with `PRIN-IDENTITY`/`PRIN-NO-ANON`.
**Anti-backdoor:** no "guest mode that can place," "try it before verifying (with writes)," "temporary anonymous handle that places," or shared/role accounts used to place. (Non-member *read-only* viewing, if adopted per `P-Q-2`, grants **no** placement power and is not a backdoor.)

### `NG-UNEQUAL-POWER` — No mechanism that makes one student stronger than another
**Excluded:** any path — paid, earned, granted, or algorithmic — that gives an account more canvas influence.
**Why:** The umbrella guarantee behind `PRIN-FAIRNESS`/`PRIN-EQUAL-POWER`; listed explicitly because new "engagement" ideas often smuggle this in.
**Anti-backdoor:** no "streak grants a shorter cooldown," "top engineers place faster," "verified-longer users get perks," "regional ownership," "level-ups that affect placement," or moderator/admin placement privileges beyond normal rules. (Moderation powers are separate from *placement* power and are not an exception — see `P-COOL-6`.)

---

## Scope notes (what is NOT a non-goal)

To prevent over-correction, these are explicitly **allowed** and must not be mistaken for banned features:

- **Attribution, hover, and full pixel history** (`P-ATTR-*`) — read-only provenance, not comments/chat.
- **Profiles, leaderboards, heatmaps, analytics, archives, replay** (`P-FEAT-5`…`P-FEAT-9`) — built on real activity; no social graph or payments involved.
- **Reporting + moderation** (`P-MOD-*`) — safety tooling, not social messaging.
- **Future badges/achievements** (`P-POST-3`) — permitted **only** if purely recognitional and **never** affecting placement power (else they hit `NG-UNEQUAL-POWER`).
- **Non-member read-only viewing** — only if it grants no write/placement ability (`P-Q-2`).

---

## Governance: challenging a non-goal

Non-goals are durable, not eternal — but they do not bend casually.

1. A change to any non-goal requires an explicit **product-owner decision** recorded as an **ADR**, with `PRINCIPLES.md`, `PRODUCT.md`, and this file updated in the same change.
2. The burden of proof is on the proposer to show the change does **not** violate a higher principle (especially `PRIN-FAIRNESS`).
3. Until that happens, any feature matching a non-goal or its anti-backdoor disguises is **rejected by default** — this is a hard **stop condition** for engineers and engineering roles (see `ENGINEERING_WORKFLOW.md`).

---

## Document control

- **Path:** `docs/NON_GOALS.md`
- **Purpose:** The authoritative list of what Quad refuses to be, with rationale and anti-backdoor rules so excluded features cannot return under softer names.
- **Dependencies:** `docs/PRINCIPLES.md` (laws that justify each exclusion), `docs/PRODUCT.md` (`P-NONGOAL-*`, scope IDs).
- **Acceptance checklist:** ☑ all `P-NONGOAL-*` covered (chat, DMs, comments, social graph, marketplace, purchasing, payments, crypto, NFTs, machine-generated art, anonymity, unequal power) ☑ rationale per item ☑ anti-backdoor rules per item ☑ scope notes (allowed look-alikes) ☑ governance/challenge process ☑ product-level only ☑ tenant-neutral.
- **Open questions:** non-member read-only viewing (`P-Q-2`); whether any non-influencing sponsorship is ever explored post-launch (currently out of scope).
- **Next recommended:** `docs/ROADMAP.md` (this batch).
