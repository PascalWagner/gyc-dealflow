# Deal Enrichment

## What It Does
Backend pipeline that enriches deal data from source documents (PPM, deck, SEC filings). Extracts key terms, sponsor info, performance data, and risk factors. Runs on every document upload. Uses shared `_enrichment.js` module across all enrichment paths.

## Routes
- None (API-only feature)

## API Endpoints
- `POST /api/deal-enrich` — Trigger enrichment pipeline
- `POST /api/deal-confirm-enrichment` — Confirm extracted data
- `GET /api/sec-edgar` — SEC EDGAR filing lookups
- `GET /api/sec-verification?dealId={id}` — Verify SEC filing match
- `GET /api/company-search?q={query}` — Company data lookup
- `POST /api/deal-team-contacts` — Extract team contacts

## Acceptance Criteria
- [ ] Enrichment runs automatically on deck/PPM upload
- [ ] Extracted fields populate deal review form
- [ ] User can confirm or reject extracted values
- [ ] SEC filing data matched to correct offering
- [ ] Sponsor research pulls company background
- [ ] PPM is always source of truth for deal terms

## QA Checklist

### Happy Path
- [ ] Upload PPM → enrichment extracts key terms
- [ ] SEC lookup finds matching filing
- [ ] Company search returns sponsor info
- [ ] Confirm enrichment → fields finalized

### Edge Cases
- [ ] No SEC filing found → enrichment continues without SEC data
- [ ] Malformed PDF → error message, partial extraction
- [ ] Company name mismatch → user prompted to confirm
- [ ] Multiple SEC filings → most recent selected

### Data Integrity
- [ ] Extracted data matches source document values
- [ ] Enrichment creates audit trail of data source
- [ ] Confirmed enrichment overwrites previous values

## Test Coverage
| Type | File | Count |
|------|------|-------|
| Unit | tests/deal-transform-lending.test.mjs | 3 |
| Unit | tests/sec-filing-sync.test.mjs | 2 |
| Unit | tests/classification-state-signals.test.mjs | 12 |
| Unit | tests/deal-workflow-media.test.mjs | 2 |
| Gap | No integration test for full enrichment pipeline | — |

## Dependencies
- Used by: deal-review (data source)
