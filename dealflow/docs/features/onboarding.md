# Onboarding

## What It Does
Multi-step wizard for new investors to set their investment goal (cashflow, tax reduction, or growth), define their buy box, and generate a personalized deployment plan. Three branches: cashflow (most common), tax, growth. Captures baseline passive income, capital available, experience level, and asset class preferences.

## Routes
- `/onboarding` — Legacy entry point, delegates to LegacyOnboardingFlow component
- `/onboarding/plan` — Redirect to `/app/plan` (deprecated route)
- `/app/plan?stage=goal&flow=free` — Active wizard entry point

## API Endpoints
- `POST /api/userdata` (type: `plan`) — Save wizard answers and generated plan
- `GET /api/userdata?type=plan` — Load existing plan data
- `GET /api/userdata?type=goals` — Load investor goals
- `POST /api/userdata` (type: `goals`) — Save goals from wizard

## Acceptance Criteria
- [ ] New user with no plan data sees wizard on first visit
- [ ] User must select exactly one goal (cashflow, tax, growth) — no "all of the above"
- [ ] Wizard captures: goal, target amount, capital, asset class preferences, deal type preferences
- [ ] Completing wizard saves plan to `/api/userdata`
- [ ] After completion, redirects to `/app/plan` with populated deployment roadmap
- [ ] Edit mode reopens wizard with pre-filled values
- [ ] Reset plan clears all data and restarts wizard

## QA Checklist

### Happy Path
- [ ] New user → sees goal selection step
- [ ] Select "Grow Passive Income" → advance to target step
- [ ] Complete all steps → plan saves successfully
- [ ] Plan page shows data matching wizard answers
- [ ] "Edit Plan" reopens wizard with existing values
- [ ] Market snapshot loads for selected asset classes

### Edge Cases
- [ ] Refreshing mid-wizard preserves progress
- [ ] Back button between steps works correctly
- [ ] Selecting 0 asset classes shows validation error
- [ ] Very large target amounts (>$10M) handled correctly
- [ ] Returning user who already has a plan skips to dashboard

### Data Integrity
- [ ] POST to `/api/userdata` contains correct `type: plan` payload
- [ ] Plan data in Supabase matches wizard answers
- [ ] Goals sync between wizard and `/api/userdata?type=goals`

## Test Coverage
| Type | File | Count |
|------|------|-------|
| Unit | tests/plan-wizard-state.test.mjs | 2 |
| Unit | tests/investor-goals.test.mjs | 3 |
| QA Script | scripts/qa-plan-wizard.mjs | ~15 scenarios |
| QA Script | scripts/qa-plan-reset.mjs | Reset verification |
| Gap | No Playwright smoke test for wizard flow | — |

## Dependencies
- Requires: auth (for session)
