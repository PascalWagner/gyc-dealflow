# Dealflow

SvelteKit app for GYC's real estate investment deal marketplace.

## Dev

```bash
npm run dev        # local dev server
npm run build      # production build
npm run preview    # preview production build locally
```

## QA

NVM must be sourced first: `export NVM_DIR="$HOME/.nvm" ; . "$NVM_DIR/nvm.sh"`

Run full QA with `/qa` slash command or:

```bash
npm run qa:all
```

Individual suites:

| Command | What |
|---------|------|
| `npm run test:unit` | Unit tests (deal card state + subscriptions) |
| `npm run test:smoke` | Playwright browser smoke tests (build first) |
| `npm run qa:sandbox:full` | Live sandbox API tests (read + write) |
| `npm run qa:sandbox:plan` | Plan wizard browser tests against sandbox |
| `npm run qa:sandbox:membership` | Membership settings browser tests against sandbox |

Sandbox URL: `https://sandbox.growyourcashflow.io`

## Architecture

- **Frontend**: SvelteKit (Svelte 5), deployed on Vercel
- **Backend**: Vercel serverless functions in `api/`
- **Database**: Supabase (Postgres)
- **Auth**: Magic link via `/api/auth`, JWT sessions stored in localStorage as `gycUser`
- **API proxy**: Vite proxies `/api` to `deals.growyourcashflow.io` in dev

## Key conventions

- Session contract version: `SESSION_VERSION = 3` with `accessTier`, `roleFlags`, `capabilities`
- Deal card events use Svelte 5 `onclick` with `data-card-control="true"` for footer buttons
- Smoke tests mock all API routes to avoid DNS failures against the proxy target
