# GYC Deal Platform — JTBD Product Roadmap

> Maps every feature to a specific customer job. Nothing gets built unless it serves a job.

---

## Customer Profile

- Accredited U.S. investors, ages 35–65
- $2M+ net worth, $300K+ liquid, 0–5 LP investments
- High-income W-2 executives and business owners
- Goal: shift from active income to stable, diversified passive income
- Secondary: reduce 6–7 figure tax bill, diversify away from single business + public markets

---

## The 6 Jobs

| # | Job | Emotional Core | Primary Product |
|---|-----|---------------|-----------------|
| 1 | Understand what's out there | "I don't know what I don't know" | Database + Content |
| 2 | Figure out what fits MY situation | "I'm overwhelmed, what's right for me?" | Intake Quiz + Buy Box + Academy |
| 3 | Evaluate whether a specific deal is good | "Is this operator legit?" | Deal Cards + DD Tools |
| 4 | Feel confident enough to wire money | "What if I'm making a mistake?" | Social Proof + Academy + Pascal's Take |
| 5 | Track progress toward my income goal | "Am I on track?" | Portfolio + Income Roadmap |
| 6 | Just do it for me | "I found my guy" | GYC Income Fund |

---

## JOB 1: "Help me understand what's even out there"

### What exists today
- [x] Deal database with 156+ deals across asset classes
- [x] Asset class filters (Multi Family, Lending, Self Storage, etc.)
- [x] Deal type filters (Fund, Syndication)
- [x] Strategy filters (Value-Add, Lending, Development)
- [x] Content engine (LinkedIn, podcast, YouTube)
- [x] Strategy sentences on deal cards
- [x] Asset class hero icons and gradients

### What needs to be built

#### 1.1 — "Start Here" Guided Onboarding
**Priority: HIGH**
**Effort: Medium**

When a brand new user logs in for the first time, don't dump them into 156 deals. Walk them through:

1. **Welcome screen**: "Let's find the right investments for you. This takes 3 minutes."
2. **Experience check**: "Have you invested in private deals before?"
   - Never → show educational path
   - 1-3 deals → show intermediate path
   - 4+ deals → skip to buy box builder
3. **Goal selection**: "What are you trying to accomplish?"
   - Build passive income
   - Reduce my tax bill
   - Diversify away from stocks/business
   - All of the above
4. **Asset class intro** (for beginners): Quick visual explainer of the 5 main categories
   - Lending/Credit (income-focused, lower risk)
   - Multi Family (cash flow + appreciation)
   - Self Storage (recession-resistant)
   - Industrial (stable, long-term)
   - Other (hotels, STR, NNN, etc.)
5. Route them to Buy Box builder with pre-filled suggestions based on answers

**Implementation notes:**
- This is a wizard/modal flow, not a separate page
- Store onboarding state so it only shows once
- Can reuse existing wizard component pattern
- Embed short Pascal videos (30-60 sec) at key decision points

#### 1.2 — Asset Class Education Cards
**Priority: MEDIUM**
**Effort: Low**

On the Deals page, add an optional "Learn" toggle or section that shows:
- What is this asset class?
- Typical returns range
- Typical hold period
- Risk profile (1-5 scale visual)
- Best for: (income / growth / tax benefits)

These should be dismissible and remember the user's preference.

#### 1.3 — "Deals Like This" Recommendations
**Priority: LOW**
**Effort: Medium**

When viewing a deal detail page, show 3-4 similar deals at the bottom:
- Same asset class, similar return profile
- "If you liked this, also consider..."

---

## JOB 2: "Help me figure out what fits MY situation"

### What exists today
- [x] Buy Box builder (asset class, strategy, min investment, target IRR preferences)
- [x] "Apply My Buy Box" filter on deals
- [x] Goals page with income target
- [x] 3-path decision tree (DIY / Academy / Fund)

### What needs to be built

#### 2.1 — Enhanced Intake Quiz → Personalized Allocation Plan
**Priority: CRITICAL — This is the #1 feature to build**
**Effort: High**

Replace the current buy box builder's "pick your preferences" approach with a financial-situation-driven intake:

**Questions to ask:**
1. What's your annual W-2 / business income? (dropdown ranges)
2. What's your investable liquid capital? (not tied up in business or primary residence)
3. What's your estimated tax bill this year?
4. What's your target monthly passive income?
5. Do you have an upcoming liquidity event? (business sale, inheritance, stock vesting)
6. What's your investment timeline? (1-3 yr, 3-5 yr, 5-10 yr, 10+ yr)
7. What's your maximum single check size?
8. Have you invested in private deals before? (never / 1-3 / 4+)
9. What matters most to you? (rank: income now, tax savings, long-term growth, capital preservation)

**Output: A personalized deployment plan**

Based on their answers, generate:
- Recommended allocation split (e.g., 40% lending/income, 30% value-add equity, 20% tax-advantaged, 10% opportunistic)
- Specific deal recommendations from the database that match
- Timeline visualization: "If you deploy $500K over 12 months at this allocation, you'll generate ~$45K/yr in passive income"
- Tax impact estimate: "This allocation could offset ~$120K in taxable income via depreciation"

**The key insight:** This replaces 80% of what the Academy does in weeks 1-2. Free users get the plan. Academy members get Pascal's review and customization of the plan.

**Gating strategy:**
- Free: See the allocation recommendation and top 3 deal matches
- Paid ($2K network / $5K Academy): Full plan with all deal matches, tax projections, and Pascal's review

#### 2.2 — Buy Box Auto-Suggestions
**Priority: MEDIUM**
**Effort: Low**

After the intake quiz, auto-populate the buy box with recommended filters. Don't make them manually set every parameter — fill it in based on their situation and let them adjust.

#### 2.3 — "Why This Fits" Badges on Deal Cards
**Priority: HIGH**
**Effort: Medium**

When a user has a buy box set, show a small match indicator on each deal card:
- Green dot: "Matches your buy box" (meets all criteria)
- Yellow dot: "Partial match" (meets 2/3 criteria)
- No dot: doesn't match

On the deal detail page, show specifics:
- "✓ Within your target IRR range"
- "✓ Below your max check size"
- "✗ Outside your preferred asset class"

This requires the buy box data to be compared against each deal's attributes.

#### 2.4 — Embedded JIT (Just-In-Time) Video Education
**Priority: HIGH**
**Effort: Low-Medium**

You already have Cashflow Academy videos in GHL. Embed them throughout the platform at decision points:

- On the Buy Box page: "What is a buy box and why does it matter?" (2 min)
- On first deal card interaction: "How to evaluate a private deal in 5 minutes" (3 min)
- On the Goals page: "How I built $100K/yr in passive income" (5 min)
- On each asset class filter: "What is [Multi Family / Lending / etc.]?" (2 min)
- Before the DD checklist: "The 5 things I check on every deal" (3 min)

**Implementation:**
- Use the existing video content from GHL/Cashflow Academy
- Embed as expandable sections or modals (not full page)
- Track which videos each user has watched
- Show "Recommended video" prompts based on where the user is stuck

---

## JOB 3: "Help me evaluate whether this specific deal is good"

### What exists today
- [x] Credit fund cards with performance chart (annual returns vs peer avg)
- [x] Equity cards with gradient hero, Target IRR overlay
- [x] Metrics rows (Equity Multiple, Minimum, Hold Period, Pref Return / Target Income, Lockup, Distribution)
- [x] Manager Size tier with range
- [x] Fund Founded year
- [x] Audited/Unaudited badge
- [x] Strategy sentence
- [x] Skip/Save triage
- [x] Deal detail page (deal.html)
- [x] DD checklist (per deal)

### What needs to be built

#### 3.1 — Pascal Score
**Priority: HIGH**
**Effort: Medium**

A 1-10 score on each deal based on your evaluation framework. NOT algorithmic — this is Pascal's actual assessment.

**Scoring dimensions** (weighted):
1. Operator track record (years, AUM, full-cycle deals)
2. Deal structure quality (alignment of interests, fees, waterfall)
3. Risk-adjusted return attractiveness
4. Transparency & reporting quality
5. Buy box fit for typical GYC investor

**Display:**
- Small badge on the deal card: "Pascal Score: 8.2"
- Color-coded (green 7+, yellow 5-7, red <5)
- On deal detail page: breakdown by dimension with Pascal's notes

**Data model:**
- New Airtable field: `pascalScore` (number)
- New Airtable field: `pascalScoreNotes` (long text)
- Score gets populated manually by Pascal (or team) over time
- Deals without a score show "Score pending" or nothing

**Why this matters:** This is your moat. Nobody else has Pascal's opinion backed by $3.3M in personal investments. An AI can build a database. It can't replicate earned judgment.

#### 3.2 — Quick DD Summary on Cards
**Priority: MEDIUM**
**Effort: Low**

Add 2-3 bullet points of key DD findings directly on the deal card or in an expandable section:
- "✓ 15-year track record, never missed a distribution"
- "⚠ Small fund (<$50M AUM), limited liquidity"
- "✓ Audited financials, institutional-grade reporting"

These would be manually curated (like Pascal Score) and stored in Airtable.

#### 3.3 — Operator Profile Pages
**Priority: HIGH**
**Effort: Medium**

The Investment Managers page exists but needs depth. Each operator should have:
- Company overview (founded, AUM, team size)
- All deals from this operator in the database
- Track record summary (full-cycle deals, average returns)
- Pascal's notes on the operator
- How many GYC members have invested with them (anonymous count)

#### 3.4 — Deal Comparison Tool
**Priority: LOW**
**Effort: Medium**

Select 2-3 deals and see them side-by-side:
- All metrics compared
- Chart overlay (for credit funds)
- Pros/cons of each

---

## JOB 4: "Help me feel confident enough to wire money"

### What exists today
- [x] Cashflow Academy 1:1 deal review
- [x] Weekly Office Hours
- [x] DD checklist per deal
- [x] Deal detail page with full info

### What needs to be built

#### 4.1 — Social Proof Signals (The Hidden Network Effect)
**Priority: CRITICAL**
**Effort: Low**

You already track deal stages (new → interested → DD → portfolio → passed). Surface this data:

**On deal cards:**
- "23 investors saved" (count of users who moved to interested)
- "4 in due diligence" (count of users in DD stage)
- Small avatar stack or just numbers

**On deal detail page:**
- "This deal has been in the GYC database for 8 months"
- "34 members have reviewed this deal"
- "12 moved to due diligence"
- Trending indicator: "Interest is increasing this month"

**Why this is critical:** This is the network effect you were looking for. Every new user who saves or DDs a deal makes the platform more valuable for everyone. It answers the #1 fear: "Am I the only idiot looking at this?" No — 23 other accredited investors saved it too.

**Privacy:** All anonymous. Never show WHO, just HOW MANY.

**Implementation:**
- Aggregate `dealStages` data across all users
- Store counts in a simple object or Airtable view
- Update counts on each render
- This requires user accounts to persist deal stages (not just localStorage)

#### 4.2 — Pascal's Take (Video Commentary Per Deal)
**Priority: HIGH**
**Effort: Low per deal, ongoing**

For your top 20-30 deals, record a 2-3 minute Loom-style video:
- "Here's what I think about [Deal Name]"
- What I like, what concerns me, who it's best for
- Embed on the deal detail page

This is incredibly high-value content that:
- Can't be replicated by competitors
- Builds massive trust
- Takes you ~1 hour/week to batch-record 5-10

**Gating:** Free users see the first 30 seconds. Full video for paid members.

#### 4.3 — Community Discussion (Per Deal)
**Priority: MEDIUM**
**Effort: High**

A simple comment/discussion thread on each deal detail page:
- "Has anyone invested with this operator?"
- "How are distributions tracking?"
- "Any concerns about the lockup terms?"

**Implementation options:**
- Simple: Embed a Slack channel per deal category
- Medium: Build a basic comment system with user authentication
- Complex: Full discussion forum (probably overkill)

**Recommendation:** Start with a curated Q&A approach — members submit questions, Pascal or team answers. Not a free-for-all forum.

#### 4.4 — "Ready to Invest" Workflow
**Priority: MEDIUM**
**Effort: Medium**

When a user moves a deal to "My Portfolio" (indicating they invested), trigger:
1. Congratulations screen with next steps
2. Prompt to log investment amount (for portfolio tracking)
3. Suggest next deal based on their allocation plan: "Your plan recommends 30% in lending. You've allocated 0% so far. Here are 3 lending funds that match."
4. Offer to schedule a call with Pascal for post-investment review

---

## JOB 5: "Help me track progress toward my income goal"

### What exists today
- [x] My Portfolio tab
- [x] Goals page with income roadmap
- [x] 3-path decision tree
- [x] Tax Prep section

### What needs to be built

#### 5.1 — Portfolio ↔ Income Roadmap Connection
**Priority: HIGH**
**Effort: Medium**

The portfolio and goals pages are disconnected. Connect them:

**Dashboard widget:**
```
YOUR PASSIVE INCOME PROGRESS
━━━━━━━━━━━━━━━━━━░░░░░░  62%

$124,000 / $200,000 target
├── Lending funds:    $62,000/yr (5 investments)
├── Equity funds:     $38,000/yr (3 investments)
├── Syndications:     $24,000/yr (2 investments)
└── Gap to target:    $76,000/yr

NEXT MOVE: Add 2 lending funds at $100K each to close 50% of your gap
→ View recommended deals
```

#### 5.2 — Distribution Tracker
**Priority: MEDIUM**
**Effort: Medium**

Let users log actual distributions received:
- Monthly/quarterly entries per investment
- Track actual vs projected returns
- Show cumulative income over time

This is the data that, aggregated anonymously, eventually powers the "actual returns" insight for other users.

#### 5.3 — Annual Tax Summary
**Priority: MEDIUM (seasonal — critical in Q1)**
**Effort: Low**

Pull from portfolio data:
- Estimated depreciation/K-1 impact by investment
- "Your portfolio generated an estimated $87K in depreciation deductions this year"
- Checklist: which K-1s to expect and when

---

## JOB 6: "Just do it for me"

### What exists today
- [x] GYC Income Fund page (data room)
- [x] 3-path decision tree with Fund as "Easy Button"
- [x] Fund investors get Academy + Network free

### What needs to be built

#### 6.1 — Behavioral Nudge to Fund
**Priority: HIGH**
**Effort: Low**

Track user behavior and surface the fund offer at the right moment:

**Trigger conditions:**
- User has been active for 30+ days but hasn't moved any deal past "Interested"
- User has saved 10+ deals but invested in 0
- User completed the intake quiz and their goal is >$100K/yr passive income
- User has viewed the fund page 2+ times

**Nudge format:**
- Subtle banner on dashboard: "Been researching for a while? Let Pascal deploy your capital. Learn about the GYC Income Fund →"
- NOT a popup. NOT aggressive. Just present at the right moment.

#### 6.2 — Fund Performance Dashboard
**Priority: MEDIUM**
**Effort: Medium**

For fund investors, show:
- Their investment amount and current value
- Monthly distribution history (chart)
- Net yield vs target
- Underlying fund allocation breakdown
- Comparison to doing it themselves (10 investments to manage vs 1)

#### 6.3 — "Invest" CTA on Qualifying Deals
**Priority: LOW**
**Effort: Low**

On deals that are available through the GYC Income Fund, show:
- "This deal is available through the GYC Income Fund"
- "Invest in 10 deals like this with one check → Learn more"

---

## Implementation Priority Matrix

### Phase 1: Immediate (Next 30 days)
These require minimal new infrastructure and have the highest impact:

1. **Social proof signals on cards** (Job 4.1) — you already have the data
2. **JIT video embedding** (Job 2.4) — you already have the content
3. **Behavioral nudge to fund** (Job 6.1) — simple conditional banner
4. **Pascal Score field** (Job 3.1) — add Airtable field, start scoring top 20 deals

### Phase 2: Core Build (30-90 days)
These require product work but are the main value drivers:

5. **Enhanced intake quiz → allocation plan** (Job 2.1) — THE key feature
6. **Portfolio ↔ Income Roadmap connection** (Job 5.1) — closes the loop
7. **"Why This Fits" badges** (Job 2.3) — personalization layer
8. **Operator profile pages** (Job 3.3) — depth on managers
9. **Guided onboarding flow** (Job 1.1) — first-run experience

### Phase 3: Moat Building (90-180 days)
These create long-term defensibility:

10. **Pascal's Take video per deal** (Job 4.2) — ongoing content program
11. **Distribution tracker** (Job 5.2) — real outcome data
12. **Community Q&A per deal** (Job 4.3) — network effect
13. **Deal comparison tool** (Job 3.4) — power user feature
14. **Fund performance dashboard** (Job 6.2) — fund investor retention

---

## Gating Strategy (What's Free vs Paid)

| Feature | Free | Network ($2K/yr) | Academy ($5-10K) | Fund Investor |
|---------|------|-------------------|-------------------|---------------|
| Browse deals (basic view) | ✓ | ✓ | ✓ | ✓ |
| Asset class filters | ✓ | ✓ | ✓ | ✓ |
| Skip/Save deals | ✓ | ✓ | ✓ | ✓ |
| Intake quiz (basic plan) | ✓ | ✓ | ✓ | ✓ |
| Full allocation plan | First 3 deals | ✓ | ✓ | ✓ |
| Pascal Score | See score only | Score + notes | Score + notes + call | Score + notes + call |
| Social proof counts | ✓ | ✓ | ✓ | ✓ |
| Pascal's Take videos | 30 sec preview | Full video | Full video + Q&A | Full video + Q&A |
| DD checklist | View only | Interactive | Interactive + review | Interactive + review |
| JIT education videos | First 3 | All | All + office hours | All + office hours |
| Portfolio tracker | Basic | Full | Full + optimization | Full + reporting |
| Income roadmap | View target | Full plan | Full + Pascal review | Full + quarterly review |
| Operator deep dives | Basic | Full profiles | Full + intros | Full + intros |
| Community Q&A | Read only | Read + post | Read + post + priority | Read + post + priority |
| 1:1 with Pascal | — | — | ✓ | ✓ |
| Network fee | — | $2K/yr | Included | **Waived** |
| Academy fee | — | — | $5-10K | **Waived** |

---

## Technical Requirements

### Must-Have Infrastructure
1. **User authentication** — deal stages currently in localStorage. Must persist to a backend (Airtable, Supabase, or similar) to enable social proof and personalization
2. **User profile storage** — intake quiz answers, buy box, goals, onboarding state
3. **Deal stage aggregation** — count saves/DDs across all users per deal
4. **Video embed system** — simple iframe/embed for Loom, YouTube, or Vimeo
5. **Gating logic** — check user tier before showing premium features

### Nice-to-Have Infrastructure
6. **Notification system** — email alerts when new deals match buy box
7. **Analytics** — track which features drive conversion to Academy/Fund
8. **Mobile app wrapper** — Capacitor/PWA for iOS (partially exists)

---

## Success Metrics

| Metric | Current | 6-Month Target | 12-Month Target |
|--------|---------|----------------|-----------------|
| Registered users | ~30 | 200 | 500 |
| Monthly active users | ~10 | 75 | 200 |
| Deals saved (avg per user) | ? | 8 | 15 |
| Intake quiz completion | 0% | 40% of new users | 60% |
| Free → Network conversion | N/A | 5% | 10% |
| Network → Academy conversion | N/A | 10% | 15% |
| Academy → Fund conversion | ~10% | 20% | 30% |
| Fund AUM | $150K | $1M | $3M |
| Revenue | $32K/yr | $200K/yr | $500K/yr |

---

## The Flywheel

```
Content attracts investors
    → Investors join platform (free)
        → Intake quiz personalizes their experience
            → They browse, save, and DD deals
                → Their activity creates social proof for others
                    → Social proof builds confidence
                        → Confident investors deploy capital
                            → Some invest through GYC Fund
                                → Fund AUM grows
                                    → Better operator access
                                        → Better deals in database
                                            → More content to create
                                                → More investors attracted
```

Every step feeds the next. The platform gets more valuable with every user, even if they never pay.
