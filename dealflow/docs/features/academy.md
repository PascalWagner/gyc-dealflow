# Academy

## What It Does
Academy hub page with two modes: marketing/sales content for non-members (web), and member hub with quick links for members (native app). Web version shows program details, video, testimonials, FAQ, and booking CTAs. Native app member view shows cards linking to Resources, Office Hours, Plan, Deal Flow, Portfolio.

## Routes
- `/app/academy` — Academy hub/marketing page
- `/app/resources` — Resource library (replays, lessons)
- `/app/office-hours` — Office hours calendar
- `/app/case-studies` — Case study repository

## API Endpoints
- No direct API calls on academy page
- Checks `$isMember` and `$isAdmin` stores for gating

## Acceptance Criteria
- [ ] Non-members see full marketing content with booking CTAs
- [ ] Members (native app) see Member Hub with quick-link cards
- [ ] Non-members (native app) see preview cards with CompanionGate
- [ ] "Book Your Deployment Gameplan Call" links to external booking page
- [ ] FAQ items expand/collapse on click
- [ ] Video embeds load and play

## QA Checklist

### Happy Path
- [ ] Non-member visits → marketing page with hero, video, testimonials, FAQ
- [ ] Click "Book Call" CTA → opens external link
- [ ] FAQ items expand/collapse correctly
- [ ] Member on native app → sees hub cards for Resources, Office Hours, etc.
- [ ] Hub card links navigate to correct pages

### Edge Cases
- [ ] YouTube embed fails → graceful fallback
- [ ] Native app non-member → preview cards with gate message
- [ ] Admin user → treated as member, sees hub

### Data Integrity
- [ ] Member status accurately reflects subscription tier

## Test Coverage
| Type | File | Count |
|------|------|-------|
| Gap | No tests for academy page | — |

## Dependencies
- Requires: auth (session, membership status)
