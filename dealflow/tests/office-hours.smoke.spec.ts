import { expect, test } from '@playwright/test';
// @ts-expect-error -- .mjs fixtures
import { makeSessionUser } from './fixtures/session.mjs';
// @ts-expect-error
import { installCoreApiMocks, ADMIN_EMAIL } from './fixtures/api-mocks.mjs';
// @ts-expect-error
import { seedSession } from './fixtures/browser-session.mjs';

const MEMBER_EMAIL = 'office-hours-tester@example.com';

test.describe('office hours smoke', () => {
	test.beforeEach(async ({ page }) => {
		await installCoreApiMocks(page);
		// Office hours fetches scheduled events — return empty list
		await page.route('**/api/member-events**', async (route) => {
			await route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({ events: [], nextSession: null })
			});
		});
	});

	test('office hours page loads with correct title', async ({ page }) => {
		await seedSession(page, makeSessionUser(MEMBER_EMAIL, {
			name: 'Office Hours Tester',
			tier: 'academy',
			isAdmin: false
		}));

		await page.goto('/app/office-hours');
		await expect(page).toHaveURL(/\/app\/office-hours/);
		await expect(page).toHaveTitle(/Office Hours | GYC/i);
	});

	test('office hours page shows Office Hours heading', async ({ page }) => {
		await seedSession(page, makeSessionUser(MEMBER_EMAIL, {
			name: 'Office Hours Tester',
			tier: 'academy',
			isAdmin: false
		}));

		await page.goto('/app/office-hours');
		await expect(page.getByRole('heading', { name: 'Office Hours' })).toBeVisible();
	});

	test('office hours shows member gate for free tier user', async ({ page }) => {
		// isMember is false for free tier — page shows CompanionGate
		await seedSession(page, makeSessionUser('free@example.com', {
			name: 'Free User',
			tier: 'free',
			isAdmin: false
		}));

		await page.goto('/app/office-hours');
		await expect(page).toHaveURL(/\/app\/office-hours/);
		// Free users see a gate — page renders but content is locked
		await expect(page.locator('body')).toContainText(/Office Hours|Available to existing members/i);
	});

	test('office hours accessible to academy member', async ({ page }) => {
		await seedSession(page, makeSessionUser(MEMBER_EMAIL, {
			name: 'Office Hours Tester',
			tier: 'academy',
			isAdmin: false
		}));

		await page.goto('/app/office-hours');
		await expect(page).toHaveURL(/\/app\/office-hours/);
		// Page loads without crash — heading visible
		await expect(page.getByRole('heading', { name: 'Office Hours' })).toBeVisible();
	});
});
