/**
 * Playwright browser session helpers.
 * Requires a Playwright Page instance — do NOT import from unit tests.
 */

export async function seedSession(page, session, options = {}) {
	await page.goto('/login');
	await page.evaluate(({ seededSession, portfolio }) => {
		localStorage.clear();
		localStorage.setItem('gycUser', JSON.stringify(seededSession));
		localStorage.setItem('gycPortfolio', JSON.stringify(portfolio || []));
		localStorage.setItem('gycNotifPrefs', JSON.stringify({
			frequency: 'weekly',
			deal_alerts: true,
			weekly_digest: true
		}));
	}, { seededSession: session, portfolio: options.portfolio || [] });
}
