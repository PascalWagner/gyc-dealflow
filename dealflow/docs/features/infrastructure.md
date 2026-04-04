# Infrastructure

Shared modules that underpin every user-facing feature. Not user-visible, but a silent failure here breaks many features simultaneously. **Read this before touching any file in `src/lib/` or `api/`.**

---

## Modules

### `src/lib/api/client.js` — Centralized API client
Single authenticated fetch wrapper used across the frontend.

| Property | Detail |
|---|---|
| Auth | Calls `getFreshSessionToken`, falls back to stored token |
| Timeout | 6 s (AbortController) |
| Return shape | `{ ok, data, error, status }` — never throws |
| Helpers | `apiGet(url)`, `apiPost(url, body)`, `apiDelete(url, body)` |

**Current callers:** `dealStages.js` (stage save/clear), `dealIntroRequests.js` (intro request submission)

---

### `src/lib/constants/dealEnums.js` — Deal enum option arrays + alias maps
Pure data module — no imports, no side-effects.

| Export type | Count | Examples |
|---|---|---|
| Option arrays | 14 | `DEAL_ASSET_CLASS_OPTIONS`, `DISTRIBUTIONS_OPTIONS`, `STATE_OPTIONS` |
| Alias maps | 9 | `ASSET_CLASS_ALIASES`, `OFFERING_STATUS_ALIASES` |
| Computed | 1 | `HISTORICAL_RETURN_YEARS` (2015 → last full calendar year) |

**Consumers:** `dealReviewSchema.js` (re-exports all for backward compat), `FilterBar.svelte`, deal enrichment pipeline, any API route via `dealReviewSchema.js`

---

### `src/lib/utils/dealReviewSchema.js` — Deal field configuration
2,000+ line module defining every editable deal field. Re-exports all enum arrays from `dealEnums.js` so 10+ import sites stay unchanged.

**Imported by Vercel API routes:** `api/deals/[id].js`, `api/deal-cleanup.js`

---

### `src/lib/stores/deals.js` — Re-export barrel
36-line barrel that re-exports from 5 focused sub-modules. All 16+ import sites work unchanged.

| Sub-module | Owns |
|---|---|
| `dealCatalog.js` | `deals` store, `fetchDeals` |
| `memberDeals.js` | `memberDeals*` stores, `fetchMemberDeals`, pagination |
| `dealStages.js` | `dealStages`, `stageCounts`, `browseTotalCount` |
| `dealUiPrefs.js` | `compareDealIds`, `dealFlowViewMode` |
| `dealConstants.js` | `PIPELINE_STAGES`, `OUTCOME_STAGES`, all stage constants |

---

### `src/lib/utils/primitives.js` — Shared utility primitives
`hasValue`, `firstDefined`, `safeJsonParse`, `normalizeEmail`

---

## ⚠️ Critical Rule: `$lib/` Aliases Don't Work in Vercel Serverless Functions

**This is the #1 gotcha in this codebase.**

Vite resolves `$lib/` and `$app/` at SvelteKit **build time**. Files in `api/*.js` are plain Node.js — they are NOT processed by Vite. If a `src/lib/` file uses a `$lib/` import and is then imported by an `api/` file, Node throws `MODULE_NOT_FOUND` at cold-start, **silently crashing the entire function**.

```js
// ✅ Safe — relative path, works in both Vite and Node.js
import { DEAL_ASSET_CLASS_OPTIONS } from '../constants/dealEnums.js';

// ❌ Breaks Vercel serverless — $lib/ is a Vite-only alias
import { DEAL_ASSET_CLASS_OPTIONS } from '$lib/constants/dealEnums.js';
```

### Files imported by `api/` (must use relative imports only)

| src/lib file | Imported by API route |
|---|---|
| `utils/dealReviewSchema.js` | `api/deals/[id].js`, `api/deal-cleanup.js` |
| `constants/dealEnums.js` | via dealReviewSchema |
| `utils/dealWorkflow.js` | `api/deals/[id].js`, `api/deal-create.js`, `api/deck-upload.js` |
| `utils/reviewFieldState.js` | `api/deals/[id].js`, `api/deal-cleanup.js` |
| `utils/reviewFieldEvidence.js` | `api/deal-cleanup.js` |
| `utils/dealReturns.js` | `api/member/deals/transform.js`, `api/market-intel.js` |
| `utils/dealSponsors.js` | `api/member/deals/transform.js`, `api/member/deals/filters.js` |
| `utils/investing-geography.js` | `api/member/deals/transform.js`, `api/deal-cleanup.js` |
| `utils/investorGoals.js` | `api/buybox.js`, `api/userdata/ghl.js` |
| `utils/dealSubmission.js` | `api/deal-create.js`, `api/deck-upload.js`, `api/deck-submit.js` |
| `auth/access-model.js` | `api/deal-create.js`, `api/deck-upload.js` |
| `subscriptions/subscription-model.js` | `api/_subscriptions.js` |
| `utils/dealflow-contract.js` | `api/gp-deal-performance.js` |
| `onboarding/teamContacts.js` | `api/deal-team-contacts.js`, `api/_management-company-contacts.js` |

### How to detect violations

```bash
# Before shipping, run:
npm run test:unit:all
# The api-serverless-compat.test.mjs suite imports every API-reachable
# src/lib file as plain Node.js and scans for $lib imports.
```

---

## Things That Will Break (and How to Catch Them)

### 1. Adding a `$lib/` import to an API-reachable src/lib file
**Symptom:** Deal editing, deal enrichment, or deal creation silently stops working. Vercel shows 500.
**Detection:** `tests/api-serverless-compat.test.mjs` — fails immediately.

### 2. Renaming or removing a value from an option array in `dealEnums.js`
**Symptom:** FilterBar dropdown option disappears; existing deals with that value display incorrectly; deal enrichment normalization silently drops values.
**Detection:** `tests/deal-enums.test.mjs` — alias integrity tests will fail.

### 3. Changing the `{ ok, data, error, status }` return shape of `api/client.js`
**Symptom:** Stage save reverts immediately on every click; intro requests silently fail.
**Detection:** No unit test yet (auth import chain prevents isolation). Manual test: save a deal stage and verify it persists.

### 4. Removing a re-export from `deals.js` barrel
**Symptom:** Build error — 16+ import sites break across components and routes.
**Detection:** `npm run build` — fails immediately with module error.

### 5. Adding a new src/lib file imported by an `api/` route without documenting it here
**Symptom:** Future developer adds `$lib/` import to that file, breaks production silently.
**Detection:** Update the table above + add a new test to `api-serverless-compat.test.mjs`.

---

## Acceptance Criteria

- [ ] `apiFetch` always returns `{ ok, data, error, status }` — never throws
- [ ] Auth header injected from fresh session token on every API call
- [ ] Requests >6 s aborted with `{ ok: false, error: 'Request timed out' }`
- [ ] All enum option arrays: non-empty strings, no duplicates
- [ ] All alias map values resolve to a value in the corresponding option array
- [ ] `dealReviewSchema.js` re-exports all enum arrays (backward compat for 10+ importers)
- [ ] All API-reachable `src/lib/` files use only relative imports

---

## QA Checklist

### Admin: Deal Edit (tests api/deals/[id])
- [ ] Open Manage Data → Deals → click any deal to open Deal Review
- [ ] Deal data loads (no "Could not load this deal")
- [ ] Edit a field → click Save → confirm the change persists on reload
- [ ] Publish/unpublish toggle works without error

### Member: Deal Stage Save (tests api/client.js + dealStages.js)
- [ ] On /app/deals, click "Save Deal" on a card
- [ ] Deal card updates immediately (optimistic)
- [ ] No error banner appears
- [ ] Navigate to Saved tab — deal appears

### Member: Intro Request (tests api/client.js + dealIntroRequests.js)
- [ ] On a deal card, click "Request Intro"
- [ ] Submit the message form
- [ ] Success state shown (not "Something went wrong")
- [ ] Daily limit works: 3 requests max, 4th shows limit message

### Data Integrity
- [ ] Deal filter dropdowns match `DEAL_ASSET_CLASS_OPTIONS`, `DEAL_TYPE_OPTIONS` etc.
- [ ] Enum aliases: entering "multifamily" normalizes to "Multi-Family"
- [ ] `HISTORICAL_RETURN_YEARS[0]` === 2015, last entry === current year − 1
- [ ] State options contains all 50 US states + DC (51 total)

---

## Test Coverage

| Type | File | What it covers |
|------|------|----------------|
| Unit | `tests/deal-enums.test.mjs` | 21 tests: option array integrity, alias map validity, specific lookups |
| Unit | `tests/api-serverless-compat.test.mjs` | 14 tests: all API-reachable src/lib files load as plain Node.js; no $lib imports |
| Smoke | `tests/deal-review.smoke.spec.ts` | Deal review loads without error; 500 shows friendly message; non-admin redirected |
| Smoke | `tests/session-persona.smoke.spec.ts` | Stage save 500 → friendly notice; mobile footer → no error banner |
| Gap | — | No unit test for `apiFetch` error shape (auth→supabase dep chain prevents isolation) |
| Gap | — | No test for intro request happy path or error path end-to-end |
| Gap | — | No test for deal-cleanup.js serverless compat at runtime (file is scan-only) |

---

## Dependencies

- `auth.js` — token resolution for `api/client.js` (frontend only)
- `userScopedState.js` — impersonation payload wrapping for stage sync
- Supabase — all API routes use `getAdminClient()` from `api/_supabase.js`
