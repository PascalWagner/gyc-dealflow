// Vercel Serverless Function: GP Settings (per management company)
// GET: fetch settings, PATCH: update settings

import { getAdminClient, setCors } from '../../_supabase.js';

const ALLOWED_FIELDS = [
  'booking_url', 'calendar_url', 'authorized_emails',
  'ir_contact_name', 'ir_contact_email'
];

export default async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { id } = req.query;
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) {
    return res.status(400).json({ error: 'Invalid company ID' });
  }

  // Authenticate
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing authorization' });
  }
  const token = authHeader.replace('Bearer ', '');
  const supabase = getAdminClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) {
    return res.status(401).json({ error: 'Invalid token' });
  }

  // Verify user has access to this company (check authorized_emails)
  const { data: company, error: companyError } = await supabase
    .from('management_companies')
    .select('id, authorized_emails, booking_url, ir_contact_name, ir_contact_email')
    .eq('id', id)
    .single();

  if (companyError || !company) {
    return res.status(404).json({ error: 'Company not found' });
  }

  const authorizedEmails = (company.authorized_emails || []).map(e => e.toLowerCase());
  if (!authorizedEmails.includes(user.email.toLowerCase())) {
    return res.status(403).json({ error: 'Not authorized for this company' });
  }

  if (req.method === 'GET') {
    return res.status(200).json({
      calendar_url: company.booking_url || '',
      authorized_emails: company.authorized_emails || [],
      ir_contact_name: company.ir_contact_name || '',
      ir_contact_email: company.ir_contact_email || ''
    });
  }

  if (req.method === 'PATCH') {
    const body = req.body || {};
    const updates = {};

    for (const key of Object.keys(body)) {
      // Map calendar_url to booking_url (legacy field name)
      if (key === 'calendar_url') {
        updates.booking_url = body[key];
      } else if (ALLOWED_FIELDS.includes(key)) {
        updates[key] = body[key];
      }
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    const { error: updateError } = await supabase
      .from('management_companies')
      .update(updates)
      .eq('id', id);

    if (updateError) {
      console.error('Settings update failed:', updateError);
      return res.status(500).json({ error: 'Failed to save settings' });
    }

    return res.status(200).json({ success: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
