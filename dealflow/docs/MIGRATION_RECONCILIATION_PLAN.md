# Migration Reconciliation Plan

This plan exists because the repository has real historical schema drift:

- duplicate numeric migration prefixes
- at least one duplicate table-definition lineage (`intro_requests`)
- mixed schema and data-fix concerns sharing the same sequence number

We should not "repair" that by rewriting history in a way that is unsafe for
live environments. The right path is forward-only and explicit.

## What is already in place

- `scripts/audit-migrations.mjs` scans the migration chain
- `supabase/migrations/reconciliation-manifest.json` records the currently
  acknowledged historical debt
- CI now runs migration guardrails in non-strict mode so new drift is blocked
  even before the historical debt is fully reconciled
- `047_reconcile_intro_requests.sql` now reconciles the `intro_requests` table
  forward-only so live and fresh environments can converge on the same shape
- `048_reconcile_onboarding_activity.sql` now reconciles the useful parts of
  the duplicate `031` lineage forward-only without reintroducing the deprecated
  goals -> buy_box write coupling

## Current known debt

### Duplicate numeric prefixes

- `022`: `022_legal_entities.sql`, `022_background_checks.sql`
- `025`: `025_intro_requests.sql`, `025_fix_foundations_asset_class.sql`,
  `025_strategy_cleanup.sql`
- `026`: `026_ir_contact.sql`, `026_market_data_cache.sql`
- `030`: `030_buybox_missing_columns.sql`, `030_invite_links_and_deal_claims.sql`
- `031`: `031_portfolio_plans.sql`,
  `031_activity_columns_and_v1v2_migration.sql`
- `039`: `039_stake_listings.sql`, `039_unified_onboarding.sql`

### Duplicate table ownership

- `public.intro_requests`
  - introduced in `025_intro_requests.sql`
  - expanded again in `042_intro_requests.sql`

## Safe remediation sequence

### 1. Freeze historical edits

- Do not retroactively rewrite production history by mutating old files and
  assuming environments can be replayed from scratch.
- Keep live-environment reconciliation forward-only.

### 2. Create one reconciliation pack

Add a small, uniquely numbered migration pack that:

- reconciles `intro_requests` to its final intended shape idempotently
- reconciles any columns/indexes/policies that fresh environments would need
- documents which older files are historical debt versus canonical final shape

The reconciliation pack should not depend on every environment having applied
the same duplicate-prefix files in the same order.

### 3. Create a clean baseline for fresh environments

Once production and sandbox are reconciled:

- create a new baseline schema snapshot for clean installs
- archive or clearly separate legacy historical migrations
- switch CI to `audit:migrations:strict`

### 4. Re-enable normal migration flow

After the baseline exists:

- every new migration must have one unique prefix
- data backfills should be clearly separated from structural schema migrations
- the manifest should become empty, then removable

## Practical next implementation tasks

1. Decide whether `031_activity_columns_and_v1v2_migration.sql` should remain
   purely historical or be partially superseded by a cleaner backfill strategy.
2. Generate a post-reconciliation baseline schema file for fresh environments.
3. Reconcile the remaining duplicate-prefix lineages (`022`, `025`, `026`,
   `030`, `039`) with either forward-only repair migrations or an archived
   baseline split.
4. Move CI from guardrail mode to strict mode.
