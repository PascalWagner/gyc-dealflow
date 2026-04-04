# GYC Platform — Onboarding, Intake Quiz, Videos & Social Proof

> Sandbox update (2026-04-04)
>
> LP completion is now treated as canonical only when `POST /api/buybox` writes `_markComplete: true` and the server reports `hasBuyBox`. `onboardingComplete` alone is not sufficient for LP redirect decisions. Standalone onboarding still has weaker token-refresh behavior than `/app/*`.
> The deployed sandbox still shows one open integrity drift: `/api/buybox` can surface completion-looking data from fallback sources while `/api/gp-onboarding` reports `hasBuyBox: false`.

## Table of Contents

- [1. Guided Onboarding Flow](#1-guided-onboarding-flow)
  - [Screen 1: Welcome](#screen-1-welcome)
  - [Screen 2: Experience Level](#screen-2-experience-level)
  - [Screen 3: Goal Selection](#screen-3-goal-selection-pick-one)
  - [Screen 4: Your Situation](#screen-4-your-situation)
  - [Screen 5: Your Plan + Deals](#screen-5-your-plan--matching-deals)
- [2. The Three Goal Paths (Detail)](#2-the-three-goal-paths-detail)
  - [Path A: Cash Flow](#path-a-cash-flow)
  - [Path B: Tax Reduction](#path-b-tax-reduction)
  - [Path C: Equity Growth](#path-c-equity-growth)
- [3. New Database Fields Needed](#3-new-database-fields-needed)
- [4. JIT Video Embedding](#4-jit-video-embedding)
  - [Video Source & Action Items](#video-source--action-items)
  - [Embed Locations](#embed-locations)
- [5. Social Proof on Deal Cards](#5-social-proof-on-deal-cards)
- [6. Full Feature List (Running)](#6-full-feature-list-running)
- [7. Next Steps](#7-next-steps)

---

## 1. Guided Onboarding Flow

**Trigger:** First login or account creation. GP progress still centers on `onboardingComplete`, but LP completion is canonically derived from `user_buy_box.completed_at` and `hasBuyBox`.

**Total time:** ~2 minutes across 5 screens.

---

### Screen 1: Welcome

Pascal intro — short video (30 sec) + text.

> Welcome to Grow Your Cashflow
>
> I'm Pascal. I've invested $3.3M across 23 private deals to build
> six-figure passive income. I built this platform to help you do
> the same.
>
> Let's get you set up in about 2 minutes.
>
> **[Get Started →]**

**Video:** GHL → "Start Here!" → "Overview: Welcome to the Program!" (needs YouTube upload)

---

### Screen 2: Experience Level

**"How familiar are you with private investments?"**

| Option | Label | Effect on Platform |
|--------|-------|-------------------|
| A | **I'm brand new** — Never invested outside stocks, 401k, or my home | Show education videos, suggest simple deals, longer tooltips |
| B | **1-3 deals** — I've invested in a syndication or fund before | Some education, balanced suggestions |
| C | **Experienced (4+)** — I know what I'm looking for | Skip education, go straight to deals |

Stored as: `experienceLevel: 'new' | 'intermediate' | 'experienced'`

---

### Screen 3: Goal Selection (Pick ONE)

**"What's your #1 investing goal right now?"**

Three big cards, pick one:

| | Cash Flow | Tax Reduction | Equity Growth |
|---|-----------|---------------|---------------|
| **Headline** | Build passive income | Reduce my tax bill | Grow my wealth |
| **Subtext** | I want predictable monthly/quarterly income from my investments | I'm getting crushed on taxes and want to legally offset my income | I want to 2x or more — I'm playing for appreciation |
| **They enter** | Target annual income: $___/yr | Tax bill to offset: $___K | Capital to grow: $___ over ___ years |
| **Icon** | 💰 | 🏦 | 🚀 |

Each path completely changes:
- Which deals surface first and how they're ranked
- What metrics are emphasized on cards
- What "success" looks like on the dashboard
- What education content is shown

Stored as:
```json
{
  "goal": "cashflow" | "tax" | "growth",
  "goalTarget": 100000
}
```

---

### Screen 4: Your Situation

**"A few quick numbers so I can show you the right deals."**

| # | Question | Format | Why We Ask |
|---|----------|--------|------------|
| 1 | What's your annual income? | Dropdown: $100-250K / $250-500K / $500K-1M / $1-2M / $2M+ | Tax bracket, deal calibration |
| 2 | How much liquid capital can you invest? | Dropdown: $50-100K / $100-250K / $250-500K / $500K-1M / $1M+ | How many deals they need |
| 3 | Max you'd put in a single deal? | Dropdown: $25K / $50K / $100K / $200K / $500K+ | Filters deal minimums |
| 4 | W-2, business owner, or retired? | 3 buttons | Shapes tax strategy, passive vs active income rules |

Stored as:
```json
{
  "annualIncome": "$500K-1M",
  "investableCapital": "$250-500K",
  "maxCheckSize": 100000,
  "employmentType": "w2" | "business_owner" | "retired"
}
```

---

### Screen 5: Your Plan + Matching Deals

Shows a personalized summary based on goal + situation, then deal cards. See [Section 2](#2-the-three-goal-paths-detail) for each path's output.

All paths end with the **Three Paths CTA:**

```
┌─────────────────────┐  ┌─────────────────────┐  ┌─────────────────────┐
│    DO IT MYSELF      │  │    GET COACHING      │  │    EASY BUTTON      │
│                      │  │                      │  │                     │
│  Browse deals,       │  │  Cashflow Academy    │  │  GYC Income Fund    │
│  build your          │  │  1:1 with Pascal     │  │  One check, we      │
│  portfolio           │  │  on your plan        │  │  handle everything  │
│                      │  │                      │  │                     │
│  Free                │  │  $5,000              │  │  $100K minimum      │
│                      │  │                      │  │                     │
│  [Explore Deals →]   │  │  [Learn More →]      │  │  [Learn More →]     │
└─────────────────────┘  └─────────────────────┘  └─────────────────────┘
```

**[Save My Plan & Go to Dashboard →]**
- Auto-builds buy box from answers
- Sets goal + target on dashboard
- Marks onboarding complete

---

## 2. The Three Goal Paths (Detail)

### Path A: Cash Flow

**User said:** "I want $100,000/yr in passive income. I have $400K to invest."

**Plan output:**

> **Your Path to $100,000/yr Passive Income**
>
> You have $400K to deploy. At an average 8-10% yield,
> you'd need $1M-$1.25M fully invested to hit your target.
>
> **Start here:** Deploy your $400K across 4-6 income-focused deals.
> That gets you to ~$32-40K/yr from day one. Reinvest and add
> capital over time to reach your goal.

**Deal ranking for Cash Flow path:**
1. Sort by: yield (preferredReturn or cashOnCash or targetIRR, whichever represents current income)
2. Filter by: deal minimum ≤ user's maxCheckSize
3. Emphasize: Monthly/quarterly distribution frequency
4. Card emphasis: Show **PREF RETURN** and **DISTRIBUTION** prominently, green highlight on yield

**Best deal types for this path:**
- Lending/credit funds (monthly income, 8-12%)
- Preferred equity positions (8-10% current pay)
- NNN / net lease (5-7% stable)
- Income-oriented equity funds with pref returns

---

### Path B: Tax Reduction

**User said:** "I want to offset $200K in taxable income. I'm a W-2 employee making $800K."

**Plan output:**

> **Offset $200K in Taxable Income**
>
> You have $400K to deploy. Private real estate and energy deals
> can generate significant first-year depreciation through cost
> segregation, bonus depreciation, and intangible drilling costs.
>
> **How it works:** A $100K investment in a value-add syndication
> with cost segregation can generate $80-100K+ in first-year
> paper losses — offsetting your W-2 income dollar for dollar
> (if you qualify as an active real estate professional or the
> deal generates passive losses you can use).
>
> **Important:** Passive activity rules matter. W-2 income can only
> be offset by passive losses if you have passive income to offset
> against, OR if you qualify as a real estate professional. Talk to
> your CPA. Some deals (like oil & gas) generate active losses that
> CAN offset W-2 income directly.

**Deal ranking for Tax Reduction path:**
1. **Primary sort: First-year depreciation ratio** (highest first)
   - This is a NEW field: `firstYearDepreciation` — see [Section 3](#3-new-database-fields-needed)
   - Example: 0.80 means $80K depreciation per $100K invested in year 1
2. Secondary sort: Target IRR (still want good returns, not just tax benefits)
3. Filter by: deal minimum ≤ user's maxCheckSize
4. Card emphasis: Show **DEPRECIATION RATIO** prominently with a tax-savings estimate

**Best deal types for this path:**
- Value-add multifamily syndications with cost segregation (60-100% first-year depreciation)
- Ground-up development (bonus depreciation on new construction)
- Oil & gas drilling programs (intangible drilling costs — can offset ACTIVE income, not just passive)
- Opportunity Zone investments (capital gains deferral + elimination)
- Any deal advertising accelerated depreciation or cost seg studies

**Special card treatment for Tax path:**
When a user is on the Tax Reduction path, deal cards should show an additional metric:

```
FIRST-YEAR DEPRECIATION        TAX SAVINGS ESTIMATE
80%                             ~$80K per $100K invested
```

The tax savings estimate = `firstYearDepreciation × investmentMinimum × estimatedTaxRate`

Where estimated tax rate is derived from their income bracket:
- $250-500K income → ~35%
- $500K-1M → ~37%
- $1M+ → ~40%

**Oil & Gas note:** These deals are unique because intangible drilling costs (IDCs) create ACTIVE losses, meaning W-2 employees can use them to offset their salary directly — unlike most real estate passive losses. This should be called out on eligible cards.

---

### Path C: Equity Growth

**User said:** "I have $500K and I want to double it in 5 years."

**Plan output:**

> **Double Your $500K in 5 Years**
>
> Target: 2x equity multiple over 5 years (~15% annualized IRR)
>
> This means targeting deals with strong value-creation upside —
> value-add renovations, development, or operators who buy
> distressed assets and reposition them.
>
> **Trade-off:** Higher growth potential = less current income
> and longer hold periods. These deals typically pay out at
> sale, not monthly.

**Deal ranking for Equity Growth path:**
1. Sort by: Target IRR (highest first) or Equity Multiple (highest first)
2. Filter by: deal minimum ≤ user's maxCheckSize
3. Emphasize: Equity Multiple, Target IRR, Hold Period
4. Card emphasis: Show **EQUITY MULTIPLE** and **TARGET IRR** prominently

**Best deal types for this path:**
- Value-add syndications (repositioning, renovation)
- Development / ground-up construction
- Distressed asset acquisitions
- Growth-oriented funds
- Emerging operators with strong track records but smaller AUM

---

## 3. New Database Fields Needed

### For Tax Reduction Path

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `firstYearDepreciation` | Number (0-1) | First-year depreciation ratio per dollar invested. 0.80 = 80% of investment is depreciable in year 1. | 0.80 |
| `depreciationMethod` | Text | How the depreciation is generated | "Cost segregation", "Bonus depreciation", "IDCs", "Opportunity Zone" |
| `depreciationNotes` | Text | Any caveats or details | "Cost seg study completed. 80% of basis allocated to 5/7/15 year property." |
| `passiveActivityType` | Text | Whether losses are passive or active | "Passive" (most RE), "Active" (oil & gas IDCs) |

### For Social Proof (Future)

| Field | Type | Description |
|-------|------|-------------|
| `viewCount` | Number | How many users have viewed this deal |
| `saveCount` | Number | How many users saved/interested |
| `ddCount` | Number | How many users moved to Due Diligence |
| `portfolioCount` | Number | How many users added to portfolio |

### For Pascal Score (Future)

| Field | Type | Description |
|-------|------|-------------|
| `pascalScore` | Number (1-10) | Pascal's overall rating |
| `pascalScoreNotes` | Text | Pascal's commentary on the deal |

---

## 4. JIT Video Embedding

### Video Source & Action Items

Videos live in **GoHighLevel → Memberships → Cashflow Academy**.

**Pascal's action items:**
1. Export/download each video from GHL
2. Upload to YouTube as **unlisted**
3. Share the unlisted URLs
4. Flag any videos that need to be re-recorded (shorter versions for platform)

### GHL Course Structure (Known)

**Start Here!**
- Overview: Welcome to the Program!
- My Journey
- Course Bonuses

**A – Assess Your Target**
- Overview: Assess Your Target
- Embracing Your Role As A Money Manager
- What Are Alternative Investments?
- 7 Advantages of Alternative Investments

**C – Create An Allocation**
- Overview: Create Your Allocation
- The Money Pie (The Only 3 Outcomes When Investing)
- Funds vs Syndications

*(Need full list of remaining sections)*

### Embed Locations

| # | Where in Platform | Which Video to Embed | When to Show | Format |
|---|-------------------|---------------------|--------------|--------|
| 1 | **Onboarding Screen 1** | "Welcome to the Program!" (trimmed to 30 sec) | First visit | Inline |
| 2 | **Buy Box page** | "Assess Your Target" or custom | First visit to page | Expandable banner |
| 3 | **Deals page** (first interaction) | "What Are Alternative Investments?" | First Skip/Save | Modal or top banner |
| 4 | **Lending filter** | Clip from "The Money Pie" or custom | First time | Inline expandable |
| 5 | **Goals page** | "My Journey" | First visit | Hero section |
| 6 | **DD checklist** | Custom "5 things I check" or ACHIEVE module | First DD opened | Top of section |
| 7 | **Portfolio page** (empty) | "Create Your Allocation" | Empty state | Center of page |
| 8 | **GYC Income Fund page** | Custom fund explainer | Any visit | Hero section |
| 9 | **Office Hours page** | Latest recording | Any visit | Full embed |
| 10 | **Asset class filter pages** | "7 Advantages of Alternative Investments" | First visit | Sidebar expandable |

### Implementation

```javascript
// Config-driven — easy to update URLs without code changes
const JIT_VIDEOS = {
  onboarding_welcome: {
    title: "Welcome to Grow Your Cashflow",
    url: "", // Pascal to fill after YouTube upload
    duration: "0:30",
    showOnce: true,
    location: "onboarding-screen-1"
  },
  buybox_intro: {
    title: "How to Assess Your Target",
    url: "",
    duration: "3:00",
    showOnce: true,
    location: "buybox-page"
  },
  // ... one entry per location
};

// Show logic per video
function shouldShowVideo(videoKey, user) {
  if (!JIT_VIDEOS[videoKey].url) return false;           // No URL yet
  if (user.videosWatched?.includes(videoKey)) return false; // Already seen
  if (user.videosDismissed?.includes(videoKey)) return false; // Dismissed
  return true;
}
```

---

## 5. Social Proof on Deal Cards

### What Users See

**On deal cards (subtle, bottom of card body):**
```
🔖 12 saved  ·  🔍 3 in due diligence
```

**On deal detail page (more detail):**
- "In the GYC database since March 2025"
- "47 investors have viewed this deal"
- "12 saved it · 3 in due diligence"
- Trending badge if saves increased recently

### Rules
- 100% anonymous — never show WHO, only HOW MANY
- Hide counts below 3 (avoid "1 person saved this")
- Update on each page load

### Technical Requirement
- **Needs persistent user accounts** — currently localStorage only
- Backend options: Airtable (simplest), Supabase (scalable), Firebase (real-time)
- Data model:
  ```
  deal_stages: user_id | deal_id | stage | timestamp
  ```
- Aggregate counts per deal across all users

### Priority
🔴 Critical — but blocked on backend/auth infrastructure. Build auth first, then this is easy to add.

---

## 6. Full Feature List (Running)

🔴 Critical | 🟡 High | 🟢 Medium | ⚪ Low

### Can Build Now (No Backend Needed)

| # | Feature | Priority | Effort | Serves |
|---|---------|----------|--------|--------|
| 1 | Guided onboarding wizard (5 screens) | 🔴 | High | Jobs 1 + 2 |
| 2 | Goal-based intake quiz (3 paths) | 🔴 | High | Job 2 |
| 3 | Deal matching/ranking by goal | 🔴 | Medium | Job 2 |
| 4 | Tax path: depreciation field + ranking | 🟡 | Medium | Job 2 |
| 5 | JIT video embed framework | 🟡 | Low | Jobs 1 + 2 + 4 |
| 6 | Pascal Score field + badge on cards | 🟡 | Low | Job 3 |
| 7 | Three Paths CTA (DIY / Academy / Fund) | 🟡 | Low | Job 6 |

### Needs Backend / Auth

| # | Feature | Priority | Effort | Serves |
|---|---------|----------|--------|--------|
| 8 | Persistent user accounts + profiles | 🔴 | High | All |
| 9 | Social proof on deal cards | 🔴 | Medium | Job 4 |
| 10 | Portfolio ↔ Income Roadmap connection | 🟡 | Medium | Job 5 |
| 11 | Distribution tracker | 🟢 | Medium | Job 5 |
| 12 | Behavioral nudge to Fund (usage tracking) | 🟢 | Low | Job 6 |

### Content / Ongoing

| # | Feature | Priority | Effort | Serves |
|---|---------|----------|--------|--------|
| 13 | Pascal's Take — video per deal (top 20) | 🟡 | Low/deal | Job 4 |
| 14 | Operator profile pages (deep) | 🟡 | Medium | Job 3 |
| 15 | Deal comparison tool (side by side) | ⚪ | Medium | Job 3 |
| 16 | Community Q&A per deal | ⚪ | High | Job 4 |

---

## 7. Next Steps

### For Pascal (Now)
1. ☐ Export Academy videos from GHL
2. ☐ Upload to YouTube as unlisted
3. ☐ Share URLs
4. ☐ Provide full list of GHL course sections (scroll down in screenshot)
5. ☐ Start adding `firstYearDepreciation` values to deals in Airtable
6. ☐ Score top 20 deals with Pascal Score (1-10)

### For Build (In Order)
1. ☐ Build onboarding wizard UI (Screens 1-5)
2. ☐ Build goal-based deal ranking logic
3. ☐ Add depreciation fields to deal data model
4. ☐ Wire JIT video embeds (once URLs available)
5. ☐ Decide on backend for persistent user data
6. ☐ Build social proof infrastructure
