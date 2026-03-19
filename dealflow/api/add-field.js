// One-time admin utility: Create DD Checklist table + update Kathleen
// DELETE THIS FILE AFTER USE

const AIRTABLE_BASE_ID = 'appKfcBhhpFJZ28is';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  const pat = process.env.AIRTABLE_PAT;
  const ghlKey = process.env.GHL_API_KEY;
  const results = {};

  // Task 1: Create DD Checklist table in Airtable
  try {
    const response = await fetch(
      `https://api.airtable.com/v0/meta/bases/${AIRTABLE_BASE_ID}/tables`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${pat}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: 'DD Checklist',
          description: 'Community-contributed due diligence checklist. Each row is one checked item on one deal.',
          fields: [
            { name: 'Deal ID', type: 'singleLineText', description: 'Airtable record ID of the Opportunity' },
            { name: 'Item Index', type: 'number', options: { precision: 0 }, description: 'Index of the checklist item (0-based)' },
            { name: 'Item Text', type: 'singleLineText', description: 'Text of the checklist item' },
            { name: 'Checked By Email', type: 'email', description: 'Email of the user who checked this item' },
            { name: 'Checked By Name', type: 'singleLineText', description: 'Name of the user who checked this item' },
            { name: 'Checked At', type: 'dateTime', options: { timeZone: 'utc', dateFormat: { name: 'iso' }, timeFormat: { name: '24hour' } }, description: 'When the item was checked' }
          ]
        })
      }
    );
    const data = await response.json();
    results.ddTable = response.ok ? { success: true, tableId: data.id, name: data.name } : { error: data };
  } catch (e) {
    results.ddTable = { error: e.message };
  }

  // Task 2: Update Kathleen Marcell — add dealflow-academy tag + set dates
  if (ghlKey) {
    try {
      const contactId = 'l1hnlhnXzEKmyiwG9hb7';
      const response = await fetch(`https://rest.gohighlevel.com/v1/contacts/${contactId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${ghlKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          tags: ['subscriber', 'booked intro call', 'bought cashflow academy', 'hot & engaged lead', 'dealflow-academy'],
          customField: {
            'cashflow_academy_start_date': '2025-01-26',
            'cashflow_academy_expiry_date': '2026-12-31'
          }
        })
      });
      const data = await response.json();
      results.kathleen = response.ok ? { success: true } : { error: data, status: response.status };
    } catch (e) {
      results.kathleen = { error: e.message };
    }
  } else {
    results.kathleen = { error: 'GHL_API_KEY not set' };
  }

  return res.status(200).json(results);
}
