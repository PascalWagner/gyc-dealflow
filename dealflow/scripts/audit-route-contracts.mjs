import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, '..');

function read(relativePath) {
	return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

function assert(condition, message) {
	if (!condition) {
		throw new Error(message);
	}
}

const operatorsPage = read('src/routes/app/operators/+page.svelte');
const sponsorPage = read('src/routes/sponsor/+page.svelte');
const personPage = read('src/routes/person/+page.svelte');
const smokeSpec = read('tests/session-persona.smoke.spec.ts');

assert(
	operatorsPage.includes('function getOperatorHref(company)'),
	'Operators page must derive sponsor links through getOperatorHref().'
);
assert(
	operatorsPage.includes('href={getOperatorHref(c)}'),
	'Operators cards must navigate through getOperatorHref(c).'
);
assert(
	!operatorsPage.includes('/app/deals?company='),
	'Operators page must not link operator cards back to /app/deals?company=.'
);

for (const [label, source] of [
	['Sponsor page', sponsorPage],
	['Person page', personPage]
]) {
	assert(
		source.includes('bootstrapProtectedRouteSession'),
		`${label} must use bootstrapProtectedRouteSession().`
	);
	assert(
		!source.includes('await hydrateUserScopedData('),
		`${label} must not block rendering on await hydrateUserScopedData().`
	);
}

assert(
	smokeSpec.includes('operator cards load sponsor pages and linked person profiles'),
	'Smoke coverage for Operators -> Sponsor -> Person navigation is required.'
);

console.log('Route audit passed.');
console.log('- Operators cards resolve to Sponsor routes');
console.log('- Sponsor and Person pages use the shared protected-route bootstrap');
console.log('- Sponsor and Person rendering is no longer blocked on hydration');
console.log('- Smoke coverage exists for Operators -> Sponsor -> Person');
