# Plan

## What It Does
Investment deployment plan builder. Multi-step wizard to create a personalized investment strategy with three paths: DIY, Academy, or Fund. Shows market intelligence for selected asset classes, deployment roadmap visualization, and next-best-move recommendations. Free users get a simplified profile version; members get the full multi-step plan.

## Routes
- `/app/plan` — Plan wizard (if incomplete) or plan dashboard (if complete)
- `/app/plan?stage=goal&flow=free` — Wizard entry point from onboarding

## API Endpoints
- `GET /api/userdata?type=plan` — Load plan data
- `POST /api/userdata` (type: `plan`) — Save plan
- `GET /api/plans/market-snapshot` — Market data for selected asset classes

## Acceptance Criteria
- [ ] Incomplete plan shows multi-step wizard
- [ ] Completed plan shows dashboard with roadmap
- [ ] Wizard steps: goal, target, capital, asset classes, deal types, review
- [ ] Market snapshot loads for selected asset classes
- [ ] "Edit Plan" reopens wizard with pre-filled values
- [ ] "Reset Plan" clears all data (requires confirmation)
- [ ] Free users see simplified "Set Up Your Investor Profile" version
- [ ] Members see full "Build Your Plan" with all steps

## QA Checklist

### Happy Path
- [ ] New user → wizard starts at goal step
- [ ] Complete all steps → plan saves to API
- [ ] Plan dashboard shows goal summary, roadmap chart
- [ ] Market intelligence shows available deals by asset class
- [ ] "Edit Plan" → wizard pre-filled → save → dashboard updates
- [ ] "Reset Plan" → confirmation → wizard restarts empty

### Edge Cases
- [ ] Refreshing mid-wizard preserves progress
- [ ] Back button between steps works
- [ ] No deals available for selected asset class → shows 0 count
- [ ] Free user sees limited wizard (profile only, no roadmap)
- [ ] Market snapshot API timeout → graceful fallback

### Data Integrity
- [ ] Plan data in Supabase matches wizard answers
- [ ] Market snapshot data is fresh (not stale cache)
- [ ] Reset actually clears Supabase record

## Test Coverage
| Type | File | Count |
|------|------|-------|
| Unit | tests/plan-wizard-state.test.mjs | 2 |
| QA Script | scripts/qa-plan-wizard.mjs | ~15 scenarios |
| QA Script | scripts/qa-plan-reset.mjs | Reset verification |
| Gap | No Playwright smoke test | — |

## Dependencies
- Requires: auth (session, tier for gating), goals (shared data)
- Used by: dashboard (action cards), settings (plan tab)
