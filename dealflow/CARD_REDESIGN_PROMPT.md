# Live Deals Card Redesign — Full Implementation Prompt

You are a senior product engineer working inside an existing web app (`dealflow/index.html`) that has deal cards in a "Live Deals" tab. Your task is to modify the existing deal card components for BOTH card types: specialized credit/debt fund cards AND standard equity cards.

The app is a single HTML file with inline CSS and JS. It uses Chart.js for charting and fetches deal data from Airtable.

---

## SCOPE OF WORK

There are TWO card types in the grid view, plus a feed view card:

1. **Credit/Debt Fund Card** — specialized card for lending/credit/debt-oriented funds
2. **Equity Card** — standard card for all other deals (syndications, equity funds, development, etc.)
3. **Feed Card** — single-column list view card (both types use the same feed card template)

All three need updates as described below.

---

## CARD TYPE CLASSIFICATION

### Credit/Debt Fund Card — apply to:
- Deals where `instrument === 'Debt'`
- Deals where `strategy === 'Lending'`
- Deals where `assetClass === 'Lending'`
- Deals where `assetClass` contains "credit" or "debt"
- Deals where `investmentName` contains "debt fund", "credit fund", or "income fund" AND has lending/debt signals (e.g., instrument is debt, strategy is lending, or debtPosition exists)
- Any deal that is effectively a debt-oriented vehicle with annual return history

### Equity Card — apply to everything else:
- Equity funds, venture funds, growth funds
- Direct real estate syndications
- Development deals
- Operating businesses
- Anything without credit/debt/lending characteristics

---

## GLOBAL REQUIREMENTS (apply to ALL cards)

### Action Buttons
- Every card (grid and feed view) has exactly ONE action row at the bottom
- Two buttons only: **Skip** (left) and **Save** (right)
- Skip triggers `setDealStage(deal.id, 'passed')` then `renderAll()`
- Save triggers `setDealStage(deal.id, 'interested')` then `renderAll()`
- Skip button: outline style, X icon, secondary text color
- Save button: primary/green style, bookmark icon, white text
- Do NOT use "Pass", "Interested", "View GP", "View Deal", or "Track"
- Do NOT render two rows of action buttons
- Do NOT duplicate Skip/Save

### Removed Elements (do NOT include on any card)
- No "Evergreen" badge or pill
- No "New" dropdown or stage selector dropdown on the card
- No "Strong Match" / "Partial Match" / "Low Data" badge or toggle
- No Status dropdown filter in the Live Deals filter bar
- No "Core/Stabilized" option in the Strategy filter

### Navigation
- Clicking the card body navigates to `deal.html?id=${deal.id}`
- Action buttons use `event.stopPropagation()` to prevent navigation when clicking Skip/Save

### Stats Bar
- Show only: **Total Deals: {count}** and **Avg Target IRR: {pct}%**
- On iOS (detected via `document.documentElement.classList.contains('cap-ios')`), use shorter labels: "Deals:" and "Avg IRR:"
- Do not show Total Equity Raised, Funds count, or Syndications count

---

## CREDIT/DEBT FUND CARD — DETAILED SPEC

### Structure (top to bottom):

#### 1. Hero Section (dark gradient background)

**Badges row** at top of hero:
- Primary badge: "LENDING" or "CREDIT" based on classification:
  - lending, debt fund, real estate debt, trust deed → "LENDING"
  - private credit, specialty finance, credit opportunities, income fund → "CREDIT"
- Secondary badge: deal type (usually "Fund" or "Syndication")
- Audit badge (right-aligned): "Audited" or "Unaudited" — only show if `deal.financials` is explicitly one of these values. If missing, hide entirely.
- All badges use the `.credit-badge` pill style (small uppercase, semi-transparent background, white text)

**Performance Chart** (replaces hero image):
- Bar chart showing the fund's annual net return by year
- Show up to the last 4-5 available years in chronological order (e.g., 2022, 2023, 2024, 2025)
- Each bar = this fund's annual return for that year
- Overlay a dashed/subtle line graph = peer average annual return of similar credit/debt funds in the database for each year

**Chart details:**
- Bars are the dominant visual element — green, with the most recent year bar slightly brighter/darker
- Peer average line is secondary — white/semi-transparent, thin, dashed or smooth, with `tension: 0.3`
- Y-axis should NOT start at 0. Start the Y-axis a couple percentage points below the lowest data point (e.g., if lowest return is 8%, start at ~6%). This creates visible variation between bars.
- Y-axis max = highest value + ~2 percentage points, rounded up cleanly
- Y-axis ticks show percentages (e.g., "8%", "10%", "12%")
- X-axis shows year labels
- Subtle grid lines, no chart junk, no toolbars, no dropdowns
- No tooltips, no interactive hover on chart (the card itself is the click target)

**Value labels above EVERY bar** (not just the latest):
- Small dark pill/badge above each bar showing the return value (e.g., "8.3%", "10.2%")
- All bars get a label pill, but the most recent year's pill can be slightly more prominent (darker background)
- Font: bold 9px, white text on dark background

**Legend strip** below chart:
- Single line: `[green square] Fund return` and `[white line] Peer avg`
- Only show peer avg legend if peer data actually exists
- If no peer data, show bars only and omit peer legend

**Empty state**: If fund has fewer than 2 annual return data points, show "Annual return history unavailable" in the hero area instead of the chart

#### 2. Card Body

**Fund name** — bold title

**Manager name** — subtitle, muted color

**Strategy sentence** — one sentence describing what the fund does, max ~120 characters
- Source priority: `investmentStrategy` field → first sentence if clean → taxonomy-based fallback
- Fallback examples: "Private credit fund focused on income-oriented lending." or "Debt fund focused on contractual income opportunities."
- No jargon overload, no marketing fluff, no invented text

**Metrics row** — 4 columns:
| Target Income | Minimum | Lockup | Distribution |
|---|---|---|---|
| From targetIRR, preferredReturn, or cashOnCash (first available) | `$50K`, `$100K`, etc. | `1 yr`, `12 mo`, `Open-ended`, etc. | `Monthly`, `Quarterly`, etc. |

- Label: "Target Income" (not "Pref Return" or "Target IRR")
- Label: "Distribution" (not "Redemption")
- If any value is missing, show em dash "—"
- Target Income value in green color

**Info row** — 2 columns:
| Manager Size | Fund Founded |
|---|---|
| Tier label + range below | Year the fund started |

- Manager Size tiers:
  - `fundAUM >= $1B` → **Institutional** with `($1B+)` on line below
  - `fundAUM >= $100M` → **Mid-Size** with `($100M–$1B)` on line below
  - `fundAUM < $100M` → **Emerging** with `(<$100M)` on line below
  - If no AUM data → "Coming Soon" in muted text
- The parenthetical range goes UNDERNEATH the tier name (not next to it)
- Fund Founded: show `deal.mcFoundingYear` if available, otherwise "Coming Soon"

#### 3. Footer
- Skip / Save buttons as described in global requirements

---

## EQUITY CARD — DETAILED SPEC

### Structure (top to bottom):

#### 1. Hero Section (gradient background based on asset class)

**Asset-class-specific gradient + SVG illustration:**
Each asset class gets a unique color gradient and a subtle architectural SVG icon:
- Multi Family → blue gradient with apartment building icon
- Industrial → dark gray gradient with factory/warehouse icon
- Self Storage → amber/gold gradient with storage units icon
- Hotels/Hospitality → purple gradient with hotel building icon
- Short Term Rental → teal gradient with house + sun icon
- RV/Mobile Home Parks → green gradient with park homes icon
- Mixed-Use → blue-gray gradient with mixed buildings icon
- Retail → custom gradient with storefront icon
- Land → earthy gradient with landscape icon
- Oil & Gas / Energy → dark gradient with energy icon
- Business/Other → neutral gray gradient with office building icon
- NNN → custom gradient with trend line icon
- Default fallback → blue gradient with generic building icon

**Badges** at top of hero:
- Asset class badge (e.g., "MULTI FAMILY", "SELF STORAGE")
- Deal type badge (e.g., "SYNDICATION", "FUND")
- Strategy badge if not "Value-Add" (e.g., "DEVELOPMENT")

**SVG icon** — centered in the hero, large but low opacity (decorative)

**Target IRR overlay** — large bold percentage in bottom-left of hero with "TARGET IRR" label underneath (only if `deal.targetIRR` exists)

#### 2. Card Body

**Deal name** — bold title

**Manager name + location** — subtitle: `{managementCompany} · {location}`

**Strategy sentence** — same logic as credit cards but using `getEquityStrategy(deal)`

**Metrics row** — 4 columns:
| Equity Multiple | Minimum | Hold Period | Pref Return |
|---|---|---|---|
| `2.04x`, `3.30x`, etc. | `$50K`, `$100K`, etc. | `5 yr`, `12 mo`, etc. | `8.0%`, etc. |

- Equity Multiple value in green color
- If any value missing, show "—"

**Info row** — 2 columns:
| Manager Size | Full Cycle Deals |
|---|---|
| Coming Soon | Coming Soon |

- Both show "Coming Soon" in muted text (these features are not yet tracked)
- When Manager Size data becomes available, follow same tier logic as credit cards (Institutional/Mid-Size/Emerging with range underneath)

#### 3. Footer
- Skip / Save buttons as described in global requirements

---

## FEED VIEW CARD

The feed view (single-column list) uses a different card template. Requirements:
- Hero image area with asset placeholder (gradient + icon) or actual image if `deal.imageUrl` exists
- Badges overlay on hero (asset class, deal type)
- Card body with deal name, manager, and key metrics (Target IRR, Pref Return, Minimum, Hold Period)
- Action buttons: **Skip** and **Save** (same wiring as grid cards)
- Do NOT use "Pass" or "Interested" labels in feed view either

---

## DATA LOGIC

### Annual Return Data for Credit Cards

Build a return series: `[{year, value}, ...]`

Sources in priority order:
1. `debtFundData` array (external enrichment) — look for `_return2022`, `_return2023`, etc.
2. Deterministic generation from `deal.targetIRR` with seeded variance (so values are stable per deal per year)
3. If no targetIRR, no returns available

Rules:
- Numeric percentages only (if value < 1, multiply by 100)
- Reject invalid/null values
- Sort ascending by year
- Take up to last 4-5 entries

### Peer Group Average

For each displayed year, compute the average annual return of other eligible credit/debt funds:
- Only include credit/debt/lending funds (same `isCreditFund` check)
- Exclude the current fund from the average
- For each year: collect valid returns from peer funds
- If fewer than 3 peers have data for a given year, treat that year's peer avg as null
- Only draw the peer line through years that have valid peer averages
- If no peer data at all, omit the peer line and its legend entry

### Manager Size Tier

Based on `deal.fundAUM` (preferred) or `deal.offeringSize` (fallback):
- `>= $1,000,000,000` → Institutional ($1B+)
- `>= $100,000,000` → Mid-Size ($100M–$1B)
- `< $100,000,000` → Emerging (<$100M)
- No data → show "Coming Soon"

---

## MISSING DATA HANDLING

This is critical. Never invent or hallucinate data.

| Data Point | If Missing |
|---|---|
| Annual return data (< 2 points) | Show "Annual return history unavailable" in hero, no chart |
| Peer average data | Show bars only, hide peer line and legend |
| Audit status | Hide audit badge entirely |
| Strategy text | Use taxonomy-based fallback sentence |
| Any metric (IRR, minimum, etc.) | Show em dash "—" in that cell |
| Manager Size (no AUM data) | Show "Coming Soon" |
| Fund Founded year | Show "Coming Soon" |
| Full Cycle Deals | Always "Coming Soon" (not tracked yet) |
| Hero image for equity cards | Use gradient + SVG icon based on asset class |

---

## VISUAL DESIGN REQUIREMENTS

- Rounded corners, clean white card body, soft premium shadows
- Subtle blue/dark gradient hero areas
- Pill/badge tags at top — small uppercase, semi-transparent
- Premium fintech feel — institutional but approachable
- Scannable in 3-5 seconds
- High signal / low clutter
- Clean typography (Plus Jakarta Sans)
- Cards should feel like a cohesive product — credit cards are an evolution of equity cards, not a different product

### Color Palette
- Primary green: `var(--green)` / `#51BE7B` / `rgba(81,190,123,...)`
- Dark background: `#0A1E21` range
- Card background: `var(--bg-card)` (white in light mode)
- Text: `var(--text-dark)`, `var(--text-secondary)`, `var(--text-muted)`
- Borders: `var(--border)`, `var(--border-light)`

### Responsive
- Grid view: 3 columns on desktop, compresses gracefully on tablet/mobile
- Chart labels, metrics, and badges should not overlap at smaller widths
- Action row stays intact at all sizes
- iOS-specific adjustments scoped under `.cap-ios` class

---

## FILTER BAR

The Live Deals filter bar should include:
- "Apply My Buy Box" toggle button
- Asset Class dropdown (Multi Family, Industrial, Self Storage, Hotels/Hospitality, Lending, RV/Mobile Home Parks, Business/Other, Mixed-Use, Short Term Rental, etc.)
- Deal Type dropdown (Fund, Syndication)
- Strategy dropdown (Value-Add, Lending, Development) — no "Core/Stabilized"
- Sort dropdown (Newest, Highest IRR, Lowest Minimum, A-Z)
- Search input
- Clear Filters button
- "+ Add Deal" button
- Deal count display

**Removed from filter bar:**
- No Status dropdown filter
- No "Core/Stabilized" strategy option

---

## IMPLEMENTATION CHECKLIST

1. Find the current `renderCard`, `renderCreditCard`, `renderFeedCard` functions
2. Implement `isCreditFund(deal)` classification
3. Implement `creditBadgeLabel(deal)` — returns "LENDING" or "CREDIT"
4. Implement `getCreditFundReturns(deal)` — builds annual return series
5. Implement `computePeerAverages(excludeDealId)` — computes year-by-year peer averages
6. Implement `getAssetHero(assetClass)` — returns gradient + SVG icon for each asset class
7. Implement `getManagerTier(deal)` — returns { label, range, tier }
8. Implement `getEquityStrategy(deal)` and `getCreditStrategy(deal)` — strategy sentence extractors
9. Implement `formatLockup(deal)` and `formatDistribution(deal)` — human-readable formatting
10. Implement `getTargetIncome(deal)` — returns formatted target income string
11. Build `renderCreditCard(deal)` with chart hero, metrics, info row, skip/save
12. Build `renderCard(deal)` for equity cards with gradient hero, metrics, info row, skip/save
13. Build `initCreditCharts()` to initialize Chart.js after DOM render
14. Update `renderFeedCard(deal)` with Skip/Save buttons
15. Update stats bar to show only Total Deals + Avg Target IRR
16. Remove Status filter from filter bar
17. Add CSS for `.credit-card-hero`, `.credit-badge`, `.equity-card-hero`, `.equity-hero-badges`, `.equity-hero-icon`, `.equity-hero-irr`, `.credit-card-body`, `.credit-card-metrics`, `.equity-card-info-row`, `.credit-chart-container`, `.credit-chart-legend`, etc.
18. Ensure Chart.js is loaded (CDN script tag)
19. Call `initCreditCharts()` after each render cycle via `requestAnimationFrame`

---

## SUCCESS CRITERIA

The task is successful if:
- Only eligible credit/debt/lending funds get the specialized credit card with chart hero
- All other deals get the equity card with gradient + SVG hero
- The chart shows fund annual returns as bars with value labels above EVERY bar
- Y-axis starts above 0 to show visible variation between bars
- Peer average overlay line shows correctly when data exists
- Missing data is handled gracefully everywhere
- "Distribution" replaces "Redemption" on credit cards
- "Target Income" is the label (not "Pref Return") on credit cards
- Manager Size shows tier + range on separate lines when data exists, "Coming Soon" when not
- Fund Founded shows year or "Coming Soon" on credit cards
- Full Cycle Deals shows "Coming Soon" on equity cards
- All cards have Skip/Save (not Pass/Interested, not View GP/View Deal)
- Only one row of action buttons per card
- No Evergreen badge, no New dropdown, no match badges, no Status filter
- Cards feel premium, institutional, and scannable in 3-5 seconds
