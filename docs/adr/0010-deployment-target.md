# ADR-0010: Deployment Target

- **Status:** **Proposed** (provider not yet selected) · **Date:** 2026-06 · **Deciders:** Architect, DevOps (+ owner) · **Linked docs:** `docs/DEPLOYMENT.md`, `docs/DISASTER_RECOVERY.md`, `docs/OPERATIONS.md`, `docs/TECH_BASELINE.md`

## 1. Context
`DEPLOYMENT.md` is deliberately **provider-neutral**. The concrete deployment provider/platform is a real decision with cost, region, and capability implications that should be made closer to launch, not silently assumed now.

## 2. Decision (Proposed)
**Defer the provider choice; keep the deployment architecture provider-neutral.** The selected provider(s) must supply these capabilities:
- **Web hosting** (for `apps/web`, CDN-fronted).
- **API hosting with WebSocket-upgrade + long-lived-connection support** (for `apps/api`, horizontally scalable).
- **Managed PostgreSQL** (event log + projections; backups/PITR; read replicas).
- **Managed Redis/Valkey** (cooldown, pub/sub, presence, sessions; eviction-policy control).
- **Object storage + CDN** (archive artifacts, replay assets, final images; controlled access).
- **Secrets manager** (no secrets in repo; rotation).
- **Logs/metrics/traces** sink (observability).
- **CI/CD integration** (build → scan → migrate → deploy → smoke → promote).
- **TLS + custom domains** (per-tenant host/subdomain).
- **Backup/restore support** (DR drills, RPO/RTO).

## 3. Consequences
+ No premature lock-in; architecture stays portable. − A real provider decision + `ADR-0010` update is a prerequisite to production (`LG-*`).

## 4. Alternatives Considered (to evaluate later)
Managed PaaS vs. container orchestration vs. serverless-where-applicable; single-cloud vs. mixed managed services; Redis vs. Valkey image/license. Evaluation criteria: WS support, managed-Postgres maturity, cost, region/data-residency, ops burden.

## 5. Affected Docs / Contracts
`DEPLOYMENT.md` (topology), `DISASTER_RECOVERY.md` (RPO/RTO + region failover), `OPERATIONS.md` (runbooks), `TECH_BASELINE.md` (Redis vs Valkey).

## 6. Migration / Rollout Notes
Provider chosen and this ADR moved to **Accepted before real production deployment** (milestones M54–M56 + launch gate G6).

## 7. Follow-Up Actions
Select provider(s) + secrets manager + Redis topology + CDN; set concrete **RPO/RTO** and region/failover; update this ADR to Accepted; reconcile `TECH_BASELINE.md` (Redis vs Valkey).

## Document Control
- **Path:** `docs/adr/0010-deployment-target.md` · **Acceptance:** ☑ status Proposed ☑ provider-neutral ☑ required capabilities listed ☑ finalize-before-prod ☑ alternatives-to-evaluate ☑ deferred items routed.
