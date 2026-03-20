-- Helper function for the Airtable → Supabase data migration.
-- Maps old Airtable record IDs to new Supabase UUIDs so foreign keys resolve.
--
-- Usage during migration:
--   1. Insert management_companies first (they have no dependencies)
--   2. Insert opportunities (needs management_company_id mapped)
--   3. Insert user_profiles (create auth.users first via Supabase Auth API)
--   4. Insert user data tables (needs user_id + deal_id mapped)

-- Temporary mapping table (drop after migration)
create table if not exists _migration_id_map (
  airtable_id   text primary key,
  supabase_id   uuid not null,
  table_name    text not null
);

create index idx_migration_table on _migration_id_map(table_name);

-- After migration is complete, clean up:
-- drop table _migration_id_map;
