import { expect, test } from '@playwright/test';
// @ts-expect-error -- .mjs fixtures
import { makeSessionUser } from './fixtures/session.mjs';
// @ts-expect-error
import { installCoreApiMocks, ADMIN_EMAIL } from './fixtures/api-mocks.mjs';
// @ts-expect-error
import { seedSession } from './fixtures/browser-session.mjs';

const MEMBER_EMAIL = 'resources-tester@example.com';

test.describe('resources page smoke', () => {
	test.beforeEach(async ({ page }) => {
		await installCoreApiMocks(page);
		// Resources page fetches video catalog — return a minimal set
		await page.route('**/api/resources**', async (route) => {
			await route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({
					sections: [
						{
							title: 'Strategy',
							videos: [
								{ id: 'vid-1', title: 'How to Vet a Deal', category: 'Strategy', description: 'Basics of deal vetting', module: 'Strategy 101' }
							]
						}
					],
					academyUnlocked: true
				})
			});
		});
	});

	test('resources page loads with correct title', async ({ page }) => {
		await seedSession(page, makeSessionUser(MEMBER_EMAIL, {
			name: 'Resources Tester',
			tier: 'academy',
			isAdmin: false
		}));

		await page.goto('/app/resources');
		await expect(page).toHaveURL(/\/app\/resources/);
		await expect(page).toHaveTitle(/Resources | GYC/i);
	});

	test('resources page shows Resources heading', async ({ page }) => {
		await seedSession(page, makeSessionUser(MEMBER_EMAIL, {
			name: 'Resources Tester',
			tier: 'academy',
			isAdmin: false
		}));

		await page.goto('/app/resources');
		await expect(page.getByRole('heading', { name: 'Resources' })).toBeVisible();
	});

	test('resources page shows search input', async ({ page }) => {
		await seedSession(page, makeSessionUser(MEMBER_EMAIL, {
			name: 'Resources Tester',
			tier: 'academy',
			isAdmin: false
		}));

		await page.goto('/app/resources');
		await expect(page.locator('input[type="search"], input[placeholder*="search" i], input[placeholder*="Search" i]').first()).toBeVisible({ timeout: 10000 });
	});

	test('resources page accessible to free tier user', async ({ page }) => {
		await seedSession(page, makeSessionUser('free@example.com', {
			name: 'Free User',
			tier: 'free',
			isAdmin: false
		}));

		await page.goto('/app/resources');
		await expect(page).toHaveURL(/\/app\/resources/);
		await expect(page.getByRole('heading', { name: 'Resources' })).toBeVisible();
	});
});
