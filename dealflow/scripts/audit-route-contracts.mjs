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
const dealFlowPage = read('src/routes/app/deals/+page.svelte');
const assetsPage = read('src/routes/app/assets/+page.svelte');
const goalsPage = read('src/routes/app/goals/+page.svelte');
const marketIntelPage = read('src/routes/app/market-intel/+page.svelte');
const officeHoursPage = read('src/routes/app/office-hours/+page.svelte');
const resourcesPage = read('src/routes/app/resources/+page.svelte');
const settingsPage = read('src/routes/app/settings/+page.svelte');
const marketIntelApi = read('api/market-intel.js');
const sponsorPage = read('src/routes/sponsor/+page.svelte');
const personPage = read('src/routes/person/+page.svelte');
const taxPrepPage = read('src/routes/app/tax-prep/+page.svelte');
const academyPage = read('src/routes/app/academy/+page.svelte');
const incomeFundPage = read('src/routes/app/income-fund/+page.svelte');
const gpDashboardPage = read('src/routes/gp-dashboard/+page.svelte');
const onboardingPage = read('src/routes/onboarding/+page.svelte');
const gpOnboardingPage = read('src/routes/gp-onboarding/+page.svelte');
const appLayout = read('src/routes/app/+layout.svelte');
const appShell = read('src/lib/layout/AppShell.svelte');
const sidebar = read('src/lib/components/Sidebar.svelte');
const filterBar = read('src/lib/components/FilterBar.svelte');
const swipeFeed = read('src/lib/components/SwipeFeed.svelte');
const compareView = read('src/lib/components/CompareView.svelte');
const smokeSpec = read('tests/session-persona.smoke.spec.ts');
const layoutCss = read('src/lib/css/layout.css');

function assertNoDerivedFunctionCalls(source, fileLabel, names) {
	for (const name of names) {
		assert(
			!source.includes(`${name}()`),
			`${fileLabel} must not call rune-derived value ${name}() like a function.`
		);
	}
}

assert(
	operatorsPage.includes('function getOperatorHref(company)'),
	'Operators page must derive sponsor links through getOperatorHref().'
);
assert(
	dealFlowPage.includes("import PageContainer from '$lib/layout/PageContainer.svelte';"),
	'Deal Flow page must import the shared PageContainer.'
);
assert(
	dealFlowPage.includes("import PageHeader from '$lib/layout/PageHeader.svelte';"),
	'Deal Flow page must import the shared PageHeader.'
);
assert(
	dealFlowPage.includes('<PageContainer className="deals-page">'),
	'Deal Flow page must use the shared page wrapper.'
);
assert(
	dealFlowPage.includes('class="deals-shell ly-page-stack"'),
	'Deal Flow page must use the shared stack shell.'
);
assert(
	dealFlowPage.includes('<PageHeader title="Deal Flow"'),
	'Deal Flow page must use the shared PageHeader.'
);
assert(
	dealFlowPage.includes('class="header-row"'),
	'Deal Flow page must keep its header controls inside the shared header row.'
);
assert(
	dealFlowPage.includes('class="deals-grid ly-grid"'),
	'Deal Flow page must use the shared grid primitive for deal cards.'
);
assert(
	operatorsPage.includes('href={getOperatorHref(c)}'),
	'Operators cards must navigate through getOperatorHref(c).'
);
assert(
	!operatorsPage.includes('/app/deals?company='),
	'Operators page must not link operator cards back to /app/deals?company=.'
);

assert(
	layoutCss.includes('.ly-pill-tabs') && layoutCss.includes('.ly-pill-tab'),
	'Shared layout CSS must provide the reusable pill-tab primitive.'
);
assert(
	filterBar.includes('class="mobile-filter-shell ly-mobile-only"'),
	'Deal Flow filter bar must provide the mobile filter shell.'
);
assert(
	swipeFeed.includes('class="swipe-mode-toggle ly-pill-tabs"'),
	'SwipeFeed must use the shared pill-tab primitive for mobile mode switching.'
);
assert(
	!swipeFeed.includes('toolbar-search'),
	'SwipeFeed must not duplicate the page-level search input.'
);
assert(
	compareView.includes('class="compare-table-wrap ly-table-scroll"'),
	'CompareView must use the shared table-scroll wrapper.'
);

for (const [label, source] of [
	['Assets page', assetsPage],
	['Goals page', goalsPage],
	['Resources page', resourcesPage],
	['Settings page', settingsPage],
	['Tax Prep page', taxPrepPage]
]) {
	assert(source.includes("import PageContainer from '$lib/layout/PageContainer.svelte';"), `${label} must import PageContainer.`);
	assert(source.includes("import PageHeader from '$lib/layout/PageHeader.svelte';"), `${label} must import PageHeader.`);
	assert(source.includes('<PageContainer'), `${label} must use PageContainer.`);
	assert(source.includes('<PageHeader'), `${label} must use PageHeader.`);
}

for (const [label, source] of [
	['Office Hours page', officeHoursPage],
	['Academy page', academyPage],
	['Income Fund page', incomeFundPage]
]) {
	assert(source.includes("import PageContainer from '$lib/layout/PageContainer.svelte';"), `${label} must import PageContainer.`);
	assert(source.includes('<PageContainer'), `${label} must use PageContainer.`);
}

assert(
	!goalsPage.includes('topbar-title'),
	'Goals page must not use the legacy topbar title shell.'
);

assert(
	!settingsPage.includes('settings-shell-title'),
	'Settings page must not use the legacy settings shell title wrapper.'
);

assert(
	!taxPrepPage.includes('<div class="ly-frame">'),
	'Tax Prep must not use the legacy ly-frame wrapper directly.'
);

assert(
	marketIntelPage.includes("import PageContainer from '$lib/layout/PageContainer.svelte';"),
	'Market Intel must import the shared PageContainer.'
);

assert(
	marketIntelPage.includes("import PageHeader from '$lib/layout/PageHeader.svelte';"),
	'Market Intel must import the shared PageHeader.'
);

assert(
	marketIntelPage.includes('<PageContainer className="mi-page ly-page-stack">'),
	'Market Intel must use the shared page shell.'
);

assert(
	marketIntelPage.includes('<PageHeader'),
	'Market Intel must use the shared header wrapper.'
);

assert(
	marketIntelPage.includes('class="mi-tab-bar ly-pill-tabs"'),
	'Market Intel must use the shared pill-tab wrapper.'
);

assert(
	marketIntelPage.includes("fetch('/api/market-intel')"),
	'Market Intel page must load data from /api/market-intel.'
);

assert(
	marketIntelApi.includes("from('opportunities')"),
	'Market Intel API must load deal data from opportunities.'
);

assert(
	marketIntelApi.includes('sec-market-data.json'),
	'Market Intel API must load the SEC market dataset.'
);

assert(
	!marketIntelApi.includes('deal_source'),
	'Market Intel API must not query the removed opportunities.deal_source column.'
);

assert(
	!marketIntelApi.includes('submittor,'),
	'Market Intel API must not query the removed opportunities.submittor column.'
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

assertNoDerivedFunctionCalls(sponsorPage, 'Sponsor page', [
	'isPaid',
	'portfolioData',
	'isAdminUser'
]);
assertNoDerivedFunctionCalls(personPage, 'Person page', ['allAssetClasses']);

assert(
	smokeSpec.includes('operator cards load sponsor pages and linked person profiles'),
	'Smoke coverage for Operators -> Sponsor -> Person navigation is required.'
);

assert(
	sidebar.includes("hideHamburgerOnPhone = true"),
	'Sidebar must default to hiding the mobile hamburger.'
);

assert(
	appLayout.includes("import AppShell from '$lib/layout/AppShell.svelte';") &&
		appLayout.includes('<AppShell'),
	'App layout must use the shared AppShell.'
);

assert(
	gpDashboardPage.includes("import AppShell from '$lib/layout/AppShell.svelte';") &&
		gpDashboardPage.includes('<AppShell currentPage="gp-dashboard">'),
	'GP Dashboard must use the shared AppShell.'
);

assert(
	appShell.includes("href: '/app/market-intel'"),
	'Shared AppShell mobile navigation must link to /app/market-intel.'
);

assert(
	!gpDashboardPage.includes('class="mobile-tab-bar"'),
	'GP Dashboard must not use the legacy page-local mobile tab bar.'
);

assert(
	!gpDashboardPage.includes('class="mobile-topbar"'),
	'GP Dashboard must not use the legacy mobile top bar.'
);

assert(
	onboardingPage.includes('class="onboarding-page ly-page"') &&
		onboardingPage.includes('class="onboarding-shell ly-frame"'),
	'Onboarding must use the shared page + frame shell.'
);

assert(
	gpOnboardingPage.includes('class="gp-onboarding-page ly-page"') &&
		gpOnboardingPage.includes('class="gp-onboarding-shell ly-frame"'),
	'GP onboarding must use the shared page + frame shell.'
);

assert(
	!appLayout.includes('padding-top: 56px'),
	'App layout must not reserve top padding for a mobile hamburger.'
);

const routeDir = path.join(root, 'src', 'routes');
const routeFiles = [];
const queue = [routeDir];

while (queue.length) {
	const current = queue.pop();
	for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
		const fullPath = path.join(current, entry.name);
		if (entry.isDirectory()) {
			queue.push(fullPath);
			continue;
		}
		if (entry.isFile() && entry.name.endsWith('.svelte')) {
			routeFiles.push(fullPath);
		}
	}
}

const lingeringMenuButtons = routeFiles.filter((fullPath) => {
	const source = fs.readFileSync(fullPath, 'utf8');
	return source.includes('class="mobile-menu-btn"');
});

assert(
	lingeringMenuButtons.length === 0,
	`Route files must not render mobile hamburger buttons. Found: ${lingeringMenuButtons
		.map((fullPath) => path.relative(root, fullPath))
		.join(', ')}`
);

const unwrappedRoutePages = routeFiles.filter((fullPath) => {
	const relativePath = path.relative(root, fullPath);
	if (!relativePath.endsWith('+page.svelte')) return false;
	const source = fs.readFileSync(fullPath, 'utf8');
	return !(
		source.includes('<PageContainer') ||
		source.includes('ly-page') ||
		source.includes('ly-frame') ||
		source.includes('ly-dashboard-shell') ||
		source.includes('ly-sidebar-main')
	);
});

assert(
	unwrappedRoutePages.length === 0,
	`Route pages must opt into the shared layout shell. Found: ${unwrappedRoutePages
		.map((fullPath) => path.relative(root, fullPath))
		.join(', ')}`
);

console.log('Route audit passed.');
console.log('- Operators cards resolve to Sponsor routes');
console.log('- Sponsor and Person pages use the shared protected-route bootstrap');
console.log('- Sponsor and Person rendering is no longer blocked on hydration');
console.log('- Sponsor and Person do not call rune-derived values like functions');
console.log('- Smoke coverage exists for Operators -> Sponsor -> Person');
console.log('- Mobile navigation defaults to no hamburger on route pages');
console.log('- Route pages opt into the shared layout shell');
