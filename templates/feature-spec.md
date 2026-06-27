<!-- TEMPLATE: copy to specs/features/<feature-name>.md and fill in. Reusable feature spec. -->
# Feature Spec: `<feature-name>`

> Reminders: **contract changes update `@quad/core` + owning docs/specs in the same PR** · **stop, don't guess** on contract/auth/security/cooldown/tenant/event-sourcing/moderation/migration/perf-risk changes. Tenant-neutral (Rutgers Quad = tenant #1 example). Versions → `docs/TECH_BASELINE.md`.

- **Status:** `<draft | ready | implemented>`
- **Owner lane:** `<owner-lane>` · **Milestone:** `<M##>` · **Linked docs:** `<linked-docs>`

## 1. Feature Summary
`<one-paragraph: what this delivers for users>`

## 2. Linked Product Requirements
`<P-* / PRIN-* / NG-* IDs this implements>`

## 3. User Stories
- As a `<actor>`, I want `<capability>` so that `<value>`.

## 4. Scope
`<what is in scope>`

## 5. Non-Goals
`<explicit exclusions; cross-check NON_GOALS.md / anti-backdoor>`

## 6. Affected Packages / Apps
`<apps/web · apps/api · @quad/core · @quad/db · @quad/realtime · @quad/render · @quad/config · @quad/ui>`

## 7. Impacts
- **Data-model impact:** `<tables/projections; → DATABASE.md / migration spec>`
- **API impact:** `<endpoints; → API.md / api-endpoint-spec>`
- **WebSocket impact:** `<messages; → WEBSOCKETS.md / websocket-event-spec>`
- **Security impact:** `<authz/DC*/threats; → SECURITY.md>`
- **Performance impact:** `<budgets B##; → PERFORMANCE.md>`
- **Accessibility impact:** `<keyboard/ARIA; → FRONTEND.md §10>`

## 8. Acceptance Criteria
- [ ] `<testable criterion mapping to a P-AC-* where relevant>`

## 9. Required Tests
`<unit/integration/contract/e2e/security/perf/a11y; → TESTING.md matrix>`

## 10. Rollout / Rollback Notes
`<feature flag? expand/contract? forward-fix; → DEPLOYMENT.md>`

## 11. Regression Risks
`<what could break; mitigations>`

## 12. Stop Conditions
`<which stop conditions apply; what to escalate>`

## 13. Open Questions
`<unresolved; link P-Q-* if applicable>`

## Document Control
- **Path:** `specs/features/<feature-name>.md` · **Depends on:** `<docs>` · **Acceptance:** ☑ all sections filled ☑ IDs linked ☑ tests listed ☑ tenant-neutral.
