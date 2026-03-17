// Vercel Serverless Function: /api/users
// Admin-only endpoint to search GHL contacts for user impersonation

const GHL_API_KEY = process.env.GHL_API_KEY;
const GHL_LOCATION_ID = process.env.GHL_LOCATION_ID;

const ADMIN_EMAILS = [
  'pascal@growyourcashflow.com',
  'pascalwagner@gmail.com',
  'pascal.wagner@growyourcashflow.com',
  'pascal@growyourcashflow.io',
  'info@pascalwagner.com'
];

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { q, admin } = req.query;

  // Verify admin
  if (!admin || !ADMIN_EMAILS.includes(admin.toLowerCase())) {
    return res.status(403).json({ error: 'Admin access required' });
  }

  if (!q || q.length < 2) {
    return res.status(400).json({ error: 'Query must be at least 2 characters' });
  }

  try {
    // Try GHL v1 contacts search by query (searches name, email, phone)
    const searchUrl = `https://rest.gohighlevel.com/v1/contacts/?locationId=${GHL_LOCATION_ID}&query=${encodeURIComponent(q)}&limit=20`;
    const resp = await fetch(searchUrl, {
      headers: { Authorization: `Bearer ${GHL_API_KEY}` }
    });

    let contacts = [];

    if (resp.ok) {
      const data = await resp.json();
      contacts = (data.contacts || []).map(c => ({
        id: c.id,
        name: ((c.firstName || '') + ' ' + (c.lastName || '')).trim() || c.email || 'Unknown',
        email: c.email || '',
        phone: c.phone || '',
        tags: c.tags || [],
        tier: c.tags?.includes('academy-member') ? 'academy' : c.tags?.includes('investor-member') ? 'investor' : 'explorer'
      })).filter(c => c.email); // Only return contacts with emails
    } else {
      // Fallback: try lookup by email if the query looks like an email
      if (q.includes('@')) {
        const lookupUrl = `https://rest.gohighlevel.com/v1/contacts/lookup?email=${encodeURIComponent(q)}`;
        const lookupResp = await fetch(lookupUrl, {
          headers: { Authorization: `Bearer ${GHL_API_KEY}` }
        });
        if (lookupResp.ok) {
          const lookupData = await lookupResp.json();
          contacts = (lookupData.contacts || []).map(c => ({
            id: c.id,
            name: ((c.firstName || '') + ' ' + (c.lastName || '')).trim() || c.email,
            email: c.email || '',
            phone: c.phone || '',
            tags: c.tags || [],
            tier: c.tags?.includes('academy-member') ? 'academy' : c.tags?.includes('investor-member') ? 'investor' : 'explorer'
          }));
        }
      }
    }

    return res.status(200).json({ success: true, contacts, debug: { url: searchUrl, status: resp.status } });
  } catch (error) {
    console.error('User search error:', error);
    return res.status(500).json({ error: 'Failed to search users: ' + error.message });
  }
}
