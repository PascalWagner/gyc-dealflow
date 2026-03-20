#!/bin/bash
# Swap Airtable API endpoints for Supabase versions
# Run: npm run db:swap

set -e
cd "$(dirname "$0")/../api"

echo "=== Backing up Airtable endpoints ==="
mkdir -p _airtable_backup

for file in deals.js userdata.js auth.js buybox.js ddchecklist.js deal-stats.js events.js deck-upload.js; do
  if [ -f "$file" ] && [ -f "${file%.js}.supabase.js" ]; then
    echo "  Backing up $file → _airtable_backup/$file"
    cp "$file" "_airtable_backup/$file"
    echo "  Activating ${file%.js}.supabase.js → $file"
    cp "${file%.js}.supabase.js" "$file"
  fi
done

echo ""
echo "=== Done! ==="
echo "Airtable originals saved in api/_airtable_backup/"
echo "Supabase versions are now active."
echo ""
echo "Next: deploy with 'vercel --prod'"
