// Vercel Serverless Function: /api/users
// Admin-only endpoint to search GHL contacts for user impersonation

import { ADMIN_EMAILS, setCors, deriveTier } from './_supabase.js';

const GHL_API_KEY = process.env.GHL_API_KEY;
const GHL_LOCATION_ID = process.env.GHL_LOCATION_ID;

export default async function handler(req, res) {
  setCors(res);
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
    let contacts = [];

    function mapContacts(arr) {
      return (arr || []).map(c => ({
        id: c.id,
        name: ((c.firstName || '') + ' ' + (c.lastName || '')).trim() || c.email || 'Unknown',
        firstName: c.firstName || '',
        lastName: c.lastName || '',
        email: c.email || '',
        phone: c.phone || '',
        linkedin: c.customFields?.find(f => f.id === 'linkedin_url')?.value || c.linkedin || '',
        tags: c.tags || [],
        tier: deriveTier(c.tags || [])
      })).filter(c => c.email);
    }

    // Method 1: GHL v1 contacts search by query
    const searchUrl = `https://rest.gohighlevel.com/v1/contacts/?query=${encodeURIComponent(q)}&limit=20`;
    const resp = await fetch(searchUrl, {
      headers: { Authorization: `Bearer ${GHL_API_KEY}` }
    });
    let debugInfo = { method1_url: searchUrl, method1_status: resp.status };

    if (resp.ok) {
      const data = await resp.json();
      contacts = mapContacts(data.contacts);
      debugInfo.method1_count = contacts.length;
    }

    // Method 2: If no results, try with locationId param
    if (contacts.length === 0 && GHL_LOCATION_ID) {
      const url2 = `https://rest.gohighlevel.com/v1/contacts/?locationId=${GHL_LOCATION_ID}&query=${encodeURIComponent(q)}&limit=20`;
      const resp2 = await fetch(url2, { headers: { Authorization: `Bearer ${GHL_API_KEY}` } });
      debugInfo.method2_status = resp2.status;
      if (resp2.ok) {
        const data2 = await resp2.json();
        contacts = mapContacts(data2.contacts);
        debugInfo.method2_count = contacts.length;
      }
    }

    // Method 3: If still no results and query looks like email, try lookup
    if (contacts.length === 0 && q.includes('@')) {
      const lookupUrl = `https://rest.gohighlevel.com/v1/contacts/lookup?email=${encodeURIComponent(q)}`;
      const lookupResp = await fetch(lookupUrl, { headers: { Authorization: `Bearer ${GHL_API_KEY}` } });
      if (lookupResp.ok) {
        const lookupData = await lookupResp.json();
        contacts = mapContacts(lookupData.contacts);
        debugInfo.method3_count = contacts.length;
      }
    }

    return res.status(200).json({ success: true, contacts, debug: debugInfo });
  } catch (error) {
    console.error('User search error:', error);
    return res.status(500).json({ error: 'Failed to search users: ' + error.message });
  }
}
