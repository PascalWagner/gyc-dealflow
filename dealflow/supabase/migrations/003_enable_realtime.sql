-- Enable Supabase Realtime for collaborative tables
-- Run in Supabase SQL Editor

-- DD Checklist: live updates when any user checks/unchecks an item
alter publication supabase_realtime add table dd_checklist;

-- User Deal Stages: live deal stage counts on deal cards
alter publication supabase_realtime add table user_deal_stages;

-- Opportunities: live updates when new deals are added
alter publication supabase_realtime add table opportunities;
