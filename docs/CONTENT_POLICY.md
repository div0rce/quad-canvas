# Quad — Content Policy

> **This document is the content policy that moderators apply** — what is allowed on a canvas, what is
> prohibited, and how moderators respond proportionately and accountably. It is the human-facing policy
> behind the technical model in `MODERATION.md`. It is the **content-policy artifact** for launch gate
> **`LG-2`** ("content policy approved and available to moderators") and is **available in-app** to
> moderators at `/policy`; a tenant's formal *approval* of this baseline is its own organizational
> sign-off (tracked in `LAUNCH_PLAN.md`).
>
> **Tenant-neutral.** This is the platform baseline. A tenant (e.g. Rutgers Quad = tenant #1) may add
> stricter rules via its own community standards; a tenant may never *weaken* the prohibitions below.

## 1. Scope

This policy governs two things:

- **Canvas content** — the pixels placed on a shared canvas, individually and in aggregate (text,
  imagery, and patterns formed by many placements).
- **Member conduct** — how members behave toward one another and toward the platform.

It applies to every member of a tenant. Viewing is public; **placing requires an eligible, authenticated
account** (no anonymous writes), so every placement is attributable for accountability.

## 2. Prohibited content

The following are prohibited on any canvas. Moderators remove or revert such content and may act on the
responsible member:

- **Hate & harassment** — content attacking or demeaning people based on a protected characteristic
  (race, ethnicity, national origin, religion, disability, sex, gender identity, sexual orientation, age),
  or targeted harassment, bullying, or incitement against an individual or group.
- **Sexual & explicit content** — pornographic or sexually explicit imagery; any sexualization of minors
  is reported to authorities and results in a permanent ban.
- **Violence & threats** — threats of violence, incitement, or glorification of violence or terrorism.
- **Illegal content** — content that is unlawful, or that facilitates illegal activity.
- **Private information (doxxing)** — personal/identifying information about anyone without consent
  (addresses, phone numbers, government IDs, etc.).
- **Impersonation & deception** — impersonating a person, institution, or official body; coordinated
  deception.
- **Spam & abuse of the system** — automation/botting to evade the placement cooldown, rate-limit abuse,
  or attempts to deface the canvas at scale.

When a placement is ambiguous in isolation but forms prohibited content **in aggregate** (e.g. a slur
spelled across many cells), the aggregate governs.

## 3. How moderators respond — the action ladder

Responses are **proportionate** to the severity and intent, and **every action is recorded** in the
append-only audit log (`MODERATION.md` §10) with the actor, action, target, reason, and time. No action
is taken silently.

**On content:**

- **Revert a placement** (`pixel_rollback`) — roll a single cell back to its prior state.
- **Revert a region** (`region_rollback`) — roll back every placement in a rectangle (for coordinated
  defacement). Reverted content is removed from public history so it is not re-exposed.

**On member conduct (escalating):**

1. **Resolve / dismiss a report** (`resolve_report` / `dismiss_report`) — triage the report queue;
   dismissal is for reports that do not violate this policy.
2. **Suspend** (`suspend_member`) — a **temporary** removal of placement rights for repeated or serious
   violations; the member's active sessions are revoked immediately.
3. **Ban** (`ban_member`) — a **permanent** removal for egregious violations (e.g. sexual content
   involving minors, credible threats) or persistent abuse after suspension.
4. **Reinstate** (`reinstate_member`) — restore a suspended/banned member (e.g. on a successful appeal or
   after a suspension elapses).

**Emergency:** an administrator may **freeze** the active canvas during an incident (placement stops,
viewing continues) as the primary safety lever (`LAUNCH_PLAN.md` emergency controls).

Choose the **least severe** action that addresses the violation. Reserve bans for the most serious cases.

## 4. Due process, reversal & appeals

- **Attribution, not surveillance.** Actions are based on the content and conduct, using only the public
  identity (handle/display name). A member's email and other private data (DC3) are never exposed to
  moderators or in any audit record.
- **Reversibility.** Content actions are reversible by design (rollbacks are themselves audited
  compensating events). Member actions can be undone with `reinstate_member`.
- **Appeals.** A suspended or banned member may appeal to the tenant's moderation team. If the appeal
  succeeds, a moderator reinstates them; the appeal outcome is recorded.
- **Consistency.** Apply this policy evenly. Do not act on content you merely dislike — only on content
  that violates the prohibitions above.

## 5. Principles

- **Proportionality** — the response fits the violation.
- **Accountability** — every action is audited; nothing is silent or anonymous.
- **Privacy** — moderation never exposes private data (DC3); identity is public-handle only.
- **Tenant isolation** — a moderator acts only within their own tenant; actions never cross tenants.
- **Permanence with remedy** — the canvas is an append-only record, and moderation corrects it through
  audited, reversible compensating actions rather than silent deletion.

## 6. Availability

This policy is available to moderators in-app at **`/policy`** (linked from the moderator console) and in
the repository at `docs/CONTENT_POLICY.md`. Material changes are versioned with the codebase and
communicated to tenant moderation teams before they take effect.

---

**Related:** `MODERATION.md` (technical model, action catalog, audit), `LAUNCH_PLAN.md` (`LG-2`, `LG-3`),
`SECURITY.md` & `AUTHENTICATION.md` (eligibility, no anonymous writes), `ARCHIVES.md` (permanence/replay).
