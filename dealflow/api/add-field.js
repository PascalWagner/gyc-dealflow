// One-time utility: Add "Property Address" field to Opportunities table
// DELETE THIS FILE AFTER USE

const AIRTABLE_BASE_ID = 'appKfcBhhpFJZ28is';
const TABLE_ID = 'tblXFNpOvL0Ub5tVt';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  const pat = process.env.AIRTABLE_PAT;
  if (!pat) {
    return res.status(500).json({ error: 'AIRTABLE_PAT not set' });
  }

  try {
    const response = await fetch(
      `https://api.airtable.com/v0/meta/bases/${AIRTABLE_BASE_ID}/tables/${TABLE_ID}/fields`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${pat}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: 'Property Address',
          type: 'singleLineText',
          description: 'Full street address for RentCast enrichment and map display'
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        error: 'Airtable API error',
        status: response.status,
        details: data
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Property Address field created successfully',
      field: data
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
