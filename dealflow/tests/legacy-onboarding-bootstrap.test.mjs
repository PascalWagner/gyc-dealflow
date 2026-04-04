import test from 'node:test';
import assert from 'node:assert/strict';

import { resolveLegacyLpOnboardingIntent } from '../src/lib/onboarding/legacyOnboardingBootstrap.js';

test('completed LP onboarding redirects back to the LP destination', () => {
	assert.equal(
		resolveLegacyLpOnboardingIntent({
			reviewMode: false,
			onboardingRole: 'lp',
			hasCompletedBuyBox: true
		}),
		'redirect'
	);
});

test('incomplete LP onboarding resumes instead of redirecting away', () => {
	assert.equal(
		resolveLegacyLpOnboardingIntent({
			reviewMode: false,
			onboardingRole: 'lp',
			hasCompletedBuyBox: false
		}),
		'resume'
	);
});

test('review mode never forces LP redirect or resume decisions', () => {
	assert.equal(
		resolveLegacyLpOnboardingIntent({
			reviewMode: true,
			onboardingRole: 'lp',
			hasCompletedBuyBox: true
		}),
		'none'
	);
});
