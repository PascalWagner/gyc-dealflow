const BROWSABLE_TABLES = [
  'opportunities',
  'management_companies',
  'user_profiles',
  'user_buy_box',
  'user_deal_stages',
  'user_events',
  'user_goals',
  'user_portfolio',
  'dd_checklist',
  'deal_qa',
  'investment_memos',
  'deck_submissions',
  'operator_permissions',
  'operator_interactions',
  'deal_stage_counts',
  'sec_filings',
  'related_persons',
  'deal_sponsors',
  'background_checks',
  'gdrive_deck_files',
  'api_keys',
  'api_request_log',
  'intro_requests'
];

async function browseTable(supabase, body) {
  const { table, page = 1, limit = 50 } = body;
  if (!table || !BROWSABLE_TABLES.includes(table)) {
    throw new Error(`Invalid table. Allowed: ${BROWSABLE_TABLES.join(', ')}`);
  }

  const offset = (page - 1) * limit;
  const { data, error, count } = await supabase
    .from(table)
    .select('*', { count: 'exact' })
    .range(offset, offset + limit - 1)
    .limit(limit);

  if (error) throw error;
  return { data: data || [], total: count, page, limit };
}

async function tableCounts(supabase) {
  const counts = {};
  await Promise.all(
    BROWSABLE_TABLES.map(async (table) => {
      try {
        const { count, error } = await supabase.from(table).select('*', { count: 'exact', head: true });
        counts[table] = error ? null : count;
      } catch {
        counts[table] = null;
      }
    })
  );
  return { counts };
}

async function listIntros(supabase, params) {
  const search = (params?.search || '').trim();

  let query = supabase
    .from('intro_requests')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .limit(100);

  if (search) {
    query = query.or(`user_email.ilike.%${search}%,deal_name.ilike.%${search}%,operator_name.ilike.%${search}%`);
  }

  const { data, error, count } = await query;
  if (error) {
    console.warn('intro_requests query failed:', error.message);
    return { data: [], total: 0 };
  }

  return { data: data || [], total: count || 0 };
}

export const schemaActions = {
  'browse-table': browseTable,
  'table-counts': tableCounts,
  'list-intros': listIntros
};
