import { expect, test } from '@playwright/test';
// @ts-expect-error -- .mjs fixtures
import { makeSessionUser } from './fixtures/session.mjs';
// @ts-expect-error
import { installCoreApiMocks, ADMIN_EMAIL } from './fixtures/api-mocks.mjs';
// @ts-expect-error
import { seedSession } from './fixtures/browser-session.mjs';

const FREE_EMAIL = 'free-tester@example.com';
const MEMBER_EMAIL = 'academy-member@example.com';

test.describe('academy page smoke', () => {
	test.beforeEach(async ({ page }) => {
		await installCoreApiMocks(page);
	});

	test('academy page loads for free tier user', async ({ page }) => {
		await seedSession(page, makeSessionUser(FREE_EMAIL, {
			name: 'Free Tester',
			tier: 'free',
			isAdmin: false
		}));

		await page.goto('/app/academy');
		await expect(page).toHaveURL(/\/app\/academy/);
		// Page body should render something meaningful
		await expect(page.locator('body')).toContainText(/Academy|Deal Intelligence|Tools/i);
	});

	test('academy page loads for academy tier member', async ({ page }) => {
		await seedSession(page, makeSessionUser(MEMBER_EMAIL, {
			name: 'Academy Member',
			tier: 'academy',
			isAdmin: false
		}));

		await page.goto('/app/academy');
		await expect(page).toHaveURL(/\/app\/academy/);
		await expect(page.locator('body')).toContainText(/Academy|Deal Intelligence/i);
	});

	test('academy page shows tab navigation', async ({ page }) => {
		await seedSession(page, makeSessionUser(MEMBER_EMAIL, {
			name: 'Academy Member',
			tier: 'academy',
			isAdmin: false
		}));

		await page.goto('/app/academy');
		// Tab labels from the component: 'Deal Intelligence', 'Tools & DD', 'GP Access', 'Pascal & Community'
		await expect(page.locator('body')).toContainText(/Deal Intelligence/i);
	});

	test('academy page for admin shows Market Intel card in member hub', async ({ page }) => {
		await seedSession(page, makeSessionUser(ADMIN_EMAIL, {
			name: 'Admin User',
			tier: 'academy',
			isAdmin: true
		}));

		await page.goto('/app/academy');
		await expect(page.locator('body')).toContainText(/Market Intel/i);
	});

	test('market intel page redirects non-admin users to deals', async ({ page }) => {
		await seedSession(page, makeSessionUser(MEMBER_EMAIL, {
			name: 'Academy Member',
			tier: 'academy',
			isAdmin: false
		}));

		await page.goto('/app/market-intel');
		// market-intel is in ADMIN_ONLY_PAGE_KEYS — layout redirects non-admins to /app/deals
		await expect(page).toHaveURL(/\/app\/deals/);
	});

	test('market intel page loads content for admin', async ({ page }) => {
		await installCoreApiMocks(page, {
			'/api/deals': {
				deals: [
					{
						id: 'deal-yield-1',
						managementCompany: 'Yield Street',
						investmentName: 'Yield Street Industrial Fund',
						assetClass: 'Private Debt / Credit',
						dealType: 'Fund',
						status: 'Open',
						targetIRR: 0.19
					}
				],
				managementCompanies: [],
				people: [],
				meta: { totalOpportunities: 1, totalCompanies: 0, totalPeople: 0, fetchedAt: new Date().toISOString() }
			}
		});

		await seedSession(page, makeSessionUser(ADMIN_EMAIL, {
			name: 'Admin User',
			tier: 'academy',
			isAdmin: true
		}));

		await page.goto('/app/market-intel');
		await expect(page).toHaveURL(/\/app\/market-intel/);
		await expect(page.locator('body')).toContainText(/Market Intel|Analytics|Capital/i);
	});
});
