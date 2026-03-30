# Task: Wire Up Goal Progress in the LP Deal Page Opportunity Card

## Context

You are working on the GYC Dealflow platform — a SvelteKit 2 + Svelte 5 real estate investment deal navigation app. The LP (Limited Partner) deal detail page at `dealflow/src/routes/deal/[id]/+page.svelte` has a "Your Plan" Opportunity Card component at `dealflow/src/lib/components/DealOpportunityCard.svelte`.

The Opportunity Card has a two-column layout:
- **LEFT column**: Shows the user's investment goal + progress bar toward that goal
- **RIGHT column**: Shows "If you invest $50K:" projections for the current deal

The LEFT column currently shows a fallback ("Goal selected / Set a target in your plan to track progress") because `goalProgress` is declared as `$state(null)` on line ~92 of `+page.svelte` and **never calculated or set**.

Your task is to wire up `goalProgress` so it shows real data like:
```
$100K/yr
passive income
[████████░░░░░░░░░░] 36%
$36K of $100K
```

And the RIGHT column can show "Gets you to 41% of your goal" after factoring in this deal's projected contribution.

---

## Data Model: Where Goal Targets Live

### Buy Box / Plan Wizard Data

The user's investment plan is stored in the `buyBox` object, which is loaded from:
1. **localStorage** via `readUserScopedJson('gycBuyBoxWizard', null)` — line ~1693 of `+page.svelte`
2. **API** via `GET /api/buybox?email=...` — line ~1700 of `+page.svelte`

The `buyBox` object is already available as a `$state` variable on line ~83 of `+page.svelte`.

### Key Buy Box Fields for Goal Progress

| Field | Description | Example Values |
|-------|-------------|----------------|
| `_branch` | Goal branch | `'cashflow'`, `'growth'`, `'tax'` |
| `goal` | Goal description | `'Cash Flow (income now)'` |
| `targetCashFlow` / `targetIncome` | Cashflow target (cashflow branch) | `'$50k/yr'`, `'$100k-$249k'`, `'$250k+'` |
| `growthCapital` / `targetGrowth` | Portfolio value target (growth branch) | `'$500k'`, `'$1M'`, `'$2M'` |
| `taxableIncome` / `targetTaxSavings` | Tax offset target (tax branch) | `'$50k'`, `'$100k'`, `'$250k'` |
| `baselineIncome` | Current passive income | `'$0'`, `'$1-$50k'`, `'$50k-$100k'` |
| `capital12mo` | 12-month deployable capital | `'$100k-$249k'` |

**Important**: Target values are stored as **text ranges** (e.g. `'$100k-$249k'`), not numbers. You'll need to parse the midpoint or lower bound.

### Goal Branch Logic

- **Cashflow** (`_branch === 'cashflow'`): Target is annual passive income. Use `targetCashFlow` field. Progress = `baselineIncome / targetCashFlow`.
- **Growth** (`_branch === 'growth'`): Target is portfolio value. Use `growthCapital` field.
- **Tax** (`_branch === 'tax'`): Target is annual tax offset. Use `taxableIncome` field.

---

## What `goalProgress` Should Look Like

The `DealOpportunityCard.svelte` component (line ~107) expects `goalProgress` to be an object with:

```javascript
{
  target: '$100K/yr',     // Formatted target string for display
  targetRaw: 100000,      // Numeric target value (for calculations)
  current: '$36K',        // Formatted current progress string
  currentRaw: 36000,      // Numeric current value
  pct: 36,                // Percentage (0-100)
  pctAfter: 41            // Percentage AFTER adding this deal's contribution
}
```

The component uses these fields:
- `goalProgress.target` — displayed as the goal amount (line ~117)
- `goalProgress.pct` — progress bar width and percentage display (lines ~111-114)
- `goalProgress.current` — "X of Y goal" text (line ~117)
- `goalProgress.pctAfter` — "Gets you to X% of your goal" in the right column (line ~136)

---

## Implementation Steps

### Step 1: Parse Target Amount from Buy Box Text Ranges

Create a helper function in `+page.svelte` (or in `dealAnalysis.js`) to parse text ranges into numbers:

```javascript
function parseTargetAmount(text) {
  if (!text) return null;
  // Handle ranges like "$100k-$249k", "$50k/yr", "$1M", "$250k+"
  const cleaned = text.replace(/\/yr|\/mo|\+/gi, '').trim();
  const match = cleaned.match(/\$?([\d,.]+)\s*(k|m|b)?/i);
  if (!match) return null;
  let val = parseFloat(match[1].replace(/,/g, ''));
  if (match[2]?.toLowerCase() === 'k') val *= 1000;
  if (match[2]?.toLowerCase() === 'm') val *= 1000000;
  if (match[2]?.toLowerCase() === 'b') val *= 1000000000;
  return val;
}
```

For ranges like `$100k-$249k`, parse the **lower bound** (first number).

### Step 2: Compute `goalProgress` as a Derived Value

Add a `$derived` block in `+page.svelte` that computes `goalProgress` from `buyBox` and the deal's projection:

```javascript
const goalProgress = $derived.by(() => {
  if (!buyBox || !userGoal) return null;

  const branch = buyBox._branch || userGoal;
  let targetText, targetRaw, currentText, currentRaw;

  if (branch === 'cashflow') {
    targetText = buyBox.targetCashFlow || buyBox.targetIncome;
    targetRaw = parseTargetAmount(targetText);
    currentText = buyBox.baselineIncome;
    currentRaw = parseTargetAmount(currentText) || 0;
  } else if (branch === 'growth') {
    targetText = buyBox.growthCapital || buyBox.targetGrowth;
    targetRaw = parseTargetAmount(targetText);
    currentRaw = 0; // No "current portfolio value" field exists yet
    currentText = '$0';
  } else if (branch === 'tax') {
    targetText = buyBox.taxableIncome || buyBox.targetTaxSavings;
    targetRaw = parseTargetAmount(targetText);
    currentRaw = 0;
    currentText = '$0';
  }

  if (!targetRaw || targetRaw <= 0) return null;

  const pct = Math.min(100, Math.round((currentRaw / targetRaw) * 100));

  // Compute pctAfter: what % would they be at if they invested in this deal?
  const projection = deal ? buildGoalProjection(deal, branch, deal?.investmentMinimum) : null;
  let dealContribution = 0;
  if (projection) {
    if (branch === 'cashflow') dealContribution = projection.annual || 0;
    else if (branch === 'tax') dealContribution = projection.writeOff || 0;
    else if (branch === 'growth') dealContribution = projection.gain || 0;
  }
  const pctAfter = Math.min(100, Math.round(((currentRaw + dealContribution) / targetRaw) * 100));

  return {
    target: formatTargetDisplay(targetRaw, branch),
    targetRaw,
    current: fmtMoney(currentRaw),
    currentRaw,
    pct,
    pctAfter
  };
});
```

### Step 3: Format Target for Display

```javascript
function formatTargetDisplay(amount, branch) {
  const formatted = fmtMoney(amount);
  if (branch === 'cashflow') return formatted + '/yr';
  if (branch === 'tax') return formatted + '/yr';
  return formatted;
}

function fmtMoney(val) {
  if (!val || isNaN(val)) return '$0';
  if (val >= 1e6) return '$' + (val / 1e6).toFixed(1) + 'M';
  if (val >= 1e3) return '$' + Math.round(val / 1e3) + 'K';
  return '$' + Math.round(val).toLocaleString();
}
```

### Step 4: Replace the State Variable

Change line ~92 from:
```javascript
let goalProgress = $state(null);
```

To remove it entirely, since it's now a `$derived` value. Make sure to also remove the `{goalProgress}` shorthand prop passing and pass the derived value instead (it should just work since the name matches).

### Step 5: Import `buildGoalProjection`

Make sure `buildGoalProjection` is imported from `$lib/utils/dealAnalysis.js` in `+page.svelte` if not already.

---

## Files to Modify

1. **`dealflow/src/routes/deal/[id]/+page.svelte`**
   - Remove `let goalProgress = $state(null)` (~line 92)
   - Add `parseTargetAmount()` helper function
   - Add `formatTargetDisplay()` helper function
   - Add `const goalProgress = $derived.by(...)` computation
   - Ensure `buildGoalProjection` is imported from dealAnalysis.js

2. **`dealflow/src/lib/components/DealOpportunityCard.svelte`** — No changes needed, it already consumes the `goalProgress` object correctly.

3. **`dealflow/src/lib/utils/dealAnalysis.js`** — No changes needed, `buildGoalProjection` already exists and returns `{ type, annual, monthly, writeOff, gain, totalReturn }`.

---

## Testing

1. Set a buy box via the plan wizard at `/app/plan` with a cashflow goal of "$100k-$249k"
2. Navigate to any deal page
3. The left column of the Opportunity Card should show:
   - The parsed target (e.g. "$100K/yr")
   - A progress bar
   - Current amount of target
4. The right column should show "Gets you to X% of your goal" based on the deal's projected contribution

---

## Tech Stack Notes

- **SvelteKit 2 + Svelte 5** — Use runes: `$state`, `$derived`, `$derived.by`, `$props`, `$effect`
- **No `<slot />`** in new components — use `{@render children()}` pattern (though existing lib components still use `<slot />`)
- Files are under `dealflow/src/` (not `src/` directly)
- Build with `cd dealflow && npm run build`
- The `buyBox` variable is already a `$state` on line ~83 of `+page.svelte` and gets populated from both localStorage and API
