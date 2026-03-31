import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, '..');

const budgets = [
	{ file: 'api/admin-manage.js', maxLines: 80, reason: 'Thin verified-admin wrapper only.' },
	{ file: 'api/deals.js', maxLines: 220, reason: 'Must stay a shared serializer entrypoint, not a second read-model god file.' },
	{ file: 'api/member/deals.js', maxLines: 120, reason: 'Must stay a thin handler over the modular repository/transform/filter pipeline.' },
	{ file: 'api/userdata.js', maxLines: 100, reason: 'Must remain a dispatch wrapper over userdata read/write modules.' },
	{ file: 'src/routes/app/deals/+page.svelte', maxLines: 1700, reason: 'Deal Flow route should remain orchestration-first, with workspace helpers/components extracted.' },
	{ file: 'src/routes/deal/[id]/+page.svelte', maxLines: 3800, reason: 'LP deal page should keep shedding UI/storage clusters into components and shared utilities.' }
];

function countLines(relativePath) {
	const fullPath = path.join(root, relativePath);
	const source = fs.readFileSync(fullPath, 'utf8');
	return source.split('\n').length;
}

const results = budgets.map((budget) => ({
	...budget,
	lines: countLines(budget.file)
}));

let hasFailures = false;

console.log('Architecture size audit');
for (const result of results) {
	const status = result.lines <= result.maxLines ? 'PASS' : 'FAIL';
	const delta = result.lines - result.maxLines;
	if (delta > 0) hasFailures = true;
	console.log(
		`- ${status} ${result.file}: ${result.lines} lines (budget ${result.maxLines})`
	);
	if (delta > 0) {
		console.log(`    exceeds budget by ${delta} lines. ${result.reason}`);
	}
}

if (hasFailures) {
	process.exitCode = 1;
}
