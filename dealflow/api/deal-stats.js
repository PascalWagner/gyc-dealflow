// Vercel Serverless Function: /api/deal-stats
// Returns aggregated stage counts for a specific deal across all users

const AIRTABLE_BASE_ID = 'appKfcBhhpFJZ28is';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const dealId = req.query.dealId;
  if (!dealId) {
    return res.status(400).json({ error: 'dealId is required' });
  }

  const pat = process.env.AIRTABLE_PAT;
  if (!pat) {
    return res.status(500).json({ error: 'AIRTABLE_PAT not set' });
  }

  try {
    const filterFormula = `{Deal ID} = "${dealId}"`;
    const url = new URL(`https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent('User Deal Stages')}`);
    url.searchParams.set('pageSize', '100');
    url.searchParams.set('filterByFormula', filterFormula);
    url.searchParams.set('fields[]', 'Stage');

    const records = [];
    let offset = null;

    do {
      if (offset) url.searchParams.set('offset', offset);

      const response = await fetch(url.toString(), {
        headers: {
          'Authorization': `Bearer ${pat}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Airtable error ${response.status}: ${errText}`);
      }

      const data = await response.json();
      records.push(...(data.records || []));
      offset = data.offset || null;
    } while (offset);

    // Count stages
    const counts = { interested: 0, duediligence: 0, portfolio: 0 };
    for (const rec of records) {
      const stage = (rec.fields || {}).Stage || '';
      if (stage === 'interested') counts.interested++;
      else if (stage === 'duediligence') counts.duediligence++;
      else if (stage === 'portfolio') counts.portfolio++;
    }

    return res.status(200).json(counts);
  } catch (err) {
    console.error('Deal stats error:', err);
    return res.status(500).json({ error: 'Failed to fetch deal stats' });
  }
}
