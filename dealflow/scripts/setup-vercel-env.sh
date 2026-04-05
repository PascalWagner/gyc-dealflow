#!/usr/bin/env bash
# setup-vercel-env.sh
#
# Scopes Supabase (and related) env vars in Vercel so that:
#   - Production  → prod Supabase project (nntzqyufmtypfjpusflm)
#   - Preview     → dev Supabase project  (fill in DEV_* below)
#   - Development → dev Supabase project  (fill in DEV_* below)
#
# Prerequisites:
#   npm i -g vercel
#   vercel login
#   vercel link   (run once inside dealflow/)
#
# Run from the dealflow/ directory:
#   bash scripts/setup-vercel-env.sh
#
# IMPORTANT: Fill in the DEV_* variables below before running.
# ─────────────────────────────────────────────────────────────────────────────

set -euo pipefail

# ── Fill these in ─────────────────────────────────────────────────────────────
PROD_SUPABASE_URL="https://nntzqyufmtypfjpusflm.supabase.co"
PROD_SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5udHpxeXVmbXR5cGZqcHVzZmxtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM5NzU2NzksImV4cCI6MjA4OTU1MTY3OX0.pm6TDqZT37942PrVP0NQxtMiuucPuEicE32qVDebCZ4"
PROD_SUPABASE_SERVICE_ROLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5udHpxeXVmbXR5cGZqcHVzZmxtIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3Mzk3NTY3OSwiZXhwIjoyMDg5NTUxNjc5fQ.Hx5hs5AAE7Rorw4OvyfA4UKDr7zWk0-GfNgToc0eGFw"

# Get these from Supabase Dashboard → Settings → API for the dev project
DEV_SUPABASE_URL="https://FILL_IN_DEV_PROJECT_ID.supabase.co"
DEV_SUPABASE_ANON_KEY="FILL_IN_DEV_ANON_KEY"
DEV_SUPABASE_SERVICE_ROLE_KEY="FILL_IN_DEV_SERVICE_ROLE_KEY"
# ─────────────────────────────────────────────────────────────────────────────

if [[ "$DEV_SUPABASE_URL" == *"FILL_IN"* ]]; then
  echo "❌ Fill in the DEV_* variables at the top of this script before running."
  exit 1
fi

echo "🔧 Scoping Supabase env vars in Vercel..."
echo "   Prod  → $PROD_SUPABASE_URL"
echo "   Dev   → $DEV_SUPABASE_URL"
echo ""

# ── Helper: remove var from one environment (ignore error if not set) ─────────
rm_env() {
  local var="$1" env="$2"
  vercel env rm "$var" "$env" --yes 2>/dev/null || true
}

# ── Remove existing vars from all three environments ─────────────────────────
for ENV in production preview development; do
  rm_env SUPABASE_URL "$ENV"
  rm_env SUPABASE_ANON_KEY "$ENV"
  rm_env SUPABASE_SERVICE_ROLE_KEY "$ENV"
  rm_env VITE_SUPABASE_URL "$ENV"
  rm_env VITE_SUPABASE_ANON_KEY "$ENV"
done

echo "✅ Removed old env vars."

# ── Add production vars → prod Supabase ───────────────────────────────────────
echo "$PROD_SUPABASE_URL"           | vercel env add SUPABASE_URL           production
echo "$PROD_SUPABASE_ANON_KEY"      | vercel env add SUPABASE_ANON_KEY      production
echo "$PROD_SUPABASE_SERVICE_ROLE_KEY" | vercel env add SUPABASE_SERVICE_ROLE_KEY production
# Frontend VITE_ vars for production (used by client-side Supabase realtime/auth)
echo "$PROD_SUPABASE_URL"           | vercel env add VITE_SUPABASE_URL      production
echo "$PROD_SUPABASE_ANON_KEY"      | vercel env add VITE_SUPABASE_ANON_KEY production

echo "✅ Production → prod Supabase."

# ── Add preview vars → dev Supabase ───────────────────────────────────────────
echo "$DEV_SUPABASE_URL"            | vercel env add SUPABASE_URL           preview
echo "$DEV_SUPABASE_ANON_KEY"       | vercel env add SUPABASE_ANON_KEY      preview
echo "$DEV_SUPABASE_SERVICE_ROLE_KEY" | vercel env add SUPABASE_SERVICE_ROLE_KEY preview
echo "$DEV_SUPABASE_URL"            | vercel env add VITE_SUPABASE_URL      preview
echo "$DEV_SUPABASE_ANON_KEY"       | vercel env add VITE_SUPABASE_ANON_KEY preview

echo "✅ Preview → dev Supabase."

# ── Add development vars → dev Supabase ───────────────────────────────────────
echo "$DEV_SUPABASE_URL"            | vercel env add SUPABASE_URL           development
echo "$DEV_SUPABASE_ANON_KEY"       | vercel env add SUPABASE_ANON_KEY      development
echo "$DEV_SUPABASE_SERVICE_ROLE_KEY" | vercel env add SUPABASE_SERVICE_ROLE_KEY development
echo "$DEV_SUPABASE_URL"            | vercel env add VITE_SUPABASE_URL      development
echo "$DEV_SUPABASE_ANON_KEY"       | vercel env add VITE_SUPABASE_ANON_KEY development

echo "✅ Development → dev Supabase."

echo ""
echo "🎉 Done. Verify in Vercel Dashboard → Settings → Environment Variables."
echo ""
echo "Next steps:"
echo "  1. Apply migrations to dev Supabase:"
echo "     npx supabase db push --db-url 'postgresql://postgres:PASSWORD@db.DEV_PROJECT_ID.supabase.co:5432/postgres'"
echo "  2. Update .env.local VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY with dev keys"
echo "  3. Redeploy sandbox: push any commit to trigger a new Vercel preview build"
