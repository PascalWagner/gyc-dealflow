# Deal Browser

## What It Does
Main deal discovery interface. Shows deal cards in a filterable grid with pipeline stage tabs (Filter, Review, Connect, Decide, Invested, Skipped). Supports multiple views: card grid, swipe feed, map view, compare view. Free users have a 20-deal daily browsing limit. Members get unlimited access and can request introductions.

## Routes
- `/app/deals` — Deal browser with all views and filters

## API Endpoints
- `GET /api/buybox` — Load user's buy box filter preferences
- `GET /api/member/deals` — Paginated deal list with filters and sorting
- `POST /api/deal-save` — Save deal to pipeline stage
- `POST /api/intro-request` — Request introduction to operator

## Acceptance Criteria
- [ ] Deal cards render with sponsor name, asset class, target yield/IRR, hold period
- [ ] Pipeline tabs show deal counts per stage
- [ ] Clicking a tab filters to that stage's deals
- [ ] Search by company/deal name filters results
- [ ] Asset class, deal type, strategy filters work
- [ ] Sort by newest, oldest, best yield, best IRR
- [ ] Buy box toggle filters to user's preferences
- [ ] Free users see daily limit modal after 20 deals
- [ ] Members can request intros and access data rooms
- [ ] Card footer buttons: View Deal, Save, Request Intro, Move to Stage

## QA Checklist

### Happy Path
- [ ] Page loads with deal cards visible
- [ ] Click "Filter" tab → shows all available deals
- [ ] Click "Review" tab → shows deals in review stage
- [ ] Type in search → results filter live
- [ ] Select asset class filter → only matching deals shown
- [ ] Click "View Deal" → navigates to `/deal/[id]`
- [ ] Click save button → deal appears in Saved tab
- [ ] Sort by "Best Yield" → cards reorder correctly
- [ ] Compare view → select up to 5 deals side-by-side

### Edge Cases
- [ ] No deals match filters → "No deals match your filters" message
- [ ] Empty pipeline stage → stage-specific empty message shown
- [ ] Free user hits 20-deal limit → modal appears with upgrade CTA
- [ ] Network error loading deals → "Couldn't load deals" with warning icon
- [ ] Very long deal names truncate properly on cards
- [ ] Map view with deals that have no coordinates → handled gracefully

### Data Integrity
- [ ] Deal counts per tab match actual deals in that stage
- [ ] Buy box filter matches user's saved preferences from API
- [ ] Save action POSTs correct deal ID and stage to API

## Test Coverage
| Type | File | Count |
|------|------|-------|
| Unit | scripts/test-deal-card-state.mjs | ~15 |
| Gap | No smoke tests for deal browser | — |
| Gap | No E2E for filter + save flow | — |
| Gap | No test for daily limit enforcement | — |

## Dependencies
- Requires: auth (session, tier for gating), onboarding (buy box preferences)
