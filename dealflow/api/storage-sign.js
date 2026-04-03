// Generate signed read URLs for files in Supabase Storage.
// Used to fix document links that need valid signed tokens.

import { ADMIN_EMAILS, getAdminClient, setCors } from './_supabase.js';

export default async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { paths, bucket = 'deal-decks', expiresIn = 60 * 60 * 24 * 365 } = req.body;

    if (!paths || !Array.isArray(paths) || paths.length === 0) {
      return res.status(400).json({ error: 'paths array is required' });
    }

    const supabase = getAdminClient();
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Missing authorization' });
    }
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user?.id || !user?.email) {
      return res.status(401).json({ error: 'Invalid authorization' });
    }

    const normalizedEmail = String(user.email || '').toLowerCase();
    if (!ADMIN_EMAILS.includes(normalizedEmail)) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const results = {};
    for (const path of paths) {
      const { data, error } = await supabase.storage
        .from(bucket)
        .createSignedUrl(path, expiresIn);
      results[path] = error ? null : data.signedUrl;
    }

    return res.status(200).json({ urls: results });
  } catch (err) {
    console.error('storage-sign error:', err);
    return res.status(500).json({ error: err.message });
  }
}
