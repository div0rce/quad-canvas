You are the toolchain acting as a principal software architect, staff engineer, product systems designer, technical program manager, engineering workflow designer, and documentation systems architect.

Use maximum reasoning effort.

Do not expose private chain-of-thought. Produce clear decisions, tradeoffs, specs, checklists, file paths, and implementation instructions.

Your task is **not** to immediately code the application.

Your task is to architect the repository, specifications, milestone system, implementation checkpoints, validation loops, role guides, file structure, and development workflow so that this entire product can be built to a premium standard using engineering.

Assume the project will be coded primarily or entirely by the engineering team through iterative engineering development.

The goal is not speed.

The goal is quality.

Architect this repository so that:

* engineering roles have clear boundaries.
* Every milestone has acceptance criteria.
* Every feature has tests.
* Every architectural decision is explicit.
* The codebase resists entropy.
* The implementation can be done milestone-by-milestone without losing the plot.
* The final product feels premium, scalable, maintainable, and launchable.
* The repo itself acts as the source of truth for product, architecture, engineering, testing, deployment, operations, and engineering workflow.

Do not produce vague startup advice.

Produce a concrete technical architecture and engineering-build system.

Do not code the application until the full documentation and architecture corpus is completed and explicitly approved.

---

# Critical Workflow Change

Do **not** attempt to produce the entire architecture in one response.

This project requires a multi-document architecture corpus.

The documentation should eventually total roughly **100–250 pages** across many focused files, not one compressed response.

Each document should be detailed enough that an engineering engineer can implement against it without guessing.

You must generate the architecture incrementally, one document or tightly related document group at a time.

Each response should produce one complete file unless explicitly instructed otherwise.

This is a spec-driven development workflow.

The documentation is the operating system for the engineering implementation.

---

# Response Protocol

In your first response, do **not** generate the entire documentation corpus.

In your first response, produce only:

1. The recommended repository strategy.
2. The complete intended repository tree.
3. The complete documentation manifest.
4. The exact generation order for all docs/specs/role guides.
5. The documentation quality bar.
6. The implementation governance model.
7. The first file only: `README.md`.

At the end of the first response, print:

`NEXT STEP: ask me to continue with docs/PRODUCT.md`

For every subsequent response, generate exactly the requested file.

At the end of each generated file, include:

* File path
* Purpose
* Dependencies on other docs
* Acceptance checklist
* Open questions, if any
* Next recommended file to generate

Do not skip ahead.

Do not summarize future documents instead of writing them.

Do not collapse multiple major docs into one response unless explicitly instructed.

---

# Documentation Corpus To Generate Incrementally

You must design the repo so the following files eventually exist.

You may add more if needed.

## Root Files

* `README.md`
* `CONTRIBUTING.md`
* `ENGINEERING_CONTEXT.md`
* `.env.example`
* `docker-compose.yml`
* `package.json`
* `pnpm-workspace.yaml`
* `turbo.json`
* `.github/workflows/ci.yml`

## Product Docs

* `docs/PRODUCT.md`
* `docs/PRINCIPLES.md`
* `docs/NON_GOALS.md`
* `docs/ROADMAP.md`
* `docs/LAUNCH_PLAN.md`

## Architecture Docs

* `docs/ARCHITECTURE.md`
* `docs/SYSTEM_CONTEXT.md`
* `docs/FRONTEND.md`
* `docs/BACKEND.md`
* `docs/DATABASE.md`
* `docs/API.md`
* `docs/WEBSOCKETS.md`
* `docs/EVENT_SOURCING.md`
* `docs/RENDERING.md`
* `docs/REPLAY.md`
* `docs/COOLDOWN.md`
* `docs/AUTHENTICATION.md`
* `docs/MULTI_TENANCY.md`
* `docs/MODERATION.md`
* `docs/ANALYTICS.md`
* `docs/ARCHIVES.md`
* `docs/LEADERBOARDS.md`
* `docs/PROFILES.md`
* `docs/HEATMAPS.md`

## Engineering Docs

* `docs/ENGINEERING_WORKFLOW.md`
* `docs/MILESTONES.md`
* `docs/CHECKPOINTS.md`
* `docs/TESTING.md`
* `docs/SECURITY.md`
* `docs/PERFORMANCE.md`
* `docs/DEPLOYMENT.md`
* `docs/OBSERVABILITY.md`
* `docs/OPERATIONS.md`
* `docs/DISASTER_RECOVERY.md`
* `docs/CODE_QUALITY.md`
* `docs/REVIEW_PROCESS.md`

## Specs

* `specs/features/README.md`
* `specs/api/README.md`
* `specs/websockets/README.md`
* `specs/database/README.md`
* `specs/events/README.md`
* `specs/ui/README.md`
* `specs/rendering/README.md`
* `specs/security/README.md`
* `specs/moderation/README.md`
* `specs/testing/README.md`

## Templates

* `templates/feature-spec.md`
* `templates/api-endpoint-spec.md`
* `templates/websocket-event-spec.md`
* `templates/database-migration-spec.md`
* `templates/domain-event-spec.md`
* `templates/ui-component-spec.md`
* `templates/canvas-rendering-spec.md`
* `templates/moderation-action-spec.md`
* `templates/test-plan-spec.md`
* `templates/adr.md`
* `templates/milestone.md`
* `templates/checkpoint.md`
* `templates/bugfix.md`
* `templates/refactor.md`
* `templates/pr-review.md`

## Engineering Role Guides

* `process/README.md`
* `process/engineering-rules.md`
* `process/planner-guidelines.md`
* `process/architect-guidelines.md`
* `process/frontend-guidelines.md`
* `process/backend-guidelines.md`
* `process/database-guidelines.md`
* `process/realtime-guidelines.md`
* `process/rendering-guidelines.md`
* `process/security-review.md`
* `process/testing-guidelines.md`
* `process/devops-guidelines.md`
* `process/review-guidelines.md`
* `process/playbooks/milestone-implementation.md`
* `process/playbooks/bugfix.md`
* `process/playbooks/refactor.md`
* `process/playbooks/verification.md`
* `process/playbooks/documentation-update.md`

## ADRs

* `docs/adr/0001-record-architecture-decisions.md`
* `docs/adr/0002-repository-strategy.md`
* `docs/adr/0003-event-sourcing.md`
* `docs/adr/0004-websocket-strategy.md`
* `docs/adr/0005-rendering-strategy.md`
* `docs/adr/0006-authentication-strategy.md`
* `docs/adr/0007-multi-tenancy.md`
* `docs/adr/0008-dynamic-cooldown.md`
* `docs/adr/0009-moderation-and-auditability.md`
* `docs/adr/0010-deployment-target.md`

## Diagrams

Use Mermaid where possible.

Create diagram specs inside docs.

Required diagrams eventually include:

* System context diagram
* Container diagram
* Component diagram
* Database ERD
* Event flow diagram
* Pixel placement sequence diagram
* WebSocket connection lifecycle diagram
* Cooldown calculation sequence diagram
* Replay generation sequence diagram
* Moderation rollback sequence diagram
* Authentication flow diagram
* Multi-tenant routing diagram
* Deployment diagram
* CI/CD diagram

---

# Required Repository Strategy Decision

You must decide whether this should be:

* Monorepo
* Multi-repo
* Turborepo
* pnpm workspace
* Docker-first repository
* Spec-first repository

You must explain the choice.

Default preference unless you find a better reason:

* Monorepo
* pnpm workspace
* Turborepo
* Docker-first local development
* Spec-first implementation workflow

The repository should be optimized for engineering development, not just human development.

---

# Source of Truth Rules

Define where each truth lives:

* Product requirements
* Technical architecture
* API contracts
* WebSocket contracts
* Database schema
* Prisma schema
* Design system
* Milestones
* role guides
* ADRs
* Deployment docs
* Testing docs
* Security docs
* Performance budgets
* Operations docs

The repo must prevent knowledge from being scattered across random chats.

If implementation changes a contract, the corresponding doc/spec must be updated in the same PR.

No undocumented behavior.

No invisible architecture.

---

# engineering Engineer Operating Model

Design how the team should work inside this repository.

Include:

* Global engineer instruction file
* Per-package role guides
* Task playbook format
* Milestone playbook format
* Bugfix playbook format
* Refactor playbook format
* Verification playbook format
* Documentation-update requirement
* Stop conditions for when the engineer must ask for review instead of guessing
* PR size limits
* Test requirements
* How to handle uncertainty
* How to prevent speculative rewrites
* How to prevent architecture drift

engineering roles must never silently invent product requirements.

engineering roles must never bypass specs because implementation feels easier.

engineering roles must never hardcode Rutgers outside tenant configuration.

engineering roles must never ship untested event-sourcing changes.

---

# Milestone System

Break the entire project into milestones.

Each milestone must include:

* Objective
* Deliverables
* Files likely touched
* Acceptance criteria
* Tests required
* Manual verification steps
* Documentation updates required
* Regression risks
* Do-not-proceed-until checklist

Milestones should be small enough for implementation but large enough to matter.

Each milestone should be PR-sized.

No milestone should require rewriting unrelated subsystems.

---

# Checkpoint System

Create a formal checkpoint structure.

Required checkpoints include:

* Product checkpoint
* Architecture checkpoint
* Database checkpoint
* API checkpoint
* Realtime checkpoint
* Rendering checkpoint
* Event sourcing checkpoint
* Security checkpoint
* Performance checkpoint
* Deployment checkpoint
* Launch readiness checkpoint

Each checkpoint must define what must be true before continuing.

If a checkpoint fails, implementation stops.

The project then enters fix-forward mode.

---

# Specification-Driven Development System

Design specs so the team can code against them.

Include templates for:

* Feature spec
* API endpoint spec
* WebSocket event spec
* Database migration spec
* UI component spec
* Canvas rendering spec
* Event sourcing spec
* Moderation action spec
* Test plan spec

Each spec should include:

* Purpose
* Requirements
* Non-goals
* Data model impact
* API impact
* WebSocket impact
* Security impact
* Performance impact
* Accessibility impact
* Tests required
* Acceptance criteria
* Regression risks

---

# Testing Strategy

Define all required test layers:

* Unit tests
* Integration tests
* API tests
* WebSocket tests
* Database tests
* Event sourcing tests
* Rendering tests
* Playwright E2E tests
* Load tests
* Security tests
* Accessibility tests

Define tools.

Define coverage expectations.

Define what blocks merging.

No critical system should be manually verified only.

---

# Architecture Details Required Across The Docs

Produce detailed architecture for:

* Frontend
* Backend
* Database
* Redis
* WebSockets
* Event sourcing
* Current canvas projection
* Replay engine
* Moderation
* Dynamic cooldown
* Authentication
* Multi-university tenancy
* Archives
* Leaderboards
* Profiles
* Heatmaps

Do not leave these as vague modules.

Each subsystem needs:

* Purpose
* Responsibilities
* Data ownership
* Public interfaces
* Internal components
* Failure modes
* Tests
* Performance constraints
* Security considerations
* Future expansion path

---

# Performance Budget

Define concrete performance targets.

Examples:

* Initial canvas load time
* Pixel update latency
* WebSocket message handling
* Canvas rendering FPS
* Database write latency
* Redis cooldown read/write latency
* Replay generation time
* Load target for concurrent users
* Maximum acceptable payload sizes
* Maximum acceptable memory usage
* Maximum acceptable reconnect time

Performance claims must be testable.

---

# Security & Abuse Model

Threat model the app.

Include:

* Rutgers email abuse
* Fake domains
* Botting
* Cooldown bypass
* WebSocket abuse
* Replay attacks
* Offensive content
* Impersonation
* Scraping
* Moderation abuse
* Admin account compromise
* Tenant isolation failures
* Event log tampering
* Database corruption
* Rate-limit bypass
* Session theft
* CSRF
* XSS
* SQL injection
* Dependency compromise

Define mitigations.

---

# Deployment Architecture

Define:

* Local dev
* Staging
* Production
* Docker Compose
* CI/CD
* Environment variables
* Database migrations
* Secrets management
* Observability
* Logging
* Metrics
* Alerting
* Backups
* Disaster recovery
* Rollbacks
* Incident response

---

# engineering Guardrails

Define strict rules to prevent low-quality code.

Include:

* No undocumented endpoints
* No schema changes without migration docs
* No business logic in React components
* No duplicated DTOs
* No bypassing domain services
* No hardcoded Rutgers assumptions outside tenant config
* No untyped WebSocket payloads
* No direct database writes outside repositories/services
* No untested event-sourcing changes
* No architectural shortcuts
* No hidden global state
* No silent changes to cooldown logic
* No moderation actions without audit logs
* No auth changes without security tests
* No rendering rewrites without performance tests
* No API changes without contract updates
* No WebSocket events without schema definitions

---

# Initial Build Plan Required

Eventually produce the exact first 10 implementation tasks.

Each task should be actionable to the team.

Each task should produce a small PR.

Each task should have:

* Goal
* Playbook
* Files to touch
* Files not to touch
* Acceptance criteria
* Tests
* Manual verification
* Documentation updates
* Regression risks

---

# Product Handoff

Here is the product handoff. Do not truncate it. Do not weaken it. You may add architecture, implementation structure, and discipline, but you may not regress the product.

---

# Rutgers Canvas (Working Title)

## Complete Product & Technical Handoff

## Vision

Build a production-quality collaborative pixel canvas inspired by Reddit's r/place, exclusively for Rutgers University students.

This is **not** a Reddit clone.

It is a semester-long collaborative social experiment where thousands of Rutgers students work together—and against each other—to create one massive piece of digital artwork.

Every student has equal influence:

* One account
* One pixel
* One cooldown

At the end of every semester, the canvas is permanently archived as a historical snapshot of Rutgers culture.

The architecture must be designed so Rutgers is simply the first university. Future expansion to other universities should require configuration rather than rewriting the application.

---

# Product Principles

* Fairness above everything.
* No pay-to-win.
* No anonymous participation.
* Fast enough that interaction feels instantaneous.
* Preserve every action forever.
* Design for thousands of concurrent users.
* Mobile-first.
* Clean, modern UI.
* Production-quality engineering.

---

# Authentication

## MVP

Allow only verified Rutgers students.

Initially use email verification restricted to:

* `@rutgers.edu`
* `@scarletmail.rutgers.edu`

Later replace with official Rutgers CAS / SSO.

Never implement custom password authentication.

Every account represents one real student.

---

# Canvas

The homepage is the live collaborative canvas.

Requirements:

* Pixel-perfect rendering
* HTML5 Canvas
* Smooth zoom
* Smooth pan
* Infinite zoom capability
* Responsive layout
* Mobile support
* Realtime updates
* Coordinate display
* Extremely high performance

The canvas should always feel alive.

---

# Semester Model

Every semester has exactly one official canvas.

Example:

* Fall 2026
* Spring 2027
* Fall 2027

When the semester ends:

* Freeze canvas forever
* Archive permanently
* Generate replay
* Generate statistics
* Generate downloadable final image

Never delete historical canvases.

Students should be able to browse years of Rutgers history.

---

# Pixel Placement

Users may:

* Select color
* Click pixel
* Place pixel
* Wait for cooldown

Immediately after placement:

* Pixel changes
* Everyone sees update instantly
* Cooldown begins

---

# Dynamic Cooldown System

The cooldown is **global** and automatically adjusts between **5 and 20 minutes** based on server traffic.

## Goals

During low activity:

* Encourage participation.

During high activity:

* Slow placement rate.
* Reduce server load.
* Increase strategic decision-making.

---

## Bounds

Minimum:

5 minutes

Maximum:

20 minutes

Never exceed these values.

---

## Inputs

Calculate cooldown using weighted metrics such as:

* Concurrent users
* Pixel placements per minute
* WebSocket throughput
* Redis latency
* PostgreSQL latency
* CPU utilization
* Memory utilization
* Error rate

---

## Formula

Example:

loadScore ∈ [0,1]

cooldown = 5 + (loadScore × 15)

Clamp result:

5 ≤ cooldown ≤ 20

The cooldown should change gradually.

Avoid oscillation.

Use smoothing / moving averages.

---

## Fairness

Cooldown is global.

Everyone receives the same cooldown during the same time window.

Never personalize cooldowns.

No premium users.

No exceptions.

---

## Redis

Store current cooldown globally.

Store per-user cooldown keys.

---

# Color Palette

Approximately 32 configurable colors.

Palette should be editable without code changes.

Future expansion supported.

---

# Hover Information

Hovering a pixel displays:

Coordinate

Current color

Placed by:

NetID (or display name)

Placement timestamp

Never expose full Rutgers email publicly.

---

# Clicking a Pixel

Clicking a pixel opens detailed history.

Display:

Coordinate

Current color

Current owner

Every historical placement

Timestamp

Previous colors

Replay this pixel

Every pixel tells its own story.

---

# User Profiles

Each student has a profile.

Statistics include:

Pixels placed

Pixels surviving

Favorite color

Longest surviving pixel

Current streak

Contribution heatmap

Semester participation

Lifetime participation

Future badges

---

# Leaderboards

Support:

Most pixels placed

Most surviving pixels

Most active today

Most active this semester

Most active all time

---

# Replay

Every semester supports replay.

Features:

Play

Pause

Timeline scrubber

Variable speed

Jump to timestamp

Replay entire semester from blank canvas to final artwork.

---

# Heatmaps

Automatically generate analytics.

Examples:

Most contested area

Most edited area

Most active hours

Color usage

Activity timeline

Contribution density

---

# Event Sourcing

The event log is the source of truth.

Current canvas is a projection.

Every placement creates an immutable event.

Example:

PixelPlaced

Canvas ID

User ID

Coordinate

Previous color

New color

Timestamp

Never lose history.

Never overwrite events.

Everything derives from the event log.

---

# Database

Tables should include:

Users

Universities

Canvases

Pixels

PixelEvents

Reports

Bans

Cooldowns

ModerationActions

Design for future expansion.

---

# Architecture

Frontend

* Next.js
* React
* TypeScript
* HTML5 Canvas

Backend

* Fastify (preferred) or Hono
* REST API
* WebSockets

Database

* PostgreSQL

ORM

* Prisma

Cache

* Redis

Authentication

* Auth.js

Deployment

* Docker
* CI/CD
* Infrastructure as Code

---

# Realtime

WebSockets.

No polling.

Clients receive pixel updates immediately.

Support thousands of simultaneous connections.

---

# Moderation

Every pixel is attributable.

Admin tools:

Ban user

Temporary suspension

Rollback pixel

Rollback time range

Delete offensive artwork

View reports

Search NetID

Search coordinates

Audit logs

Nothing is permanently deleted.

---

# Anti-Abuse

Rate limiting

Cooldown

Bot detection hooks

Device/IP limits

Reports

Moderator review

Every placement is traceable.

---

# Multi-University Architecture

Do **not** hardcode Rutgers.

Model universities.

Each university has:

Name

Domain

Theme

Authentication provider

Canvas

Moderators

Archives

Example:

Rutgers

Princeton

Michigan

Penn State

Georgia Tech

Rutgers is tenant #1.

---

# API

Design complete REST API.

Examples:

Authentication

Current canvas

Canvas metadata

Pixel placement

Hover data

Pixel history

Replay

Leaderboards

Profiles

Admin

Reports

Statistics

Everything should be documented.

---

# WebSocket Protocol

Define message contracts for:

PixelPlaced

CooldownUpdated

CanvasSnapshot

CanvasReset

UserJoined

UserLeft

AdminRollback

Heartbeat

Reconnect

---

# Rendering

Canvas must be highly optimized.

Requirements:

Avoid rerendering entire canvas.

Batch updates.

Support high zoom.

No blurry scaling.

Efficient dirty-region rendering.

Target smooth performance on laptops and phones.

---

# Mobile

Must work well on phones.

Support:

Pinch zoom

Drag pan

Touch placement

Responsive layout

---

# Non-Goals

No chat

No direct messages

No comments

No following

No marketplace

No cryptocurrency

No NFTs

No machine-generated artwork

No purchasing pixels

Everyone has identical power.

---

# Deliverables

Produce a complete production-ready software specification including:

* High-level architecture
* Folder structure
* Component hierarchy
* Database schema
* Prisma schema
* API specification
* WebSocket protocol
* Authentication flow
* Rendering architecture
* Event sourcing model
* Replay engine
* Moderation architecture
* Cooldown algorithm
* Redis strategy
* Caching strategy
* Performance strategy
* Security model
* Rate limiting
* Testing strategy
* Deployment architecture
* CI/CD pipeline
* Docker setup
* Environment variables
* ER diagrams
* Sequence diagrams
* State diagrams
* Component diagrams
* Milestone-by-milestone implementation plan

---

# Code Quality

Produce code as if this will launch to thousands of Rutgers students.

Requirements:

* Strong typing
* Clean Architecture
* SOLID principles
* Event-driven design
* Modular components
* Comprehensive testing
* Minimal technical debt
* Clear separation of concerns
* Production-grade documentation

Avoid hacks and shortcuts.

Prioritize extensibility, maintainability, and performance.

The final result should feel like a polished, modern web application capable of serving as a reusable platform for collaborative university canvases, with Rutgers as the first deployment.

---

# First Response Requirements

Your first response must not attempt to write all docs.

Your first response must include these sections:

## 1. Repository Strategy

Recommend the repo strategy.

Choose stack structure.

Explain why it is optimized for engineering implementation.

## 2. Repository Tree

Produce a complete intended repository tree.

Include apps, packages, docs, specs, templates, role guides, tests, infrastructure, and scripts.

## 3. Documentation Manifest

List every doc/spec/engineer file to be generated.

For each file include:

* Path
* Purpose
* Owner subsystem
* Dependencies
* Approximate expected length
* Generation order

## 4. Incremental Generation Plan

Define the exact sequence for generating documentation.

Do not generate all documents now.

Define how the user should playbook you to continue.

## 5. engineering Implementation Governance

Define how engineering roles will be constrained during coding.

Include:

* PR size limits
* Test requirements
* Documentation requirements
* Stop conditions
* Regression prevention
* Review protocol

## 6. Architecture Quality Bar

Define what “premium” means for this project.

Be concrete.

## 7. Generate `README.md`

Generate the full initial contents of `README.md`.

Only `README.md`.

Do not generate `docs/PRODUCT.md` yet.

At the end, print:

`NEXT STEP: ask me to continue with docs/PRODUCT.md`

---

# Subsequent Response Requirements

When asked to continue with a specific file, generate that file only.

Each generated file must include:

* Exact file path
* Full file contents
* Purpose
* Dependencies
* Acceptance checklist
* Next recommended file

Do not summarize.

Do not compress.

Do not skip.

Do not drift from the product handoff.

---

# Final Objective

The final result of this multi-response process should be a complete repository architecture and documentation system that enables a high-quality engineering build of the Rutgers collaborative pixel canvas.

The docs should be strong enough that, after they are generated, implementation can proceed milestone-by-milestone with small PRs, clear specs, tests, and no loss of architectural context.

Build the planning system like the product actually matters.

