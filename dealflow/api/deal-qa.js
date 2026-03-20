// Vercel Serverless Function: /api/deal-qa
// Per-deal Q&A system — investors submit questions, Pascal answers
// GET: fetch Q&A for a deal
// POST: submit a question or answer

const AIRTABLE_BASE_ID = 'appKfcBhhpFJZ28is';
const TABLE_NAME = 'Deal Q&A';

async function fetchRecords(pat, filterFormula) {
  const records = [];
  let offset = null;
  do {
    const url = new URL(`https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(TABLE_NAME)}`);
    url.searchParams.set('pageSize', '100');
    if (filterFormula) url.searchParams.set('filterByFormula', filterFormula);
    url.searchParams.set('sort[0][field]', 'Created At');
    url.searchParams.set('sort[0][direction]', 'desc');
    if (offset) url.searchParams.set('offset', offset);

    const response = await fetch(url.toString(), {
      headers: { 'Authorization': `Bearer ${pat}` }
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Airtable error ${response.status}: ${errText}`);
    }

    const data = await response.json();
    records.push(...(data.records || []));
    offset = data.offset || null;
  } while (offset);

  return records;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const pat = process.env.AIRTABLE_PAT;
  if (!pat) return res.status(500).json({ error: 'AIRTABLE_PAT not set' });

  // GET: Fetch Q&A for a deal
  if (req.method === 'GET') {
    const dealId = req.query.dealId;
    if (!dealId) return res.status(400).json({ error: 'dealId required' });

    try {
      const formula = `{Deal ID}='${dealId.replace(/'/g, "\\'")}'`;
      const records = await fetchRecords(pat, formula);

      const questions = records.map(r => {
        const f = r.fields || {};
        return {
          id: r.id,
          question: f['Question'] || '',
          askedBy: f['Asked By Name'] || 'Anonymous',
          askedAt: f['Created At'] || '',
          answer: f['Answer'] || null,
          answeredBy: f['Answered By'] || null,
          answeredAt: f['Answered At'] || null,
          upvotes: parseInt(f['Upvotes'] || '0'),
          status: f['Status'] || 'pending'
        };
      });

      // Sort: answered first (most recent), then pending
      questions.sort((a, b) => {
        if (a.answer && !b.answer) return -1;
        if (!a.answer && b.answer) return 1;
        return 0;
      });

      res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=120');
      return res.status(200).json({ questions, count: questions.length });
    } catch (err) {
      console.error('Deal Q&A fetch error:', err);
      return res.status(500).json({ error: 'Failed to fetch Q&A' });
    }
  }

  // POST: Submit a question or answer
  if (req.method === 'POST') {
    const { dealId, dealName, question, answer, recordId, userEmail, userName, action } = req.body || {};

    // Submit a new question
    if (action === 'ask') {
      if (!dealId || !question) {
        return res.status(400).json({ error: 'dealId and question required' });
      }

      try {
        const resp = await fetch(`https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(TABLE_NAME)}`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${pat}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            records: [{
              fields: {
                'Deal ID': dealId,
                'Deal Name': dealName || '',
                'Question': question,
                'Asked By Email': userEmail || '',
                'Asked By Name': userName || 'Anonymous',
                'Created At': new Date().toISOString(),
                'Status': 'pending',
                'Upvotes': '0'
              }
            }]
          })
        });

        if (!resp.ok) throw new Error('Airtable create failed: ' + await resp.text());
        const data = await resp.json();

        // Note: Email notifications intentionally disabled.
        // Q&A questions are stored in Airtable — review there.

        return res.status(200).json({ success: true, recordId: data.records[0].id });
      } catch (err) {
        console.error('Q&A submit error:', err);
        return res.status(500).json({ error: 'Failed to submit question' });
      }
    }

    // Submit an answer (admin only)
    if (action === 'answer') {
      if (!recordId || !answer) {
        return res.status(400).json({ error: 'recordId and answer required' });
      }

      try {
        const resp = await fetch(`https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(TABLE_NAME)}`, {
          method: 'PATCH',
          headers: {
            'Authorization': `Bearer ${pat}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            records: [{
              id: recordId,
              fields: {
                'Answer': answer,
                'Answered By': userName || 'Pascal',
                'Answered At': new Date().toISOString(),
                'Status': 'answered'
              }
            }]
          })
        });

        if (!resp.ok) throw new Error('Airtable update failed: ' + await resp.text());
        return res.status(200).json({ success: true });
      } catch (err) {
        console.error('Q&A answer error:', err);
        return res.status(500).json({ error: 'Failed to submit answer' });
      }
    }

    // Upvote a question
    if (action === 'upvote') {
      if (!recordId) return res.status(400).json({ error: 'recordId required' });

      try {
        // Fetch current upvote count
        const getResp = await fetch(`https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(TABLE_NAME)}/${recordId}`, {
          headers: { 'Authorization': `Bearer ${pat}` }
        });
        if (!getResp.ok) throw new Error('Fetch failed');
        const current = await getResp.json();
        const currentVotes = parseInt((current.fields || {})['Upvotes'] || '0');

        const resp = await fetch(`https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(TABLE_NAME)}`, {
          method: 'PATCH',
          headers: {
            'Authorization': `Bearer ${pat}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            records: [{
              id: recordId,
              fields: { 'Upvotes': String(currentVotes + 1) }
            }]
          })
        });

        if (!resp.ok) throw new Error('Upvote failed');
        return res.status(200).json({ success: true, upvotes: currentVotes + 1 });
      } catch (err) {
        return res.status(500).json({ error: 'Failed to upvote' });
      }
    }

    return res.status(400).json({ error: 'Invalid action. Use: ask, answer, upvote' });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
