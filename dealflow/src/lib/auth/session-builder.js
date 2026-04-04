// Shared session builder — used by /login and /landing bypass flows
// to ensure identical session objects in localStorage.

import { SESSION_VERSION, buildAccessModel, normalizeEmail } from './access-model.js';
import { normalizePrivacyProfile } from '../utils/dealflow-contract.js';

/**
 * Build a complete stored session user object from API auth response data.
 * Returns null if no valid email is found.
 */
export function buildStoredSessionUser(data) {
	const normalizedUserEmail = normalizeEmail(data?.email);
	if (!normalizedUserEmail) return null;

	const managementCompanySeed = data?.managementCompany || {
		id: data?.managementCompanyId || null,
		name: data?.managementCompanyName || '',
		gpType: data?.gpType || data?.gp_type || null
	};
	const accessModel = buildAccessModel({
		email: normalizedUserEmail,
		tier: data?.tier || data?.legacyTier || 'free',
		legacyTier: data?.legacyTier || data?.tier || 'free',
		accessTier: data?.accessTier || null,
		isAdmin: data?.isAdmin === true,
		roleFlags: data?.roleFlags,
		capabilities: data?.capabilities,
		gpType: data?.gpType || data?.gp_type || null,
		managementCompany: managementCompanySeed,
		subscriptions: data?.subscriptions || {},
		autoRenew: data?.autoRenew ?? data?.auto_renew ?? true
	});
	const privacy = normalizePrivacyProfile({
		share_activity: data?.share_activity,
		sharePortfolio: data?.sharePortfolio,
		share_saved: data?.share_saved,
		share_dd: data?.share_dd,
		share_invested: data?.share_invested,
		allow_follows: data?.allow_follows
	});
	const name = data?.name || data?.fullName || normalizedUserEmail.split('@')[0];

	return {
		sessionVersion: SESSION_VERSION,
		email: normalizedUserEmail,
		name,
		fullName: data?.fullName || data?.name || name,
		token: data?.token || '',
		refreshToken: data?.refreshToken || '',
		tier: data?.tier || data?.legacyTier || accessModel.legacyTier || 'free',
		legacyTier: data?.legacyTier || data?.tier || accessModel.legacyTier || 'free',
		accessTier: accessModel.accessTier,
		roleFlags: accessModel.roleFlags,
		capabilities: accessModel.capabilities,
		isAdmin: accessModel.roleFlags.admin,
		isGP: accessModel.roleFlags.gp,
		managementCompany: accessModel.managementCompany,
		tags: Array.isArray(data?.tags) ? data.tags : [],
		contactId: data?.contactId || null,
		phone: data?.phone || '',
		location: data?.location || '',
		avatar_url: data?.avatar_url || '',
		share_activity: privacy.share_activity,
		sharePortfolio: privacy.sharePortfolio,
		share_saved: privacy.share_saved,
		share_dd: privacy.share_dd,
		share_invested: privacy.share_invested,
		allow_follows: privacy.allow_follows,
		preferred_timezone: data?.preferred_timezone || data?.time_zone || '',
		accredited_status: data?.accredited_status || '',
		investable_capital: data?.investable_capital || '',
		investment_experience: data?.investment_experience || '',
		onboardingRole: data?.onboardingRole || null,
		gpOnboardingComplete: data?.gpOnboardingComplete || false,
		onboardingCompletedAt: data?.onboardingCompletedAt || null,
		tosAcceptedAt: data?.tosAcceptedAt || null,
		subscriptions: data?.subscriptions || {},
		autoRenew: data?.autoRenew ?? data?.auto_renew ?? true,
		cardLast4: data?.cardLast4 || data?.card_last4 || null,
		cardBrand: data?.cardBrand || data?.card_brand || null
	};
}
