import { applyDealCreateDefaults } from './deals-workflow.js';
import { resolveDealLifecycleStatus } from '../../src/lib/utils/dealWorkflow.js';

async function listDeals(supabase, body) {
  const { page = 1, limit = 50, search } = body;
  const offset = (page - 1) * limit;

  let query = supabase
    .from('opportunities')
    .select('*, management_company:management_companies(id, operator_name)', { count: 'exact' })
    .order('added_date', { ascending: false })
    .range(offset, offset + limit - 1);

  if (search) {
    query = query.ilike('investment_name', `%${search}%`);
  }

  const { data, error, count } = await query;
  if (error) throw error;

  const flat = (data || []).map((deal) => ({
    ...deal,
    management_company_name: deal.management_company?.operator_name || deal.sponsor_name || '—',
    management_company: undefined
  }));

  return { data: flat, total: count, page, limit };
}

async function createDeal(supabase, body) {
  const { action, page, limit, search, ...fields } = body;
  const inputDeal = Object.keys(fields).length > 0 ? fields : body.deal;
  if (!inputDeal) throw new Error('Missing deal data');
  const deal = applyDealCreateDefaults(inputDeal);

  const { data, error } = await supabase
    .from('opportunities')
    .insert(deal)
    .select()
    .single();

  if (error) throw error;
  return { data };
}

async function updateDeal(supabase, body) {
  const { id, updates } = body;
  if (!id) throw new Error('Missing deal id');
  if (!updates || Object.keys(updates).length === 0) throw new Error('Missing updates');

  const { data, error } = await supabase
    .from('opportunities')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return { data };
}

async function deleteDeal(supabase, body) {
  const { id } = body;
  if (!id) throw new Error('Missing deal id');

  const { data: currentDeal, error: currentDealError } = await supabase
    .from('opportunities')
    .select('id, lifecycle_status, is_visible_to_users')
    .eq('id', id)
    .single();

  if (currentDealError || !currentDeal) throw currentDealError || new Error('Deal not found');

  const nextLifecycle = resolveDealLifecycleStatus(currentDeal) === 'published' ? 'published' : 'do_not_publish';
  const updates = {
    status: 'Archived',
    lifecycle_status: nextLifecycle,
    is_visible_to_users: nextLifecycle === 'published'
  };

  try {
    const { data, error } = await supabase
      .from('opportunities')
      .update({ ...updates, archived: true })
      .eq('id', id)
      .select()
      .single();

    if (error && error.code === '42703') throw new Error('FALLBACK');
    if (error) throw error;
    return { data };
  } catch (error) {
    if (error.message !== 'FALLBACK') throw error;

    const { data, error: fallbackError } = await supabase
      .from('opportunities')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (fallbackError) throw fallbackError;
    return { data };
  }
}

async function toggleArchive(supabase, body) {
  const { id, archived } = body;
  if (!id) throw new Error('Missing deal id');

  const { data: currentDeal, error: currentDealError } = await supabase
    .from('opportunities')
    .select('id, lifecycle_status, is_visible_to_users, status')
    .eq('id', id)
    .single();

  if (currentDealError || !currentDeal) throw currentDealError || new Error('Deal not found');

  const shouldArchive = archived !== undefined ? archived : true;
  const currentLifecycle = resolveDealLifecycleStatus(currentDeal);
  const updates = shouldArchive
    ? {
        status: 'Archived',
        lifecycle_status: currentLifecycle === 'published' ? 'published' : 'do_not_publish',
        is_visible_to_users: currentLifecycle === 'published'
      }
    : {
        status: currentDeal.status === 'Archived' ? 'Open to Invest' : currentDeal.status,
        lifecycle_status: currentLifecycle === 'do_not_publish' ? 'draft' : currentLifecycle,
        is_visible_to_users: currentLifecycle === 'published'
      };

  try {
    const { data, error } = await supabase
      .from('opportunities')
      .update({ ...updates, archived: shouldArchive })
      .eq('id', id)
      .select()
      .single();

    if (error && error.code === '42703') throw new Error('FALLBACK');
    if (error) throw error;
    return { data };
  } catch (error) {
    if (error.message !== 'FALLBACK') throw error;

    const { data, error: fallbackError } = await supabase
      .from('opportunities')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (fallbackError) throw fallbackError;
    return { data };
  }
}

async function listOperators(supabase, body) {
  const { page = 1, limit = 50, search } = body;
  const offset = (page - 1) * limit;

  let query = supabase
    .from('management_companies')
    .select('*', { count: 'exact' })
    .order('operator_name', { ascending: true })
    .range(offset, offset + limit - 1);

  if (search) {
    query = query.ilike('operator_name', `%${search}%`);
  }

  const { data, error, count } = await query;
  if (error) throw error;

  const flat = (data || []).map((operator) => ({ ...operator, name: operator.operator_name }));
  return { data: flat, total: count, page, limit };
}

async function createOperator(supabase, body) {
  const { action, page, limit, search, ...fields } = body;
  const operator = Object.keys(fields).length > 0 ? fields : body.operator;
  if (!operator) throw new Error('Missing operator data');

  if (operator.name && !operator.operator_name) {
    operator.operator_name = operator.name;
    delete operator.name;
  }

  const { data, error } = await supabase
    .from('management_companies')
    .insert(operator)
    .select()
    .single();

  if (error) throw error;
  return { data };
}

async function updateOperator(supabase, body) {
  const { id, updates } = body;
  if (!id) throw new Error('Missing operator id');
  if (!updates || Object.keys(updates).length === 0) throw new Error('Missing updates');

  const { data, error } = await supabase
    .from('management_companies')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return { data };
}

async function intakeCreate(supabase, body) {
  const { deal_data, operator_id, create_operator, operator_data } = body;
  if (!deal_data) throw new Error('Missing deal_data');

  let managementCompanyId = operator_id;

  if (create_operator && operator_data) {
    const operatorRecord = { operator_name: operator_data.name || operator_data.operator_name };
    if (operator_data.website) operatorRecord.website = operator_data.website;
    if (operator_data.ceo) operatorRecord.ceo = operator_data.ceo;

    const { data: newOperator, error: operatorError } = await supabase
      .from('management_companies')
      .insert(operatorRecord)
      .select()
      .single();

    if (operatorError) throw operatorError;
    managementCompanyId = newOperator.id;
  }

  if (managementCompanyId) {
    deal_data.management_company_id = managementCompanyId;
  }

  const createPayload = applyDealCreateDefaults(deal_data);

  const { data: newDeal, error: dealError } = await supabase
    .from('opportunities')
    .insert(createPayload)
    .select()
    .single();

  if (dealError) throw dealError;

  if (managementCompanyId) {
    await supabase
      .from('operator_permissions')
      .upsert({ management_company_id: managementCompanyId }, { onConflict: 'management_company_id' })
      .catch(() => {});
  }

  return { data: newDeal, operatorId: managementCompanyId };
}

export const catalogActions = {
  'list-deals': listDeals,
  'create-deal': createDeal,
  'update-deal': updateDeal,
  'delete-deal': deleteDeal,
  'toggle-archive': toggleArchive,
  'list-operators': listOperators,
  'create-operator': createOperator,
  'update-operator': updateOperator,
  'intake-create': intakeCreate
};
