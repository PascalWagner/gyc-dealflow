// Background Check API
// Searches free public databases for sponsor/key person background information
// Sources: SEC EDGAR, FINRA BrokerCheck, SEC IAPD, OFAC SDN, CourtListener
//
// Usage:
//   POST /api/background-check  { action: 'run', personName, companyName, managementCompanyId }
//   GET  /api/background-check?managementCompanyId=UUID
//   GET  /api/background-check?personName=Name

import { getAdminClient, setCors, deriveTier } from './_supabase.js';

const EDGAR_USER_AGENT = 'GYC Research pascal@growyourcashflow.com';

// ============================================================================
// External API helpers
// ============================================================================

// --- SEC EDGAR: Form D search ---
async function searchEdgarPerson(firstName, lastName) {
  // Search for person across all Form D filings
  const url = `https://efts.sec.gov/LATEST/search-index?q=%22${encodeURIComponent(lastName)}%22&forms=D&dateRange=custom&startdt=2000-01-01`;
  const resp = await fetch(url, {
    headers: { 'User-Agent': EDGAR_USER_AGENT }
  });
  if (!resp.ok) return { status: 'error', error: `EDGAR: ${resp.status}` };
  const data = await resp.json();
  const hits = (data.hits && data.hits.hits) || [];

  const entities = hits.slice(0, 20).map(h => {
    const s = h._source || {};
    return {
      entityName: (s.display_names && s.display_names[0]) || '',
      cik: ((s.ciks && s.ciks[0]) || '').replace(/^0+/, ''),
      filingDate: s.file_date || '',
      form: s.form || 'D'
    };
  });

  return {
    status: entities.length > 0 ? 'found' : 'not_found',
    count: (data.hits && data.hits.total && data.hits.total.value) || entities.length,
    entities
  };
}

async function searchEdgarCompany(companyName) {
  const url = `https://efts.sec.gov/LATEST/search-index?q=%22${encodeURIComponent(companyName)}%22&forms=D`;
  const resp = await fetch(url, {
    headers: { 'User-Agent': EDGAR_USER_AGENT }
  });
  if (!resp.ok) return { status: 'error', error: `EDGAR: ${resp.status}` };
  const data = await resp.json();
  const hits = (data.hits && data.hits.hits) || [];

  let totalRaised = 0;
  const entities = hits.slice(0, 30).map(h => {
    const s = h._source || {};
    return {
      entityName: (s.display_names && s.display_names[0]) || '',
      cik: ((s.ciks && s.ciks[0]) || '').replace(/^0+/, ''),
      filingDate: s.file_date || '',
      form: s.form || 'D'
    };
  });

  return {
    status: entities.length > 0 ? 'found' : 'not_found',
    count: (data.hits && data.hits.total && data.hits.total.value) || entities.length,
    entities,
    totalRaised
  };
}

// --- FINRA BrokerCheck ---
async function searchFinra(firstName, lastName) {
  try {
    const query = `${firstName} ${lastName}`.trim();
    const url = `https://api.brokercheck.finra.org/search/individual?query=${encodeURIComponent(query)}&filter=active=true,prev=true&hl=true&nrows=5&start=0&r=25&sort=score+desc&wt=json`;
    const resp = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': EDGAR_USER_AGENT
      }
    });
    if (!resp.ok) return { status: 'error', error: `FINRA: ${resp.status}` };
    const data = await resp.json();
    const hits = data.hits || {};
    const total = hits.total || 0;
    const results = (hits.hits || []).map(h => {
      const src = h._source || {};
      return {
        name: `${src.ind_firstname || ''} ${src.ind_lastname || ''}`.trim(),
        crd: src.ind_source_id || '',
        firmName: src.ind_current_employments ? (src.ind_current_employments[0] || {}).firm_name : '',
        disclosureCount: src.ind_num_of_disclosures || 0,
        industryStart: src.ind_industry_startdate || '',
        status: src.ind_bc_scope || ''
      };
    });

    const bestMatch = results.find(r =>
      r.name.toLowerCase().includes(lastName.toLowerCase())
    );

    return {
      status: total > 0 ? (bestMatch && bestMatch.disclosureCount > 0 ? 'flagged' : 'clear') : 'not_found',
      found: total > 0,
      disclosures: bestMatch ? bestMatch.disclosureCount : 0,
      employments: bestMatch ? 1 : 0,
      details: bestMatch || null,
      allResults: results
    };
  } catch (e) {
    return { status: 'error', error: e.message };
  }
}

// --- SEC IAPD (Investment Adviser Public Disclosure) ---
async function searchIAPD(firstName, lastName) {
  try {
    const query = `${firstName} ${lastName}`.trim();
    const url = `https://api.adviserinfo.sec.gov/IAPD/Content/Search/Genericsearch.aspx?SearchType=IndividualSearchByName&IndividualName=${encodeURIComponent(query)}&fmt=json`;
    const resp = await fetch(url, {
      headers: { 'Accept': 'application/json', 'User-Agent': EDGAR_USER_AGENT }
    });

    if (!resp.ok) return { status: 'error', error: `IAPD: ${resp.status}` };

    // IAPD returns HTML-ish JSON, try to parse
    const text = await resp.text();
    try {
      const data = JSON.parse(text);
      const results = data.Results || data.results || [];
      const hits = Array.isArray(results) ? results : [];

      const match = hits.find(r => {
        const name = (r.IndividualName || r.Name || '').toLowerCase();
        return name.includes(lastName.toLowerCase());
      });

      return {
        status: hits.length > 0 ? 'found' : 'not_found',
        found: hits.length > 0,
        firmCount: match ? (match.CurrentEmployments || []).length : 0,
        disclosures: match ? (match.NumDisclosures || 0) : 0,
        details: match || null
      };
    } catch {
      // IAPD sometimes returns non-JSON
      return { status: 'not_found', found: false, firmCount: 0, disclosures: 0, details: null };
    }
  } catch (e) {
    return { status: 'error', error: e.message };
  }
}

// --- OFAC SDN List (Treasury Sanctions) ---
async function searchOFAC(fullName) {
  try {
    const url = `https://search.ofac-api.com/v3?name=${encodeURIComponent(fullName)}&minScore=95&sources=sdn`;
    const resp = await fetch(url, {
      headers: { 'Accept': 'application/json', 'User-Agent': EDGAR_USER_AGENT }
    });

    if (!resp.ok) {
      // OFAC API might require API key — fall back to "not checked"
      return { status: 'not_checked', found: false, matches: [], note: 'OFAC API unavailable' };
    }

    const data = await resp.json();
    const matches = data.matches || data.results || [];

    return {
      status: matches.length > 0 ? 'flagged' : 'clear',
      found: matches.length > 0,
      matches: matches.slice(0, 5)
    };
  } catch (e) {
    // Graceful degradation — OFAC check is supplementary
    return { status: 'not_checked', found: false, matches: [], note: e.message };
  }
}

// --- CourtListener (Federal Court Records via RECAP) ---
async function searchCourtListener(fullName) {
  try {
    const url = `https://www.courtlistener.com/api/rest/v4/search/?q=%22${encodeURIComponent(fullName)}%22&type=r&order_by=dateFiled+desc&page_size=10`;
    const resp = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': EDGAR_USER_AGENT
      }
    });

    if (!resp.ok) return { status: 'error', error: `CourtListener: ${resp.status}` };

    const data = await resp.json();
    const results = data.results || [];

    const cases = results.map(r => ({
      caseName: r.caseName || r.case_name || '',
      court: r.court || '',
      dateFiled: r.dateFiled || r.date_filed || '',
      docketNumber: r.docketNumber || r.docket_number || '',
      status: r.status || ''
    }));

    const bankruptcies = cases.filter(c =>
      (c.court || '').toLowerCase().includes('bankr') ||
      (c.caseName || '').toLowerCase().includes('bankrupt')
    ).length;

    return {
      status: cases.length > 0 ? 'needs_review' : 'clear',
      casesCount: cases.length,
      bankruptcies,
      cases
    };
  } catch (e) {
    return { status: 'error', error: e.message };
  }
}

// ============================================================================
// Orchestrator: Run all checks for a person
// ============================================================================

async function runBackgroundCheck(personName, companyName, managementCompanyId) {
  const nameParts = personName.trim().split(/\s+/);
  const firstName = nameParts[0] || '';
  const lastName = nameParts[nameParts.length - 1] || '';
  const fullName = personName.trim();

  // Run all searches in parallel
  const [secPerson, secCompany, finra, iapd, ofac, court] = await Promise.allSettled([
    searchEdgarPerson(firstName, lastName),
    companyName ? searchEdgarCompany(companyName) : Promise.resolve({ status: 'skipped', count: 0, entities: [] }),
    searchFinra(firstName, lastName),
    searchIAPD(firstName, lastName),
    searchOFAC(fullName),
    searchCourtListener(fullName)
  ]);

  const val = (p) => p.status === 'fulfilled' ? p.value : { status: 'error', error: p.reason?.message };

  const secResult = val(secPerson);
  const secCompanyResult = val(secCompany);
  const finraResult = val(finra);
  const iapdResult = val(iapd);
  const ofacResult = val(ofac);
  const courtResult = val(court);

  // Combine SEC results (person + company)
  const allSecEntities = [
    ...(secResult.entities || []),
    ...(secCompanyResult.entities || [])
  ];
  // Deduplicate by CIK
  const seenCiks = new Set();
  const uniqueSecEntities = allSecEntities.filter(e => {
    if (!e.cik || seenCiks.has(e.cik)) return false;
    seenCiks.add(e.cik);
    return true;
  });

  // Build flags array
  const flags = [];

  if (finraResult.disclosures > 0) {
    flags.push({
      source: 'FINRA BrokerCheck',
      severity: finraResult.disclosures >= 3 ? 'high' : 'medium',
      message: `${finraResult.disclosures} disclosure event(s) found`
    });
  }

  if (iapdResult.disclosures > 0) {
    flags.push({
      source: 'SEC IAPD',
      severity: iapdResult.disclosures >= 3 ? 'high' : 'medium',
      message: `${iapdResult.disclosures} disclosure(s) on investment adviser record`
    });
  }

  if (ofacResult.found) {
    flags.push({
      source: 'OFAC SDN',
      severity: 'high',
      message: 'Potential match on Treasury sanctions list — verify identity'
    });
  }

  if (courtResult.bankruptcies > 0) {
    flags.push({
      source: 'Federal Courts',
      severity: 'high',
      message: `${courtResult.bankruptcies} bankruptcy case(s) found`
    });
  }

  if (courtResult.casesCount > 5) {
    flags.push({
      source: 'Federal Courts',
      severity: 'medium',
      message: `${courtResult.casesCount} federal court cases found — review recommended`
    });
  }

  // Determine overall status
  const hasHighFlags = flags.some(f => f.severity === 'high');
  const hasMediumFlags = flags.some(f => f.severity === 'medium');
  const overallStatus = hasHighFlags ? 'flagged' : hasMediumFlags ? 'needs_review' : 'clear';

  // Build summary
  const summaryParts = [];
  summaryParts.push(`SEC EDGAR: ${uniqueSecEntities.length} filing(s) found`);
  summaryParts.push(`FINRA: ${finraResult.found ? (finraResult.disclosures > 0 ? finraResult.disclosures + ' disclosure(s)' : 'registered, no disclosures') : 'not registered'}`);
  summaryParts.push(`IAPD: ${iapdResult.found ? (iapdResult.disclosures > 0 ? iapdResult.disclosures + ' disclosure(s)' : 'registered, clean') : 'not found'}`);
  summaryParts.push(`OFAC: ${ofacResult.status === 'not_checked' ? 'not checked' : (ofacResult.found ? 'POTENTIAL MATCH' : 'clear')}`);
  summaryParts.push(`Federal Courts: ${courtResult.casesCount || 0} case(s)`);

  return {
    personName: fullName,
    companyName: companyName || null,
    managementCompanyId: managementCompanyId || null,
    status: 'completed',
    runAt: new Date().toISOString(),

    secFilingsCount: uniqueSecEntities.length,
    secTotalRaised: secCompanyResult.totalRaised || null,
    secEntities: uniqueSecEntities,
    secStatus: uniqueSecEntities.length > 0 ? 'clear' : 'not_found',

    finraFound: finraResult.found || false,
    finraDisclosures: finraResult.disclosures || 0,
    finraEmployments: finraResult.employments || 0,
    finraDetails: finraResult.details || {},
    finraStatus: finraResult.status || 'not_found',

    iapdFound: iapdResult.found || false,
    iapdFirmCount: iapdResult.firmCount || 0,
    iapdDisclosures: iapdResult.disclosures || 0,
    iapdDetails: iapdResult.details || {},
    iapdStatus: iapdResult.status || 'not_found',

    ofacFound: ofacResult.found || false,
    ofacMatches: ofacResult.matches || [],
    ofacStatus: ofacResult.status || 'not_checked',

    courtCasesCount: courtResult.casesCount || 0,
    courtBankruptcies: courtResult.bankruptcies || 0,
    courtDetails: (courtResult.cases || []).slice(0, 10),
    courtStatus: courtResult.status || 'error',

    overallStatus,
    flags,
    summary: summaryParts.join(' | ')
  };
}

// ============================================================================
// Handlers
// ============================================================================

async function handleRun(req, res) {
  const { personName, companyName, managementCompanyId } = req.body || {};
  if (!personName) return res.status(400).json({ error: 'personName is required' });

  const supabase = getAdminClient();

  // Check for recent cached result (within 7 days)
  const { data: existing } = await supabase
    .from('background_checks')
    .select('*')
    .eq('person_name', personName.trim())
    .eq('status', 'completed')
    .gte('run_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
    .order('run_at', { ascending: false })
    .limit(1);

  if (existing && existing.length > 0) {
    return res.json({ cached: true, result: existing[0] });
  }

  // Run the background check
  const result = await runBackgroundCheck(personName, companyName, managementCompanyId);

  // Store in database
  const row = {
    management_company_id: managementCompanyId || null,
    person_name: result.personName,
    company_name: result.companyName,
    status: result.status,
    run_at: result.runAt,

    sec_filings_count: result.secFilingsCount,
    sec_total_raised: result.secTotalRaised,
    sec_entities: result.secEntities,
    sec_status: result.secStatus,

    finra_found: result.finraFound,
    finra_disclosures: result.finraDisclosures,
    finra_employments: result.finraEmployments,
    finra_details: result.finraDetails,
    finra_status: result.finraStatus,

    iapd_found: result.iapdFound,
    iapd_firm_count: result.iapdFirmCount,
    iapd_disclosures: result.iapdDisclosures,
    iapd_details: result.iapdDetails,
    iapd_status: result.iapdStatus,

    ofac_found: result.ofacFound,
    ofac_matches: result.ofacMatches,
    ofac_status: result.ofacStatus,

    court_cases_count: result.courtCasesCount,
    court_bankruptcies: result.courtBankruptcies,
    court_details: result.courtDetails,
    court_status: result.courtStatus,

    overall_status: result.overallStatus,
    flags: result.flags,
    summary: result.summary
  };

  const { data: saved, error: saveErr } = await supabase
    .from('background_checks')
    .insert(row)
    .select()
    .single();

  if (saveErr) {
    console.error('Error saving background check:', saveErr);
    return res.json({ cached: false, result, saveError: saveErr.message });
  }

  return res.json({ cached: false, result: saved });
}

async function handleGet(req, res) {
  const { managementCompanyId, personName } = req.query;
  const supabase = getAdminClient();

  let query = supabase
    .from('background_checks')
    .select('*')
    .eq('status', 'completed')
    .order('run_at', { ascending: false });

  if (managementCompanyId) {
    query = query.eq('management_company_id', managementCompanyId);
  } else if (personName) {
    query = query.ilike('person_name', `%${personName}%`);
  } else {
    return res.status(400).json({ error: 'managementCompanyId or personName required' });
  }

  const { data, error } = await query.limit(10);
  if (error) throw error;

  return res.json({ results: data || [], count: (data || []).length });
}

// ============================================================================
// Main handler
// ============================================================================

export default async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const action = req.body?.action || req.query?.action;

    if (req.method === 'GET' || action === 'get') {
      return await handleGet(req, res);
    }

    if (req.method === 'POST' && (action === 'run' || !action)) {
      // Require academy tier for running checks
      const userEmail = req.body?.userEmail;
      const userTier = req.body?.userTier;
      if (!userTier || (userTier !== 'academy' && userTier !== 'investor' && userTier !== 'alumni')) {
        return res.status(403).json({
          error: 'Background checks are available to Academy members',
          upgrade: true
        });
      }
      return await handleRun(req, res);
    }

    return res.status(400).json({ error: 'Invalid request' });
  } catch (err) {
    console.error('Background check error:', err);
    return res.status(500).json({ error: err.message });
  }
}
