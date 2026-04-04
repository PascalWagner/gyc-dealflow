#!/usr/bin/env node
/**
 * Local QA runner — tests your current branch end-to-end.
 *
 * 1. Builds the app
 * 2. Starts a preview server on port 4173
 * 3. Runs unit tests, Playwright smoke, plan wizard, membership settings
 * 4. Kills the server and prints a summary
 */

import { spawn } from 'node:child_process';
import { createConnection } from 'node:net';

const PORT = 4173;
const HOST = '127.0.0.1';
const BASE_URL = `http://${HOST}:${PORT}`;
const SERVER_READY_TIMEOUT = 30_000;
const SUITE_TIMEOUT = 300_000;

let serverProcess = null;

function cleanup() {
	if (serverProcess && !serverProcess.killed) {
		serverProcess.kill('SIGTERM');
		setTimeout(() => {
			if (serverProcess && !serverProcess.killed) serverProcess.kill('SIGKILL');
		}, 3000);
	}
}

process.on('exit', cleanup);
process.on('SIGINT', () => { cleanup(); process.exit(130); });
process.on('SIGTERM', () => { cleanup(); process.exit(143); });

function waitForPort(port, host, timeout) {
	return new Promise((resolve, reject) => {
		const deadline = Date.now() + timeout;

		function attempt() {
			if (Date.now() > deadline) {
				reject(new Error(`Server did not start within ${timeout}ms`));
				return;
			}

			const socket = createConnection({ port, host }, () => {
				socket.destroy();
				resolve();
			});
			socket.on('error', () => {
				socket.destroy();
				setTimeout(attempt, 500);
			});
		}

		attempt();
	});
}

function runCommand(label, command, args, env = process.env, timeout = SUITE_TIMEOUT) {
	return new Promise((resolve) => {
		const start = Date.now();
		const child = spawn(command, args, {
			stdio: 'inherit',
			env: { ...env, FORCE_COLOR: '1' }
		});

		const timer = setTimeout(() => {
			child.kill('SIGTERM');
			resolve({ label, ok: false, duration: Date.now() - start, reason: 'timeout' });
		}, timeout);

		child.on('exit', (code) => {
			clearTimeout(timer);
			resolve({
				label,
				ok: code === 0,
				duration: Date.now() - start,
				reason: code === 0 ? null : `exit code ${code}`
			});
		});

		child.on('error', (err) => {
			clearTimeout(timer);
			resolve({ label, ok: false, duration: Date.now() - start, reason: err.message });
		});
	});
}

function formatDuration(ms) {
	if (ms < 1000) return `${ms}ms`;
	return `${(ms / 1000).toFixed(1)}s`;
}

async function main() {
	const results = [];

	// ── Step 1: Build ──
	console.log('\n━━━ Building app ━━━\n');
	const build = await runCommand('Build', 'npm', ['run', 'build']);
	if (!build.ok) {
		console.error('\n✗ Build failed — cannot run local QA.\n');
		process.exit(1);
	}

	// ── Step 2: Start preview server ──
	console.log('\n━━━ Starting preview server ━━━\n');
	serverProcess = spawn('npm', ['run', 'preview', '--', '--host', HOST, '--port', String(PORT)], {
		stdio: 'pipe',
		detached: false
	});
	serverProcess.stdout?.pipe(process.stdout);
	serverProcess.stderr?.pipe(process.stderr);

	try {
		await waitForPort(PORT, HOST, SERVER_READY_TIMEOUT);
		console.log(`Preview server ready at ${BASE_URL}\n`);
	} catch {
		console.error(`\n✗ Preview server failed to start on ${BASE_URL}\n`);
		cleanup();
		process.exit(1);
	}

	// ── Step 3: Run suites ──
	const suites = [
		{
			label: 'Unit tests (all)',
			command: 'npm',
			args: ['run', 'test:unit:all']
		},
		{
			label: 'Playwright smoke (12 browser tests)',
			command: 'npx',
			args: ['playwright', 'test', '-c', 'playwright.config.ts']
		},
		{
			label: 'Plan wizard (browser)',
			command: 'node',
			args: ['scripts/qa-plan-wizard.mjs'],
			env: { BASE_URL }
		},
		{
			label: 'Membership settings (browser)',
			command: 'node',
			args: ['scripts/qa-settings-membership.mjs'],
			env: { QA_BASE_URL: BASE_URL }
		}
	];

	for (const suite of suites) {
		console.log(`\n━━━ ${suite.label} ━━━\n`);
		const env = suite.env ? { ...process.env, ...suite.env } : process.env;
		const result = await runCommand(suite.label, suite.command, suite.args, env);
		results.push(result);

		if (result.ok) {
			console.log(`\n✓ ${suite.label} passed (${formatDuration(result.duration)})`);
		} else {
			console.error(`\n✗ ${suite.label} FAILED (${formatDuration(result.duration)})`);
		}
	}

	// ── Step 4: Cleanup and report ──
	cleanup();

	console.log('\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
	console.log('        LOCAL QA SUMMARY');
	console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

	const maxLabel = Math.max(...results.map((r) => r.label.length));
	for (const r of results) {
		const icon = r.ok ? '✓' : '✗';
		const pad = ' '.repeat(maxLabel - r.label.length);
		console.log(`  ${icon}  ${r.label}${pad}  ${formatDuration(r.duration)}`);
	}

	const failed = results.filter((r) => !r.ok);
	if (failed.length > 0) {
		console.log(`\n${failed.length} suite(s) failed.\n`);
		process.exit(1);
	}

	console.log('\nAll local QA suites passed.\n');
}

main().catch((err) => {
	console.error('Unexpected error:', err.message || err);
	cleanup();
	process.exit(1);
});
