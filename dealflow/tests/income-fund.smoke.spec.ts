import { expect, test } from '@playwright/test';
// @ts-expect-error -- .mjs fixtures
import { makeSessionUser } from './fixtures/session.mjs';
// @ts-expect-error
import { installCoreApiMocks } from './fixtures/api-mocks.mjs';
// @ts-expect-error
import { seedSession } from './fixtures/browser-session.mjs';

const MEMBER_EMAIL = 'fund-tester@example.com';

test.describe('income fund smoke', () => {
	test.beforeEach(async ({ page }) => {
		await installCoreApiMocks(page);
	});

	test('income fund page loads with title', async ({ page }) => {
		await seedSession(page, makeSessionUser(MEMBER_EMAIL, {
			name: 'Fund Tester',
			tier: 'academy',
			isAdmin: false
		}));

		await page.goto('/app/income-fund');
		await expect(page).toHaveURL(/\/app\/income-fund/);
		await expect(page).toHaveTitle(/GYC Income Fund | GYC/i);
	});

	test('income fund page shows hero with yield stats', async ({ page }) => {
		await seedSession(page, makeSessionUser(MEMBER_EMAIL, {
			name: 'Fund Tester',
			tier: 'academy',
			isAdmin: false
		}));

		await page.goto('/app/income-fund');
		await expect(page.locator('.if-hero')).toBeVisible();
		await expect(page.locator('body')).toContainText(/Net LP Yield|8\.0%/i);
	});

	test('income fund CTA links to data room for web users', async ({ page }) => {
		await seedSession(page, makeSessionUser(MEMBER_EMAIL, {
			name: 'Fund Tester',
			tier: 'academy',
			isAdmin: false
		}));

		await page.goto('/app/income-fund');
		// Non-native users see the full data room CTA
		const dataRoomBtn = page.getByRole('link', { name: /View Full Data Room/i });
		await expect(dataRoomBtn).toBeVisible();
	});

	test('income fund accessible to free tier users', async ({ page }) => {
		await seedSession(page, makeSessionUser('free-fund@example.com', {
			name: 'Free User',
			tier: 'free',
			isAdmin: false
		}));

		await page.goto('/app/income-fund');
		await expect(page).toHaveURL(/\/app\/income-fund/);
	});
});
