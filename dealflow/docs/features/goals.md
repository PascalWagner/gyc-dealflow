# Goals

## What It Does
Investment goal wizard and dashboard. Users set a primary goal (passive income, tax reduction, or wealth growth), target amounts, capital available, and timeline. After setup, shows a goal dashboard with progress, metrics, scenario modeling (conservative/moderate/aggressive), and a year-by-year deployment roadmap. Available to all tiers.

## Routes
- `/app/goals` — Goal wizard (if no goals) or goal dashboard (if goals exist)

## API Endpoints
- `GET /api/userdata?type=goals` — Load existing goals
- `POST /api/userdata` (type: `goals`) — Save goals

## Acceptance Criteria
- [ ] New user sees goal wizard with form fields
- [ ] User must select exactly one primary goal — no "all of the above"
- [ ] Completing wizard shows goal dashboard with progress
- [ ] Progress bar shows current income / target income
- [ ] Scenario modeling shows conservative (6%), moderate (8%), aggressive (10%) paths
- [ ] Year-by-year roadmap shows deployment schedule
- [ ] "Edit Goals" button reopens wizard with pre-filled values

## QA Checklist

### Happy Path
- [ ] No goals → wizard form shown with default values
- [ ] Select "Grow Passive Income" → form shows income-specific fields
- [ ] Fill all fields → click "Build My Plan" → dashboard appears
- [ ] Progress bar percentage is correct
- [ ] Scenario rows show capital needed and deal combinations
- [ ] Year-by-year roadmap renders with correct intervals
- [ ] "Edit Goals" → wizard pre-filled → save → dashboard updates

### Edge Cases
- [ ] $0 target income → validation prevents submission
- [ ] Very high target ($5M+/yr) → scenarios still calculate
- [ ] Tax goal selected → tax-specific card appears
- [ ] Changing goal type clears irrelevant fields
- [ ] Page refresh preserves goals (localStorage + API)

### Data Integrity
- [ ] Goal data persists in both localStorage and Supabase
- [ ] Progress percentage = current / target * 100
- [ ] Scenario capital = target / yield_rate for each scenario

## Test Coverage
| Type | File | Count |
|------|------|-------|
| Unit | tests/investor-goals.test.mjs | 3 |
| Unit | tests/userdata-ghl-goals.test.mjs | 1 |
| Gap | No smoke test for goal wizard | — |
| Gap | No E2E for edit flow | — |

## Dependencies
- Requires: auth (session)
- Used by: dashboard (goal progress), plan (deployment roadmap)
