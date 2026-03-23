-- Migration 043: LP Network — avatar + simplified privacy for social proof on deals
-- Adds profile photo support and a single share_activity toggle
-- Social proof counts are derived from user_deal_stages + user_profiles.share_activity

-- Profile photo
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS avatar_url text;

-- Single master privacy toggle (replaces granular 4-toggle UX, but keeps those columns)
-- When true: user's pipeline stages count toward "X LPs reviewing this deal"
-- When false: user is invisible in all social proof counts
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS share_activity boolean NOT NULL DEFAULT true;

-- Create Supabase Storage bucket for avatars (run via dashboard or CLI)
-- INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true);

-- RLS policy: users can upload their own avatar
-- CREATE POLICY "Users can upload own avatar" ON storage.objects
--   FOR INSERT WITH CHECK (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);
-- CREATE POLICY "Users can update own avatar" ON storage.objects
--   FOR UPDATE USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);
-- CREATE POLICY "Avatars are public" ON storage.objects
--   FOR SELECT USING (bucket_id = 'avatars');
