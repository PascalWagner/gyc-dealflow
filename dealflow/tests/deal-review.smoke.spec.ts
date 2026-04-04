/**
 * deal-review.smoke.spec.ts
 *
 * Smoke tests for the /deal-review admin interface.
 *
 * WHY THESE TESTS EXIST
 * ---------------------
 * The deal review page fetches deals via /api/deals/:id (path param), which is
 * served by api/deals/[id].js. That file imports dealReviewSchema.js, which must
 * NOT use $lib/ imports (breaks Vercel serverless). These tests catch regressions
 * at the UI level — if the API function crashes, the page shows "Could not load
 * this deal" rather than the review form.
 *
 * April 2026: dealReviewSchema.js briefly imported '$lib/constants/dealEnums.js',
 * crashing api/deals/[id].js on cold-start and blocking all deal edits in Manage Data.
 */

import { expect, test } from '@playwright/test';
// @ts-expect-error -- .mjs fixtures
import { makeSessionUser, makeAdminSession } from './fixtures/session.mjs';
// @ts-expect-error
import { installCoreApiMocks, ADMIN_EMAIL } from './fixtures/api-mocks.mjs';
// @ts-expect-error
import { seedSession } from './fixtures/browser-session.mjs';

const DEAL_ID = 'aaaabbbb-0000-4000-8000-ccccddddeeee';

const MOCK_DEAL = {
	id: DEAL_ID,
	investmentName: 'Test Industrial Fund',
	managementCompany: 'Acme Capital',
	management_company_id: 'mgmt-acme',
	assetClass: 'Industrial',
	dealType: 'Fund',
	status: 'Open',
	targetIRR: 0.18,
	preferredReturn: 0.08,
	investmentMinimum: 50000,
	lifecycleStatus: 'review',
	catalogState: 'draft'
};

test.describe('deal review smoke', () => {
	test.beforeEach(async ({ page }) => {
		await installCoreApiMocks(page, {
			'/api/deals': {
				deal: MOCK_DEAL,
				deals: [MOCK_DEAL]
			}
		});

		// Stub out deal-review-specific endpoints that fire on mount
		await page.route('**/api/deal-cleanup**', async (route) => {
			await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, citations: [], fieldSources: {} }) });
		});
		await page.route('**/api/sec-verification**', async (route) => {
			await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, state: 'Not Applicable' }) });
		});
		await page.route('**/api/deal-team-contacts**', async (route) => {
			await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, contacts: [] }) });
		});
		await page.route('**/api/management-companies/**', async (route) => {
			await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, contacts: [], managementCompany: {} }) });
		});
	});

	test('deal review page loads deal for admin — not "Could not load this deal"', async ({ page }) => {
		await seedSession(page, makeSessionUser(ADMIN_EMAIL, {
			name: 'Admin User',
			tier: 'academy',
			isAdmin: true
		}));

		await page.goto(`/deal-review?id=${DEAL_ID}`);
		await page.waitForLoadState('networkidle');

		// Should NOT show the error state
		await expect(page.locator('text=Could not load this deal')).toHaveCount(0);
		await expect(page.locator('text=Failed to load deal')).toHaveCount(0);

		// Should show the Deal Review heading
		await expect(page.getByRole('heading', { name: 'Deal Review' })).toBeVisible();
	});

	test('deal review page shows deal name when deal loads', async ({ page }) => {
		await seedSession(page, makeSessionUser(ADMIN_EMAIL, {
			name: 'Admin User',
			tier: 'academy',
			isAdmin: true
		}));

		await page.goto(`/deal-review?id=${DEAL_ID}`);
		await page.waitForLoadState('networkidle');

		// Deal name visible somewhere on the page
		await expect(page.locator('body')).toContainText('Test Industrial Fund');
	});

	test('non-admin is redirected away from deal review', async ({ page }) => {
		await seedSession(page, makeSessionUser('member@example.com', {
			name: 'Regular Member',
			tier: 'academy',
			isAdmin: false
		}));

		await page.goto(`/deal-review?id=${DEAL_ID}`);
		// Should redirect to deals or login — not stay on deal-review
		await expect(page).not.toHaveURL(/\/deal-review/);
	});

	test('deal review page with broken API shows friendly error not crash', async ({ page }) => {
		// Simulate api/deals/[id] returning 500 (as happens when serverless fn crashes)
		await page.route('**/api/deals/**', async (route) => {
			if (route.request().method() === 'GET' && new URL(route.request().url()).pathname.includes('/api/deals/')) {
				await route.fulfill({
					status: 500,
					contentType: 'application/json',
					body: JSON.stringify({ error: 'Internal server error' })
				});
				return;
			}
			await route.continue();
		});

		await seedSession(page, makeSessionUser(ADMIN_EMAIL, {
			name: 'Admin User',
			tier: 'academy',
			isAdmin: true
		}));

		await page.goto(`/deal-review?id=${DEAL_ID}`);
		await page.waitForLoadState('networkidle');

		// Should show a friendly error state, NOT a blank page or unhandled exception
		await expect(page.locator('text=Could not load this deal')).toBeVisible({ timeout: 5000 });
		// Should NOT contain "Internal server error" (raw API error)
		await expect(page.locator('body')).not.toContainText('Internal server error');
	});
});
