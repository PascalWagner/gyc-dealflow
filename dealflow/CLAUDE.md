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
- **Sponsor dedup**: `api/deal-create.js` uses a three-phase sponsor lookup. Phase A: exact ilike match (reuse). Phase B: `pg_trgm` similarity via `find_similar_sponsors` RPC (threshold 0.45) — returns `requiresSponsorConfirmation: true` with matches instead of inserting. Phase C: insert new row. Pass `confirmedNewSponsor: true` from the frontend to skip Phase B after the user confirms. Migration `073_sponsor_dedup.sql` adds the trgm index, unique index on `lower(trim(operator_name))`, and the RPC function.

## CI / CD Pipeline

- **PR smoke workflow** (`.github/workflows/pr-smoke.yml`): triggers on the `deployment_status` GitHub event when Vercel posts a successful preview deployment. Runs the full smoke suite (`--grep "smoke"`) against the Vercel preview URL. Job is named `smoke` — this is the name referenced in GitHub branch protection rules, so it must pass before a PR can merge to main.
- **Impersonation tests** (`.github/workflows/impersonation-tests.yml`): runs on merge to main as a final gate. Tests admin impersonation flows against the live production deployment.
- **Branch protection**: requires the `smoke` job to pass before merging to main.
- **Run smoke tests locally**: `BASE_URL=https://sandbox.growyourcashflow.io npx playwright test --config tests/playwright.config.js --grep "smoke"`
