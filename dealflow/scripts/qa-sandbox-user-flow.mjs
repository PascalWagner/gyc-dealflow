import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const BASE_URL = process.env.BASE_URL || 'https://sandbox.growyourcashflow.io';
const QA_EMAIL = process.env.QA_EMAIL || 'info@pascalwagner.com';

async function expectJson(response, label) {
	const payload = await response.json().catch(() => ({}));
	assert.equal(response.ok, true, `${label} failed with ${response.status}: ${JSON.stringify(payload)}`);
	return payload;
}

async function run() {
	const results = { baseUrl: BASE_URL, email: QA_EMAIL, tests: {} };
	const consoleErrors = [];

	// ── Auth ──
	const authPayload = await expectJson(
		await fetch(`${BASE_URL}/api/auth`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ action: 'magic-link', email: QA_EMAIL, siteUrl: BASE_URL })
		}),
		'POST /api/auth'
	);
	assert.ok(authPayload?.token, 'Expected sandbox auth to return an access token');
	results.tests.auth = true;

	// ── Browser ──
	const browser = await chromium.launch({ headless: true });

	try {
		// ── Test A: Deals load (desktop) ──
		const desktopCtx = await browser.newContext({ viewport: { width: 1440, height: 960 } });
		const page = await desktopCtx.newPage();
		page.on('console', (msg) => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
		page.on('pageerror', (err) => consoleErrors.push(err.message));

		await page.goto(`${BASE_URL}/login`);
		await page.evaluate((session) => {
			localStorage.clear();
			localStorage.setItem('gycUser', JSON.stringify(session));
		}, authPayload);
		await page.goto(`${BASE_URL}/app/deals`);
		await page.waitForSelector('.deal-card', { timeout: 20000 });

		const dealCardCount = await page.locator('.deal-card').count();
		assert.ok(dealCardCount > 0, `Expected deal cards to render, got ${dealCardCount}`);
		results.tests.dealsLoad = true;
		console.log(`  ✓ Test A: ${dealCardCount} deal cards loaded`);

		// ── Test B: Save Deal — no error banner ──
		const saveBtn = page.locator('.deal-card').first().getByRole('button', { name: 'Save Deal' });
		const saveBtnVisible = await saveBtn.isVisible().catch(() => false);
		if (saveBtnVisible) {
			await saveBtn.click();
			await page.waitForTimeout(3000);

			const notice = page.locator('.compare-notice[role="status"]');
			const noticeVisible = await notice.isVisible().catch(() => false);
			if (noticeVisible) {
				const noticeText = await notice.textContent();
				assert.ok(
					!noticeText.toLowerCase().includes('internal server error'),
					`Error banner showed "Internal server error": ${noticeText}`
				);
			}
			await page.waitForURL(/\/app\/deals/);
			results.tests.saveDealNoError = true;
			console.log('  ✓ Test B: Save Deal — no internal server error');
		} else {
			results.tests.saveDealNoError = 'skipped (no Save Deal button visible)';
			console.log('  ⊘ Test B: Skipped — Save Deal button not visible');
		}

		// ── Test C: Stage persists (check Review tab) ──
		if (saveBtnVisible) {
			const reviewTab = page.locator('button, [role="tab"]').filter({ hasText: 'Review' }).first();
			const reviewTabVisible = await reviewTab.isVisible().catch(() => false);
			if (reviewTabVisible) {
				await reviewTab.click();
				await page.waitForTimeout(2000);
				const reviewCards = await page.locator('.deal-card').count();
				results.tests.stagePersists = reviewCards > 0;
				console.log(`  ${reviewCards > 0 ? '✓' : '✗'} Test C: Stage persists — ${reviewCards} cards in Review`);
			} else {
				results.tests.stagePersists = 'skipped (Review tab not found)';
				console.log('  ⊘ Test C: Skipped — Review tab not visible');
			}
		} else {
			results.tests.stagePersists = 'skipped';
		}

		await desktopCtx.close();

		// ── Test D: Mobile viewport ──
		const mobileCtx = await browser.newContext({ viewport: { width: 390, height: 844 } });
		const mobilePage = await mobileCtx.newPage();
		mobilePage.on('pageerror', (err) => consoleErrors.push(`[mobile] ${err.message}`));

		await mobilePage.goto(`${BASE_URL}/login`);
		await mobilePage.evaluate((session) => {
			localStorage.clear();
			localStorage.setItem('gycUser', JSON.stringify(session));
		}, authPayload);
		await mobilePage.goto(`${BASE_URL}/app/deals`);

		// On mobile, deals may render as swipe cards or grid cards
		const mobileCardSelector = '.deal-card, .swipe-card-shell .deal-card';
		await mobilePage.waitForSelector(mobileCardSelector, { timeout: 20000 }).catch(() => null);
		const mobileCards = await mobilePage.locator(mobileCardSelector).first().isVisible().catch(() => false);
		assert.ok(mobileCards, 'Expected deal cards to render on mobile viewport');

		const mobileNotice = mobilePage.locator('.compare-notice[role="status"]');
		const mobileNoticeVisible = await mobileNotice.isVisible().catch(() => false);
		if (mobileNoticeVisible) {
			const text = await mobileNotice.textContent();
			assert.ok(
				!text.toLowerCase().includes('internal server error'),
				`Mobile error banner showed "Internal server error": ${text}`
			);
		}
		results.tests.mobileDealsLoad = true;
		console.log('  ✓ Test D: Mobile deals render without error');

		await mobileCtx.close();
	} finally {
		await browser.close();
	}

	results.consoleErrors = consoleErrors.filter(
		(msg) => !msg.includes('favicon') && !msg.includes('manifest')
	);

	console.log('\n' + JSON.stringify(results, null, 2));
}

run().catch((error) => {
	console.error('[qa-sandbox-user-flow] failed:', error?.message || error);
	process.exitCode = 1;
});
