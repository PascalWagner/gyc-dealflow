# Supabase Migration: Step-by-Step

## Overview

Migrating from:
- **Airtable** (deals, user data) → **Supabase Postgres**
- **GHL custom fields** (buy box) → **Supabase table** (still syncs to GHL)
- **Make.com → Google Drive** (file uploads) → **Supabase Storage**
- **GHL + hand-rolled auth** → **Supabase Auth** (real JWT tokens)

GHL stays as the CRM — tags, automations, and funnel tracking still sync there.

---

## Step 1: Create Supabase Project (5 min)

1. Go to [supabase.com](https://supabase.com) → New Project
2. Name: `gyc-dealflow`
3. Region: **US East** (closest to your Vercel deployment)
4. Generate a strong database password (save it)
5. Wait for project to provision (~2 min)

## Step 2: Get Your Keys

From Supabase Dashboard → Settings → API:
- **Project URL** → `SUPABASE_URL`
- **anon / public key** → `SUPABASE_ANON_KEY`
- **service_role key** → `SUPABASE_SERVICE_ROLE_KEY` (keep secret!)

## Step 3: Run the Schema Migration (5 min)

1. Go to Supabase Dashboard → SQL Editor
2. Open `supabase/migrations/001_initial_schema.sql`
3. Paste the entire file and click **Run**
4. Verify tables appear in Table Editor

## Step 4: Create Storage Buckets (2 min)

In Supabase Dashboard → Storage:
1. Create bucket: `deal-decks` (private)
2. Create bucket: `tax-docs` (private)

## Step 5: Enable Realtime (1 min)

In Supabase Dashboard → Database → Replication:
- Enable for: `dd_checklist`, `user_deal_stages`, `opportunities`

## Step 6: Run Data Migration (10 min)

```bash
cd dealflow/supabase

# Install supabase-js if not already
npm install @supabase/supabase-js

# Run migration
AIRTABLE_PAT=your_pat \
SUPABASE_URL=https://xxxxx.supabase.co \
SUPABASE_SERVICE_ROLE_KEY=your_service_key \
node migrate-from-airtable.js
```

## Step 7: Install Supabase SDK

```bash
cd dealflow
npm install @supabase/supabase-js
```

## Step 8: Add Environment Variables to Vercel

In Vercel Dashboard → Settings → Environment Variables:
```
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

Keep existing GHL and Resend keys (still used).

## Step 9: Swap API Endpoints

Rename files to activate Supabase versions:

```bash
cd dealflow/api

# Back up originals
mkdir -p _airtable_backup
cp deals.js _airtable_backup/
cp userdata.js _airtable_backup/
cp auth.js _airtable_backup/
cp buybox.js _airtable_backup/
cp ddchecklist.js _airtable_backup/
cp deal-stats.js _airtable_backup/
cp events.js _airtable_backup/
cp deck-upload.js _airtable_backup/

# Activate Supabase versions
cp deals.supabase.js deals.js
cp userdata.supabase.js userdata.js
cp auth.supabase.js auth.js
cp buybox.supabase.js buybox.js
cp ddchecklist.supabase.js ddchecklist.js
cp deal-stats.supabase.js deal-stats.js
cp events.supabase.js events.js
cp deck-upload.supabase.js deck-upload.js
```

## Step 10: Deploy and Test

```bash
vercel --prod
```

Test each endpoint:
- `GET /api/deals` — should return all deals
- `POST /api/auth` with `action: 'login'` — should return JWT
- `GET /api/buybox?email=...` — should return preferences
- `POST /api/userdata` — should save user data

## Step 11: Clean Up (after verification)

Once everything works in production for a week:
1. Remove Airtable PAT from Vercel env vars
2. Delete the `.supabase.js` files and `_airtable_backup/`
3. Cancel Airtable subscription
4. Remove Make.com webhook for file uploads

---

## Architecture After Migration

```
Frontend (web + iOS)
  ↓ (Supabase Auth JWT)
Vercel Serverless APIs
  ↓
Supabase (Postgres + Storage + Auth + Realtime)
  ↓ (background sync)
GHL (CRM only: tags, automations, email/SMS)
```

## Cost

| Service | Monthly |
|---------|---------|
| Supabase Free tier | $0 |
| Supabase Pro (if needed) | $25 |
| Vercel (current) | $0-20 |
| GHL (current, keeping) | existing |
| **Total new cost** | **$0-25** |
