import { expect, test } from '@playwright/test';
// @ts-expect-error -- .mjs fixtures
import { makeSessionUser } from './fixtures/session.mjs';
// @ts-expect-error
import { installCoreApiMocks } from './fixtures/api-mocks.mjs';
// @ts-expect-error
import { seedSession } from './fixtures/browser-session.mjs';

const ADMIN_EMAIL = 'info@pascalwagner.com';

test.describe('settings and membership smoke', () => {
	test.beforeEach(async ({ page }) => {
		await installCoreApiMocks(page);
	});

	test('settings page loads for academy member', async ({ page }) => {
		await seedSession(page, makeSessionUser(ADMIN_EMAIL, {
			name: 'Admin User',
			fullName: 'Admin User',
			tier: 'academy',
			isAdmin: true
		}));

		await page.goto('/app/settings');
		await expect(page).toHaveURL(/\/app\/settings/);
		await expect(page.getByRole('heading', { name: 'Settings', level: 1 })).toBeVisible();
	});

	test('academy tier badge shows correctly', async ({ page }) => {
		await seedSession(page, makeSessionUser(ADMIN_EMAIL, {
			name: 'Admin User',
			fullName: 'Admin User',
			tier: 'academy',
			isAdmin: true
		}));

		await page.goto('/app/settings');
		await expect(page.locator('.tier-badge')).toContainText('Academy');
	});

	test('admin sees view-as toggle for impersonation', async ({ page }) => {
		await seedSession(page, makeSessionUser(ADMIN_EMAIL, {
			name: 'Admin User',
			fullName: 'Admin User',
			tier: 'academy',
			isAdmin: true
		}));

		await page.goto('/app/settings');
		await expect(page.locator('.view-as-toggle')).toBeVisible();
	});

	test('settings page has profile content', async ({ page }) => {
		await seedSession(page, makeSessionUser(ADMIN_EMAIL, {
			name: 'Admin User',
			fullName: 'Admin User',
			tier: 'academy',
			isAdmin: true
		}));

		await page.goto('/app/settings');

		// Should contain profile-related content
		await expect(page.locator('body')).toContainText(/settings|profile|email|name/i);
	});
});
