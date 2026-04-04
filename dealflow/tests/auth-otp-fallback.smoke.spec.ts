import { expect, test } from '@playwright/test';
// @ts-expect-error -- .mjs fixtures
import { makeSessionUser } from './fixtures/session.mjs';
// @ts-expect-error
import { installCoreApiMocks, ADMIN_EMAIL } from './fixtures/api-mocks.mjs';
// @ts-expect-error
import { fakeJwt } from './fixtures/jwt.mjs';

const TEST_EMAIL = 'otp-test@example.com';

test.describe('auth OTP fallback edge cases', () => {
	test.beforeEach(async ({ page }) => {
		await installCoreApiMocks(page);
	});

	test('OTP-in-link auto-verify failure shows manual code entry form', async ({ page }) => {
		// Override auth to fail OTP verify — simulates expired OTP
		// Registered after installCoreApiMocks so it wins (Playwright LIFO route matching)
		await page.route('**/api/auth**', async (route) => {
			let body = {};
			try { body = route.request().postDataJSON() || {}; } catch { body = {}; }
			if (body?.action === 'verify-otp') {
				await route.fulfill({
					status: 200,
					contentType: 'application/json',
					body: JSON.stringify({ error: 'OTP expired or invalid' })
				});
				return;
			}
			await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true }) });
		});

		// Visit login with OTP params — triggers auto-verify which will fail
		await page.goto(`/login?otp=123456&email=${encodeURIComponent(TEST_EMAIL)}`);

		// After auto-verify failure, otpMode=true → manual code entry form appears
		await expect(page.locator('h2', { hasText: 'Enter your verification code' })).toBeVisible({ timeout: 10000 });
		await expect(page.locator('.otp-input')).toBeVisible();
		await expect(page.getByRole('button', { name: 'Verify' })).toBeVisible();
	});

	test('OTP-in-link verify button is disabled until 6 digits entered', async ({ page }) => {
		await page.route('**/api/auth**', async (route) => {
			let body = {};
			try { body = route.request().postDataJSON() || {}; } catch { body = {}; }
			if (body?.action === 'verify-otp') {
				await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ error: 'OTP expired' }) });
				return;
			}
			await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true }) });
		});

		await page.goto(`/login?otp=bad&email=${encodeURIComponent(TEST_EMAIL)}`);
		await expect(page.locator('.otp-input')).toBeVisible({ timeout: 10000 });

		const otpInput = page.locator('.otp-input').first();
		const verifyBtn = page.getByRole('button', { name: 'Verify' });

		// Input only 3 digits — Verify button should be disabled
		await otpInput.pressSequentially('123');
		await expect(verifyBtn).toBeDisabled();

		// Clear and fill all 6 — Verify button should be enabled
		await otpInput.fill('');
		await otpInput.pressSequentially('123456');
		await expect(verifyBtn).toBeEnabled();
	});

	test('expired magic link error shows OTP mode with saved email', async ({ page }) => {
		// Seed the last-login email before page load via addInitScript
		await page.addInitScript((email) => {
			window.localStorage.setItem('gyc-last-login-email', email);
		}, TEST_EMAIL);

		// Navigate with error params (legacy magic link expiry) using query params which are more reliable
		await page.goto(`/login?error=unauthorized_client&error_code=401&error_description=Email+link+expired`);

		// Should enter OTP mode with the saved email
		await expect(page.locator('h2', { hasText: 'Enter your verification code' })).toBeVisible({ timeout: 10000 });
		await expect(page.locator('body')).toContainText(/expired|code/i);
	});

	test('successful OTP verification redirects to destination', async ({ page }) => {
		// Override auth: fail auto-verify, then succeed on manual verify
		// Registered after installCoreApiMocks so it wins (Playwright LIFO route matching)
		let autoVerifyAttempted = false;
		await page.route('**/api/auth**', async (route) => {
			let body = {};
			try { body = route.request().postDataJSON() || {}; } catch { body = {}; }
			if (body?.action === 'verify-otp') {
				if (!autoVerifyAttempted) {
					autoVerifyAttempted = true;
					await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ error: 'OTP expired' }) });
					return;
				}
				// Second call (manual verify) — succeeds
				await route.fulfill({
					status: 200,
					contentType: 'application/json',
					body: JSON.stringify({
						token: fakeJwt(TEST_EMAIL),
						refreshToken: 'refresh-otp',
						email: TEST_EMAIL,
						name: 'OTP Tester',
						tier: 'academy',
						success: true
					})
				});
				return;
			}
			await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true }) });
		});

		await page.goto(`/login?otp=111111&email=${encodeURIComponent(TEST_EMAIL)}`);
		await expect(page.locator('.otp-input')).toBeVisible({ timeout: 10000 });

		// Fill in a 6-digit code and submit
		await page.locator('.otp-input').first().pressSequentially('654321');
		await page.getByRole('button', { name: 'Verify' }).click();

		// Should redirect away from /login after success
		await expect(page).not.toHaveURL(/\/login/, { timeout: 10000 });
	});

	test('sent magic link state shows OTP code input for immediate entry', async ({ page }) => {
		// Submit an email — page goes to "sent" state with inline OTP input
		await page.goto('/login');

		const emailInput = page.locator('input[type="email"], input[placeholder*="email" i]').first();
		await emailInput.fill(TEST_EMAIL);
		await page.getByRole('button', { name: /get started|send|sign in|log in/i }).first().click();

		// After magic link is sent, inline OTP input appears on the sent state
		await expect(page.locator('.otp-input')).toBeVisible({ timeout: 10000 });
		await expect(page.locator('h2', { hasText: /Check your email/i })).toBeVisible();
	});
});
