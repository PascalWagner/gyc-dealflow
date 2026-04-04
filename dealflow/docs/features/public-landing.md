# Public Landing

## What It Does
Marketing landing page for new visitors. Hero section with email signup form, investor showcase animation, problem/solution sections, comparison cards, testimonials (text and video), features comparison, FAQ, and footer. Successful email entry triggers magic link login flow.

## Routes
- `/landing` — Main landing page
- `/landing-b` — A/B test variant

## API Endpoints
- `POST /api/auth` (action: `magic-link`) — Email signup triggers login flow

## Acceptance Criteria
- [ ] Page loads without authentication
- [ ] Hero email form sends magic link on submit
- [ ] "Sent" confirmation appears after email submission
- [ ] Navigation links scroll to page sections
- [ ] "Log in" link navigates to `/login`
- [ ] FAQ items expand/collapse on click
- [ ] Video testimonials load and play
- [ ] Responsive: desktop (2-col), tablet/mobile (1-col, showcase hidden)
- [ ] "I am an operator" links to `/for-operators`

## QA Checklist

### Happy Path
- [ ] Visit `/landing` → full page renders
- [ ] Enter email → click "Send login link" → "Check your email" message
- [ ] Click nav link → scrolls to section
- [ ] FAQ expand/collapse works
- [ ] Mobile view hides showcase, shows form only

### Edge Cases
- [ ] Invalid email → "Please enter a valid email" error
- [ ] API error → "Something went wrong" message
- [ ] Sandbox bypass → auto-logs in without email
- [ ] Already logged-in user → should still see landing (or redirect?)

### Data Integrity
- [ ] Magic link email actually sent (check inbox)
- [ ] Return URL set to `/app/dashboard`

## Test Coverage
| Type | File | Count |
|------|------|-------|
| Gap | No tests for landing page | — |

## Dependencies
- None (public entry point)
