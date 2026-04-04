# Deal Detail

## What It Does
Full deal page with tabs for overview, analysis, risks, returns. Shows operator info, key investment terms, DD checklist, similar deals, and social proof. Members get advanced analysis (stress tests, historical returns, background checks). Public viewers see limited data with signup prompts. GPs who own the deal can edit it.

## Routes
- `/deal/[id]` — Individual deal detail page

## API Endpoints
- `GET /api/deals?id={dealId}` — Fetch deal data
- `GET /api/background-check?managementCompanyId={id}` — Operator background check (members only)
- `GET /api/deal-stats?dealId={dealId}` — Social proof (save/review counts)
- `GET /api/deals?managementCompanyId={id}` — Sponsor's other deals
- `GET /api/ddchecklist?dealId={dealId}` — Due diligence checklist
- `POST /api/deal-save` — Save deal to pipeline
- `POST /api/intro-request` — Request introduction
- `POST /api/invite` — Invite co-investor
- `POST /api/deal-claim` — GP claims deal

## Acceptance Criteria
- [ ] Deal loads with hero showing operator, IRR, preferred return, minimum investment
- [ ] Tab navigation works: overview, analysis, risks, returns
- [ ] DD checklist shows checkable items per deal
- [ ] "Save Deal" adds deal to user's pipeline
- [ ] "Request Intro" opens modal for operator introduction
- [ ] Similar deals carousel shows comparable offerings
- [ ] Public viewers see limited data with signup prompt
- [ ] Members see background check, stress tests, historical returns
- [ ] Deal status badge shows current state (open, closed, fully funded)

## QA Checklist

### Happy Path
- [ ] Navigate to `/deal/{valid-id}` → deal loads with hero section
- [ ] Click Overview tab → shows property map, key terms, summary
- [ ] Click Analysis tab → shows returns chart and projections
- [ ] Click "Save Deal" → button state changes, deal appears in saved
- [ ] Click "Request Intro" → modal opens with operator name
- [ ] DD checklist items can be checked/unchecked
- [ ] Similar deals section shows related offerings

### Edge Cases
- [ ] Invalid deal ID → "Deal not found" error message
- [ ] Deal with no images → placeholder shown
- [ ] Deal with multiple share classes → class selector dropdown works
- [ ] Stale deal (no updates) → warning badge shown
- [ ] Public user clicking "Save" → redirected to login
- [ ] Very long deal descriptions don't break layout

### Data Integrity
- [ ] Deal data matches API response
- [ ] DD checklist state persists across page refresh
- [ ] Social proof counts match deal-stats API
- [ ] Save action creates correct record in deal_stages table

## Test Coverage
| Type | File | Count |
|------|------|-------|
| Smoke | tests/deal-review-provenance.smoke.spec.ts | 4 |
| Unit | tests/deal-page-trust-signals.test.mjs | 5 |
| Unit | tests/deal-analysis.test.mjs | 2 |
| Unit | tests/deal-comparables.test.mjs | 4 |
| Gap | No E2E for save/intro request flow | — |
| Gap | No test for public vs member view | — |

## Dependencies
- Requires: auth (session, tier for gating), deal-browser (navigation source)
