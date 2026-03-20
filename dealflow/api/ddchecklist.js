// Vercel Serverless Function: Shared DD Checklist per deal
// Each checked item is a row in the "DD Checklist" Airtable table
// This is SHARED data — any user's check is visible to all users

const AIRTABLE_BASE_ID = 'appKfcBhhpFJZ28is';
const AIRTABLE_API = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}`;
const DD_TABLE = 'DD Checklist';

function escapeFormula(str) {
  return (str || '').replace(/'/g, "\\'");
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const pat = process.env.AIRTABLE_PAT;
  if (!pat) return res.status(500).json({ error: 'AIRTABLE_PAT not set' });

  // GET: Fetch all DD checklist items for a deal
  if (req.method === 'GET') {
    const { dealId } = req.query;
    if (!dealId) return res.status(400).json({ error: 'dealId is required' });

    try {
      const formula = `{Deal ID}='${escapeFormula(dealId)}'`;
      const url = new URL(`${AIRTABLE_API}/${encodeURIComponent(DD_TABLE)}`);
      url.searchParams.set('filterByFormula', formula);

      const resp = await fetch(url.toString(), {
        headers: { 'Authorization': `Bearer ${pat}` }
      });
      if (!resp.ok) {
        const errText = await resp.text();
        return res.status(resp.status).json({ error: 'Failed to fetch: ' + errText });
      }

      const data = await resp.json();
      // Convert rows to checklist object: { "0": { checked, by, name, at }, ... }
      const checklist = {};
      for (const rec of (data.records || [])) {
        const f = rec.fields;
        const idx = String(f['Item Index']);
        checklist[idx] = {
          checked: true,
          by: f['Checked By Email'] || '',
          name: f['Checked By Name'] || '',
          at: f['Checked At'] || '',
          answer: f['Answer'] || '',
          source: f['Source'] || '',
          recordId: rec.id
        };
      }

      return res.status(200).json({ success: true, dealId, checklist });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  // POST: Check or uncheck a checklist item
  if (req.method === 'POST') {
    const { dealId, itemIndex, itemText, checked, userEmail, userName, answer, source } = req.body || {};
    if (!dealId || itemIndex === undefined) {
      return res.status(400).json({ error: 'dealId and itemIndex are required' });
    }

    try {
      if (checked) {
        // Check: find existing row or create new one
        const formula = `AND({Deal ID}='${escapeFormula(dealId)}',{Item Index}='${escapeFormula(String(itemIndex))}')`;
        const searchUrl = new URL(`${AIRTABLE_API}/${encodeURIComponent(DD_TABLE)}`);
        searchUrl.searchParams.set('filterByFormula', formula);

        const searchResp = await fetch(searchUrl.toString(), {
          headers: { 'Authorization': `Bearer ${pat}` }
        });
        const searchData = await searchResp.json();
        const existing = (searchData.records || [])[0];

        if (existing) {
          // Update existing record
          await fetch(`${AIRTABLE_API}/${encodeURIComponent(DD_TABLE)}`, {
            method: 'PATCH',
            headers: { 'Authorization': `Bearer ${pat}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              records: [{
                id: existing.id,
                fields: {
                  'Checked By Email': userEmail || '',
                  'Checked By Name': userName || '',
                  'Checked At': new Date().toISOString(),
                  'Answer': answer || '',
                  'Source': source || 'user'
                }
              }]
            })
          });
        } else {
          // Create new record
          await fetch(`${AIRTABLE_API}/${encodeURIComponent(DD_TABLE)}`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${pat}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              records: [{
                fields: {
                  'Deal ID': dealId,
                  'Item Index': itemIndex,
                  'Item Text': itemText || '',
                  'Checked By Email': userEmail || '',
                  'Checked By Name': userName || '',
                  'Checked At': new Date().toISOString(),
                  'Answer': answer || '',
                  'Source': source || 'user'
                }
              }]
            })
          });
        }
      } else {
        // Uncheck: delete the row
        const formula = `AND({Deal ID}='${escapeFormula(dealId)}',{Item Index}='${escapeFormula(String(itemIndex))}')`;
        const searchUrl = new URL(`${AIRTABLE_API}/${encodeURIComponent(DD_TABLE)}`);
        searchUrl.searchParams.set('filterByFormula', formula);

        const searchResp = await fetch(searchUrl.toString(), {
          headers: { 'Authorization': `Bearer ${pat}` }
        });
        const searchData = await searchResp.json();
        const existing = (searchData.records || [])[0];

        if (existing) {
          const delUrl = new URL(`${AIRTABLE_API}/${encodeURIComponent(DD_TABLE)}`);
          delUrl.searchParams.set('records[]', existing.id);
          await fetch(delUrl.toString(), {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${pat}` }
          });
        }
      }

      return res.status(200).json({ success: true, dealId, itemIndex, checked });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
