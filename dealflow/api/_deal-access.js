import { ADMIN_EMAILS, getAdminClient } from './_supabase.js';

let submittedByEmailSupport = null;
let submittedByEmailSupportProbe = null;

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
			actorEmail: '',
			email: '',
			isImpersonating: false,
			actorIsAdmin: false,
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
				actorEmail: '',
				email: '',
				isImpersonating: false,
				actorIsAdmin: false,
				isAdmin: false,
				viewerManagementCompanyId: null
			};
		}

		const actorEmail = String(user.email || '').trim().toLowerCase();
		let actorIsAdmin = ADMIN_EMAILS.includes(actorEmail);
		let viewerManagementCompanyId = null;

		if (user.id) {
			const { data: profile } = await supabase
				.from('user_profiles')
				.select('management_company_id, is_admin')
				.eq('id', user.id)
				.maybeSingle();

			if (profile?.is_admin === true) actorIsAdmin = true;
			viewerManagementCompanyId = profile?.management_company_id || null;
		}

		if (!viewerManagementCompanyId && actorEmail) {
			const { data: company } = await supabase
				.from('management_companies')
				.select('id')
				.contains('authorized_emails', [actorEmail])
				.limit(1)
				.maybeSingle();

			viewerManagementCompanyId = company?.id || null;
		}

		let effectiveEmail = actorEmail;
		let effectiveIsAdmin = actorIsAdmin;
		const requestedImpersonationEmail = readRequestedImpersonationEmail(req);

		if (actorIsAdmin && requestedImpersonationEmail && requestedImpersonationEmail !== actorEmail) {
			effectiveEmail = requestedImpersonationEmail;
			effectiveIsAdmin = false;
			viewerManagementCompanyId = null;

			const { data: impersonatedProfile } = await supabase
				.from('user_profiles')
				.select('management_company_id')
				.eq('email', requestedImpersonationEmail)
				.maybeSingle();

			viewerManagementCompanyId = impersonatedProfile?.management_company_id || null;

			if (!viewerManagementCompanyId) {
				const { data: company } = await supabase
					.from('management_companies')
					.select('id')
					.contains('authorized_emails', [requestedImpersonationEmail])
					.limit(1)
					.maybeSingle();

				viewerManagementCompanyId = company?.id || null;
			}
		}

		return {
			token,
			user,
			actorEmail,
			email: effectiveEmail,
			isImpersonating: effectiveEmail !== actorEmail,
			actorIsAdmin,
			isAdmin: effectiveIsAdmin,
			viewerManagementCompanyId
		};
	} catch {
		return {
			token,
			user: null,
			actorEmail: '',
			email: '',
			isImpersonating: false,
			actorIsAdmin: false,
			isAdmin: false,
			viewerManagementCompanyId: null
		};
	}
}

function readRequestedImpersonationEmail(req) {
	const queryEmail = String(req?.query?.email || '').trim().toLowerCase();
	const queryAdmin = String(req?.query?.admin || '').trim().toLowerCase();
	if (queryAdmin === 'true' && queryEmail) return queryEmail;

	const headerEmail = String(req?.headers?.['x-impersonate-email'] || '').trim().toLowerCase();
	return headerEmail || '';
}

function escapePostgrestLogicValue(value) {
	return `"${String(value || '')
		.trim()
		.replace(/\\/g, '\\\\')
		.replace(/"/g, '\\"')}"`;
}

export async function supportsOpportunitySubmittedByEmail(supabase = getAdminClient()) {
	if (typeof submittedByEmailSupport === 'boolean') {
		return submittedByEmailSupport;
	}

	if (!submittedByEmailSupportProbe) {
		submittedByEmailSupportProbe = (async () => {
			try {
				const { error } = await supabase.from('opportunities').select('submitted_by_email').limit(1);
				if (error && /submitted_by_email|does not exist/i.test(error.message || '')) {
					submittedByEmailSupport = false;
					return false;
				}
				if (error) {
					console.warn(
						'Unable to verify opportunities.submitted_by_email support; disabling viewer-email visibility fallback.',
						error.message
					);
					submittedByEmailSupport = false;
					return false;
				}
				submittedByEmailSupport = true;
				return true;
			} catch (error) {
				console.warn(
					'Unable to verify opportunities.submitted_by_email support; disabling viewer-email visibility fallback.',
					error?.message || error
				);
				submittedByEmailSupport = false;
				return false;
			} finally {
				submittedByEmailSupportProbe = null;
			}
		})();
	}

	return submittedByEmailSupportProbe;
}

export function applyPublishedCatalogQuery(query, viewerContext = {}, { supportsSubmittedByEmail = true } = {}) {
	if (viewerContext.isAdmin) return query;

	const conditions = ['and(lifecycle_status.in.(published,archived),is_visible_to_users.eq.true)'];
	if (viewerContext.viewerManagementCompanyId) {
		conditions.push(
			`management_company_id.eq.${escapePostgrestLogicValue(viewerContext.viewerManagementCompanyId)}`
		);
	}
	if (viewerContext.email && supportsSubmittedByEmail) {
		conditions.push(`submitted_by_email.eq.${escapePostgrestLogicValue(viewerContext.email)}`);
	}

	return query.or(conditions.join(','));
}

export function applyDealVisibilityQuery(query, viewerContext = {}) {
	if (viewerContext.isAdmin) return query;
	if (viewerContext.viewerManagementCompanyId) {
		return query.or(
			`is_visible_to_users.eq.true,management_company_id.eq.${escapePostgrestLogicValue(viewerContext.viewerManagementCompanyId)}`
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
