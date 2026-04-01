// Vercel Serverless Function: GP Settings (per management company)
// GET: fetch settings, PATCH: update settings

import { ADMIN_EMAILS, getAdminClient, setCors } from '../../_supabase.js';
import {
  loadManagementCompanyTeamContacts,
  saveManagementCompanyTeamContacts
} from '../../_management-company-contacts.js';

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
    .select('id, authorized_emails, booking_url, ir_contact_name, ir_contact_email, ceo, linkedin_ceo')
    .eq('id', id)
    .single();

  if (companyError || !company) {
    return res.status(404).json({ error: 'Company not found' });
  }

  const authorizedEmails = (company.authorized_emails || []).map(e => e.toLowerCase());
  const isAdmin = ADMIN_EMAILS.includes(String(user.email || '').toLowerCase());
  if (!isAdmin && !authorizedEmails.includes(user.email.toLowerCase())) {
    return res.status(403).json({ error: 'Not authorized for this company' });
  }

  if (req.method === 'GET') {
    const contactState = await loadManagementCompanyTeamContacts(supabase, {
      managementCompanyId: id,
      company
    });
    return res.status(200).json({
      calendar_url: company.booking_url || '',
      authorized_emails: company.authorized_emails || [],
      ir_contact_name: company.ir_contact_name || '',
      ir_contact_email: company.ir_contact_email || '',
      team_contacts: contactState.contacts,
      teamContacts: contactState.contacts,
      storageMode: contactState.storageMode || 'legacy'
    });
  }

  if (req.method === 'PATCH') {
    const body = req.body || {};
    const updates = {};
    let teamContactState = null;

    for (const key of Object.keys(body)) {
      // Map calendar_url to booking_url (legacy field name)
      if (key === 'calendar_url') {
        updates.booking_url = body[key];
      } else if (ALLOWED_FIELDS.includes(key)) {
        updates[key] = body[key];
      }
    }

    if (Object.keys(updates).length === 0) {
      if (!Array.isArray(body.team_contacts) && !Array.isArray(body.teamContacts)) {
        return res.status(400).json({ error: 'No valid fields to update' });
      }
    }

    if (Object.keys(updates).length > 0) {
      const { error: updateError } = await supabase
        .from('management_companies')
        .update(updates)
        .eq('id', id);

      if (updateError) {
        console.error('Settings update failed:', updateError);
        return res.status(500).json({ error: 'Failed to save settings' });
      }
    }

    if (Array.isArray(body.team_contacts) || Array.isArray(body.teamContacts)) {
      try {
        teamContactState = await saveManagementCompanyTeamContacts(supabase, {
          managementCompanyId: id,
          contacts: body.team_contacts || body.teamContacts || []
        });
      } catch (error) {
        if (error?.validation) {
          return res.status(400).json({
            error: error.message,
            contactErrors: error.validation.errors || [],
            formError: error.validation.formError || error.message
          });
        }
        console.error('Team contact save failed:', error);
        return res.status(500).json({ error: 'Failed to save team contacts' });
      }
    }

    return res.status(200).json({
      success: true,
      team_contacts: teamContactState?.contacts || null,
      teamContacts: teamContactState?.contacts || null,
      storageMode: teamContactState?.storageMode || 'legacy'
    });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
