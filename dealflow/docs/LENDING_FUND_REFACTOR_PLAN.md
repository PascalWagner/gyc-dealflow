# Lending Fund Review Refactor Plan

## Goal

Refactor the existing deal review flow so a lending fund can move from source documents to a publishable deal card and deal page without manual database cleanup.

This plan assumes:

- the first real onboarding target is a lending fund
- SEC review should happen early and drive legitimacy checks
- the deal card and deal page should both be fed by the review flow
- the current review flow should be refactored, not thrown away

## Final Recommended Step Order

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

## Core Product Decisions

### Offering status

For lending funds, reduce the UI options to:

- `Currently Open`
- `Evergreen`
- `Full`
- `Full Cycle`

Implementation note:

- keep alias mapping from old values like `Open to invest`, `Closed`, `Fully Funded`, and `Completed`
- show only the new four-value set in the lending-fund review UI

### SEC handling

Step 2 needs four clear reviewer paths:

1. `Use This Filing`
2. `Find New Record`
3. `Skip For Now`
4. `Mark Haven't Filed Yet` / `Mark Not Applicable`

Recommended behavior:

- `Use This Filing` resolves the SEC gate as verified
- `Find New Record` opens a secondary search mode using issuer name, sponsor name, CIK, and manual query text
- `Skip For Now` saves an unresolved override state plus a required reviewer note and allows moving forward
- unresolved SEC should allow step navigation but should still show as a publish blocker on the summary page unless explicitly resolved

### LP / GP split

Do not keep this as raw text only.

Recommended MVP input:

- `LP Share (%)` numeric input
- min `0`
- max `100`
- step `1`
- up/down spinner allowed
- helper text: `If the split is 80/20, enter 80.`
- optional `LP/GP Split Notes` field for `after pref`, `tiered waterfall`, or other nuance

Display behavior:

- generate the display string from the numeric value, for example `80 / 20`
- append notes if present

### Historical performance

Historical returns should be entered as percentage values by completed year.

Recommended input rules:

- year-column table in the review flow
- values entered as numeric percentages
- allow negatives
- allow 2 decimal places
- helper text: `Enter 7.25 for 7.25% or -0.50 for -0.50%.`
- no current-year YTD entry
- default basis: `Net Annual Return To LPs`

### Contacts

Split contacts into their own step.

Why:

- the current app already has a dedicated contacts component
- CEO / operator / investor relations is operationally important
- it should not be hidden inside sponsor-trust metadata

### Manager AUM

Treat `Manager AUM` as a point-in-time field.

That means:

- collect it on the snapshot page
- show it on both card and page
- pair it conceptually with snapshot timing even if the card itself does not show the date

## Step-By-Step Product Plan

| Step | Purpose | Main fields | Primary buttons |
| --- | --- | --- | --- |
| 1. Source Package | create the draft and upload source docs | deal name, sponsor, sponsor website, deck, PPM | `Save Draft`, `Continue` |
| 2. SEC + Issuer + Offering | confirm filing and offering structure | SEC match, entities, CIK, offering type, available to, offering status, first sale, amount sold, investors | `Back`, `Find New Record`, `Skip For Now`, `Save`, `Continue` |
| 3. Classification | set the lending-fund branch and geography | branch, strategy, investing geography by state | `Back`, `Save`, `Continue` |
| 4. Static Terms | capture durable LP-facing terms | minimum, lockup, redemption, distribution, preferred return, auditing, fund founded, LP share % | `Back`, `Save`, `Continue` |
| 5. Fees | capture fee structure cleanly | structured fee rows, fee notes | `Back`, `Add Fee`, `Save`, `Continue` |
| 6. Historical Performance | load annual return history | yearly return table, basis, source, notes | `Back`, `Save`, `Continue` |
| 7. Current Portfolio Snapshot | capture latest dated operating snapshot | as-of date, current fund size, max fund size, loan count, weighted avg LTV, max LTV, current leverage, max leverage, manager AUM | `Back`, `Save`, `Continue` |
| 8. Sponsor Trust | capture firm-level trust metadata | firm founded year, firm notes | `Back`, `Save`, `Continue` |
| 9. Contacts | capture LP-facing people | CEO/operator, IR contact, email, calendar link | `Back`, `Save`, `Continue` |
| 10. Risks | tag the risk profile | risk tags, optional notes | `Back`, `Save`, `Continue` |
| 11. Summary + QA + Publish | review and publish | preview links, blockers, inline edits | `Back`, `Open Card Preview`, `Open Deal Page`, `Publish` |

## Page-Level UX Rules

### Step 1: Source Package

`Continue` should:

1. save the intake fields
2. upload deck / PPM if provided
3. trigger the SEC lookup
4. route to Step 2

Validation:

- deal name required
- sponsor required
- at least one source document strongly encouraged

### Step 2: SEC + Issuer + Offering

This page needs explicit result states:

1. `Verified Match Found`
2. `Candidate Matches Found`
3. `No Match Found`
4. `Skipped With Note`
5. `Haven't Filed Yet`
6. `Not Applicable`

Required UX additions:

- `Find New Record`
- manual search inputs: issuer name, sponsor name, CIK, freeform query
- `Skip For Now` button that requires a reviewer note

Continue rules:

- allow continue if verified
- allow continue if skipped with note
- allow continue if marked haven't filed yet or not applicable
- do not allow continue if the page is still loading or no reviewer decision has been made

### Step 3: Classification

For lending funds:

- default branch to `lending_fund`
- default strategy to `Lending`
- geography should be state multi-select
- include `Select All`
- if all states selected, persist it as all states rather than a single freeform string

### Step 4: Static Terms

Use three visual rows.

Row 1:

- Minimum
- Lockup
- Redemption Frequency
- Distribution Frequency

Row 2:

- Preferred Return
- Auditing
- Fund Founded

Row 3:

- LP Share (%)
- LP / GP Split Notes
- Additional Term Notes

### Step 5: Fees

Use structured fee rows.

Each row should include:

- fee type
- amount
- amount type
- frequency
- applies to
- notes

Keep optional `Fee Notes` for anything not easily structured yet.

### Step 6: Historical Performance

Operational intake shape:

- one column per completed year
- values entered as percentages

Validation rules:

- numeric only
- allow negative values
- 2 decimal places
- no percent sign typed by the user
- UI renders `%`

### Step 7: Current Portfolio Snapshot

This page should be explicitly dated.

Required top field:

- `Snapshot As Of Date`

Without that date, the page should not be considered complete.

### Step 8: Sponsor Trust

Keep this narrow.

Recommended fields:

- Firm Founded
- Firm Notes

This page should not own:

- Manager AUM
- contacts

### Step 9: Contacts

Use the existing contacts workflow and make it its own step.

Required contacts:

- CEO / Operator Lead
- Investor Relations

### Step 10: Risks

Use taxonomy-first capture.

Recommended approach:

- multi-select risk tags
- optional short note area
- avoid long prose as the primary input

### Step 11: Summary + QA + Publish

This page should do three jobs:

1. show publish blockers
2. allow fast inline editing / jump back
3. open the card and deal page previews

Required actions:

- `Open Card Preview`
- `Open Deal Page`
- `Edit` links for every step
- `Publish`

## Refactor Plan Against The Existing Code

Current stage order:

`['intake', 'sec', 'team', 'overview', 'details', 'risks', 'summary']`

Recommended target stage ids:

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

Mapping from current flow:

- `intake` -> `source_package`
- `sec` -> `sec_offering`
- `overview` -> `classification`
- `details` -> `static_terms`, `fees`, `historical_performance`, `portfolio_snapshot`
- `team` -> `contacts`
- new stage -> `sponsor_trust`
- `risks` -> `risks`
- `summary` -> `summary`

## Exact Files To Refactor First

1. `src/lib/utils/dealOnboardingFlow.js`
2. `src/lib/utils/dealReviewSchema.js`
3. `src/routes/deal-review/+page.svelte`
4. `src/lib/components/deal-review/SecVerificationStage.svelte`
5. `src/lib/components/onboarding/TeamContactsStage.svelte`
6. `src/lib/components/deal-review/stages/KeyDetailsStage.svelte`
7. `src/lib/components/DealCard.svelte`
8. `api/member/deals/transform.js`

## Recommended Implementation Phases

### Phase 1: Flow contract and schema

- add the new stage ids
- update stage order
- update stage labels and descriptions
- add new schema fields
- narrow lending-fund offering-status options
- add LP share percent field
- add historical performance schema
- add snapshot schema

### Phase 2: Step rendering refactor

- wire page 1 source package
- expand page 2 SEC + issuer + offering
- split details into pages 4 through 7
- add sponsor trust page
- move contacts to its own step
- keep the existing shell and progress rail

### Phase 3: Card and page contract cleanup

- update the lending-fund card to the approved tile layout
- make the hero read historical returns
- map new review fields to normalized page fields
- remove cover-image dependency for lending funds

### Phase 4: QA and publish rules

- tighten summary blockers
- add preview actions
- confirm the first real lending fund can be published end to end

## Button Behavior Test Plan

This is how I would make sure every button works.

| Button | Expected behavior | Test |
| --- | --- | --- |
| `Save Draft` on Step 1 | saves draft without SEC lookup | verify record saves and remains on step 1 |
| `Continue` on Step 1 | saves, uploads docs, runs SEC lookup, routes to step 2 | verify deal updates, uploads persist, step changes |
| `Find New Record` on Step 2 | opens secondary SEC search flow | verify query fields appear and rerun search |
| `Skip For Now` on Step 2 | saves unresolved override plus note and allows progression | verify note required and summary still shows SEC blocker |
| `Use This Filing` on Step 2 | resolves SEC match and stores filing fields | verify filing fields persist |
| `Back` on every step | returns to previous step without losing saved data | verify form state remains after navigation |
| `Save` on every step | saves current step without advancing | verify persisted values reload |
| `Save & Continue` or `Continue` | saves and advances one step | verify next step loads and current values persist |
| `Add Fee` on Step 5 | appends a new fee row | verify row ordering and persistence |
| card/page preview buttons on summary | opens correct preview targets | verify URLs load the correct deal |
| `Publish` | only works when blockers are satisfied or explicitly overridden | verify blocked state and success state |

## Acceptance Criteria For MVP

The refactor is successful when one real lending fund can:

1. start on Step 1 with deck and PPM
2. complete SEC review or explicit SEC override
3. enter all required static terms
4. enter annual historical returns
5. enter a dated snapshot
6. save contacts cleanly
7. render a complete lending-fund card
8. render a complete lending-fund deal page
9. publish without direct database edits

## Recommended Next Build Move

Start with the plumbing, not styling.

That means:

1. refactor the stage order in `dealOnboardingFlow.js`
2. update `dealReviewSchema.js` with the new fields and enums
3. split the current `details` and `team` responsibilities
4. expand `SecVerificationStage.svelte` with `Find New Record` and `Skip For Now`
5. only then build the new step UIs
