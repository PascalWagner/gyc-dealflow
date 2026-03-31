import {
	ADMIN_EMAILS,
	getAdminClient,
	resolveUserFromAccessToken,
	rateLimit,
	setCors
} from '../_supabase.js';
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
		const { user } = await resolveUserFromAccessToken(token);
		if (!user?.email) {
			return res.status(401).json({ error: 'Invalid or expired token' });
		}

		const adminClient = getAdminClient();
		const profileResult = user.id
			? await adminClient.from('user_profiles').select('is_admin, management_company_id').eq('id', user.id).maybeSingle()
			: { data: null, error: null };

		if (profileResult?.error) throw profileResult.error;

		const isAdmin =
			Boolean(profileResult?.data?.is_admin) ||
			ADMIN_EMAILS.includes(String(user.email || '').trim().toLowerCase());
		const viewerManagementCompanyId = profileResult?.data?.management_company_id || null;
		const normalizedQuery = normalizeMemberDealsQuery(req.query || {});

		const { parentDeals, childShareClasses, sponsorRows } = await fetchMemberDealDataset(
			adminClient,
			normalizedQuery,
			{ include506b: isAdmin, viewerManagementCompanyId, isAdmin }
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
