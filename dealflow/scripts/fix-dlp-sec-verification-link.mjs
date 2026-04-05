#!/usr/bin/env node
/**
 * fix-dlp-sec-verification-link.mjs
 *
 * The deal_sec_verification record for DLP Lending Fund has sec_filing_id
 * pointing to the 2017 Form D filing. This causes /api/sec-verification to
 * call applySecFilingToDeal with the 2017 filing on every page load, which
 * overwrites total_investors (1503 → 73) and total_amount_sold ($628M → $13M).
 *
 * This script:
 *   1. Finds the 2026 filing (is_latest_amendment = true) for DLP's CIK
 *   2. Updates deal_sec_verification.sec_filing_id to the 2026 filing
 *   3. Re-applies the 2026 filing data to the opportunities row
 *
 * Usage:
 *   node scripts/fix-dlp-sec-verification-link.mjs --dry-run   (default)
 *   node scripts/fix-dlp-sec-verification-link.mjs --apply
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

config({ path: '.env' });

const DLP_DEAL_ID = '54bbffff-c0ee-48d2-a11c-224a49300a61';
const DLP_CIK = '1622059'; // confirmed from opportunities.sec_cik

const supabaseUrl = process.env.SUPABASE_URL || process.env.PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
	console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
	process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);
const dryRun = !process.argv.includes('--apply');

console.log(dryRun ? '=== DRY RUN ===' : '=== APPLYING CHANGES ===');
console.log(`Deal ID: ${DLP_DEAL_ID}`);
console.log(`CIK: ${DLP_CIK}`);
console.log('');

// Step 1: Find the latest filing for DLP
const { data: latestFiling, error: filingErr } = await supabase
	.from('sec_filings')
	.select('id, accession_number, filing_date, filing_type, is_latest_amendment, total_amount_sold, total_investors')
	.eq('cik', DLP_CIK)
	.eq('is_latest_amendment', true)
	.maybeSingle();

if (filingErr) { console.error('Error fetching latest filing:', filingErr.message); process.exit(1); }
if (!latestFiling) { console.error('No latest filing found for CIK', DLP_CIK); process.exit(1); }

console.log('Latest filing (is_latest_amendment=true):');
console.log(`  id: ${latestFiling.id}`);
console.log(`  accession: ${latestFiling.accession_number}`);
console.log(`  filing_date: ${latestFiling.filing_date}`);
console.log(`  total_investors: ${latestFiling.total_investors}`);
console.log(`  total_amount_sold: ${latestFiling.total_amount_sold}`);
console.log('');

// Step 2: Check the current deal_sec_verification record
const { data: verRecord, error: verErr } = await supabase
	.from('deal_sec_verification')
	.select('id, sec_filing_id, status')
	.eq('opportunity_id', DLP_DEAL_ID)
	.maybeSingle();

if (verErr) { console.error('Error fetching verification record:', verErr.message); process.exit(1); }

console.log('Current deal_sec_verification:');
if (!verRecord) {
	console.log('  (no record found)');
} else {
	console.log(`  id: ${verRecord.id}`);
	console.log(`  sec_filing_id: ${verRecord.sec_filing_id}`);
	console.log(`  status: ${verRecord.status}`);
	const needsUpdate = verRecord.sec_filing_id !== latestFiling.id;
	console.log(`  needs update: ${needsUpdate}`);
	if (!needsUpdate) {
		console.log('\n✅ deal_sec_verification already points to the latest filing. No update needed.');
	}
}
console.log('');

// Step 3: Check current opportunities values
const { data: deal, error: dealErr } = await supabase
	.from('opportunities')
	.select('id, total_investors, total_amount_sold, sec_latest_filing_date')
	.eq('id', DLP_DEAL_ID)
	.single();

if (dealErr) { console.error('Error fetching deal:', dealErr.message); process.exit(1); }

console.log('Current opportunities values:');
console.log(`  total_investors: ${deal.total_investors}`);
console.log(`  total_amount_sold: ${deal.total_amount_sold}`);
console.log(`  sec_latest_filing_date: ${deal.sec_latest_filing_date}`);
console.log('');

if (dryRun) {
	console.log('Would apply:');
	if (verRecord && verRecord.sec_filing_id !== latestFiling.id) {
		console.log(`  deal_sec_verification.sec_filing_id → ${latestFiling.id}`);
	}
	console.log(`  opportunities.total_investors → ${latestFiling.total_investors}`);
	console.log(`  opportunities.total_amount_sold → ${latestFiling.total_amount_sold}`);
	console.log(`  opportunities.sec_latest_filing_date → ${latestFiling.filing_date}`);
	console.log('\nRe-run with --apply to execute.');
	process.exit(0);
}

// Apply changes
let changed = false;

// Fix deal_sec_verification link
if (verRecord && verRecord.sec_filing_id !== latestFiling.id) {
	const { error: updateVerErr } = await supabase
		.from('deal_sec_verification')
		.update({ sec_filing_id: latestFiling.id })
		.eq('id', verRecord.id);
	if (updateVerErr) { console.error('Error updating deal_sec_verification:', updateVerErr.message); process.exit(1); }
	console.log(`✅ Updated deal_sec_verification.sec_filing_id → ${latestFiling.id}`);
	changed = true;
} else if (!verRecord) {
	console.log('⚠️  No deal_sec_verification record — skipping that update');
} else {
	console.log('ℹ️  deal_sec_verification already correct — no change needed');
}

// Fix opportunities values
const { error: updateDealErr } = await supabase
	.from('opportunities')
	.update({
		total_investors: latestFiling.total_investors,
		total_amount_sold: latestFiling.total_amount_sold,
		sec_latest_filing_date: latestFiling.filing_date,
		sec_data_refreshed_at: new Date().toISOString()
	})
	.eq('id', DLP_DEAL_ID);

if (updateDealErr) { console.error('Error updating opportunities:', updateDealErr.message); process.exit(1); }
console.log(`✅ Updated opportunities: total_investors=${latestFiling.total_investors}, total_amount_sold=${latestFiling.total_amount_sold}, sec_latest_filing_date=${latestFiling.filing_date}`);
changed = true;

// Verify
const { data: after } = await supabase
	.from('opportunities')
	.select('total_investors, total_amount_sold, sec_latest_filing_date')
	.eq('id', DLP_DEAL_ID)
	.single();

console.log('\nVerification after update:');
console.log(`  total_investors: ${after.total_investors}`);
console.log(`  total_amount_sold: ${after.total_amount_sold}`);
console.log(`  sec_latest_filing_date: ${after.sec_latest_filing_date}`);

if (changed) {
	console.log('\n✅ Done. The is_latest_amendment guard in buildDealUpdatesFromSecFiling');
	console.log('   will prevent the 2017 filing from overwriting these values again,');
	console.log('   even if /api/sec-verification continues to load the old filing link.');
}
