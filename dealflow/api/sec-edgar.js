// SEC EDGAR Form D Integration
// Searches, fetches, and parses Form D filings from EDGAR
// Enriches deals with SEC-verified data (authoritative source)

import { getAdminClient, ADMIN_EMAILS } from './_supabase.js';
import {
  applySecFilingToDeal,
  fetchFilingXml,
  parseFormD,
  searchEdgar,
  upsertParsedSecFiling
} from './_sec-edgar.js';

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
  const { filing, personsCount } = await upsertParsedSecFiling({
    supabase,
    opportunityId,
    managementCompanyId,
    accession,
    cik,
    parsed,
    xml,
    url
  });

  return res.json({
    filing,
    parsed: { ...parsed, rawXml: undefined },
    personsCount
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

  const result = await applySecFilingToDeal({
    supabase,
    deal,
    secFilingId,
    filing
  });

  return res.json(result);
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
