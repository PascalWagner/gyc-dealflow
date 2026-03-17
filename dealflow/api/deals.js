// Vercel Serverless Function: Fetch all deals from Airtable
// Paginates through all records and transforms them to dashboard format

const AIRTABLE_BASE_ID = 'appKfcBhhpFJZ28is';
const AIRTABLE_TABLE_ID = 'tblXFNpOvL0Ub5tVt';

function transformRecord(rec) {
  const f = rec.fields || {};
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
    ceo: Array.isArray(f['CEO (from Management Company)']) ? f['CEO (from Management Company)'][0] : (f['CEO (from Management Company)'] || ''),
    managementCompany: Array.isArray(f['Name (from Management Company)']) ? f['Name (from Management Company)'][0] : (f['Name (from Management Company)'] || ''),
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
  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600'); // Cache 5 min

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const pat = process.env.AIRTABLE_PAT;
  if (!pat) {
    return res.status(500).json({ error: 'AIRTABLE_PAT environment variable not set' });
  }

  try {
    let allRecords = [];
    let offset = null;

    // Paginate through all Airtable records
    do {
      const url = new URL(`https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${AIRTABLE_TABLE_ID}`);
      url.searchParams.set('pageSize', '100');
      if (offset) url.searchParams.set('offset', offset);

      const response = await fetch(url.toString(), {
        headers: {
          'Authorization': `Bearer ${pat}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const errText = await response.text();
        console.error('Airtable API error:', response.status, errText);
        return res.status(response.status).json({ error: 'Airtable API error', status: response.status });
      }

      const data = await response.json();
      allRecords = allRecords.concat(data.records || []);
      offset = data.offset || null;
    } while (offset);

    // Transform all records
    const deals = allRecords
      .map(transformRecord)
      .filter(d => d.investmentName);

    console.log(`Fetched ${allRecords.length} records, ${deals.length} valid deals`);
    return res.status(200).json(deals);
  } catch (err) {
    console.error('Error fetching from Airtable:', err);
    return res.status(500).json({ error: 'Failed to fetch deals', message: err.message });
  }
}
