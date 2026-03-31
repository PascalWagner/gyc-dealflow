-- Deal QA and publishing workflow
-- Adds lifecycle + visibility controls plus admin QA metadata fields.

alter table opportunities
  add column if not exists lifecycle_status text,
  add column if not exists is_visible_to_users boolean,
  add column if not exists sponsor_name text default '',
  add column if not exists short_summary text default '',
  add column if not exists cover_image_url text default '',
  add column if not exists hero_media_url text default '',
  add column if not exists risk_notes text default '',
  add column if not exists downside_notes text default '',
  add column if not exists slug text default '',
  add column if not exists primary_source_context text default '',
  add column if not exists primary_source_url text default '',
  add column if not exists cash_yield numeric,
  add column if not exists fee_summary text default '',
  add column if not exists tax_characteristics text default '',
  add column if not exists tags text[] default '{}',
  add column if not exists operator_background text default '',
  add column if not exists key_dates text default '';

update opportunities
set sponsor_name = ''
where sponsor_name is null;

update opportunities
set slug = lower(
  regexp_replace(
    regexp_replace(coalesce(investment_name, ''), '[^a-zA-Z0-9]+', '-', 'g'),
    '(^-+|-+$)',
    '',
    'g'
  )
)
where coalesce(btrim(slug), '') = ''
  and coalesce(btrim(investment_name), '') <> '';

update opportunities
set lifecycle_status = case
  when coalesce(archived, false) = true or lower(coalesce(status, '')) = 'archived' then 'archived'
  when lower(coalesce(status, '')) = 'draft' then 'draft'
  else 'published'
end
where lifecycle_status is null
   or btrim(lifecycle_status) = '';

update opportunities
set is_visible_to_users = case
  when coalesce(archived, false) = true or lower(coalesce(status, '')) = 'archived' then false
  when lower(coalesce(status, '')) = 'draft' then false
  else true
end
where is_visible_to_users is null;

update opportunities
set is_visible_to_users = false
where lifecycle_status = 'archived'
  and is_visible_to_users = true;

alter table opportunities
  alter column lifecycle_status set default 'draft',
  alter column is_visible_to_users set default false;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'opportunities_lifecycle_status_check'
  ) then
    alter table opportunities
      add constraint opportunities_lifecycle_status_check
      check (lifecycle_status in ('draft', 'in_review', 'approved', 'published', 'archived'));
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'opportunities_archived_visibility_check'
  ) then
    alter table opportunities
      add constraint opportunities_archived_visibility_check
      check (not (lifecycle_status = 'archived' and is_visible_to_users = true));
  end if;
end $$;

create index if not exists idx_opportunities_lifecycle_status on opportunities(lifecycle_status);
create index if not exists idx_opportunities_visible_to_users on opportunities(is_visible_to_users);
create index if not exists idx_opportunities_slug on opportunities(slug);
