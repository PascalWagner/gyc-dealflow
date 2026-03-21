#!/usr/bin/env node
// Batch SEC EDGAR enrichment for all deals
// Searches EDGAR for Form D filings, stores results in sec_filings, updates opportunities
//
// Usage: node scripts/batch-sec-enrich.mjs [--dry-run] [--limit N] [--skip-existing]
//
// SEC rate limit: 10 requests/sec — we throttle to ~5/sec to be safe

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

// --- Config ---
const SUPABASE_URL = 'https://nntzqyufmtypfjpusflm.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
  || readFileSync('.env.supabase', 'utf8').match(/SERVICE_ROLE_KEY=(.+)/)?.[1]?.trim();

if (!SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false }
});

const EDGAR_USER_AGENT = 'GYC Research pascal@growyourcashflow.com';
const EFTS_SEARCH_URL = 'https://efts.sec.gov/LATEST/search-index';
const EDGAR_ARCHIVE_URL = 'https://www.sec.gov/Archives/edgar/data';
const THROTTLE_MS = 220; // ~4.5 req/sec (well under SEC's 10/sec limit)

// --- CLI args ---
const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const SKIP_EXISTING = args.includes('--skip-existing');
const limitIdx = args.indexOf('--limit');
const LIMIT = limitIdx >= 0 ? parseInt(args[limitIdx + 1]) : null;

// --- XML Parser (inline, no dependency on fast-xml-parser at script level) ---
// We'll use a simple dynamic import
let XMLParser;

// --- EDGAR helpers (same logic as api/sec-edgar.js) ---
async function searchEdgar(companyName) {
  const url = `${EFTS_SEARCH_URL}?q=%22${encodeURIComponent(companyName)}%22&forms=D`;
  const resp = await fetch(url, { headers: { 'User-Agent': EDGAR_USER_AGENT } });
  if (!resp.ok) {
    if (resp.status === 429) return { hits: [], rateLimited: true };
    throw new Error(`EDGAR search failed: ${resp.status}`);
  }
  const data = await resp.json();
  const hits = (data.hits && data.hits.hits) || [];
  return {
    rateLimited: false,
    hits: hits.map(h => {
      const s = h._source || {};
      const cik = (s.ciks && s.ciks[0]) || '';
      return {
        cik: cik.replace(/^0+/, ''),
        cikPadded: cik,
        accession: (s.adsh || '').trim(),
        form: s.form || 'D',
        fileDate: s.file_date || '',
        entityName: (s.display_names && s.display_names[0]) || '',
        location: (s.biz_locations && s.biz_locations[0]) || '',
        score: h._score || 0
      };
    })
  };
}

async function fetchFilingXml(cik, accession) {
  const accessionPath = accession.replace(/-/g, '');
  const url = `${EDGAR_ARCHIVE_URL}/${cik}/${accessionPath}/primary_doc.xml`;
  const resp = await fetch(url, { headers: { 'User-Agent': EDGAR_USER_AGENT } });
  if (!resp.ok) {
    if (resp.status === 429) return { xml: null, url, rateLimited: true };
    return { xml: null, url, error: `${resp.status}` };
  }
  return { xml: await resp.text(), url, rateLimited: false };
}

function parseFormD(xmlText) {
  const parser = new XMLParser({
    ignoreAttributes: true,
    isArray: (name) => ['relatedPersonInfo', 'item', 'relationship'].includes(name)
  });
  const doc = parser.parse(xmlText);
  const sub = doc.edgarSubmission || doc;
  const issuer = sub.primaryIssuer || {};
  const offering = sub.offeringData || {};
  const addr = issuer.issuerAddress || {};
  const yoi = issuer.yearOfInc || {};
  const filing = offering.typeOfFiling || {};
  const newOrAmend = filing.newOrAmendment || {};
  const amounts = offering.offeringSalesAmounts || {};
  const investors = offering.investors || {};
  const securities = offering.typesOfSecuritiesOffered || {};
  const commissions = offering.salesCommissionsFindersFees || {};
  const proceeds = offering.useOfProceeds || {};
  const exemptions = offering.federalExemptionsExclusions || {};

  const personsList = sub.relatedPersonsList || {};
  const personsRaw = personsList.relatedPersonInfo || [];
  const persons = personsRaw.map(p => {
    const name = p.relatedPersonName || {};
    const pAddr = p.relatedPersonAddress || {};
    const rels = p.relatedPersonRelationshipList || {};
    return {
      firstName: name.firstName || '',
      lastName: name.lastName || '',
      street: pAddr.street1 || '',
      city: pAddr.city || '',
      state: pAddr.stateOrCountry || '',
      zip: pAddr.zipCode || '',
      relationships: Array.isArray(rels.relationship) ? rels.relationship : (rels.relationship ? [rels.relationship] : []),
      clarification: p.relationshipClarification || ''
    };
  });

  const exemptionItems = Array.isArray(exemptions.item) ? exemptions.item : (exemptions.item ? [exemptions.item] : []);

  return {
    cik: issuer.cik || '',
    entityName: issuer.entityName || '',
    entityType: issuer.entityType || '',
    jurisdiction: issuer.jurisdictionOfInc || '',
    yearOfInc: yoi.value ? parseInt(yoi.value) : null,
    issuerPhone: issuer.issuerPhoneNumber || '',
    issuerStreet: addr.street1 || '',
    issuerCity: addr.city || '',
    issuerState: addr.stateOrCountry || '',
    issuerZip: addr.zipCode || '',
    filingType: sub.submissionType || 'D',
    isAmendment: !!(newOrAmend.isAmendment),
    previousAccession: newOrAmend.previousAccessionNumber || null,
    industryGroup: (offering.industryGroup || {}).industryGroupType || '',
    issuerSize: (offering.issuerSize || {}).revenueRange || '',
    federalExemptions: exemptionItems,
    dateOfFirstSale: (filing.dateOfFirstSale || {}).value || null,
    isEquity: !!securities.isEquityType,
    isDebt: !!securities.isDebtType,
    isPooledFund: !!securities.isPooledInvestmentFundType,
    minimumInvestment: offering.minimumInvestmentAccepted ? parseFloat(offering.minimumInvestmentAccepted) : null,
    totalOfferingAmount: amounts.totalOfferingAmount ? parseFloat(amounts.totalOfferingAmount) : null,
    totalAmountSold: amounts.totalAmountSold ? parseFloat(amounts.totalAmountSold) : null,
    totalRemaining: amounts.totalRemaining ? parseFloat(amounts.totalRemaining) : null,
    totalInvestors: investors.totalNumberAlreadyInvested ? parseInt(investors.totalNumberAlreadyInvested) : null,
    hasNonAccredited: !!investors.hasNonAccreditedInvestors,
    salesCommissions: (commissions.salesCommissions || {}).dollarAmount ? parseFloat(commissions.salesCommissions.dollarAmount) : null,
    findersFees: (commissions.findersFees || {}).dollarAmount ? parseFloat(commissions.findersFees.dollarAmount) : null,
    grossProceedsUsed: (proceeds.grossProceedsUsed || {}).dollarAmount ? parseFloat(proceeds.grossProceedsUsed.dollarAmount) : null,
    proceedsClarification: proceeds.clarificationOfResponse || '',
    relatedPersons: persons
  };
}

// --- Name matching ---
function normalizeForMatch(s) {
  return (s || '').toLowerCase().replace(/[^a-z0-9]/g, ' ').replace(/\s+/g, ' ').trim();
}

// Generic words that don't help with matching — too common in fund names
const GENERIC_WORDS = /\b(apartments?|fund|capital|group|partners|investments?|properties|holdings|llc|lp|inc|corp|company|co|the|real estate|realty|management|equity|ventures|advisors?|asset|wealth|financial|solutions)\b/gi;

function nameScore(dealName, edgarName) {
  const d = normalizeForMatch(dealName);
  const e = normalizeForMatch(edgarName);
  if (d === e) return 1.0;
  if (d.includes(e) || e.includes(d)) return 0.85;

  // Strip generic words for comparison
  const dCore = d.replace(GENERIC_WORDS, '').replace(/\s+/g, ' ').trim();
  const eCore = e.replace(GENERIC_WORDS, '').replace(/\s+/g, ' ').trim();
  if (dCore && eCore && (dCore.includes(eCore) || eCore.includes(dCore))) return 0.75;

  // Word overlap (excluding generic words common in fund/real-estate names)
  const genericSet = new Set(['apartments','apartment','fund','capital','group','partners','investment','investments','properties','holdings','llc','lp','inc','corp','company','the','real','estate','realty','management','equity','ventures','advisors','advisor','asset','wealth','financial','solutions','park','plaza','center','village','multiple','associates','strategies','opportunity','series','class','portfolio']);
  const dWords = new Set(d.split(' ').filter(w => w.length > 2 && !genericSet.has(w)));
  const eWords = new Set(e.split(' ').filter(w => w.length > 2 && !genericSet.has(w)));
  if (dWords.size === 0 || eWords.size === 0) return 0;
  let overlap = 0;
  for (const w of dWords) if (eWords.has(w)) overlap++;
  if (overlap === 0) return 0;
  // Require at least 2 meaningful matching words if both names have 3+ words
  if (dWords.size >= 3 && eWords.size >= 3 && overlap < 2) return overlap * 0.25;
  return overlap / Math.max(dWords.size, eWords.size);
}

function pickBestMatch(dealName, sponsorName, allHits) {
  if (allHits.length === 0) return null;

  let best = null;
  let bestScore = 0;

  for (const hit of allHits) {
    const dealScore = nameScore(dealName, hit.entityName);

    // Sponsor-only match: the EDGAR entity matches the sponsor name but not the deal name.
    // This is only valid if the deal name keywords ALSO appear in the entity
    // (to avoid matching "Equity Multiple Fund I" to "Bayside 44 Industrial Park")
    let sponsorScore = 0;
    if (sponsorName) {
      const rawSponsorScore = nameScore(sponsorName, hit.entityName);
      if (rawSponsorScore > 0.5) {
        // Verify deal name has at least some overlap with the entity
        const eNorm = normalizeForMatch(hit.entityName);
        const dealKeywords = normalizeForMatch(dealName).split(' ').filter(w => w.length > 2 && !w.match(/apartments?|fund|llc|lp|the|inc|investment|capital|group|partners/i));
        const dealOverlap = dealKeywords.some(w => eNorm.includes(w));
        if (dealOverlap) {
          // Both sponsor and deal have presence — strong match
          sponsorScore = rawSponsorScore * 0.95;
        } else {
          // Sponsor matches but deal doesn't — weaker, could be a different deal from same sponsor
          sponsorScore = rawSponsorScore * 0.4;
        }
      }
    }

    const score = Math.max(dealScore, sponsorScore) + (hit.score / 10000);
    if (score > bestScore) {
      bestScore = score;
      best = { ...hit, matchScore: score };
    }
  }

  // Require meaningful match
  return best && best.matchScore >= 0.45 ? best : null;
}

// Generate search queries to try (in priority order)
// legalEntities = { issuerEntity, gpEntity, sponsorEntity, operatorLegalEntity }
function generateSearchQueries(dealName, sponsorName, legalEntities) {
  const queries = [];
  const seen = new Set();

  function add(q) {
    const clean = (q || '').trim();
    if (clean && clean.length > 2 && !seen.has(clean.toLowerCase())) {
      seen.add(clean.toLowerCase());
      queries.push(clean);
    }
  }

  const le = legalEntities || {};

  // 0. Legal entity names from PPM — highest priority, exact SEC match
  add(le.issuerEntity);    // "FPC Opportunity Fund I, LLC" — what SEC has
  add(le.gpEntity);        // "Favor Point Capital Management, LLC"
  add(le.sponsorEntity);   // "Favor Point Capital, LLC"
  add(le.operatorLegalEntity); // from management_companies.legal_entity

  // 1. Full deal name (most specific)
  add(dealName);

  // 2. Sponsor/operator name (SPVs often contain sponsor name)
  add(sponsorName);

  // 3. Deal name without generic property suffixes (e.g. "Cambridge Court" instead of "Cambridge Court Apartments")
  if (dealName) {
    const stripped = dealName.replace(/\b(apartments?|plaza|center|park|village|estates?|towers?|place|court|square|landing|crossing|ridge|hills?)\b/gi, '').trim();
    add(stripped);
  }

  // 4. Sponsor + deal keywords (e.g. "Upgrade Partners Cambridge")
  if (sponsorName && dealName) {
    const dealCore = dealName.replace(/\b(apartments?|fund|llc|lp|inc|the|investment|plaza|center|park)\b/gi, '').trim().split(/\s+/)[0];
    if (dealCore && dealCore.length > 2) {
      add(`${sponsorName} ${dealCore}`);
    }
  }

  // 5. If deal name has parenthetical (entity name), extract it
  const parenMatch = dealName?.match(/\(([^)]+)\)/);
  if (parenMatch) {
    add(parenMatch[1]);
  }

  return queries;
}

// --- Throttle ---
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// --- Main ---
async function main() {
  // Dynamic import of fast-xml-parser
  const fxp = await import('fast-xml-parser');
  XMLParser = fxp.XMLParser;

  console.log('=== Batch SEC EDGAR Enrichment ===');
  if (DRY_RUN) console.log('  [DRY RUN - no writes]');
  if (SKIP_EXISTING) console.log('  [Skipping deals with existing sec_cik]');
  if (LIMIT) console.log(`  [Limit: ${LIMIT} deals]`);
  console.log('');

  // Fetch deals
  let query = supabase
    .from('opportunities')
    .select('id, investment_name, management_company_id, sec_cik, issuer_entity, gp_entity, sponsor_entity, management_companies(operator_name, legal_entity)')
    .order('created_at', { ascending: true });

  if (SKIP_EXISTING) {
    query = query.or('sec_cik.is.null,sec_cik.eq.');
  }

  const { data: deals, error } = await query;
  if (error) { console.error('Failed to fetch deals:', error); process.exit(1); }

  const total = LIMIT ? Math.min(deals.length, LIMIT) : deals.length;
  console.log(`Found ${deals.length} deals${SKIP_EXISTING ? ' without SEC data' : ''}, processing ${total}\n`);

  // Stats
  let matched = 0, noMatch = 0, alreadyHas = 0, errors = 0, rateLimited = 0;

  for (let i = 0; i < total; i++) {
    const deal = deals[i];
    const name = deal.investment_name || '';
    const sponsor = deal.management_companies?.operator_name || '';
    const searchTerm = name || sponsor;

    // Progress
    const pct = ((i + 1) / total * 100).toFixed(1);
    process.stdout.write(`[${i + 1}/${total}] (${pct}%) ${searchTerm.substring(0, 50).padEnd(50)} `);

    if (!searchTerm) {
      console.log('⏭  No name to search');
      noMatch++;
      continue;
    }

    if (deal.sec_cik && deal.sec_cik !== '' && !SKIP_EXISTING) {
      console.log('✅ Already has SEC data');
      alreadyHas++;
      continue;
    }

    try {
      // 1. Search EDGAR with multiple query variations
      const queries = generateSearchQueries(name, sponsor, {
        issuerEntity: deal.issuer_entity || '',
        gpEntity: deal.gp_entity || '',
        sponsorEntity: deal.sponsor_entity || '',
        operatorLegalEntity: deal.management_companies?.legal_entity || ''
      });
      let allHits = [];
      let wasRateLimited = false;

      for (const q of queries) {
        const searchResult = await searchEdgar(q);
        if (searchResult.rateLimited) {
          wasRateLimited = true;
          break;
        }
        // Dedupe by accession number
        for (const hit of searchResult.hits) {
          if (!allHits.find(h => h.accession === hit.accession)) {
            allHits.push(hit);
          }
        }
        await sleep(THROTTLE_MS);
        // If we already have a strong match, stop searching
        const earlyMatch = pickBestMatch(name, sponsor, allHits);
        if (earlyMatch && earlyMatch.matchScore >= 0.75) break;
      }

      if (wasRateLimited) {
        console.log('⏳ Rate limited, waiting 30s...');
        rateLimited++;
        await sleep(30000);
        i--; // retry this deal
        continue;
      }

      if (allHits.length === 0) {
        console.log(`❌ No EDGAR results (tried ${queries.length} queries)`);
        noMatch++;
        continue;
      }

      // 2. Pick best match across all search results
      const match = pickBestMatch(name, sponsor, allHits);
      if (!match) {
        // Show top candidate score for debugging
        const topHit = allHits[0];
        const dbgScore = topHit ? Math.max(nameScore(name, topHit.entityName), nameScore(sponsor, topHit.entityName)).toFixed(3) : '?';
        console.log(`❌ No good match (best: "${topHit?.entityName}" score=${dbgScore})`);
        noMatch++;
        continue;
      }

      // 3. Fetch the filing XML
      const { xml, url, rateLimited: xmlRateLimited, error: xmlError } = await fetchFilingXml(match.cikPadded || match.cik, match.accession);
      if (xmlRateLimited) {
        console.log('⏳ Rate limited on filing fetch, waiting 30s...');
        rateLimited++;
        await sleep(30000);
        i--;
        continue;
      }
      if (!xml) {
        console.log(`⚠️  Filing fetch failed: ${xmlError}`);
        errors++;
        await sleep(THROTTLE_MS);
        continue;
      }

      await sleep(THROTTLE_MS);

      // 4. Parse
      const parsed = parseFormD(xml);

      console.log(`✅ ${match.entityName.substring(0, 30)} (CIK: ${parsed.cik || match.cik}, score=${match.matchScore.toFixed(3)}, $${((parsed.totalAmountSold || 0) / 1e6).toFixed(1)}M sold, ${parsed.totalInvestors || 0} investors)`);

      if (DRY_RUN) {
        matched++;
        continue;
      }

      // 5. Upsert sec_filing
      const cik = String(parsed.cik || match.cik || '').replace(/^0+/, '');

      // Mark existing filings for this CIK as not latest
      await supabase
        .from('sec_filings')
        .update({ is_latest_amendment: false })
        .eq('cik', cik)
        .eq('is_latest_amendment', true);

      const filingRow = {
        opportunity_id: deal.id,
        management_company_id: deal.management_company_id || null,
        cik,
        accession_number: match.accession,
        filing_date: parsed.dateOfFirstSale || match.fileDate || null,
        filing_type: parsed.filingType,
        is_latest_amendment: true,
        entity_name: parsed.entityName,
        entity_type: parsed.entityType,
        jurisdiction: parsed.jurisdiction,
        year_of_inc: parsed.yearOfInc,
        issuer_phone: parsed.issuerPhone,
        issuer_street: parsed.issuerStreet,
        issuer_city: parsed.issuerCity,
        issuer_state: parsed.issuerState,
        issuer_zip: parsed.issuerZip,
        industry_group: parsed.industryGroup,
        issuer_size: parsed.issuerSize,
        federal_exemptions: parsed.federalExemptions,
        date_of_first_sale: parsed.dateOfFirstSale,
        is_equity: parsed.isEquity,
        is_debt: parsed.isDebt,
        is_pooled_fund: parsed.isPooledFund,
        minimum_investment: parsed.minimumInvestment,
        total_offering_amount: parsed.totalOfferingAmount,
        total_amount_sold: parsed.totalAmountSold,
        total_remaining: parsed.totalRemaining,
        total_investors: parsed.totalInvestors,
        has_non_accredited: parsed.hasNonAccredited,
        sales_commissions: parsed.salesCommissions,
        finders_fees: parsed.findersFees,
        gross_proceeds_used: parsed.grossProceedsUsed,
        proceeds_clarification: parsed.proceedsClarification,
        raw_xml: xml,
        edgar_url: url
      };

      const { data: filing, error: filingErr } = await supabase
        .from('sec_filings')
        .upsert(filingRow, { onConflict: 'accession_number' })
        .select('id')
        .single();

      if (filingErr) {
        console.error(`  ⚠️  Filing upsert error: ${filingErr.message}`);
        errors++;
        continue;
      }

      // 6. Insert related persons
      if (parsed.relatedPersons.length > 0 && filing) {
        await supabase.from('related_persons').delete().eq('sec_filing_id', filing.id);
        const personRows = parsed.relatedPersons.map(p => ({
          sec_filing_id: filing.id,
          management_company_id: deal.management_company_id || null,
          first_name: p.firstName,
          last_name: p.lastName,
          street: p.street,
          city: p.city,
          state: p.state,
          zip: p.zip,
          relationships: p.relationships,
          relationship_clarification: p.clarification
        }));
        await supabase.from('related_persons').insert(personRows);
      }

      // 7. Update the opportunity
      const is506b = (parsed.federalExemptions || []).some(e => e === '06b');
      const is506c = (parsed.federalExemptions || []).some(e => e === '06c');

      const updates = { sec_cik: cik };
      if (is506b) updates.offering_type = '506(b)';
      else if (is506c) updates.offering_type = '506(c)';
      updates.is_506b = is506b;
      if (parsed.minimumInvestment) updates.investment_minimum = parsed.minimumInvestment;
      if (parsed.dateOfFirstSale) updates.date_of_first_sale = parsed.dateOfFirstSale;
      if (parsed.totalOfferingAmount) updates.offering_size = parsed.totalOfferingAmount;
      if (parsed.totalAmountSold) updates.total_amount_sold = parsed.totalAmountSold;
      if (parsed.totalInvestors) updates.total_investors = parsed.totalInvestors;
      if (!deal.investment_name && parsed.entityName) updates.investment_name = parsed.entityName;

      await supabase.from('opportunities').update(updates).eq('id', deal.id);

      // 8. Update management company HQ (safe — only fill empty)
      if (deal.management_company_id) {
        const { data: mc } = await supabase
          .from('management_companies')
          .select('hq_city, hq_state, hq_zip, founding_year')
          .eq('id', deal.management_company_id)
          .single();

        if (mc) {
          const mcUpdates = {};
          if (!mc.hq_city && parsed.issuerCity) mcUpdates.hq_city = parsed.issuerCity;
          if (!mc.hq_state && parsed.issuerState) mcUpdates.hq_state = parsed.issuerState;
          if (!mc.hq_zip && parsed.issuerZip) mcUpdates.hq_zip = parsed.issuerZip;
          if (!mc.founding_year && parsed.yearOfInc) mcUpdates.founding_year = parsed.yearOfInc;
          if (Object.keys(mcUpdates).length > 0) {
            await supabase.from('management_companies').update(mcUpdates).eq('id', deal.management_company_id);
          }
        }
      }

      matched++;

    } catch (err) {
      console.log(`⚠️  Error: ${err.message}`);
      errors++;
    }
  }

  // Summary
  console.log('\n=== Results ===');
  console.log(`  Matched & enriched: ${matched}`);
  console.log(`  No match found:    ${noMatch}`);
  console.log(`  Already had SEC:   ${alreadyHas}`);
  console.log(`  Errors:            ${errors}`);
  console.log(`  Rate limited:      ${rateLimited}`);
  console.log(`  Total processed:   ${total}`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
