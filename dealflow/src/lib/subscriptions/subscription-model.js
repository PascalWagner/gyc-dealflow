function isPlainObject(value) {
	return !!value && typeof value === 'object' && !Array.isArray(value);
}

function normalizeBooleanValue(value, fallback = false) {
	if (value === true || value === false) return value;
	if (value === 'true') return true;
	if (value === 'false') return false;
	return fallback;
}

function normalizeStringValue(value) {
	const normalized = String(value || '').trim();
	return normalized || null;
}

function normalizeDateValue(value) {
	if (value instanceof Date) {
		return Number.isNaN(value.getTime()) ? null : value.toISOString();
	}

	if (typeof value === 'number' && Number.isFinite(value)) {
		const candidate = new Date(value);
		return Number.isNaN(candidate.getTime()) ? null : candidate.toISOString();
	}

	const normalized = String(value || '').trim();
	if (!normalized) return null;
	return Number.isNaN(Date.parse(normalized)) ? null : normalized;
}

function toTimestamp(value) {
	const normalized = normalizeDateValue(value);
	if (!normalized) return null;
	const timestamp = Date.parse(normalized);
	return Number.isFinite(timestamp) ? timestamp : null;
}

export function normalizeSubscriptionStatus(value) {
	const normalized = String(value || '').trim().toLowerCase();
	return normalized || 'inactive';
}

export function normalizeProductType(value) {
	return String(value || '').trim().toLowerCase();
}

export function normalizeSubscriptionRecord(value = {}) {
	const candidate = isPlainObject(value) ? value : {};

	return {
		id: candidate.id || null,
		user_id: candidate.user_id || candidate.userId || null,
		product_type: normalizeProductType(candidate.product_type || candidate.productType),
		status: normalizeSubscriptionStatus(candidate.status),
		start_date: normalizeDateValue(candidate.start_date || candidate.startDate),
		end_date: normalizeDateValue(candidate.end_date || candidate.endDate),
		renewal_date: normalizeDateValue(candidate.renewal_date || candidate.renewalDate),
		is_lifetime: normalizeBooleanValue(candidate.is_lifetime ?? candidate.isLifetime, false),
		billing_provider: normalizeStringValue(candidate.billing_provider || candidate.billingProvider),
		external_subscription_id: normalizeStringValue(
			candidate.external_subscription_id || candidate.externalSubscriptionId
		),
		external_product_id: normalizeStringValue(candidate.external_product_id || candidate.externalProductId),
		external_price_id: normalizeStringValue(candidate.external_price_id || candidate.externalPriceId),
		billing_management_url: normalizeStringValue(
			candidate.billing_management_url || candidate.billingManagementUrl
		),
		created_at: normalizeDateValue(candidate.created_at || candidate.createdAt),
		updated_at: normalizeDateValue(candidate.updated_at || candidate.updatedAt)
	};
}

export function normalizeSubscriptions(value) {
	if (Array.isArray(value)) {
		return value
			.map((entry) => normalizeSubscriptionRecord(entry))
			.filter((entry) => entry.product_type);
	}

	if (isPlainObject(value)) {
		if (
			value.product_type ||
			value.productType ||
			value.start_date ||
			value.startDate ||
			value.end_date ||
			value.endDate
		) {
			const entry = normalizeSubscriptionRecord(value);
			return entry.product_type ? [entry] : [];
		}

		return Object.entries(value)
			.map(([productType, entry]) =>
				normalizeSubscriptionRecord({
					product_type: productType,
					...(isPlainObject(entry) ? entry : {})
				})
			)
			.filter((entry) => entry.product_type);
	}

	return [];
}

export function getSubscriptionForProduct(value, productType) {
	const normalizedProductType = normalizeProductType(productType);
	if (!normalizedProductType) return null;
	return normalizeSubscriptions(value).find((entry) => entry.product_type === normalizedProductType) || null;
}

export function isSubscriptionActive(value, now = Date.now()) {
	const subscription = normalizeSubscriptionRecord(value);
	const start = toTimestamp(subscription.start_date);
	const end = toTimestamp(subscription.end_date);
	const status = normalizeSubscriptionStatus(subscription.status);

	if (!['active', 'trial'].includes(status)) return false;

	if (start === null) return false;
	if (now < start) return false;
	if (end !== null && now > end) return false;
	return true;
}

export function getSubscriptionPhase(value, now = Date.now()) {
	const subscription = normalizeSubscriptionRecord(value);
	const start = toTimestamp(subscription.start_date);
	const end = toTimestamp(subscription.end_date);
	const status = normalizeSubscriptionStatus(subscription.status);

	if (status === 'expired') return 'expired';
	if (status === 'canceled' || status === 'paused') return 'inactive';
	if (status === 'pending') return 'upcoming';

	if (start === null) {
		return status === 'trial' ? 'upcoming' : 'inactive';
	}

	if (now < start) return 'upcoming';
	if (end !== null && now > end) return 'expired';
	if (isSubscriptionActive(subscription, now)) return 'active';
	return status === 'trial' ? 'upcoming' : 'inactive';
}

export function buildMembershipSummary(value, {
	productType = 'academy',
	autoRenew = null,
	now = Date.now()
} = {}) {
	const normalizedProductType = normalizeProductType(productType);
	const subscription = value
		? normalizeSubscriptionRecord({
			product_type: normalizedProductType,
			...value
		})
		: null;
	const phase = subscription ? getSubscriptionPhase(subscription, now) : 'inactive';
	const shouldExposeRenewal = autoRenew !== false;
	const billingState = !subscription
		? 'none'
		: subscription.is_lifetime
			? 'lifetime'
			: subscription.external_subscription_id && subscription.billing_management_url
				? 'manage'
				: subscription.external_subscription_id
					? 'subscription'
					: 'renewal';

	return {
		id: subscription?.id || null,
		product_type: normalizedProductType,
		status: phase,
		start_date: subscription?.start_date || null,
		end_date: subscription?.end_date || null,
		is_lifetime: subscription?.is_lifetime === true,
		billing_state: billingState,
		billing_provider: subscription?.billing_provider || null,
		external_subscription_id: subscription?.external_subscription_id || null,
		external_product_id: subscription?.external_product_id || null,
		external_price_id: subscription?.external_price_id || null,
		billing_management_url: subscription?.billing_management_url || null,
		renewal_date:
			!subscription?.is_lifetime && shouldExposeRenewal && (phase === 'active' || phase === 'upcoming')
				? subscription?.renewal_date || subscription?.end_date || null
				: null
	};
}
