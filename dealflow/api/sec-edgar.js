// SEC EDGAR Form D Integration
// Searches, fetches, and parses Form D filings from EDGAR
// Enriches deals with SEC-verified data (authoritative source)

import { getAdminClient, ADMIN_EMAILS } from './_supabase.js';
import { XMLParser } from 'fast-xml-parser';

const EDGAR_USER_AGENT = 'GYC Research pascal@growyourcashflow.com';
const EFTS_SEARCH_URL = 'https://efts.sec.gov/LATEST/search-index';
const EDGAR_ARCHIVE_URL = 'https://www.sec.gov/Archives/edgar/data';

// ============================================================================
// EDGAR API helpers
// ============================================================================

async function searchEdgar(companyName) {
  const url = `${EFTS_SEARCH_URL}?q=%22${encodeURIComponent(companyName)}%22&forms=D`;
  const resp = await fetch(url, {
    headers: { 'User-Agent': EDGAR_USER_AGENT }
  });
  if (!resp.ok) throw new Error(`EDGAR search failed: ${resp.status}`);
  const data = await resp.json();

  const hits = (data.hits && data.hits.hits) || [];
  return hits.map(h => {
    const s = h._source || {};
    const cik = (s.ciks && s.ciks[0]) || '';
    const accession = (s.adsh || '').trim();
    return {
      cik: cik.replace(/^0+/, ''),
      cikPadded: cik,
      accession,
      form: s.form || 'D',
      fileDate: s.file_date || '',
      entityName: (s.display_names && s.display_names[0]) || '',
      location: (s.biz_locations && s.biz_locations[0]) || '',
      score: h._score || 0
    };
  });
}

async function fetchFilingXml(cik, accession) {
  // Accession format: 0001947418-24-000001 → path: 000194741824000001
  const accessionPath = accession.replace(/-/g, '');
  const url = `${EDGAR_ARCHIVE_URL}/${cik}/${accessionPath}/primary_doc.xml`;
  const resp = await fetch(url, {
    headers: { 'User-Agent': EDGAR_USER_AGENT }
  });
  if (!resp.ok) throw new Error(`EDGAR filing fetch failed: ${resp.status} for ${url}`);
  return { xml: await resp.text(), url };
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

  // Extract related persons
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

  // Federal exemptions (e.g., ['06b', '06c'])
  const exemptionItems = Array.isArray(exemptions.item) ? exemptions.item : (exemptions.item ? [exemptions.item] : []);

  return {
    // Issuer
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

    // Filing
    filingType: sub.submissionType || 'D',
    isAmendment: !!(newOrAmend.isAmendment),
    previousAccession: newOrAmend.previousAccessionNumber || null,

    // Offering
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

    // Commissions
    salesCommissions: (commissions.salesCommissions || {}).dollarAmount ? parseFloat(commissions.salesCommissions.dollarAmount) : null,
    findersFees: (commissions.findersFees || {}).dollarAmount ? parseFloat(commissions.findersFees.dollarAmount) : null,
    grossProceedsUsed: (proceeds.grossProceedsUsed || {}).dollarAmount ? parseFloat(proceeds.grossProceedsUsed.dollarAmount) : null,
    proceedsClarification: proceeds.clarificationOfResponse || '',

    // Persons
    relatedPersons: persons
  };
}

// ============================================================================
// Action handlers
// ============================================================================

async function handleSearch(req, res) {
  const { company } = req.body || {};
  if (!company) return res.status(400).json({ error: 'company is required' });

  const results = await searchEdgar(company);
  return res.json({ results, count: results.length });
}

async function handleFetchFiling(req, res) {
  const { cik, accession, opportunityId, managementCompanyId } = req.body || {};
  if (!cik || !accession) return res.status(400).json({ error: 'cik and accession are required' });

  const { xml, url } = await fetchFilingXml(cik, accession);
  const parsed = parseFormD(xml);

  const supabase = getAdminClient();

  // Mark any existing filings for this CIK as not latest
  await supabase
    .from('sec_filings')
    .update({ is_latest_amendment: false })
    .eq('cik', parsed.cik || cik)
    .eq('is_latest_amendment', true);

  // Insert the filing
  const filingRow = {
    opportunity_id: opportunityId || null,
    management_company_id: managementCompanyId || null,
    cik: (parsed.cik || cik).replace(/^0+/, ''),
    accession_number: accession,
    filing_date: parsed.dateOfFirstSale || null,
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
    .select()
    .single();

  if (filingErr) throw filingErr;

  // Insert related persons
  if (parsed.relatedPersons.length > 0) {
    // Delete existing persons for this filing (in case of re-fetch)
    await supabase.from('related_persons').delete().eq('sec_filing_id', filing.id);

    const personRows = parsed.relatedPersons.map(p => ({
      sec_filing_id: filing.id,
      management_company_id: managementCompanyId || null,
      first_name: p.firstName,
      last_name: p.lastName,
      street: p.street,
      city: p.city,
      state: p.state,
      zip: p.zip,
      relationships: p.relationships,
      relationship_clarification: p.clarification
    }));

    const { error: persErr } = await supabase.from('related_persons').insert(personRows);
    if (persErr) console.error('Error inserting related persons:', persErr);
  }

  return res.json({
    filing,
    parsed: { ...parsed, rawXml: undefined },
    personsCount: parsed.relatedPersons.length
  });
}

async function handleEnrichDeal(req, res) {
  const { dealId, secFilingId } = req.body || {};
  if (!dealId || !secFilingId) return res.status(400).json({ error: 'dealId and secFilingId are required' });

  const supabase = getAdminClient();

  // Get the filing
  const { data: filing, error: fErr } = await supabase
    .from('sec_filings')
    .select('*')
    .eq('id', secFilingId)
    .single();
  if (fErr || !filing) return res.status(404).json({ error: 'Filing not found' });

  // Get the deal
  const { data: deal, error: dErr } = await supabase
    .from('opportunities')
    .select('*')
    .eq('id', dealId)
    .single();
  if (dErr || !deal) return res.status(404).json({ error: 'Deal not found' });

  // Map Form D → opportunities
  // Authoritative fields (overwrite even if not empty)
  const is506b = (filing.federal_exemptions || []).some(e => e === '06b');
  const is506c = (filing.federal_exemptions || []).some(e => e === '06c');

  const updates = {};
  // Authoritative: always overwrite
  if (is506b) updates.offering_type = '506(b)';
  else if (is506c) updates.offering_type = '506(c)';
  updates.is_506b = is506b;
  if (filing.minimum_investment) updates.investment_minimum = filing.minimum_investment;
  if (filing.date_of_first_sale) updates.date_of_first_sale = filing.date_of_first_sale;
  if (filing.total_offering_amount) updates.offering_size = filing.total_offering_amount;
  if (filing.total_amount_sold) updates.total_amount_sold = filing.total_amount_sold;
  if (filing.total_investors) updates.total_investors = filing.total_investors;
  if (filing.cik) updates.sec_cik = filing.cik;

  // Safe update: only fill empty fields
  if (!deal.investment_name && filing.entity_name) updates.investment_name = filing.entity_name;
  if (!deal.instrument) {
    if (filing.is_debt) updates.instrument = 'debt';
    else if (filing.is_equity) updates.instrument = 'equity';
    else if (filing.is_pooled_fund) updates.instrument = 'fund';
  }

  // Link filing to deal
  await supabase.from('sec_filings').update({ opportunity_id: dealId }).eq('id', secFilingId);

  // Update deal
  const { error: updErr } = await supabase.from('opportunities').update(updates).eq('id', dealId);
  if (updErr) throw updErr;

  // Update management company if linked
  if (deal.management_company_id) {
    const mcUpdates = {};
    // Safe update: only fill empty
    const { data: mc } = await supabase.from('management_companies').select('*').eq('id', deal.management_company_id).single();
    if (mc) {
      if (!mc.hq_city && filing.issuer_city) mcUpdates.hq_city = filing.issuer_city;
      if (!mc.hq_state && filing.issuer_state) mcUpdates.hq_state = filing.issuer_state;
      if (!mc.hq_zip && filing.issuer_zip) mcUpdates.hq_zip = filing.issuer_zip;
      if (!mc.founding_year && filing.year_of_inc) mcUpdates.founding_year = filing.year_of_inc;
      if (Object.keys(mcUpdates).length > 0) {
        await supabase.from('management_companies').update(mcUpdates).eq('id', deal.management_company_id);
        // Also link filing to MC
        await supabase.from('sec_filings').update({ management_company_id: deal.management_company_id }).eq('id', secFilingId);
      }
    }
  }

  return res.json({ success: true, updates, is506b });
}

async function handleSearchPersons(req, res) {
  const { firstName, lastName } = req.body || {};
  if (!lastName) return res.status(400).json({ error: 'lastName is required' });

  const supabase = getAdminClient();
  let query = supabase
    .from('related_persons')
    .select('*, sec_filings(entity_name, cik, accession_number, edgar_url, opportunity_id, management_company_id)')
    .ilike('last_name', lastName);

  if (firstName) query = query.ilike('first_name', firstName);

  const { data, error } = await query;
  if (error) throw error;

  return res.json({ persons: data, count: data.length });
}

// ============================================================================
// Main handler
// ============================================================================

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    // Admin check for write operations
    const action = req.body?.action || req.query?.action;

    if (action === 'search') {
      // Search is available to anyone (it's public SEC data)
      if (req.method === 'GET') {
        req.body = { company: req.query.company };
      }
      return await handleSearch(req, res);
    }

    // All other actions require admin
    // (Simple email check from body or query for now)
    const adminEmail = req.body?.adminEmail || req.query?.adminEmail;
    if (!adminEmail || !ADMIN_EMAILS.includes(adminEmail.toLowerCase())) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    switch (action) {
      case 'fetch-filing': return await handleFetchFiling(req, res);
      case 'enrich-deal': return await handleEnrichDeal(req, res);
      case 'search-persons': return await handleSearchPersons(req, res);
      default: return res.status(400).json({ error: `Unknown action: ${action}` });
    }
  } catch (err) {
    console.error('SEC EDGAR error:', err);
    return res.status(500).json({ error: err.message });
  }
}
