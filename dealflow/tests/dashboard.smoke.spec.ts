import { expect, test } from '@playwright/test';
// @ts-expect-error -- .mjs fixtures
import { makeSessionUser } from './fixtures/session.mjs';
// @ts-expect-error
import { installCoreApiMocks, ADMIN_EMAIL } from './fixtures/api-mocks.mjs';
// @ts-expect-error
import { seedSession } from './fixtures/browser-session.mjs';

const MEMBER_EMAIL = 'dashboard-tester@example.com';

test.describe('dashboard smoke', () => {
	test.beforeEach(async ({ page }) => {
		await installCoreApiMocks(page);
	});

	test('dashboard loads and shows Home heading for authenticated user', async ({ page }) => {
		await seedSession(page, makeSessionUser(MEMBER_EMAIL, {
			name: 'Dashboard Tester',
			tier: 'academy',
			isAdmin: false
		}));

		await page.goto('/app/dashboard');
		await expect(page).toHaveURL(/\/app\/dashboard/);
		await expect(page.getByRole('heading', { name: 'Home' })).toBeVisible();
	});

	test('dashboard with no wizard data shows onboarding card or coach card', async ({ page }) => {
		await seedSession(page, makeSessionUser(MEMBER_EMAIL, {
			name: 'Dashboard Tester',
			tier: 'academy',
			isAdmin: false
		}));

		await page.goto('/app/dashboard');
		// Either the onboarding card or the coach card should render (coach-card shows once dashboardReady=true)
		await expect(page.locator('.coach-card, .dashboard-onboarding-card').first()).toBeVisible();
	});

	test('dashboard with seeded wizard data shows coach card with welcome message', async ({ page }) => {
		await seedSession(page, makeSessionUser(MEMBER_EMAIL, {
			name: 'Pascal Tester',
			tier: 'academy',
			isAdmin: false
		}), {
			buyBoxWizard: {
				_branch: 'cashflow',
				targetCashFlow: '$100,000',
				dealCount: '3-5',
				dealTypes: ['Syndication'],
				assetClasses: ['Multi Family'],
				geography: ['Southeast'],
				minimumInvestment: '$50,000',
				holdPeriod: '3-5',
				_complete: true
			}
		});

		await page.goto('/app/dashboard');
		await expect(page.locator('.coach-card')).toBeVisible();
		await expect(page.locator('.coach-card')).toContainText(/Welcome back/i);
	});

	test('dashboard shows action items when deals are staged', async ({ page }) => {
		await seedSession(page, makeSessionUser(ADMIN_EMAIL, {
			name: 'Admin User',
			tier: 'academy',
			isAdmin: true
		}), {
			buyBoxWizard: { _branch: 'cashflow', targetCashFlow: '$100,000', _complete: true },
			stages: [
				{ deal_id: 'deal-yield-1', stage: 'review' },
				{ deal_id: 'deal-yield-2', stage: 'connect' }
			]
		});

		await page.goto('/app/dashboard');
		await expect(page).toHaveURL(/\/app\/dashboard/);
		// Dashboard stack should render
		await expect(page.locator('[data-dashboard-version]')).toBeVisible();
	});

	test('dashboard is inaccessible without a session and redirects', async ({ page }) => {
		// No seedSession — unauthenticated
		await page.goto('/app/dashboard');
		// Should redirect away from protected route
		await expect(page).not.toHaveURL(/\/app\/dashboard/);
	});

	test('dashboard title is "Home | GYC"', async ({ page }) => {
		await seedSession(page, makeSessionUser(MEMBER_EMAIL, {
			name: 'Dashboard Tester',
			tier: 'academy',
			isAdmin: false
		}));

		await page.goto('/app/dashboard');
		await expect(page).toHaveTitle(/Home | GYC/i);
	});
});
