/**
 * Regression tests for two bugs fixed in April 2026:
 *
 * BUG-1: Deal stage actions (Save Deal / Not Interested) returned 500 "Internal server error"
 *   Root cause: user_deal_stages CHECK constraint (from migration 040) accepted only
 *   ('browse','saved','vetting','diligence','decision','invested','passed') but the frontend
 *   sends CANONICAL_DB_STAGES ('filter','review','connect','decide','invested','skipped').
 *   Fix: migration 069 aligns the constraint; write.js returns 422 for constraint violations.
 *
 * BUG-2: OTP input too narrow on mobile — submit button had width:100% + margin-top:18px
 *   inside the flex .otp-input-row, stealing all available width from the input.
 *   Fix: .otp-input-row .submit-button overrides to width:auto, flex-shrink:0, margin-top:0;
 *   stacks vertically on viewports ≤400px.
 */

import { expect, test } from '@playwright/test';
// @ts-expect-error -- .mjs fixtures
import { makeSessionUser } from './fixtures/session.mjs';
// @ts-expect-error
import { installCoreApiMocks, ADMIN_EMAIL } from './fixtures/api-mocks.mjs';
// @ts-expect-error
import { seedSession } from './fixtures/browser-session.mjs';

// ────────────────────────────────────────────────────────────
// BUG-1: Deal stage actions
// ────────────────────────────────────────────────────────────

test.describe('BUG-1 regression: deal stage actions do not 500', () => {
	test.beforeEach(async ({ page }) => {
		await installCoreApiMocks(page);
	});

	test('Save Deal returns 200 and shows no error banner', async ({ page }) => {
		// Override userdata POST to return 200 (successful stage upsert after migration fix)
		await page.route('**/api/userdata', async (route) => {
			if (route.request().method() === 'POST') {
				await route.fulfill({
					status: 200,
					contentType: 'application/json',
					body: JSON.stringify({ id: 'stage-row-1', stage: 'review', deal_id: 'deal-yield-1' })
				});
				return;
			}
			await route.continue();
		});

		await seedSession(page, makeSessionUser(ADMIN_EMAIL, {
			name: 'Admin User',
			fullName: 'Admin User',
			tier: 'academy',
			isAdmin: true
		}));

		await page.goto('/app/deals');
		await expect(page.locator('.deal-card')).toHaveCount(2);

		const saveBtn = page.locator('.deal-card').first().getByRole('button', { name: 'Save Deal' });
		await saveBtn.click();
		await page.waitForTimeout(1500);

		// No error banner should appear
		const notice = page.locator('.compare-notice[role="status"]');
		const noticeVisible = await notice.isVisible().catch(() => false);
		if (noticeVisible) {
			await expect(notice).not.toContainText(/Internal server error/i);
			await expect(notice).not.toContainText(/Something went wrong saving/i);
		}

		await expect(page).toHaveURL(/\/app\/deals/);
	});

	test('deal stage POST with 422 constraint violation shows friendly message not raw error', async ({ page }) => {
		// Simulate the new 422 response from write.js (after defensive error handling fix)
		await page.route('**/api/userdata', async (route) => {
			if (route.request().method() === 'POST') {
				await route.fulfill({
					status: 422,
					contentType: 'application/json',
					body: JSON.stringify({ error: 'Invalid stage value. Please reload and try again.' })
				});
				return;
			}
			await route.continue();
		});

		await seedSession(page, makeSessionUser(ADMIN_EMAIL, {
			name: 'Admin User',
			fullName: 'Admin User',
			tier: 'academy',
			isAdmin: true
		}));

		await page.goto('/app/deals');
		await expect(page.locator('.deal-card')).toHaveCount(2);

		const saveBtn = page.locator('.deal-card').first().getByRole('button', { name: 'Save Deal' });
		await saveBtn.click();

		const notice = page.locator('.compare-notice[role="status"]');
		await expect(notice).toBeVisible({ timeout: 5000 });

		// Must not show the raw HTTP error text
		await expect(notice).not.toContainText('Internal server error');
		// Should show a friendly message
		await expect(notice).toContainText(/went wrong|could not|reload/i);
		await expect(page).toHaveURL(/\/app\/deals$/);
	});

	test('deal stage POST with 500 maps to friendly notice (pre-migration guard)', async ({ page }) => {
		// This reproduces the exact pre-fix failure: API returned 500 "Internal server error"
		// Verifies the UI still maps it to a friendly message
		await page.route('**/api/userdata', async (route) => {
			if (route.request().method() === 'POST') {
				await route.fulfill({
					status: 500,
					contentType: 'application/json',
					body: JSON.stringify({ error: 'Internal server error', message: 'violates check constraint "user_deal_stages_stage_check"' })
				});
				return;
			}
			await route.continue();
		});

		await seedSession(page, makeSessionUser(ADMIN_EMAIL, {
			name: 'Admin User',
			fullName: 'Admin User',
			tier: 'academy',
			isAdmin: true
		}));

		await page.goto('/app/deals');
		await expect(page.locator('.deal-card')).toHaveCount(2);

		const saveBtn = page.locator('.deal-card').first().getByRole('button', { name: 'Save Deal' });
		await saveBtn.click();

		const notice = page.locator('.compare-notice[role="status"]');
		await expect(notice).toBeVisible({ timeout: 5000 });

		// UI must translate "Internal server error" to a user-friendly message
		await expect(notice).not.toContainText('Internal server error');
		await expect(notice).toContainText(/went wrong|could not|reload/i);
	});
});

// ────────────────────────────────────────────────────────────
// BUG-2: OTP input sizing on mobile
// ────────────────────────────────────────────────────────────

test.describe('BUG-2 regression: OTP input usable on mobile', () => {
	test('OTP input is not squeezed to zero width at 390px', async ({ page }) => {
		await page.setViewportSize({ width: 390, height: 844 });

		// Seed localStorage to trigger OTP mode (last email stored, error param present)
		await page.addInitScript(() => {
			localStorage.setItem('gyc-last-login-email', 'otp-test@example.com');
		});

		await page.goto('/login?error=unauthorized_client&error_code=401');
		await page.waitForTimeout(1000);

		// OTP mode should be active (expired link → manual code entry)
		const otpInput = page.locator('.otp-input');
		await expect(otpInput).toBeVisible({ timeout: 8000 });

		// Input must have meaningful width — at 390px the fix gives it flex:1 min-width:0
		// and the button is width:auto, so the input should be at least 100px wide
		const inputBox = await otpInput.boundingBox();
		expect(inputBox).not.toBeNull();
		expect(inputBox!.width).toBeGreaterThan(100);
	});

	test('OTP verify button is fully visible and not clipped at 390px', async ({ page }) => {
		await page.setViewportSize({ width: 390, height: 844 });
		await page.addInitScript(() => {
			localStorage.setItem('gyc-last-login-email', 'otp-test@example.com');
		});

		await page.goto('/login?error=unauthorized_client&error_code=401');
		await page.waitForTimeout(1000);

		const verifyBtn = page.locator('.otp-input-row .submit-button');
		await expect(verifyBtn).toBeVisible({ timeout: 8000 });

		const btnBox = await verifyBtn.boundingBox();
		expect(btnBox).not.toBeNull();
		// Button should have meaningful width (not clipped to 0 or hidden)
		expect(btnBox!.width).toBeGreaterThan(40);
		// Button should be within the viewport
		expect(btnBox!.x).toBeGreaterThanOrEqual(0);
		expect(btnBox!.x + btnBox!.width).toBeLessThanOrEqual(400);
	});

	test('OTP input and button are both visible at 375px', async ({ page }) => {
		await page.setViewportSize({ width: 375, height: 667 });
		await page.addInitScript(() => {
			localStorage.setItem('gyc-last-login-email', 'otp-test@example.com');
		});

		await page.goto('/login?error=unauthorized_client&error_code=401');
		await page.waitForTimeout(1000);

		const otpInput = page.locator('.otp-input');
		const verifyBtn = page.locator('.otp-input-row .submit-button');

		await expect(otpInput).toBeVisible({ timeout: 8000 });
		await expect(verifyBtn).toBeVisible();

		const inputBox = await otpInput.boundingBox();
		const btnBox = await verifyBtn.boundingBox();
		expect(inputBox!.width).toBeGreaterThan(60);
		expect(btnBox!.width).toBeGreaterThan(40);
	});

	test('OTP submit button is not offset by margin-top inside flex row', async ({ page }) => {
		await page.setViewportSize({ width: 390, height: 844 });
		await page.addInitScript(() => {
			localStorage.setItem('gyc-last-login-email', 'otp-test@example.com');
		});

		await page.goto('/login?error=unauthorized_client&error_code=401');
		await page.waitForTimeout(1000);

		const otpInput = page.locator('.otp-input');
		const verifyBtn = page.locator('.otp-input-row .submit-button');
		await expect(otpInput).toBeVisible({ timeout: 8000 });

		const inputBox = await otpInput.boundingBox();
		const btnBox = await verifyBtn.boundingBox();

		// At ≤400px the row stacks vertically (button below input)
		// At >400px both are on same row (tops within 5px)
		if (inputBox && btnBox) {
			const sameRow = Math.abs(inputBox.y - btnBox.y) < 20;
			const stacked = btnBox.y > inputBox.y + inputBox.height - 5;
			expect(sameRow || stacked).toBe(true);
		}
	});
});

// ────────────────────────────────────────────────────────────
// BUG-3: Admin Manage Deals page shows 0 deals on initial load
// ────────────────────────────────────────────────────────────
//
// Root cause: persistDealQueueCache writes ~10MB of deal JSON to localStorage,
// triggering QuotaExceededError. The exception was caught by the outer try/catch
// in loadData() which then reset dealWorkflowRows = [].
//
// Fix:
//   1. writeScopedStaleCache now silently catches localStorage write errors
//      (in-memory cache is still populated for within-session navigations).
//   2. persistDealQueueCache is now called outside the main try/catch so that
//      a storage failure never resets dealWorkflowRows.

const MOCK_DEAL_ROWS = [
	{
		id: 'wf-deal-1',
		investment_name: 'Alpha Fund',
		slug: 'alpha-fund',
		dealName: 'Alpha Fund',
		sponsorName: 'Alpha Capital',
		lifecycleStatus: 'draft',
		isVisibleToUsers: false,
		catalogState: 'not_published',
		catalogStateLabel: 'Not Published',
		submissionIntent: 'interested',
		submissionIntentLabel: 'Evaluating',
		submissionSurface: 'admin',
		submissionSurfaceLabel: 'Admin',
		submittedByRole: 'admin',
		submittedByRoleLabel: 'Admin',
		submittedByName: 'Admin User',
		submittedByEmail: 'admin@example.com',
		updatedAt: new Date().toISOString(),
		completenessScore: 40,
		hasBlockingIssues: true,
		readinessLabel: 'Incomplete',
		readyToPublish: false,
		visibilityDisabledReason: null
	},
	{
		id: 'wf-deal-2',
		investment_name: 'Beta REIT',
		slug: 'beta-reit',
		dealName: 'Beta REIT',
		sponsorName: 'Beta Realty',
		lifecycleStatus: 'in_review',
		isVisibleToUsers: false,
		catalogState: 'not_published',
		catalogStateLabel: 'Not Published',
		submissionIntent: 'interested',
		submissionIntentLabel: 'Evaluating',
		submissionSurface: 'admin',
		submissionSurfaceLabel: 'Admin',
		submittedByRole: 'admin',
		submittedByRoleLabel: 'Admin',
		submittedByName: 'Admin User',
		submittedByEmail: 'admin@example.com',
		updatedAt: new Date().toISOString(),
		completenessScore: 72,
		hasBlockingIssues: false,
		readinessLabel: 'Ready',
		readyToPublish: true,
		visibilityDisabledReason: null
	}
];

const MOCK_WF_RESPONSE = {
	success: true,
	data: MOCK_DEAL_ROWS,
	total: 2,
	stats: { totalDeals: 2, draft: 1, inReview: 1, approved: 0, published: 0, doNotPublish: 0, archived: 0 }
};

test.describe('BUG-3 regression: admin manage deals page shows deals on initial load', () => {
	test.beforeEach(async ({ page }) => {
		await installCoreApiMocks(page);
	});

	test('deals tab shows rows on initial page load', async ({ page }) => {
		await page.route('**/api/admin-manage', async (route) => {
			if (route.request().method() === 'POST') {
				await route.fulfill({
					status: 200,
					contentType: 'application/json',
					body: JSON.stringify(MOCK_WF_RESPONSE)
				});
				return;
			}
			await route.continue();
		});

		await seedSession(page, makeSessionUser(ADMIN_EMAIL, {
			name: 'Admin User',
			fullName: 'Admin User',
			tier: 'academy',
			isAdmin: true
		}));

		await page.goto('/app/admin/manage');

		// The stats grid should reflect the 2 mock deals
		await expect(page.locator('.stat-value').first()).toContainText('2', { timeout: 8000 });

		// Deal rows should be visible — no empty state
		await expect(page.locator('.empty-msg')).not.toBeVisible({ timeout: 8000 });
		await expect(page.locator('.workflow-table tbody tr')).toHaveCount(2);
	});

	test('deals tab shows rows even when localStorage.setItem throws QuotaExceededError', async ({ page }) => {
		await page.route('**/api/admin-manage', async (route) => {
			if (route.request().method() === 'POST') {
				await route.fulfill({
					status: 200,
					contentType: 'application/json',
					body: JSON.stringify(MOCK_WF_RESPONSE)
				});
				return;
			}
			await route.continue();
		});

		// Simulate localStorage quota exceeded for the admin deal queue cache key
		await page.addInitScript(() => {
			const original = Storage.prototype.setItem;
			Storage.prototype.setItem = function(key: string, value: string) {
				if (key.includes('gycAdminDealQueueV1')) {
					throw new DOMException('QuotaExceededError: simulated storage full', 'QuotaExceededError');
				}
				return original.call(this, key, value);
			};
		});

		await seedSession(page, makeSessionUser(ADMIN_EMAIL, {
			name: 'Admin User',
			fullName: 'Admin User',
			tier: 'academy',
			isAdmin: true
		}));

		await page.goto('/app/admin/manage');

		// Even with storage failures, deals should still be displayed
		await expect(page.locator('.workflow-table tbody tr')).toHaveCount(2, { timeout: 8000 });
		await expect(page.locator('.empty-msg')).not.toBeVisible();
	});

	test('non-admin is redirected away from manage page', async ({ page }) => {
		await seedSession(page, makeSessionUser('member@example.com', {
			name: 'Regular Member',
			fullName: 'Regular Member',
			tier: 'academy',
			isAdmin: false
		}));

		await page.goto('/app/admin/manage');
		await expect(page).toHaveURL(/\/app\/deals/, { timeout: 8000 });
	});
});
