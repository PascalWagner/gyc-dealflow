-- Expand outreach pipeline stages for pre-outreach planning
-- New stages: backlog, researching, ready_to_contact, in_discussion
-- Replaces 'not_contacted' with 'backlog' as default starting state

-- 1. Drop the existing check constraint and add expanded one
alter table operator_permissions drop constraint if exists operator_permissions_outreach_status_check;

-- Migrate existing 'not_contacted' rows to 'backlog'
update operator_permissions set outreach_status = 'backlog' where outreach_status = 'not_contacted';

-- Add new check constraint with all 7 stages
alter table operator_permissions add constraint operator_permissions_outreach_status_check
  check (outreach_status in ('backlog', 'researching', 'ready_to_contact', 'contacted', 'follow_up', 'in_discussion', 'approved', 'denied'));

-- Update default
alter table operator_permissions alter column outreach_status set default 'backlog';

-- 2. Recreate the view with updated stage ordering
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

-- 3. Update the interaction type enum to include new stage transitions
alter table operator_interactions drop constraint if exists operator_interactions_interaction_type_check;
alter table operator_interactions add constraint operator_interactions_interaction_type_check
  check (interaction_type in ('email_sent', 'call', 'meeting', 'reply_received', 'permission_granted', 'permission_denied', 'note', 'status_change', 'research_note'));
