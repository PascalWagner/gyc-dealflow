#!/usr/bin/env node
/**
 * refresh-sec-filings.mjs
 *
 * Weekly batch refresh for all deals with a sec_cik. For each deal, fetches
 * ALL current Form D / D/A filings from EDGAR, upserts them, repairs the
 * is_latest_amendment flag via markLatestFilingForCik, then pushes the
 * latest data to the opportunities row.
 *
 * Safe to run repeatedly — all operations are idempotent.
 * Skips deals refreshed within the last STALE_DAYS days (configurable).
 *
 * Usage:
 *   node scripts/refresh-sec-filings.mjs
 *   node scripts/refresh-sec-filings.mjs --dry-run
 *   node scripts/refresh-sec-filings.mjs --deal-id <uuid>   # single deal
 *   node scripts/refresh-sec-filings.mjs --force            # ignore stale window
 *
 * Env:
 *   SUPABASE_URL              (or NEXT_PUBLIC_SUPABASE_URL)
 *   SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient } from '@supabase/supabase-js';
import { refreshSecFilingsForDeal } from '../api/_sec-edgar.js';

// ---- Config ----------------------------------------------------------------

const DRY_RUN = process.argv.includes('--dry-run');
const FORCE   = process.argv.includes('--force');
const DEAL_ID_ARG = (() => {
  const i = process.argv.indexOf('--deal-id');
  return i >= 0 ? process.argv[i + 1] : null;
})();

/** Skip deals refreshed within this many days (unless --force) */
const STALE_DAYS = 6;

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars');
  process.exit(1);
}

// ---- Main ------------------------------------------------------------------

async function main() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  const now = new Date();

  console.log(`\n=== SEC Filings Refresh ${DRY_RUN ? '(DRY RUN) ' : ''}${FORCE ? '(FORCE) ' : ''}===`);
  console.log(`Started: ${now.toISOString()}\n`);

  // 1. Load deals that have a CIK
  let query = supabase
    .from('opportunities')
    .select('id, investment_name, sec_cik, sec_data_refreshed_at')
    .not('sec_cik', 'is', null);

  if (DEAL_ID_ARG) {
    query = query.eq('id', DEAL_ID_ARG);
  }

  const { data: deals, error: dealsError } = await query;

  if (dealsError) {
    console.error('Failed to load deals:', dealsError.message);
    process.exit(1);
  }

  if (!deals || deals.length === 0) {
    console.log('No deals with sec_cik found.');
    process.exit(0);
  }

  console.log(`Found ${deals.length} deal(s) with CIK.`);

  const staleThreshold = new Date(now.getTime() - STALE_DAYS * 24 * 60 * 60 * 1000);

  let refreshed = 0;
  let skipped = 0;
  let failed = 0;
  const results = [];

  for (const deal of deals) {
    const refreshedAt = deal.sec_data_refreshed_at ? new Date(deal.sec_data_refreshed_at) : null;
    const isStale = !refreshedAt || refreshedAt < staleThreshold;

    if (!FORCE && !isStale) {
      console.log(`  SKIP  ${deal.investment_name} — refreshed ${refreshedAt?.toISOString().split('T')[0]}`);
      skipped++;
      results.push({ id: deal.id, name: deal.investment_name, status: 'skipped', refreshedAt: refreshedAt?.toISOString() });
      continue;
    }

    if (DRY_RUN) {
      console.log(`  DRY   ${deal.investment_name} (${deal.sec_cik}) — would refresh`);
      results.push({ id: deal.id, name: deal.investment_name, status: 'dry-run' });
      continue;
    }

    console.log(`  SYNC  ${deal.investment_name} (CIK ${deal.sec_cik})...`);

    try {
      const { upsertCount, latestFiling } = await refreshSecFilingsForDeal(deal.id, supabase);
      const summary = latestFiling
        ? `${upsertCount} filings upserted · latest ${latestFiling.filing_date} · $${latestFiling.total_amount_sold?.toLocaleString() ?? '?'} / ${latestFiling.total_investors ?? '?'} investors`
        : `${upsertCount} filings upserted · no latest filing found`;

      console.log(`        ${summary}`);
      refreshed++;
      results.push({ id: deal.id, name: deal.investment_name, status: 'ok', upsertCount, filing_date: latestFiling?.filing_date });
    } catch (err) {
      console.error(`  ERR   ${deal.investment_name}: ${err.message}`);
      failed++;
      results.push({ id: deal.id, name: deal.investment_name, status: 'error', error: err.message });
    }

    // EDGAR rate limit: 10 req/sec. Each deal may fetch many filings internally,
    // so we add a short pause between deals to avoid bursting.
    await new Promise(r => setTimeout(r, 500));
  }

  // ---- Summary -------------------------------------------------------------

  console.log('\n--- Summary ---');
  console.log(`  Refreshed : ${refreshed}`);
  console.log(`  Skipped   : ${skipped}`);
  console.log(`  Failed    : ${failed}`);
  console.log(`  Elapsed   : ${((Date.now() - now.getTime()) / 1000).toFixed(1)}s`);

  if (failed > 0) {
    console.log('\nFailed deals:');
    results.filter(r => r.status === 'error').forEach(r => console.log(`  ${r.name}: ${r.error}`));
    process.exit(1);
  }

  console.log('\nDone.');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
