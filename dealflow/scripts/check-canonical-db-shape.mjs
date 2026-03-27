#!/usr/bin/env node
// Verify the production DB has the canonical schema expected by the deployed app.
// Usage: node scripts/check-canonical-db-shape.mjs
//   Requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in env.

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('ERROR: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false }
});

let failures = 0;

async function checkTable(name, requiredColumns) {
  const { data, error } = await supabase.from(name).select('*').limit(0);
  if (error) {
    console.error(`FAIL: ${name} — ${error.message}`);
    failures++;
    return;
  }
  console.log(`  OK: ${name} exists`);
}

async function checkColumn(table, column) {
  // Use a raw select to check if the column is queryable
  const { error } = await supabase.from(table).select(column).limit(0);
  if (error) {
    console.error(`FAIL: ${table}.${column} — ${error.message}`);
    failures++;
    return;
  }
  console.log(`  OK: ${table}.${column}`);
}

console.log('\n=== Canonical DB Shape Check ===\n');

console.log('1. user_profiles privacy + notification fields');
for (const col of [
  'share_saved', 'share_dd', 'share_invested', 'allow_follows',
  'share_activity', 'email_digest_enabled', 'deal_alerts_enabled'
]) {
  await checkColumn('user_profiles', col);
}

console.log('\n2. user_deal_stages canonical stage contract');
await checkTable('user_deal_stages');

console.log('\n3. deal_stage_counts view');
await checkTable('deal_stage_counts');
for (const col of ['deal_id', 'interested', 'duediligence', 'portfolio']) {
  await checkColumn('deal_stage_counts', col);
}

console.log('\n4. weekly_digest_runs');
await checkTable('weekly_digest_runs');

console.log('\n5. weekly_digest_deliveries');
await checkTable('weekly_digest_deliveries');

console.log('\n6. weekly_digest_delivery_attempts');
await checkTable('weekly_digest_delivery_attempts');

console.log('\n================================');
if (failures > 0) {
  console.error(`\nFAILED: ${failures} check(s) did not pass.`);
  process.exit(1);
} else {
  console.log('\nAll canonical DB shape checks passed.');
  process.exit(0);
}
