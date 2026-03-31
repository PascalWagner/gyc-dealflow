import { ADMIN_EMAILS, getAdminClient } from './_supabase.js';

export function getBearerToken(req) {
	const authHeader = req?.headers?.authorization || '';
	return authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
}

export async function resolveDealViewerContext(req, { supabase = getAdminClient() } = {}) {
	const token = getBearerToken(req);
	if (!token) {
		return {
			token: '',
			user: null,
			email: '',
			isAdmin: false,
			viewerManagementCompanyId: null
		};
	}

	try {
		const {
			data: { user },
			error
		} = await supabase.auth.getUser(token);
		if (error || !user?.email) {
			return {
				token,
				user: null,
				email: '',
				isAdmin: false,
				viewerManagementCompanyId: null
			};
		}

		const email = String(user.email || '').trim().toLowerCase();
		let isAdmin = ADMIN_EMAILS.includes(email);
		let viewerManagementCompanyId = null;

		if (user.id) {
			const { data: profile } = await supabase
				.from('user_profiles')
				.select('management_company_id, is_admin')
				.eq('id', user.id)
				.maybeSingle();

			if (profile?.is_admin === true) isAdmin = true;
			viewerManagementCompanyId = profile?.management_company_id || null;
		}

		if (!viewerManagementCompanyId && email) {
			const { data: company } = await supabase
				.from('management_companies')
				.select('id')
				.contains('authorized_emails', [email])
				.limit(1)
				.maybeSingle();

			viewerManagementCompanyId = company?.id || null;
		}

		return {
			token,
			user,
			email,
			isAdmin,
			viewerManagementCompanyId
		};
	} catch {
		return {
			token,
			user: null,
			email: '',
			isAdmin: false,
			viewerManagementCompanyId: null
		};
	}
}

export function applyDealVisibilityQuery(query, viewerContext = {}) {
	if (viewerContext.isAdmin) return query;
	if (viewerContext.viewerManagementCompanyId) {
		return query.or(
			`is_visible_to_users.eq.true,management_company_id.eq.${viewerContext.viewerManagementCompanyId}`
		);
	}
	return query.eq('is_visible_to_users', true);
}

export function canViewerAccessDeal(deal, viewerContext = {}) {
	if (!deal) return false;
	if (viewerContext.isAdmin) return true;
	if (deal.is_visible_to_users === true) return true;

	const managementCompanyId =
		deal.management_company_id || deal.managementCompanyId || deal.management_company?.id || null;

	return Boolean(
		viewerContext.viewerManagementCompanyId
		&& managementCompanyId
		&& String(viewerContext.viewerManagementCompanyId) === String(managementCompanyId)
	);
}

export function canViewerAccessRestricted506bDeal(deal, viewerContext = {}, { include506b = false } = {}) {
	if (!deal?.is_506b) return true;
	if (include506b) return true;
	return canViewerAccessDeal(
		{
			...deal,
			is_visible_to_users: false
		},
		viewerContext
	);
}
