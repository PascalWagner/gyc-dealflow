import { expect, test } from '@playwright/test';
// @ts-expect-error -- .mjs fixtures
import { makeSessionUser } from './fixtures/session.mjs';
// @ts-expect-error
import { installCoreApiMocks, ADMIN_EMAIL } from './fixtures/api-mocks.mjs';
// @ts-expect-error
import { seedSession } from './fixtures/browser-session.mjs';

test.describe('gp-onboarding smoke', () => {
	test.beforeEach(async ({ page }) => {
		await installCoreApiMocks(page);
	});

	test('gp-onboarding redirects away from /gp-onboarding', async ({ page }) => {
		// gp-onboarding/+page.svelte immediately calls goto('/onboarding') on mount.
		// The onboarding page may further redirect (e.g. if already completed).
		await seedSession(page, makeSessionUser(ADMIN_EMAIL, {
			name: 'Admin User',
			tier: 'academy',
			isAdmin: true
		}));

		await page.goto('/gp-onboarding');
		// Should leave /gp-onboarding (redirected to /onboarding which may redirect further)
		await expect(page).not.toHaveURL(/\/gp-onboarding/);
	});

	test('gp-onboarding with query params also redirects away', async ({ page }) => {
		await seedSession(page, makeSessionUser(ADMIN_EMAIL, {
			name: 'Admin User',
			tier: 'academy',
			isAdmin: true
		}));

		await page.goto('/gp-onboarding?role=gp&step=2');
		await expect(page).not.toHaveURL(/\/gp-onboarding/);
	});
});
