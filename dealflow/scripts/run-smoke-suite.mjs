import fs from 'node:fs';
import { spawn } from 'node:child_process';

import { chromium, firefox, webkit } from '@playwright/test';

const FALLBACK_BASE_URL = process.env.SMOKE_FALLBACK_BASE_URL || 'https://sandbox.growyourcashflow.io';
const ALLOW_FALLBACK = !['0', 'false', 'no'].includes(
	String(process.env.SMOKE_ALLOW_FALLBACK || '1').toLowerCase()
);
const DEFAULT_BROWSER = process.env.PLAYWRIGHT_BROWSER || 'chromium';

const launchers = {
	chromium,
	firefox,
	webkit
};

const candidateBrowsers = Array.from(
	new Set([DEFAULT_BROWSER, 'chromium', 'firefox', 'webkit'].filter(Boolean))
).filter((name) => launchers[name]);

async function canLaunchBrowser(browserName) {
	const launcher = launchers[browserName];
	if (!launcher) return { ok: false, browserName, reason: `Unsupported browser: ${browserName}` };

	try {
		const browser = await launcher.launch({ headless: true });
		await browser.close();
		return { ok: true, browserName };
	} catch (error) {
		return {
			ok: false,
			browserName,
			reason: error?.message || String(error)
		};
	}
}

function runCommand(command, args, env = process.env) {
	return new Promise((resolve) => {
		const child = spawn(command, args, {
			stdio: 'inherit',
			env
		});
		child.on('exit', (code, signal) => {
			resolve({ code: code ?? 1, signal });
		});
	});
}

function getTempBrowserPath() {
	const customPath = process.env.PLAYWRIGHT_BROWSERS_PATH;
	if (customPath) return customPath;

	const tempPath = '/tmp/pw-browsers';
	return fs.existsSync(tempPath) ? tempPath : undefined;
}

async function main() {
	const failures = [];

	for (const browserName of candidateBrowsers) {
		const result = await canLaunchBrowser(browserName);
		if (result.ok) {
			const env = {
				...process.env,
				PLAYWRIGHT_BROWSER: browserName
			};

			const browserPath = getTempBrowserPath();
			if (browserPath) env.PLAYWRIGHT_BROWSERS_PATH = browserPath;

			console.log(`[smoke] Using Playwright browser: ${browserName}`);
			const run = await runCommand('npx', ['playwright', 'test', '-c', 'playwright.config.ts'], env);
			process.exit(run.code);
		}

		failures.push(`${browserName}: ${result.reason}`);
	}

	console.warn('[smoke] No Playwright browser could launch in this Codex desktop environment.');
	for (const failure of failures) {
		console.warn(`[smoke] ${failure}`);
	}

	if (!ALLOW_FALLBACK) {
		console.error('[smoke] Fallback is disabled. Exiting non-zero.');
		process.exit(1);
	}

	console.warn(`[smoke] Falling back to live sandbox verification at ${FALLBACK_BASE_URL}`);
	const fallback = await runCommand('node', ['scripts/qa-sandbox-live.mjs'], {
		...process.env,
		BASE_URL: process.env.BASE_URL || FALLBACK_BASE_URL
	});
	process.exit(fallback.code);
}

main().catch((error) => {
	console.error('[smoke] Unexpected failure:', error?.message || error);
	process.exit(1);
});
