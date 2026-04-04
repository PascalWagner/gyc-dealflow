#!/usr/bin/env node
/**
 * One-time script: Fetch ALL SEC Form D filings for DLP Capital and update
 * the DLP Lending Fund deal record with the latest filing data.
 *
 * Uses refreshSecFilingsForDeal from _sec-edgar.js — the canonical path that
 * fetchAllFilingsForCik + markLatestFilingForCik and pushes data to the deal.
 *
 * Usage:
 *   node scripts/dlp-sec-backfill.mjs
 *   node scripts/dlp-sec-backfill.mjs --dry-run
 */

import { createClient } from '@supabase/supabase-js';
import { refreshSecFilingsForDeal } from '../api/_sec-edgar.js';

const DLP_DEAL_ID = '54bbffff-c0ee-48d2-a11c-224a49300a61';
const DRY_RUN = process.argv.includes('--dry-run');

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function main() {
  console.log(`\n=== DLP SEC All-Filings Backfill ${DRY_RUN ? '(DRY RUN)' : ''} ===\n`);

  // Show current state before doing anything
  const { data: deal, error: dealErr } = await supabase
    .from('opportunities')
    .select('id, investment_name, sec_cik, total_amount_sold, total_investors, sec_data_refreshed_at')
    .eq('id', DLP_DEAL_ID)
    .single();

  if (dealErr || !deal) {
    console.error('Failed to load DLP deal:', dealErr?.message);
    process.exit(1);
  }

  console.log(`Deal: ${deal.investment_name}`);
  console.log(`CIK: ${deal.sec_cik || '(none)'}`);
  console.log(`Before → total_amount_sold: ${deal.total_amount_sold?.toLocaleString() ?? '(none)'}`);
  console.log(`Before → total_investors:   ${deal.total_investors ?? '(none)'}`);
  console.log(`Before → sec_data_refreshed_at: ${deal.sec_data_refreshed_at ?? '(never)'}`);

  if (DRY_RUN) {
    console.log('\nDRY RUN — no changes written.');
    process.exit(0);
  }

  console.log('\nRunning refresh...');

  const { upsertCount, latestFiling } = await refreshSecFilingsForDeal(DLP_DEAL_ID, supabase);

  console.log(`\nStored/updated ${upsertCount} filings.`);

  if (latestFiling) {
    console.log(`Latest filing: ${latestFiling.filing_date} (${latestFiling.accession_number})`);
    console.log(`  total_amount_sold: ${latestFiling.total_amount_sold?.toLocaleString() ?? '(not in filing)'}`);
    console.log(`  total_investors:   ${latestFiling.total_investors ?? '(not in filing)'}`);
  } else {
    console.log('No latest filing found after refresh.');
  }

  // Read back deal to confirm updates
  const { data: after } = await supabase
    .from('opportunities')
    .select('total_amount_sold, total_investors, sec_data_refreshed_at')
    .eq('id', DLP_DEAL_ID)
    .single();

  console.log(`\nAfter → total_amount_sold: ${after?.total_amount_sold?.toLocaleString() ?? '(none)'}`);
  console.log(`After → total_investors:   ${after?.total_investors ?? '(none)'}`);
  console.log(`After → sec_data_refreshed_at: ${after?.sec_data_refreshed_at ?? '(none)'}`);

  console.log('\nDone.');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
