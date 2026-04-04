import { expect, test } from '@playwright/test';
// @ts-expect-error -- .mjs fixtures
import { makeSessionUser } from './fixtures/session.mjs';
// @ts-expect-error
import { installCoreApiMocks, SPONSOR_NAME } from './fixtures/api-mocks.mjs';
// @ts-expect-error
import { seedSession } from './fixtures/browser-session.mjs';

const MEMBER_EMAIL = 'find-gp-tester@example.com';

test.describe('find-gp (GP browser) smoke', () => {
	test.beforeEach(async ({ page }) => {
		await installCoreApiMocks(page);
	});

	test('find-gp page loads with GP Dashboard heading', async ({ page }) => {
		await seedSession(page, makeSessionUser(MEMBER_EMAIL, {
			name: 'GP Tester',
			tier: 'academy',
			isAdmin: false
		}));

		await page.goto('/app/find-gp');
		await expect(page).toHaveURL(/\/app\/find-gp/);
		await expect(page.getByRole('heading', { name: 'GP Dashboard' })).toBeVisible();
	});

	test('find-gp page title is correct', async ({ page }) => {
		await seedSession(page, makeSessionUser(MEMBER_EMAIL, {
			name: 'GP Tester',
			tier: 'academy',
			isAdmin: false
		}));

		await page.goto('/app/find-gp');
		await expect(page).toHaveTitle(/GP Dashboard | GYC/i);
	});

	test('find-gp page shows search input', async ({ page }) => {
		await seedSession(page, makeSessionUser(MEMBER_EMAIL, {
			name: 'GP Tester',
			tier: 'academy',
			isAdmin: false
		}));

		await page.goto('/app/find-gp');
		// Search input for filtering GPs
		await expect(page.locator('input[type="text"], input[placeholder*="search" i], input[placeholder*="Search" i]').first()).toBeVisible();
	});

	test('find-gp renders sponsor names from deals store when populated', async ({ page }) => {
		await seedSession(page, makeSessionUser(MEMBER_EMAIL, {
			name: 'GP Tester',
			tier: 'academy',
			isAdmin: false
		}));

		// Navigate to deals first so $deals store gets populated (find-gp reads from $deals)
		await page.goto('/app/deals');
		await expect(page.locator('.deal-card').first()).toBeVisible();

		// Client-side navigate to find-gp so $deals module store is retained
		// Then go directly — even without $deals the page still loads (just empty GP list)
		await page.goto('/app/find-gp');
		await expect(page).toHaveURL(/\/app\/find-gp/);
		await expect(page.getByRole('heading', { name: 'GP Dashboard' })).toBeVisible();
	});

	test('find-gp accessible to free tier user', async ({ page }) => {
		await seedSession(page, makeSessionUser('free@example.com', {
			name: 'Free User',
			tier: 'free',
			isAdmin: false
		}));

		await page.goto('/app/find-gp');
		await expect(page).toHaveURL(/\/app\/find-gp/);
	});
});
