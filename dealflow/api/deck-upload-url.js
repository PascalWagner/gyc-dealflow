// Generate a signed upload URL for direct browser-to-storage uploads.
// This bypasses the 4.5 MB Vercel body limit for large files.

import { ADMIN_EMAILS, getAdminClient, setCors } from './_supabase.js';

function guessContentType(filename) {
  const ext = (filename || '').split('.').pop().toLowerCase();
  const types = {
    pdf: 'application/pdf',
    doc: 'application/msword',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    ppt: 'application/vnd.ms-powerpoint',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  };
  return types[ext] || 'application/octet-stream';
}

export default async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { dealId, dealName, filename, docType } = req.body;

    if (!filename) {
      return res.status(400).json({ error: 'Filename is required' });
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

    const cleanDealName = (dealName || 'Unknown').replace(/[^a-zA-Z0-9\s\-]/g, '').trim();
    const storagePath = `deals/${dealId || 'unlinked'}/${cleanDealName} - ${filename}`;
    const contentType = guessContentType(filename);

    // Create a signed upload URL (valid for 10 minutes)
    const { data, error } = await supabase.storage
      .from('deal-decks')
      .createSignedUploadUrl(storagePath, { upsert: true });

    if (error) {
      console.error('Signed upload URL error:', error.message);
      return res.status(500).json({ error: 'Could not create upload URL: ' + error.message });
    }

    return res.status(200).json({
      signedUrl: data.signedUrl,
      token: data.token,
      path: storagePath,
      contentType
    });
  } catch (err) {
    console.error('deck-upload-url error:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
}
