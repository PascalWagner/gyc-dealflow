#!/usr/bin/env node
// Migration: canonicalize sponsorCoinvest → sponsorInDeal in review_field_state JSONB
//
// Finds all opportunities where review_field_state contains a 'sponsorCoinvest' key
// and migrates the entry to 'sponsorInDeal', then removes the old key.
//
// Rules:
//   - If sponsorInDeal does NOT exist: copy sponsorCoinvest → sponsorInDeal, delete sponsorCoinvest
//   - If sponsorInDeal DOES exist: log the conflict and skip (never overwrite human work)
//   - Idempotent: safe to run multiple times
//
// Usage:
//   node scripts/migrate-canonicalize-sponsor-coinvest.mjs --dry-run   (default: reads only)
//   node scripts/migrate-canonicalize-sponsor-coinvest.mjs --apply      (writes to DB)

import { createClient } from '@supabase/supabase-js';

const MODE_ARG = process.argv.find((a) => a === '--apply' || a === '--dry-run');
const DRY_RUN = MODE_ARG !== '--apply';

if (!MODE_ARG) {
  console.log('ℹ️  No flag provided — defaulting to --dry-run. Pass --apply to write changes.');
}
console.log(`\n🔧 migrate-canonicalize-sponsor-coinvest [${DRY_RUN ? 'DRY RUN' : 'APPLY'}]\n`);

const sb = createClient(
  'https://nntzqyufmtypfjpusflm.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5udHpxeXVmbXR5cGZqcHVzZmxtIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3Mzk3NTY3OSwiZXhwIjoyMDg5NTUxNjc5fQ.Hx5hs5AAE7Rorw4OvyfA4UKDr7zWk0-GfNgToc0eGFw'
);

// ── Stats ────────────────────────────────────────────────────────────────────

const stats = {
  total: 0,       // deals with sponsorCoinvest in review_field_state
  migrated: 0,    // copied to sponsorInDeal + deleted sponsorCoinvest
  skipped: 0,     // sponsorInDeal already existed (conflict — no overwrite)
  errors: 0       // DB errors during update
};

// ── Fetch all affected deals ─────────────────────────────────────────────────

const { data: deals, error: fetchError } = await sb
  .from('opportunities')
  .select('id, investment_name, review_field_state')
  .not('review_field_state', 'is', null)
  .filter('review_field_state', 'cs', '{"sponsorCoinvest":{}}');

if (fetchError) {
  console.error('❌ Failed to fetch deals:', fetchError.message);
  process.exit(1);
}

if (!deals || deals.length === 0) {
  console.log('✅ No deals found with sponsorCoinvest in review_field_state — nothing to migrate.\n');
  process.exit(0);
}

stats.total = deals.length;
console.log(`Found ${deals.length} deal(s) with sponsorCoinvest in review_field_state:\n`);

// ── Process each deal ────────────────────────────────────────────────────────

for (const deal of deals) {
  const name = deal.investment_name || deal.id;
  const rfs = deal.review_field_state || {};

  const coinvestEntry = rfs.sponsorCoinvest;
  const inDealEntry   = rfs.sponsorInDeal;

  if (!coinvestEntry) {
    // Shouldn't happen given the filter, but be safe
    console.log(`  [skip] ${name} — sponsorCoinvest entry missing after fetch (already migrated?)`);
    stats.skipped++;
    continue;
  }

  if (inDealEntry) {
    // Both keys exist — do not overwrite human work
    const coinvestVal = coinvestEntry?.adminOverrideActive
      ? coinvestEntry.adminOverrideValue
      : coinvestEntry?.aiValue ?? null;
    const inDealVal = inDealEntry?.adminOverrideActive
      ? inDealEntry.adminOverrideValue
      : inDealEntry?.aiValue ?? null;

    console.log(`  [CONFLICT] ${name} (${deal.id})`);
    console.log(`    sponsorCoinvest value: ${coinvestVal}`);
    console.log(`    sponsorInDeal value:   ${inDealVal} ← keeping this`);
    console.log(`    Action: sponsorCoinvest will be deleted; sponsorInDeal kept as-is.`);

    // Remove the stale key but keep sponsorInDeal
    if (!DRY_RUN) {
      const nextRfs = { ...rfs };
      delete nextRfs.sponsorCoinvest;
      const { error } = await sb
        .from('opportunities')
        .update({ review_field_state: nextRfs })
        .eq('id', deal.id);
      if (error) {
        console.error(`    ❌ Update failed: ${error.message}`);
        stats.errors++;
        continue;
      }
      console.log(`    ✅ sponsorCoinvest removed (sponsorInDeal preserved)`);
    } else {
      console.log(`    [dry-run] Would remove sponsorCoinvest (sponsorInDeal preserved)`);
    }
    stats.skipped++;
    continue;
  }

  // Happy path: copy sponsorCoinvest → sponsorInDeal, then remove sponsorCoinvest
  const migratedVal = coinvestEntry?.adminOverrideActive
    ? coinvestEntry.adminOverrideValue
    : coinvestEntry?.aiValue ?? null;

  console.log(`  [migrate] ${name} (${deal.id})`);
  console.log(`    sponsorCoinvest value: ${migratedVal}`);
  console.log(`    Action: copy to sponsorInDeal, delete sponsorCoinvest`);

  if (!DRY_RUN) {
    const nextRfs = { ...rfs };
    nextRfs.sponsorInDeal = nextRfs.sponsorCoinvest;
    delete nextRfs.sponsorCoinvest;

    const { error } = await sb
      .from('opportunities')
      .update({ review_field_state: nextRfs })
      .eq('id', deal.id);

    if (error) {
      console.error(`    ❌ Update failed: ${error.message}`);
      stats.errors++;
      continue;
    }
    console.log(`    ✅ Migrated successfully`);
  } else {
    console.log(`    [dry-run] Would copy sponsorCoinvest → sponsorInDeal and delete sponsorCoinvest`);
  }
  stats.migrated++;
}

// ── Summary ──────────────────────────────────────────────────────────────────

console.log(`\n${'─'.repeat(50)}`);
console.log(`Migration summary [${DRY_RUN ? 'DRY RUN — no writes made' : 'APPLIED'}]:`);
console.log(`  Total deals found:   ${stats.total}`);
console.log(`  Would migrate:       ${stats.migrated}`);
console.log(`  Conflict (skipped):  ${stats.skipped}`);
if (stats.errors > 0) console.log(`  Errors:              ${stats.errors}`);
console.log('');

if (DRY_RUN && stats.total > 0) {
  console.log('Run with --apply to execute the migration.\n');
}

process.exit(stats.errors > 0 ? 1 : 0);
