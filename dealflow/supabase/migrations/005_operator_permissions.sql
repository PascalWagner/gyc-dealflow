-- Operator Permissions: track outreach to operators and their permission to share deals
-- Supports 506(b) compliance by logging explicit permission + proof

create table operator_permissions (
  id                      uuid primary key default gen_random_uuid(),
  management_company_id   uuid not null references management_companies(id) on delete cascade,

  -- Outreach tracking
  outreach_status         text not null default 'not_contacted'
                          check (outreach_status in ('not_contacted', 'contacted', 'follow_up', 'approved', 'denied')),
  outreach_date           timestamptz,
  outreach_method         text,                          -- 'email', 'phone', 'linkedin'
  contact_name            text,                          -- who at the operator you spoke to
  contact_email           text,                          -- their email
  contact_phone           text,

  -- Permission details
  permission_granted      boolean default false,
  permission_date         timestamptz,
  permission_scope        text default '',               -- what exactly they approved (e.g. "share deck + metrics with accredited investors")
  permission_proof_url    text default '',               -- link to email thread, signed doc, etc.

  -- Deal sharing rules
  offering_type           text default 'unknown'
                          check (offering_type in ('506b', '506c', 'reg_a', 'reg_d', 'unknown')),
  can_show_deck           boolean default false,
  can_show_ppm            boolean default false,
  can_show_metrics        boolean default true,          -- basic IRR/returns usually OK

  -- Relationship building
  send_performance_updates boolean default false,        -- operator opted in to receive performance emails
  notes                   text default '',

  -- Metadata
  created_at              timestamptz default now(),
  updated_at              timestamptz default now()
);

-- One permission record per operator
create unique index idx_op_perm_mc on operator_permissions(management_company_id);

-- Quick lookups
create index idx_op_perm_status on operator_permissions(outreach_status);
create index idx_op_perm_granted on operator_permissions(permission_granted);

-- Auto-update timestamp
create trigger trg_op_perm_updated
  before update on operator_permissions
  for each row execute function update_updated_at();

-- RLS: admin-only table
alter table operator_permissions enable row level security;

create policy "op_perm_admin_read" on operator_permissions for select
  using (is_admin());
create policy "op_perm_admin_insert" on operator_permissions for insert
  with check (is_admin());
create policy "op_perm_admin_update" on operator_permissions for update
  using (is_admin());
create policy "op_perm_admin_delete" on operator_permissions for delete
  using (is_admin());

-- View: operators with permission status (for admin dashboard)
-- Seed: create a not_contacted record for every existing operator
insert into operator_permissions (management_company_id)
select id from management_companies
on conflict (management_company_id) do nothing;

-- View: operators with permission status (for admin dashboard)
create or replace view operators_with_permissions as
select
  mc.id,
  mc.operator_name,
  mc.ceo,
  mc.website,
  mc.linkedin_ceo,
  mc.type,
  mc.asset_classes,
  mc.founding_year,
  coalesce(op.outreach_status, 'not_contacted') as outreach_status,
  op.outreach_date,
  op.outreach_method,
  op.contact_name,
  op.contact_email,
  op.permission_granted,
  op.permission_date,
  op.permission_scope,
  op.offering_type,
  op.can_show_deck,
  op.can_show_ppm,
  op.can_show_metrics,
  op.send_performance_updates,
  op.notes as permission_notes,
  (select count(*) from opportunities o where o.management_company_id = mc.id) as deal_count
from management_companies mc
left join operator_permissions op on op.management_company_id = mc.id
order by
  case coalesce(op.outreach_status, 'not_contacted')
    when 'not_contacted' then 1
    when 'contacted' then 2
    when 'follow_up' then 3
    when 'denied' then 4
    when 'approved' then 5
  end,
  mc.operator_name;
