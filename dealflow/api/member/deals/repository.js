import { CHILD_SHARE_CLASS_SELECT, DEAL_SELECT, SPONSOR_SELECT } from './constants.js';
import { applyDealVisibilityQuery, supportsOpportunitySubmittedByEmail } from '../../_deal-access.js';

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

function mergeRowsById(resultSets = []) {
	const rowsById = new Map();

	for (const rows of resultSets) {
		for (const row of rows || []) {
			if (!row?.id) continue;
			rowsById.set(row.id, row);
		}
	}

	return [...rowsById.values()];
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

async function fetchPublishedScopedRows(
	buildBaseQuery,
	normalizedQuery,
	{ include506b = false, viewerManagementCompanyId = null, viewerEmail = '', supportsSubmittedByEmail = true } = {}
) {
	const queryFactories = [
		(query) =>
			query
				.in('lifecycle_status', ['published', 'archived'])
				.eq('is_visible_to_users', true)
	];

	if (viewerManagementCompanyId) {
		queryFactories.push((query) => query.eq('management_company_id', viewerManagementCompanyId));
	}

	if (viewerEmail && supportsSubmittedByEmail) {
		queryFactories.push((query) => query.eq('submitted_by_email', viewerEmail));
	}

	const resultSets = await Promise.all(
		queryFactories.map(async (applyVisibilityFilter) => {
			let query = buildBaseQuery();
			query = applyDbFilters(query, normalizedQuery, { include506b });
			if (!query) return [];
			query = applyVisibilityFilter(query);
			query = applyDbSort(query, normalizedQuery);
			const { data, error } = await query;
			if (error) throw error;
			return data || [];
		})
	);

	return mergeRowsById(resultSets);
}

async function fetchPublishedScopedRowsForChildren(
	buildBaseQuery,
	{ include506b = false, viewerManagementCompanyId = null, viewerEmail = '', supportsSubmittedByEmail = true } = {}
) {
	const queryFactories = [
		(query) => query.in('lifecycle_status', ['published', 'archived']).eq('is_visible_to_users', true)
	];

	if (viewerManagementCompanyId) {
		queryFactories.push((query) => query.eq('management_company_id', viewerManagementCompanyId));
	}

	if (viewerEmail && supportsSubmittedByEmail) {
		queryFactories.push((query) => query.eq('submitted_by_email', viewerEmail));
	}

	const resultSets = await Promise.all(
		queryFactories.map(async (applyVisibilityFilter) => {
			let query = buildBaseQuery();
			if (!include506b) {
				query = query.not('is_506b', 'is', true);
			}
			query = applyVisibilityFilter(query);
			const { data, error } = await query;
			if (error) throw error;
			return data || [];
		})
	);

	return mergeRowsById(resultSets);
}

export async function fetchMemberDealDataset(
	adminClient,
	normalizedQuery,
	{ include506b = false, viewerManagementCompanyId = null, viewerEmail = '', isAdmin = false, publishedOnly = false } = {}
) {
	const supportsSubmittedByEmail =
		publishedOnly && viewerEmail
			? await supportsOpportunitySubmittedByEmail(adminClient)
			: true;

	const buildParentQuery = () =>
		adminClient
			.from('opportunities')
			.select(DEAL_SELECT)
			.is('parent_deal_id', null)
			.not('investment_name', 'eq', '');

	let parentDeals = [];
	if (publishedOnly) {
		parentDeals = await fetchPublishedScopedRows(buildParentQuery, normalizedQuery, {
			include506b,
			viewerManagementCompanyId,
			viewerEmail,
			supportsSubmittedByEmail
		});
	} else {
		let parentQuery = applyDealVisibilityQuery(buildParentQuery(), { isAdmin, viewerManagementCompanyId });
		parentQuery = applyDbFilters(parentQuery, normalizedQuery, { include506b });
		parentQuery = parentQuery ? applyDbSort(parentQuery, normalizedQuery) : parentQuery;
		if (!parentQuery) {
			return {
				parentDeals: [],
				childShareClasses: [],
				sponsorRows: []
			};
		}

		const { data, error } = await parentQuery;
		if (error) throw error;
		parentDeals = data || [];
	}

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
			publishedOnly
				? fetchPublishedScopedRowsForChildren(
					() =>
						adminClient
							.from('opportunities')
							.select(CHILD_SHARE_CLASS_SELECT)
							.in('parent_deal_id', batchIds)
							.order('created_at', { ascending: true }),
					{
						include506b,
						viewerManagementCompanyId,
						viewerEmail,
						supportsSubmittedByEmail
					}
				)
				: (async () => {
					const query = applyDealVisibilityQuery(
						adminClient
							.from('opportunities')
							.select(CHILD_SHARE_CLASS_SELECT)
							.in('parent_deal_id', batchIds)
							.order('created_at', { ascending: true }),
						{ isAdmin, viewerManagementCompanyId }
					);
					const { data, error } = await query;
					if (error) throw error;
					return data || [];
				})()
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
