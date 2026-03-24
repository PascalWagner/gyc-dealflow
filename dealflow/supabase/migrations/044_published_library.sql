-- Migration 044: Published content library
-- Canonical content item with multiple platform-specific published versions

create table if not exists published_contents (
  id uuid primary key default gen_random_uuid(),
  content_id text not null unique,
  title text not null,
  slug text not null,
  content_group_id text,
  primary_topic text not null,
  theme_tags jsonb not null default '[]'::jsonb,
  format text not null,
  hook text not null,
  canonical_content_text text not null default '',
  content_summary text,
  cta_type text not null default 'none',
  evergreen_status text not null default 'evergreen',
  repurpose_potential text not null default 'medium',
  origin_type text not null default 'original',
  source_doc_url text,
  drive_folder_url text,
  preview_image_url text,
  archive_status text not null default 'incomplete',
  archive_complete boolean not null default false,
  ai_retrieval_notes text,
  search_document text not null default '',
  first_published_at timestamptz,
  last_published_at timestamptz,
  best_platform text,
  best_platform_score numeric not null default 0,
  aggregate_performance_score numeric not null default 0,
  total_views integer not null default 0,
  total_engagements integer not null default 0,
  created_by_email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_published_contents_primary_topic on published_contents(primary_topic);
create index if not exists idx_published_contents_format on published_contents(format);
create index if not exists idx_published_contents_archive_status on published_contents(archive_status);
create index if not exists idx_published_contents_evergreen_status on published_contents(evergreen_status);
create index if not exists idx_published_contents_repurpose_potential on published_contents(repurpose_potential);
create index if not exists idx_published_contents_last_published_at on published_contents(last_published_at desc);
create index if not exists idx_published_contents_performance on published_contents(aggregate_performance_score desc);

create table if not exists published_distributions (
  id uuid primary key default gen_random_uuid(),
  published_content_id uuid not null references published_contents(id) on delete cascade,
  platform text not null,
  published_url text not null,
  published_at timestamptz not null,
  platform_handle text,
  variant_label text,
  platform_text text,
  preview_image_url text,
  impressions integer not null default 0,
  views integer not null default 0,
  likes integer not null default 0,
  comments integer not null default 0,
  shares integer not null default 0,
  saves integer not null default 0,
  clicks integer not null default 0,
  replies integer not null default 0,
  engagement_rate numeric not null default 0,
  performance_score numeric not null default 0,
  raw_metrics jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint uq_published_content_platform unique (published_content_id, platform)
);

create index if not exists idx_published_distributions_platform on published_distributions(platform);
create index if not exists idx_published_distributions_published_at on published_distributions(published_at desc);
create index if not exists idx_published_distributions_performance on published_distributions(performance_score desc);
