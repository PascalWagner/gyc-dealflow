/**
 * Session builders for test fixtures.
 * Used by both unit tests (Node) and Playwright smoke/QA tests.
 */

import { fakeJwt } from './jwt.mjs';

const SESSION_VERSION = 3;

export function makeSessionUser(email, overrides = {}) {
	const defaultName = email.split('@')[0];
	const tier = overrides.tier || 'free';
	return {
		email,
		name: overrides.name || defaultName,
		fullName: overrides.fullName || overrides.name || defaultName,
		tier,
		isAdmin: overrides.isAdmin ?? false,
		token: overrides.token || fakeJwt(email),
		refreshToken: overrides.refreshToken || `refresh-${email}`,
		onboardingCompletedAt: overrides.onboardingCompletedAt ?? new Date().toISOString(),
		...overrides
	};
}

export function makeAdminSession(email = 'info@pascalwagner.com') {
	return {
		sessionVersion: SESSION_VERSION,
		email,
		name: 'Pascal Wagner',
		fullName: 'Pascal Wagner',
		accessTier: 'admin',
		roleFlags: {
			lp: true,
			gp: true,
			admin: true
		},
		capabilities: {
			memberContent: true,
			backgroundChecks: true,
			gpDashboard: true,
			gpCompanySettings: true,
			adminTools: true,
			impersonateUsers: true
		},
		isAdmin: true,
		token: fakeJwt(email),
		refreshToken: `refresh-${email}`
	};
}
