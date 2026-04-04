import { expect, test } from '@playwright/test';
// @ts-expect-error -- .mjs fixtures
import { makeSessionUser } from './fixtures/session.mjs';
// @ts-expect-error
import { installCoreApiMocks, ADMIN_EMAIL } from './fixtures/api-mocks.mjs';
// @ts-expect-error
import { seedSession } from './fixtures/browser-session.mjs';

const MEMBER_EMAIL = 'member@example.com';

test.describe('admin page smoke', () => {
	test.beforeEach(async ({ page }) => {
		await installCoreApiMocks(page);
		// Admin page calls /api/admin-manage for data — stub it out
		await page.route('**/api/admin-manage**', async (route) => {
			await route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({ success: true, data: {} })
			});
		});
	});

	test('non-admin user is redirected to deals page', async ({ page }) => {
		// admin is in ADMIN_ONLY_PAGE_KEYS, so layout redirects before onMount fires
		await seedSession(page, makeSessionUser(MEMBER_EMAIL, {
			name: 'Regular Member',
			tier: 'academy',
			isAdmin: false
		}));

		await page.goto('/app/admin');
		await expect(page).toHaveURL(/\/app\/deals/);
	});

	test('admin user sees Admin Dashboard heading', async ({ page }) => {
		await seedSession(page, makeSessionUser(ADMIN_EMAIL, {
			name: 'Admin User',
			tier: 'academy',
			isAdmin: true
		}));

		await page.goto('/app/admin');
		await expect(page).toHaveURL(/\/app\/admin/);
		await expect(page.getByRole('heading', { name: 'Admin Dashboard' })).toBeVisible();
	});

	test('admin dashboard shows tab bar with Overview tab', async ({ page }) => {
		await seedSession(page, makeSessionUser(ADMIN_EMAIL, {
			name: 'Admin User',
			tier: 'academy',
			isAdmin: true
		}));

		await page.goto('/app/admin');
		await expect(page.locator('.tab-bar, .tab-btn').first()).toBeVisible();
		await expect(page.locator('body')).toContainText(/Overview/i);
	});

	test('admin dashboard action buttons are visible', async ({ page }) => {
		await seedSession(page, makeSessionUser(ADMIN_EMAIL, {
			name: 'Admin User',
			tier: 'academy',
			isAdmin: true
		}));

		await page.goto('/app/admin');
		// Sync GHL and Refresh buttons are always in the header
		await expect(page.getByRole('button', { name: /Sync GHL/i })).toBeVisible();
	});
});
