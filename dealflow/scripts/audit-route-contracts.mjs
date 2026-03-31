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
const dealsApi = read('api/deals.js');
const publicDealsApi = read('api/v1/deals.js');
const publicDealDetailApi = read('api/v1/deals/[id].js');
const sponsorPage = read('src/routes/sponsor/+page.svelte');
const personPage = read('src/routes/person/+page.svelte');
const dealDetailPage = read('src/routes/deal/[id]/+page.svelte');
const taxPrepPage = read('src/routes/app/tax-prep/+page.svelte');
const academyPage = read('src/routes/app/academy/+page.svelte');
const incomeFundPage = read('src/routes/app/income-fund/+page.svelte');
const gpDashboardPage = read('src/routes/gp-dashboard/+page.svelte');
const onboardingPage = read('src/routes/onboarding/+page.svelte');
const gpOnboardingPage = read('src/routes/gp-onboarding/+page.svelte');
const appLayout = read('src/routes/app/+layout.svelte');
const appShell = read('src/lib/layout/AppShell.svelte');
const appNav = read('src/lib/navigation/app-nav.js');
const sidebar = read('src/lib/components/Sidebar.svelte');
const filterBar = read('src/lib/components/FilterBar.svelte');
const swipeFeed = read('src/lib/components/SwipeFeed.svelte');
const compareView = read('src/lib/components/CompareView.svelte');
const dealCard = read('src/lib/components/DealCard.svelte');
const dealMap = read('src/lib/components/DealMap.svelte');
const supabaseApi = read('api/_supabase.js');
const userdataApi = read('api/userdata.js');
const userdataRead = read('api/userdata/read.js');
const userdataWrite = read('api/userdata/write.js');
const buyboxApi = read('api/buybox.js');
const eventsApi = read('api/events.js');
const adminManageApi = read('api/admin-manage.js');
const adminManageActions = read('api/admin-manage/actions.js');
const adminSaasMetricsApi = read('api/admin-saas-metrics.js');
const memberDealsApi = read('api/member/deals.js');
const memberDealsRepo = read('api/member/deals/repository.js');
const memberDealsTransform = read('api/member/deals/transform.js');
const memberDealsFilters = read('api/member/deals/filters.js');
const gpDealPerformanceApi = read('api/gp-deal-performance.js');
const userScopedState = read('src/lib/utils/userScopedState.js');
const smokeSpec = read('tests/session-persona.smoke.spec.ts');
const layoutCss = read('src/lib/css/layout.css');
const dealAnalysis = read('src/lib/utils/dealAnalysis.js');
const dealIntroRequests = read('src/lib/utils/dealIntroRequests.js');
const dealflowWorkspaceState = read('src/lib/utils/dealflowWorkspaceState.js');
const dealOpportunityUtils = read('src/lib/utils/dealOpportunity.js');
const dealDetailSignals = read('src/lib/utils/dealDetailSignals.js');
const dealDueDiligenceUtils = read('src/lib/utils/dealDueDiligence.js');
const dealReportUtils = read('src/lib/utils/dealReport.js');
const dealSponsorsUtils = read('src/lib/utils/dealSponsors.js');
const dealDetailUiUtils = read('src/lib/utils/dealDetailUi.js');
const dealWorkflowUtils = read('src/lib/utils/dealWorkflow.js');
const publicDealsShared = read('api/v1/deals/shared.js');

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
	dealFlowPage.includes('<PageContainer className="deals-page">'),
	'Deal Flow page must use the shared page wrapper.'
);
assert(
	dealFlowPage.includes('class="deals-shell ly-page-stack"'),
	'Deal Flow page must use the shared stack shell.'
);
assert(
	dealFlowPage.includes('class="deals-top"') &&
		dealFlowPage.includes('class="desktop-toolbar-row desktop-toolbar-row-primary"') &&
		dealFlowPage.includes('class="desktop-toolbar-row desktop-toolbar-row-secondary deals-filters"') &&
		dealFlowPage.includes('class="mobile-pipeline-row"'),
	'Deal Flow page must keep its custom top toolbar grouped inside the shared page shell.'
);
assert(
	dealFlowPage.includes('class="deals-page-title"') &&
		dealFlowPage.includes('Dealflow'),
	'Deal Flow page must keep the explicit Dealflow section title in its toolbar.'
);
assert(
	dealFlowPage.includes('class="deals-grid ly-grid"'),
	'Deal Flow page must use the shared grid primitive for deal cards.'
);
assert(
	dealFlowPage.includes("from '$lib/utils/dealflowWorkspaceState.js'") &&
		dealFlowPage.includes('normalizeDealflowUiState') &&
		dealFlowPage.includes('buildDealflowUiStateSnapshot'),
	'Deal Flow page must reuse the shared dealflowWorkspaceState helpers for workspace serialization and restoration.'
);
for (const name of [
	'emptyScrollPositions',
	'normalizeDealFlowUiState',
	'getBuyBoxCheckSize',
	'getBuyBoxSelections'
]) {
	assert(
		!dealFlowPage.includes(`function ${name}`),
		`Deal Flow page must not define ${name} inline once the shared workspace-state utility exists.`
	);
}
assert(
	!dealFlowPage.includes('const stageDescriptions = {'),
	'Deal Flow page must not define stage copy inline once the shared workspace-state utility exists.'
);
assert(
	dealflowWorkspaceState.includes('export const DEALFLOW_STAGE_CONTENT') &&
		dealflowWorkspaceState.includes('export function normalizeDealflowUiState') &&
		dealflowWorkspaceState.includes('export function buildDealflowUiStateSnapshot') &&
		dealflowWorkspaceState.includes('export function getBuyBoxSelections'),
	'dealflowWorkspaceState utility must own the Deal Flow stage copy and workspace state normalization helpers.'
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
	filterBar.includes('class="mobile-toolbar ly-mobile-only"') &&
		filterBar.includes('class="mobile-filter-modal ly-mobile-only"'),
	'Deal Flow filter bar must provide the mobile toolbar and modal filter shell.'
);
assert(
	swipeFeed.includes("import DealCard from '$lib/components/DealCard.svelte';") &&
		swipeFeed.includes('<DealCard'),
	'SwipeFeed must render the shared DealCard instead of a separate mobile card variant.'
);
assert(
	!swipeFeed.includes('toolbar-search'),
	'SwipeFeed must not duplicate the page-level search input.'
);
assert(
	compareView.includes('class="compare-table-wrap ly-table-scroll"'),
	'CompareView must use the shared table-scroll wrapper.'
);
assert(
	!supabaseApi.includes('decodeJwtPayload'),
	'Auth helper must not contain an unverified JWT payload fallback.'
);
assert(
	!supabaseApi.includes('usedFallback: true'),
	'Auth helper must not report a decode fallback path.'
);
assert(
	userdataApi.includes("from './userdata/read.js'") &&
		userdataApi.includes("from './userdata/write.js'"),
	'userdata API must delegate to modular read/write handlers.'
);
assert(
	!userdataApi.includes('const TABLE_MAP ='),
	'userdata API must not redefine table mapping inline.'
);
assert(
	userdataRead.includes('handleUserdataAdminGet') &&
		userdataWrite.includes('handleUserdataPost') &&
		userdataWrite.includes('handleUserdataDelete'),
	'userdata module split must keep dedicated read/write handlers.'
);
assert(
	buyboxApi.includes('applyGoalsOverlay('),
	'Buybox API must compose canonical goals into the read model.'
);
assert(
	eventsApi.includes('resolveUserFromAccessToken') &&
		eventsApi.includes('Admin access required for cross-user events'),
	'Events API must require verified identity and explicit admin impersonation.'
);
assert(
	adminManageApi.includes("from './admin-manage/actions.js'") &&
		adminManageApi.includes('verifyAdmin(req)'),
	'Admin manage API must be a thin verified-admin wrapper around the shared action map.'
);
assert(
	adminManageActions.includes('catalogActions') &&
		adminManageActions.includes('qualityActions') &&
		adminManageActions.includes('userActions') &&
		adminManageActions.includes('analyticsActions') &&
		adminManageActions.includes('schemaActions'),
	'Admin manage actions must be composed from domain modules.'
);
assert(
	adminSaasMetricsApi.includes("from './admin-manage/users.js'") &&
		adminSaasMetricsApi.includes('verifyAdmin(req)'),
	'Legacy admin-saas-metrics endpoint must reuse the shared user metrics module behind admin auth.'
);
assert(
	memberDealsApi.includes("from './deals/repository.js'") &&
		memberDealsApi.includes("from './deals/transform.js'") &&
		memberDealsApi.includes("from './deals/filters.js'"),
	'Member deals API must delegate to modular repository/transform/filter layers.'
);
assert(
	dealsApi.includes("from './member/deals/transform.js'") &&
		dealsApi.includes('transformDeals(') &&
		!dealsApi.includes('function computeStaleness('),
	'Primary deals API must reuse the shared member-deals transform instead of rebuilding the normalized read model inline.'
);
assert(
	memberDealsRepo.includes(".is('parent_deal_id', null)") &&
		(memberDealsRepo.includes(".in('deal_id', parentIds)") || memberDealsRepo.includes(".in('deal_id', batchIds)")) &&
		memberDealsRepo.includes('fetchInChunks(') &&
		memberDealsRepo.includes(".eq('asset_class', normalizedQuery.assetClass)") &&
		memberDealsRepo.includes(".eq('status', normalizedQuery.status)") &&
		memberDealsRepo.includes("applyDbSort(") &&
		memberDealsTransform.includes('historicalReturns') &&
		memberDealsFilters.includes('paginateDeals'),
	'Member deals data path must fetch top-level deals, scope sponsor reads to the current dataset, push deterministic filters/sorting into the repository layer, and keep transform/pagination modular.'
);
assert(
	publicDealsApi.includes("from './deals/shared.js'") &&
		publicDealDetailApi.includes("from '../deals/shared.js'") &&
		publicDealsShared.includes('export function formatPublicDeal') &&
		publicDealsShared.includes('export function computePublicDealStaleness'),
	'Public v1 deals APIs must share one formatter/staleness module instead of duplicating public deal serialization logic.'
);
assert(
	gpDealPerformanceApi.includes("from '../src/lib/utils/dealflow-contract.js'") &&
		gpDealPerformanceApi.includes('normalizeStage('),
	'GP deal performance API must use the shared dealflow stage contract.'
);
assert(
	dealDetailPage.includes("from '$lib/utils/dealOpportunity.js'") &&
		dealDetailPage.includes('buildGoalProgress({ deal, buyBox, goalBranch })') &&
		dealDetailPage.includes('buildBuyBoxChecks(deal, buyBox)'),
	'Deal detail page must delegate opportunity-card view models to the shared dealOpportunity utility.'
);
for (const name of [
	'getCompleteness',
	'checkStaleness',
	'buildBuyBoxLite',
	'computeBuyBoxChecks',
	'parseTargetAmount',
	'formatTargetDisplay'
]) {
	assert(
		!dealDetailPage.includes(`function ${name}`),
		`Deal detail page must not define ${name} inline once the shared opportunity utility exists.`
	);
}
assert(
	dealOpportunityUtils.includes('export function getDealCompleteness') &&
		dealOpportunityUtils.includes('export function buildGoalProgress') &&
		dealOpportunityUtils.includes('export function buildBuyBoxChecks') &&
		dealOpportunityUtils.includes('export function summarizeBuyBoxScore'),
		'dealOpportunity utility must own completeness, goal progress, and buy-box matching helpers.'
);
assert(
	dealDetailPage.includes("from '$lib/utils/dealDetailSignals.js'") &&
		dealDetailPage.includes('buildDocumentRows(deal)') &&
		dealDetailPage.includes('buildKeyRiskItems(deal, dealFit, isStale)'),
	'Deal detail page must delegate geography, document, fee, and risk signal view models to the shared detail-signals utility.'
);
for (const name of [
	'normalizeStateCode',
	'getDealStateCodes',
	'buildGeographyLabel',
	'buildDocumentRows',
	'buildSecFilingSummary',
	'buildFeeRows',
	'buildOperatorTrackRecordRows',
	'buildInvestClearlyPreview',
	'buildKeyRiskItems'
]) {
	assert(
		!dealDetailPage.includes(`function ${name}`),
		`Deal detail page must not define ${name} inline once the shared detail-signals utility exists.`
	);
}
assert(
	dealDetailSignals.includes('export function getDealStateCodes') &&
		dealDetailSignals.includes('export function buildSecFilingSummary') &&
		dealDetailSignals.includes('export function buildInvestClearlyPreview'),
		'dealDetailSignals utility must own deal geography, filing, and admin preview read-model helpers.'
);
assert(
	dealDetailPage.includes("from '$lib/utils/dealDueDiligence.js'") &&
		dealDetailPage.includes('getChecklistForDeal(deal)') &&
		dealDetailPage.includes('calcDDProgress(checklist, ddAnswers, deal)'),
	'Deal detail page must delegate due-diligence templates and progress helpers to the shared DD utility.'
);
for (const name of ['getChecklistForDeal', 'getAutoValue', 'calcDDProgress']) {
	assert(
		!dealDetailPage.includes(`function ${name}`),
		`Deal detail page must not define ${name} inline once the shared DD utility exists.`
	);
}
assert(
	dealDueDiligenceUtils.includes('export const DD_CHECKLIST_CREDIT') &&
		dealDueDiligenceUtils.includes('export const DD_CHECKLIST_SYNDICATION') &&
		dealDueDiligenceUtils.includes('export function calcDDProgress'),
		'dealDueDiligence utility must own the DD templates and progress calculation helpers.'
);
assert(
	dealDetailPage.includes("from '$lib/utils/dealReport.js'") &&
		dealDetailPage.includes('buildInvestmentReportHtml({'),
	'Deal detail page must delegate investment report HTML building to the shared dealReport utility.'
);
assert(
	!dealDetailPage.includes("const gL = { passive_income:'Cash Flow'"),
	'Deal detail page must not keep the old inline report builder constants once the report utility exists.'
);
assert(
	dealReportUtils.includes('export function buildInvestmentReportHtml') &&
		dealReportUtils.includes("from '$lib/utils/dealSponsors.js'"),
	'dealReport utility must own the report HTML builder and resolve operator names through the shared sponsor utility.'
);
assert(
	dealDetailPage.includes("from '$lib/utils/dealDetailUi.js'") &&
		dealDetailPage.includes('getDeckPreviewUrl(deal.deckUrl)') &&
		dealDetailPage.includes('buildDealInviteSharePayload({ deal, viewerName: inviteUserName, inviteUrl })'),
	'Deal detail page must delegate hero/share/document helper logic to the shared dealDetailUi utility.'
);
for (const name of ['creditBadgeLabel', 'heroSummary', 'getDeckPreviewUrl']) {
	assert(
		!dealDetailPage.includes(`function ${name}`),
		`Deal detail page must not define ${name} inline once the shared detail UI utility exists.`
	);
}
assert(
	dealDetailUiUtils.includes('export function getDealCreditBadgeLabel') &&
		dealDetailUiUtils.includes('export function buildDealShareMailtoHref') &&
		dealDetailUiUtils.includes('export function getDeckPreviewUrl'),
	'dealDetailUi utility must own canonical hero/share/deck helper functions.'
);
assert(
	dealSponsorsUtils.includes('export function getDealOperator') &&
		dealSponsorsUtils.includes('export function getDealOperatorName'),
	'dealSponsors utility must expose the shared canonical operator resolution helpers.'
);
assert(
	dealDetailPage.includes("from '$lib/utils/dealIntroRequests.js'") &&
		dealDetailPage.includes('submitDealIntroductionRequest({') &&
		dealDetailPage.includes('getDealIntroductionRequestGate(deal.id)') &&
		dealIntroRequests.includes("from '$lib/utils/dealSponsors.js'") &&
		dealAnalysis.includes("from '$lib/utils/dealSponsors.js'") &&
		dealCard.includes("from '$lib/utils/dealSponsors.js'") &&
		dealMap.includes("from '$lib/utils/dealSponsors.js'") &&
		memberDealsTransform.includes("from '../../../src/lib/utils/dealSponsors.js'") &&
		memberDealsFilters.includes("from '../../../src/lib/utils/dealSponsors.js'") &&
		dealWorkflowUtils.includes("from './dealSponsors.js'"),
	'Deal detail, intro requests, analysis, cards, maps, workflow, and member deal transforms/filters must reuse the shared dealSponsors helper instead of duplicating sponsor fallbacks.'
);
assert(
	userScopedState.includes('STATIC_SCOPED_KEYS') &&
		userScopedState.includes('PREFIX_SCOPED_KEYS'),
	'User-scoped storage helper must define scoped key registries.'
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
	appShell.includes("import { PRIMARY_MOBILE_NAV_ITEMS } from '$lib/navigation/app-nav.js';") &&
		appShell.includes('const mobileNavItems = PRIMARY_MOBILE_NAV_ITEMS;') &&
		appNav.includes("key: 'more'") &&
		appNav.includes("href: APP_ROUTES.more"),
	'Shared AppShell mobile navigation must come from the shared app-nav contract.'
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
	(
		onboardingPage.includes('class="onboarding-page ly-page"') &&
		onboardingPage.includes('class="onboarding-shell ly-frame"')
	) ||
		onboardingPage.includes('<LegacyOnboardingFlow'),
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
		source.includes('<OnboardingFocusLayout') ||
		source.includes('<OnboardingAppLayout') ||
		source.includes('<LegacyOnboardingFlow') ||
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
console.log('- Admin APIs share the verified admin action and metrics modules');
console.log('- Member deals API uses the modular query/transform/filter pipeline');
