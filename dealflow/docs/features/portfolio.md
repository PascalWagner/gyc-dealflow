# Portfolio

## What It Does
Investment portfolio tracker. Holdings tab shows all investments with amounts, sponsors, asset classes, and performance metrics. Analysis tab (members only) shows capital deployment path, asset allocation breakdown, risk analysis, and comparison to goals. Supports manual entry and CSV upload. PPM upload is preferred for verified data.

## Routes
- `/app/portfolio` — Portfolio with Holdings and Analysis tabs

## API Endpoints
- `GET /api/userdata?type=portfolio` — Load portfolio records
- `POST /api/userdata` (type: `portfolio`) — Save new investment
- `DELETE /api/userdata` (type: `portfolio`) — Delete investment
- `POST /api/portfolio-upload` — CSV upload for bulk import
- `POST /api/portfolio-extract` — Extract from PPM/documents

## Acceptance Criteria
- [ ] Holdings tab shows all investments with key fields
- [ ] User can add a new investment via intake modal
- [ ] User can edit existing investments
- [ ] User can delete investments
- [ ] CSV upload imports multiple holdings at once
- [ ] Analysis tab shows allocation, risk, and deployment charts (members only)
- [ ] Free users see locked state on Analysis tab with upgrade CTA
- [ ] Empty portfolio shows briefcase icon with "No investments yet" message

## QA Checklist

### Happy Path
- [ ] Navigate to `/app/portfolio` → Holdings tab loads
- [ ] Click "Add Investment" → intake modal opens
- [ ] Fill fields and save → new row appears in holdings table
- [ ] Click row to edit → pre-filled form opens
- [ ] Delete investment → row removed from table
- [ ] Switch to Analysis tab (as member) → charts render
- [ ] CSV upload → new holdings appear after processing

### Edge Cases
- [ ] No holdings → briefcase icon + "No investments yet" message
- [ ] Free user clicks Analysis tab → locked state with "Members only" card
- [ ] Holdings with missing amounts → analysis shows "Add invested amounts to unlock"
- [ ] Duplicate investment names → both render separately
- [ ] Very large portfolio (50+ holdings) → table scrolls properly
- [ ] CSV with malformed data → error message, partial import

### Data Integrity
- [ ] Holdings list matches `/api/userdata?type=portfolio` response
- [ ] New investment POST sends correct payload shape
- [ ] Delete removes record from Supabase
- [ ] Analysis charts use correct portfolio totals

## Test Coverage
| Type | File | Count |
|------|------|-------|
| Gap | No unit tests for portfolio logic | — |
| Gap | No smoke tests for portfolio page | — |
| Gap | No E2E for add/edit/delete flow | — |
| Gap | No test for CSV upload | — |

## Dependencies
- Requires: auth (session, tier for analysis gating), goals (for deployment comparison)
