import { expect, test } from '@playwright/test';
// @ts-expect-error -- .mjs fixtures
import { makeSessionUser } from './fixtures/session.mjs';
// @ts-expect-error
import { installCoreApiMocks } from './fixtures/api-mocks.mjs';
// @ts-expect-error
import { seedSession } from './fixtures/browser-session.mjs';

const MEMBER_EMAIL = 'portfolio-upload@example.com';

// Minimal valid PDF header bytes
const FAKE_PDF_BUFFER = Buffer.from('%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\n%%EOF');

test.describe('portfolio PPM upload (AddDealModal)', () => {
	test.beforeEach(async ({ page }) => {
		await installCoreApiMocks(page);
		// Mock deal creation and document upload
		await page.route('**/api/deal-create**', async (route) => {
			await route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({ dealId: 'test-deal-123', createdNewDeal: true, lifecycleStatus: 'in_review' })
			});
		});
		await page.route('**/api/userdata**', async (route) => {
			const body = route.request().method() === 'POST' ? (() => {
				try { return route.request().postDataJSON() || {}; } catch { return {}; }
			})() : {};
			await route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({ success: true })
			});
		});
		await seedSession(page, makeSessionUser(MEMBER_EMAIL, {
			name: 'Portfolio Tester',
			tier: 'academy',
			isAdmin: false
		}));
	});

	test('Add Existing Investment button opens intake modal', async ({ page }) => {
		await page.goto('/app/portfolio');
		// Empty portfolio shows the Add Existing Investment button
		await expect(page.getByRole('button', { name: /Add Existing Investment/i })).toBeVisible({ timeout: 10000 });

		await page.getByRole('button', { name: /Add Existing Investment/i }).click();
		await expect(page.locator('.add-deal-modal__card')).toBeVisible({ timeout: 5000 });
		await expect(page.locator('body')).toContainText(/Deal Intake/i);
	});

	test('modal has deal name input and PPM upload zone', async ({ page }) => {
		await page.goto('/app/portfolio');
		await page.getByRole('button', { name: /Add Existing Investment/i }).click();

		await expect(page.locator('.add-deal-modal__card')).toBeVisible({ timeout: 5000 });
		await expect(page.locator('#addDealName')).toBeVisible();
		await expect(page.locator('#addDealPpmInput')).toBeAttached();
	});

	test('modal closes when X button is clicked', async ({ page }) => {
		await page.goto('/app/portfolio');
		await page.getByRole('button', { name: /Add Existing Investment/i }).click();
		await expect(page.locator('.add-deal-modal__card')).toBeVisible({ timeout: 5000 });

		await page.locator('.add-deal-modal__close').click();
		await expect(page.locator('.add-deal-modal__card')).not.toBeVisible({ timeout: 3000 });
	});

	test('PPM file upload attaches a file to the modal', async ({ page }) => {
		await page.goto('/app/portfolio');
		await page.getByRole('button', { name: /Add Existing Investment/i }).click();
		await expect(page.locator('.add-deal-modal__card')).toBeVisible({ timeout: 5000 });

		const ppmInput = page.locator('#addDealPpmInput');
		await ppmInput.setInputFiles({
			name: 'offering-memorandum.pdf',
			mimeType: 'application/pdf',
			buffer: FAKE_PDF_BUFFER
		});

		// After attaching, the dropzone should reflect the file (is-active class or filename text)
		await expect(page.locator('.add-deal-modal__dropzone').last()).toHaveClass(/is-active/, { timeout: 5000 });
	});

	test('submitting deal name without PPM completes submission', async ({ page }) => {
		await page.goto('/app/portfolio');
		await page.getByRole('button', { name: /Add Existing Investment/i }).click();
		await expect(page.locator('.add-deal-modal__card')).toBeVisible({ timeout: 5000 });

		// Fill required deal name
		await page.locator('#addDealName').fill('Test Investment Fund');

		// Submit
		const submitBtn = page.locator('.add-deal-modal__primary').first();
		await expect(submitBtn).toBeVisible();
		await submitBtn.click();

		// Success state appears
		await expect(page.locator('body')).toContainText(/Submission Complete|submitted|review/i, { timeout: 10000 });
	});
});
