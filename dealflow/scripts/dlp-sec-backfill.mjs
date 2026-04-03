#!/usr/bin/env node
/**
 * One-time script: Fetch ALL SEC Form D filings for DLP Capital and update
 * the DLP Lending Fund deal record with the latest filing data.
 *
 * Usage:
 *   node scripts/dlp-sec-backfill.mjs
 *   node scripts/dlp-sec-backfill.mjs --dry-run
 */

import { createClient } from '@supabase/supabase-js';

const DLP_DEAL_ID = '54bbffff-c0ee-48d2-a11c-224a49300a61';
const DRY_RUN = process.argv.includes('--dry-run');

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const EDGAR_USER_AGENT = 'GYC Research pascal@growyourcashflow.com';
const EFTS_URL = 'https://efts.sec.gov/LATEST/search-index';

async function main() {
  console.log(`\n=== DLP SEC All-Filings Backfill ${DRY_RUN ? '(DRY RUN)' : ''} ===\n`);

  // 1. Get DLP deal and its CIK
  const { data: deal, error: dealErr } = await supabase
    .from('opportunities')
    .select('id, investment_name, sec_cik, total_amount_sold, total_investors')
    .eq('id', DLP_DEAL_ID)
    .single();

  if (dealErr || !deal) {
    console.error('Failed to load DLP deal:', dealErr?.message);
    process.exit(1);
  }

  console.log(`Deal: ${deal.investment_name}`);
  console.log(`Current CIK: ${deal.sec_cik || '(none)'}`);
  console.log(`Current total_amount_sold: ${deal.total_amount_sold || '(none)'}`);
  console.log(`Current total_investors: ${deal.total_investors || '(none)'}`);

  // Also check sec_filings table for CIK
  let cik = deal.sec_cik;
  if (!cik) {
    const { data: existingFiling } = await supabase
      .from('sec_filings')
      .select('cik')
      .eq('opportunity_id', DLP_DEAL_ID)
      .limit(1)
      .maybeSingle();
    cik = existingFiling?.cik;
  }

  if (!cik) {
    // Try searching EDGAR for DLP Capital
    console.log('\nNo CIK found, searching EDGAR for "DLP Lending Fund"...');
    const searchUrl = `${EFTS_URL}?q=%22DLP+Lending%22&forms=D,D/A`;
    const searchResp = await fetch(searchUrl, { headers: { 'User-Agent': EDGAR_USER_AGENT } });
    if (searchResp.ok) {
      const searchData = await searchResp.json();
      const hits = searchData?.hits?.hits || [];
      if (hits.length > 0) {
        const firstSource = hits[0]._source || {};
        cik = ((firstSource.ciks && firstSource.ciks[0]) || '').replace(/^0+/, '');
        console.log(`Found CIK: ${cik} from EDGAR search (${firstSource.display_names?.[0] || 'unknown'})`);
      }
    }
  }

  if (!cik) {
    console.error('Could not determine CIK for DLP. Please set sec_cik on the deal.');
    process.exit(1);
  }

  console.log(`\nUsing CIK: ${cik}`);

  // 2. Fetch all filings from EDGAR EFTS
  const normalizedCik = String(cik).replace(/^0+/, '');
  const url = `${EFTS_URL}?q=*&forms=D,D/A&ciks=${normalizedCik}`;
  console.log(`\nSearching: ${url}`);

  const resp = await fetch(url, { headers: { 'User-Agent': EDGAR_USER_AGENT } });
  if (!resp.ok) {
    console.error(`EDGAR search failed: ${resp.status}`);
    process.exit(1);
  }

  const data = await resp.json();
  const hits = data?.hits?.hits || [];
  const totalValue = data?.hits?.total?.value || hits.length;
  console.log(`Found ${totalValue} total filings (${hits.length} in this page)`);

  if (hits.length === 0) {
    console.log('No filings found.');
    process.exit(0);
  }

  // 3. Process each filing
  let stored = 0;
  let latest = null;

  for (const hit of hits) {
    const source = hit._source || {};
    const accession = String(source.adsh || '').trim();
    const entityName = (source.display_names && source.display_names[0]) || '?';
    const fileDate = source.file_date || '';
    const form = source.form || 'D';

    if (!accession) continue;

    console.log(`  ${form} ${fileDate} — ${entityName} (${accession})`);

    if (!latest || fileDate > latest.fileDate) {
      latest = { accession, fileDate, entityName, cik: normalizedCik };
    }

    if (!DRY_RUN) {
      try {
        // Fetch the filing XML
        const accessionDash = accession.replace(/-/g, '');
        const accessionFormatted = accession.includes('-') ? accession : `${accession.slice(0, 10)}-${accession.slice(10, 12)}-${accession.slice(12)}`;
        const xmlUrl = `https://www.sec.gov/Archives/edgar/data/${normalizedCik}/${accessionDash}/${accessionFormatted}-primary_doc.xml`;
        const xmlResp = await fetch(xmlUrl, { headers: { 'User-Agent': EDGAR_USER_AGENT } });

        if (xmlResp.ok) {
          const xmlText = await xmlResp.text();

          // Mark previous latest as not latest
          await supabase
            .from('sec_filings')
            .update({ is_latest_amendment: false })
            .eq('cik', normalizedCik)
            .eq('is_latest_amendment', true);

          // Upsert this filing
          const { error: upsertErr } = await supabase
            .from('sec_filings')
            .upsert({
              accession_number: accession,
              cik: normalizedCik,
              opportunity_id: DLP_DEAL_ID,
              filing_date: fileDate || null,
              filing_type: form,
              entity_name: entityName,
              is_latest_amendment: true,
              raw_xml: xmlText,
              edgar_url: xmlUrl
            }, { onConflict: 'accession_number' });

          if (upsertErr) {
            console.warn(`    Failed to upsert: ${upsertErr.message}`);
          } else {
            stored++;
          }
        } else {
          console.warn(`    XML fetch failed: ${xmlResp.status}`);
        }

        // Rate limit
        await new Promise(r => setTimeout(r, 150));
      } catch (err) {
        console.warn(`    Error: ${err.message}`);
      }
    }
  }

  console.log(`\nStored ${stored} filings. Latest: ${latest?.fileDate} — ${latest?.entityName}`);

  // 4. Get the latest filing from DB and update the deal
  if (!DRY_RUN && stored > 0) {
    const { data: latestFiling } = await supabase
      .from('sec_filings')
      .select('*')
      .eq('cik', normalizedCik)
      .eq('is_latest_amendment', true)
      .order('filing_date', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (latestFiling) {
      const updates = {};
      if (latestFiling.total_amount_sold) updates.total_amount_sold = latestFiling.total_amount_sold;
      if (latestFiling.total_investors) updates.total_investors = latestFiling.total_investors;
      if (latestFiling.cik) updates.sec_cik = latestFiling.cik;
      if (latestFiling.date_of_first_sale) updates.date_of_first_sale = latestFiling.date_of_first_sale;
      if (latestFiling.total_offering_amount) updates.offering_size = latestFiling.total_offering_amount;

      if (Object.keys(updates).length > 0) {
        updates.updated_at = new Date().toISOString();
        const { error: updateErr } = await supabase
          .from('opportunities')
          .update(updates)
          .eq('id', DLP_DEAL_ID);

        if (updateErr) {
          console.error('Failed to update deal:', updateErr.message);
        } else {
          console.log('\nDeal updated with latest SEC data:', JSON.stringify(updates, null, 2));
        }
      } else {
        console.log('\nLatest filing has no parseable amount/investor data to update.');
        console.log('Filing data:', JSON.stringify(latestFiling, null, 2).substring(0, 500));
      }
    }
  }

  console.log('\nDone.');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
