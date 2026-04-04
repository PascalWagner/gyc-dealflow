import { expect, test } from '@playwright/test';
// @ts-expect-error -- .mjs fixtures
import { makeSessionUser } from './fixtures/session.mjs';
// @ts-expect-error
import { installCoreApiMocks, ADMIN_EMAIL } from './fixtures/api-mocks.mjs';
// @ts-expect-error
import { seedSession } from './fixtures/browser-session.mjs';

const MEMBER_EMAIL = 'tax-tester@example.com';

test.describe('tax prep smoke', () => {
	test.beforeEach(async ({ page }) => {
		await installCoreApiMocks(page);
	});

	test('tax prep page loads and shows Tax Prep heading', async ({ page }) => {
		await seedSession(page, makeSessionUser(MEMBER_EMAIL, {
			name: 'Tax Tester',
			tier: 'academy',
			isAdmin: false
		}));

		await page.goto('/app/tax-prep');
		await expect(page).toHaveURL(/\/app\/tax-prep/);
		await expect(page.getByRole('heading', { name: 'Tax Prep' })).toBeVisible();
	});

	test('tax prep page title is correct', async ({ page }) => {
		await seedSession(page, makeSessionUser(MEMBER_EMAIL, {
			name: 'Tax Tester',
			tier: 'academy',
			isAdmin: false
		}));

		await page.goto('/app/tax-prep');
		await expect(page).toHaveTitle(/Tax Prep | GYC/i);
	});

	test('tax prep shows empty state when no tax docs exist', async ({ page }) => {
		await installCoreApiMocks(page, {
			'/api/userdata': { records: [], count: 0, type: 'taxdocs', fetchedAt: new Date().toISOString() }
		});

		await seedSession(page, makeSessionUser(MEMBER_EMAIL, {
			name: 'Tax Tester',
			tier: 'academy',
			isAdmin: false
		}));

		await page.goto('/app/tax-prep');
		// Loading completes, empty state renders
		await expect(page.locator('.empty-title')).toBeVisible({ timeout: 10000 });
		await expect(page.locator('body')).toContainText(/No tax documents yet/i);
	});

	test('tax prep shows Add Document button', async ({ page }) => {
		await seedSession(page, makeSessionUser(MEMBER_EMAIL, {
			name: 'Tax Tester',
			tier: 'academy',
			isAdmin: false
		}));

		await page.goto('/app/tax-prep');
		await expect(page.getByRole('button', { name: /Add Document/i })).toBeVisible({ timeout: 10000 });
	});

	test('tax prep accessible to free tier users', async ({ page }) => {
		await seedSession(page, makeSessionUser('free-tax@example.com', {
			name: 'Free User',
			tier: 'free',
			isAdmin: false
		}));

		await page.goto('/app/tax-prep');
		await expect(page).toHaveURL(/\/app\/tax-prep/);
	});
});
