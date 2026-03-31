import { getAdminClient, verifyAdmin, ghlFetch, deriveTier } from '../_supabase.js';

export function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

export function isMissingTableError(error, tableName) {
  const message = String(error?.message || '');
  if (!message) return false;
  return (
    message.includes(`Could not find the table 'public.${tableName}' in the schema cache`) ||
    message.includes(`relation "public.${tableName}" does not exist`) ||
    message.includes(`relation "${tableName}" does not exist`)
  );
}

async function findUserIdByEmail(adminClient, email) {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) return null;

  const { data: profile, error: profileError } = await adminClient
    .from('user_profiles')
    .select('id')
    .ilike('email', normalizedEmail)
    .maybeSingle();

  if (profileError) throw profileError;
  if (profile?.id) return profile.id;

  const perPage = 200;
  let page = 1;

  while (true) {
    const { data, error } = await adminClient.auth.admin.listUsers({ page, perPage });
    if (error) throw error;

    const users = data?.users || [];
    const matchedUser = users.find((user) => normalizeEmail(user.email) === normalizedEmail);
    if (matchedUser?.id) return matchedUser.id;

    if (users.length < perPage) break;
    page += 1;
  }

  return null;
}

function displayNameFromEmail(email) {
  return normalizeEmail(email).split('@')[0] || '';
}

function adminPayload(req) {
  return req.method === 'GET' ? (req.query || {}) : (req.body || {});
}

export function isAdminImpersonationRequest(req) {
  const payload = adminPayload(req);
  return payload?.admin === true || payload?.admin === 'true';
}

export function adminTargetEmail(req) {
  return normalizeEmail(adminPayload(req)?.email);
}

async function lookupGhlContactByEmail(email) {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) return null;

  try {
    const response = await ghlFetch(
      `https://rest.gohighlevel.com/v1/contacts/lookup?email=${encodeURIComponent(normalizedEmail)}`
    );
    if (!response?.ok) return null;
    const data = await response.json();
    const contact = (data.contacts || []).find((entry) => normalizeEmail(entry.email) === normalizedEmail);
    if (!contact) return null;

    return {
      id: contact.id || null,
      email: normalizedEmail,
      firstName: contact.firstName || '',
      lastName: contact.lastName || '',
      fullName: [contact.firstName, contact.lastName].filter(Boolean).join(' ').trim(),
      tags: Array.isArray(contact.tags) ? contact.tags : []
    };
  } catch {
    return null;
  }
}

async function ensureUserForEmail(adminClient, email, { createIfMissing = false } = {}) {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) return null;

  let targetUserId = await findUserIdByEmail(adminClient, normalizedEmail);
  const ghlContact = await lookupGhlContactByEmail(normalizedEmail);

  if (!targetUserId && createIfMissing) {
    const fullName = ghlContact?.fullName || displayNameFromEmail(normalizedEmail);
    const { data, error } = await adminClient.auth.admin.createUser({
      email: normalizedEmail,
      email_confirm: true,
      user_metadata: fullName ? { full_name: fullName } : {}
    });

    if (error && !error.message?.toLowerCase().includes('already')) {
      throw error;
    }

    targetUserId = data?.user?.id || await findUserIdByEmail(adminClient, normalizedEmail);
  }

  if (!targetUserId) return null;

  const fullName = ghlContact?.fullName || displayNameFromEmail(normalizedEmail);
  await adminClient.from('user_profiles').upsert({
    id: targetUserId,
    email: normalizedEmail,
    full_name: fullName,
    tier: deriveTier(ghlContact?.tags || []),
    is_admin: false,
    ghl_contact_id: ghlContact?.id || null
  }, { onConflict: 'id' });

  return {
    id: targetUserId,
    email: normalizedEmail,
    full_name: fullName
  };
}

export async function resolveWriteContext(req, supabase, user, { createIfMissing = false } = {}) {
  if (!isAdminImpersonationRequest(req) || !adminTargetEmail(req)) {
    return { supabase, user };
  }

  const auth = await verifyAdmin(req);
  if (!auth.authorized) {
    const error = new Error(auth.error || 'Admin access required');
    error.statusCode = 403;
    throw error;
  }

  const adminClient = getAdminClient();
  const targetUser = await ensureUserForEmail(adminClient, adminTargetEmail(req), { createIfMissing });
  if (!targetUser) {
    return { supabase: adminClient, user: { id: null, email: adminTargetEmail(req) } };
  }

  return {
    supabase: adminClient,
    user: targetUser
  };
}

export async function findTargetUserIdByEmail(adminClient, email) {
  return findUserIdByEmail(adminClient, email);
}
