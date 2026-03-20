// Vercel Serverless Function: /api/deal-stats-bulk
// Returns aggregated stage counts for ALL deals in one call
// Used for social proof counters on deal cards

const AIRTABLE_BASE_ID = 'appKfcBhhpFJZ28is';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const pat = process.env.AIRTABLE_PAT;
  if (!pat) {
    return res.status(500).json({ error: 'AIRTABLE_PAT not set' });
  }

  try {
    // Fetch ALL User Deal Stages records (paginated)
    const records = [];
    let offset = null;

    do {
      const url = new URL(`https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent('User Deal Stages')}`);
      url.searchParams.set('pageSize', '100');
      url.searchParams.append('fields[]', 'Deal ID');
      url.searchParams.append('fields[]', 'Stage');
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

    // Aggregate counts per deal
    // Stage names: saved, vetting, ready, invested, passed
    // Also handle legacy names: interested→saved, duediligence→vetting, portfolio→invested
    const STAGE_MAP = {
      'interested': 'saved',
      'duediligence': 'vetting',
      'portfolio': 'invested'
    };

    const dealStats = {};

    for (const rec of records) {
      const f = rec.fields || {};
      const dealId = f['Deal ID'];
      if (!dealId) continue;

      let stage = (f['Stage'] || '').toLowerCase();
      stage = STAGE_MAP[stage] || stage;

      if (!dealStats[dealId]) {
        dealStats[dealId] = { saved: 0, vetting: 0, ready: 0, invested: 0 };
      }

      if (stage === 'saved') dealStats[dealId].saved++;
      else if (stage === 'vetting') dealStats[dealId].vetting++;
      else if (stage === 'ready') dealStats[dealId].ready++;
      else if (stage === 'invested') dealStats[dealId].invested++;
    }

    return res.status(200).json({
      stats: dealStats,
      totalRecords: records.length,
      fetchedAt: new Date().toISOString()
    });
  } catch (err) {
    console.error('Bulk deal stats error:', err);
    return res.status(500).json({ error: 'Failed to fetch deal stats' });
  }
}
