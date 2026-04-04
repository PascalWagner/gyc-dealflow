# Saved Deals

## What It Does
Pipeline view of deals the user has saved or moved to review. Shows deal cards in a grid. Available to all tiers.

## Routes
- `/app/saved` — Saved deals grid

## API Endpoints
- Reads from `$dealStages` store (loaded from `/api/deals`)
- No dedicated API — filters deals where stage is `saved` or `review`

## Acceptance Criteria
- [ ] Saved deals display as cards with sponsor, asset class, yield, hold period
- [ ] "View Deal" button navigates to deal detail page
- [ ] Empty state shows bookmark icon with "No Saved Deals Yet"
- [ ] "Browse Live Deals" CTA links to `/app/deals`

## QA Checklist

### Happy Path
- [ ] Navigate to `/app/saved` with saved deals → cards render
- [ ] Click "View Deal" → navigates to `/deal/[id]`
- [ ] Save a deal from browser → appears on this page

### Edge Cases
- [ ] No saved deals → empty state with bookmark icon
- [ ] Deal removed from saved → disappears from page
- [ ] Many saved deals (20+) → page scrolls properly

### Data Integrity
- [ ] Saved deals match `$dealStages` store state
- [ ] Deal cards show correct data from API

## Test Coverage
| Type | File | Count |
|------|------|-------|
| Gap | No tests for saved deals page | — |

## Dependencies
- Requires: auth (session), deal-browser (save action source)
