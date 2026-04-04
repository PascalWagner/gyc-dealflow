# Settings

## What It Does
User profile and account management. Four tabs: Plan (embedded plan content), Investor Profile (name, avatar, accreditation, capital), Membership (tier display, billing, renewal), and Notifications (frequency, alert toggles). Avatar upload supports drag-and-drop. Membership tab shows billing details and renewal options for paid users.

## Routes
- `/app/settings` — Settings page with 4 tabs

## API Endpoints
- `POST /api/auth` (action: `lookup`) — Refresh profile data
- `GET /api/settings/membership` — Load membership and billing info
- `POST /api/userdata` (type: `profile`) — Save profile fields
- `POST /api/upload/avatar` — Upload avatar image
- `POST /api/settings/membership/renewal` — Choose renewal plan
- `GET /api/settings/membership/update-card` — Get card update link

## Acceptance Criteria
- [ ] Profile tab shows name, email (read-only), phone, location
- [ ] Avatar upload via click or drag-and-drop
- [ ] Investor profile fields: accredited status, investable capital, experience
- [ ] Privacy toggle for community activity sharing
- [ ] Membership tab shows current tier and billing status
- [ ] Paid users see renewal options (annual/monthly)
- [ ] Notifications tab has frequency and alert toggles
- [ ] Save button persists changes to API

## QA Checklist

### Happy Path
- [ ] Navigate to `/app/settings` → Profile tab loads
- [ ] Edit name → save → "Saved!" feedback appears
- [ ] Upload avatar → preview updates immediately
- [ ] Switch to Membership tab → shows correct tier
- [ ] Paid user clicks "Annual" renewal → API called
- [ ] Notification frequency change → saves correctly
- [ ] Deal alerts toggle on/off → persists

### Edge Cases
- [ ] No avatar → placeholder with initials shown
- [ ] Free user membership tab → shows Free plan with upgrade CTA
- [ ] Invalid phone format → validation error
- [ ] Avatar upload too large → error message
- [ ] Membership data fails to load → graceful error state
- [ ] Email field is read-only (cannot be edited)

### Data Integrity
- [ ] Profile save POST includes all changed fields
- [ ] Avatar URL stored correctly in profile
- [ ] Membership tier in UI matches API response
- [ ] Notification preferences persist across sessions

## Test Coverage
| Type | File | Count |
|------|------|-------|
| Unit | tests/user-profile-avatar-compat.test.mjs | 3 |
| Unit | tests/subscription-membership.test.mjs | 9 |
| QA Script | scripts/qa-settings-membership.mjs | ~5 scenarios |
| Gap | No smoke test for profile edit flow | — |
| Gap | No test for avatar upload | — |

## Dependencies
- Requires: auth (session), onboarding (plan data for plan tab)
