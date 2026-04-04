# SEC Filings

SEC Form D / D/A data fetched from EDGAR and stored in `sec_filings`. The latest filing's totals (`total_amount_sold`, `total_investors`) are pushed to `opportunities` and displayed on deal cards and the Deal Detail legitimacy bar.

**Read this before touching `api/_sec-edgar.js`, `api/sec-verification.js`, `scripts/dlp-sec-backfill.mjs`, or `scripts/refresh-sec-filings.mjs`.**

---

## The `is_latest_amendment` Invariant

**This is the most important concept in this module.**

The `sec_filings` table stores every historical Form D filing for a CIK (company). Exactly **one** row per CIK must have `is_latest_amendment = true` — the filing with the most recent `filing_date`. This is the row that gets pushed to `opportunities.total_amount_sold` and `total_investors`.

### What went wrong (April 2026)

`fetchAllFilingsForCik` looped over all filings and called `upsertParsedSecFiling` for each one. `upsertParsedSecFiling` was written for single-filing use: it cleared all flags, then set the current filing to `true`. In a loop:

- Filing 1 (oldest, 2018): set to `true` ✓
- Filing 2: clears filing 1, set to `true` ✓
- ...
- Filing N (newest, 2024): clears all, set to `true` ✓ ← correct so far

But EDGAR EFTS returns hits in **newest-first order**. So the loop runs oldest-last:

- Filing N (newest): set to `true` ✓
- Filing N-1: clears newest, set to `true` ← wrong
- ...
- Filing 1 (oldest, 2018): set to `true` ← final state, wrong

DLP Lending Fund showed $13.1M / 73 investors (2018 filing) instead of ~$1.5B+ / 1,500+ (2024 filing).

### The fix

`upsertParsedSecFiling` now accepts `isLatest: boolean` (default `true` for backward compat).

- **Single-filing path** (`fetchAndStoreSecFiling`, `sec-verification.js`): `isLatest: true` — keeps existing "clear all, set this one" behavior. Correct because there's only one filing being set.
- **Bulk path** (`fetchAllFilingsForCik`): `isLatest: false` — stores all rows without touching the flag. After the loop, calls `markLatestFilingForCik` once.

`markLatestFilingForCik(cik, supabase)`:
1. Queries for the row with the newest `filing_date` (not null)
2. Clears ALL `is_latest_amendment` flags for that CIK
3. Sets only the newest row to `true`
4. Returns the row that was marked

This is enforced at the DB level by a unique partial index:
```sql
CREATE UNIQUE INDEX idx_one_latest_per_cik
  ON sec_filings(cik)
  WHERE is_latest_amendment = true;
```
A second `is_latest_amendment = true` for the same CIK will cause a constraint violation before it can land.

---

## Module Map

| File | Role |
|---|---|
| `api/_sec-edgar.js` | Core: EDGAR fetch, XML parse, DB upsert, flag management |
| `api/sec-verification.js` | Single-filing verify flow triggered from Deal Review |
| `api/deal-cleanup.js` | Enrichment pipeline — reads `sec_filings` during cleanup |
| `src/lib/utils/dealDetailSignals.js` | `buildSecFilingSummary(deal)` — reads from deal fields (not sec_filings directly) |
| `src/lib/utils/dealAnalysis.js` | `buildLegitimacySummary(deal, secFiling)` — "73 LPs" badge |
| `scripts/dlp-sec-backfill.mjs` | One-time / recovery script for DLP Lending Fund |
| `scripts/refresh-sec-filings.mjs` | Weekly batch refresh for all CIK-linked deals |
| `supabase/migrations/069_sec_filings_hardening.sql` | Unique partial index + `sec_data_refreshed_at` column |

---

## Key Exported Functions

### `upsertParsedSecFiling({ supabase, opportunityId, managementCompanyId, accession, cik, parsed, xml, url, fileDate, isLatest })`
- `isLatest` defaults to `true` (single-filing backward compat)
- When `true`: clears all flags for CIK, writes row with `is_latest_amendment: true`
- When `false`: writes row with `is_latest_amendment: false`, does NOT touch other rows

### `markLatestFilingForCik(cik, supabase)`
- Idempotent — safe to call repeatedly
- Clears all `is_latest_amendment` for CIK, then sets newest by `filing_date` to `true`
- Returns `{ id, filing_date }` of the row marked, or `null` if no filings exist
- **Must be called** after any bulk upsert loop

### `fetchAllFilingsForCik(cik, opportunityId, supabase)`
- Fetches all Form D / D/A filings for a CIK from EDGAR EFTS
- Calls `upsertParsedSecFiling` with `isLatest: false` for each
- Calls `markLatestFilingForCik` once after the loop
- Returns count of upserted filings

### `refreshSecFilingsForDeal(dealId, supabase)`
- Canonical idempotent refresh entry point
- Resolves CIK from `opportunities.sec_cik` or existing `sec_filings` row
- Calls `fetchAllFilingsForCik` → `markLatestFilingForCik` → pushes data to `opportunities`
- Sets `opportunities.sec_data_refreshed_at = now()`

### `fetchAndStoreSecFiling({ supabase, match, opportunityId, managementCompanyId })`
- Single-filing path (used by `sec-verification.js`)
- Calls `upsertParsedSecFiling` with `isLatest: true` (default)
- Do NOT change this path — it is correct and well-tested

### `buildDealUpdatesFromSecFiling(deal, filing, options)`
- Pure function: maps a `sec_filings` row to an `opportunities` update object
- `options.forceIdentitySync: true` allows overwriting `sec_entity_name` / `issuer_entity`
- Tested by `tests/sec-filing-sync.test.mjs`

---

## Display Chain

```
sec_filings (is_latest_amendment = true)
    ↓ refreshSecFilingsForDeal / dlp-sec-backfill
opportunities.total_amount_sold + total_investors + sec_cik
    ↓ API (api/member/deals/transform.js)
deal object in browser
    ↓ buildSecFilingSummary(deal)         src/lib/utils/dealDetailSignals.js
    ↓ buildLegitimacySummary(deal, filing)  src/lib/utils/dealAnalysis.js
Deal Detail legitimacy bar: "SEC filed (506(c)) · $1.5B raised · 1,500 LPs"
```

The display components read from `opportunities` columns, **not** from `sec_filings` directly. This means the data shown is only as fresh as the last sync.

---

## Things That Will Break (and How to Catch Them)

### 1. Calling `upsertParsedSecFiling` in a loop without `isLatest: false`
**Symptom:** Deal shows stale SEC totals (oldest filing's data instead of newest)
**Detection:** `markLatestFilingForCik` is not called; `sec_filings` has the wrong row flagged
**Prevention:** Always pass `isLatest: false` in loops; always call `markLatestFilingForCik` after

### 2. Not calling `markLatestFilingForCik` after a bulk upsert
**Symptom:** All rows have `is_latest_amendment = false` (no latest); deal shows blank totals
**Detection:** `SELECT * FROM sec_filings WHERE cik = X AND is_latest_amendment = true` returns 0 rows
**Prevention:** `fetchAllFilingsForCik` always calls it; scripts must call it after their loop

### 3. Two rows with `is_latest_amendment = true` for the same CIK
**Symptom:** Constraint violation from `idx_one_latest_per_cik`; `upsertParsedSecFiling` throws
**Detection:** DB error: `duplicate key value violates unique constraint "idx_one_latest_per_cik"`
**Prevention:** The index enforces this at the DB level. If you see this error, call `markLatestFilingForCik` to repair

### 4. `sec_data_refreshed_at` not being set after a sync
**Symptom:** `refresh-sec-filings.mjs` re-fetches deals every day instead of weekly
**Detection:** Deals always show as stale; EDGAR rate limit may be hit
**Prevention:** `refreshSecFilingsForDeal` sets this automatically

### 5. Adding a `$lib/` import to `_sec-edgar.js`
**Symptom:** `api/sec-verification.js`, `api/deals/[id].js`, and any API route that imports `_sec-edgar.js` crash at cold-start
**Detection:** `tests/api-serverless-compat.test.mjs` (if `_sec-edgar.js` is added to the scan list)
**Prevention:** `_sec-edgar.js` is in `api/` and runs as plain Node.js — never add `$lib/` imports

---

## Acceptance Criteria

- [ ] Exactly one `sec_filings` row per CIK has `is_latest_amendment = true`
- [ ] That row has the newest `filing_date` for that CIK
- [ ] `opportunities.total_amount_sold` and `total_investors` match the `is_latest_amendment = true` row
- [ ] `opportunities.sec_data_refreshed_at` is set after any refresh
- [ ] DB constraint `idx_one_latest_per_cik` exists and is enforced
- [ ] `markLatestFilingForCik` is idempotent — calling it twice gives the same result
- [ ] `fetchAllFilingsForCik` stores all filings and calls `markLatestFilingForCik` exactly once
- [ ] `fetchAndStoreSecFiling` (single-filing path) still works unchanged

---

## QA Checklist

### Deal Detail: SEC Legitimacy Badge
- [ ] Navigate to a deal with a confirmed SEC filing (e.g. DLP Lending Fund `/deal/54bbffff-...`)
- [ ] Legitimacy bar shows "SEC filed" badge
- [ ] `total_investors` matches the most recent Form D/A filing (check EDGAR directly)
- [ ] `total_amount_sold` / offering size matches the most recent filing

### Admin: SEC Verification (single-filing path)
- [ ] In Deal Review → SEC Verification section, click "Verify" on a deal with a known accession
- [ ] Filing data loads without error
- [ ] `sec_filings` table shows one row with `is_latest_amendment = true` for that CIK
- [ ] Deal fields update with filing data

### DLP Backfill / Recovery Script
- [ ] `node scripts/dlp-sec-backfill.mjs --dry-run` lists filings without writing
- [ ] `node scripts/dlp-sec-backfill.mjs` stores all filings; only the newest has `is_latest_amendment = true`
- [ ] DLP deal shows ~$1.5B+ raised and 1,500+ investors after backfill

### Batch Refresh
- [ ] `node scripts/refresh-sec-filings.mjs --dry-run` lists deals without writing
- [ ] `node scripts/refresh-sec-filings.mjs --deal-id <uuid>` refreshes one deal
- [ ] After refresh, `sec_data_refreshed_at` is set; re-running skips the deal (stale window)
- [ ] `node scripts/refresh-sec-filings.mjs --force` refreshes all deals regardless of staleness

---

## Test Coverage

| Type | File | What it covers |
|------|------|----------------|
| Unit | `tests/sec-filing-sync.test.mjs` | `buildDealUpdatesFromSecFiling` field mapping, `markLatestFilingForCik` contract (newest row returned, null when empty, throws on empty CIK, CIK normalization) |
| Smoke | `tests/deal-review.smoke.spec.ts` | Deal Review page loads without error; 500 shows friendly message (catches API crashes from bad imports) |
| Gap | — | No integration test for full `fetchAllFilingsForCik` loop against real EDGAR (requires network) |
| Gap | — | No test for `refreshSecFilingsForDeal` end-to-end (requires real Supabase client) |
| Gap | — | No test that DB index `idx_one_latest_per_cik` prevents duplicates (migration test) |

---

## Dependencies

- EDGAR EFTS API: `https://efts.sec.gov/LATEST/search-index`
- EDGAR filing XML: `https://www.sec.gov/Archives/edgar/data/{cik}/{accession}/{accession}-primary_doc.xml`
- Rate limit: ~10 requests/sec — code uses 150ms delay between filings, 500ms between deals
- `User-Agent` header required: `GYC Research pascal@growyourcashflow.com`
- Supabase: `getAdminClient()` from `api/_supabase.js`
- **No `$lib/` imports** — this file lives in `api/` and runs as plain Node.js
