import {
  expectArray,
  expectBooleanish,
  expectEnum,
  expectOptionalNumber,
  expectOptionalString,
  isPlainObject,
  expectPlainObject,
  requireObjectBody,
  RequestValidationError,
  sendValidationError
} from '../_validation.js';
import { MUTATION_TYPES, TABLE_MAP, mapFields } from './constants.js';
import { isMissingTableError, resolveWriteContext } from './identity.js';
import {
  syncAutoRenewToGhl,
  syncGoalsToGhl,
  syncNotifFreqToGhl,
  syncProfileToGhl
} from './ghl.js';

const PROFILE_STRING_FIELDS = [
  'full_name',
  'phone',
  'location',
  'avatar_url',
  'accredited_status',
  'investable_capital',
  'investment_experience'
];

const PROFILE_BOOLEAN_FIELDS = [
  'share_portfolio',
  'share_saved',
  'share_dd',
  'share_invested',
  'allow_follows',
  'share_activity'
];

function sanitizeProfileFields(data) {
  const fields = {};

  for (const key of PROFILE_STRING_FIELDS) {
    if (data[key] !== undefined) {
      fields[key] = expectOptionalString(data[key], `data.${key}`, '');
    }
  }

  for (const key of PROFILE_BOOLEAN_FIELDS) {
    if (data[key] !== undefined) {
      fields[key] = expectBooleanish(data[key], `data.${key}`, false);
    }
  }

  return fields;
}

function validatePlanBuckets(value) {
  const buckets = expectArray(value, 'data.buckets', { fallback: [] });
  for (let index = 0; index < buckets.length; index += 1) {
    if (!isPlainObject(buckets[index])) {
      throw new RequestValidationError(`data.buckets[${index}] must be an object`, {
        field: `data.buckets[${index}]`
      });
    }
  }
  return buckets;
}

export async function handleUserdataPost(req, res, supabase, user) {
  const body = requireObjectBody(req, res);
  if (!body) return;

  let type;
  let data;
  try {
    type = expectEnum(body.type, 'type', MUTATION_TYPES);
    data = expectPlainObject(body.data, 'data');
  } catch (error) {
    if (error instanceof RequestValidationError) {
      return sendValidationError(res, error);
    }
    throw error;
  }

  const writeContext = await resolveWriteContext(req, supabase, user, { createIfMissing: true });
  const db = writeContext.supabase;
  const effectiveUser = writeContext.user;

  if (type === 'profile') {
    const fields = sanitizeProfileFields(data);
    if (Object.keys(fields).length === 0) {
      return res.status(400).json({ error: 'No valid profile fields to update' });
    }

    const { data: updated, error } = await db
      .from('user_profiles')
      .update(fields)
      .eq('id', effectiveUser.id)
      .select()
      .single();
    if (error) throw error;

    if (fields.phone || fields.full_name) {
      try {
        await syncProfileToGhl(effectiveUser.email, fields);
      } catch (syncError) {
        console.warn('GHL profile sync failed:', syncError.message);
      }
    }

    return res.status(200).json({ record: updated, type, updatedAt: new Date().toISOString() });
  }

  if (type === 'autoRenew') {
    const autoRenew = expectBooleanish(data.autoRenew, 'data.autoRenew', false);
    const { data: updated, error } = await db
      .from('user_profiles')
      .update({ auto_renew: autoRenew })
      .eq('id', effectiveUser.id)
      .select('auto_renew, email')
      .single();
    if (error) throw error;

    syncAutoRenewToGhl(updated.email || user.email, autoRenew).catch((syncError) =>
      console.warn('GHL auto-renew sync failed:', syncError.message)
    );

    return res.status(200).json({ record: updated, type, updatedAt: new Date().toISOString() });
  }

  if (type === 'notif_prefs') {
    const frequency = expectEnum(
      data.frequency === undefined ? 'weekly' : data.frequency,
      'data.frequency',
      ['off', 'weekly']
    );
    const { data: updated, error } = await db
      .from('user_profiles')
      .update({ notif_frequency: frequency })
      .eq('id', effectiveUser.id)
      .select('notif_frequency, email')
      .single();
    if (error) throw error;

    syncNotifFreqToGhl(updated.email || user.email, frequency).catch((syncError) =>
      console.warn('GHL notif freq sync failed:', syncError.message)
    );

    return res.status(200).json({ record: updated, type, updatedAt: new Date().toISOString() });
  }

  const table = TABLE_MAP[type];
  if (!table) {
    return res.status(400).json({ error: `Invalid type. Must be one of: profile, notif_prefs, ${Object.keys(TABLE_MAP).join(', ')}` });
  }

  const fields = mapFields(type, data);
  fields.user_id = effectiveUser.id;

  let result;

  if (type === 'stages') {
    if (!fields.deal_id) {
      return res.status(400).json({ error: 'Deal ID is required for stages' });
    }
    const { data: upserted, error } = await db
      .from(table)
      .upsert(fields, { onConflict: 'user_id,deal_id' })
      .select()
      .single();
    if (error) throw error;
    result = upserted;
  } else if (type === 'goals') {
    const { data: upserted, error } = await db
      .from(table)
      .upsert(fields, { onConflict: 'user_id' })
      .select()
      .single();
    if (error) throw error;
    result = upserted;

    syncGoalsToGhl(effectiveUser.email, result).catch((syncError) =>
      console.warn('GHL goals background sync failed:', syncError.message)
    );
  } else if (type === 'plan') {
    const planFields = {
      user_id: effectiveUser.id,
      total_capital: expectOptionalNumber(data.total_capital, 'data.total_capital', {
        integer: true,
        min: 0,
        fallback: 0
      }),
      check_size: expectOptionalNumber(data.check_size, 'data.check_size', {
        integer: true,
        min: 0,
        fallback: 100000
      }),
      target_annual_income: expectOptionalNumber(data.target_annual_income, 'data.target_annual_income', {
        integer: true,
        min: 0,
        fallback: null
      }),
      target_irr: expectOptionalNumber(data.target_irr, 'data.target_irr', {
        min: 0,
        fallback: null
      }),
      target_tax_offset: expectOptionalNumber(data.target_tax_offset, 'data.target_tax_offset', {
        integer: true,
        min: 0,
        fallback: null
      }),
      buckets: validatePlanBuckets(data.buckets),
      generated_from: expectEnum(
        data.generated_from === undefined ? 'manual' : data.generated_from,
        'data.generated_from',
        ['wizard', 'manual', 'adjusted']
      )
    };
    const { data: upserted, error } = await db
      .from('user_portfolio_plans')
      .upsert(planFields, { onConflict: 'user_id' })
      .select()
      .single();
    if (error) {
      if (isMissingTableError(error, 'user_portfolio_plans')) {
        return res.status(200).json({
          record: null,
          type,
          persisted: false,
          warning: 'Plan storage unavailable in this environment',
          updatedAt: new Date().toISOString()
        });
      }
      throw error;
    }
    result = upserted;
  } else {
    const recordId = data._recordId;
    const effectiveRecordId = recordId;

    if (effectiveRecordId) {
      const { data: updated, error } = await db
        .from(table)
        .update(fields)
        .eq('id', effectiveRecordId)
        .eq('user_id', effectiveUser.id)
        .select()
        .single();
      if (error) throw error;
      result = updated;
    } else {
      const { data: created, error } = await db
        .from(table)
        .insert(fields)
        .select()
        .single();
      if (error) throw error;
      result = created;
    }

    if (type === 'portfolio' && result && result.deal_id) {
      await db.from('user_deal_stages').upsert({
        user_id: effectiveUser.id,
        deal_id: result.deal_id,
        stage: 'invested',
        notes: '',
        updated_at: new Date().toISOString()
      }, { onConflict: 'user_id,deal_id', ignoreDuplicates: true }).catch(() => {});
    }
  }

  return res.status(200).json({
    record: result,
    type,
    updatedAt: new Date().toISOString()
  });
}

export async function handleUserdataDelete(req, res, supabase, user) {
  const body = requireObjectBody(req, res);
  if (!body) return;

  let type;
  try {
    type = expectEnum(body.type, 'type', Object.keys(TABLE_MAP));
  } catch (error) {
    if (error instanceof RequestValidationError) {
      return sendValidationError(res, error);
    }
    throw error;
  }

  const { recordId, dealId } = body;
  const writeContext = await resolveWriteContext(req, supabase, user, { createIfMissing: false });
  const db = writeContext.supabase;
  const effectiveUser = writeContext.user;
  const table = TABLE_MAP[type];

  if (!table) {
    return res.status(400).json({ error: `Invalid type. Must be one of: ${Object.keys(TABLE_MAP).join(', ')}` });
  }

  if (type === 'stages' && dealId) {
    const { error } = await db
      .from(table)
      .delete()
      .eq('deal_id', dealId)
      .eq('user_id', effectiveUser.id);

    if (error) throw error;

    return res.status(200).json({
      deleted: true,
      dealId,
      type,
      deletedAt: new Date().toISOString()
    });
  }

  if (!recordId) {
    return res.status(400).json({ error: 'Record ID is required' });
  }

  const { error } = await db
    .from(table)
    .delete()
    .eq('id', recordId)
    .eq('user_id', effectiveUser.id);

  if (error) throw error;

  return res.status(200).json({
    deleted: true,
    recordId,
    type,
    deletedAt: new Date().toISOString()
  });
}
