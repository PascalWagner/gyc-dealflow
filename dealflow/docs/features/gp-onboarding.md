# GP Onboarding

## What It Does
Onboarding flow for General Partners (operators/sponsors) to sign up, verify their identity, and agree to platform terms. Currently redirects to the unified onboarding flow at `/onboarding`.

## Routes
- `/gp-onboarding` — Redirect to `/onboarding` with preserved query params
- `/for-operators` — Operator value proposition page

## API Endpoints
- `POST /api/gp-onboarding` — GP signup and verification
- `GET /api/gp-agreement?email={email}` — Check agreement status
- `POST /api/gp-agreement` — Accept GP platform agreement

## Acceptance Criteria
- [ ] `/gp-onboarding` redirects to `/onboarding` preserving all query params
- [ ] `/for-operators` shows GP value proposition
- [ ] GP agreement can be viewed and accepted
- [ ] After onboarding, GP lands on GP Dashboard

## QA Checklist

### Happy Path
- [ ] Visit `/gp-onboarding` → redirected to `/onboarding`
- [ ] Query params preserved through redirect
- [ ] GP completes onboarding → reaches GP Dashboard
- [ ] GP agreement acceptance recorded

### Edge Cases
- [ ] GP visiting LP onboarding → correct flow fork
- [ ] Already onboarded GP → skips to dashboard

### Data Integrity
- [ ] GP agreement status persists in database
- [ ] GP role flag set correctly in session

## Test Coverage
| Type | File | Count |
|------|------|-------|
| Gap | No tests for GP onboarding | — |

## Dependencies
- Requires: auth (session), onboarding (unified flow)
