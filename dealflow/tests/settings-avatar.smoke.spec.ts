import { expect, test } from '@playwright/test';
import * as path from 'path';
// @ts-expect-error -- .mjs fixtures
import { makeSessionUser } from './fixtures/session.mjs';
// @ts-expect-error
import { installCoreApiMocks } from './fixtures/api-mocks.mjs';
// @ts-expect-error
import { seedSession } from './fixtures/browser-session.mjs';

const MEMBER_EMAIL = 'avatar-tester@example.com';

test.describe('settings avatar upload', () => {
	test.beforeEach(async ({ page }) => {
		await installCoreApiMocks(page);
		await seedSession(page, makeSessionUser(MEMBER_EMAIL, {
			name: 'Avatar Tester',
			tier: 'academy',
			isAdmin: false
		}));
	});

	test('settings page shows Choose Photo button', async ({ page }) => {
		await page.goto('/app/settings?tab=profile');
		await expect(page.locator('.upload-btn')).toBeVisible({ timeout: 10000 });
		await expect(page.locator('.upload-btn')).toContainText(/Choose Photo/i);
	});

	test('selecting a valid image shows uploading state and success message', async ({ page }) => {
		// Mock avatar upload endpoint to return a URL
		await page.route('**/api/network**', async (route) => {
			const url = new URL(route.request().url());
			if (url.searchParams.get('action') === 'avatar') {
				await route.fulfill({
					status: 200,
					contentType: 'application/json',
					body: JSON.stringify({ avatar_url: 'https://example.com/test-avatar.jpg', success: true })
				});
				return;
			}
			await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({}) });
		});

		await page.goto('/app/settings?tab=profile');
		await expect(page.locator('.upload-btn')).toBeVisible({ timeout: 10000 });

		// Create a minimal 1x1 pixel PNG in memory as a buffer
		const pngBuffer = Buffer.from([
			0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, // PNG signature
			0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52, // IHDR chunk
			0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
			0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53,
			0xde, 0x00, 0x00, 0x00, 0x0c, 0x49, 0x44, 0x41, // IDAT chunk
			0x54, 0x08, 0xd7, 0x63, 0xf8, 0xcf, 0xc0, 0x00,
			0x00, 0x00, 0x02, 0x00, 0x01, 0xe2, 0x21, 0xbc,
			0x33, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, // IEND chunk
			0x44, 0xae, 0x42, 0x60, 0x82
		]);

		const fileInput = page.locator('input[type="file"][accept*="image"]');
		await fileInput.setInputFiles({
			name: 'test-avatar.png',
			mimeType: 'image/png',
			buffer: pngBuffer
		});

		// Should show uploading then success message
		await expect(page.locator('.avatar-help')).toContainText(/Photo saved successfully|Uploading/i, { timeout: 10000 });
	});

	test('non-image file upload shows error message', async ({ page }) => {
		await page.goto('/app/settings?tab=profile');
		await expect(page.locator('.upload-btn')).toBeVisible({ timeout: 10000 });

		const fileInput = page.locator('input[type="file"][accept*="image"]');
		await fileInput.setInputFiles({
			name: 'document.pdf',
			mimeType: 'application/pdf',
			buffer: Buffer.from('%PDF-1.4 fake pdf content')
		});

		// Should show an error about invalid file type
		await expect(page.locator('.avatar-error')).toBeVisible({ timeout: 5000 });
		await expect(page.locator('.avatar-error')).toContainText(/image/i);
	});

	test('settings heading is visible', async ({ page }) => {
		await page.goto('/app/settings?tab=profile');
		// PageHeader renders "Settings" as the page title (no <title> tag)
		await expect(page.locator('body')).toContainText(/Settings/i, { timeout: 10000 });
	});

	test('Personal Information section is visible', async ({ page }) => {
		await page.goto('/app/settings?tab=profile');
		await expect(page.locator('body')).toContainText(/Personal Information/i, { timeout: 10000 });
	});
});
