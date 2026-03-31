import { CHILD_SHARE_CLASS_SELECT, DEAL_SELECT, SPONSOR_SELECT } from './constants.js';
import { applyDealVisibilityQuery, applyPublishedCatalogQuery } from '../../_deal-access.js';

const DEAL_RELATION_BATCH_SIZE = 75;

async function fetchInChunks(ids, fetcher, batchSize = DEAL_RELATION_BATCH_SIZE) {
	const allRows = [];

	for (let index = 0; index < ids.length; index += batchSize) {
		const batchIds = ids.slice(index, index + batchSize);
		const result = await fetcher(batchIds);
		if (result?.error) throw result.error;
		allRows.push(...(result?.data || []));
	}

	return allRows;
}

function applyDbFilters(query, normalizedQuery, { include506b }) {
	let next = query;

	if (!include506b) {
		next = next.not('is_506b', 'is', true);
	}

	if (normalizedQuery.scope === 'ids') {
		if (!normalizedQuery.ids.length) return null;
		next = next.in('id', normalizedQuery.ids);
	}

	if (normalizedQuery.managementCompanyId) {
		next = next.eq('management_company_id', normalizedQuery.managementCompanyId);
	}

	if (normalizedQuery.assetClass) {
		next = next.eq('asset_class', normalizedQuery.assetClass);
	}

	if (normalizedQuery.assetClassIn.length) {
		next = next.in('asset_class', normalizedQuery.assetClassIn);
	}

	if (normalizedQuery.dealType) {
		next = next.eq('deal_type', normalizedQuery.dealType);
	}

	if (normalizedQuery.dealTypeIn.length && !normalizedQuery.matchAnyStrategyOrDealType) {
		next = next.in('deal_type', normalizedQuery.dealTypeIn);
	}

	if (normalizedQuery.strategy) {
		next = next.eq('strategy', normalizedQuery.strategy);
	}

	if (normalizedQuery.strategyIn.length && !normalizedQuery.matchAnyStrategyOrDealType) {
		next = next.in('strategy', normalizedQuery.strategyIn);
	}

	if (normalizedQuery.status) {
		next = next.eq('status', normalizedQuery.status);
	}

	if (normalizedQuery.distributions) {
		next = next.eq('distributions', normalizedQuery.distributions);
	}

	if (Number.isFinite(normalizedQuery.maxMinimum)) {
		next = next.lte('investment_minimum', normalizedQuery.maxMinimum);
	}

	if (Number.isFinite(normalizedQuery.maxHoldYears)) {
		next = next.lte('hold_period_years', normalizedQuery.maxHoldYears);
	}

	if (Number.isFinite(normalizedQuery.minIrr)) {
		next = next.gte('target_irr', normalizedQuery.minIrr);
	}

	return next;
}

function applyDbSort(query, normalizedQuery) {
	const normalizedSort = String(normalizedQuery.sort || 'newest').trim().toLowerCase();

	if (normalizedSort === 'irr') {
		return query.order('target_irr', { ascending: false, nullsFirst: false });
	}

	if (normalizedSort === 'min_invest') {
		return query.order('investment_minimum', { ascending: true, nullsFirst: false });
	}

	if (normalizedSort === 'az') {
		return query.order('investment_name', { ascending: true, nullsFirst: false });
	}

	return query.order('added_date', { ascending: false });
}

export async function fetchMemberDealDataset(
	adminClient,
	normalizedQuery,
	{ include506b = false, viewerManagementCompanyId = null, isAdmin = false, publishedOnly = false } = {}
) {
	let parentQuery = adminClient
		.from('opportunities')
		.select(DEAL_SELECT)
		.is('parent_deal_id', null)
		.not('investment_name', 'eq', '');

	parentQuery = publishedOnly
		? applyPublishedCatalogQuery(parentQuery)
		: applyDealVisibilityQuery(parentQuery, { isAdmin, viewerManagementCompanyId });
	parentQuery = applyDbFilters(parentQuery, normalizedQuery, { include506b });
	parentQuery = parentQuery ? applyDbSort(parentQuery, normalizedQuery) : parentQuery;
	if (!parentQuery) {
		return {
			parentDeals: [],
			childShareClasses: [],
			sponsorRows: []
		};
	}

	const { data: parentDeals, error: parentError } = await parentQuery;
	if (parentError) throw parentError;

	const parentIds = (parentDeals || []).map((deal) => deal.id).filter(Boolean);
	if (!parentIds.length) {
		return {
			parentDeals: [],
			childShareClasses: [],
			sponsorRows: []
		};
	}

	const [childShareClasses, sponsorRows] = await Promise.all([
		fetchInChunks(parentIds, (batchIds) =>
			(
				publishedOnly
					? applyPublishedCatalogQuery(
						adminClient
							.from('opportunities')
							.select(CHILD_SHARE_CLASS_SELECT)
							.in('parent_deal_id', batchIds)
							.order('created_at', { ascending: true })
					)
					: applyDealVisibilityQuery(
						adminClient
							.from('opportunities')
							.select(CHILD_SHARE_CLASS_SELECT)
							.in('parent_deal_id', batchIds)
							.order('created_at', { ascending: true }),
						{ isAdmin, viewerManagementCompanyId }
					)
			)
		),
		fetchInChunks(parentIds, (batchIds) =>
			adminClient
				.from('deal_sponsors')
				.select(SPONSOR_SELECT)
				.in('deal_id', batchIds)
				.order('display_order', { ascending: true })
		)
	]);

	return {
		parentDeals: parentDeals || [],
		childShareClasses,
		sponsorRows
	};
}
