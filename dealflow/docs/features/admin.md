# Admin

## What It Does
Admin dashboard for platform management. Tabs: overview (north star metrics, growth), users (search, tier distribution), schema (database tables), network (intro requests, integrations), feedback, transactions, CTA analytics. Admin-only access.

## Routes
- `/app/admin` — Admin dashboard
- `/app/admin/manage` — User management
- `/app/admin/outreach` — Outreach campaigns

## API Endpoints
- `POST /api/admin-manage` — All admin actions:
  - `growth-metrics` — North star, marketplace, completeness, growth rates
  - `user-metrics` — User tier distribution
  - `list-feedback` — Feedback items
  - `network-metrics` — Intro stats, integrations, moat metrics
  - `table-counts` — Database table row counts
  - `transaction-logs` — Transaction history
  - `cta-analytics` — CTA conversion data
  - `ghl-sync` — Trigger GHL sync
- `GET /api/admin-analytics` — Analytics data
- `GET /api/admin-saas-metrics` — SaaS metrics
- `GET /api/users` — User search for impersonation

## Acceptance Criteria
- [ ] Non-admin users redirected to `/app/deals`
- [ ] Overview tab shows north star metrics, growth charts, recommendations
- [ ] Users tab has search and tier filtering
- [ ] Schema tab shows database tables with row counts
- [ ] Network tab shows integration statuses
- [ ] GHL Sync button triggers sync and shows result
- [ ] Review tools toggle shows/hides onboarding review tools

## QA Checklist

### Happy Path
- [ ] Admin navigates to `/app/admin` → overview loads
- [ ] Each tab loads data on first click
- [ ] User search filters correctly
- [ ] GHL Sync completes with success message
- [ ] CTA analytics date range buttons filter data

### Edge Cases
- [ ] Non-admin → redirected to `/app/deals`
- [ ] API errors → graceful error messages per tab
- [ ] Schema tab falls back to hardcoded data if API fails
- [ ] Large user list → search remains responsive

### Data Integrity
- [ ] Metrics match actual database state
- [ ] User counts by tier are accurate
- [ ] Integration statuses reflect real connectivity

## Test Coverage
| Type | File | Count |
|------|------|-------|
| Gap | No tests for admin dashboard | — |

## Dependencies
- Requires: auth (admin role)
