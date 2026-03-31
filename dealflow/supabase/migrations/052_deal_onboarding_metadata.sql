-- Deal onboarding metadata
-- Supports the staged review flow by persisting the explicit decision-tree branch
-- plus source-backed and highlighted risk lists curated during review.

alter table opportunities
  add column if not exists deal_branch text,
  add column if not exists source_risk_factors jsonb not null default '[]'::jsonb,
  add column if not exists highlighted_risks jsonb not null default '[]'::jsonb;

comment on column opportunities.deal_branch is
  'Explicit onboarding branch chosen during review: equity_single_asset, equity_fund, lending_single_loan, or lending_fund.';

comment on column opportunities.source_risk_factors is
  'Risk factors captured from source documents such as the PPM or investment deck.';

comment on column opportunities.highlighted_risks is
  'Reviewer-curated risk bullets intended for the live deal page.';
