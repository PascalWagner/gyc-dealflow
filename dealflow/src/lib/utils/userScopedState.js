import { browser } from '$app/environment';

export const ADMIN_REAL_USER_KEY = '_gycAdminRealUser';

const SCOPED_BUNDLE_PREFIX = '_scopedBundle_';

const STATIC_SCOPED_KEYS = [
	'gycPortfolio',
	'gycDealStages',
	'gycBuyBox',
	'gycBuyBoxWizard',
	'gycBuyBoxComplete',
	'gycGoals',
	'gycDistributions',
	'gycFirstActivity',
	'gycOnboardingComplete',
	'gycFundNudgeDismissed',
	'gycTaxDocs',
	'gycPortfolioPlan',
	'gycDeckViews',
	'gycQAUpvoted',
	'gycIntroRequests',
	'gycCompareDeals',
	'gycNotifPrefs'
];

const PREFIX_SCOPED_KEYS = [
	'gycDDChecklist_',
	'gycDeckViewed_',
	'gycIntroCount_',
	'gycIntroRequested_',
	'gycDailyDeals_'
];

function safeJsonParse(value, fallback) {
	try {
		return JSON.parse(value);
	} catch {
		return fallback;
	}
}

function storage() {
	return browser ? window.localStorage : null;
}

function scopedKeyList() {
	if (!browser) return [];
	const keys = new Set(STATIC_SCOPED_KEYS);
	for (let i = 0; i < localStorage.length; i += 1) {
		const key = localStorage.key(i);
		if (!key) continue;
		if (PREFIX_SCOPED_KEYS.some((prefix) => key.startsWith(prefix))) {
			keys.add(key);
		}
	}
	return [...keys];
}

export function clearUserScopedData() {
	if (!browser) return;
	for (const key of scopedKeyList()) {
		localStorage.removeItem(key);
	}
}

export function saveUserScopedData(email) {
	if (!browser || !email) return;
	const bundle = {};
	for (const key of scopedKeyList()) {
		const value = localStorage.getItem(key);
		if (value !== null) {
			bundle[key] = value;
		}
	}
	localStorage.setItem(`${SCOPED_BUNDLE_PREFIX}${email}`, JSON.stringify(bundle));
}

export function loadUserScopedData(email) {
	if (!browser || !email) return false;
	clearUserScopedData();
	const saved = localStorage.getItem(`${SCOPED_BUNDLE_PREFIX}${email}`);
	if (!saved) return false;
	const bundle = safeJsonParse(saved, {});
	for (const [key, value] of Object.entries(bundle)) {
		localStorage.setItem(key, value);
	}
	return true;
}

function persistJson(key, value) {
	if (!browser) return;
	if (value === null || value === undefined) {
		localStorage.removeItem(key);
		return;
	}
	localStorage.setItem(key, JSON.stringify(value));
}

function persistString(key, value) {
	if (!browser) return;
	if (value === null || value === undefined || value === '') {
		localStorage.removeItem(key);
		return;
	}
	localStorage.setItem(key, value);
}

function mapPortfolio(rows) {
	return (rows || []).map((row) => ({
		id: row.id || `inv_${Math.random().toString(36).slice(2, 9)}`,
		dealId: row.deal_id || '',
		investmentName: row.investment_name || '',
		sponsor: row.sponsor || '',
		assetClass: row.asset_class || '',
		amountInvested: row.amount_invested || 0,
		dateInvested: row.date_invested || '',
		status: row.status || 'Active',
		targetIRR: row.target_irr || '',
		distributionsReceived: row.distributions_received || 0,
		holdPeriod: row.hold_period || '',
		investingEntity: row.investing_entity || '',
		entityInvestedInto: row.entity_invested_into || '',
		notes: row.notes || '',
		_recordId: row.id || undefined
	}));
}

function mapStages(rows) {
	const stages = {};
	for (const row of rows || []) {
		if (row.deal_id && row.stage) {
			stages[row.deal_id] = row.stage;
		}
	}
	return stages;
}

function mapGoals(rows) {
	const goal = rows?.[0];
	if (!goal) return null;
	return {
		goalType: goal.goal_type || 'passive_income',
		currentIncome: goal.current_income || 0,
		targetIncome: goal.target_income || 0,
		capitalAvailable: goal.capital_available || '',
		timeline: goal.timeline || '5',
		taxReduction: goal.tax_reduction || 0
	};
}

function mapTaxDocs(rows) {
	return (rows || []).map((row) => ({
		id: row.id,
		taxYear: row.tax_year || '',
		investmentName: row.investment_name || '',
		investingEntity: row.investing_entity || '',
		entityInvestedInto: row.entity_invested_into || '',
		formType: row.form_type || '',
		uploadStatus: row.upload_status || 'Pending',
		dateReceived: row.date_received || '',
		fileUrl: row.file_url || '',
		portalUrl: row.portal_url || '',
		contactName: row.contact_name || '',
		contactEmail: row.contact_email || '',
		contactPhone: row.contact_phone || '',
		notes: row.notes || '',
		_recordId: row.id || undefined
	}));
}

function mapPlan(rows) {
	const plan = rows?.[0];
	if (!plan) return null;
	return {
		...plan,
		target_income: plan.target_income || plan.target_annual_income || null,
		target_annual_income: plan.target_annual_income || plan.target_income || null,
		slots: Array.isArray(plan.slots) ? plan.slots : Array.isArray(plan.buckets) ? plan.buckets : [],
		buckets: Array.isArray(plan.buckets) ? plan.buckets : Array.isArray(plan.slots) ? plan.slots : []
	};
}

async function fetchJson(url, headers = {}) {
	const response = await fetch(url, { headers });
	if (!response.ok) {
		throw new Error(`${response.status} ${response.statusText}`);
	}
	return response.json();
}

async function fetchCurrentUserBundle(token) {
	const headers = { Authorization: `Bearer ${token}` };
	const types = ['portfolio', 'stages', 'goals', 'taxdocs', 'plan'];
	const entries = await Promise.all(types.map(async (type) => {
		const data = await fetchJson(`/api/userdata?type=${type}`, headers);
		return [type, data?.records || []];
	}));
	return Object.fromEntries(entries);
}

async function fetchAdminBundle(token, email) {
	return fetchJson(`/api/userdata?admin=true&email=${encodeURIComponent(email)}`, {
		Authorization: `Bearer ${token}`
	});
}

function applyUserBundle(bundle, buyBox) {
	persistJson('gycPortfolio', mapPortfolio(bundle?.portfolio || []));
	persistJson('gycDealStages', mapStages(bundle?.stages || []));
	persistJson('gycGoals', mapGoals(bundle?.goals || []));
	persistJson('gycTaxDocs', mapTaxDocs(bundle?.taxdocs || []));
	persistJson('gycPortfolioPlan', mapPlan(bundle?.plan || []));

	if (buyBox && Object.keys(buyBox).length > 0) {
		persistJson('gycBuyBox', buyBox);
		persistJson('gycBuyBoxWizard', buyBox);
		if (buyBox._branch || buyBox.goal) {
			persistString('gycBuyBoxComplete', 'true');
		}
	} else {
		localStorage.removeItem('gycBuyBox');
		localStorage.removeItem('gycBuyBoxWizard');
		localStorage.removeItem('gycBuyBoxComplete');
	}
}

export function currentAdminRealUser() {
	if (!browser) return null;
	return safeJsonParse(localStorage.getItem(ADMIN_REAL_USER_KEY), null);
}

export async function hydrateUserScopedData({ email, token, adminEmail } = {}) {
	if (!browser || !email || !token) return { ok: false, reason: 'missing-auth' };

	let bundle = null;
	let buyBox = {};

	try {
		bundle = adminEmail && adminEmail.toLowerCase() !== email.toLowerCase()
			? await fetchAdminBundle(token, email)
			: await fetchCurrentUserBundle(token);
	} catch (error) {
		return { ok: false, reason: 'userdata-failed', error };
	}

	try {
		const buyBoxResponse = await fetchJson(`/api/buybox?email=${encodeURIComponent(email)}`, {
			Authorization: `Bearer ${token}`
		});
		buyBox = buyBoxResponse?.buyBox || {};
	} catch {
		buyBox = {};
	}

	applyUserBundle(bundle, buyBox);
	saveUserScopedData(email);
	return { ok: true, bundle, buyBox };
}

export function inferAdminEmailForSession(sessionUser) {
	const realUser = currentAdminRealUser();
	if (realUser?.email && realUser.email.toLowerCase() !== sessionUser?.email?.toLowerCase()) {
		return realUser.email;
	}
	return null;
}

export function restoreScopedUserState(sessionUser) {
	if (!browser || !sessionUser?.email) return;
	loadUserScopedData(sessionUser.email);
}
