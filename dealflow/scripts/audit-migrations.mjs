import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, '..');
const migrationsDir = path.join(root, 'supabase', 'migrations');
const manifestPath = path.join(migrationsDir, 'reconciliation-manifest.json');
const strictMode = process.argv.includes('--strict');

function listMigrationFiles() {
	return fs
		.readdirSync(migrationsDir, { withFileTypes: true })
		.filter((entry) => entry.isFile() && entry.name.endsWith('.sql'))
		.map((entry) => entry.name)
		.sort();
}

function collectDuplicatePrefixes(files) {
	const groups = new Map();
	for (const file of files) {
		const match = file.match(/^(\d+)_/);
		const prefix = match?.[1] || 'unprefixed';
		if (!groups.has(prefix)) groups.set(prefix, []);
		groups.get(prefix).push(file);
	}
	return [...groups.entries()].filter(([, groupedFiles]) => groupedFiles.length > 1);
}

function collectCreateTableCollisions(files) {
	const tableMap = new Map();
	const createTablePattern =
		/create\s+table\s+(?:if\s+not\s+exists\s+)?(?:"?([\w]+)"?\.)?"?([\w]+)"?/gi;

	for (const file of files) {
		const source = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
		let match;
		while ((match = createTablePattern.exec(source)) !== null) {
			const schema = match[1] || 'public';
			const table = `${schema}.${match[2]}`;
			if (!tableMap.has(table)) tableMap.set(table, []);
			tableMap.get(table).push(file);
		}
	}

	return [...tableMap.entries()].filter(([, owners]) => owners.length > 1);
}

function collectNumberingGaps(files) {
	const prefixes = files
		.map((file) => file.match(/^(\d+)_/)?.[1])
		.filter(Boolean)
		.map((value) => Number.parseInt(value, 10))
		.filter(Number.isFinite);

	const unique = [...new Set(prefixes)].sort((a, b) => a - b);
	const gaps = [];
	for (let i = 1; i < unique.length; i += 1) {
		const prev = unique[i - 1];
		const next = unique[i];
		if (next - prev > 1) {
			gaps.push({ after: prev, before: next, missing: next - prev - 1 });
		}
	}
	return gaps;
}

function formatSection(title, lines) {
	if (!lines.length) return `${title}\n  none`;
	return `${title}\n${lines.map((line) => `  - ${line}`).join('\n')}`;
}

function normalizeIssueGroups(groups) {
	return Object.fromEntries(
		Object.entries(groups || {}).map(([key, value]) => [key, [...(value.files || value)].sort()])
	);
}

function toIssueMap(entries) {
	return Object.fromEntries(entries.map(([key, owners]) => [key, [...owners].sort()]));
}

function diffIssueMaps(actual, expected) {
	const unexpected = [];
	const missing = [];

	for (const [key, owners] of Object.entries(actual)) {
		const expectedOwners = expected[key];
		if (!expectedOwners) {
			unexpected.push(`${key}: ${owners.join(', ')}`);
			continue;
		}
		if (owners.join('|') !== expectedOwners.join('|')) {
			unexpected.push(`${key}: ${owners.join(', ')} (expected ${expectedOwners.join(', ')})`);
		}
	}

	for (const [key, owners] of Object.entries(expected)) {
		if (!actual[key]) {
			missing.push(`${key}: ${owners.join(', ')}`);
		}
	}

	return { unexpected, missing };
}

function loadManifest() {
	if (!fs.existsSync(manifestPath)) {
		throw new Error(`Missing migration reconciliation manifest at ${path.relative(root, manifestPath)}`);
	}

	const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
	return {
		path: path.relative(root, manifestPath),
		duplicatePrefixes: normalizeIssueGroups(manifest?.trackedDebt?.duplicatePrefixes),
		createTableCollisions: normalizeIssueGroups(manifest?.trackedDebt?.createTableCollisions)
	};
}

const files = listMigrationFiles();
const duplicatePrefixes = collectDuplicatePrefixes(files);
const createTableCollisions = collectCreateTableCollisions(files);
const numberingGaps = collectNumberingGaps(files);
const manifest = loadManifest();
const actualDuplicateMap = toIssueMap(duplicatePrefixes);
const actualCollisionMap = toIssueMap(createTableCollisions);
const duplicateDiff = diffIssueMaps(actualDuplicateMap, manifest.duplicatePrefixes);
const collisionDiff = diffIssueMaps(actualCollisionMap, manifest.createTableCollisions);
const trackedDebtLines = [
	...Object.entries(manifest.duplicatePrefixes).map(
		([prefix, groupedFiles]) => `duplicate prefix ${prefix}: ${groupedFiles.join(', ')}`
	),
	...Object.entries(manifest.createTableCollisions).map(
		([table, owners]) => `duplicate table definition ${table}: ${owners.join(', ')}`
	)
];
const unexpectedLines = [
	...duplicateDiff.unexpected,
	...collisionDiff.unexpected
];
const missingManifestLines = [
	...duplicateDiff.missing,
	...collisionDiff.missing
];

console.log(`Scanned ${files.length} migration files in ${path.relative(root, migrationsDir)}.`);
console.log(`Loaded reconciliation manifest: ${manifest.path}`);
console.log(
	formatSection(
		'Duplicate numeric prefixes',
		duplicatePrefixes.map(([prefix, groupedFiles]) => `${prefix}: ${groupedFiles.join(', ')}`)
	)
);
console.log(
	formatSection(
		'Duplicate CREATE TABLE definitions',
		createTableCollisions.map(([table, owners]) => `${table}: ${owners.join(', ')}`)
	)
);
console.log(
	formatSection(
		'Numbering gaps',
		numberingGaps.map(({ after, before, missing }) => `missing ${missing} prefix value(s) between ${after} and ${before}`)
	)
);
console.log(formatSection('Tracked migration debt', trackedDebtLines));
console.log(formatSection('Unexpected migration drift', unexpectedLines));
console.log(formatSection('Manifest entries not present in repo', missingManifestLines));

const hasUnexpectedDrift = unexpectedLines.length > 0 || missingManifestLines.length > 0;
const hasTrackedDebt = duplicatePrefixes.length > 0 || createTableCollisions.length > 0;

if (hasUnexpectedDrift || (strictMode && hasTrackedDebt)) {
	process.exitCode = 1;
}
