import test from 'node:test';
import assert from 'node:assert/strict';

import {
	classifyGhlBillingEvent,
	extractGhlBillingIdentifiers,
	getRenewalCheckoutOptions
} from '../api/_billing.js';

test('extractGhlBillingIdentifiers reads common webhook identifiers', () => {
	const identifiers = extractGhlBillingIdentifiers({
		product_id: '68f7c1cc1d728b4f70476fb2',
		price: { id: '68fbbb4339785666d714ae60' },
		subscriptionId: 'sub_123',
		payment_update_link: 'https://link.fastpaydirect.com/payment-method/example-token'
	});

	assert.equal(identifiers.productId, '68f7c1cc1d728b4f70476fb2');
	assert.equal(identifiers.priceId, '68fbbb4339785666d714ae60');
	assert.equal(identifiers.subscriptionId, 'sub_123');
	assert.equal(identifiers.billingManagementUrl, 'https://link.fastpaydirect.com/payment-method/example-token');
});

test('classifyGhlBillingEvent matches annual renewal by exact GHL price id', () => {
	const event = classifyGhlBillingEvent({
		price_id: '68fbbb4339785666d714ae60',
		subscription_id: 'sub_annual'
	});

	assert.equal(event.kind, 'renewal_annual');
	assert.equal(event.external_product_id, '68f7c1cc1d728b4f70476fb2');
	assert.equal(event.external_price_id, '68fbbb4339785666d714ae60');
	assert.equal(event.external_subscription_id, 'sub_annual');
});

test('classifyGhlBillingEvent matches monthly renewal by live amount fallback', () => {
	const event = classifyGhlBillingEvent({
		amount: 29
	});

	assert.equal(event.kind, 'renewal_monthly');
	assert.equal(event.interval, 'monthly');
});

test('renewal checkout options stay present even when URLs are not configured', () => {
	const options = getRenewalCheckoutOptions();

	assert.equal(options.length, 2);
	assert.deepEqual(options.map((option) => option.key), ['annual', 'monthly']);
	assert.equal(options.every((option) => option.available === false), true);
	assert.equal(options[0].amount_label, '$250/yr');
	assert.equal(options[1].amount_label, '$29/mo');
});
