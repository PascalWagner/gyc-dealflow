# Architecture Remediation Plan

This is the current recommended sequence for moving the codebase from
high-velocity but drift-prone into a safer, more durable shape.

## Phase 1: Trust boundaries

- Remove all unverified token fallbacks.
- Require verified bearer tokens for any user-specific mutation path.
- Refresh sessions on the client before calling sensitive admin APIs.
- Centralize required server env validation so broken deployments fail loudly.

## Phase 2: Schema discipline

- Freeze new schema work until ownership decisions are explicit.
- Audit migration collisions and replay hazards.
- Track known historical debt in a checked-in reconciliation manifest.
- Run migration guardrails in CI so new drift is blocked before full repair.
- Reconcile live environments with one forward-only migration pack.
- Create a clean future baseline after reconciliation.

## Phase 3: Data ownership cleanup

- Make `user_profiles`, `user_goals`, `user_buy_box`, and
  `user_portfolio_plans` non-overlapping by responsibility.
- Reduce GHL to a projection layer for app-owned state.
- Remove browser-storage ownership assumptions.

## Phase 4: Runtime contract cleanup

- Normalize one pipeline stage vocabulary across DB, APIs, UI, and analytics.
- Consolidate sponsor ownership around `deal_sponsors`.
- Add runtime validation for request payloads and persistence boundaries.

## Phase 5: Modularity

- Split `api/admin-manage.js` into domain modules.
- Split `api/userdata.js` into resource-specific handlers.
- Extract domain logic out of giant route files such as:
  - `src/routes/deal/[id]/+page.svelte`
  - `src/routes/app/deals/+page.svelte`
  - `src/routes/gp-dashboard/+page.svelte`

## Phase 6: Quality gates

- Add migration auditing to CI.
- Add auth integration coverage.
- Add contract tests for public APIs.
- Add integration coverage for sync-heavy routes.
- Add structured operational monitoring for auth and sync failures.
