# DealFlow Release Workflow

This repo uses one canonical local workspace:

- `/Users/pascalwagner/Documents/New project/dealflow`

This Vercel project has two important public entry points:

- Production app: `https://dealflow.growyourcashflow.io`
- Sandbox app: `https://sandbox.growyourcashflow.io`

It also creates immutable Vercel deployment URLs such as:

- `https://dealflow-7980k1q6g-pascal-wagners-projects.vercel.app`

Those immutable deployment URLs are the actual builds. The stable domains point at whichever deployment we choose.

## Plain-English Version

- `sandbox.growyourcashflow.io` is the testing app you use day to day.
- `dealflow.growyourcashflow.io` is the live production app members use.
- The long `dealflow-abc123...vercel.app` URL is the exact build artifact behind the scenes.

Why that long URL matters:

- It never changes after it is created.
- That makes it the safest thing to test and the safest thing to promote.
- `sandbox.growyourcashflow.io` can move from one build to the next over time, but the long deployment URL always points to one exact version.

The simplest way to think about it is:

- test on `sandbox.growyourcashflow.io`
- when the sandbox looks good, promote that exact tested deployment
- then `dealflow.growyourcashflow.io` should receive that same build

## What Each Environment Means

- `production` is the live member-facing app on `dealflow.growyourcashflow.io`
- `sandbox` is the stable pre-production testing environment on `sandbox.growyourcashflow.io`
- Vercel deployment URLs are immutable build artifacts you can inspect and promote

## Expected Workflow

1. Start from a clean local repo.
2. Build and deploy to `sandbox`.
3. Test the feature at `sandbox.growyourcashflow.io`.
4. Promote the exact tested deployment to production.
5. Return local `main` to the production baseline before starting the next feature.

## Commands

Deploy the current clean repo state to sandbox:

```bash
npm run deploy:sandbox
```

Promote a tested sandbox deployment to production:

```bash
npm run promote:sandbox -- https://dealflow-abc123-pascal-wagners-projects.vercel.app
```

## Guardrails

- Never deploy from a dirty worktree.
- Never use multiple local DealFlow clones for active work.
- Keep `main` as the production-matching baseline.
- Do feature work on a fresh branch or worktree from that baseline.
- Test in sandbox before touching production.

## Vercel Pages To Use

- Project dashboard: `https://vercel.com/pascal-wagners-projects/dealflow`
- Current production deployment: open the deployment attached to `dealflow.growyourcashflow.io`
- Current sandbox deployment: open the deployment attached to `sandbox.growyourcashflow.io`

## Important Note About Vercel Authentication

Vercel Authentication is currently disabled for this project, so `sandbox.growyourcashflow.io` should open directly without an extra Vercel access prompt.

If preview protection is ever re-enabled in the future, sandbox may require a Vercel share link or other deployment bypass before the app login page will load.
