-- Add GHL contact linking and LinkedIn to operator_permissions
-- Enables linking operators to GHL CRM contacts for synced contact data

ALTER TABLE operator_permissions
  ADD COLUMN IF NOT EXISTS ghl_contact_id text,
  ADD COLUMN IF NOT EXISTS contact_linkedin text;

-- Index for looking up operators by GHL contact
CREATE INDEX IF NOT EXISTS idx_operator_permissions_ghl_contact
  ON operator_permissions (ghl_contact_id)
  WHERE ghl_contact_id IS NOT NULL;

-- Recreate view to include new columns
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
  coalesce(op.outreach_status, 'backlog') as outreach_status,
  op.outreach_date,
  op.outreach_method,
  op.contact_name,
  op.contact_email,
  op.contact_phone,
  op.contact_linkedin,
  op.ghl_contact_id,
  op.permission_granted,
  op.permission_date,
  op.permission_scope,
  op.permission_proof_url,
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
  case coalesce(op.outreach_status, 'backlog')
    when 'backlog' then 1
    when 'researching' then 2
    when 'ready_to_contact' then 3
    when 'contacted' then 4
    when 'follow_up' then 5
    when 'in_discussion' then 6
    when 'denied' then 7
    when 'approved' then 8
  end,
  mc.operator_name;
