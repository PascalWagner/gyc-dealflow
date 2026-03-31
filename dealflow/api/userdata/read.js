import { getAdminClient, ghlFetch } from '../_supabase.js';
import {
  expectEnum,
  expectNonEmptyString,
  RequestValidationError,
  sendValidationError
} from '../_validation.js';
import { READ_TYPES, TABLE_MAP } from './constants.js';
import { findTargetUserIdByEmail, isMissingTableError, normalizeEmail } from './identity.js';

async function backfillGoalsFromGhl({ supabase, table, user }) {
  try {
    const ghlResp = await ghlFetch(
      `https://rest.gohighlevel.com/v1/contacts/lookup?email=${encodeURIComponent(user.email)}`
    );
    if (!ghlResp?.ok) return null;

    const ghlData = await ghlResp.json();
    const contact = (ghlData.contacts || [])[0];
    if (!contact?.customField) return null;

    const cf = {};
    const GHL_ID_MAP = {
      WIdv6G8BBHk9lBZqsXLy: 'goal_type',
      JDRc9bmJpwCNoXDe6T6a: 'current_income',
      Auy8hrr2O1G4GZweNaqt: 'target_income',
      '6FpI05sEc7R7VSl5TK2d': 'capital_available'
    };

    const fields = contact.customFields || contact.customField || [];
    if (Array.isArray(fields)) {
      fields.forEach((field) => {
        const mapped = GHL_ID_MAP[field.id];
        if (mapped) cf[mapped] = field.value;
      });
    }

    const goalType = cf.goal_type;
    const targetIncome = cf.target_income;
    const capitalAvailable = cf.capital_available;
    if (!goalType && !targetIncome && !capitalAvailable) return null;

    const GOAL_TYPE_MAP = {
      'Cash Flow (income now)': 'passive_income',
      'Equity Growth (wealth later)': 'build_wealth',
      'Tax Optimization (tax shield now)': 'reduce_taxes'
    };

    function rangeToCapital(label) {
      if (!label || typeof label !== 'string') return 0;
      const ranges = {
        '<$100k': 50000,
        '$100k - $249k': 175000,
        '$249k - $499k': 375000,
        '$500k - $999k': 750000,
        '$1M+': 2000000
      };
      return ranges[label] || Number(label) || 0;
    }

    const seedGoals = {
      user_id: user.id,
      goal_type: GOAL_TYPE_MAP[goalType] || goalType || 'passive_income',
      current_income: Number(cf.current_income || 0),
      target_income: Number(targetIncome || 0),
      capital_available: rangeToCapital(capitalAvailable),
      timeline: '5',
      tax_reduction: 0
    };

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

  if (type === 'goals' && (!data || data.length === 0) && user.email) {
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
    const { data, error } = await adminClient
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
    result[entryType] = data || [];
  }

  return res.status(200).json(result);
}
