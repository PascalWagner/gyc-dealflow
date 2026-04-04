import { expect, test } from '@playwright/test';
// @ts-expect-error -- .mjs fixtures
import { installCoreApiMocks } from './fixtures/api-mocks.mjs';

test.describe('landing page smoke', () => {
	test.beforeEach(async ({ page }) => {
		await installCoreApiMocks(page);
	});

	test('landing page loads with correct title', async ({ page }) => {
		await page.goto('/landing');
		await expect(page).toHaveURL(/\/landing/);
		await expect(page).toHaveTitle(/\$100K.*Passive Income|Grow Your Cashflow/i);
	});

	test('landing page shows hero section', async ({ page }) => {
		await page.goto('/landing');
		await expect(page.locator('.hero-section')).toBeVisible();
	});

	test('landing page hero has email input for sign-up', async ({ page }) => {
		await page.goto('/landing');
		// Hero CTA form has an email input
		const emailInput = page.locator('input[type="email"]').first();
		await expect(emailInput).toBeVisible();
	});

	test('root route redirects to /landing', async ({ page }) => {
		await page.goto('/');
		// Root page has a server-side redirect to /landing
		await expect(page).toHaveURL(/\/landing/);
	});

	test('landing page shows stats section', async ({ page }) => {
		await page.goto('/landing');
		// Stats section shows passive income / deal count figures
		await expect(page.locator('body')).toContainText(/\$100K|838|455/i);
	});

	test('landing login link goes to login page', async ({ page }) => {
		await page.goto('/landing');
		const loginLink = page.getByRole('link', { name: /Log in|Sign in/i }).first();
		await expect(loginLink).toBeVisible();
	});
});
