/**
 * Playwright wrapper for the impersonation test suite.
 *
 * Loads the app, injects an admin session into localStorage,
 * then runs the full impersonation-test.js script in the browser
 * and reports pass/fail back to the CI runner.
 *
 * Required env vars:
 *   TEST_URL         — the deployed app URL (e.g. https://dealflow-puce.vercel.app)
 *   TEST_ADMIN_EMAIL — admin email to inject into the fake session
 */
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const APP_URL = process.env.TEST_URL || 'https://dealflow-puce.vercel.app';
const ADMIN_EMAIL = process.env.TEST_ADMIN_EMAIL || 'info@pascalwagner.com';

// Read the test script from disk
const testScript = fs.readFileSync(
  path.join(__dirname, 'impersonation-test.js'),
  'utf8'
);

test.describe('Impersonation', () => {
  test('full impersonation flow across all pages', async ({ page }) => {
    // Collect console output for CI visibility
    page.on('console', msg => {
      const text = msg.text();
      if (text.includes('✓') || text.includes('✗') || text.includes('===') || text.includes('ABORT')) {
        console.log(text);
      }
    });

    // 1. Navigate to the app's index page
    await page.goto(APP_URL + '/index.html', { waitUntil: 'domcontentloaded' });

    // 2. Inject a fake admin session into localStorage
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
      localStorage.setItem('gycOnboardingComplete', '1');
      localStorage.setItem('gycBuyBoxComplete', '1');
    }, ADMIN_EMAIL);

    // 3. Reload to pick up the localStorage session
    await page.goto(APP_URL + '/index.html', { waitUntil: 'networkidle' });
    await page.waitForTimeout(3000);

    // 4. Verify the app loaded and admin functions exist
    const isReady = await page.evaluate(() => {
      return typeof isAdmin === 'function' && typeof viewAsUser === 'function'
        && typeof getUser === 'function' && getUser() !== null;
    });
    expect(isReady).toBe(true);

    // 5. Run the test suite by injecting the script and storing results on window
    //    We wrap the IIFE so its return value is assigned to window.__testResults
    await page.evaluate(async (script) => {
      // Remove the outer IIFE wrapper so we can await it
      // The script is: (async function impersonationTestSuite() { ... })();
      // We eval it directly and capture the result
      window.__testResults = await eval(script);
    }, testScript);

    // 6. Read results
    const results = await page.evaluate(() => window.__testResults);

    // 7. Assert
    expect(results).toBeTruthy();
    expect(results).toHaveProperty('passed');
    expect(results).toHaveProperty('failed');

    console.log(`\n${results.passed}/${results.total} tests passed, ${results.failed} failed`);

    if (results.failed > 0 && results.results) {
      console.log('\nFailed tests:');
      for (const r of results.results.filter(r => !r.pass)) {
        console.log(`  ✗ [${r.phase}] ${r.label}`);
      }
    }

    expect(results.failed).toBe(0);
  });
});
