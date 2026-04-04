# Tax Prep

## What It Does
K-1 document tracking for portfolio investments. Helps investors track which K-1s they've received for tax season and which are still outstanding.

## Routes
- `/app/tax-prep` — Tax preparation and K-1 tracking

## API Endpoints
- `GET /api/userdata?type=taxdocs` — Load tax document records
- `POST /api/userdata` (type: `taxdocs`) — Save tax document status

## Acceptance Criteria
- [ ] Shows list of investments with K-1 status (received/pending)
- [ ] User can mark K-1s as received
- [ ] Tracks which tax year each K-1 belongs to

## QA Checklist

### Happy Path
- [ ] Page loads with list of portfolio investments
- [ ] Mark K-1 as received → status updates
- [ ] Correct tax year shown for each investment

### Edge Cases
- [ ] No portfolio investments → appropriate empty state
- [ ] Investment without K-1 → shows "Pending" status

### Data Integrity
- [ ] K-1 status matches API records

## Test Coverage
| Type | File | Count |
|------|------|-------|
| Gap | No tests for tax prep | — |

## Dependencies
- Requires: auth (session), portfolio (investment list)
