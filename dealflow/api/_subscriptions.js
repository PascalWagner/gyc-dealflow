import {
	buildMembershipSummary,
	isSubscriptionActive,
	normalizeProductType,
	normalizeSubscriptionRecord
} from '../src/lib/subscriptions/subscription-model.js';
import { optionalServerEnv } from './_env.js';
import { deriveTier, ghlFetch } from './_supabase.js';

export const SUBSCRIPTIONS_TABLE = 'subscriptions';
const PRODUCT_FIELDS = [
	'id',
	'user_id',
	'product_type',
	'status',
	'start_date',
	'end_date',
	'renewal_date',
	'is_lifetime',
	'billing_provider',
	'external_subscription_id',
	'external_product_id',
	'external_price_id',
	'billing_management_url',
	'created_at',
	'updated_at'
].join(', ');
const ACADEMY_GHL_FALLBACK_END_DATE = optionalServerEnv(
	'ACADEMY_GHL_FALLBACK_END_DATE',
	'2026-12-31T23:59:59.000Z'
);
const GHL_PRODUCT_CONFIG = {
	academy: {
		membershipTags: new Set([
			'bought cashflow academy',
			'dealflow-academy',
			'academy-member',
			'academy member',
			'cashflow-academy'
		]),
		startFieldMatchers: ['contact.acceptance_date', /academy start date/i],
		endFieldMatchers: ['contact.academy_end_date', /academy end date/i],
		renewalFieldMatchers: ['contact.academy_renewal_date', /academy renewal date/i],
		defaultEndDate: ACADEMY_GHL_FALLBACK_END_DATE
	}
};

let ghlCustomFieldMapPromise = null;

const LEGACY_ACADEMY_TIERS = new Set([
	'academy',
	'alumni',
	'investor',
	'paid',
	'founding',
	'inner-circle',
	'family_office',
	'family-office',
	'member'
]);

function isPlainObject(value) {
	return !!value && typeof value === 'object' && !Array.isArray(value);
}

function normalizeTier(value) {
	return String(value || '').trim().toLowerCase();
}

function normalizeString(value) {
	return String(value || '').trim();
}

function normalizeMatcherValue(value) {
	return normalizeString(value).toLowerCase();
}

function normalizeTagSet(value) {
	if (!Array.isArray(value)) return new Set();
	return new Set(value.map((entry) => normalizeMatcherValue(entry)).filter(Boolean));
}

function normalizeFieldText(value) {
	return normalizeString(value).toLowerCase();
}

function normalizeFieldValue(value) {
	if (Array.isArray(value)) {
		if (value.length === 0) return null;
		return normalizeFieldValue(value[0]);
	}

	if (value && typeof value === 'object') {
		return null;
	}

	const normalized = normalizeString(value);
	return normalized || null;
}

function productConfigFor(productType) {
	return GHL_PRODUCT_CONFIG[normalizeProductType(productType)] || null;
}

function matchesCustomField(definition, matcher) {
	if (!definition) return false;

	if (matcher instanceof RegExp) {
		return (
			matcher.test(definition.name || '') ||
			matcher.test(definition.fieldKey || '') ||
			matcher.test(definition.id || '')
		);
	}

	const normalizedMatcher = normalizeMatcherValue(matcher);
	return (
		normalizeFieldText(definition.id) === normalizedMatcher ||
		normalizeFieldText(definition.name) === normalizedMatcher ||
		normalizeFieldText(definition.fieldKey) === normalizedMatcher
	);
}

function findCustomFieldValue(fields, matchers = []) {
	for (const matcher of matchers) {
		const entry = fields.find((field) => matchesCustomField(field, matcher) && field.value);
		if (entry?.value) return entry.value;
	}
	return null;
}

function hasLegacySubscriptionWindow(profile, productType = 'academy') {
	if (!isPlainObject(profile)) return false;
	const normalizedProductType = normalizeProductType(productType);
	if (normalizedProductType !== 'academy') return false;
	return Boolean(
		profile.academy_start || profile.academyStart || profile.academy_end || profile.academyEnd
	);
}

async function getGhlCustomFieldMap() {
	if (!ghlCustomFieldMapPromise) {
		ghlCustomFieldMapPromise = (async () => {
			const response = await ghlFetch('https://rest.gohighlevel.com/v1/custom-fields/');
			if (!response?.ok) return new Map();

			const payload = await response.json().catch(() => ({}));
			const fields = Array.isArray(payload?.customFields) ? payload.customFields : [];
			return new Map(
				fields
					.filter((entry) => normalizeString(entry?.id))
					.map((entry) => [
						entry.id,
						{
							id: entry.id,
							name: normalizeString(entry.name),
							fieldKey: normalizeString(entry.fieldKey),
							dataType: normalizeString(entry.dataType || entry.type)
						}
					])
			);
		})().catch((error) => {
			ghlCustomFieldMapPromise = null;
			throw error;
		});
	}

	return ghlCustomFieldMapPromise;
}

async function getGhlContact({ email = '', contactId = '' } = {}) {
	const normalizedContactId = normalizeString(contactId);
	if (normalizedContactId) {
		const response = await ghlFetch(
			`https://rest.gohighlevel.com/v1/contacts/${encodeURIComponent(normalizedContactId)}`
		);
		if (!response?.ok) return null;
		const payload = await response.json().catch(() => ({}));
		return payload?.contact || null;
	}

	const normalizedEmail = normalizeMatcherValue(email);
	if (!normalizedEmail) return null;

	const lookupResponse = await ghlFetch(
		`https://rest.gohighlevel.com/v1/contacts/lookup?email=${encodeURIComponent(normalizedEmail)}`
	);
	if (!lookupResponse?.ok) return null;

	const lookupPayload = await lookupResponse.json().catch(() => ({}));
	const matchedContact = (lookupPayload?.contacts || []).find(
		(entry) => normalizeMatcherValue(entry?.email) === normalizedEmail
	);
	if (!matchedContact?.id) return matchedContact || null;

	const response = await ghlFetch(
		`https://rest.gohighlevel.com/v1/contacts/${encodeURIComponent(matchedContact.id)}`
	);
	if (!response?.ok) return matchedContact;

	const payload = await response.json().catch(() => ({}));
	return payload?.contact || matchedContact;
}

export async function buildGhlSubscriptionFromContact(contact, productType, {
	fallbackProfile = null
} = {}) {
	const normalizedProductType = normalizeProductType(productType);
	const config = productConfigFor(normalizedProductType);
	if (!config || !isPlainObject(contact)) return null;

	const customFieldMap = await getGhlCustomFieldMap();
	const hydratedFields = (Array.isArray(contact.customField || contact.customFields)
		? contact.customField || contact.customFields
		: []
	)
		.map((entry) => {
			const definition = customFieldMap.get(entry?.id) || { id: normalizeString(entry?.id) };
			return {
				...definition,
				value: normalizeFieldValue(entry?.value)
			};
		})
		.filter((entry) => entry.id);

	const tags = normalizeTagSet(contact.tags);
	const derivedTier = normalizeTier(deriveTier(contact.tags || []));
	const hasMembershipSignal =
		[...config.membershipTags].some((tag) => tags.has(tag)) ||
		(normalizedProductType === 'academy' && LEGACY_ACADEMY_TIERS.has(derivedTier));

	if (!hasMembershipSignal) return null;

	const startDate =
		findCustomFieldValue(hydratedFields, config.startFieldMatchers) ||
		fallbackProfile?.academy_start ||
		fallbackProfile?.academyStart ||
		null;
	const endDate =
		findCustomFieldValue(hydratedFields, config.endFieldMatchers) ||
		fallbackProfile?.academy_end ||
		fallbackProfile?.academyEnd ||
		config.defaultEndDate ||
		null;
	const renewalDate =
		findCustomFieldValue(hydratedFields, config.renewalFieldMatchers) || endDate || null;

	return normalizeSubscriptionRecord({
		product_type: normalizedProductType,
		status: 'active',
		start_date: startDate,
		end_date: endDate,
		renewal_date: renewalDate,
		created_at:
			contact.dateAdded ||
			contact.date_added ||
			fallbackProfile?.created_at ||
			fallbackProfile?.createdAt ||
			null,
		updated_at:
			contact.dateUpdated ||
			contact.date_updated ||
			fallbackProfile?.updated_at ||
			fallbackProfile?.updatedAt ||
			null
	});
}

export function isMissingSubscriptionsTableError(error) {
	const message = String(error?.message || '');
	return (
		message.includes(`Could not find the table 'public.${SUBSCRIPTIONS_TABLE}' in the schema cache`) ||
		message.includes(`relation "public.${SUBSCRIPTIONS_TABLE}" does not exist`) ||
		message.includes(`relation "${SUBSCRIPTIONS_TABLE}" does not exist`)
	);
}

export function buildLegacySubscriptionFromProfile(profile, productType = 'academy') {
	const candidate = isPlainObject(profile) ? profile : {};
	const normalizedProductType = normalizeProductType(productType);
	const legacyStart = candidate.academy_start || candidate.academyStart || null;
	const legacyEnd = candidate.academy_end || candidate.academyEnd || null;
	if (normalizedProductType !== 'academy') return null;
	if (!legacyStart && !legacyEnd) return null;

	return normalizeSubscriptionRecord({
		product_type: normalizedProductType,
		status: legacyEnd && Date.parse(legacyEnd) < Date.now() ? 'expired' : 'active',
		start_date: legacyStart || null,
		end_date: legacyEnd,
		renewal_date:
			(candidate.auto_renew ?? candidate.autoRenew ?? true) && legacyEnd ? legacyEnd : null,
		created_at: candidate.created_at || candidate.createdAt || null,
		updated_at: candidate.updated_at || candidate.updatedAt || null
	});
}

export async function listProductSubscriptions(client, userId, productType) {
	const normalizedProductType = normalizeProductType(productType);
	if (!client || !userId || !normalizedProductType) return [];

	const { data, error } = await client
		.from(SUBSCRIPTIONS_TABLE)
		.select(PRODUCT_FIELDS)
		.eq('user_id', userId)
		.eq('product_type', normalizedProductType)
		.order('start_date', { ascending: false, nullsFirst: false })
		.order('created_at', { ascending: false, nullsFirst: false });

	if (error) throw error;

	return (data || []).map((entry) => normalizeSubscriptionRecord(entry));
}

export async function getActiveSubscription(client, userId, productType) {
	const subscriptions = await listProductSubscriptions(client, userId, productType);
	return subscriptions.find((entry) => isSubscriptionActive(entry)) || null;
}

export async function getLatestSubscription(client, userId, productType) {
	const subscriptions = await listProductSubscriptions(client, userId, productType);
	return subscriptions[0] || null;
}

export async function getMembershipSummary(client, userId, productType, {
	autoRenew = null,
	fallbackProfile = null,
	email = '',
	contactId = ''
} = {}) {
	try {
		const activeSubscription = await getActiveSubscription(client, userId, productType);
		if (activeSubscription) {
			return buildMembershipSummary(activeSubscription, { productType, autoRenew });
		}

		const latestSubscription = await getLatestSubscription(client, userId, productType);
		if (latestSubscription) {
			return buildMembershipSummary(latestSubscription, { productType, autoRenew });
		}
	} catch (error) {
		if (!isMissingSubscriptionsTableError(error)) throw error;
	}

	const legacySubscription = buildLegacySubscriptionFromProfile(fallbackProfile, productType);
	if (hasLegacySubscriptionWindow(fallbackProfile, productType)) {
		return buildMembershipSummary(legacySubscription, {
			productType,
			autoRenew: fallbackProfile?.auto_renew ?? fallbackProfile?.autoRenew ?? autoRenew
		});
	}

	const ghlSubscription = await buildGhlSubscriptionFromContact(
		await getGhlContact({ email, contactId }),
		productType,
		{ fallbackProfile }
	);
	if (ghlSubscription) {
		return buildMembershipSummary(ghlSubscription, {
			productType,
			autoRenew: fallbackProfile?.auto_renew ?? fallbackProfile?.autoRenew ?? autoRenew
		});
	}

	return buildMembershipSummary(legacySubscription, {
		productType,
		autoRenew: fallbackProfile?.auto_renew ?? fallbackProfile?.autoRenew ?? autoRenew
	});
}
