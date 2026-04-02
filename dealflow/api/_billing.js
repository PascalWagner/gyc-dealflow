import { optionalServerEnv } from './_env.js';

function normalizeString(value) {
	return String(value || '').trim();
}

function normalizeIdentifier(value) {
	return normalizeString(value).toLowerCase();
}

function normalizeUrl(value) {
	const normalized = normalizeString(value);
	if (!normalized) return '';
	return /^https?:\/\//i.test(normalized) ? normalized : '';
}

function toNumber(value) {
	if (typeof value === 'number' && Number.isFinite(value)) return value;
	const normalized = Number.parseFloat(String(value || '').replace(/[^0-9.]/g, ''));
	return Number.isFinite(normalized) ? normalized : null;
}

function readPath(source, path) {
	const segments = Array.isArray(path) ? path : String(path || '').split('.');
	let current = source;
	for (const segment of segments) {
		if (!current || typeof current !== 'object' || !(segment in current)) return null;
		current = current[segment];
	}
	return current;
}

function firstTruthy(values = []) {
	for (const value of values) {
		const normalized = normalizeString(value);
		if (normalized) return normalized;
	}
	return '';
}

export const GHL_MEMBERSHIP_PRODUCTS = {
	academy: {
		product_id: '66929478eba692596c0c40fe',
		product_name: 'Cashflow Academy',
		prices: {
			v1: { price_id: '66929478eba6921b2d0c4100', label: 'v1', amount: 497, type: 'onetime' },
			v2: { price_id: '66a6eddac394ce4da2fe84b4', label: 'v2', amount: 997, type: 'onetime' },
			v3: { price_id: '67be2d9b96f50bce5f98b76f', label: 'v3', amount: 1997, type: 'onetime' },
			v4: { price_id: '67be2dbe279d992a4c6265c3', label: 'v4', amount: 2997, type: 'onetime' },
			v4_split: {
				price_id: '6862d0a43c7f7eabb4e763f8',
				label: 'v4 split into 2 Payments',
				amount: 1700,
				type: 'recurring',
				interval: 'monthly',
				number_of_payments: 2
			},
			v5: {
				price_id: '695bc76422b76a7309a7584d',
				label: 'v5 Mastermind',
				amount: 5000,
				type: 'onetime'
			},
			v5_plan: {
				price_id: '695bd26c46f57fb003c6b8d1',
				label: 'v5 Mastermind (3 Payments)',
				amount: 2000,
				type: 'recurring',
				interval: 'monthly',
				number_of_payments: 3
			},
			founding_pass: {
				price_id: '6966415ab2d0aa8444fb40f1',
				label: 'Founding Member Pass',
				amount: 0,
				type: 'onetime'
			}
		}
	},
	renewal: {
		product_id: '68f7c1cc1d728b4f70476fb2',
		product_name: 'Deal Flow Membership',
		prices: {
			monthly: {
				price_id: '68f7c1cc1d728b3be7476fb7',
				label: 'Monthly Membership',
				amount: 29,
				type: 'recurring',
				interval: 'monthly'
			},
			annual: {
				price_id: '68fbbb4339785666d714ae60',
				label: 'Annual Membership',
				amount: 250,
				type: 'recurring',
				interval: 'yearly'
			}
		}
	}
};

const ACADEMY_PRICE_IDS = new Set(
	Object.values(GHL_MEMBERSHIP_PRODUCTS.academy.prices).map((entry) => normalizeIdentifier(entry.price_id))
);

function renewalOptionFromPrice(key, price, envName) {
	const checkoutUrl = normalizeUrl(optionalServerEnv(envName, ''));
	return {
		key,
		product_name: GHL_MEMBERSHIP_PRODUCTS.renewal.product_name,
		product_id: GHL_MEMBERSHIP_PRODUCTS.renewal.product_id,
		price_id: price.price_id,
		label: price.label,
		amount: price.amount,
		amount_label: key === 'annual' ? '$250/yr' : '$29/mo',
		description:
			key === 'annual'
				? 'Renew yearly through Deal Flow Membership.'
				: 'Renew monthly through Deal Flow Membership.',
		recurring_interval: price.interval,
		checkout_url: checkoutUrl || null,
		available: Boolean(checkoutUrl)
	};
}

export function getRenewalCheckoutOptions() {
	return [
		renewalOptionFromPrice('annual', GHL_MEMBERSHIP_PRODUCTS.renewal.prices.annual, 'GHL_RENEWAL_ANNUAL_URL'),
		renewalOptionFromPrice('monthly', GHL_MEMBERSHIP_PRODUCTS.renewal.prices.monthly, 'GHL_RENEWAL_MONTHLY_URL')
	];
}

export function extractGhlBillingIdentifiers(body = {}) {
	const productId = normalizeIdentifier(
		firstTruthy([
			readPath(body, 'product_id'),
			readPath(body, 'productId'),
			readPath(body, 'product.id'),
			readPath(body, 'product.product_id'),
			readPath(body, 'line_item.product_id'),
			readPath(body, 'lineItem.product_id')
		])
	);
	const priceId = normalizeIdentifier(
		firstTruthy([
			readPath(body, 'price_id'),
			readPath(body, 'priceId'),
			readPath(body, 'price.id'),
			readPath(body, 'price.price_id'),
			readPath(body, 'line_item.price_id'),
			readPath(body, 'lineItem.price_id')
		])
	);
	const subscriptionId = normalizeString(
		firstTruthy([
			readPath(body, 'subscription_id'),
			readPath(body, 'subscriptionId'),
			readPath(body, 'subscription.id')
		])
	);
	const billingManagementUrl = normalizeUrl(
		firstTruthy([
			readPath(body, 'billing_management_url'),
			readPath(body, 'payment_update_link'),
			readPath(body, 'paymentUpdateLink')
		])
	);

	return {
		productId,
		priceId,
		subscriptionId: subscriptionId || null,
		billingManagementUrl: billingManagementUrl || null
	};
}

export function classifyGhlBillingEvent(body = {}) {
	const { productId, priceId, subscriptionId, billingManagementUrl } = extractGhlBillingIdentifiers(body);
	const amount = toNumber(body.amount ?? body.total ?? body.price ?? null);
	const productName = normalizeString(
		body.product_name || body.product || body.name || readPath(body, 'product.name') || readPath(body, 'price.name')
	).toLowerCase();

	if (priceId === normalizeIdentifier(GHL_MEMBERSHIP_PRODUCTS.renewal.prices.annual.price_id)) {
		return {
			kind: 'renewal_annual',
			product_type: 'academy',
			external_product_id: GHL_MEMBERSHIP_PRODUCTS.renewal.product_id,
			external_price_id: GHL_MEMBERSHIP_PRODUCTS.renewal.prices.annual.price_id,
			external_subscription_id: subscriptionId,
			billing_provider: 'ghl',
			billing_management_url: billingManagementUrl,
			interval: 'yearly'
		};
	}

	if (priceId === normalizeIdentifier(GHL_MEMBERSHIP_PRODUCTS.renewal.prices.monthly.price_id)) {
		return {
			kind: 'renewal_monthly',
			product_type: 'academy',
			external_product_id: GHL_MEMBERSHIP_PRODUCTS.renewal.product_id,
			external_price_id: GHL_MEMBERSHIP_PRODUCTS.renewal.prices.monthly.price_id,
			external_subscription_id: subscriptionId,
			billing_provider: 'ghl',
			billing_management_url: billingManagementUrl,
			interval: 'monthly'
		};
	}

	if (ACADEMY_PRICE_IDS.has(priceId)) {
		return {
			kind: 'academy_purchase',
			product_type: 'academy',
			external_product_id: GHL_MEMBERSHIP_PRODUCTS.academy.product_id,
			external_price_id: priceId,
			external_subscription_id: subscriptionId,
			billing_provider: 'ghl',
			billing_management_url: billingManagementUrl
		};
	}

	if (productId === normalizeIdentifier(GHL_MEMBERSHIP_PRODUCTS.renewal.product_id) || productName.includes('deal flow membership')) {
		if (amount === 250) {
			return {
				kind: 'renewal_annual',
				product_type: 'academy',
				external_product_id: GHL_MEMBERSHIP_PRODUCTS.renewal.product_id,
				external_price_id: GHL_MEMBERSHIP_PRODUCTS.renewal.prices.annual.price_id,
				external_subscription_id: subscriptionId,
				billing_provider: 'ghl',
				billing_management_url: billingManagementUrl,
				interval: 'yearly'
			};
		}

		if (amount === 29) {
			return {
				kind: 'renewal_monthly',
				product_type: 'academy',
				external_product_id: GHL_MEMBERSHIP_PRODUCTS.renewal.product_id,
				external_price_id: GHL_MEMBERSHIP_PRODUCTS.renewal.prices.monthly.price_id,
				external_subscription_id: subscriptionId,
				billing_provider: 'ghl',
				billing_management_url: billingManagementUrl,
				interval: 'monthly'
			};
		}
	}

	if (amount === 250) {
		return {
			kind: 'renewal_annual',
			product_type: 'academy',
			external_product_id: GHL_MEMBERSHIP_PRODUCTS.renewal.product_id,
			external_price_id: GHL_MEMBERSHIP_PRODUCTS.renewal.prices.annual.price_id,
			external_subscription_id: subscriptionId,
			billing_provider: 'ghl',
			billing_management_url: billingManagementUrl,
			interval: 'yearly'
		};
	}

	if (amount === 29) {
		return {
			kind: 'renewal_monthly',
			product_type: 'academy',
			external_product_id: GHL_MEMBERSHIP_PRODUCTS.renewal.product_id,
			external_price_id: GHL_MEMBERSHIP_PRODUCTS.renewal.prices.monthly.price_id,
			external_subscription_id: subscriptionId,
			billing_provider: 'ghl',
			billing_management_url: billingManagementUrl,
			interval: 'monthly'
		};
	}

	if (
		productId === normalizeIdentifier(GHL_MEMBERSHIP_PRODUCTS.academy.product_id) ||
		productName.includes('cashflow academy') ||
		productName.includes('mastermind') ||
		(amount !== null && amount >= 497)
	) {
		return {
			kind: 'academy_purchase',
			product_type: 'academy',
			external_product_id: GHL_MEMBERSHIP_PRODUCTS.academy.product_id,
			external_price_id: priceId || null,
			external_subscription_id: subscriptionId,
			billing_provider: 'ghl',
			billing_management_url: billingManagementUrl
		};
	}

	return null;
}
