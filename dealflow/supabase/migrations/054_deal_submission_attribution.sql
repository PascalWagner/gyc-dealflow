-- Deal submission attribution + lifecycle alignment
-- Tracks who introduced deals into the system and how they entered.

alter table opportunities
  add column if not exists submission_intent text default '',
  add column if not exists submission_surface text default '',
  add column if not exists submitted_by_id uuid references user_profiles(id) on delete set null,
  add column if not exists submitted_by_name text default '',
  add column if not exists submitted_by_email text default '',
  add column if not exists submitted_by_role text default 'admin';

alter table deck_submissions
  add column if not exists doc_type text default 'deck',
  add column if not exists submission_kind text default 'document_upload',
  add column if not exists submission_intent text default '',
  add column if not exists entry_surface text default '',
  add column if not exists submitted_by_role text default 'admin',
  add column if not exists created_new_deal boolean default false,
  add column if not exists linked_existing_deal boolean default false;

update opportunities
set submitted_by_role = 'admin'
where coalesce(btrim(submitted_by_role), '') = '';

update deck_submissions
set submitted_by_role = 'admin'
where coalesce(btrim(submitted_by_role), '') = '';

update deck_submissions
set doc_type = 'deck'
where coalesce(btrim(doc_type), '') = '';

update deck_submissions
set submission_kind = 'document_upload'
where coalesce(btrim(submission_kind), '') = '';

alter table opportunities
  drop constraint if exists opportunities_lifecycle_status_check;

alter table opportunities
  add constraint opportunities_lifecycle_status_check
  check (lifecycle_status in ('draft', 'in_review', 'approved', 'published', 'do_not_publish', 'archived'));

create index if not exists idx_opportunities_submitted_by_role on opportunities(submitted_by_role);
create index if not exists idx_opportunities_submitted_by_email on opportunities(submitted_by_email);
create index if not exists idx_deck_submissions_submitted_by_role on deck_submissions(submitted_by_role);
create index if not exists idx_deck_submissions_submission_kind on deck_submissions(submission_kind);
