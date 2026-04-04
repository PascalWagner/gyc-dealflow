# Deal Review

## What It Does
Deal underwriting and review interface for operators and admins. Multi-stage form to capture all deal data: intake, SEC verification, classification, terms, fees, performance, snapshot, sponsor trust, team, risks, and summary. Supports field-level admin overrides with evidence/citation tracking. Stage-gated progression (must complete in order).

## Routes
- `/deal-review` — Main review interface
- `/deal-review/risk-redesign` — Risk assessment redesign

## API Endpoints
- `POST /api/company-search?q={query}` — Search sponsors by name
- `POST /api/deck-upload-url` — Get pre-signed upload URL
- `POST /api/deck-upload` — Finalize deck upload
- `GET /api/deals/{dealId}` — Fetch deal review state
- `PATCH /api/management-companies/{id}/settings` — Update GP settings
- `POST /api/deal-team-contacts` — Team contact suggestions
- `GET /api/sec-verification?dealId={id}` — SEC filing verification
- `POST /api/deal-cleanup` — Validate data before publish
- `POST /api/deal-enrich` — Enrich deal data
- `POST /api/deal-confirm-enrichment` — Confirm enrichment

## Acceptance Criteria
- [ ] Sidebar shows stage progress with completion status
- [ ] Each stage has required and optional fields
- [ ] Cannot advance to next stage without completing required fields
- [ ] Admin can override field values with evidence citations
- [ ] Deck/PPM upload via drag-drop or file picker
- [ ] SEC verification checks filing matches
- [ ] Auto-save on interval prevents data loss
- [ ] "Review & Publish" on summary stage finalizes deal
- [ ] Only GP owners and admins can access review

## QA Checklist

### Happy Path
- [ ] Navigate to deal review → sidebar shows all stages
- [ ] Complete intake stage → "Next" advances to SEC
- [ ] Upload deck → file processed, fields populated
- [ ] SEC verification → matches filing data
- [ ] Complete all stages → summary shows review
- [ ] Click "Publish" → deal status changes to published
- [ ] Admin overrides a field → override badge appears

### Edge Cases
- [ ] Required field empty → cannot advance, validation shown
- [ ] Deck upload fails → error message, retry option
- [ ] SEC filing not found → "Not found" message
- [ ] Two users editing same deal → conflict warning
- [ ] Jump to later stage via sidebar → only if prerequisites met
- [ ] Very large deck file → handled within 60s timeout

### Data Integrity
- [ ] All field values persist across page refresh
- [ ] Admin override creates audit trail with evidence
- [ ] Published deal visible in deal browser
- [ ] Enrichment data matches source documents

## Test Coverage
| Type | File | Count |
|------|------|-------|
| Smoke | tests/deal-review-provenance.smoke.spec.ts | 4 |
| Unit | tests/review-field-state.test.mjs | 5 |
| Unit | tests/review-field-evidence.test.mjs | 4 |
| Unit | tests/review-summary-state.test.mjs | 3 |
| Unit | tests/deal-transform-lending.test.mjs | 3 |
| Doc | docs/DEAL_REVIEW_DATA_INTEGRITY_QA.md | Full QA runbook |
| Gap | No E2E for full stage progression | — |
| Gap | No test for deck upload flow | — |

## Dependencies
- Requires: auth (GP or admin role), deal-enrichment (data pipeline)
