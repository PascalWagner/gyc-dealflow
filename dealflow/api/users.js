// Vercel Serverless Function: /api/users
// Admin-only endpoint to search users for impersonation
// Searches GHL first, then falls back to Supabase user_profiles

import { ADMIN_EMAILS, setCors, deriveTier, getAdminClient } from './_supabase.js';

const GHL_API_KEY = process.env.GHL_API_KEY;
const GHL_LOCATION_ID = process.env.GHL_LOCATION_ID;

export default async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { q, admin } = req.query;
  const normalizedQuery = String(q || '').trim().toLowerCase();

  // Verify admin
  if (!admin || !ADMIN_EMAILS.includes(admin.toLowerCase())) {
    return res.status(403).json({ error: 'Admin access required' });
  }

  if (!normalizedQuery || normalizedQuery.length < 2) {
    return res.status(400).json({ error: 'Query must be at least 2 characters' });
  }

  try {
    let contacts = [];

    function matchesQuery(contact) {
      const haystack = [
        contact?.firstName,
        contact?.lastName,
        contact?.name,
        contact?.email,
        contact?.phone,
        contact?.linkedin,
        ...(Array.isArray(contact?.tags) ? contact.tags : [])
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(normalizedQuery);
    }

    function dedupeContacts(arr) {
      const seen = new Set();
      return (arr || []).filter((contact) => {
        const key = `${String(contact?.email || '').toLowerCase()}::${contact?.id || ''}`;
        if (!contact?.email || seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    }

    function mapContacts(arr) {
      return (arr || []).map(c => ({
        id: c.id,
        name: ((c.firstName || '') + ' ' + (c.lastName || '')).trim() || c.email || 'Unknown',
        firstName: c.firstName || '',
        lastName: c.lastName || '',
        email: c.email || '',
        phone: c.phone || '',
        linkedin: extractLinkedIn(c),
        tags: c.tags || [],
        tier: deriveTier(c.tags || [])
      })).filter(c => c.email);
    }

    // Extract LinkedIn URL from GHL contact data (checks all known locations)
    function extractLinkedIn(obj) {
      // Standard fields (camelCase variants)
      if (obj.linkedIn) return obj.linkedIn;
      if (obj.linkedin) return obj.linkedin;
      if (obj.linkedin_url) return obj.linkedin_url;
      // customFields as array (v2 style)
      if (Array.isArray(obj.customFields)) {
        const cf = obj.customFields.find(f =>
          f.id === 'linkedin_url' || f.key === 'linkedin_url' ||
          (f.value && typeof f.value === 'string' && f.value.includes('linkedin.com'))
        );
        if (cf?.value) return cf.value;
      }
      // customField as object/map (v1 style)
      if (obj.customField && typeof obj.customField === 'object' && !Array.isArray(obj.customField)) {
        for (const [key, val] of Object.entries(obj.customField)) {
          if (typeof val === 'string' && val.includes('linkedin.com')) return val;
          if (val && typeof val === 'object' && typeof val.value === 'string' && val.value.includes('linkedin.com')) return val.value;
        }
      }
      // customField as array
      if (Array.isArray(obj.customField)) {
        const cf = obj.customField.find(f =>
          (f.value && typeof f.value === 'string' && f.value.includes('linkedin.com'))
        );
        if (cf?.value) return cf.value;
      }
      return '';
    }

    // Enrich contacts with full profile data (LinkedIn, etc.) from individual GHL lookups
    async function enrichContacts(contacts) {
      const enriched = await Promise.all(contacts.slice(0, 10).map(async (c) => {
        try {
          const resp = await fetch(`https://rest.gohighlevel.com/v1/contacts/${c.id}`, {
            headers: { Authorization: `Bearer ${GHL_API_KEY}` }
          });
          if (!resp.ok) return c;
          const data = await resp.json();
          const full = data.contact || data;
          const linkedin = c.linkedin || extractLinkedIn(full);
          return {
            ...c,
            phone: c.phone || full.phone || '',
            linkedin
          };
        } catch { return c; }
      }));
      return enriched;
    }

    async function lookupExactGhlContact(email) {
      try {
        const lookupUrl = `https://rest.gohighlevel.com/v1/contacts/lookup?email=${encodeURIComponent(email)}`;
        const lookupResp = await fetch(lookupUrl, { headers: { Authorization: `Bearer ${GHL_API_KEY}` } });
        if (!lookupResp.ok) return null;
        const lookupData = await lookupResp.json();
        const mapped = dedupeContacts(mapContacts(lookupData.contacts));
        return mapped[0] || null;
      } catch {
        return null;
      }
    }

    async function searchAuthUsersByFragment(query) {
      const supabase = getAdminClient();
      const matches = [];
      const seenEmails = new Set();
      const perPage = 200;
      let page = 1;

      while (page <= 10 && matches.length < 20) {
        const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
        if (error) throw error;

        const users = data?.users || [];
        if (!users.length) break;

        for (const authUser of users) {
          const email = String(authUser?.email || '').trim().toLowerCase();
          const fullName = String(
            authUser?.user_metadata?.full_name ||
              authUser?.user_metadata?.name ||
              ''
          ).trim();

          if (!email || seenEmails.has(email)) continue;

          const haystack = `${email} ${fullName}`.toLowerCase();
          if (!haystack.includes(query)) continue;

          seenEmails.add(email);

          const ghlContact = await lookupExactGhlContact(email);
          matches.push({
            id: ghlContact?.id || authUser.id,
            name: ghlContact?.name || fullName || email,
            firstName: ghlContact?.firstName || fullName.split(' ')[0] || '',
            lastName:
              ghlContact?.lastName || fullName.split(' ').slice(1).join(' ') || '',
            email,
            phone: ghlContact?.phone || '',
            linkedin: ghlContact?.linkedin || '',
            tags: ghlContact?.tags || [],
            tier:
              ghlContact?.tier ||
              String(authUser?.user_metadata?.tier || '').trim().toLowerCase() ||
              'free',
            source: ghlContact ? 'ghl-auth-fallback' : 'auth'
          });

          if (matches.length >= 20) break;
        }

        if (users.length < perPage) break;
        page += 1;
      }

      return matches;
    }

    // Method 1: GHL v1 contacts search by query
    const searchUrl = `https://rest.gohighlevel.com/v1/contacts/?query=${encodeURIComponent(normalizedQuery)}&limit=20`;
    const resp = await fetch(searchUrl, {
      headers: { Authorization: `Bearer ${GHL_API_KEY}` }
    });
    let debugInfo = { method1_url: searchUrl, method1_status: resp.status };

    if (resp.ok) {
      const data = await resp.json();
      contacts = dedupeContacts(mapContacts(data.contacts));
      debugInfo.method1_count = contacts.length;
    }

    // Method 2: If no results, try with locationId param
    if (contacts.length === 0 && GHL_LOCATION_ID) {
      const url2 = `https://rest.gohighlevel.com/v1/contacts/?locationId=${GHL_LOCATION_ID}&query=${encodeURIComponent(normalizedQuery)}&limit=20`;
      const resp2 = await fetch(url2, { headers: { Authorization: `Bearer ${GHL_API_KEY}` } });
      debugInfo.method2_status = resp2.status;
      if (resp2.ok) {
        const data2 = await resp2.json();
        contacts = dedupeContacts(mapContacts(data2.contacts));
        debugInfo.method2_count = contacts.length;
      }
    }

    // Method 3: If still no results and query looks like email, try lookup
    if (contacts.length === 0 && normalizedQuery.includes('@')) {
      const lookupUrl = `https://rest.gohighlevel.com/v1/contacts/lookup?email=${encodeURIComponent(normalizedQuery)}`;
      const lookupResp = await fetch(lookupUrl, { headers: { Authorization: `Bearer ${GHL_API_KEY}` } });
      if (lookupResp.ok) {
        const lookupData = await lookupResp.json();
        contacts = dedupeContacts(mapContacts(lookupData.contacts));
        debugInfo.method3_count = contacts.length;
      }
    }

    // Method 4: When GHL query search misses short fragments, fall back to a
    // broader contact fetch and filter locally across email/name/tags.
    if (contacts.length === 0) {
      const broadUrls = [
        `https://rest.gohighlevel.com/v1/contacts/?limit=200`,
        GHL_LOCATION_ID ? `https://rest.gohighlevel.com/v1/contacts/?locationId=${GHL_LOCATION_ID}&limit=200` : null
      ].filter(Boolean);

      for (const [index, url] of broadUrls.entries()) {
        const broadResp = await fetch(url, { headers: { Authorization: `Bearer ${GHL_API_KEY}` } });
        debugInfo[`method${4 + index}_status`] = broadResp.status;
        if (!broadResp.ok) continue;

        const broadData = await broadResp.json();
        const filtered = dedupeContacts(mapContacts(broadData.contacts).filter(matchesQuery));
        debugInfo[`method${4 + index}_count`] = filtered.length;
        if (filtered.length > 0) {
          contacts = filtered.slice(0, 20);
          break;
        }
      }
    }

    // Enrich top results with full contact data (LinkedIn URL, etc.)
    if (contacts.length > 0) {
      contacts = await enrichContacts(contacts);
    }

    // Method 6: Supabase profile fallback — catch users whose GHL contact creation failed
    if (contacts.length === 0) {
      const supabase = getAdminClient();
      const { data: profiles } = await supabase
        .from('user_profiles')
        .select('id, email, full_name, tier, ghl_contact_id')
        .or(`email.ilike.%${normalizedQuery}%,full_name.ilike.%${normalizedQuery}%`)
        .limit(20);

      if (profiles?.length) {
        const supabaseContacts = profiles.map(p => {
          const nameParts = (p.full_name || '').split(' ');
          return {
            id: p.ghl_contact_id || `supabase:${p.id}`,
            name: p.full_name || p.email || 'Unknown',
            firstName: nameParts[0] || '',
            lastName: nameParts.slice(1).join(' ') || '',
            email: p.email,
            phone: '',
            linkedin: '',
            tags: [],
            tier: p.tier || 'free',
            source: 'supabase'
          };
        });
        contacts = supabaseContacts;
        debugInfo.method6_supabase_count = contacts.length;
      }
    }

    // Method 7: Auth-user fallback — catch real app users even when GHL query search
    // misses short email fragments and no user_profile row exists yet.
    if (contacts.length === 0) {
      const authContacts = await searchAuthUsersByFragment(normalizedQuery);
      if (authContacts.length) {
        contacts = authContacts;
        debugInfo.method7_auth_count = contacts.length;
      }
    }

    return res.status(200).json({ success: true, contacts, debug: debugInfo });
  } catch (error) {
    console.error('User search error:', error);
    return res.status(500).json({ error: 'Failed to search users: ' + error.message });
  }
}
