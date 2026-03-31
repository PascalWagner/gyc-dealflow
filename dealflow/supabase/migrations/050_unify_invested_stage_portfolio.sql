-- Make pipeline stage the single source of truth for invested deals.
-- 1. Backfill invested stages from existing linked portfolio rows.
-- 2. Rebuild deal_stage_counts with canonical columns, while keeping legacy aliases
--    so older analytics consumers do not break during rollout.

insert into user_deal_stages (user_id, deal_id, stage, notes, updated_at)
select
  user_id,
  deal_id,
  'invested',
  '',
  coalesce(updated_at, created_at, now())
from user_portfolio
where deal_id is not null
on conflict (user_id, deal_id) do update
set
  stage = 'invested',
  updated_at = greatest(
    coalesce(user_deal_stages.updated_at, excluded.updated_at),
    excluded.updated_at
  );

create or replace view deal_stage_counts as
with normalized as (
  select
    deal_id,
    case
      when stage in ('saved', 'interested', 'review') then 'review'
      when stage in ('vetting', 'duediligence', 'diligence', 'connect') then 'connect'
      when stage in ('decision', 'ready', 'decide') then 'decide'
      when stage in ('invested', 'portfolio') then 'invested'
      when stage in ('passed', 'skipped') then 'skipped'
      else 'filter'
    end as canonical_stage
  from user_deal_stages
)
select
  deal_id,
  count(*) filter (where canonical_stage = 'review') as review,
  count(*) filter (where canonical_stage = 'connect') as connect,
  count(*) filter (where canonical_stage = 'decide') as decide,
  count(*) filter (where canonical_stage = 'invested') as invested,
  count(*) filter (where canonical_stage = 'skipped') as skipped,
  count(*) filter (where canonical_stage = 'review') as interested,
  count(*) filter (where canonical_stage in ('connect', 'decide')) as duediligence,
  count(*) filter (where canonical_stage = 'invested') as portfolio
from normalized
group by deal_id;
