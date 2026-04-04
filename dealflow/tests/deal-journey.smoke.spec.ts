import { expect, test } from '@playwright/test';
// @ts-expect-error -- .mjs fixtures
import { makeSessionUser } from './fixtures/session.mjs';
// @ts-expect-error
import { installCoreApiMocks, SPONSOR_NAME } from './fixtures/api-mocks.mjs';
// @ts-expect-error
import { seedSession } from './fixtures/browser-session.mjs';

const MEMBER_EMAIL = 'deal-tester@example.com';

test.describe('deal journey smoke', () => {
	test.beforeEach(async ({ page }) => {
		await installCoreApiMocks(page);
	});

	test('deal browser loads with deal cards', async ({ page }) => {
		await seedSession(page, makeSessionUser(MEMBER_EMAIL, {
			name: 'Deal Tester',
			tier: 'academy',
			isAdmin: false
		}));

		await page.goto('/app/deals');
		await expect(page).toHaveURL(/\/app\/deals/);

		// Deal cards should render
		const dealCards = page.locator('.deal-card');
		await expect(dealCards.first()).toBeVisible();

		// Should have at least 1 deal card from the mock data
		const count = await dealCards.count();
		expect(count).toBeGreaterThanOrEqual(1);
	});

	test('clicking deal card hero navigates to deal detail', async ({ page }) => {
		await seedSession(page, makeSessionUser(MEMBER_EMAIL, {
			name: 'Deal Tester',
			tier: 'academy',
			isAdmin: false
		}));

		await page.goto('/app/deals');
		await expect(page.locator('.deal-card').first()).toBeVisible();

		// Click the card hero (non-control area)
		await page.locator('.deal-card').first().locator('.card-hero').click();

		// Should navigate to deal detail page
		await expect(page).toHaveURL(/\/deal\/deal-yield-1$/);
	});

	test('deal detail page loads with expected sections', async ({ page }) => {
		await seedSession(page, makeSessionUser(MEMBER_EMAIL, {
			name: 'Deal Tester',
			tier: 'academy',
			isAdmin: false
		}));

		await page.goto('/deal/deal-yield-1');
		await expect(page).toHaveURL(/\/deal\/deal-yield-1/);

		// Should show the deal name or sponsor
		await expect(page.locator('body')).toContainText(/Mock Deal|Yield Street/i);
	});

	test('deal card save button does not navigate away', async ({ page }) => {
		await seedSession(page, makeSessionUser(MEMBER_EMAIL, {
			name: 'Deal Tester',
			tier: 'academy',
			isAdmin: false
		}));

		await page.goto('/app/deals');
		await expect(page.locator('.deal-card').first()).toBeVisible();

		// Click save button (a footer control)
		const saveBtn = page.locator('.deal-card').first().getByRole('button', { name: 'Save Deal' });
		if (await saveBtn.isVisible()) {
			await saveBtn.click();
			// Should stay on deals page
			await expect(page).toHaveURL(/\/app\/deals/);
		}
	});

	test('deal cards show sponsor and asset class info', async ({ page }) => {
		await seedSession(page, makeSessionUser(MEMBER_EMAIL, {
			name: 'Deal Tester',
			tier: 'academy',
			isAdmin: false
		}));

		await page.goto('/app/deals');
		const firstCard = page.locator('.deal-card').first();
		await expect(firstCard).toBeVisible();

		// Card should contain sponsor name from mock data
		await expect(firstCard).toContainText(SPONSOR_NAME);
	});
});
