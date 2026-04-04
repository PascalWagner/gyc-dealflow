import { expect, test } from '@playwright/test';
// @ts-expect-error -- .mjs fixtures
import { makeSessionUser } from './fixtures/session.mjs';
// @ts-expect-error
import { installCoreApiMocks, ADMIN_EMAIL } from './fixtures/api-mocks.mjs';
// @ts-expect-error
import { seedSession } from './fixtures/browser-session.mjs';

const MEMBER_EMAIL = 'filter-tester@example.com';

const MOCK_DEALS = [
	{
		id: 'deal-mf-1',
		investmentName: 'Riverside Multi-Family Fund',
		managementCompany: 'Test Sponsor',
		assetClass: 'Multi-Family',
		dealType: 'Syndication',
		status: 'Open',
		targetIRR: 0.14
	},
	{
		id: 'deal-ind-1',
		investmentName: 'Phoenix Industrial REIT',
		managementCompany: 'Test Sponsor',
		assetClass: 'Industrial',
		dealType: 'Fund',
		status: 'Open',
		targetIRR: 0.18
	}
];

test.describe('deal filter interactions', () => {
	test.beforeEach(async ({ page }) => {
		await installCoreApiMocks(page);
		// Smart mock registered last so it takes precedence (Playwright LIFO route matching)
		await page.route('**/api/member/deals**', async (route) => {
			const url = new URL(route.request().url());
			const search = (url.searchParams.get('q') || '').toLowerCase();
			const assetClass = url.searchParams.get('asset_class') || '';
			let deals = MOCK_DEALS;
			if (search) deals = deals.filter(d => d.investmentName.toLowerCase().includes(search));
			if (assetClass) deals = deals.filter(d => d.assetClass === assetClass);
			await route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({ deals, total: deals.length, hasMore: false })
			});
		});
	});

	test('search input filters visible deals by name', async ({ page }) => {
		await seedSession(page, makeSessionUser(MEMBER_EMAIL, {
			name: 'Filter Tester',
			tier: 'academy',
			isAdmin: false
		}));

		await page.goto('/app/deals');
		await expect(page.locator('.deal-card').first()).toBeVisible();

		// Type a unique part of one deal's name
		const searchInput = page.locator('.filter-input').first();
		await searchInput.fill('Riverside');

		// Only the matching deal should be visible
		await expect(page.locator('.deal-card')).toHaveCount(1);
		await expect(page.locator('body')).toContainText(/Riverside/i);
	});

	test('search clears to show all deals again', async ({ page }) => {
		await seedSession(page, makeSessionUser(MEMBER_EMAIL, {
			name: 'Filter Tester',
			tier: 'academy',
			isAdmin: false
		}));

		await page.goto('/app/deals');
		await expect(page.locator('.deal-card').first()).toBeVisible();

		const searchInput = page.locator('.filter-input').first();
		await searchInput.fill('Phoenix');
		await expect(page.locator('.deal-card')).toHaveCount(1);

		// Clear — both deals should return
		await searchInput.fill('');
		await expect(page.locator('.deal-card')).toHaveCount(2);
	});

	test('Filters toggle button opens the filter panel', async ({ page }) => {
		await seedSession(page, makeSessionUser(MEMBER_EMAIL, {
			name: 'Filter Tester',
			tier: 'academy',
			isAdmin: false
		}));

		await page.goto('/app/deals');
		await expect(page.locator('.deal-card').first()).toBeVisible();

		// Filter panel should be hidden initially
		await expect(page.locator('.filter-panel')).not.toBeVisible();

		// Click the Filters toggle
		await page.getByRole('button', { name: /Filters/i }).first().click();

		// Filter panel should now be visible
		await expect(page.locator('.filter-panel')).toBeVisible();
	});

	test('filter panel has Clear All Filters button', async ({ page }) => {
		await seedSession(page, makeSessionUser(MEMBER_EMAIL, {
			name: 'Filter Tester',
			tier: 'academy',
			isAdmin: false
		}));

		await page.goto('/app/deals');
		await expect(page.locator('.deal-card').first()).toBeVisible();

		await page.getByRole('button', { name: /Filters/i }).first().click();
		await expect(page.getByRole('button', { name: /Clear All Filters/i })).toBeVisible();
	});

	test('filter badge appears when a filter is applied via search', async ({ page }) => {
		await seedSession(page, makeSessionUser(MEMBER_EMAIL, {
			name: 'Filter Tester',
			tier: 'academy',
			isAdmin: false
		}));

		await page.goto('/app/deals');
		await expect(page.locator('.deal-card').first()).toBeVisible();

		// Open filter panel and change a select
		await page.getByRole('button', { name: /Filters/i }).first().click();
		const assetClassSelect = page.locator('#filter-assetClass');
		await expect(assetClassSelect).toBeVisible();
		await assetClassSelect.selectOption('Multi-Family');

		// Filter count badge should appear on the Filters button
		await expect(page.locator('.filter-count-badge')).toBeVisible();
	});

	test('clear all resets filter badge', async ({ page }) => {
		await seedSession(page, makeSessionUser(MEMBER_EMAIL, {
			name: 'Filter Tester',
			tier: 'academy',
			isAdmin: false
		}));

		await page.goto('/app/deals');
		await expect(page.locator('.deal-card').first()).toBeVisible();

		await page.getByRole('button', { name: /Filters/i }).first().click();
		await page.locator('#filter-assetClass').selectOption('Multi-Family');
		await expect(page.locator('.filter-count-badge')).toBeVisible();

		// Clear all
		await page.getByRole('button', { name: /Clear All Filters/i }).click();
		await expect(page.locator('.filter-count-badge')).toHaveCount(0);
	});
});
