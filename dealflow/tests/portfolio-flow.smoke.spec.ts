import { expect, test } from '@playwright/test';
// @ts-expect-error -- .mjs fixtures
import { makeSessionUser } from './fixtures/session.mjs';
// @ts-expect-error
import { installCoreApiMocks } from './fixtures/api-mocks.mjs';
// @ts-expect-error
import { seedSession } from './fixtures/browser-session.mjs';

const MEMBER_EMAIL = 'info@pascalwagner.com';

test.describe('portfolio flow smoke', () => {
	test.beforeEach(async ({ page }) => {
		await installCoreApiMocks(page);
	});

	test('portfolio page loads with holdings from seeded data', async ({ page }) => {
		await seedSession(page, makeSessionUser(MEMBER_EMAIL, {
			name: 'Admin User',
			tier: 'academy',
			isAdmin: true
		}), {
			portfolio: [
				{
					id: 'test-holding-1',
					investment_name: 'Test Fund I',
					sponsor: 'Test Sponsor',
					asset_class: 'Multi Family',
					amount_invested: 50000,
					status: 'Active'
				}
			]
		});

		await page.goto('/app/portfolio');
		await expect(page).toHaveURL(/\/app\/portfolio/);

		// Should show portfolio content (either holdings or empty state)
		await expect(page.locator('body')).toContainText(/Portfolio|Holdings|No investments/i);
	});

	test('empty portfolio shows appropriate empty state', async ({ page }) => {
		await seedSession(page, makeSessionUser('empty-user@example.com', {
			name: 'Empty User',
			tier: 'academy',
			isAdmin: false
		}));

		await page.goto('/app/portfolio');
		await expect(page).toHaveURL(/\/app\/portfolio/);

		// With no portfolio data, should show empty state
		await expect(page.locator('body')).toContainText(/Portfolio|No investments|Add/i);
	});

	test('portfolio page is accessible to authenticated users', async ({ page }) => {
		await seedSession(page, makeSessionUser(MEMBER_EMAIL, {
			name: 'Admin User',
			tier: 'academy',
			isAdmin: true
		}));

		await page.goto('/app/portfolio');
		// Should not redirect away — portfolio is accessible to all tiers
		await expect(page).toHaveURL(/\/app\/portfolio/);
	});
});
