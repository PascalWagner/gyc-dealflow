// One-time utility: Add share class fields to Opportunities table + create Deck Submissions table
// DELETE THIS FILE AFTER USE
//
// Run by hitting: GET /api/add-share-class-fields?step=1 (add fields)
//                 GET /api/add-share-class-fields?step=2 (create deck submissions table)

const AIRTABLE_BASE_ID = 'appKfcBhhpFJZ28is';
const OPPORTUNITIES_TABLE_ID = 'tblXFNpOvL0Ub5tVt';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  const pat = process.env.AIRTABLE_PAT;
  if (!pat) {
    return res.status(500).json({ error: 'AIRTABLE_PAT not set' });
  }

  const step = req.query.step || '1';
  const results = [];

  try {
    if (step === '1' || step === 'all') {
      // Step 1a: Add "Share Class Label" field to Opportunities
      const labelResp = await fetch(
        `https://api.airtable.com/v0/meta/bases/${AIRTABLE_BASE_ID}/tables/${OPPORTUNITIES_TABLE_ID}/fields`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${pat}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            name: 'Share Class Label',
            type: 'singleLineText',
            description: 'Share class identifier (e.g. Class A, Class B, Class C). Used to group multiple classes under one parent deal.'
          })
        }
      );
      const labelData = await labelResp.json();
      results.push({ step: '1a-share-class-label', ok: labelResp.ok, data: labelData });

      // Step 1b: Add "Parent Deal" self-referential link field
      // Note: Airtable Metadata API requires the linked table ID for link fields
      const linkResp = await fetch(
        `https://api.airtable.com/v0/meta/bases/${AIRTABLE_BASE_ID}/tables/${OPPORTUNITIES_TABLE_ID}/fields`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${pat}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            name: 'Parent Deal',
            type: 'multipleRecordLinks',
            description: 'Links share class records to their parent fund record. Leave empty for parent/standalone deals.',
            options: {
              linkedTableId: OPPORTUNITIES_TABLE_ID,
              prefersSingleRecordLink: true
            }
          })
        }
      );
      const linkData = await linkResp.json();
      results.push({ step: '1b-parent-deal-link', ok: linkResp.ok, data: linkData });
    }

    if (step === '2' || step === 'all') {
      // Step 2: Create Deck Submissions table
      const tableResp = await fetch(
        `https://api.airtable.com/v0/meta/bases/${AIRTABLE_BASE_ID}/tables`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${pat}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            name: 'Deck Submissions',
            description: 'User-submitted deck/offering document links for review',
            fields: [
              { name: 'Deal Name', type: 'singleLineText', description: 'Name of the deal this deck is for' },
              { name: 'Deal ID', type: 'singleLineText', description: 'Airtable record ID of the deal' },
              { name: 'Submitted URL', type: 'url', description: 'URL to the deck/offering document' },
              { name: 'Notes', type: 'multilineText', description: 'Optional notes from the submitter' },
              { name: 'Submitted By Email', type: 'email', description: 'Email of the user who submitted' },
              { name: 'Submitted By Name', type: 'singleLineText', description: 'Name of the user who submitted' },
              { name: 'Status', type: 'singleSelect', description: 'Review status', options: {
                choices: [
                  { name: 'Pending', color: 'yellowBright' },
                  { name: 'Approved', color: 'greenBright' },
                  { name: 'Rejected', color: 'redBright' }
                ]
              }},
              { name: 'Submitted At', type: 'dateTime', description: 'When the submission was made', options: {
                timeZone: 'America/New_York',
                dateFormat: { name: 'us' },
                timeFormat: { name: '12hour' }
              }}
            ]
          })
        }
      );
      const tableData = await tableResp.json();
      results.push({
        step: '2-deck-submissions-table',
        ok: tableResp.ok,
        data: tableData,
        note: tableResp.ok ? 'Save this table ID in your DECK_SUBMISSIONS_TABLE_ID env var: ' + (tableData.id || '') : 'Failed'
      });
    }

    return res.status(200).json({ success: true, results });
  } catch (error) {
    return res.status(500).json({ error: error.message, results });
  }
}
