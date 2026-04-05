import { test, expect } from '@playwright/test';

// These tests run against a real deployed URL — they do NOT use installCoreApiMocks.
// BASE_URL is injected via playwright.config.js from the BASE_URL environment variable.

const PROTECTED_ENDPOINTS = [
	'/api/ddchecklist',
	'/api/deal-save',
	'/api/deal-alerts',
	'/api/deal-team-contacts',
	'/api/resources',
	'/api/memo',
	'/api/market-intel',
	'/api/lp-network-stats',
	'/api/gp-analytics',
	'/api/gp-deal-performance',
	'/api/gp-investor-insights',
	'/api/gp-agreement',
	'/api/intro-request',
	'/api/portfolio-extract',
	'/api/feedback',
	'/api/admin-analytics',
	'/api/admin-saas-metrics',
	'/api/sponsor-analytics',
	'/api/stake-listings',
	'/api/market-data',
	'/api/network',
	'/api/deal-stats-bulk',
	'/api/deal-submissions',
	'/api/company-search',
	'/api/property',
];

const BASE_URL = process.env.BASE_URL || 'http://localhost:5173';

test.describe('API auth gating', () => {
	for (const endpoint of PROTECTED_ENDPOINTS) {
		test(`GET ${endpoint} rejects unauthenticated requests`, async ({ request }) => {
			const res = await request.get(`${BASE_URL}${endpoint}`);
			expect(res.status()).toBe(401);
		});
	}
});
