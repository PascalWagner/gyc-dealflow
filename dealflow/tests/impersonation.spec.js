/**
 * Playwright wrapper for the impersonation test suite.
 *
 * Loads the app, injects an admin session into localStorage,
 * then runs the full impersonation-test.js script in the browser
 * and reports pass/fail back to the CI runner.
 *
 * Required env vars:
 *   TEST_URL         — the deployed app URL (e.g. https://deals.growyourcashflow.io)
 *   TEST_ADMIN_EMAIL — admin email to inject into the fake session
 */
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const APP_URL = process.env.TEST_URL || 'https://deals.growyourcashflow.io';
const ADMIN_EMAIL = process.env.TEST_ADMIN_EMAIL || 'info@pascalwagner.com';

// Read the test script from disk
const testScript = fs.readFileSync(
  path.join(__dirname, 'impersonation-test.js'),
  'utf8'
);

test.describe('Impersonation', () => {
  test('full impersonation flow across all pages', async ({ page }) => {
    // 1. Navigate to the app's index page (deals page)
    await page.goto(APP_URL + '/index.html', { waitUntil: 'domcontentloaded' });

    // 2. Inject a fake admin session into localStorage
    //    The app reads auth purely from localStorage — no cookies needed.
    await page.evaluate((email) => {
      const adminUser = {
        email: email,
        name: 'Test Admin',
        firstName: 'Test',
        lastName: 'Admin',
        tier: 'academy',
        token: 'ci-test-token',
        isAdmin: true,
        contactId: 'ci-admin-001'
      };
      localStorage.setItem('gycUser', JSON.stringify(adminUser));
      // Mark onboarding complete so we don't get redirected
      localStorage.setItem('gycOnboardingComplete', '1');
      localStorage.setItem('gycBuyBoxComplete', '1');
    }, ADMIN_EMAIL);

    // 3. Reload to pick up the localStorage session
    await page.goto(APP_URL + '/index.html', { waitUntil: 'networkidle' });

    // Wait for the app to fully initialize
    await page.waitForTimeout(2000);

    // 4. Verify admin session is active
    const isAdminReady = await page.evaluate(() => {
      return typeof isAdmin === 'function' && typeof viewAsUser === 'function'
        && typeof getUser === 'function' && getUser() !== null;
    });
    expect(isAdminReady).toBe(true);

    // 5. Run the full impersonation test suite
    const results = await page.evaluate(async (script) => {
      // The test script is an async IIFE that returns { passed, failed, total, results }
      // We need to eval it and capture the return value
      const fn = new Function('return ' + script);
      return await fn();
    }, testScript);

    // 6. Log results for CI output
    if (results && results.results) {
      for (const r of results.results) {
        if (r.pass) {
          console.log(`  ✓ [${r.phase}] ${r.label}`);
        } else {
          console.error(`  ✗ [${r.phase}] ${r.label}`);
        }
      }
    }

    // 7. Assert all tests passed
    expect(results).toBeTruthy();
    expect(results.failed).toBe(0);
    console.log(`\n${results.passed}/${results.total} tests passed`);
  });
});
