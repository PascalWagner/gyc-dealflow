import { browser } from '$app/environment';
import { getStoredSessionUser } from '$lib/stores/auth.js';
import {
	readUserScopedJson,
	readUserScopedString,
	writeUserScopedJson,
	writeUserScopedString
} from '$lib/utils/userScopedState.js';

export const DAILY_INTRO_REQUEST_LIMIT = 3;

function getDealScopedKey(prefix, dealId) {
	return dealId ? `${prefix}_${dealId}` : prefix;
}

function getTodayIntroKey() {
	return `gycIntroCount_${new Date().toISOString().split('T')[0]}`;
}

export function getDealOperatorInfo(deal) {
	const sponsors = Array.isArray(deal?.sponsors) ? deal.sponsors : [];
	const operator = sponsors.find((sponsor) => sponsor?.role === 'operator');

	return {
		name: operator?.name || deal?.managementCompany || 'the operator',
		ceo: operator?.ceo || deal?.ceo || '',
		foundingYear: operator?.foundingYear || deal?.mcFoundingYear || null,
		website: operator?.website || deal?.mcWebsite || '',
		managementCompanyId: deal?.managementCompanyId || operator?.managementCompanyId || ''
	};
}

export function hasRequestedDealIntroduction(dealId) {
	if (!browser || !dealId) return false;
	return !!readUserScopedString(getDealScopedKey('gycIntroRequested', dealId), '');
}

export function getDailyIntroRequestCount() {
	if (!browser) return 0;
	return parseInt(readUserScopedString(getTodayIntroKey(), '0'), 10) || 0;
}

export function getDealIntroductionRequestGate(dealId) {
	if (!dealId) {
		return { ok: false, message: 'Deal unavailable.' };
	}

	if (hasRequestedDealIntroduction(dealId)) {
		return {
			ok: false,
			message: "You've already requested an intro for this deal."
		};
	}

	if (getDailyIntroRequestCount() >= DAILY_INTRO_REQUEST_LIMIT) {
		return {
			ok: false,
			message: `You've reached the daily limit of ${DAILY_INTRO_REQUEST_LIMIT} introduction requests. Try again tomorrow.`
		};
	}

	return { ok: true };
}

function persistIntroRequestState({ deal, operatorName, userEmail }) {
	writeUserScopedString(getDealScopedKey('gycIntroRequested', deal.id), String(Date.now()));
	writeUserScopedString(getTodayIntroKey(), String(getDailyIntroRequestCount() + 1));

	try {
		let introRequests = readUserScopedJson('gycIntroRequests', []);
		if (!Array.isArray(introRequests)) introRequests = [];
		introRequests.push({
			dealId: deal.id,
			deal: deal.investmentName,
			company: operatorName,
			userEmail,
			timestamp: Date.now()
		});
		writeUserScopedJson('gycIntroRequests', introRequests);
	} catch {}
}

export async function submitDealIntroductionRequest({ deal, message = '' }) {
	if (!browser || !deal) {
		return { success: false, error: 'Deal unavailable.' };
	}

	const stored = getStoredSessionUser() || {};
	if (!stored?.token) {
		return { success: false, error: 'Missing session token.' };
	}

	const operator = getDealOperatorInfo(deal);

	try {
		const response = await fetch('/api/intro-request', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${stored.token}`
			},
			body: JSON.stringify({
				dealId: deal.id,
				dealName: deal.investmentName,
				operatorName: operator.name,
				operatorCeo: operator.ceo || '',
				managementCompanyId: operator.managementCompanyId || '',
				message
			})
		});
		const data = await response.json().catch(() => ({}));

		if (!response.ok || !data?.success) {
			return {
				success: false,
				error: data?.error || 'Something went wrong. Please try again.'
			};
		}

		persistIntroRequestState({
			deal,
			operatorName: operator.name,
			userEmail: stored.email || ''
		});

		return {
			success: true,
			operatorName: operator.name,
			operatorCeo: operator.ceo || '',
			managementCompanyId: operator.managementCompanyId || ''
		};
	} catch {
		return {
			success: false,
			error: 'Something went wrong. Please try again.'
		};
	}
}
