# Supabase Migrations

This directory currently contains a known set of historical migration-collision
debt. That debt is tracked in
[`reconciliation-manifest.json`](./reconciliation-manifest.json).

## Current rule

- Do not reuse an existing numeric prefix.
- Do not edit historical migrations in-place to "fix" production drift.
- Treat the manifest as the source of truth for known schema-history debt until
  reconciliation is complete.

## While reconciliation is in progress

- New schema work should pause unless it is critical.
- If a critical schema change must land, use the next unused prefix above the
  current max file and update the manifest only if new historical debt is
  introduced.
- Prefer forward-only reconcile migrations over retroactive edits to old files.

## Audit commands

- `npm run audit:migrations`
  - guardrail mode
  - passes when only the tracked debt exists
  - fails on new/unexpected migration drift
- `npm run audit:migrations:strict`
  - fails while any tracked debt still exists
  - use this when actively working on reconciliation

## Reconciliation objective

The end state should be:

- one unique sequence number per historical migration
- no duplicate `CREATE TABLE` ownership
- one forward-only reconciliation pack for live environments
- then a clean baseline for fresh environments
