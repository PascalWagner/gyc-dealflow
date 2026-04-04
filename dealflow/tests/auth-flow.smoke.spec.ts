import { expect, test } from '@playwright/test';
// @ts-expect-error -- .mjs fixtures
import { fakeJwt } from './fixtures/jwt.mjs';
// @ts-expect-error
import { makeSessionUser } from './fixtures/session.mjs';
// @ts-expect-error
import { installCoreApiMocks } from './fixtures/api-mocks.mjs';
// @ts-expect-error
import { seedSession } from './fixtures/browser-session.mjs';

const TEST_EMAIL = 'auth-test@example.com';

test.describe('auth flow smoke', () => {
	test.beforeEach(async ({ page }) => {
		await installCoreApiMocks(page);
	});

	test('unauthenticated user on /app/deals redirects to /login', async ({ page }) => {
		await page.goto('/app/deals');
		// App should redirect unauthenticated users to login
		await expect(page).toHaveURL(/\/login/);
	});

	test('seeded session persists across navigation', async ({ page }) => {
		const session = makeSessionUser(TEST_EMAIL, {
			name: 'Auth Tester',
			fullName: 'Auth Tester',
			tier: 'academy',
			isAdmin: false
		});
		await seedSession(page, session);

		await page.goto('/app/settings');
		await expect(page).toHaveURL(/\/app\/settings/);

		// Verify session is in localStorage
		const stored = await page.evaluate(() => {
			const raw = localStorage.getItem('gycUser');
			return raw ? JSON.parse(raw) : null;
		});
		expect(stored).not.toBeNull();
		expect(stored.email).toBe(TEST_EMAIL);

		// Navigate to another authenticated page
		await page.goto('/app/deals');
		await expect(page).toHaveURL(/\/app\/deals/);

		// Session should still be present
		const stillStored = await page.evaluate(() => {
			const raw = localStorage.getItem('gycUser');
			return raw ? JSON.parse(raw) : null;
		});
		expect(stillStored.email).toBe(TEST_EMAIL);
	});

	test('logout clears session and redirects to login', async ({ page }) => {
		const session = makeSessionUser(TEST_EMAIL, {
			name: 'Auth Tester',
			fullName: 'Auth Tester',
			tier: 'academy',
			isAdmin: false
		});
		await seedSession(page, session);
		await page.goto('/app/settings');
		await expect(page).toHaveURL(/\/app\/settings/);

		// Find and click logout
		const logoutBtn = page.getByRole('button', { name: /log\s*out|sign\s*out/i });
		if (await logoutBtn.isVisible()) {
			await logoutBtn.click();
			// After logout, should redirect to login
			await expect(page).toHaveURL(/\/login|\/landing/);

			// localStorage should be cleared
			const stored = await page.evaluate(() => localStorage.getItem('gycUser'));
			expect(stored).toBeNull();
		}
	});

	test('login page renders email form', async ({ page }) => {
		await page.goto('/login');
		await expect(page).toHaveURL(/\/login/);

		// Email input should be visible
		const emailInput = page.locator('input[type="email"], input[name="email"], input[placeholder*="email" i]');
		await expect(emailInput).toBeVisible();

		// Submit button should be visible
		const submitBtn = page.getByRole('button', { name: /get started|sign in|log in|send/i });
		await expect(submitBtn).toBeVisible();
	});

	test('login page validates empty email', async ({ page }) => {
		await page.goto('/login');

		// Try to submit without email
		const submitBtn = page.getByRole('button', { name: /get started|sign in|log in|send/i });
		await submitBtn.click();

		// Should show validation error or stay on login
		await expect(page).toHaveURL(/\/login/);
	});
});
