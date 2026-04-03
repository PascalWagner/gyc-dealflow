# LP Onboarding + Plan Flow Implementation Checklist (2026)

This document is the build-ready checklist for the next implementation pass on onboarding and `/app/plan`.

It is intended to work alongside the current codebase, not replace product history. It captures:

- the flow distinctions we want to preserve
- the exact copy/order decisions already made
- the file-by-file implementation checklist
- the schema/persistence implications
- the QA gates that must pass before sharing a branch URL

## Goals

- Keep the current onboarding visual design and interaction style.
- Improve question order and wording without redesigning the flow.
- Keep `/app/plan` deep linking, edit routing, and phase toggles working after the reorder.
- Add the LP-network participation step as an explicit decision.
- Add a conditional profile-photo step for LP-network participants.
- Add `Private Debt / Credit` as a real asset-class option in onboarding.
- Preserve investor history for future Member Success / case-study workflows instead of treating onboarding answers as disposable.

## Flow Distinctions

There are 3 separate flows and they should remain separate in implementation:

1. First-time user entry flow
2. Initial LP onboarding flow
3. Member LP plan-builder flow

Do not collapse these into one conceptual flow.

## Locked Product Decisions

### First-time user entry flow

Screen 1: Name

- Keep this as a profile setup screen only.
- Remove the `Join the LP Network` checkbox from this screen.
- Exact copy:
  - Title: `What should we call you?`
  - Subtitle: `This sets up your profile inside the app.`
  - CTA: `Continue`

Screen 2: Role selection

- Keep LP vs GP role routing.
- Exact copy:
  - Title: `What best describes you right now?`
  - Subtitle: `We’ll route you to the right setup flow.`
  - LP card:
    - Title: `I’m an investor (LP)`
    - Description: `I want to discover deals, build a plan, and track my portfolio.`
  - GP card:
    - Title: `I’m an operator / sponsor (GP)`
    - Description: `I want to list deals, connect with LPs, and present opportunities.`

### Initial LP onboarding flow

This begins only after the user selects LP.

Step 1: Goal

- Title: `What’s your primary investing goal right now?`
- Subtitle: `This shapes which deals you see first, how we sort them, and what success looks like for you.`

Step 2: Accreditation

- Title: `Are you an accredited investor?`
- Subtitle: `This determines which private deals we can legally show you. Select all that apply.`

Step 3: Experience

- Title: `How many passive investments have you made?`
- Subtitle: `Syndications, funds, and private placements all count. This helps us tailor how much context and support to give you.`

Step 4: Real Estate Professional

- Title: `Do you or your spouse qualify as a Real Estate Professional for tax purposes?`
- Subtitle: `This helps us understand when tax-focused real estate strategies may be especially relevant for you.`

Step 5: Asset classes

- Title: `Which asset classes should we prioritize in your deal flow?`
- Subtitle: `Choose the categories you want to see more of first. You can change this anytime.`
- Add `Private Debt / Credit` as a real option.
- Do not add `Show me a recommended mix`.

Step 6: Strategies

- Title: `Which deal strategies are you open to?`
- Subtitle: `Asset class is what the deal is. Strategy is how returns are created.`
- Do not add `Show me a recommended mix`.

Step 7: Check size

- Title: `What is the max check size you are realistically open to for one deal?`
- Subtitle: `We use this to avoid showing you deals that are clearly outside your range.`
- Options:
  - `Under $50K`
  - `$50K-$99K`
  - `$100K-$249K`
  - `$250K+`
- Remove any `Deal by deal` option.

Step 8: LP network

- Title: `Do you want visibility into which other LPs are in a deal?`
- Subtitle: `Compare notes, build conviction, and see who else is participating. You can only see others if you also opt in.`
- Answers:
  - `Yes, show me the LP network`
  - `No, keep this private`

Step 9: Conditional profile photo

- Only show this step if the user opts into LP network visibility.
- Title: `Add a profile photo?`
- Subtitle: `If you participate in the LP network, we can show your face next to your activity and participation. You can skip this for now.`
- Primary CTA: `Upload Photo`
- Secondary CTA: `Skip for Now`

Step 10: Completion

- Title: `Your deal flow is personalized.`
- Subtitle: `We’ve set your starting preferences. You can refine them anytime as your goals evolve.`
- Summary should include:
  - goal
  - accreditation
  - experience
  - RE Pro
  - asset classes
  - strategies
  - max check size
  - LP network participation
  - photo added or skipped

### Member LP plan-builder flow

This is a continuation of LP setup, not a restart.

Branch-specific questions:

- Cash flow branch:
  - `Where are you starting from?`
  - `How much passive income do you want in 12 months?`
- Growth branch:
  - `What’s your portfolio growth target?`
  - `What matters more right now: upside or preservation?`
- Tax branch:
  - `How much income do you want to shelter?`
  - `How much are you earning before taxes?`

Shared deeper planning questions after branch-specific questions:

- `What’s your total net worth?`
  - Add `Prefer not to say`
  - Add explanation that this is used to calculate check-size guidance, diversification, and plan pacing, and stays private
- `How much capital could you put to work in the next 12 months?`
- `What’s making this possible?`
- `How soon could you write your first check?`
- `How diversified do you want to be?`
- Replace `Who do you want managing your money?` with:
  - `Do you prefer specialists or are you open to broader operators?`
- `How long can you lock up your capital?`
- `How often do you want distributions?`
- Then keep:
  - plan
  - LP network
  - investment profile review
  - completion

## File-by-File Checklist

### 1. `/Users/pascalwagner/Documents/New project/dealflow-onboarding-summary-nav/dealflow/src/lib/components/onboarding/LegacyOnboardingFlow.svelte`

Primary ownership: first-time user entry flow and initial LP onboarding flow.

Changes:

- Remove the LP-network checkbox from the name screen.
- Update name-screen copy.
- Update role-selection copy.
- Expand the LP path from the current lightweight sequence to the new initial LP onboarding sequence.
- Reuse existing LP snapshot persistence helpers so answers still save progressively.
- Add new LP onboarding steps for:
  - accreditation
  - RE Pro
  - asset classes
  - strategies
  - max check size
  - LP network participation
  - conditional profile photo
- Make LP network a real step, not a checkbox hidden on the name screen.
- Only show the photo step if LP network participation is enabled.
- Completion summary must reflect the new steps.
- Preserve GP routing and GP onboarding behavior.

Watch-outs:

- Do not break `appMode` LP bootstrap behavior.
- Do not regress existing GP onboarding screens.
- Make sure local LP resume logic understands the new step sequence.

### 2. `/Users/pascalwagner/Documents/New project/dealflow-onboarding-summary-nav/dealflow/src/lib/onboarding/planWizard.js`

Primary ownership: canonical LP/member step model and wizard metadata.

Changes:

- Reorder `STEP_SEQUENCE` to reflect the new initial LP and member continuation logic.
- Keep first-time entry flow separate from this file if possible; this file should remain the LP/member wizard source of truth.
- Update `PHASE_NAMES`/phase mapping if the reordered steps require it.
- Add or update any step constants needed for:
  - conditional photo step
  - updated check-size semantics
- Update titles/subtitles if any are centralized here via helper metadata.
- Add `Private Debt / Credit` as a real asset-class option in the onboarding set.
- Decide and document whether `Lending` remains a strategy, an alias, or both.
- Update review-summary rows for renamed steps, especially:
  - max check size
  - operator breadth copy
  - LP network
  - photo status if surfaced in review

Watch-outs:

- This file currently contains multiple asset-related definitions. Avoid partial renames.
- Phase toggle deep links depend on this step ordering.

### 3. `/Users/pascalwagner/Documents/New project/dealflow-onboarding-summary-nav/dealflow/src/lib/components/LegacyPlanWizard.svelte`

Primary ownership: in-app LP/member wizard UI and deep-linked editing flow.

Changes:

- Update step titles/subtitles to match the new wording.
- Reorder step rendering logic to match the updated `STEP_SEQUENCE`.
- Convert the current risk / concentration step into the new max-check-size step.
- Update answer options for max check size:
  - `Under $50K`
  - `$50K-$99K`
  - `$100K-$249K`
  - `$250K+`
- Update the operator-focus step title/copy to:
  - `Do you prefer specialists or are you open to broader operators?`
- Add `Prefer not to say` path for net worth.
- Add explanatory copy on the net-worth step.
- Keep the LP-network educational step, but align wording with the initial LP onboarding language.
- If the photo step is reused in-member, make sure it only appears when appropriate.
- Keep phase pills/toggles clickable in edit mode.
- Keep URL sync in place when jumping across reordered steps.

Watch-outs:

- Do not reintroduce nested card styling.
- Do not break summary-page `Edit` or roadmap `Edit Plan` entry behavior.

### 4. `/Users/pascalwagner/Documents/New project/dealflow-onboarding-summary-nav/dealflow/src/routes/app/plan/+page.svelte`

Primary ownership: `/app/plan` summary page, wizard entry points, and deep links.

Changes:

- Verify `Edit` on the summary still routes to the intended review step after reordering.
- Verify roadmap `Edit Plan` still routes to the plan-builder step after reordering.
- Update any step constants used by:
  - `openPlanReview()`
  - `openPlanEditor()`
  - `navigateWizardStep(...)`
- Make sure summary-page actions still preserve the current shell and query-param pattern.
- Make sure top toggle routing still lands on the correct first step for:
  - You
  - Goal
  - Finances
  - Preferences
  - My Plan

Watch-outs:

- Do not render onboarding phase pills on the standalone summary page.
- Do not break existing reset/new-plan flows while reordering steps.

### 5. `/Users/pascalwagner/Documents/New project/dealflow-onboarding-summary-nav/dealflow/api/buybox.js`

Primary ownership: active buy-box persistence and reset behavior.

Changes:

- Map any new or renamed wizard fields cleanly.
- Add support for the new max-check-size answer model if the underlying storage format changes.
- Decide how the conditional photo step is represented:
  - likely not in `user_buy_box` itself
  - photo should live on `user_profiles.avatar_url`
- Add snapshot/versioning support if implementing historical preservation now.
- Before `New Plan` or `Start Over`, persist a historical snapshot if a snapshot table is introduced.

Known issue to fix or verify:

- Current isolated QA for reset still fails because `DELETE /api/buybox` returns `502` in the reset harness.

### 6. `/Users/pascalwagner/Documents/New project/dealflow-onboarding-summary-nav/dealflow/api/network.js`

Primary ownership: LP-network avatar upload reuse.

Changes:

- Reuse this existing `action=avatar` path for the new conditional photo step if possible.
- Verify auth, upload, storage bucket, and profile update behavior from onboarding.
- If needed, add lightweight validation or response shape improvements for onboarding use.

Watch-outs:

- Do not fork a second avatar-upload path if the current one is reusable.

### 7. `/Users/pascalwagner/Documents/New project/dealflow-onboarding-summary-nav/dealflow/src/routes/app/settings/+page.svelte`

Primary ownership: reference implementation only.

Changes:

- Probably no product change required here for this pass.
- Use this file as the reference pattern for onboarding photo upload UI/behavior.

### 8. `/Users/pascalwagner/Documents/New project/dealflow-onboarding-summary-nav/dealflow/src/lib/utils/dealReviewSchema.js`

Primary ownership: canonical deal asset-class normalization.

Changes:

- Normalize `Lending` and `Private Debt / Credit` so the onboarding taxonomy does not break deal matching.
- Decide the canonical stored/display label.
- Keep aliases so legacy records still resolve correctly.

Recommendation:

- Canonical user-facing asset-class label: `Private Debt / Credit`
- Legacy alias support:
  - `Lending`
  - `Debt`
  - `Private Debt`
  - `Private Credit`

### 9. `/Users/pascalwagner/Documents/New project/dealflow-onboarding-summary-nav/dealflow/src/lib/components/FilterBar.svelte`

Primary ownership: deal-flow filtering UI.

Changes:

- Update asset-class filter labels if `Private Debt / Credit` becomes canonical.
- Preserve compatibility so existing `Lending` records still match.

### 10. `/Users/pascalwagner/Documents/New project/dealflow-onboarding-summary-nav/dealflow/src/lib/utils/dealAnalysis.js`

Primary ownership: buy-box match count behavior.

Changes:

- This currently uses direct equality for asset-class match in one path.
- Normalize lending-like / debt-like records so `Private Debt / Credit` onboarding preferences still match old `Lending` deals.

### 11. `/Users/pascalwagner/Documents/New project/dealflow-onboarding-summary-nav/dealflow/src/lib/utils/dealReturns.js`

Primary ownership: lending/debt deal detection.

Changes:

- Likely no major logic change required because this helper already recognizes debt/credit/lending-like deals.
- Verify behavior remains aligned with the canonical asset-class naming decision.

### 12. `/Users/pascalwagner/Documents/New project/dealflow-onboarding-summary-nav/dealflow/scripts/qa-plan-wizard.mjs`

Primary ownership: browser-level onboarding and `/app/plan` regression checks.

Changes:

- Extend QA coverage to include:
  - reordered initial LP onboarding
  - accreditation as second LP question
  - experience as third LP question
  - presence of `Private Debt / Credit` asset-class option
  - new max-check-size options
  - LP network explicit step
  - conditional profile-photo step
  - summary-page edit links after step reordering
  - phase-pill/toggle deep links after step reordering
- Keep existing plan-builder / roadmap / profile-review checks.

### 13. `/Users/pascalwagner/Documents/New project/dealflow-onboarding-summary-nav/dealflow/scripts/qa-plan-reset.mjs`

Primary ownership: isolated reset/new-plan API verification.

Changes:

- Keep this script and make it green.
- Verify `DELETE /api/buybox` and related reset calls work in a real authenticated scenario.
- Add snapshot-preservation checks if history/versioning is implemented.

## Persistence / History Recommendation

The current data model maintains one active `user_buy_box` per user and overwrites it.

That is fine for the active profile, but it is not enough for Member Success or future case studies.

Recommended addition:

- Introduce a historical snapshot table such as:
  - `user_buy_box_versions`
  - or `plan_snapshots`

Snapshot triggers:

- on completion of initial LP onboarding
- on completion of the full plan
- before `Start Over`
- before `New Plan`

Minimum snapshot payload:

- user id
- timestamp
- branch / goal
- onboarding answers at that moment
- active plan summary at that moment
- LP network participation flag

Keep `case_studies` as the editorial/storytelling layer, not the raw onboarding-history layer.

## QA Gates

Before handing back a branch URL, all of the following should be true:

- `npm run build` passes
- initial entry flow works:
  - name
  - role selection
- LP onboarding works end to end
- conditional photo step only appears when LP network visibility is enabled
- photo upload works or skip works cleanly
- all onboarding buttons work
- all top wizard toggles work
- summary-page `Edit` lands on the correct reordered review step
- roadmap `Edit Plan` lands on the editable plan-builder step
- refresh on deep-linked wizard steps works
- saved answers rehydrate correctly
- `New Plan` and `Start Over` work
- no unrelated user data is deleted

## Current QA Baseline Before This Refactor

Local branch status at time of writing:

- `npm run build` passed
- `BASE_URL=http://127.0.0.1:4174 npm run qa:plan-wizard` passed
- `BASE_URL=http://127.0.0.1:4174 npm run qa:plan-reset` failed

Current known failure:

- `DELETE /api/buybox` returned `502` in the isolated reset harness

Interpretation:

- Browser-level wizard/navigation coverage is green on the local preview build
- Isolated reset API coverage is not yet cleanly green and should be fixed or explained before the next branch handoff

## Suggested Order Of Work

1. Update initial LP onboarding flow in `LegacyOnboardingFlow.svelte`
2. Reorder canonical wizard metadata in `planWizard.js`
3. Update member-flow copy/order in `LegacyPlanWizard.svelte`
4. Verify `/app/plan` entry points and deep links in `+page.svelte`
5. Normalize `Private Debt / Credit` vs `Lending` across schema/filter/matching files
6. Reuse avatar upload path for the new photo step
7. Add snapshot/versioning support if included in scope
8. Update QA scripts
9. Run full local QA
10. Deploy preview and rerun QA against the branch URL

