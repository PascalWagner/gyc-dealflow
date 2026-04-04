# Docs Overview

This folder holds the running product, architecture, and workflow notes for the
Dealflow app.

## Useful starting points

- `SANDBOX_LOGIN_FLOW.md`
- `ONBOARDING_AND_INTAKE_SPEC.md`
- `PRODUCT_ROADMAP_JTBD.md`
- `ARCHITECTURE_REMEDIATION_PLAN.md`
- `MIGRATION_RECONCILIATION_PLAN.md`

## Future feature notes

### SEC fundraising analytics

Keep this as a future feature, not an immediate build:

- use historical `sec_filings` / Form D amendment data to estimate fundraising
  velocity
- show LP-facing signals such as:
  - days since first sale
  - amount sold over time
  - amendment cadence
  - projected time to close / fill when the data is strong enough
  - operator-level average close speed across prior raises

### SEC search decision tree

The intended SEC matching order is:

1. search by the exact deal name first
2. if that returns no strong match, search by issuer / legal entity extracted
   from the PPM
3. if that is still weak, fall back to sponsor / operator queries
4. when multiple plausible filings remain, show the reviewer the candidate list
   and require a manual pick instead of auto-confirming

The goal is to avoid false positives while still using the PPM's legal-entity
data as the strongest fallback signal.
