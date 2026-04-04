# Authentication

## What It Does
Magic link email login with OTP fallback. Users enter their email, receive a login link, and are authenticated via JWT stored in localStorage. Supports sandbox bypass for testing, session refresh, and admin impersonation.

## Routes
- `/login` — Email entry, OTP verification, redirect to dashboard

## API Endpoints
- `POST /api/auth` (action: `magic-link`) — Sends login email
- `POST /api/auth` (action: `verify-otp`) — Verifies 6-digit code
- `POST /api/auth` (action: `send-otp`) — Resends OTP code
- `POST /api/auth` (action: `lookup`) — Legacy magic link lookup
- `POST /api/auth` (action: `refresh`) — Refreshes expired token

## Acceptance Criteria
- [ ] User can enter email and receive a magic link
- [ ] User can enter 6-digit OTP code to authenticate
- [ ] Successful login stores JWT session in localStorage as `gycUser`
- [ ] Session includes `accessTier`, `roleFlags`, `capabilities`
- [ ] Expired tokens trigger refresh flow automatically
- [ ] Logout clears `gycUser` and redirects to `/login`
- [ ] Unauthenticated access to `/app/*` redirects to `/login`
- [ ] `?return=/path` query param redirects after login (only paths starting with `/`)
- [ ] Sandbox bypass auto-logs in when API returns `bypass: true`

## QA Checklist

### Happy Path
- [ ] Enter valid email → "Check your email" message appears
- [ ] Click magic link in email → lands on `/app/dashboard`
- [ ] Enter 6-digit OTP → authenticates and redirects
- [ ] "Resend code" button sends new OTP
- [ ] "Use a different email" resets the form
- [ ] Session persists across page refresh
- [ ] Logout → localStorage cleared → redirected to `/login`

### Edge Cases
- [ ] Invalid email (no @) shows "Please enter a valid email"
- [ ] Wrong OTP code shows error, allows retry
- [ ] Expired magic link shows "Your login link expired" with OTP fallback
- [ ] 15-second timeout shows "Request timed out. Please try again."
- [ ] Back button after OTP entry doesn't break state
- [ ] Multiple rapid submissions don't send duplicate emails
- [ ] `?return=/app/portfolio` redirects to portfolio after login

### Data Integrity
- [ ] `gycUser` in localStorage has valid JWT structure
- [ ] Session version matches `SESSION_VERSION = 3`
- [ ] `accessTier` reflects correct membership level
- [ ] Admin impersonation key cleared on fresh login

## Test Coverage
| Type | File | Count |
|------|------|-------|
| Smoke | tests/session-persona.smoke.spec.ts | 8 |
| Unit | tests/auth-bypass-env.test.mjs | 2 |
| Gap | No E2E for full login→redirect flow | — |
| Gap | No test for token refresh | — |
| Gap | No test for OTP fallback path | — |

## Dependencies
- None (entry point for all authenticated features)
