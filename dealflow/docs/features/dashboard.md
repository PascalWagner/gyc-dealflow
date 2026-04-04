# Dashboard

## What It Does
Home screen showing investment progress at a glance. Displays goal progress (current vs target passive income), portfolio metrics (active investments, deployed capital), coaching card with contextual guidance, and action items to keep the user engaged. New users see an onboarding prompt instead of the coaching card.

## Routes
- `/app/dashboard` — Main authenticated landing page

## API Endpoints
- `GET /api/userdata?type=goals` — Load investor goals
- `GET /api/userdata?type=portfolio` — Load portfolio holdings
- `GET /api/deals` — Load deals (via store)

## Acceptance Criteria
- [ ] Authenticated users land here after login (default return URL)
- [ ] Goal progress bar shows current/target passive income with percentage
- [ ] Portfolio metrics show active investments count and total deployed capital
- [ ] Action cards suggest next steps based on user state
- [ ] New users (no profile) see onboarding card with "Get Started" CTA
- [ ] Users with a plan see coaching card with contextual guidance

## QA Checklist

### Happy Path
- [ ] Login → lands on dashboard
- [ ] Goal progress bar renders with correct numbers from API
- [ ] Portfolio metrics section shows investment count and capital
- [ ] "Get Started" button navigates to `/app/plan?stage=goal&flow=free`
- [ ] "Browse deals first" link navigates to `/app/deals`
- [ ] Action cards link to correct destinations

### Edge Cases
- [ ] No goals set → onboarding card shown instead of progress
- [ ] No portfolio data → metrics show $0 / 0 investments
- [ ] Goals set but no portfolio → progress bar at 0%
- [ ] Session expires on dashboard → redirects to login

### Data Integrity
- [ ] Goal progress percentage = (current income / target income) * 100
- [ ] Investment count matches portfolio records from API

## Test Coverage
| Type | File | Count |
|------|------|-------|
| Gap | No unit tests | — |
| Gap | No smoke tests | — |
| Gap | No E2E for dashboard rendering | — |

## Dependencies
- Requires: auth (session), onboarding (goals data), portfolio (investment data)
