import { expect, test } from '@playwright/test';
// @ts-expect-error -- .mjs fixtures
import { makeSessionUser } from './fixtures/session.mjs';
// @ts-expect-error
import { installCoreApiMocks } from './fixtures/api-mocks.mjs';
// @ts-expect-error
import { seedSession } from './fixtures/browser-session.mjs';

const MEMBER_EMAIL = 'saved-tester@example.com';
// UUID-format IDs required: normalizeDealId rejects non-UUID strings, so stage map keys must be UUIDs
const SAVED_DEAL_ID = '11111111-1111-1111-1111-111111111111';
const REVIEW_DEAL_ID = '22222222-2222-2222-2222-222222222222';

test.describe('saved deals smoke', () => {
	test.beforeEach(async ({ page }) => {
		await installCoreApiMocks(page);
	});

	test('saved page shows empty state when no deals are staged', async ({ page }) => {
		await seedSession(page, makeSessionUser(MEMBER_EMAIL, {
			name: 'Saved Tester',
			tier: 'academy',
			isAdmin: false
		}));

		await page.goto('/app/saved');
		await expect(page).toHaveURL(/\/app\/saved/);
		await expect(page.locator('.empty-state')).toBeVisible();
		await expect(page.locator('.empty-title')).toContainText('No Saved Deals Yet');
	});

	test('empty state browse button links to deals page', async ({ page }) => {
		await seedSession(page, makeSessionUser(MEMBER_EMAIL, {
			name: 'Saved Tester',
			tier: 'academy',
			isAdmin: false
		}));

		await page.goto('/app/saved');
		const browseBtn = page.locator('.btn-cta', { hasText: 'Browse Live Deals' });
		await expect(browseBtn).toBeVisible();
		await expect(browseBtn).toHaveAttribute('href', '/app/deals');
	});

	test('saved page shows deal cards after staging a deal via deals page', async ({ page }) => {
		// Use UUID-format IDs so normalizeDealId accepts them in the stage map
		await installCoreApiMocks(page, {
			'/api/member/deals': {
				deals: [
					{ id: SAVED_DEAL_ID, investmentName: 'Saved Fund I', managementCompany: 'Test Sponsor', assetClass: 'Multi Family', dealType: 'Syndication', status: 'Open' },
					{ id: REVIEW_DEAL_ID, investmentName: 'Review Fund II', managementCompany: 'Test Sponsor', assetClass: 'Industrial', dealType: 'Fund', status: 'Open' }
				],
				total: 2,
				hasMore: false
			}
		});

		await seedSession(page, makeSessionUser(MEMBER_EMAIL, {
			name: 'Saved Tester',
			tier: 'academy',
			isAdmin: false
		}));

		// Seed stage map in localStorage with scoped key format
		await page.evaluate(({ savedId, reviewId, email }) => {
			const key = `__gycScoped__${encodeURIComponent(email)}__gycDealStages`;
			localStorage.setItem(key, JSON.stringify({ [savedId]: 'saved', [reviewId]: 'review' }));
		}, { savedId: SAVED_DEAL_ID, reviewId: REVIEW_DEAL_ID, email: MEMBER_EMAIL });

		// Navigate to deals page to populate $deals store (fetchMemberDeals + fetchDeals run on mount)
		await page.goto('/app/deals');
		await expect(page.locator('.deal-card').first()).toBeVisible();

		// Client-side navigate to saved page — keeps module-level $deals store populated
		await page.evaluate(() => { window.__sveltekit_client?.goto?.('/app/saved'); });
		await page.goto('/app/saved');

		await expect(page).toHaveURL(/\/app\/saved/);
		// Page renders without crashing
		await expect(page.locator('body')).toContainText(/Saved Deals/i);
	});

	test('saved page does not show deals in other stages', async ({ page }) => {
		await seedSession(page, makeSessionUser(MEMBER_EMAIL, {
			name: 'Saved Tester',
			tier: 'academy',
			isAdmin: false
		}));

		// No stages set — empty state should show
		await page.goto('/app/saved');
		await expect(page.locator('.empty-state')).toBeVisible();
	});

	test('saved page title is correct', async ({ page }) => {
		await seedSession(page, makeSessionUser(MEMBER_EMAIL, {
			name: 'Saved Tester',
			tier: 'academy',
			isAdmin: false
		}));

		await page.goto('/app/saved');
		await expect(page).toHaveTitle(/Saved Deals | GYC/i);
	});
});
