// Vercel Serverless Function: GP Deal Performance Analytics
// Returns funnel metrics, asset class benchmarks, and cross-deal comparison
//
// Query params:
//   companyId — UUID of the management company
//   period    — 7, 30, 90, or 'all' (default: 'all')
//
// Returns:
//   { deals: [...], benchmarks: { byAssetClass: {...}, platform: {...} }, crossDeal: [...] }

import { getAdminClient, setCors, rateLimit } from './_supabase.js';

// Map DB stage values to canonical UI stages
const STAGE_NORMALIZE = {
  new: 'filter', browse: 'filter', filter: 'filter',
  interested: 'review', saved: 'review', vetting: 'review', review: 'review',
  duediligence: 'connect', dd: 'connect', diligence: 'connect', connect: 'connect',
  ready: 'decide', decision: 'decide', decide: 'decide',
  invested: 'invested', portfolio: 'invested',
  passed: 'skipped', skipped: 'skipped'
};

function norm(stage) {
  return STAGE_NORMALIZE[(stage || '').toLowerCase().trim()] || 'filter';
}

// Stage hierarchy for cumulative funnel (higher = further in pipeline)
const STAGE_RANK = { filter: 0, review: 1, connect: 2, decide: 3, invested: 4, skipped: -1 };

function stageReached(normalizedStage, skippedFrom) {
  if (normalizedStage === 'skipped') {
    return STAGE_RANK[norm(skippedFrom)] ?? 0;
  }
  return STAGE_RANK[normalizedStage] ?? 0;
}

function computeFunnel(stageRows) {
  let totalEngaged = 0;
  let saved = 0;
  let connect = 0;
  let decide = 0;
  let invested = 0;
  let skipped = 0;
  const skippedBreakdown = { filter: 0, review: 0, connect: 0, decide: 0 };

  for (const row of stageRows) {
    const s = norm(row.stage);
    if (s === 'filter') continue; // no entry = not engaged
    totalEngaged++;

    const rank = stageReached(s, row.skipped_from_stage);

    if (rank >= 1) saved++;
    if (rank >= 2) connect++;
    if (rank >= 3) decide++;
    if (rank >= 4) invested++;

    if (s === 'skipped') {
      skipped++;
      const fromStage = norm(row.skipped_from_stage || 'filter');
      if (skippedBreakdown[fromStage] !== undefined) {
        skippedBreakdown[fromStage]++;
      }
    }
  }

  return { totalEngaged, saved, connect, decide, invested, skipped, skippedBreakdown };
}

function computeConversions(funnel) {
  const pct = (num, den) => den > 0 ? Math.round((num / den) * 1000) / 10 : null;
  return {
    engaged_to_saved: pct(funnel.saved, funnel.totalEngaged),
    saved_to_connect: pct(funnel.connect, funnel.saved),
    connect_to_decide: pct(funnel.decide, funnel.connect),
    decide_to_invested: pct(funnel.invested, funnel.decide)
  };
}

function periodCutoff(period) {
  if (!period || period === 'all') return null;
  const days = parseInt(period, 10);
  if (isNaN(days) || days <= 0) return null;
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

export default async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  if (!rateLimit(req, res)) return;

  const companyId = req.query?.companyId;
  if (!companyId || !/^[0-9a-f-]{36}$/i.test(companyId)) {
    return res.status(400).json({ error: 'companyId query param required (UUID)' });
  }

  const period = req.query?.period || 'all';
  const cutoff = periodCutoff(period);
  const benchmarkCutoff = new Date();
  benchmarkCutoff.setFullYear(benchmarkCutoff.getFullYear() - 1);
  const benchmarkCutoffStr = benchmarkCutoff.toISOString();

  // Cache: 5 min for deal data, benchmark data changes slowly
  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');

  try {
    const supabase = getAdminClient();

    // 1. Get GP's parent deals (direct ownership + sponsored)
    const [{ data: ownedDeals, error: ownedErr }, { data: sponsoredRows, error: sponsoredErr }] = await Promise.all([
      supabase
        .from('opportunities')
        .select('id, investment_name, asset_class, status, created_at, parent_deal_id')
        .eq('management_company_id', companyId)
        .is('parent_deal_id', null),
      supabase
        .from('deal_sponsors')
        .select('deal_id')
        .eq('company_id', companyId)
    ]);

    if (ownedErr) throw ownedErr;
    if (sponsoredErr) throw sponsoredErr;

    // Merge into unique set of parent deal IDs
    const parentDealIdSet = new Set();
    const dealMeta = {}; // id → { name, asset_class, status, created_at }
    for (const d of (ownedDeals || [])) {
      parentDealIdSet.add(d.id);
      dealMeta[d.id] = {
        name: d.investment_name || 'Untitled Deal',
        asset_class: d.asset_class || '',
        status: d.status || '',
        created_at: d.created_at
      };
    }

    // For sponsored deals, fetch their metadata too
    const sponsoredIds = (sponsoredRows || []).map(s => s.deal_id).filter(id => !parentDealIdSet.has(id));
    if (sponsoredIds.length > 0) {
      const { data: sponsoredDeals } = await supabase
        .from('opportunities')
        .select('id, investment_name, asset_class, status, created_at, parent_deal_id')
        .in('id', sponsoredIds)
        .is('parent_deal_id', null);
      for (const d of (sponsoredDeals || [])) {
        parentDealIdSet.add(d.id);
        dealMeta[d.id] = {
          name: d.investment_name || 'Untitled Deal',
          asset_class: d.asset_class || '',
          status: d.status || '',
          created_at: d.created_at
        };
      }
    }

    const parentDealIds = Array.from(parentDealIdSet);

    if (parentDealIds.length === 0) {
      return res.status(200).json({ deals: [], benchmarks: { byAssetClass: {}, platform: {} }, crossDeal: [] });
    }

    // 2. Get child deal IDs (share classes) to roll up
    const { data: childDeals } = await supabase
      .from('opportunities')
      .select('id, parent_deal_id')
      .in('parent_deal_id', parentDealIds);

    const childToParent = {};
    const allGpDealIds = [...parentDealIds];
    for (const c of (childDeals || [])) {
      childToParent[c.id] = c.parent_deal_id;
      allGpDealIds.push(c.id);
    }

    // 3. Fetch stages for GP's deals
    let gpStagesQuery = supabase
      .from('user_deal_stages')
      .select('user_id, deal_id, stage, skipped_from_stage, updated_at')
      .in('deal_id', allGpDealIds);

    if (cutoff) {
      gpStagesQuery = gpStagesQuery.gte('updated_at', cutoff);
    }

    const { data: gpStagesRaw, error: gpStagesErr } = await gpStagesQuery;
    if (gpStagesErr) throw gpStagesErr;

    // Roll up child stages to parent
    const gpStages = (gpStagesRaw || []).map(row => ({
      ...row,
      deal_id: childToParent[row.deal_id] || row.deal_id
    }));

    // 4. Compute per-deal funnel
    const stagesByDeal = {};
    for (const row of gpStages) {
      if (!stagesByDeal[row.deal_id]) stagesByDeal[row.deal_id] = [];
      stagesByDeal[row.deal_id].push(row);
    }

    const dealResults = parentDealIds.map(dealId => {
      const meta = dealMeta[dealId];
      const rows = stagesByDeal[dealId] || [];
      const funnel = computeFunnel(rows);
      const conversions = computeConversions(funnel);
      return {
        id: dealId,
        name: meta.name,
        asset_class: meta.asset_class,
        status: meta.status,
        created_at: meta.created_at,
        funnel,
        conversions
      };
    });

    // 5. Benchmark: get all non-GP deals and their stages
    // First, get all deals with asset class info
    const { data: allDeals } = await supabase
      .from('opportunities')
      .select('id, asset_class, management_company_id, parent_deal_id')
      .is('parent_deal_id', null);

    // Separate GP deals from benchmark deals
    const gpDealIdSet = new Set(allGpDealIds);
    const benchmarkDeals = (allDeals || []).filter(d => !gpDealIdSet.has(d.id));
    const benchmarkDealIds = benchmarkDeals.map(d => d.id);
    const benchmarkDealAssetClass = {};
    for (const d of benchmarkDeals) {
      benchmarkDealAssetClass[d.id] = d.asset_class || '';
    }

    // Also get child deals for benchmark deals to roll up
    let benchmarkChildToParent = {};
    let allBenchmarkDealIds = [...benchmarkDealIds];
    if (benchmarkDealIds.length > 0) {
      const { data: benchChildren } = await supabase
        .from('opportunities')
        .select('id, parent_deal_id')
        .in('parent_deal_id', benchmarkDealIds);
      for (const c of (benchChildren || [])) {
        benchmarkChildToParent[c.id] = c.parent_deal_id;
        allBenchmarkDealIds.push(c.id);
      }
    }

    // Fetch benchmark stages (last 12 months)
    let benchmarkStages = [];
    if (allBenchmarkDealIds.length > 0) {
      // Fetch in batches if needed (Supabase IN has limits)
      const BATCH_SIZE = 500;
      for (let i = 0; i < allBenchmarkDealIds.length; i += BATCH_SIZE) {
        const batch = allBenchmarkDealIds.slice(i, i + BATCH_SIZE);
        const { data: batchStages, error: batchErr } = await supabase
          .from('user_deal_stages')
          .select('deal_id, stage, skipped_from_stage')
          .in('deal_id', batch)
          .gte('updated_at', benchmarkCutoffStr);
        if (batchErr) throw batchErr;
        benchmarkStages.push(...(batchStages || []));
      }
    }

    // Roll up benchmark child stages to parent
    benchmarkStages = benchmarkStages.map(row => ({
      ...row,
      deal_id: benchmarkChildToParent[row.deal_id] || row.deal_id
    }));

    // Group benchmark stages by deal
    const benchmarkByDeal = {};
    for (const row of benchmarkStages) {
      if (!benchmarkByDeal[row.deal_id]) benchmarkByDeal[row.deal_id] = [];
      benchmarkByDeal[row.deal_id].push(row);
    }

    // Compute benchmark conversions by asset class and platform-wide
    const byAssetClass = {};
    const platformConversions = [];

    for (const dealId of benchmarkDealIds) {
      const rows = benchmarkByDeal[dealId] || [];
      if (rows.length === 0) continue;
      const funnel = computeFunnel(rows);
      const conversions = computeConversions(funnel);
      const ac = benchmarkDealAssetClass[dealId];

      platformConversions.push(conversions);

      if (ac) {
        if (!byAssetClass[ac]) {
          byAssetClass[ac] = { dealCount: 0, conversions: [] };
        }
        byAssetClass[ac].dealCount++;
        byAssetClass[ac].conversions.push(conversions);
      }
    }

    // Average conversion rates
    function avgConversions(convList) {
      if (convList.length === 0) return { engaged_to_saved: null, saved_to_connect: null, connect_to_decide: null, decide_to_invested: null };
      const keys = ['engaged_to_saved', 'saved_to_connect', 'connect_to_decide', 'decide_to_invested'];
      const result = {};
      for (const key of keys) {
        const valid = convList.map(c => c[key]).filter(v => v !== null);
        result[key] = valid.length > 0 ? Math.round((valid.reduce((a, b) => a + b, 0) / valid.length) * 10) / 10 : null;
      }
      return result;
    }

    const benchmarks = {
      byAssetClass: {},
      platform: {
        dealCount: platformConversions.length,
        avgConversions: avgConversions(platformConversions)
      }
    };

    for (const [ac, data] of Object.entries(byAssetClass)) {
      benchmarks.byAssetClass[ac] = {
        dealCount: data.dealCount,
        avgConversions: avgConversions(data.conversions),
        sampleNote: data.dealCount < 5 ? `Based on ${data.dealCount} deal${data.dealCount === 1 ? '' : 's'}` : null
      };
    }

    // 6. Cross-deal comparison (GP's deals vs benchmarks)
    const convKeys = ['engaged_to_saved', 'saved_to_connect', 'connect_to_decide', 'decide_to_invested'];
    const crossDeal = dealResults.map(deal => {
      const acBenchmark = benchmarks.byAssetClass[deal.asset_class] || null;
      const platBenchmark = benchmarks.platform;

      const vsAssetClass = {};
      const vsPlatform = {};

      for (const key of convKeys) {
        const myVal = deal.conversions[key];
        if (myVal === null) {
          vsAssetClass[key] = null;
          vsPlatform[key] = null;
          continue;
        }
        if (acBenchmark?.avgConversions?.[key] != null && acBenchmark.avgConversions[key] > 0) {
          vsAssetClass[key] = Math.round(((myVal - acBenchmark.avgConversions[key]) / acBenchmark.avgConversions[key]) * 100);
        } else {
          vsAssetClass[key] = null;
        }
        if (platBenchmark?.avgConversions?.[key] != null && platBenchmark.avgConversions[key] > 0) {
          vsPlatform[key] = Math.round(((myVal - platBenchmark.avgConversions[key]) / platBenchmark.avgConversions[key]) * 100);
        } else {
          vsPlatform[key] = null;
        }
      }

      return {
        id: deal.id,
        name: deal.name,
        asset_class: deal.asset_class,
        status: deal.status,
        conversions: deal.conversions,
        vsAssetClass,
        vsPlatform,
        acSampleNote: acBenchmark?.sampleNote || null
      };
    });

    return res.status(200).json({
      deals: dealResults,
      benchmarks,
      crossDeal
    });
  } catch (err) {
    console.error('gp-deal-performance error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
