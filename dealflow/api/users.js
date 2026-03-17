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
    // Search GHL contacts by name or email
    const searchUrl = `https://rest.gohighlevel.com/v1/contacts/?locationId=${GHL_LOCATION_ID}&query=${encodeURIComponent(q)}&limit=20`;
    const resp = await fetch(searchUrl, {
      headers: { Authorization: `Bearer ${GHL_API_KEY}` }
    });

    if (!resp.ok) {
      throw new Error('GHL search failed: ' + resp.status);
    }

    const data = await resp.json();
    const contacts = (data.contacts || []).map(c => ({
      id: c.id,
      name: ((c.firstName || '') + ' ' + (c.lastName || '')).trim() || c.email,
      email: c.email,
      tags: c.tags || [],
      tier: c.tags?.includes('academy-member') ? 'academy' : c.tags?.includes('investor-member') ? 'investor' : 'explorer'
    }));

    return res.status(200).json({ success: true, contacts });
  } catch (error) {
    console.error('User search error:', error);
    return res.status(500).json({ error: 'Failed to search users' });
  }
}
