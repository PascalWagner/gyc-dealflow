#!/usr/bin/env node
/**
 * Airtable → Supabase One-Time Data Migration
 *
 * Run this AFTER:
 *   1. Creating the Supabase project (supabase.com → New Project)
 *   2. Running 001_initial_schema.sql in the SQL Editor
 *   3. Setting environment variables below
 *
 * Usage:
 *   AIRTABLE_PAT=xxx SUPABASE_URL=xxx SUPABASE_SERVICE_ROLE_KEY=xxx node migrate-from-airtable.js
 *
 * This script:
 *   - Fetches all data from Airtable
 *   - Transforms field names to Supabase column names
 *   - Inserts into Supabase with proper foreign key mappings
 *   - Creates auth users in Supabase for existing GHL contacts
 *   - Preserves Airtable IDs in airtable_id columns for reference
 */

import { createClient } from '@supabase/supabase-js';

const AIRTABLE_PAT = process.env.AIRTABLE_PAT;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const AIRTABLE_BASE_ID = 'appKfcBhhpFJZ28is';

if (!AIRTABLE_PAT || !SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Missing required env vars: AIRTABLE_PAT, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false }
});

// ============================================================================
// Airtable helpers
// ============================================================================

async function fetchAllRecords(tableIdOrName) {
  const records = [];
  let offset = null;

  do {
    const url = new URL(`https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${tableIdOrName}`);
    url.searchParams.set('pageSize', '100');
    if (offset) url.searchParams.set('offset', offset);

    const resp = await fetch(url.toString(), {
      headers: { 'Authorization': `Bearer ${AIRTABLE_PAT}` }
    });

    if (!resp.ok) {
      const err = await resp.text();
      throw new Error(`Airtable fetch error for ${tableIdOrName}: ${resp.status} ${err}`);
    }

    const data = await resp.json();
    records.push(...(data.records || []));
    offset = data.offset || null;
  } while (offset);

  return records;
}

// ============================================================================
// Migration steps
// ============================================================================

const airtableToSupabaseId = {}; // Maps Airtable record ID → Supabase UUID

async function migrateManagementCompanies() {
  console.log('\n--- Migrating Management Companies ---');
  const records = await fetchAllRecords('tblRczR8Eok31ZhJj');
  console.log(`  Fetched ${records.length} records from Airtable`);

  const rows = records.map(rec => {
    const f = rec.fields || {};
    return {
      airtable_id: rec.id,
      operator_name: f['Operator Name'] || '',
      ceo: f['CEO'] || '',
      website: f['Website'] || '',
      linkedin_ceo: f['Linkedin of CEO'] || '',
      invest_clearly_profile: f['InvestClearly Profile'] || '',
      founding_year: f['Founding Year'] || null,
      type: Array.isArray(f['Type']) ? f['Type'][0] : (f['Type'] || ''),
      asset_classes: [...new Set(f['Asset Classes'] || [])],
      total_investors: f['Total Investors @ Firm'] || null
    };
  });

  const { data, error } = await supabase
    .from('management_companies')
    .upsert(rows, { onConflict: 'airtable_id' })
    .select('id, airtable_id');

  if (error) throw error;

  // Build ID mapping
  for (const row of data) {
    airtableToSupabaseId[row.airtable_id] = row.id;
  }

  console.log(`  Inserted/updated ${data.length} management companies`);
}

async function migrateOpportunities() {
  console.log('\n--- Migrating Opportunities ---');
  const records = await fetchAllRecords('tblXFNpOvL0Ub5tVt');
  console.log(`  Fetched ${records.length} records from Airtable`);

  // First pass: insert all deals without parent references
  const rows = records.map(rec => {
    const f = rec.fields || {};
    const mcIds = f['Management Company'];
    const mcAirtableId = Array.isArray(mcIds) && mcIds.length > 0 ? mcIds[0] : null;

    return {
      airtable_id: rec.id,
      deal_number: f['Deal #'] || null,
      investment_name: f['Investment Name / Address'] || '',
      asset_class: Array.isArray(f['Asset Class']) ? f['Asset Class'][0] : (f['Asset Class'] || ''),
      deal_type: f['Deal Type'] || '',
      status: f['Status'] || '',
      added_date: f['Added Date'] || null,
      location: f['Location'] || '',
      property_address: f['Property Address'] || '',
      target_irr: f['Target IRR'] || null,
      equity_multiple: f['Equity Multiple'] || null,
      preferred_return: f['Preferred Return'] || f['Class A - Pref'] || null,
      cash_on_cash: f['Cash on Cash Return'] || null,
      investment_minimum: f['Investment Minimum'] || f['Class A - Min Investment'] || 0,
      lp_gp_split: f['Class A - LP/GP Split'] || '',
      hold_period_years: f['Min Hold Period (Yrs)'] || null,
      offering_type: f['Offering Type'] || '',
      offering_size: f['Offering Size'] || null,
      investing_geography: f['Investing Geography'] || '',
      investment_strategy: f['Investment Strategy'] || '',
      instrument: f['Instrument'] || '',
      distributions: Array.isArray(f['Distributions']) ? f['Distributions'][0] : (f['Distributions'] || ''),
      financials: f['Financials'] || '',
      available_to: Array.isArray(f['Available To']) ? f['Available To'][0] : (f['Available To'] || ''),
      investment_objective: Array.isArray(f['Investment Objective']) ? f['Investment Objective'][0] : (f['Investment Objective'] || ''),
      sponsor_in_deal_pct: f['% Sponsor In The Deal'] || null,
      fees: f['Fees'] || [],
      first_yr_depreciation: f['1st Yr Depreciation'] || '',
      strategy: f['Strategy'] || '',
      vertical_integration: f['Vertically Integrated'] || f['Vertical Integration'] || false,
      debt_position: f['Debt Position'] || '',
      fund_aum: f['Fund AUM'] || null,
      loan_count: f['Loan Count'] || null,
      avg_loan_ltv: f['Avg Loan LTV'] || null,
      deck_url: Array.isArray(f['Deck']) && f['Deck'].length > 0 ? f['Deck'][0].url : '',
      ppm_url: Array.isArray(f['PPM']) && f['PPM'].length > 0 ? f['PPM'][0].url : '',
      sub_agreement_url: Array.isArray(f['Subscription Agreement']) && f['Subscription Agreement'].length > 0 ? f['Subscription Agreement'][0].url : '',
      share_class_label: f['Share Class Label'] || null,
      management_company_id: mcAirtableId ? airtableToSupabaseId[mcAirtableId] : null
      // parent_deal_id set in second pass
    };
  });

  const { data, error } = await supabase
    .from('opportunities')
    .upsert(rows, { onConflict: 'airtable_id' })
    .select('id, airtable_id');

  if (error) throw error;

  for (const row of data) {
    airtableToSupabaseId[row.airtable_id] = row.id;
  }

  console.log(`  Inserted/updated ${data.length} opportunities`);

  // Second pass: set parent_deal_id for share classes
  let parentUpdates = 0;
  for (const rec of records) {
    const f = rec.fields || {};
    const parentAirtableIds = f['Parent Deal'];
    if (Array.isArray(parentAirtableIds) && parentAirtableIds.length > 0) {
      const parentSupabaseId = airtableToSupabaseId[parentAirtableIds[0]];
      const childSupabaseId = airtableToSupabaseId[rec.id];
      if (parentSupabaseId && childSupabaseId) {
        const { error: updateErr } = await supabase
          .from('opportunities')
          .update({ parent_deal_id: parentSupabaseId })
          .eq('id', childSupabaseId);
        if (!updateErr) parentUpdates++;
      }
    }
  }
  console.log(`  Linked ${parentUpdates} share classes to parent deals`);
}

async function migrateUserData() {
  console.log('\n--- Migrating User Data (Stages, Portfolio, Goals, Tax Docs) ---');

  // We need user_profiles to exist first. For now, we'll create them on-the-fly
  // based on email addresses found in the user data tables.
  const emails = new Set();
  const emailToUserId = {};

  const tables = [
    { name: 'User Deal Stages', type: 'stages' },
    { name: 'User Portfolio', type: 'portfolio' },
    { name: 'User Goals', type: 'goals' },
    { name: 'User Tax Docs', type: 'taxdocs' }
  ];

  // First, collect all unique emails
  const allRecordsByType = {};
  for (const table of tables) {
    const records = await fetchAllRecords(table.name);
    allRecordsByType[table.type] = records;
    for (const rec of records) {
      const email = (rec.fields || {})['Email'];
      if (email) emails.add(email.toLowerCase());
    }
  }

  console.log(`  Found ${emails.size} unique user emails`);

  // Create Supabase auth users + profiles for each email
  for (const email of emails) {
    try {
      // Create auth user (generates a UUID we can use as profile ID)
      const { data: authUser, error: authErr } = await supabase.auth.admin.createUser({
        email,
        email_confirm: true,
        user_metadata: { migrated_from: 'airtable' }
      });

      if (authErr) {
        // User might already exist
        if (authErr.message?.includes('already')) {
          const { data: { users } } = await supabase.auth.admin.listUsers();
          const existing = users.find(u => u.email === email);
          if (existing) {
            emailToUserId[email] = existing.id;
          }
          continue;
        }
        console.warn(`  Warning: Could not create user ${email}: ${authErr.message}`);
        continue;
      }

      emailToUserId[email] = authUser.user.id;

      // Create profile
      await supabase.from('user_profiles').upsert({
        id: authUser.user.id,
        email,
        tier: 'free' // will be updated from GHL sync
      }, { onConflict: 'id' });

    } catch (e) {
      console.warn(`  Warning: Error creating user ${email}: ${e.message}`);
    }
  }

  console.log(`  Created/found ${Object.keys(emailToUserId).length} user profiles`);

  // Now migrate each table
  // Stages
  if (allRecordsByType.stages?.length) {
    const rows = allRecordsByType.stages
      .map(rec => {
        const f = rec.fields || {};
        const email = (f['Email'] || '').toLowerCase();
        const userId = emailToUserId[email];
        const dealAirtableId = f['Deal ID'];
        // Deal ID in stages might be the Airtable record ID
        const dealId = airtableToSupabaseId[dealAirtableId];
        if (!userId || !dealId) return null;
        return {
          user_id: userId,
          deal_id: dealId,
          stage: f['Stage'] || 'interested',
          notes: f['Notes'] || ''
        };
      })
      .filter(Boolean);

    if (rows.length) {
      const { error } = await supabase
        .from('user_deal_stages')
        .upsert(rows, { onConflict: 'user_id,deal_id' });
      if (error) console.warn('  Stages insert error:', error.message);
      else console.log(`  Migrated ${rows.length} deal stages`);
    }
  }

  // Portfolio
  if (allRecordsByType.portfolio?.length) {
    const rows = allRecordsByType.portfolio
      .map(rec => {
        const f = rec.fields || {};
        const email = (f['Email'] || '').toLowerCase();
        const userId = emailToUserId[email];
        if (!userId) return null;
        const dealId = f['Deal ID'] ? airtableToSupabaseId[f['Deal ID']] : null;
        return {
          user_id: userId,
          deal_id: dealId,
          investment_name: f['Investment Name'] || '',
          sponsor: f['Sponsor'] || '',
          asset_class: f['Asset Class'] || '',
          amount_invested: f['Amount Invested'] || null,
          date_invested: f['Date Invested'] || null,
          status: f['Status'] || '',
          target_irr: f['Target IRR'] || null,
          distributions_received: f['Distributions Received'] || 0,
          hold_period: f['Hold Period'] || null,
          investing_entity: f['Investing Entity'] || '',
          entity_invested_into: f['Entity Invested Into'] || '',
          notes: f['Notes'] || ''
        };
      })
      .filter(Boolean);

    if (rows.length) {
      const { error } = await supabase.from('user_portfolio').insert(rows);
      if (error) console.warn('  Portfolio insert error:', error.message);
      else console.log(`  Migrated ${rows.length} portfolio entries`);
    }
  }

  // Goals
  if (allRecordsByType.goals?.length) {
    const rows = allRecordsByType.goals
      .map(rec => {
        const f = rec.fields || {};
        const email = (f['Email'] || '').toLowerCase();
        const userId = emailToUserId[email];
        if (!userId) return null;
        return {
          user_id: userId,
          goal_type: f['Goal Type'] || '',
          current_income: f['Current Income'] || null,
          target_income: f['Target Income'] || null,
          capital_available: f['Capital Available'] || null,
          timeline: f['Timeline'] || '',
          tax_reduction: f['Tax Reduction'] || null
        };
      })
      .filter(Boolean);

    if (rows.length) {
      const { error } = await supabase
        .from('user_goals')
        .upsert(rows, { onConflict: 'user_id' });
      if (error) console.warn('  Goals insert error:', error.message);
      else console.log(`  Migrated ${rows.length} user goals`);
    }
  }

  // Tax Docs
  if (allRecordsByType.taxdocs?.length) {
    const rows = allRecordsByType.taxdocs
      .map(rec => {
        const f = rec.fields || {};
        const email = (f['Email'] || '').toLowerCase();
        const userId = emailToUserId[email];
        if (!userId) return null;
        return {
          user_id: userId,
          tax_year: f['Tax Year'] || '',
          investment_name: f['Investment Name'] || '',
          investing_entity: f['Investing Entity'] || '',
          entity_invested_into: f['Entity Invested Into'] || '',
          form_type: f['Form Type'] || '',
          upload_status: f['Upload Status'] || '',
          date_received: f['Date Received'] || null,
          file_url: f['File URL'] || '',
          portal_url: f['Portal URL'] || '',
          contact_name: f['Contact'] || '',
          contact_email: f['Contact Email'] || '',
          contact_phone: f['Contact Phone'] || '',
          notes: f['Notes'] || ''
        };
      })
      .filter(Boolean);

    if (rows.length) {
      const { error } = await supabase.from('user_tax_docs').insert(rows);
      if (error) console.warn('  Tax docs insert error:', error.message);
      else console.log(`  Migrated ${rows.length} tax documents`);
    }
  }
}

async function migrateDDChecklist() {
  console.log('\n--- Migrating DD Checklist ---');
  const records = await fetchAllRecords('DD Checklist');
  console.log(`  Fetched ${records.length} records from Airtable`);

  const rows = records
    .map(rec => {
      const f = rec.fields || {};
      const dealAirtableId = f['Deal ID'];
      const dealId = airtableToSupabaseId[dealAirtableId];
      if (!dealId) return null;
      return {
        deal_id: dealId,
        item_index: f['Item Index'] || 0,
        item_text: f['Item Text'] || '',
        checked_by_email: f['Checked By Email'] || '',
        checked_by_name: f['Checked By Name'] || '',
        checked_at: f['Checked At'] || new Date().toISOString()
      };
    })
    .filter(Boolean);

  if (rows.length) {
    const { error } = await supabase
      .from('dd_checklist')
      .upsert(rows, { onConflict: 'deal_id,item_index' });
    if (error) console.warn('  DD checklist insert error:', error.message);
    else console.log(`  Migrated ${rows.length} checklist items`);
  }
}

// ============================================================================
// Run the migration
// ============================================================================

async function main() {
  console.log('=== GYC Dealflow: Airtable → Supabase Migration ===');
  console.log(`Source: Airtable base ${AIRTABLE_BASE_ID}`);
  console.log(`Target: ${SUPABASE_URL}`);
  console.log('');

  try {
    // Order matters: management companies first (no deps), then deals (refs MC), then users
    await migrateManagementCompanies();
    await migrateOpportunities();
    await migrateUserData();
    await migrateDDChecklist();

    console.log('\n=== Migration Complete ===');
    console.log(`Total ID mappings: ${Object.keys(airtableToSupabaseId).length}`);
    console.log('\nNext steps:');
    console.log('  1. Verify data in Supabase Dashboard → Table Editor');
    console.log('  2. Sync GHL tiers to user_profiles (run sync-ghl-tiers.js)');
    console.log('  3. Swap API endpoints: rename .supabase.js files to replace originals');
    console.log('  4. Update SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY in Vercel');
    console.log('  5. Deploy and test');
  } catch (err) {
    console.error('\n!!! Migration failed:', err);
    process.exit(1);
  }
}

main();
