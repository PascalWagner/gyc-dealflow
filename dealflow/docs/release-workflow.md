# DealFlow Release Workflow

## Architecture

- **One GitHub repo:** `PascalWagner/dealflow`
- **One Vercel project:** `dealflow`
- **Two branches that matter:**
  - `main` — auto-deploys to **sandbox**
  - `production` — the branch Vercel considers "production"

## Domains

| Environment | URL | Updates when? |
|---|---|---|
| Sandbox | `https://sandbox.growyourcashflow.io` | Automatically on every push to `main` |
| Production | `https://dealflow.growyourcashflow.io` | Only when you manually promote a deployment |

Vercel also creates immutable deployment URLs like
`https://dealflow-abc123-pascal-wagners-projects.vercel.app`.
These never change and are safe to test against.

## Day-to-Day Workflow

1. **Write code** on `main` (or a feature branch that merges into `main`).
2. **Push to `main`** — Vercel automatically builds and deploys to sandbox.
3. **Test at** `https://sandbox.growyourcashflow.io`.
4. **When satisfied**, promote that exact deployment to production:

```bash
npm run promote:sandbox -- <deployment-url>
```

The deployment URL can be found in the Vercel dashboard or in the GitHub
commit status checks.

5. Production is now updated at `https://dealflow.growyourcashflow.io`.

## How Production Stays Safe

- Auto-assign Custom Production Domains is **disabled**.
- Even if someone pushes to the `production` branch, the live production
  domains do not move automatically.
- The only way to update what live users see is to explicitly **promote**
  a deployment (via the Vercel dashboard or `vercel promote`).

## Syncing the Production Branch

After promoting a deployment, you may want to fast-forward the `production`
branch to match `main` so the Git history stays clean:

```bash
git checkout production
git merge main
git push origin production
git checkout main
```

This does NOT trigger a production deploy (auto-assign is off).

## Commands

Promote a tested sandbox deployment to production:

```bash
npm run promote:sandbox -- https://dealflow-abc123-pascal-wagners-projects.vercel.app
```

## Guardrails

- Never force-push to `main` or `production`.
- Always test on sandbox before promoting.
- The `production` branch should only move forward via fast-forward merges
  from `main`, never the other way around.

## Vercel Dashboard Links

- Project: `https://vercel.com/pascal-wagners-projects/dealflow`
- Environments: `https://vercel.com/pascal-wagners-projects/dealflow/settings/environments`

## Note on Vercel Authentication

Vercel Authentication is currently disabled, so `sandbox.growyourcashflow.io`
loads directly without an extra Vercel access prompt.
