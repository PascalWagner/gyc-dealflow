#!/usr/bin/env node
// Add 3 new LP investment opportunities sourced from Gmail
// Run: node scripts/add-lp-deals.mjs [--dry-run] [--skip-attachments]
//
// Prerequisites:
//   - SUPABASE_SERVICE_ROLE_KEY env var (or .env.supabase file)
//   - Gmail attachment PDFs placed in scripts/deal-attachments/ (see instructions below)
//
// This script:
//   1. Checks for duplicate deals in the database
//   2. Creates management companies (operators) if needed
//   3. Creates 3 new deal records
//   4. Uploads deck attachments to Supabase Storage
//   5. Links attachments to the deal records
//
// Sourced from Gmail inbox on 2026-03-27. Each deal was verified as:
//   - A real LP investment opportunity with a pitch deck / offering doc
//   - Not already present in the dealflow database (by name, sponsor, and alias search)
//   - Current and actionable

import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// --- Config ---
const SUPABASE_URL = 'https://nntzqyufmtypfjpusflm.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
  || (() => { try { return readFileSync('.env.supabase', 'utf8').match(/SERVICE_ROLE_KEY=(.+)/)?.[1]?.trim(); } catch { return null; } })();

if (!SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_SERVICE_ROLE_KEY. Set env var or create .env.supabase file.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false }
});

const DRY_RUN = process.argv.includes('--dry-run');
const SKIP_ATTACHMENTS = process.argv.includes('--skip-attachments');

// ============================================================
// DEAL DATA — Extracted from Gmail on 2026-03-27
// ============================================================

const DEALS = [
  {
    // Gmail: From R.T. Trevino <rt@pecoscountryenergy.com>, Mar 4 2026
    // Subject: "Pecos Oil Info"
    // Attachments: "Cattleman I Pitch Deck v3 March 2026.pdf", "Jacksboro Dozen Prospect - Overview November 2024.pdf", "DETAILED_Tax Advantages.pdf"
    investment_name: 'The Cattlemen Prospect',
    operator: {
      operator_name: 'Pecos Country Energy',
      website: 'https://www.pcoperating.com',
      ceo: 'Rey "RT" Trevino III',
      headquarters: 'Fort Worth, TX',
      type: 'Operator',
      asset_classes: ['Oil & Gas']
    },
    deal: {
      asset_class: 'Oil & Gas',
      deal_type: 'Syndication',
      status: 'Active',
      added_date: '2026-03-27',
      investing_geography: 'Texas',
      investment_strategy: 'Oil & Gas Exploration',
      instrument: 'Working Interest',
      available_to: 'Accredited Investors',
      offering_type: '506(c)'
    },
    attachments: [
      { filename: 'Cattleman I Pitch Deck v3 March 2026.pdf', docType: 'deck' },
      { filename: 'Jacksboro Dozen Prospect - Overview November 2024.pdf', docType: 'deck' },
      { filename: 'DETAILED_Tax Advantages.pdf', docType: 'deck' }
    ],
    gmail: {
      messageId: '19cbad3abed36a83',
      from: 'R.T. Trevino <rt@pecoscountryenergy.com>',
      date: '2026-03-04',
      subject: 'Pecos Oil Info'
    },
    // Duplicate check queries
    dupChecks: ['Cattleman', 'Pecos Country', 'Pecos Oil', 'Cattlemen Prospect'],
    selectionReason: 'Oil & gas syndication with complete pitch deck, tax strategy docs, and prior closed project reference. Provides asset class diversification. Current (March 2026 deck). Clean sponsor branding from established Texas operator.'
  },
  {
    // Gmail: From Lanyon Heinemann <lanyon@jmkcontractor.com>, Mar 4 2026
    // Subject: "520 W Ave development deck"
    // Attachments: Investment deck (PPTX), term sheet, appraisals, cost estimates
    investment_name: '528 SW 5th Ave LLC',
    operator: {
      operator_name: 'JMK Contractor',
      website: null,
      ceo: 'Lanyon Heinemann',
      headquarters: null,
      type: 'Developer',
      asset_classes: ['Real Estate Development']
    },
    deal: {
      asset_class: 'Real Estate Development',
      deal_type: 'Syndication',
      status: 'Active',
      added_date: '2026-03-27',
      investment_strategy: 'Ground-Up Development',
      instrument: 'LP Equity',
      available_to: 'Accredited Investors'
    },
    attachments: [
      { filename: '520_SW_5th_Ave_Investment_Deck.pptx', docType: 'deck' },
      { filename: 'Term Sheet - 528 SW 5th Ave LLC.pdf', docType: 'deck' },
      { filename: 'Proposal 528 SW 5 Ave.pdf', docType: 'deck' },
      { filename: '528 SW 5th Avenue LLC Unit A Appraisal.pdf', docType: 'deck' }
    ],
    gmail: {
      messageId: '19cbbf679bbf53f5',
      from: 'Lanyon Heinemann <lanyon@jmkcontractor.com>',
      date: '2026-03-04',
      subject: '520 W Ave development deck'
    },
    dupChecks: ['528 SW', '520 SW', 'JMK', '5th Ave LLC'],
    selectionReason: 'Real estate development deal with comprehensive materials: investment deck, term sheet, appraisals, and cost breakdowns. Strong supporting documentation for LP due diligence. Active development opportunity.'
  },
  {
    // Gmail: From Jim Pfeifer <jimpfeifer@biggerpockets.com>, Mar 24 2026
    // Subject: "Morgan Bay"
    // Attachment: "Apartment Fund One, LLC - Morgan Bay Apartments — Vyzer Analysis.pdf"
    // Context: Jim Pfeifer is founder of Left Field Investors / PassivePockets at BiggerPockets
    investment_name: 'Morgan Bay Apartments',
    operator: {
      operator_name: 'Apartment Fund One LLC',
      website: null,
      ceo: null,
      headquarters: null,
      type: 'Sponsor',
      asset_classes: ['Multi Family']
    },
    deal: {
      asset_class: 'Multi Family',
      deal_type: 'Syndication',
      status: 'Active',
      added_date: '2026-03-27',
      investment_strategy: 'Value-Add',
      instrument: 'LP Equity',
      available_to: 'Accredited Investors'
    },
    attachments: [
      { filename: 'Apartment Fund One, LLC - Morgan Bay Apartments — Vyzer Analysis.pdf', docType: 'deck' }
    ],
    gmail: {
      messageId: '19d21505a28c2b42',
      from: 'Jim Pfeifer <jimpfeifer@biggerpockets.com>',
      date: '2026-03-24',
      subject: 'Morgan Bay'
    },
    dupChecks: ['Morgan Bay', 'Apartment Fund One'],
    selectionReason: 'Multifamily apartment syndication shared by Jim Pfeifer (PassivePockets / BiggerPockets). Vyzer deal analysis report attached. Active deal under evaluation by trusted industry contacts. Adds multifamily exposure to deal flow.'
  }
];

// ============================================================
// MAIN
// ============================================================

async function main() {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`  Add LP Deals — ${DRY_RUN ? 'DRY RUN' : 'LIVE'}`);
  console.log(`${'='.repeat(60)}\n`);

  const results = [];

  for (const dealData of DEALS) {
    console.log(`\n--- ${dealData.investment_name} ---`);

    // Step 1: Duplicate check
    const isDuplicate = await checkDuplicate(dealData);
    if (isDuplicate) {
      console.log(`  ⚠️  SKIPPED: Already exists in database`);
      results.push({ name: dealData.investment_name, status: 'skipped', reason: 'duplicate' });
      continue;
    }
    console.log(`  ✓ No duplicate found`);

    if (DRY_RUN) {
      console.log(`  [DRY RUN] Would create deal + operator`);
      results.push({ name: dealData.investment_name, status: 'dry-run' });
      continue;
    }

    // Step 2: Find or create management company
    const mcId = await findOrCreateOperator(dealData.operator);
    console.log(`  ✓ Operator: ${dealData.operator.operator_name} (${mcId})`);

    // Step 3: Create the deal
    const deal = await createDeal(dealData, mcId);
    console.log(`  ✓ Deal created: ${deal.id}`);

    // Step 4: Link operator as primary sponsor
    await linkSponsor(deal.id, mcId);
    console.log(`  ✓ Sponsor linked`);

    // Step 5: Upload attachments
    if (!SKIP_ATTACHMENTS) {
      for (const att of dealData.attachments) {
        const uploaded = await uploadAttachment(deal.id, dealData.investment_name, att);
        if (uploaded) {
          console.log(`  ✓ Uploaded: ${att.filename}`);
        } else {
          console.log(`  ⚠️  Attachment not found locally: ${att.filename}`);
          console.log(`     Place in: scripts/deal-attachments/${att.filename}`);
        }
      }
    }

    // Step 6: Log submission
    await logSubmission(deal.id, dealData);
    console.log(`  ✓ Submission logged`);

    results.push({
      name: dealData.investment_name,
      status: 'created',
      dealId: deal.id,
      mcId,
      url: `https://dealflow.growyourcashflow.io/deal/${deal.id}`
    });
  }

  // Summary
  console.log(`\n${'='.repeat(60)}`);
  console.log('  SUMMARY');
  console.log(`${'='.repeat(60)}`);
  for (const r of results) {
    if (r.status === 'created') {
      console.log(`  ✅ ${r.name}`);
      console.log(`     ID:  ${r.dealId}`);
      console.log(`     URL: ${r.url}`);
    } else if (r.status === 'skipped') {
      console.log(`  ⏭️  ${r.name} — ${r.reason}`);
    } else {
      console.log(`  🔍 ${r.name} — ${r.status}`);
    }
  }
  console.log('');
}

// ============================================================
// HELPERS
// ============================================================

async function checkDuplicate(dealData) {
  for (const term of dealData.dupChecks) {
    const { data } = await supabase
      .from('opportunities')
      .select('id, investment_name')
      .ilike('investment_name', `%${term}%`)
      .limit(1);

    if (data && data.length > 0) {
      console.log(`  ⚠️  Possible match for "${term}": ${data[0].investment_name} (${data[0].id})`);
      return true;
    }
  }

  // Also check by operator name
  const opName = dealData.operator.operator_name;
  const { data: mcData } = await supabase
    .from('management_companies')
    .select('id, operator_name')
    .ilike('operator_name', `%${opName}%`)
    .limit(1);

  if (mcData && mcData.length > 0) {
    // Operator exists — check if they have any deals
    const { data: dealsByOp } = await supabase
      .from('opportunities')
      .select('id, investment_name')
      .eq('management_company_id', mcData[0].id)
      .limit(5);

    if (dealsByOp && dealsByOp.length > 0) {
      console.log(`  ⚠️  Operator "${opName}" already has deals: ${dealsByOp.map(d => d.investment_name).join(', ')}`);
      // Operator exists but this specific deal may not — don't flag as duplicate
      // Only flag if one of the existing deals looks like the same deal
      for (const existing of dealsByOp) {
        const existingLower = existing.investment_name.toLowerCase();
        const newLower = dealData.investment_name.toLowerCase();
        if (existingLower.includes(newLower) || newLower.includes(existingLower)) {
          return true;
        }
      }
    }
  }

  return false;
}

async function findOrCreateOperator(operator) {
  // Try to find existing
  const { data: existing } = await supabase
    .from('management_companies')
    .select('id')
    .ilike('operator_name', operator.operator_name.trim())
    .limit(1)
    .single();

  if (existing) return existing.id;

  // Create new
  const row = {
    operator_name: operator.operator_name.trim(),
    ...(operator.website && { website: operator.website }),
    ...(operator.ceo && { ceo: operator.ceo }),
    ...(operator.headquarters && { headquarters: operator.headquarters }),
    ...(operator.type && { type: operator.type }),
    ...(operator.asset_classes && { asset_classes: operator.asset_classes })
  };

  const { data, error } = await supabase
    .from('management_companies')
    .insert(row)
    .select('id')
    .single();

  if (error) throw new Error(`Failed to create operator ${operator.operator_name}: ${error.message}`);
  return data.id;
}

async function createDeal(dealData, mcId) {
  const row = {
    investment_name: dealData.investment_name,
    management_company_id: mcId,
    ...dealData.deal
  };

  const { data, error } = await supabase
    .from('opportunities')
    .insert(row)
    .select('id, investment_name')
    .single();

  if (error) throw new Error(`Failed to create deal ${dealData.investment_name}: ${error.message}`);
  return data;
}

async function linkSponsor(dealId, mcId) {
  await supabase.from('deal_sponsors').insert({
    deal_id: dealId,
    company_id: mcId,
    role: 'sponsor',
    is_primary: true,
    display_order: 0
  });
}

async function uploadAttachment(dealId, dealName, att) {
  const localPath = join(__dirname, 'deal-attachments', att.filename);
  if (!existsSync(localPath)) return false;

  const fileBuffer = readFileSync(localPath);
  const cleanDealName = dealName.replace(/[^a-zA-Z0-9\s\-]/g, '').trim();
  const storagePath = `deals/${dealId}/${cleanDealName} - ${att.filename}`;

  const contentType = att.filename.endsWith('.pdf') ? 'application/pdf'
    : att.filename.endsWith('.pptx') ? 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
    : 'application/octet-stream';

  const { error: uploadError } = await supabase.storage
    .from('deal-decks')
    .upload(storagePath, fileBuffer, { contentType, upsert: true });

  if (uploadError) {
    console.error(`  Upload error for ${att.filename}:`, uploadError.message);
    return false;
  }

  // Get signed URL (1 year)
  const { data: urlData } = await supabase.storage
    .from('deal-decks')
    .createSignedUrl(storagePath, 60 * 60 * 24 * 365);

  const signedUrl = urlData?.signedUrl || '';

  if (signedUrl && att.docType === 'deck') {
    // Update the deal's deck_url with the first deck attachment
    const { data: existing } = await supabase
      .from('opportunities')
      .select('deck_url')
      .eq('id', dealId)
      .single();

    if (!existing?.deck_url) {
      await supabase
        .from('opportunities')
        .update({ deck_url: signedUrl })
        .eq('id', dealId);
    }
  }

  return true;
}

async function logSubmission(dealId, dealData) {
  await supabase.from('deck_submissions').insert({
    deal_id: dealId,
    deal_name: dealData.investment_name,
    notes: `Auto-added from Gmail (${dealData.gmail.from}, ${dealData.gmail.date}). ${dealData.selectionReason}`,
    submitted_by_email: 'pascal@growyourcashflow.io',
    submitted_by_name: 'Pascal Wagner (via deal sourcing script)'
  });
}

// ============================================================
// RUN
// ============================================================

main().catch(err => {
  console.error('\nFATAL:', err.message);
  process.exit(1);
});
