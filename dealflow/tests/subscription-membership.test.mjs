import test from 'node:test';
import assert from 'node:assert/strict';

import { buildAccessModel } from '../src/lib/auth/access-model.js';
import {
	buildMembershipSummary,
	isSubscriptionActive
} from '../src/lib/subscriptions/subscription-model.js';
import { buildGhlSubscriptionFromContact } from '../api/_subscriptions.js';

function withFixedNow(isoDate, callback) {
	const originalNow = Date.now;
	Date.now = () => new Date(isoDate).getTime();
	try {
		callback();
	} finally {
		Date.now = originalNow;
	}
}

test('active subscription remains active and preserves renewal date', () => {
	withFixedNow('2026-06-01T00:00:00.000Z', () => {
		const membership = buildMembershipSummary(
			{
				product_type: 'academy',
				status: 'active',
				start_date: '2026-01-15T00:00:00.000Z',
				end_date: '2027-01-15T00:00:00.000Z',
				renewal_date: '2027-01-15T00:00:00.000Z'
			},
			{ productType: 'academy', autoRenew: true }
		);

		assert.equal(membership.status, 'active');
		assert.equal(membership.start_date, '2026-01-15T00:00:00.000Z');
		assert.equal(membership.end_date, '2027-01-15T00:00:00.000Z');
		assert.equal(membership.renewal_date, '2027-01-15T00:00:00.000Z');
		assert.equal(isSubscriptionActive(membership, Date.now()), true);

		const access = buildAccessModel({
			email: 'member@example.com',
			tier: 'academy',
			subscriptions: { academy: membership }
		});

		assert.equal(access.accessTier, 'member');
		assert.equal(access.membershipStatus, 'active');
		assert.equal(access.membershipExpired, false);
	});
});

test('active subscription upgrades a stale free tier to member access', () => {
	withFixedNow('2026-06-01T00:00:00.000Z', () => {
		const membership = buildMembershipSummary(
			{
				product_type: 'academy',
				status: 'active',
				start_date: '2025-11-13T00:00:00.000Z',
				end_date: '2026-12-31T23:59:59.000Z'
			},
			{ productType: 'academy', autoRenew: false }
		);

		const access = buildAccessModel({
			email: 'member@example.com',
			tier: 'free',
			subscriptions: { academy: membership }
		});

		assert.equal(access.accessTier, 'member');
		assert.equal(access.membershipActivated, true);
		assert.equal(access.membershipStatus, 'active');
	});
});

test('expired subscription downgrades membership access', () => {
	withFixedNow('2026-06-01T00:00:00.000Z', () => {
		const membership = buildMembershipSummary(
			{
				product_type: 'academy',
				status: 'active',
				start_date: '2025-01-15T00:00:00.000Z',
				end_date: '2025-12-15T00:00:00.000Z'
			},
			{ productType: 'academy', autoRenew: false }
		);

		assert.equal(membership.status, 'expired');
		assert.equal(membership.renewal_date, null);
		assert.equal(isSubscriptionActive(membership, Date.now()), false);

		const access = buildAccessModel({
			email: 'member@example.com',
			tier: 'academy',
			subscriptions: { academy: membership }
		});

		assert.equal(access.accessTier, 'free');
		assert.equal(access.membershipStatus, 'expired');
		assert.equal(access.membershipExpired, true);
	});
});

test('lifetime access stays active without an end date', () => {
	withFixedNow('2026-06-01T00:00:00.000Z', () => {
		const membership = buildMembershipSummary(
			{
				product_type: 'academy',
				status: 'active',
				start_date: '2024-01-15T00:00:00.000Z',
				end_date: null,
				renewal_date: null
			},
			{ productType: 'academy', autoRenew: false }
		);

		assert.equal(membership.status, 'active');
		assert.equal(membership.end_date, null);
		assert.equal(membership.renewal_date, null);
		assert.equal(isSubscriptionActive(membership, Date.now()), true);

		const access = buildAccessModel({
			email: 'member@example.com',
			tier: 'academy',
			subscriptions: { academy: membership }
		});

		assert.equal(access.accessTier, 'member');
		assert.equal(access.membershipStatus, 'active');
	});
});

test('missing subscription returns inactive membership', () => {
	withFixedNow('2026-06-01T00:00:00.000Z', () => {
		const membership = buildMembershipSummary(null, { productType: 'academy' });
		assert.equal(membership.status, 'inactive');
		assert.equal(membership.start_date, null);
		assert.equal(membership.end_date, null);

		const access = buildAccessModel({
			email: 'former-member@example.com',
			tier: 'academy',
			subscriptions: { academy: membership }
		});

		assert.equal(access.accessTier, 'free');
		assert.equal(access.membershipStatus, 'none');
		assert.equal(access.membershipInactive, true);
	});
});

test('future-start subscriptions stay inactive until the start date', () => {
	withFixedNow('2026-01-01T00:00:00.000Z', () => {
		const membership = buildMembershipSummary(
			{
				product_type: 'academy',
				status: 'active',
				start_date: '2026-01-15T00:00:00.000Z',
				end_date: '2027-01-15T00:00:00.000Z'
			},
			{ productType: 'academy', autoRenew: true }
		);

		assert.equal(membership.status, 'upcoming');
		assert.equal(isSubscriptionActive(membership, Date.now()), false);

		const access = buildAccessModel({
			email: 'member@example.com',
			tier: 'academy',
			subscriptions: { academy: membership }
		});

		assert.equal(access.accessTier, 'free');
		assert.equal(access.membershipStatus, 'upcoming');
		assert.equal(access.membershipUpcoming, true);
	});
});

test('paused subscriptions never grant active access even before the end date', () => {
	withFixedNow('2026-06-01T00:00:00.000Z', () => {
		const membership = buildMembershipSummary(
			{
				product_type: 'academy',
				status: 'paused',
				start_date: '2026-01-15T00:00:00.000Z',
				end_date: '2027-01-15T00:00:00.000Z',
				renewal_date: '2027-01-15T00:00:00.000Z'
			},
			{ productType: 'academy', autoRenew: true }
		);

		assert.equal(membership.status, 'inactive');
		assert.equal(isSubscriptionActive(membership, Date.now()), false);

		const access = buildAccessModel({
			email: 'member@example.com',
			tier: 'academy',
			subscriptions: { academy: membership }
		});

		assert.equal(access.accessTier, 'free');
		assert.equal(access.membershipStatus, 'none');
		assert.equal(access.membershipInactive, true);
	});
});

test('ghl academy fallback uses academy start date and cohort end date', async () => {
	const membership = await buildGhlSubscriptionFromContact(
		{
			tags: ['bought cashflow academy'],
			customField: [
				{
					id: 'contact.acceptance_date',
					value: '2025-11-13'
				}
			],
			dateAdded: '2025-11-13T15:57:00.000Z'
		},
		'academy',
		{
			fallbackProfile: { created_at: '2025-11-01T00:00:00.000Z' }
		}
	);

	assert.equal(membership.product_type, 'academy');
	assert.equal(membership.start_date, '2025-11-13');
	assert.equal(membership.end_date, '2026-12-31T23:59:59.000Z');
	assert.equal(membership.renewal_date, '2026-12-31T23:59:59.000Z');
});
