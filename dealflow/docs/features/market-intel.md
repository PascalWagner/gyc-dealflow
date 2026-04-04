# Market Intel

## What It Does
Market benchmarks, SEC filing trends, and deal analytics dashboard. Admin-only feature showing aggregate marketplace data.

## Routes
- `/app/market-intel` — Market intelligence dashboard
- `/app/deal-flow-stats` — Deal flow statistics

## API Endpoints
- `GET /api/market-intel` — Market benchmarks and trends
- `GET /api/market-data` — Market data aggregation
- `GET /api/sec-edgar` — SEC EDGAR filing lookups

## Acceptance Criteria
- [ ] Shows market benchmarks by asset class
- [ ] Filing trend data displays as charts
- [ ] Deal analytics show aggregate metrics

## QA Checklist

### Happy Path
- [ ] Admin navigates to `/app/market-intel` → data loads
- [ ] Charts render with current data
- [ ] Filters update chart data

### Edge Cases
- [ ] Non-admin user → access denied or redirect
- [ ] No data available → empty state message
- [ ] SEC API timeout → graceful error handling

### Data Integrity
- [ ] Market data matches SEC filing sources
- [ ] Trend data is current (not stale)

## Test Coverage
| Type | File | Count |
|------|------|-------|
| Unit | tests/sec-filing-sync.test.mjs | 2 |
| Gap | No smoke tests | — |

## Dependencies
- Requires: auth (admin role)
