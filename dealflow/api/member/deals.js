import {
	getAdminClient,
	rateLimit,
	setCors
} from '../_supabase.js';
import { resolveDealViewerContext } from '../_deal-access.js';
import { filterDeals, paginateDeals } from './deals/filters.js';
import { normalizeMemberDealsQuery } from './deals/query.js';
import { fetchMemberDealDataset } from './deals/repository.js';
import { transformDeals } from './deals/transform.js';

export default async function handler(req, res) {
	setCors(res);
	if (req.method === 'OPTIONS') return res.status(200).end();
	if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
	if (!rateLimit(req, res)) return;

	const token = (req.headers.authorization || '').replace('Bearer ', '');
	if (!token) {
		return res.status(401).json({ error: 'Authorization token required' });
	}

	try {
		const adminClient = getAdminClient();
		const normalizedQuery = normalizeMemberDealsQuery(req.query || {});
		const viewerContext = await resolveDealViewerContext(req, { supabase: adminClient });
		if (!viewerContext?.email) {
			return res.status(401).json({ error: 'Invalid or expired token' });
		}

		const canUseInternalView = Boolean(
			normalizedQuery.internal && viewerContext.actorIsAdmin && !viewerContext.isImpersonating
		);

		const { parentDeals, childShareClasses, sponsorRows } = await fetchMemberDealDataset(
			adminClient,
			normalizedQuery,
			{
				include506b: canUseInternalView,
				viewerManagementCompanyId: viewerContext.viewerManagementCompanyId,
				viewerEmail: viewerContext.email,
				isAdmin: canUseInternalView,
				publishedOnly: !canUseInternalView
			}
		);

		const transformedDeals = transformDeals(parentDeals, childShareClasses, sponsorRows);
		const filteredDeals = filterDeals(transformedDeals, normalizedQuery);
		const browseTotal = normalizedQuery.scope === 'browse' ? filteredDeals.length : null;
		const { deals, limit, offset, total, hasMore } = paginateDeals(
			filteredDeals,
			normalizedQuery
		);

		return res.status(200).json({
			deals,
			pagination: {
				limit,
				offset,
				total,
				hasMore
			},
			meta: {
				scope: normalizedQuery.scope,
				browseTotal
			}
		});
	} catch (error) {
		console.error('member/deals error:', error);
		return res.status(500).json({ error: 'Failed to load deals', message: error.message });
	}
}
