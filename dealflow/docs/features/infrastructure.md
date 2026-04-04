# Infrastructure

Shared modules that underpin every user-facing feature. Not user-visible, but a silent failure here breaks many features simultaneously.

## Modules

### `src/lib/api/client.js` — Centralized API client
Single `apiFetch` wrapper used by all authenticated API calls. Provides:
- Auth header injection (calls `getFreshSessionToken`, falls back to stored token)
- AbortController timeout (default 6 s)
- Normalized return shape: `{ ok, data, error, status }` — callers never need to `try/catch` or `.json()`
- `apiGet`, `apiPost`, `apiDelete` convenience wrappers

**Callers:** `dealStages.js` (stage save/delete), `dealIntroRequests.js` (intro submission)

### `src/lib/constants/dealEnums.js` — Deal enum option arrays + alias maps
Pure data module (no imports, no side-effects). Contains:
- 14 option arrays: `DEAL_ASSET_CLASS_OPTIONS`, `DEAL_TYPE_OPTIONS`, `OFFERING_STATUS_OPTIONS`, `DISTRIBUTIONS_OPTIONS`, etc.
- 9 alias maps for each field (loose string input → canonical option value)
- `HISTORICAL_RETURN_YEARS` (2015 → last full calendar year)
- `STATE_OPTIONS` (51 US states + DC)

**Consumers:** `dealReviewSchema.js` (re-exports all for backward compat), `FilterBar.svelte`, deal enrichment pipeline

### `src/lib/stores/deals.js` — Re-export barrel
36-line file that re-exports from 5 focused sub-modules. All 16+ import sites continue to work unchanged.

| Sub-module | Exports |
|---|---|
| `dealCatalog.js` | `deals`, `dealsLoading`, `dealsError`, `fetchDeals` |
| `memberDeals.js` | `memberDeals*` stores, `fetchMemberDeals`, `queryMemberDeals`, `loadMoreMemberDeals` |
| `dealStages.js` | `dealStages`, `stageCounts`, `hydrate*`, `browseTotalCount`, `adjustBrowseCount` |
| `dealUiPrefs.js` | `compareDealIds`, `decisionCompareIds`, `dealFlowViewMode` |
| `dealConstants.js` | `PIPELINE_STAGES`, `OUTCOME_STAGES`, constants |

### `src/lib/utils/primitives.js` — Shared utility primitives
`hasValue`, `firstDefined`, `safeJsonParse`, `normalizeEmail` — used across auth, storage, and deal transforms.

## Acceptance Criteria
- [ ] `apiFetch` always returns `{ ok, data, error, status }` — never throws
- [ ] Auth header is injected automatically from the stored session token
- [ ] Requests exceeding 6 s are aborted and return `{ ok: false, error: 'Request timed out' }`
- [ ] All enum option arrays contain only non-empty strings with no duplicates
- [ ] All alias map values resolve to a value present in the corresponding option array
- [ ] `dealReviewSchema.js` re-exports all enum arrays (backward compat for existing importers)

## QA Checklist

### Happy Path
- [ ] Save Deal button click → `POST /api/userdata` with correct body, no error banner
- [ ] Intro request → `POST /api/intro-request` with correct body, success state shown
- [ ] Deal filter dropdown options match `DEAL_ASSET_CLASS_OPTIONS`, `DEAL_TYPE_OPTIONS` etc.

### Edge Cases
- [ ] Server returns 500 on stage save → friendly notice shown, stage reverted in UI
- [ ] Network timeout on stage save → friendly notice shown, stage reverted
- [ ] Missing session token → request made, 401 returned, stage reverted (not silent no-op)

### Data Integrity
- [ ] `dealEnums.js` alias maps: every alias resolves to a value in its option array
- [ ] `dealEnums.js` option arrays: no duplicates, all non-empty strings
- [ ] `HISTORICAL_RETURN_YEARS[0] === 2015`, last entry is `currentYear - 1`

## Test Coverage
| Type | File | What it covers |
|------|------|----------------|
| Unit | tests/deal-enums.test.mjs | 21 tests: option array integrity, alias map validity, common alias lookups |
| Smoke | tests/session-persona.smoke.spec.ts | Stage save 500 error → friendly notice |
| Smoke | tests/session-persona.smoke.spec.ts | Mobile footer action → no error banner |
| Gap | — | No unit test for `apiFetch` (auth.js → supabase dep chain prevents isolation) |
| Gap | — | No test for intro request happy path or error path |

## Dependencies
- `auth.js` — token resolution for `api/client.js`
- `userScopedState.js` — impersonation payload wrapping for stage sync
