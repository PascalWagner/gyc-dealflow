// Vercel Serverless Function: Fetch all deals from Airtable
// Fetches Opportunities, Management Companies, and People tables
// Resolves linked records (Management Company IDs → names, CEO names)

const AIRTABLE_BASE_ID = 'appKfcBhhpFJZ28is';
const TABLES = {
  opportunities: 'tblXFNpOvL0Ub5tVt',
  managementCompanies: 'tblRczR8Eok31ZhJj',
  people: 'People'  // Use table name (works with Airtable API)
};

// Generic paginated fetch for any Airtable table
async function fetchAllRecords(tableId, pat, fields = null) {
  const records = [];
  let offset = null;

  do {
    const url = new URL(`https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${tableId}`);
    url.searchParams.set('pageSize', '100');
    if (offset) url.searchParams.set('offset', offset);
    if (fields) {
      fields.forEach(f => url.searchParams.append('fields[]', f));
    }

    const response = await fetch(url.toString(), {
      headers: {
        'Authorization': `Bearer ${pat}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error(`Airtable API error for ${tableId}:`, response.status, errText);
      throw new Error(`Airtable API error ${response.status}: ${errText}`);
    }

    const data = await response.json();
    records.push(...(data.records || []));
    offset = data.offset || null;
  } while (offset);

  return records;
}

// Build lookup map: record ID → fields object
function buildLookup(records) {
  const map = {};
  for (const rec of records) {
    map[rec.id] = rec.fields || {};
  }
  return map;
}

function transformRecord(rec, mcLookup, peopleLookup) {
  const f = rec.fields || {};

  // Resolve Management Company linked record
  let managementCompany = '';
  let ceo = '';
  let mcWebsite = '';
  let mcFoundingYear = null;
  let mcType = '';
  let mcLinkedin = '';
  let mcInvestClearly = '';
  let mcTotalInvestors = null;

  const mcIds = f['Management Company'];
  if (Array.isArray(mcIds) && mcIds.length > 0) {
    const mc = mcLookup[mcIds[0]];
    if (mc) {
      managementCompany = mc['Operator Name'] || '';
      ceo = mc['CEO'] || '';
      mcWebsite = mc['Website'] || '';
      mcFoundingYear = mc['Founding Year'] || null;
      mcType = Array.isArray(mc['Type']) ? mc['Type'][0] : (mc['Type'] || '');
      mcLinkedin = mc['Linkedin of CEO'] || '';
      mcInvestClearly = mc['InvestClearly Profile'] || '';
      mcTotalInvestors = mc['Total Investors @ Firm'] || null;
    }
  }

  // Fallback: try lookup fields that Airtable may provide
  if (!managementCompany) {
    managementCompany = Array.isArray(f['Name (from Management Company)'])
      ? f['Name (from Management Company)'][0]
      : (f['Name (from Management Company)'] || '');
  }
  if (!ceo) {
    ceo = Array.isArray(f['CEO (from Management Company)'])
      ? f['CEO (from Management Company)'][0]
      : (f['CEO (from Management Company)'] || '');
  }

  return {
    id: rec.id || '',
    dealNumber: f['Deal #'] || 0,
    investmentName: f['Investment Name / Address'] || '',
    assetClass: Array.isArray(f['Asset Class']) ? f['Asset Class'][0] : (f['Asset Class'] || ''),
    dealType: f['Deal Type'] || '',
    targetIRR: f['Target IRR'] || null,
    equityMultiple: f['Equity Multiple'] || null,
    preferredReturn: f['Preferred Return'] || f['Class A - Pref'] || null,
    investmentMinimum: f['Investment Minimum'] || f['Class A - Min Investment'] || 0,
    lpGpSplit: f['Class A - LP/GP Split'] || '',
    holdPeriod: f['Min Hold Period (Yrs)'] || null,
    addedDate: f['Added Date'] || '',
    status: f['Status'] || '',
    offeringType: f['Offering Type'] || '',
    offeringSize: f['Offering Size'] || null,
    investingGeography: f['Investing Geography'] || '',
    investmentStrategy: f['Investment Strategy'] || '',
    distributions: Array.isArray(f['Distributions']) ? f['Distributions'][0] : (f['Distributions'] || ''),
    financials: f['Financials'] || '',
    availableTo: Array.isArray(f['Available To']) ? f['Available To'][0] : (f['Available To'] || ''),
    investmentObjective: Array.isArray(f['Investment Objective']) ? f['Investment Objective'][0] : (f['Investment Objective'] || ''),
    sponsorInDeal: f['% Sponsor In The Deal'] || null,
    ceo,
    managementCompany,
    managementCompanyId: Array.isArray(mcIds) ? mcIds[0] : '',
    mcWebsite,
    mcFoundingYear,
    mcType,
    mcLinkedin,
    mcInvestClearly,
    mcTotalInvestors,
    fees: f['Fees'] || [],
    firstYrDepreciation: f['1st Yr Depreciation'] || '',
    strategy: f['Strategy'] || '',
    instrument: f['Instrument'] || '',
    cashOnCash: f['Cash on Cash Return'] || null,
    debtPosition: f['Debt Position'] || '',
    fundAUM: f['Fund AUM'] || null,
    loanCount: f['Loan Count'] || null,
    avgLoanLTV: f['Avg Loan LTV'] || null,
    location: f['Location'] || ''
  };
}

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const pat = process.env.AIRTABLE_PAT;
  if (!pat) {
    return res.status(500).json({ error: 'AIRTABLE_PAT environment variable not set' });
  }

  try {
    // Fetch all three tables in parallel
    const [opportunityRecords, mcRecords, peopleRecords] = await Promise.all([
      fetchAllRecords(TABLES.opportunities, pat),
      fetchAllRecords(TABLES.managementCompanies, pat),
      fetchAllRecords(TABLES.people, pat, ['Full Name', 'First Name', 'Last Name', 'Email'])
    ]);

    console.log(`Fetched: ${opportunityRecords.length} opportunities, ${mcRecords.length} management companies, ${peopleRecords.length} people`);

    // Build lookup maps
    const mcLookup = buildLookup(mcRecords);
    const peopleLookup = buildLookup(peopleRecords);

    // Transform all opportunity records with resolved linked data
    const deals = opportunityRecords
      .map(rec => transformRecord(rec, mcLookup, peopleLookup))
      .filter(d => d.investmentName);

    // Also return management companies and people as separate arrays
    const managementCompanies = mcRecords.map(rec => {
      const f = rec.fields || {};
      return {
        id: rec.id,
        name: f['Operator Name'] || '',
        ceo: f['CEO'] || '',
        website: f['Website'] || '',
        linkedin: f['Linkedin of CEO'] || '',
        foundingYear: f['Founding Year'] || null,
        assetClasses: [...new Set(f['Asset Classes'] || [])],
        type: Array.isArray(f['Type']) ? f['Type'][0] : (f['Type'] || ''),
        dealIds: f['Deal IDs'] || [],
        investClearlyProfile: f['InvestClearly Profile'] || '',
        totalInvestors: f['Total Investors @ Firm'] || null,
        lastUpdated: f['Last Updated'] || ''
      };
    });

    const people = peopleRecords.map(rec => {
      const f = rec.fields || {};
      return {
        id: rec.id,
        fullName: f['Full Name'] || '',
        firstName: f['First Name'] || '',
        lastName: f['Last Name'] || '',
        email: f['Email'] || ''
      };
    });

    console.log(`Returning ${deals.length} deals, ${managementCompanies.length} companies, ${people.length} people`);

    return res.status(200).json({
      deals,
      managementCompanies,
      people,
      meta: {
        totalOpportunities: opportunityRecords.length,
        totalCompanies: mcRecords.length,
        totalPeople: peopleRecords.length,
        fetchedAt: new Date().toISOString()
      }
    });
  } catch (err) {
    console.error('Error fetching from Airtable:', err);
    return res.status(500).json({ error: 'Failed to fetch deals', message: err.message });
  }
}
