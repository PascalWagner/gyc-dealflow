# Lending Fund 10-Step Review Flow Mockups

## Status

This mockup file is now superseded by the 11-step refactor plan in `LENDING_FUND_REFACTOR_PLAN.md`.

The main update is that `Contacts` now lives in its own step, so the current recommended flow is 11 steps, not 10.

## What Exists Today Vs What I Recommend

Current built flow in the app:

1. Intake
2. SEC
3. Team
4. Overview
5. Key Details
6. Risk & Sources
7. Summary

Recommended lending-fund flow:

1. Source Package
2. SEC + Issuer + Offering
3. Classification
4. Static Terms
5. Fees
6. Historical Performance
7. Current Portfolio Snapshot
8. Sponsor Trust
9. Risks
10. Summary + QA + Publish

## High-Level Comparison

| Current built stage | Recommended lending-fund stage(s) | Keep / change |
| --- | --- | --- |
| Intake | 1. Source Package | Keep, but narrow to draft + uploads |
| SEC | 2. SEC + Issuer + Offering | Expand |
| Team | 8. Sponsor Trust | Keep, but refocus |
| Overview | 3. Classification | Narrow |
| Key Details | 4. Static Terms, 5. Fees, 6. Historical Performance, 7. Current Portfolio Snapshot | Split into specialized pages |
| Risk & Sources | 9. Risks, 10. Summary + QA + Publish | Replace freeform approach |
| Summary | 10. Summary + QA + Publish | Keep, but make it much more powerful |

## Recommended Lending-Fund Deal Card

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

### Why this is my current recommendation

- Row 1 is all investor mechanics
- Row 2 mixes structure, diversification, sponsor trust, and vintage
- it reflects your latest priorities
- it avoids trying to force `fees` into one metric tile
- it avoids using `equityMultiple`

### What moves off the card

- Fees
- LP/GP Split
- Auditing
- Current leverage
- Current weighted average LTV

Those should still appear on the deal page.

## Taxonomy Decisions For Lending Funds

### Strategy

Use one top-level strategy value:

- `Private Debt / Credit`

### Underlying exposure types

Use a new multi-select field:

- `underlyingExposureTypes`

Suggested values:

- Multifamily
- Single Family
- Commercial Real Estate
- Industrial
- Retail
- Office
- Hospitality
- Self Storage
- Land
- Medical Receivables
- Aviation
- Education
- Consumer
- Small Business
- Equipment
- Mixed Portfolio
- Other

### Offering type vs offering status

Keep both.

- `offeringType` = 506(b), 506(c), etc.
- `offeringStatus` = Open to Invest, Evergreen, Paused, Closed, etc.

Recommended UX:

- auto-fill `availableTo` from `offeringType`
- still allow manual override

## Page 1 Mockup: Source Package

### Purpose

Create the deal draft and upload the source package before any SEC verification runs.

### Exact page title

`Start The Deal Review`

### Exact page description

`Start with the deal basics and upload the source documents. When you continue, we’ll run the SEC search and take you to filing confirmation.`

### Layout

```text
------------------------------------------------------------
Step 1 of 10  |  Start The Deal Review
Start with the deal basics and upload the source documents...

[Main section: Source Package]
- Deal Name
- Sponsor / Manager
- Sponsor Website
- Upload Deck
- Upload PPM

[Footer]
[Save Draft]   [Continue]
------------------------------------------------------------
```

### Fields

- Deal Name
- Sponsor / Manager
- Sponsor Website
- Deck upload
- PPM upload

### Notes

- On continue, the app should run the SEC search automatically
- This is mostly the current intake page with better wording

## Page 2 Mockup: SEC + Issuer + Offering

### Purpose

Confirm the SEC filing details and legal structure after the source package is uploaded.

### Exact page title

`Confirm The SEC Filing And Offering`

### Exact page description

`Review the SEC match, confirm the issuer and GP entities, and lock in the offering structure before we move into fund terms.`

### Layout

```text
------------------------------------------------------------
Step 2 of 10  |  Confirm Issuer And Offering Structure

[Section: Legal Entities]
- Issuer Entity
- GP Entity
- Sponsor Entity
- SEC Entity Name
- CIK

[Section: Offering Structure]
- Offering Type
- Available To (auto-filled, editable)
- Offering Status
- Date Of First Sale
- Total Amount Sold
- Total Investors

[Footer]
[Back]   [Save]   [Continue]
------------------------------------------------------------
```

### Fields

- Issuer Entity
- GP Entity
- Sponsor Entity
- SEC Entity Name
- CIK
- Offering Type
- Available To
- Offering Status
- Date Of First Sale
- Total Amount Sold
- Total Investors

## Page 3 Mockup: Classification

### Purpose

Lock the deal into the lending-fund branch and classify what it actually does.

### Exact page title

`Classify The Fund`

### Exact page description

`Set the branch, lending strategy, and investing geography so the rest of the workflow asks the right questions.`

### Layout

```text
------------------------------------------------------------
Step 3 of 10  |  Classify The Fund

[Section: Branch]
- Branch: Lending Fund

[Section: Strategy]
- Strategy: Lending

[Section: Investing Geography]
- Multi-select by state
- Select All toggle
- deselect any states not included
- if nationwide, start with All selected

[Footer]
[Back]   [Save]   [Continue]
------------------------------------------------------------
```

### Fields

- Branch
- Strategy
- Investing Geography (state multi-select)

## Page 4 Mockup: Static Terms

### Purpose

Capture the durable terms that belong on the card and page.

### Exact page title

`Capture The Static Terms`

### Exact page description

`These are the terms an investor expects to stay consistent unless the fund documents change.`

### Layout

```text
------------------------------------------------------------
Step 4 of 10  |  Capture The Static Terms

[Row 1]
- Minimum
- Lockup
- Redemption Frequency
- Distribution Frequency

[Row 2]
- Preferred Return
- Auditing
- Fund Founded Year

[Row 3: Additional Details]
- LP/GP Split
- Offering Type
- Available To
- Additional term notes

[Footer]
[Back]   [Save]   [Continue]
------------------------------------------------------------
```

### Fields

- Minimum
- Lockup
- Redemption Frequency
- Distribution Frequency
- Preferred Return
- Auditing
- Fund Founded Year
- LP/GP Split
- Offering Type
- Available To
- Additional term notes

## Page 5 Mockup: Fees

### Purpose

Collect all fees as structured rows instead of collapsing them into one summary.

### Exact page title

`Break Out The Fee Structure`

### Exact page description

`Fees are not one field. Add each fee as its own row so the deal page can show them clearly.`

### Layout

```text
------------------------------------------------------------
Step 5 of 10  |  Break Out The Fee Structure

[Fee table]
| Fee Type | Amount | Type | Frequency | Applies To | Notes |
|----------|--------|------|-----------|------------|-------|
| Mgmt     |        | %    | Annual    | NAV        |       |

[+ Add Fee Row]

[Optional summary]
- Fee Notes

[Footer]
[Back]   [Save]   [Continue]
------------------------------------------------------------
```

### Suggested fee types

- Management Fee
- Performance / Incentive Fee
- Origination Fee
- Servicing Fee
- Administrative Fee
- Redemption Fee
- Expense Load / Fund Expenses
- Other

## Page 6 Mockup: Historical Performance

### Purpose

Capture the full annual return history using year columns for the team, then normalize it in the app.

### Exact page title

`Enter Historical Performance`

### Exact page description

`Use completed-year returns only. These numbers drive the lending-fund hero chart and should reflect net annual return to LPs.`

### Layout

```text
------------------------------------------------------------
Step 6 of 10  |  Enter Historical Performance

Return Basis: [Net Annual Return To LPs]
Source:       [Deck / PPM / Sponsor Report / Other]

| Metric                     | 2018 | 2019 | 2020 | 2021 | 2022 | 2023 | 2024 | 2025 |
|---------------------------|------|------|------|------|------|------|------|------|
| Net annual return to LPs  |      |      |      |      |      |      |      |      |

Notes / Restatements:
[textarea]

[Footer]
[Back]   [Save]   [Continue]
------------------------------------------------------------
```

### Fields

- Return Basis
- Source
- Year columns through latest completed year
- Notes / Restatements

## Page 7 Mockup: Current Portfolio Snapshot

### Purpose

Capture the current state of the fund as of a specific date.

### Exact page title

`Capture The Current Portfolio Snapshot`

### Exact page description

`These numbers change over time. Every field on this page should be true as of the same snapshot date.`

### Layout

```text
------------------------------------------------------------
Step 7 of 10  |  Capture The Current Portfolio Snapshot

Snapshot As Of Date: [MM / DD / YYYY]

[Row 1]
- Current Fund Size
- Max Fund Size
- Current Loan Count
- Current Weighted Avg LTV

[Row 2]
- Manager AUM
- Max Allowed LTV
- Current Leverage
- Max Allowed Leverage

[Footer]
[Back]   [Save]   [Continue]
------------------------------------------------------------
```

### Fields

- Snapshot As Of Date
- Current Fund Size
- Max Fund Size
- Current Loan Count
- Current Weighted Avg LTV
- Manager AUM
- Max Allowed LTV
- Current Leverage
- Max Allowed Leverage

## Page 8 Mockup: Sponsor Trust

### Purpose

Capture the manager-level trust signals and contactability.

### Exact page title

`Confirm Sponsor Trust Signals`

### Exact page description

`This page is about the manager, not the fund snapshot. Use it to confirm who is behind the offering and how investors can reach them.`

### Layout

```text
------------------------------------------------------------
Step 8 of 10  |  Confirm Sponsor Trust Signals

[Section: Firm]
- Firm Founded Year
- Company Website (read-only if already filled)

[Section: Fund]
- Fund Founded Year

[Section: Contacts]
- CEO / Operator Lead
- IR Contact
- IR Email
- Calendar Link

[Footer]
[Back]   [Save]   [Continue]
------------------------------------------------------------
```

### Fields

- Manager AUM
- Firm Founded Year
- Fund Founded Year
- CEO / Operator Lead
- IR Contact
- IR Email
- Calendar Link

### Notes

- `Manager AUM` is collected on the snapshot page because you want it treated as a point-in-time field
- `Fund Founded Year` should be the version shown on the card

## Page 9 Mockup: Risks

### Purpose

Use a standardized risk taxonomy instead of relying on freeform prose.

### Exact page title

`Tag The Key Risks`

### Exact page description

`Choose the risks that actually apply to this fund. Add notes only when the standard tags are not enough.`

### Layout

```text
------------------------------------------------------------
Step 9 of 10  |  Tag The Key Risks

[Risk taxonomy multi-select]
[ ] Credit Risk
[ ] Default Risk
[ ] Concentration Risk
[ ] Liquidity Risk
[ ] Leverage Risk
[ ] Rate / Interest Rate Risk
[ ] Deployment Risk
[ ] Sponsor / Manager Risk
[ ] Valuation Risk
[ ] Extension Risk
[ ] Regulatory / Compliance Risk
[ ] Servicing / Operational Risk
[ ] Collateral Risk
[ ] Geographic Concentration Risk
[ ] Sector Concentration Risk

Optional Notes:
[textarea]

[Footer]
[Back]   [Save]   [Continue]
------------------------------------------------------------
```

### Fields

- Risk Tags
- Optional Notes

### Notes

- This replaces the current vague narrative-heavy risk capture model
- the taxonomy can grow over time as you review more PPMs

## Page 10 Mockup: Summary + QA + Publish

### Purpose

Give you one editable page to inspect the full record, open the rendered surfaces, and publish.

### Exact page title

`Review Everything Before Publish`

### Exact page description

`Edit any section inline, open the live deal page in a new tab, and only publish when the record looks right.`

### Layout

```text
------------------------------------------------------------
Step 10 of 10  |  Review Everything Before Publish

[Top actions]
[Open Deal Page In New Tab]  [Open Deal Card Preview]  [Save Draft]

[Section summaries - all editable inline]
- SEC + Offering
- Classification
- Static Terms
- Fees
- Historical Performance
- Current Portfolio Snapshot
- Sponsor Trust
- Risks

[Narrative]
- Short Summary
- Investment Strategy
- Primary Source Context

[Publish checklist]
- SEC/entity resolved or overridden
- Required terms present
- Historical returns present
- Snapshot dated
- Card renders
- Deal page renders

[Footer]
[Back]   [Save]   [Publish]
------------------------------------------------------------
```

### Fields

- Inline edit access to all major sections
- Short Summary
- Investment Strategy
- Primary Source Context
- Publish checklist state

## My Recommendation Right Now

If we keep this efficient, I would build the 10-step lending-fund flow in this order:

1. Source Package
2. SEC + Issuer + Offering
3. Classification
4. Static Terms
5. Fees
5. Historical Performance
6. Current Portfolio Snapshot
7. Sponsor Trust
8. Risks
9. Summary + QA + Publish

That said, because `Fees` is structurally different from the other static terms, I do still think it deserves its own dedicated page in the ideal 10-step version.

## Immediate Comparison To What’s Already Built

### Reusable from the current product

- SEC verification stage
- Team contacts stage
- onboarding shell, progress rail, sidebar
- field renderer
- summary concept

### Needs to be added or reshaped

- dedicated fees page
- dedicated historical performance page
- dedicated current snapshot page
- lending-specific classification with `underlyingExposureTypes`
- risk taxonomy page
- richer summary page with live preview links
- lending-fund card metric ordering

## Open Questions I Still Think Matter

1. Should `Auditing` appear on the card, or only on the page?
2. Do you want `Loan Count` on the card even when slightly stale, or only when the snapshot date is recent?
3. Should the card use `Manager AUM` or `Fund Founded` if one of them is missing and you only want to show 8 tiles?
4. Do you want `LP/GP Split` to stay page-only for lending funds?

## Best Next Step

Turn this mockup doc into an implementation matrix:

- field / concept
- exact UI label
- page number
- data type
- required vs optional
- source
- current schema support
- needed backend or frontend change

That will give you the exact build sequence.
