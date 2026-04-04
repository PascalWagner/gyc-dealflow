import { expect, test } from '@playwright/test';
// @ts-expect-error -- .mjs fixtures
import { makeSessionUser } from './fixtures/session.mjs';
// @ts-expect-error
import { installCoreApiMocks, ADMIN_EMAIL, SPONSOR_ID } from './fixtures/api-mocks.mjs';
// @ts-expect-error
import { seedSession } from './fixtures/browser-session.mjs';

const NON_GP_EMAIL = 'non-gp@example.com';

async function installGPApiMocks(page) {
	await installCoreApiMocks(page);
	// GP dashboard fetches these; mock them to avoid errors
	await page.route('**/api/gp-analytics**', async (route) => {
		await route.fulfill({
			status: 200,
			contentType: 'application/json',
			body: JSON.stringify({ analytics: { totalSaves: 12, totalVetting: 5, totalInvested: 2, recentActivity: [], weeklyActivity: [], highIntentCount: 3 } })
		});
	});
	await page.route('**/api/gp-investor-insights**', async (route) => {
		await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ insights: {} }) });
	});
	await page.route('**/api/management-companies/**', async (route) => {
		await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ settings: {} }) });
	});
	await page.route('**/api/gp-agreement**', async (route) => {
		await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ hasCurrentAgreement: true }) });
	});
}

test.describe('GP dashboard smoke', () => {
	test('non-GP user sees access denied message', async ({ page }) => {
		await installGPApiMocks(page);

		await seedSession(page, makeSessionUser(NON_GP_EMAIL, {
			name: 'Non GP User',
			tier: 'academy',
			isAdmin: false
		}));

		await page.goto('/gp-dashboard');
		await expect(page).toHaveURL(/\/gp-dashboard/);
		// Non-GP user sees access denied (checkGPAccess returns false)
		await expect(page.locator('.access-denied')).toBeVisible({ timeout: 10000 });
		await expect(page.locator('body')).toContainText(/GP Access Required/i);
	});

	test('unauthenticated user is redirected away from gp-dashboard', async ({ page }) => {
		await installGPApiMocks(page);
		// No seedSession — unauthenticated
		await page.goto('/gp-dashboard');
		// onMount checks $isLoggedIn and calls goto('/login?return=/gp-dashboard')
		await expect(page).toHaveURL(/\/login/);
	});

	test('admin user sees GP dashboard title', async ({ page }) => {
		await installGPApiMocks(page);

		await seedSession(page, makeSessionUser(ADMIN_EMAIL, {
			name: 'Admin User',
			tier: 'academy',
			isAdmin: true
		}));

		await page.goto('/gp-dashboard');
		await expect(page).toHaveTitle(/GP Dashboard/i);
	});

	test('admin user bypasses access denied and sees dashboard content', async ({ page }) => {
		await installGPApiMocks(page);

		await seedSession(page, makeSessionUser(ADMIN_EMAIL, {
			name: 'Admin User',
			tier: 'academy',
			isAdmin: true
		}));

		await page.goto('/gp-dashboard');
		// Admin bypasses checkGPAccess + verifyCurrentAgreement — dashboard renders
		await expect(page.locator('.access-denied')).toHaveCount(0);
		await expect(page.locator('body')).toContainText(/Manage your deals|Deal Health|Action Items|Investor Activity/i);
	});
});
