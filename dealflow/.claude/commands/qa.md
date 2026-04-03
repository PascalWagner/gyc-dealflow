Run the full QA suite for the dealflow app. This tests everything end-to-end.

## Steps

1. Source NVM: `export NVM_DIR="$HOME/.nvm" ; . "$NVM_DIR/nvm.sh"`
2. `cd` to the dealflow repo at `/Users/pascalwagner/Documents/New project/dealflow-sandbox-integration-all-features/dealflow`
3. Run each suite sequentially, reporting results as you go:

### Unit tests
```
npm run test:unit
```
Runs deal-card-state (7 tests) and subscription-membership (9 tests).

### Playwright browser smoke tests
```
npm run build && npm run test:smoke
```
Requires a fresh build first. Runs 12 browser tests covering session, impersonation, operators, deal cards, deal review provenance, lending hero, and mobile swipe.

### Sandbox live API tests
```
npm run qa:sandbox:full
```
Tests routes, auth, buy box, goals, deal data, profile writes, and avatar upload against https://sandbox.growyourcashflow.io.

### Plan wizard browser tests
```
npm run qa:sandbox:plan
```
Tests all plan wizard branches (cashflow/growth/tax), onboarding, row overrides, drag-and-drop, and saved-answer hydration against the live sandbox.

### Membership settings browser tests
```
npm run qa:sandbox:membership
```
Tests lifetime, renewal, and manage membership scenarios against the live sandbox.

## Reporting

After each suite, report pass/fail clearly. If any suite fails, show the specific failure output and continue running the remaining suites. At the end, give a summary table of all suites with pass/fail status.

## Important

- Do NOT skip any suite.
- If Playwright browsers fail to launch, report the error but still run the non-browser suites (sandbox live, unit tests).
- The sandbox URL is https://sandbox.growyourcashflow.io — do not change it.
