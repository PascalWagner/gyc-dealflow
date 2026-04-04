# Income Fund

## What It Does
GYC Income Fund landing page. Shows fund details, prospectus information, and investment thesis. "Just do it for me" option for investors who want passive exposure without individual deal selection.

## Routes
- `/app/income-fund` — Fund details and information page

## API Endpoints
- Minimal — primarily static content with fund details

## Acceptance Criteria
- [ ] Fund details page loads with investment thesis
- [ ] Fund metrics display (target yield, minimum investment, etc.)
- [ ] Clear CTA for interested investors

## QA Checklist

### Happy Path
- [ ] Navigate to `/app/income-fund` → page loads with fund info
- [ ] Fund metrics render correctly
- [ ] CTA buttons work

### Edge Cases
- [ ] Page accessible to all tiers (not gated)

### Data Integrity
- [ ] Fund details match current offering terms

## Test Coverage
| Type | File | Count |
|------|------|-------|
| Gap | No tests for income fund page | — |

## Dependencies
- Requires: auth (session)
