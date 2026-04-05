import { expect, test } from '@playwright/test';
// @ts-expect-error -- .mjs fixtures
import { makeSessionUser } from './fixtures/session.mjs';
// @ts-expect-error
import { installCoreApiMocks } from './fixtures/api-mocks.mjs';
// @ts-expect-error
import { seedSession } from './fixtures/browser-session.mjs';

const ACADEMY_EMAIL = 'api-error-tester@example.com';

test.describe('API error resilience', () => {
	test.beforeEach(async ({ page }) => {
		await installCoreApiMocks(page);
		const session = makeSessionUser(ACADEMY_EMAIL, { tier: 'academy' });
		await seedSession(page, session);
	});

	test('deals page survives member/deals 500 error', async ({ page }) => {
		const errors: string[] = [];
		page.on('pageerror', err => errors.push(err.message));

		// Register 500 override after installCoreApiMocks — Playwright uses last-registered handler
		await page.route('**/api/member/deals**', route =>
			route.fulfill({ status: 500, contentType: 'application/json', body: '{"error":"Server error"}' })
		);

		await page.goto('/app/deals');

		expect(errors, 'No unhandled JS errors').toHaveLength(0);

		// Page must render structural chrome even when API fails
		const chrome = page.locator('nav, header, main, [role="main"]').first();
		await expect(chrome).toBeVisible({ timeout: 10000 });
	});

	test('userdata 500 does not crash the app layout', async ({ page }) => {
		const errors: string[] = [];
		page.on('pageerror', err => errors.push(err.message));

		await page.route('**/api/userdata**', route =>
			route.fulfill({ status: 500, contentType: 'application/json', body: '{"error":"Server error"}' })
		);

		await page.goto('/app/deals');

		expect(errors, 'No unhandled JS errors').toHaveLength(0);

		const chrome = page.locator('nav, header, main, [role="main"]').first();
		await expect(chrome).toBeVisible({ timeout: 10000 });
	});

	test('settings/membership 500 does not crash settings page', async ({ page }) => {
		const errors: string[] = [];
		page.on('pageerror', err => errors.push(err.message));

		await page.route('**/api/settings/membership**', route =>
			route.fulfill({ status: 500, contentType: 'application/json', body: '{"error":"Server error"}' })
		);

		await page.goto('/app/settings');

		expect(errors, 'No unhandled JS errors').toHaveLength(0);

		const chrome = page.locator('nav, header, main, [role="main"]').first();
		await expect(chrome).toBeVisible({ timeout: 10000 });
	});
});
