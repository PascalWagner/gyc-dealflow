# GYC Deal Flow Platform — Product Strategy

## Jobs-to-Be-Done Map

This maps the complete user journey from arrival to fund investor. Every feature, gate, and piece of content should serve one of these jobs.

| Stage | Job to Be Done | What They Feel | What the Platform Does | Tier | Video Education |
|-------|---------------|----------------|----------------------|------|-----------------|
| 1. Arrive | "I want to understand my options" | Overwhelmed, curious | Free database view — see deal landscape, browse operators | Free | Welcome video: "How to use this platform" |
| 2. Onboard | "I want to know what's right for ME" | Uncertain, needs guidance | Buy Box Wizard — 21 questions → personalized criteria | Free | "What is a buy box and why it matters" |
| 3. Visualize | "Show me how I actually get to my goal" | Skeptical it's achievable | Income Roadmap — the math, the paths, the timeline | Free | "How passive income math works" |
| 4. Explore | "Show me deals that match" | Engaged, evaluating | Filtered deal grid with match scores | Free (limited) / Academy (full) | — |
| 5. Evaluate | "Help me decide if this specific deal is good" | Anxious about making a mistake | Deal detail + Pascal's scorecard + DD checklist | **GATE: Academy** | "How to read a PPM" / "Red flags in deal docs" |
| 6. Decide | "Give me confidence to wire money" | Fear of loss | Pascal's analysis, community, comparison tools, office hours | Academy | "Before you wire: final checklist" |
| 7. Track | "Show me how my portfolio is performing" | Wants reassurance | Portfolio page with allocation vs. goal progress | Academy | "How to read your K-1" |
| 8. Optimize | "What should I invest in next?" | Ready for more | Updated roadmap: "You're 3/10 toward your goal" | Academy | "When and how to rebalance" |
| 9. Simplify | "This is a lot of work, can someone do it for me?" | Fatigued by complexity | GYC Income Fund pitch — "Let me handle it" | Fund | "How the GYC Income Fund works" |

---

## Gating Strategy

### What Free Users Get (Stages 1–4)

**Purpose:** Let them experience enough value to understand what they're missing. Build trust. Collect their buy box data (which is also your lead qualification data).

- Full buy box wizard / onboarding
- Income Roadmap calculator (this is a conversion tool — it shows them the gap)
- Browse all deals (names, asset class, high-level metrics, status)
- See match badges (green/orange) against their buy box
- Limited deal detail (overview section only)
- 3 full deal views per month (so they taste the depth)

**What's locked (visible but gated):**
- Pascal's Deal Scorecard / analysis
- DD checklist per deal
- Full deal metrics and terms
- Community discussion
- Portfolio tracker with goal progress
- Office hours access
- Operator deep-dive profiles

### The Decision Point (after Stage 3 or Stage 4)

After the Income Roadmap shows them their path, or after they hit their 3rd deal view, present the decision tree:

```
┌─────────────────────────────────────────────────────────┐
│                                                         │
│   You've built your buy box. Here's your path to        │
│   $[GOAL]/yr in passive income.                         │
│                                                         │
│   How do you want to get there?                         │
│                                                         │
├──────────┬──────────────────┬──────────────────────────┤
│ EXPLORE  │ ACCELERATE       │ EASY BUTTON              │
│ Free     │ Cashflow Academy │ GYC Income Fund          │
│          │                  │                           │
│ Browse   │ Full database    │ I deploy your capital     │
│ deals    │ access           │ using my framework        │
│ on your  │                  │                           │
│ own      │ Pascal's deal    │ Target [X]% yield         │
│          │ scorecards       │                           │
│ Limited  │                  │ Academy included free     │
│ access   │ DD checklists    │                           │
│          │                  │ $100K minimum             │
│ No       │ 1:1 coaching     │                           │
│ guidance │                  │ One K-1, one investment,  │
│          │ Office hours     │ fully managed             │
│          │                  │                           │
│ Continue │ $5,000           │ Book a call →             │
│ Free →   │ Enroll →         │                           │
├──────────┴──────────────────┴──────────────────────────┤
│                                                         │
│  Not sure? Book a free Deployment Gameplan Call and      │
│  I'll recommend the right path for your situation.       │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### What Academy Members Get (Stages 5–8)

Everything in free, plus:
- Full deal detail with all metrics and terms
- Pascal's Deal Scorecard on every listing
- DD checklist (interactive, per deal)
- Portfolio tracker with goal progress visualization
- Community discussion per deal
- Weekly office hours (live, recorded)
- Just-in-time video education throughout the platform
- Buy box refinement tools
- Comparison tool (side-by-side deals)
- Operator profiles with full track record data

### What Fund Investors Get (Stage 9)

Everything in Academy (waived), plus:
- Fund-specific reporting dashboard
- Quarterly portfolio review with Pascal
- Priority access to future fund offerings
- "Investor" badge in community

---

## Just-in-Time Video Education System

Instead of a separate "Academy" section with a linear course, videos are embedded at the moment of need throughout the platform. This means the platform IS the course.

### Video Placement Map

| Platform Location | Video Topic | Trigger |
|-------------------|-------------|---------|
| **First login** | "Welcome: How to use this platform in 5 minutes" | Auto-play on first visit |
| **Buy Box Wizard - Start** | "What is a buy box and why the best investors use one" | Before wizard step 1 |
| **Buy Box Wizard - Asset Classes** | "Asset classes explained: which ones produce cash flow vs. equity growth" | Wizard step for asset class selection |
| **Buy Box Wizard - Check Size** | "How to think about check size and diversification" | Wizard step for min/max investment |
| **Buy Box Wizard - IRR** | "Understanding IRR, preferred return, and equity multiples" | Wizard step for return targets |
| **Income Roadmap** | "How passive income math works: yield × capital = income" | First time viewing Goals page |
| **Income Roadmap** | "Why diversification matters: 10 deals vs. 1 fund" | After roadmap calculation |
| **Deal Card - First View** | "How to read a deal card: what each metric means" | First time clicking a deal |
| **Deal Detail - Scorecard** | "How I score deals: the Pascal Score explained" | Academy gate — first scorecard view |
| **Deal Detail - DD Checklist** | "Due diligence 101: what to check before you invest" | Academy gate — first DD checklist |
| **Deal Detail - PPM/Docs** | "How to read a PPM without a law degree" | When viewing deal documents |
| **Deal Detail - Fees** | "Fee structures: what's normal vs. what's a red flag" | When viewing fees section |
| **Deal Detail - Tax** | "How depreciation and cost segregation save you taxes" | When viewing depreciation field |
| **Operator Profile** | "How to evaluate a sponsor/GP: track record, alignment, red flags" | First operator profile view |
| **Portfolio - First Add** | "Tracking your investments: why and how" | First portfolio entry |
| **Portfolio - Goal Progress** | "Rebalancing: when to add more and when to wait" | When viewing goal progress |
| **Fund Pitch** | "How the GYC Income Fund works and who it's for" | Fund CTA or decision tree |
| **Before Wiring** | "The final checklist before you send money" | When marking a deal as "Committed" |
| **Tax Season** | "Your K-1 arrived: what to do with it" | January-April, on portfolio page |

### Video Implementation Notes

- Videos are short (2-7 minutes each)
- Shown as dismissable overlays or inline expandable sections
- "Already know this? Skip" option on every video
- Track which videos they've watched (localStorage or user profile)
- Videos unlock progressively — don't overwhelm on day 1
- Free users see Stage 1-3 videos; Academy videos appear when they upgrade
- Source: Existing GHL Cashflow Academy videos, re-cut as short contextual clips

---

## Decision Tree Trigger Points

The platform should nudge toward a decision at these moments:

1. **After Income Roadmap** — "Here's your path. How do you want to get there?" (3-option decision tree)
2. **After 3rd free deal view** — "You've used your free views. Upgrade to Academy for full access."
3. **When clicking a locked scorecard** — "Pascal's analysis is available to Academy members. Here's what you're missing."
4. **After 30 days as free user** — Email campaign: "You built your buy box 30 days ago. Ready to act on it?"
5. **After adding 3+ deals to Saved** — "You're clearly interested. Let's figure out which of these to invest in first."
6. **On Portfolio page with no investments** — "Your portfolio is empty. Your goal is $X/yr. Let's fix that."

---

## Content-to-Platform Funnel

```
LinkedIn/YouTube post
  → Shows data FROM the platform (deal scorecard screenshot, income roadmap calc)
  → CTA: "Build your free buy box at growyourcashflow.io"
  → User onboards (buy box wizard)
  → Sees Income Roadmap (the math)
  → Browses deals (limited)
  → Hits gate (Academy or Fund)
  → Books call or enrolls
```

The platform IS the lead magnet. The buy box wizard IS the opt-in. The Income Roadmap IS the sales pitch.

---

## Metrics to Track

| Metric | What It Tells You |
|--------|-------------------|
| Wizard completion rate | Is onboarding too long? |
| Income Roadmap views | Are people reaching the key moment? |
| Free → Academy conversion rate | Is the gate working? |
| Decision tree click-through by option | Which path resonates? |
| Deal views before gate hit | How much free value is enough? |
| Video watch rates by location | Which education moments matter? |
| Time from signup to Academy purchase | How long is the trust cycle? |
| Academy → Fund conversion rate | Is the backend working? |
| Average goal amount | Who are your users really? |

---

## What to Build Next (Priority Order)

1. **Income Roadmap / Goals page** — The missing Stage 3
2. **Gating logic** — Free vs. Academy access controls
3. **Decision tree UI** — The 3-path choice after Income Roadmap
4. **Just-in-time video embeds** — Start with 5 highest-impact placements
5. **Pascal's Deal Scorecard** — The premium content behind the gate
6. **Portfolio goal progress** — Connect portfolio to Income Roadmap targets
