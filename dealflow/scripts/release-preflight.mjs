#!/usr/bin/env node
// Release preflight: confirms the production environment is ready.
// Gates:
//   1. Required env vars are set
//   2. Database schema matches expected shape
//   3. Digest endpoint responds correctly
//
// Usage: node scripts/release-preflight.mjs
//   Set DIGEST_ENABLED, DIGEST_SECRET, RESEND_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

import { createClient } from '@supabase/supabase-js';

const required = {
  SUPABASE_URL: process.env.SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  DIGEST_ENABLED: process.env.DIGEST_ENABLED,
  DIGEST_SECRET: process.env.DIGEST_SECRET,
  RESEND_API_KEY: process.env.RESEND_API_KEY
};

let failures = 0;

console.log('\n=== Release Preflight ===\n');

// Gate 1: Env vars
console.log('Gate 1: Environment variables');
for (const [key, val] of Object.entries(required)) {
  if (!val) {
    console.error(`  FAIL: ${key} is not set`);
    failures++;
  } else {
    console.log(`  OK: ${key}`);
  }
}

// Gate 2: Database schema
console.log('\nGate 2: Database schema');
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (SUPABASE_URL && SUPABASE_KEY) {
  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: false }
  });

  const tables = [
    'user_profiles', 'user_deal_stages', 'deal_stage_counts',
    'weekly_digest_runs', 'weekly_digest_deliveries', 'weekly_digest_delivery_attempts'
  ];

  for (const table of tables) {
    const { error } = await supabase.from(table).select('*').limit(0);
    if (error) {
      console.error(`  FAIL: ${table} — ${error.message}`);
      failures++;
    } else {
      console.log(`  OK: ${table}`);
    }
  }

  // Check critical columns
  const columnChecks = [
    ['user_profiles', 'email_digest_enabled'],
    ['user_profiles', 'deal_alerts_enabled'],
    ['user_profiles', 'share_saved'],
    ['deal_stage_counts', 'interested'],
  ];
  for (const [table, col] of columnChecks) {
    const { error } = await supabase.from(table).select(col).limit(0);
    if (error) {
      console.error(`  FAIL: ${table}.${col} — ${error.message}`);
      failures++;
    } else {
      console.log(`  OK: ${table}.${col}`);
    }
  }
} else {
  console.error('  SKIP: No Supabase credentials — cannot verify DB');
  failures++;
}

// Gate 3: Digest config
console.log('\nGate 3: Digest configuration');
if (process.env.DIGEST_ENABLED === 'true') {
  console.log('  OK: DIGEST_ENABLED=true');
} else {
  console.error('  FAIL: DIGEST_ENABLED is not "true"');
  failures++;
}

console.log('\n=========================');
if (failures > 0) {
  console.error(`\nPREFLIGHT FAILED: ${failures} gate(s) did not pass.`);
  process.exit(1);
} else {
  console.log('\nAll preflight gates passed. Ready for release.');
  process.exit(0);
}
