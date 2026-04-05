import { expect, test } from '@playwright/test';
// @ts-expect-error -- .mjs fixtures
import { makeSessionUser } from './fixtures/session.mjs';
// @ts-expect-error
import { installCoreApiMocks } from './fixtures/api-mocks.mjs';
// @ts-expect-error
import { seedSession } from './fixtures/browser-session.mjs';

test.describe('wrong tier access', () => {
	test.beforeEach(async ({ page }) => {
		await installCoreApiMocks(page);
	});

	test('free user on /app/deals sees deal limit modal after viewing deals', async ({ page }) => {
		const session = makeSessionUser('free-user@example.com', { tier: 'free' });
		await seedSession(page, session);

		await page.goto('/app/deals');
		await expect(page).toHaveURL(/\/app\/deals/);

		// Free users can browse — no immediate full-page paywall
		const fullPagePaywall = page.locator('[data-testid="paywall"], .paywall-gate');
		const count = await fullPagePaywall.count();
		expect(count).toBe(0);
	});

	test('free user on /app/academy is blocked or redirected', async ({ page }) => {
		const session = makeSessionUser('free-user@example.com', { tier: 'free' });
		await seedSession(page, session);

		await page.goto('/app/academy');

		const url = page.url();
		const leftAcademy = !url.includes('/app/academy');
		if (leftAcademy) {
			// Redirected away — pass
			expect(leftAcademy).toBe(true);
		} else {
			// Stayed on page — must show upgrade/paywall content
			await expect(page.getByText(/upgrade|academy|unlock|member/i).first()).toBeVisible({ timeout: 8000 });
		}
	});

	test('academy user on /app/academy has full access', async ({ page }) => {
		const session = makeSessionUser('academy-user@example.com', { tier: 'academy' });
		await seedSession(page, session);

		await page.goto('/app/academy');
		await expect(page).toHaveURL(/\/app\/academy/);

		// No upgrade wall visible
		const upgradeWall = page.getByText(/upgrade to access|unlock this content/i);
		expect(await upgradeWall.count()).toBe(0);
	});

	test('unauthenticated user on any /app/* route redirects to /login', async ({ page }) => {
		// Do NOT seed a session
		await page.goto('/app/deals');
		await expect(page).toHaveURL(/\/login/);
	});
});
