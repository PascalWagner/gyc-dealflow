-- Operator Interactions: timestamped log of all outreach activity per operator
-- Replaces single "notes" field with structured interaction history

create table operator_interactions (
  id                      uuid primary key default gen_random_uuid(),
  management_company_id   uuid not null references management_companies(id) on delete cascade,
  interaction_type         text not null
                          check (interaction_type in (
                            'email_sent', 'call', 'meeting', 'reply_received',
                            'permission_granted', 'permission_denied',
                            'note', 'status_change'
                          )),
  note                    text default '',
  metadata                jsonb default '{}',   -- flexible: old/new status, template used, etc.
  created_by              text not null,         -- admin email
  created_at              timestamptz default now()
);

create index idx_oi_mc on operator_interactions(management_company_id);
create index idx_oi_created on operator_interactions(created_at desc);

-- RLS: admin-only
alter table operator_interactions enable row level security;

create policy "oi_admin_read" on operator_interactions for select
  using (is_admin());
create policy "oi_admin_insert" on operator_interactions for insert
  with check (is_admin());
create policy "oi_admin_delete" on operator_interactions for delete
  using (is_admin());
