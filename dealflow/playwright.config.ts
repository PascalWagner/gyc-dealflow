import { defineConfig } from '@playwright/test';

export default defineConfig({
	testDir: './tests',
	testMatch: ['session-persona.smoke.spec.ts'],
	timeout: 30_000,
	expect: {
		timeout: 10_000
	},
	outputDir: '/tmp/dealflow-playwright-results',
	workers: 1,
	use: {
		baseURL: 'http://127.0.0.1:4173',
		headless: true,
		channel: process.env.PLAYWRIGHT_CHANNEL || undefined,
		viewport: { width: 1440, height: 960 }
	},
	webServer: {
		command: 'npm run preview -- --host 127.0.0.1 --port 4173',
		port: 4173,
		reuseExistingServer: !process.env.CI,
		timeout: 120_000
	}
});
