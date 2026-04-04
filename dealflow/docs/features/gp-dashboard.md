# GP Dashboard

## What It Does
General Partner (operator) control panel. Shows deal performance, investor engagement, settings for IR contact and calendar, and platform agreement status. Tabs: overview (KPIs, deal table), users, network, feedback, CTA analytics. GPs can only see their own company's data.

## Routes
- `/gp-dashboard` — GP management interface

## API Endpoints
- `POST /api/admin-manage` (various actions) — Growth metrics, user metrics, feedback, network, transactions, CTA analytics, GHL sync
- `GET /api/deals` — GP's deals
- `PATCH /api/management-companies/{id}/settings` — Update GP settings (calendar URL, IR contact, authorized emails)
- `GET /api/gp-analytics?companyId={id}` — Analytics data
- `GET /api/gp-investor-insights?companyId={id}` — Investor engagement
- `GET /api/gp-agreement?email={email}` — Agreement status

## Acceptance Criteria
- [ ] Non-GP users redirected to `/app/deals`
- [ ] Overview tab shows KPI cards, deal table, weekly activity chart
- [ ] Deal table sortable by name, completeness, status, asset class
- [ ] Settings panel allows calendar URL, IR contact, authorized emails
- [ ] GP can only see their own company's deals and data
- [ ] GP Agreement signing flow works

## QA Checklist

### Happy Path
- [ ] GP user lands on dashboard → overview tab loads
- [ ] KPI cards show total investors, submissions, engagement
- [ ] Deal table lists GP's deals with correct data
- [ ] Click deal → navigates to `/deal/[id]`
- [ ] Update calendar URL → saves → success feedback
- [ ] Add authorized email → appears in list
- [ ] Sign GP Agreement → modal flow completes

### Edge Cases
- [ ] Non-GP user → redirected away
- [ ] GP with no deals → "No deals uploaded yet" message
- [ ] Settings save fails → error toast
- [ ] No investor activity → empty activity section

### Data Integrity
- [ ] Deal data scoped to GP's management company
- [ ] Settings changes persist in database
- [ ] Agreement status reflects actual signing state

## Test Coverage
| Type | File | Count |
|------|------|-------|
| Gap | No tests for GP dashboard | — |

## Dependencies
- Requires: auth (session, GP role), gp-onboarding (agreement)
