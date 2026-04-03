Run the full QA pipeline: local code first, then deployed sandbox.

## Phase 1: Local QA (your current branch)

Source NVM and run:

```
export NVM_DIR="$HOME/.nvm" ; . "$NVM_DIR/nvm.sh"
cd "/Users/pascalwagner/Documents/New project/dealflow-sandbox-integration-all-features/dealflow"
npm run qa:local
```

This builds the app, starts a local preview server, and runs:
1. Unit tests (deal card state + subscriptions)
2. Playwright browser smoke tests (12 tests)
3. Plan wizard browser tests against local server
4. Membership settings browser tests against local server

The server is started and stopped automatically.

## Phase 2: Deployed QA (sandbox)

After local passes, run against the live sandbox:

```
npm run qa:deployed
```

This runs against https://sandbox.growyourcashflow.io:
1. Sandbox live API tests (routes, auth, buy box, goals, deals)
2. Sandbox write tests (profile, avatar)
3. Plan wizard browser tests against sandbox
4. Membership settings browser tests against sandbox

## Reporting

After each phase, report pass/fail clearly. If any suite fails, show the failure output and continue running remaining suites. At the end, give a summary showing which suites passed in each phase.

## Run everything

To run both phases in one shot:

```
npm run qa:all
```

## Important

- Do NOT skip any suite.
- Local QA tests YOUR CODE before deployment.
- Deployed QA verifies the sandbox matches what was deployed.
- If Playwright browsers fail to launch, report the error clearly.
