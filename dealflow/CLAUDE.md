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
npm run qa:all        # local + deployed
npm run qa:local      # test your current branch (builds, starts server, runs all suites)
npm run qa:deployed   # test the live sandbox after deployment
```

**Local QA** (`qa:local`) builds your code, starts a preview server, and runs:
- Unit tests (deal card state + subscriptions)
- Playwright browser smoke (12 tests)
- Plan wizard browser tests
- Membership settings browser tests

**Deployed QA** (`qa:deployed`) runs against the live sandbox:
- API tests (routes, auth, deals, profile writes)
- Plan wizard browser tests
- Membership settings browser tests

Sandbox URL: `https://sandbox.growyourcashflow.io`

## Architecture

- **Frontend**: SvelteKit (Svelte 5), deployed on Vercel
- **Backend**: Vercel serverless functions in `api/`
- **Database**: Supabase (Postgres)
- **Auth**: Magic link via `/api/auth`, JWT sessions stored in localStorage as `gycUser`
- **API proxy**: Vite proxies `/api` to `dealflow.growyourcashflow.io` in dev

## Key conventions

- Session contract version: `SESSION_VERSION = 3` with `accessTier`, `roleFlags`, `capabilities`
- Deal card events use Svelte 5 `onclick` with `data-card-control="true"` for footer buttons
- Smoke tests mock all API routes to avoid DNS failures against the proxy target
