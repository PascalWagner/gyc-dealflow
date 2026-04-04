# Lending Fund Review Brief

> Sandbox audit update (2026-04-04)
>
> This branch hardens sponsor-linkage PATCH behavior and adds empty-array fallback inference for `riskTags`, `investingStates`, and `underlyingExposureTypes`. The deployed sandbox still returns empty `riskTags` for the canonical review deal, and some GP-visible review helpers still depend on admin-only `/api/deal-cleanup` actions.

## Purpose

Define the right product, data, and review-flow contract for `lending_fund` deals.

This brief is specifically for lending funds, not all deals.

The goal is:

- one real lending fund can be reviewed end to end
- the deal card looks right
- the deal page looks right
- the team can actually collect the data without friction
- time-sensitive fields are dated so they do not become misleading

## What We’ve Decided

### 1. Lending-fund hero

- no cover image is required
- the hero should show historical annual returns
- only completed years should be shown
- no YTD row for the current year
- return basis = net annual return to LPs

### 2. Card philosophy

The card should emphasize:

- static terms
- liquidity
- trust

It should not emphasize:

- unstable snapshot metrics without dates
- equity-deal concepts that do not fit lending funds

### 3. Naming

- product-facing label `financials` should become `Auditing`
- `cashOnCash` should not be the primary lending-fund field
- `investmentStrategy` is the right narrative field
- `fees` should be canonical, but it should not be a single number pretending to be one term

### 4. SEC review

- SEC/entity review should be at the beginning
- SEC mismatch is not an absolute blocker
- there should be an override path
- but SEC/entity review is still the primary legitimacy gate

## Candidate Deal Card Metrics

These are the realistic candidates for the 8 metric slots on a lending-fund card.

### Static / stable terms

- Minimum
- Lockup
- Redemption
- Distribution
- Preferred Return
- LP/GP Split
- Offering Type
- Auditing

### Sponsor / trust signals

- Manager AUM
- Founded
- Manager track record
- CEO / operator presence

### Snapshot metrics

- Current Loan Count
- Current Weighted Avg LTV
- Current Leverage
- Current Fund Size
- Max Fund Size
- Max Allowed LTV
- Max Allowed Leverage

### Metrics I would avoid on the card for now

- Equity Multiple
- Cash on Cash
- Current Avg LTV without an as-of date
- Current Leverage without an as-of date
- Fees as a single card metric if it is really a bundle of different fees

## Recommended Lending-Fund Deal Card

### Recommended card

#### Hero

- last 5 completed years of net annual return to LPs

#### Row 1

- Minimum
- Lockup
- Redemption
- Distribution

#### Row 2

- Preferred Return
- Loan Count
- Auditing
- Founded

### Why this is the best current recommendation

- Row 1 answers investor mechanics immediately
- Row 2 answers structure, diversification, and trust
- it avoids pretending a snapshot metric is timeless
- it chooses the one directional portfolio metric that is still useful at a glance
- it avoids forcing `fees` into one tiny tile
- it uses `Preferred Return`, which is more like a real term than `fees`

### Strong alternative if you want more structure and less sponsor emphasis

#### Row 1

- Minimum
- Lockup
- Redemption
- Distribution

#### Row 2

- Preferred Return
- LP/GP Split
- Auditing
- Offering Type

This version is cleaner if you want the card to feel more like a term sheet and less like a sponsor summary.

### Sponsor-heavy alternative

#### Row 2

- Preferred Return
- Auditing
- Manager AUM
- Founded

This version is better only if you decide the card should lean harder into sponsor trust than diversification.

## Why `Fees` Is Not The Right Card Metric

You called out the key nuance correctly:

- `Minimum` is one value
- `Lockup` is one value
- `Redemption` is one dropdown
- `Fees` is not one value

It is a category with multiple entries.

For lending funds, `fees` should be a structured list, not a single metric tile.

### Recommendation

Use `fees` on the deal page as a structured section, not on the card.

Possible fee types:

- Management Fee
- Performance / Incentive Fee
- Origination Fee
- Servicing Fee
- Administrative Fee
- Redemption Fee
- Expense Load / Fund Expenses
- Other

## Asset Class Vs Strategy For Lending Funds

This is one of the most important taxonomy decisions.

### Recommendation

For lending funds:

- `strategy` should capture the high-level strategy
- `asset class` should not try to do all the work
- add a separate multi-select for what the fund lends against

### Recommended model

#### Strategy

Use a single value such as:

- Lending
- Private Debt / Credit

If you want one, I would use:

- `Private Debt / Credit`

#### Underlying collateral / exposure focus

Add a new multi-select field for the collateral or exposure type.

Suggested field names:

- `lendingFocus`
- `collateralTypes`
- `underlyingExposureTypes`

I would recommend:

- `underlyingExposureTypes`

### Suggested collateral / exposure types

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

### Why this model is better

It separates:

- what kind of product this is
- what kinds of assets or receivables it is exposed to

That is much better than trying to force everything into one `assetClass` field.

## Offering Type Vs Offering Status

These are different and both matter.

### Offering type

This is the securities structure:

- 506(b)
- 506(c)
- Reg A
- other structures if needed

### Offering status

This is the lifecycle state:

- Open to Invest
- Evergreen
- Coming Soon
- Paused
- Fully Funded
- Closed
- Completed

### Recommendation

Keep both.

Do not collapse offering status into 506(b)/506(c).

### Available-to logic

You can auto-fill `availableTo` from `offeringType`, but I would not make it fully implicit forever.

Recommended behavior:

- 506(c) => auto-fill `Accredited Investors`
- 506(b) => auto-fill `Accredited Investors` by default, with manual override allowed if you want to reflect the sophisticated-non-accredited nuance

This keeps the workflow simple without pretending the legal nuance does not exist.

## Historical Performance Step

Your instinct about the table is right.

### Recommendation

Use a dedicated Historical Performance step with a wide year-based table for intake.

Example shape:

| Field | 2018 | 2019 | 2020 | 2021 | 2022 | 2023 | 2024 | 2025 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Net annual return to LPs |  |  |  |  |  |  |  |  |

Additional fields for that step:

- return basis
  - default to `Net annual return to LPs`
- source
- notes / restatements

### Important recommendation

Operationally use year columns.

In the app model, normalize those into a structured return series.

## Current Portfolio Snapshot

This should be a dedicated step and a dedicated deal-page section.

### Recommended fields

- Portfolio Snapshot As Of Date
- Current Fund Size
- Max Fund Size
- Current Loan Count
- Current Weighted Avg LTV
- Max Allowed LTV
- Current Leverage
- Max Allowed Leverage

### Notes

- `Current Loan Count` is worth surfacing because it gives diversification context
- but it should always be tied to an as-of date on the deal page
- `Manager AUM` should not live in the fund snapshot block because it is manager-level, not fund-level

### Why `weighted average LTV` is better than simple average

Simple average:

- every loan counts equally

Weighted average:

- larger loans count more

For funds, weighted average LTV is usually the more meaningful number because it reflects actual capital exposure better.

### Recommendation

Use:

- `Current Weighted Avg LTV`

not:

- simple average LTV

## AUM, NAV, Capital Raised, And Fund Size

These are not the same thing.

### Manager AUM

- sponsor-level metric
- total assets the manager oversees

### Net Asset Value (NAV)

- fund-level metric
- assets minus liabilities

### Capital Raised

- equity raised from investors
- not the same as NAV

### Current Fund Size

This needs a definition.

My recommendation:

- use `Current Fund Size` as the fund-level current gross assets or portfolio size as of a date

If you want to separately track NAV, do that explicitly.

### Recommendation

Do not treat NAV and AUM as the same thing.

Do not treat Capital Raised and NAV as the same thing.

Suggested model:

- `managerAUM`
- `capitalRaisedToDate`
- `currentFundSize`
- `fundNAV` if you want it explicitly
- `maxFundSize`

If you want `Manager AUM` on the card, treat it as a sponsor trust signal.
If you want it on the page, put it in the sponsor section with an as-of date when available.

## Leverage Definition

You suggested debt-to-equity, which is a reasonable starting point.

### Recommendation

Define:

- `currentLeverage = debt / equity`

and keep that definition consistent.

If you later want a second definition like debt-to-assets, add it explicitly rather than overloading one field.

## Risks

I agree with you that the current narrative-style risk section is not the right long-term model.

### Recommendation

Replace freeform risk capture as the primary model with:

- a standardized risk taxonomy
- multi-select risk tagging
- optional notes

### Suggested first-pass lending-fund risk taxonomy

- Credit Risk
- Default Risk
- Concentration Risk
- Liquidity Risk
- Leverage Risk
- Rate / Interest Rate Risk
- Reinvestment / Deployment Risk
- Sponsor / Manager Risk
- Valuation Risk
- Extension Risk
- Regulatory / Compliance Risk
- Servicing / Operational Risk
- Collateral Risk
- Geographic Concentration Risk
- Sector Concentration Risk

### Recommended capture model

- `riskTags` = multi-select
- `riskNotes` = optional structured notes
- over time, add new risks when needed

This lets you standardize without losing flexibility.

## Recommended Lending-Fund Review Flow

This is the review flow I would recommend now.

### Stage 0: Draft + source package

Collect:

- Deal name
- Sponsor
- Deck
- PPM
- Sponsor website

Purpose:

- create the draft
- attach the core source docs

### Stage 1: SEC + entity resolution

Collect / verify:

- Issuer entity
- Sponsor entity
- GP entity
- SEC filing match
- CIK
- Offering type
- First sale date
- Total amount sold
- Total investors

Decision:

- unresolved = warning / block / override path

### Stage 2: Classification

Collect:

- Branch = `lending_fund`
- Strategy
- Underlying exposure types
- Offering status
- Available to

### Stage 3: Static terms

Collect:

- Minimum
- Lockup
- Redemption frequency
- Distribution
- Preferred return
- LP/GP split
- Auditing
- Fees

### Stage 4: Historical performance

Collect:

- annual net return to LPs by completed year
- source
- notes

### Stage 5: Current portfolio snapshot

Collect:

- as-of date
- current fund size
- max fund size
- current loan count
- current weighted avg LTV
- max allowed LTV
- current leverage
- max allowed leverage

### Stage 6: Sponsor trust

Collect:

- Manager AUM
- Founded year
- CEO / operator lead
- IR contact

Note:

- sponsor website is already captured in Stage 0, so it does not need to be duplicated here

### Stage 7: Risks

Collect:

- risk tags
- optional notes

### Stage 8: Narrative + source context

Collect:

- short summary
- investment strategy
- primary source context

### Stage 9: Summary + QA + publish

This should be an editable summary page.

It should let you:

- edit all major sections inline
- open the deal page in a new tab
- review the rendered card
- review the rendered deal page
- see missing fields clearly
- publish only when ready

## Questions Still Worth Deciding

These are the main unresolved design questions.

1. Should `LP/GP Split` stay on the card, or only on the page?
2. Is `Preferred Return` always meaningful enough for lending funds to deserve a card slot?
3. Do you want `Offering Type` on the card or keep it in badges / page only?
4. Do you want `Manager AUM` on the card even when missing, with a gray `Missing` state?
5. Do you want the snapshot step to support only one latest snapshot for MVP, or should it already support multiple dated snapshots?
6. Do you want to explicitly track `fundNAV` now, or later?
7. Do you want `Loan Count` on the card despite being slightly time-sensitive, or should it live only on the page with the snapshot date?

## Best Next Step

Turn this into an implementation matrix with columns:

- field / concept
- UI label
- type
- static vs snapshot vs historical
- source
- required vs optional
- card / page / both
- current schema support
- needed change

That matrix will become the exact build list for the lending-fund MVP.
