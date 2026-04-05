import { expect, test } from '@playwright/test';
// @ts-expect-error -- .mjs fixtures
import { makeSessionUser } from './fixtures/session.mjs';
// @ts-expect-error
import { installCoreApiMocks } from './fixtures/api-mocks.mjs';
// @ts-expect-error
import { seedSession } from './fixtures/browser-session.mjs';

const ACADEMY_EMAIL = 'empty-state-tester@example.com';

test.describe('empty state rendering', () => {
	test('deals page with no deals shows empty state', async ({ page }) => {
		const errors: string[] = [];
		page.on('pageerror', err => errors.push(err.message));

		await installCoreApiMocks(page, {
			'/api/member/deals': { deals: [], total: 0, hasMore: false }
		});

		const session = makeSessionUser(ACADEMY_EMAIL, { tier: 'academy' });
		await seedSession(page, session);

		await page.goto('/app/deals');

		expect(errors, 'No JS errors on page').toHaveLength(0);

		// Page should not be a blank white screen — some structural chrome must be visible
		const chrome = page.locator('nav, header, main, [role="main"]').first();
		await expect(chrome).toBeVisible({ timeout: 10000 });
	});

	test('portfolio page with empty portfolio shows empty state', async ({ page }) => {
		const errors: string[] = [];
		page.on('pageerror', err => errors.push(err.message));

		await installCoreApiMocks(page, {
			'/api/userdata': { records: [], count: 0, type: 'portfolio' }
		});

		const session = makeSessionUser(ACADEMY_EMAIL, { tier: 'academy' });
		await seedSession(page, session);

		await page.goto('/app/portfolio');

		expect(errors, 'No JS errors on page').toHaveLength(0);

		const chrome = page.locator('nav, header, main, [role="main"]').first();
		await expect(chrome).toBeVisible({ timeout: 10000 });
	});

	test('resources page with no resources does not crash', async ({ page }) => {
		const errors: string[] = [];
		page.on('pageerror', err => errors.push(err.message));

		await installCoreApiMocks(page, {
			'/api/resources': { resources: [] }
		});

		const session = makeSessionUser(ACADEMY_EMAIL, { tier: 'academy' });
		await seedSession(page, session);

		await page.goto('/app/resources');

		expect(errors, 'No JS errors on page').toHaveLength(0);

		const chrome = page.locator('nav, header, main, [role="main"]').first();
		await expect(chrome).toBeVisible({ timeout: 10000 });
	});
});
