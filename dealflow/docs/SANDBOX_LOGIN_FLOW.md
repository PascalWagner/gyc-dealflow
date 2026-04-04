# Sandbox Login Flow

This note tracks the sandbox-only auth contract validated on April 4, 2026.

## Current flow

1. `/login` requests `POST /api/auth` with `action: "magic-link"` and a sandbox `siteUrl`.
2. The magic-link callback returns to `/login` with `type=magiclink`, `access_token`, and `refresh_token`.
3. The callback performs an authenticated `POST /api/auth` lookup and stores the normalized `gycUser` session in local storage.
4. `/app/*` routes restore that session client-side and refresh tokens through `src/lib/stores/auth.js` when possible.

## Sandbox validations on 2026-04-04

- Protected-route navigation to `/app/settings` redirected to `/login?return=%2Fapp%2Fsettings`.
- Magic-link callback redirected back to `/app/settings` on the sandbox host.
- Settings reload stayed authenticated on `/app/settings`.
- The logout copy rendered correctly in the settings UI after login.

## Fixed in this branch

- `POST /api/auth` lookup now requires a valid bearer token and only allows self-lookup unless the requester is an admin.
- Sandbox host normalization now preserves `https://sandbox.growyourcashflow.io`.
- Login callback and settings refresh now send authenticated lookup requests.

## Remaining fragility

- `/app/*` protection still depends on client-side session bootstrap because SSR remains disabled for the app shell.
- Browser coverage for invalid or expired callback tokens is still thin.
