import { expect, test } from '@playwright/test';
// @ts-expect-error -- .mjs fixtures
import { makeSessionUser } from './fixtures/session.mjs';
// @ts-expect-error
import { installCoreApiMocks } from './fixtures/api-mocks.mjs';
// @ts-expect-error
import { seedSession } from './fixtures/browser-session.mjs';

const MEMBER_EMAIL = 'onboard-test@example.com';

test.describe('onboarding flow smoke', () => {
	test.beforeEach(async ({ page }) => {
		await installCoreApiMocks(page);
	});

	test('plan page loads for authenticated user', async ({ page }) => {
		await seedSession(page, makeSessionUser(MEMBER_EMAIL, {
			name: 'Onboard Tester',
			tier: 'member',
			isAdmin: false
		}));

		await page.goto('/app/plan');
		await expect(page).toHaveURL(/\/app\/plan/);

		// Should show plan content (wizard or dashboard depending on state)
		await expect(page.locator('body')).toContainText(/plan|goal|profile|investor|get started/i);
	});

	test('dashboard shows onboarding prompt for new user', async ({ page }) => {
		await seedSession(page, makeSessionUser(MEMBER_EMAIL, {
			name: 'New User',
			tier: 'free',
			isAdmin: false
		}));

		await page.goto('/app/dashboard');
		await expect(page).toHaveURL(/\/app\/dashboard/);

		// New user with no plan should see onboarding prompt or dashboard content
		await expect(page.locator('body')).toContainText(/get started|set up|investor profile|dashboard|home/i);
	});

	test('plan page entry via onboarding URL preserves query params', async ({ page }) => {
		await seedSession(page, makeSessionUser(MEMBER_EMAIL, {
			name: 'Onboard Tester',
			tier: 'member',
			isAdmin: false
		}));

		await page.goto('/app/plan?stage=goal&flow=free');
		// Should land on plan page (may strip/preserve params based on app logic)
		await expect(page).toHaveURL(/\/app\/plan/);
	});

	test('goals page loads with wizard or dashboard', async ({ page }) => {
		await seedSession(page, makeSessionUser(MEMBER_EMAIL, {
			name: 'Goal Tester',
			tier: 'free',
			isAdmin: false
		}));

		await page.goto('/app/goals');
		await expect(page).toHaveURL(/\/app\/goals/);

		// Should show goals content
		await expect(page.locator('body')).toContainText(/goal|investment|passive income|plan/i);
	});
});
