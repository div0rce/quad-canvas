# Quad — Launch Plan

> **This is the product launch plan: what "launched" means, what must be true before we launch, and how we decide go/no-go.** It is honest about dependencies and risks — a launch plan that hides its blockers is theater.
>
> It is product/operational-level. It references engineering, security, and operations docs as **dependencies** (their readiness is an input) but does not duplicate their content. Sequencing of build work lives in `MILESTONES.md`; staging of capability lives in [`ROADMAP.md`](ROADMAP.md).
>
> **Naming:** Quad = platform; **Rutgers Quad** = tenant #1. The first launch is **Rutgers Quad, one full semester**. Scope IDs reference [`PRODUCT.md`](PRODUCT.md).

---

## 1. What "launch" means

**First launch = Rutgers Quad opens to the entire eligible Rutgers student body for one full semester**, delivering the MVP (`PRODUCT.md` §17) end-to-end: live canvas, fair global cooldown, attribution, profiles, leaderboards, moderation with audit, and a semester that completes into a permanent archive + replay.

Launch is **staged**, not a single switch (mirrors `ROADMAP.md`):

1. **Closed pilot (R0)** — invite-only; validate the core loop and safety.
2. **Soft launch** — limited but open verification (e.g., a single school/college or a capped cohort) to test scale and moderation under real conditions.
3. **Full launch (R1)** — open to all eligible students for the official semester canvas.

Each stage has its own, stricter go/no-go.

---

## 2. Readiness dimensions

Launch readiness is the conjunction of these dimensions. Each names its **owning doc** (the source of the detailed bar) and its **product gate**.

### 2.1 Authentication readiness — *owner: `AUTHENTICATION.md`*
- Verified-membership sign-in works for Rutgers domains; only eligible students can become participants (`P-AC-1`, `PRIN-NO-ANON`).
- No password auth; email-verification flow is abuse-resistant (rate-limited, anti-enumeration).
- **Gate:** a non-member cannot obtain placement power by any tested path.

### 2.2 Moderation readiness — *owner: `MODERATION.md`*
- Moderator roster recruited, trained, and scoped to the tenant (`P-MOD-6`).
- All MVP tools live: reports queue, ban/suspend, rollback pixel + region/time-range, remove artwork, search by handle/coordinate (`P-MOD-2`).
- **Audit log mandatory and verified**; actions reversible; nothing hard-deleted (`P-AC-10`, `PRIN-NO-INVISIBLE-LOSS`).
- **Gate:** a realistic abuse scenario can be detected, acted on, audited, and undone within an acceptable response time.

### 2.3 Content-policy dependency — *blocking; owner: tenant + product*
- A written **content standard** defining what "offensive"/removable means must exist and be approved before public launch — moderation cannot be fair or defensible without it (resolves `P-Q-11`, `P-MOD`).
- Reporting categories and moderator guidance derive from this policy.
- **Artifact:** the written standard is **`docs/CONTENT_POLICY.md`** (prohibited categories, the proportionate audited action ladder, due process/appeals), and it is **available to moderators in-app at `/policy`** (linked from the moderator console). What remains for the gate is the tenant's **formal approval** of this baseline.
- **Gate:** content policy approved by the tenant and visible to moderators (and, as appropriate, users). **No public launch without it.**

### 2.4 Analytics / replay / archive readiness — *owner: `ANALYTICS.md`, `REPLAY.md`, `ARCHIVES.md`*
- Term statistics, a faithful replay, and a downloadable final image can be produced from real data (`P-AC-8`, `P-AC-9`).
- Archive is permanent, browsable, and tenant-isolated (`P-ARCH-*`).
- **Gate:** a full freeze → archive → final image → stats → replay dry run succeeds on representative data **before** the real term ends (don't discover archival bugs at term close).

### 2.5 Performance & scale readiness — *owner: `PERFORMANCE.md`*
- The canvas feels instantaneous and updates in real time at expected concurrency for the Rutgers student body (`P-AC-2`, `P-AC-11`, `PRIN-ALIVE`).
- Cooldown behaves correctly under load and stays within 5–20 min without oscillation (`P-AC-3`, `P-AC-4`).
- **Gate:** load testing meets the `PERFORMANCE.md` budgets at projected peak concurrency.

### 2.6 Security & abuse readiness — *owner: `SECURITY.md`*
- Threat-model mitigations in place (account abuse, cooldown bypass, WebSocket abuse, tenant isolation, etc.); critical items have tests (`P-ABUSE-*`, `P-AC-13`).
- **Gate:** no open critical/high security issues; tenant isolation verified.

### 2.7 Operational readiness — *owner: `OPERATIONS.md`, `OBSERVABILITY.md`, `DISASTER_RECOVERY.md`*
- Monitoring/alerting live; on-call and incident response defined; backups + restore drill passed; emergency freeze (`P-ADMIN-7`) tested.
- **Gate:** an operator can detect, freeze, and recover from a serious incident, and history survives a restore.

### 2.8 Legal / licensing readiness — *blocking open questions; owner: product + university*
- **Open licensing/legal items that must be resolved before public launch:**
  - **Software license** for the repo (deferred decision; see `README.md`).
  - **Terms of Service** and **Privacy Policy** for participants.
  - **Data/privacy posture** appropriate to student data (e.g., FERPA considerations, what's stored, what's shown publicly — ties to public-handle policy `P-Q-1`).
  - **University partnership/approval** to operate under the Rutgers identity and use email-domain verification.
- **Gate:** ToS, privacy policy, and any required university approval are in place; the public-handle/data-exposure policy is decided.

---

## 3. Go / No-Go criteria

A stage launches only when **all** apply. Any single No-Go blocks the stage.

| # | Go/No-Go criterion | Linked gate |
| --- | --- | --- |
| `LG-1` | All MVP product acceptance criteria pass (`P-AC-1`…`P-AC-13`) | §2.1–§2.7 |
| `LG-2` | Content policy approved and available to moderators | §2.3 |
| `LG-3` | Moderation tools + audit verified; reversal proven in production-like conditions | §2.2 |
| `LG-4` | Auth lets in only eligible students; no anonymous placement path | §2.1 |
| `LG-5` | Performance budgets met at projected peak concurrency | §2.5 |
| `LG-6` | No open critical/high security issues; tenant isolation verified | §2.6 |
| `LG-7` | Full archive/replay dry run succeeded on representative data | §2.4 |
| `LG-8` | Ops: monitoring, on-call, backups+restore drill, emergency freeze all ready | §2.7 |
| `LG-9` | Legal: ToS, privacy policy, university approval, data-exposure policy resolved | §2.8 |
| `LG-10` | Rollback/contingency plan rehearsed (see §5) | §5 |

**Decision forum.** Go/no-go is a product-owner call with moderation, security, and operations sign-off recorded. A No-Go triggers fix-forward (see `CHECKPOINTS.md`), not a quiet ship-anyway.

---

## 4. Launch sequence & timing

- **Term anchoring.** Target the **start of a Fall semester** at Rutgers Quad so the canvas spans a natural term; the *exact* dates are set with the university and depend on `LG-9`.
- **Pre-term:** closed pilot + soft launch must complete and clear their go/no-go before the official canvas opens.
- **Term open:** full launch coincides with the official semester canvas going Active (`P-LIFE-3`).
- **Term close:** freeze → archive at the scheduled term end (`P-LIFE-4`, `P-LIFE-5`), having already proven the dry run (`LG-7`).

> Timing realism: do **not** open the official canvas mid-term or without the archive path proven. A canvas that can't be faithfully frozen/archived would violate `PRIN-PERMANENCE`.

---

## 5. Contingency, rollback & comms

- **Emergency freeze.** Operators can pause/freeze the active canvas during an incident, audited (`P-ADMIN-7`); this is the primary safety lever and must be rehearsed (`LG-10`).
- **Severe-abuse contingency.** Pre-agreed escalation when moderation is overwhelmed (e.g., temporary placement slowdown within cooldown bounds, targeted suspensions) — **never** a fairness bypass (`PRIN-FAIRNESS`).
- **Data-integrity contingency.** If history integrity is ever in doubt, freeze + restore from backup before continuing (ties to `DISASTER_RECOVERY.md`); never paper over lost history (`PRIN-NO-INVISIBLE-LOSS`).
- **Communications.** A plan for announcing launch, status during incidents, and term-close/archive availability to students.

---

## 6. Post-launch success signals

Product-level signals that the launch is working (not vanity metrics):

- Meaningful, sustained participation across the term (a real share of eligible students place pixels).
- The canvas tells a recognizable story of the campus by term end (`P-VISION`).
- Moderation keeps the space safe without feeling heavy-handed; audit trail clean.
- The archive + replay are something the community revisits and shares.
- Fairness holds: no credible claim that anyone gained extra power.

---

## 7. Open launch questions

- `P-Q-11` **Content policy** ownership/standard (blocking, §2.3).
- `P-Q-1` **Public-handle/data-exposure** policy (blocking for legal/privacy, §2.8).
- **Software license** selection (§2.8) — referenced from `README.md`.
- **University partnership** scope and approval timeline (§2.8) — gates the use of Rutgers identity/domains.
- `P-Q-2` Whether non-members may view read-only at launch (affects reach + privacy messaging).
- First-term **exact dates** vs. semester calendar (§4).

---

## Document control

- **Path:** `docs/LAUNCH_PLAN.md`
- **Purpose:** Define what launching Quad (Rutgers Quad, first) requires, the readiness dimensions, and the go/no-go criteria — honestly including blocking legal/content dependencies.
- **Dependencies:** `docs/PRODUCT.md` (`P-AC-*`, scope), `docs/PRINCIPLES.md`, `docs/ROADMAP.md`; readiness inputs from `AUTHENTICATION`, `MODERATION`, `SECURITY`, `PERFORMANCE`, `ANALYTICS`, `REPLAY`, `ARCHIVES`, `OPERATIONS`, `OBSERVABILITY`, `DISASTER_RECOVERY` (generated later).
- **Acceptance checklist:** ☑ launch defined + staged ☑ readiness dimensions incl. auth, moderation, content-policy dependency, analytics/replay/archive, performance, security, operations, legal/licensing ☑ explicit go/no-go criteria (`LG-1`…`LG-10`) ☑ contingency/rollback ☑ legal/licensing open questions surfaced ☑ product-level (no engineering milestones/versions) ☑ tenant-neutral.
- **Open questions:** see §7 (content policy, license, university approval, data-exposure, non-member viewing, dates).
- **Next recommended:** `docs/ARCHITECTURE.md` (begins Phase 2 — core architecture).
