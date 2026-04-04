/**
 * Analytics wrapper — thin layer over PostHog.
 * App code calls analytics.track(), never PostHog directly.
 * This makes it trivial to swap providers later.
 */

import posthog from 'posthog-js';

const POSTHOG_KEY = 'phc_whU9iPoH72T3heukYk6roDm6whEQDjeHpBn7Hhbv6yx5';
const POSTHOG_HOST = 'https://us.i.posthog.com';

let initialized = false;

export function init() {
	if (initialized || typeof window === 'undefined') return;

	// Don't track in dev
	if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') return;

	posthog.init(POSTHOG_KEY, {
		api_host: POSTHOG_HOST,
		person_profiles: 'identified_only',
		capture_pageview: true,
		capture_pageleave: true,
		autocapture: false
	});

	initialized = true;
}

export function identify(user) {
	if (!initialized || !user?.email) return;
	posthog.identify(user.email, {
		name: user.fullName || user.name,
		tier: user.accessTier || user.tier,
		isAdmin: user.isAdmin || false
	});
}

export function track(event, properties = {}) {
	if (!initialized) return;
	posthog.capture(event, properties);
}

export function reset() {
	if (!initialized) return;
	posthog.reset();
}
