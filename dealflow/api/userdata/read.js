import { getAdminClient } from '../_supabase.js';
import {
  expectEnum,
  expectNonEmptyString,
  RequestValidationError,
  sendValidationError
} from '../_validation.js';
import { READ_TYPES, TABLE_MAP } from './constants.js';
import { findTargetUserIdByEmail, isMissingTableError, normalizeEmail } from './identity.js';
import {
  buildCanonicalGoalsFromGhlContact,
  getGhlContactByEmail,
  hasMeaningfulGoalsRow
} from './ghl.js';

async function backfillGoalsFromGhl({ supabase, table, user }) {
  try {
    const contact = await getGhlContactByEmail(user.email, { hydrateFields: true });
    if (!contact) return null;
    const seedGoals = buildCanonicalGoalsFromGhlContact(contact, { userId: user.id });
    if (!seedGoals) return null;

    const { data: seeded } = await supabase
      .from(table)
      .upsert(seedGoals, { onConflict: 'user_id' })
      .select();

    return seeded || null;
  } catch (error) {
    console.warn('GHL goals pull failed:', error.message);
    return null;
  }
}

export async function handleUserdataGet(req, res, supabase, user) {
  let type = req.query?.type;
  if (type !== undefined) {
    try {
      type = expectEnum(type, 'type', READ_TYPES);
    } catch (error) {
      if (error instanceof RequestValidationError) {
        return sendValidationError(res, error);
      }
      throw error;
    }
  }

  if (type === 'notif_prefs') {
    const { data, error } = await supabase
      .from('user_profiles')
      .select('notif_frequency')
      .eq('id', user.id)
      .single();
    if (error) throw error;
    return res.status(200).json({ notif_frequency: data?.notif_frequency || 'weekly' });
  }

  const table = TABLE_MAP[type];
  if (!table) {
    return res.status(400).json({ error: `Invalid type. Must be one of: ${Object.keys(TABLE_MAP).join(', ')}` });
  }

  let { data, error } = await supabase
    .from(table)
    .select('*')
    .eq('user_id', user.id);

  if (error) {
    if (type === 'plan' && isMissingTableError(error, table)) {
      return res.status(200).json({
        records: [],
        count: 0,
        type,
        unavailable: true,
        fetchedAt: new Date().toISOString()
      });
    }
    throw error;
  }

  if (type === 'goals' && (!hasMeaningfulGoalsRow(data?.[0]) || data.length === 0) && user.email) {
    const seeded = await backfillGoalsFromGhl({ supabase, table, user });
    if (seeded && seeded.length > 0) {
      data = seeded;
    }
  }

  return res.status(200).json({
    records: data,
    count: data.length,
    type,
    fetchedAt: new Date().toISOString()
  });
}

export async function handleUserdataAdminGet(req, res) {
  let type = req.query?.type;
  let email = '';
  try {
    if (type !== undefined) {
      type = expectEnum(type, 'type', Object.keys(TABLE_MAP));
    }
    email = expectNonEmptyString(req.query?.email, 'email');
  } catch (error) {
    if (error instanceof RequestValidationError) {
      return sendValidationError(res, error);
    }
    throw error;
  }

  const normalizedEmail = normalizeEmail(email);
  const types = type ? [type] : ['portfolio', 'stages', 'goals', 'taxdocs', 'plan'];
  const adminClient = getAdminClient();

  const targetUserId = await findTargetUserIdByEmail(adminClient, normalizedEmail);
  if (!targetUserId) {
    const result = {};
    types.forEach((entryType) => {
      result[entryType] = [];
    });
    return res.status(200).json(result);
  }

  const result = {};
  for (const entryType of types) {
    const table = TABLE_MAP[entryType];
    if (!table) continue;
    let { data, error } = await adminClient
      .from(table)
      .select('*')
      .eq('user_id', targetUserId);
    if (error) {
      if (entryType === 'plan' && isMissingTableError(error, table)) {
        result[entryType] = [];
        continue;
      }
      throw error;
    }

    if (entryType === 'goals' && !hasMeaningfulGoalsRow(data?.[0])) {
      const seeded = await backfillGoalsFromGhl({
        supabase: adminClient,
        table,
        user: {
          id: targetUserId,
          email: normalizedEmail
        }
      });
      if (seeded && seeded.length > 0) {
        data = seeded;
      }
    }
    result[entryType] = data || [];
  }

  return res.status(200).json(result);
}
