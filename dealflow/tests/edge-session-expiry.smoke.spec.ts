import { expect, test } from '@playwright/test';
// @ts-expect-error -- .mjs fixtures
import { base64UrlEncode } from './fixtures/jwt.mjs';
// @ts-expect-error
import { makeSessionUser } from './fixtures/session.mjs';
// @ts-expect-error
import { installCoreApiMocks } from './fixtures/api-mocks.mjs';
// @ts-expect-error
import { seedSession } from './fixtures/browser-session.mjs';

function expiredJwt(email: string): string {
	const header = base64UrlEncode(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
	const payload = base64UrlEncode(JSON.stringify({
		sub: `user-${email}`,
		email,
		role: 'authenticated',
		exp: Math.floor(Date.now() / 1000) - 60 * 60  // 1 hour ago
	}));
	return `${header}.${payload}.signature`;
}

test.describe('session expiry handling', () => {
	test.beforeEach(async ({ page }) => {
		await installCoreApiMocks(page);
	});

	test('expired JWT redirects to login', async ({ page }) => {
		const email = 'expiry-test@example.com';
		const session = makeSessionUser(email, {
			tier: 'academy',
			token: expiredJwt(email)
		});
		await seedSession(page, session);
		await page.goto('/app/deals');
		await expect(page).toHaveURL(/\/login/);
	});

	test('missing localStorage gycUser redirects to login', async ({ page }) => {
		await page.goto('/login');
		await page.evaluate(() => localStorage.clear());
		await page.goto('/app/deals');
		await expect(page).toHaveURL(/\/login/);
	});

	test('corrupted localStorage gycUser redirects to login', async ({ page }) => {
		await page.goto('/login');
		await page.evaluate(() => localStorage.setItem('gycUser', 'this-is-not-json'));
		await page.goto('/app/deals');
		await expect(page).toHaveURL(/\/login/);
	});
});
