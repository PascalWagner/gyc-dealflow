# Lending Fund Implementation Matrix

## Purpose

Translate the recommended lending-fund workflow into an implementation plan that fits the current built review flow.

This document is the build map:

- what the final 10-step flow should be
- how it maps to the current 7-stage flow
- which current components can be reused
- which fields already exist
- which new fields or controls are needed
- which schema or API changes are required

## Final Recommended 11-Step Flow

1. Source Package
2. SEC + Issuer + Offering
3. Classification
4. Static Terms
5. Fees
6. Historical Performance
7. Current Portfolio Snapshot
8. Sponsor Trust
9. Contacts
10. Risks
11. Summary + QA + Publish

## Key Product Decisions Locked In Here

- Page 1 is source package only
- SEC search runs after Page 1 when the user continues
- Page 2 is SEC confirmation plus issuer / offering details
- Page 2 must support both `Find New Record` and `Skip For Now` when no reliable filing is found
- Strategy for this branch is `Lending`
- Investing Geography should be state-based multi-select with `Select All`
- `Manager AUM` belongs on Page 7 because you want it treated as a point-in-time field
- `Loan Count` belongs on both the card and the page
- `Manager AUM` belongs on both the card and the page
- `Auditing` is the product-facing label replacing `financials`
- `LP/GP Split` belongs in additional details on the static terms page, not on the lending-fund card
- `LP/GP Split` should be captured as an LP percentage input from 0 to 100, with optional notes for waterfall nuance
- Historical return inputs should allow negatives and two decimal places, and the UI should make `%` explicit
- Contacts should be its own step because the app already has most of that workflow built
- Offering status should be reduced to the lending-fund set: `Currently Open`, `Evergreen`, `Full`, `Full Cycle`

## Lending-Fund Deal Card Recommendation

### Hero

- Last 5 completed years of net annual return to LPs

### Row 1

- Minimum
- Lockup
- Redemption
- Distribution

### Row 2

- Preferred Return
- Loan Count
- Manager AUM
- Fund Founded

## Page 4 Static Terms Layout Recommendation

This is the row layout I recommend for the static-terms page.

### Row 1: investor mechanics

- Minimum
- Lockup
- Redemption Frequency
- Distribution Frequency

### Row 2: durable trust + fund terms

- Preferred Return
- Auditing
- Fund Founded Year

### Row 3: additional details

- LP/GP Split
- Additional Term Notes

### Why this is the best fit right now

- row 1 maps directly to the top decision mechanics for LPs
- row 2 captures durable fund-specific trust signals
- row 3 keeps the less card-relevant but still important structural details visible

I am intentionally not putting `Manager AUM` here because your latest direction is to treat it as a point-in-time field on the snapshot page.

## Stage-Level Implementation Matrix

| Proposed step | Current built stage | Reuse from current product | What changes | New UI needed | Backend/schema impact |
| --- | --- | --- | --- | --- | --- |
| 1. Source Package | `intake` | existing intake shell, sponsor field, upload controls | Remove SEC content from this page entirely | minor copy/layout change | none beyond existing uploads |
| 2. SEC + Issuer + Offering | `sec` plus part of current `overview` | `SecVerificationStage`, existing offering fields | SEC page becomes the place where offering type, available to, status, issuer entities, sale date, amount sold, investor count are confirmed | moderate page expansion | likely none for SEC fields, since most exist already |
| 3. Classification | part of current `overview` | `FieldRenderer`, existing branch resolution logic | make `strategy` fixed or defaulted to `Lending`; change geography to state multi-select; add `Select All` | new geography selector | add or repurpose geography storage for state arrays |
| 4. Static Terms | part of current `details` | `KeyDetailsStage`, `FieldRenderer` | split out durable terms into row-based layout | moderate layout change | add `fundFoundedYear`; split redemption into structured frequency if needed |
| 5. Fees | currently mixed into `details` and `risk/detail signals` | none directly besides shell | move away from `feeSummary` as the main model | new fee-row table UI | add structured `fees` model if not present; keep legacy text temporarily |
| 6. Historical Performance | not built | shell/progress/sidebar only | brand-new page using year columns | new table/grid UI | add normalized historical-return storage |
| 7. Current Portfolio Snapshot | not built | shell/progress/sidebar only | brand-new page for all point-in-time lending-fund metrics | new snapshot form | add snapshot fields and `asOfDate` |
| 8. Sponsor Trust | part of current `team` plus some sponsor metadata | `FieldRenderer` plus existing wizard shell | remove `Manager AUM` from here; focus on firm founded year and firm-level trust context only | moderate page change | add `firmFoundedYear` if not already accessible |
| 9. Contacts | current `team` | `TeamContactsStage` | spin contacts into its own explicit step | low-to-moderate change | keep current contact persistence |
| 10. Risks | current `risks` | shell and possibly source context area | replace prose-first risk entry with taxonomy-first risk tagging | new taxonomy multi-select UI | add `riskTags` |
| 11. Summary + QA + Publish | `summary` | summary concept, shell, progress rail | make this page fully editable with preview links and a publish checklist | stronger summary UI | likely no new schema, but new preview actions |

## Field-Level Implementation Matrix

### Page 1: Source Package

| Field / concept | UI label | Current support | Current field | Proposed action |
| --- | --- | --- | --- | --- |
| deal name | `Deal Name` | yes | `investmentName` | keep |
| sponsor | `Sponsor` | yes | `sponsor` | keep |
| sponsor website | `Sponsor Website` | yes | `companyWebsite` | keep |
| deck upload | `Upload Deck` | yes | `deckUrl` + upload flow | keep |
| PPM upload | `Upload PPM` | partial | upload flow exists, `ppmUrl` exists downstream | make first-class in review UI |

### Page 2: SEC + Issuer + Offering

| Field / concept | UI label | Current support | Current field | Proposed action |
| --- | --- | --- | --- | --- |
| SEC match state | `SEC Match` | yes | `secVerificationState` | keep |
| filing link | `Matched Filing` | yes | `secFilingId` | keep |
| CIK | `CIK` | yes | `secCik` | keep |
| SEC entity name | `SEC Entity Name` | yes | `secEntityName` | keep |
| issuer entity | `Issuer Entity` | yes | `issuerEntity` | keep |
| GP entity | `GP Entity` | yes | `gpEntity` | keep |
| sponsor entity | `Sponsor Entity` | yes | `sponsorEntity` | keep |
| offering type | `Offering Type` | yes | `offeringType` | move here as primary home |
| available to | `Available To` | yes | `availableTo` | auto-fill from offering type, still editable |
| offering status | `Offering Status` | yes | `offeringStatus` / `status` | move here as primary home; narrow options to `Currently Open`, `Evergreen`, `Full`, `Full Cycle` |
| date of first sale | `Date Of First Sale` | yes | `dateOfFirstSale` | keep |
| total amount sold | `Total Amount Sold` | yes | `totalAmountSold` | keep |
| total investors | `Total Investors` | yes | `totalInvestors` | keep |
| SEC unresolved action | `Skip For Now` | no explicit UX | none | add explicit unresolved override action that requires a reviewer note and allows advancing without resolving publish readiness |
| secondary SEC search | `Find New Record` | partial via refresh | none explicit | add alternate search action and manual-search controls so the reviewer can rerun matching with sponsor / issuer / CIK inputs |

### Page 3: Classification

| Field / concept | UI label | Current support | Current field | Proposed action |
| --- | --- | --- | --- | --- |
| branch | `Branch` | yes | `dealBranch` | default to `lending_fund` |
| strategy | `Strategy` | partial | `investmentStrategy` / `strategy` | use fixed/value-limited `Lending` for branch logic; keep narrative elsewhere |
| investing geography | `Investing Geography` | partial | `investingGeography` currently location-like | replace with state multi-select control for lending funds |
| all states toggle | `Select All States` | no | none | new control |

### Page 4: Static Terms

| Field / concept | UI label | Current support | Current field | Proposed action |
| --- | --- | --- | --- | --- |
| minimum | `Minimum` | yes | `investmentMinimum` | keep |
| lockup | `Lockup` | yes | `holdPeriod` | keep, clarify meaning = investor lockup |
| redemption frequency | `Redemption` | partial | `redemption` currently freeform | split into structured frequency + optional notes later |
| distribution frequency | `Distribution` | yes | `distributions` | keep |
| preferred return | `Preferred Return` | yes | `preferredReturn` | keep |
| auditing | `Auditing` | yes | `financials` | relabel in UI |
| fund founded year | `Fund Founded` | no | none | add new field |
| LP/GP split | `LP/GP Split` | yes | `lpGpSplit` | keep on row 3 additional details, but change UI to LP percent input with optional notes |
| additional term notes | `Additional Term Notes` | no | none | new optional text field or reuse existing notes field |

### Page 5: Fees

| Field / concept | UI label | Current support | Current field | Proposed action |
| --- | --- | --- | --- | --- |
| fee list | `Fees` | partial | `fees` and `feeSummary` both exist in different places | make structured fee rows the primary model |
| fee summary notes | `Fee Notes` | partial | `feeSummary` | keep as optional notes until migration complete |
| fee type | `Fee Type` | no | none structured | new structured field |
| amount | `Amount` | no | none structured | new structured field |
| amount type | `Amount Type` | no | none structured | new structured field |
| frequency | `Frequency` | no | none structured | new structured field |
| applies to | `Applies To` | no | none structured | new structured field |

### Page 6: Historical Performance

| Field / concept | UI label | Current support | Current field | Proposed action |
| --- | --- | --- | --- | --- |
| annual performance table | `Historical Performance` | no | app can read `historicalReturns`, but review flow cannot edit it | add dedicated intake table |
| return basis | `Return Basis` | no | none | new field, default `Net Annual Return To LPs` |
| return source | `Source` | no | none | new field |
| return notes | `Notes / Restatements` | no | none | new field |
| return value format | helper / validation | no | none | numeric percentage input; allow negatives; 2 decimal places; helper text should say `Enter 7.25 for 7.25% or -0.50 for -0.50%` |
| normalized return series | hidden/internal | partial | `historicalReturns` supported by card helper | add persistence support |

### Page 7: Current Portfolio Snapshot

| Field / concept | UI label | Current support | Current field | Proposed action |
| --- | --- | --- | --- | --- |
| snapshot as of | `Snapshot As Of Date` | no | none | add new field |
| current fund size | `Current Fund Size` | no | none | add new field |
| max fund size | `Max Fund Size` | partial | `offeringSize` may be proxied | add explicit display/use for lending funds |
| current loan count | `Current Loan Count` | partial | `loanCount` | keep, but pair with as-of date |
| current weighted avg LTV | `Current Weighted Avg LTV` | partial | `avgLoanLtv` / `avgLoanLTV` | keep but relabel and define |
| max allowed LTV | `Max Allowed LTV` | no | none | add new field |
| current leverage | `Current Leverage` | no | none | add new field |
| max allowed leverage | `Max Allowed Leverage` | no | none | add new field |
| manager AUM | `Manager AUM` | partial/ambiguous | `fundAUM` currently overloaded | split concept and collect here as point-in-time |

### Page 8: Sponsor Trust

| Field / concept | UI label | Current support | Current field | Proposed action |
| --- | --- | --- | --- | --- |
| firm founded year | `Firm Founded` | partial | `mcFoundingYear` on transformed data, not main review field | add explicit review field |
| firm overview notes | `Firm Notes` | partial | operator-style prose fields today | keep optional and limited |

### Page 9: Contacts

| Field / concept | UI label | Current support | Current field | Proposed action |
| --- | --- | --- | --- | --- |
| CEO / operator lead | `CEO / Operator Lead` | partial | team contacts flow | keep and require |
| IR contact | `IR Contact` | partial | team contacts flow | keep and require |
| IR email | `IR Email` | partial | team contacts flow | keep |
| calendar link | `Calendar Link` | partial | team contacts flow | keep |

### Page 10: Risks

| Field / concept | UI label | Current support | Current field | Proposed action |
| --- | --- | --- | --- | --- |
| risk tags | `Risks` | no | none | add taxonomy-first capture |
| optional risk notes | `Notes` | partial | `riskNotes` / `downsideNotes` freeform | keep as optional notes only |

### Page 11: Summary + QA + Publish

| Field / concept | UI label | Current support | Current field | Proposed action |
| --- | --- | --- | --- | --- |
| inline section editing | `Edit` controls | partial | summary exists but not fully inline-editable | expand |
| open deal page | `Open Deal Page In New Tab` | no | none | add preview action |
| open card preview | `Open Deal Card Preview` | no | none | add preview action |
| publish checklist | `Publish Checklist` | partial | current rules/checklist exists | expand to lending-fund-specific gates |

## Existing Component Reuse Matrix

| Existing component / utility | Reuse? | Where |
| --- | --- | --- |
| `SecVerificationStage.svelte` | yes | page 2 |
| `TeamContactsStage.svelte` | yes | page 9 |
| `KeyDetailsStage.svelte` | partial | page 4 only, after redesign |
| `FieldRenderer.svelte` | yes | pages 1, 2, 3, 4, 8 |
| `DealOnboardingProgress.svelte` | yes | all pages |
| `DealReviewSidebar.svelte` | yes | all pages |
| `DealReviewWizardShell.svelte` | yes | all pages |

## New Components I Would Add

| New component | Why |
| --- | --- |
| `SourcePackageStage.svelte` | separate page 1 cleanly from SEC |
| `LendingFundClassificationStage.svelte` | state multi-select and branch-specific classification |
| `LendingFundStaticTermsStage.svelte` | row-based static term UI |
| `SponsorTrustStage.svelte` | separate firm-level trust metadata from contacts |
| `FeeStructureStage.svelte` | structured fee rows |
| `HistoricalPerformanceStage.svelte` | year-column performance table |
| `PortfolioSnapshotStage.svelte` | dated snapshot metrics |
| `RiskTaxonomyStage.svelte` | standardized risk tagging |
| `PublishQaStage.svelte` | inline-editable summary with preview links |

## Existing Schema / Contract Issues To Fix

| Issue | Current state | Recommendation |
| --- | --- | --- |
| `financials` naming | field exists but label is vague | relabel to `Auditing` in UI |
| `fundAUM` ambiguity | appears to mix fund size / manager AUM meanings | split into `managerAUM` and fund-size concepts |
| `investingGeography` shape | location-style field | add lending-fund-specific state multi-select behavior |
| `redemption` shape | freeform text | add structured redemption frequency |
| `fees` vs `feeSummary` | both exist | make structured `fees` canonical, keep notes temporarily |
| historical returns editing | card can read a series, review flow cannot author it | add authoring/persistence path |
| risk capture | prose-heavy | move to risk taxonomy |
| fund founded year | missing | add new field |
| firm founded year in review flow | not first-class | add explicit field |

## How This Fits Into The Current Code

### Current stage order

`['intake', 'sec', 'team', 'overview', 'details', 'risks', 'summary']`

### Recommended migration

| Current stage id | New responsibility |
| --- | --- |
| `intake` | page 1 source package |
| `sec` | page 2 SEC + issuer + offering |
| `overview` | page 3 classification and part of page 8 sponsor trust |
| `details` | split into pages 4, 5, 6, 7 |
| `team` | page 9 contacts |
| `risks` | page 10 risks |
| `summary` | page 11 summary + QA + publish |

### Practical implementation approach

1. Keep the existing shell and stage chrome.
2. Expand the stage order and stage config in `dealOnboardingFlow.js`.
3. Add new stage components one by one.
4. Reuse `FieldRenderer` where possible.
5. Only after the UI pages exist, tighten publish rules for the lending-fund branch.

## Exact Files I Would Update

| File | What I would change |
| --- | --- |
| `src/lib/utils/dealOnboardingFlow.js` | expand the current 7-stage flow into the 11-step lending-fund flow; keep page 1 as source package only; keep page 2 as SEC + issuer + offering; split current `details` into static terms, fees, historical performance, and current snapshot |
| `src/lib/utils/dealReviewSchema.js` | relabel `financials` to `Auditing`; narrow `offeringStatus` options for lending funds; add `fundFoundedYear`, `firmFoundedYear`, `snapshotAsOfDate`, `currentFundSize`, `maxFundSize`, `maxAllowedLTV`, `currentLeverage`, `maxAllowedLeverage`, return-history inputs, and structured `fees`; update lending-fund geography to state multi-select behavior |
| `src/routes/deal-review/+page.svelte` | update stage routing, stage navigation, and component switching so the 11-step lending-fund flow renders in the wizard while preserving the current “continue from intake triggers SEC” behavior |
| `src/lib/components/deal-review/SecVerificationStage.svelte` | expand page 2 so it owns issuer entity, GP entity, sponsor entity, offering type, available to, offering status, SEC confirmation, unresolved-skip behavior, and secondary record search |
| `src/lib/components/onboarding/TeamContactsStage.svelte` | use this as the dedicated contacts page and remove non-contact sponsor-trust responsibilities from it |
| `src/lib/components/deal-review/stages/KeyDetailsStage.svelte` | replace or heavily refactor into the new page 4 static-terms layout with Row 1, Row 2, and Row 3 additional details |
| `src/lib/components/DealCard.svelte` | update the lending-fund card rows to `Minimum`, `Lockup`, `Redemption`, `Distribution` and `Preferred Return`, `Loan Count`, `Manager AUM`, `Fund Founded`; make the hero use historical returns rather than a cover image |
| `api/member/deals/transform.js` | normalize the new lending-fund fields for the card and deal page, including historical returns, `managerAUM`, `loanCount`, `fundFoundedYear`, and the dated snapshot fields |
| `src/routes/investments/[slug]/+page.*` plus lending-fund page sections | update the deal page contract so it reads the same normalized lending-fund fields the review flow now collects |

## Recommended New Stage IDs

If you want the code to stay understandable as this grows, I would use these stage ids:

1. `source_package`
2. `sec_offering`
3. `classification`
4. `static_terms`
5. `fees`
6. `historical_performance`
7. `portfolio_snapshot`
8. `sponsor_trust`
9. `contacts`
10. `risks`
11. `summary`

That is a cleaner long-term contract than overloading `overview` and `details`.

## Immediate Build Order

1. Separate page 1 source package from page 2 SEC confirmation
2. Add explicit SEC unresolved actions: `Find New Record` and `Skip For Now`
3. Add page 3 classification with state multi-select geography
4. Redesign page 4 static terms
5. Add page 6 historical performance with percentage validation
6. Add page 7 current snapshot
7. Split sponsor trust and contacts into pages 8 and 9
8. Add page 10 risk taxonomy
9. Expand page 11 summary with preview links and inline editing
10. Clean up card/page field contracts for lending funds

## Recommended Next Step After This Doc

Implement the stage-order and field-config changes first, before styling refinements.

That means:

1. update `dealOnboardingFlow.js`
2. update `dealReviewSchema.js`
3. add the new stage components
4. wire summary + preview actions

Once that is in place, the lending-fund review experience will match the product logic we’ve now defined.
