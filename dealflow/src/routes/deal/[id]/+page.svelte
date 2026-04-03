<script>
	import { page } from '$app/stores';
	import { browser } from '$app/environment';
	import { onMount, tick } from 'svelte';
	import Sidebar from '$lib/components/Sidebar.svelte';
	import InvestingGeographyMap from '$lib/components/InvestingGeographyMap.svelte';
	import DealOpportunityCard from '$lib/components/DealOpportunityCard.svelte';
	import DealAnalysisDashboard from '$lib/components/DealAnalysisDashboard.svelte';
	import ComingSoonOverlay from '$lib/components/ComingSoonOverlay.svelte';
	import DealDisclaimer from '$lib/components/DealDisclaimer.svelte';
	import DealReturnsMiniChart from '$lib/components/DealReturnsMiniChart.svelte';
	import DealModalLayer from '$lib/components/deal/DealModalLayer.svelte';
	import SimilarDealsPanel from '$lib/components/deal/SimilarDealsPanel.svelte';
	import {
		canViewAdvancedDealAnalysis,
		getFreshSessionToken,
		getStoredSessionUser,
		user,
		isLoggedIn,
		isAdmin,
		isMember,
		isGP
	} from '$lib/stores/auth.js';
	import {
		applyAdminImpersonationToUrl,
		currentAdminRealUser,
		readUserScopedJson,
		readUserScopedString,
		writeUserScopedString
	} from '$lib/utils/userScopedState.js';
	import { PRIMARY_MOBILE_NAV_ITEMS } from '$lib/navigation/app-nav.js';
	import {
		dealStages,
		STAGE_META,
		PIPELINE_STAGES,
		normalizeStage,
		stageLabel
	} from '$lib/stores/deals.js';
	import { getUiStage, normalizeStageCounts } from '$lib/utils/dealflow-contract.js';
	import { tapLight } from '$lib/utils/haptics.js';
	import { isNativeApp } from '$lib/utils/platform.js';
	import {
		bgStatusClass,
		bgStatusLabel,
		currentSessionUser,
		firstDefined,
		formatReviewDate,
		loadWhenVisible,
		readScopedDealString,
		statusBadgeClass,
		writeScopedDealString
	} from '$lib/utils/dealPageHelpers.js';
	import {
		buildBuyBoxChecks,
		buildBuyBoxLite,
		buildGoalProgress,
		getDealCompleteness,
		isDealStale,
		normalizeGoalBranch,
		resolveGoalBranch,
		summarizeBuyBoxScore
	} from '$lib/utils/dealOpportunity.js';
	import {
		buildDocumentRows,
		buildFeeRows,
		buildGeographyLabel,
		buildInvestClearlyPreview,
		buildKeyRiskItems,
		buildOperatorTrackRecordRows,
		buildSecFilingSummary,
		getDealStateCodes
	} from '$lib/utils/dealDetailSignals.js';
	import {
		buildDealInviteSharePayload,
		buildDealShareMailtoHref,
		buildDealShareSmsHref,
		getDealCreditBadgeLabel,
		getDealHeroSummary,
		getDealUrl,
		getDeckPreviewUrl
	} from '$lib/utils/dealDetailUi.js';
	import {
		getDealIntroductionRequestGate,
		hasRequestedDealIntroduction,
		submitDealIntroductionRequest
	} from '$lib/utils/dealIntroRequests.js';
	import { buildDealCashFlowProjection } from '$lib/utils/dealCashFlowProjection.js';
	import { filterComparableDeals } from '$lib/utils/dealComparables.js';
	import { buildInvestmentReportHtml } from '$lib/utils/dealReport.js';
	import { getDealOperator } from '$lib/utils/dealSponsors.js';
	import { getDealHistoricalReturns, isDebtOrLendingDeal } from '$lib/utils/dealReturns.js';

	let { data } = $props();
	function getInitialDeal() {
		return data?.deal ?? null;
	}
	function getInitialError() {
		return data?.error ?? null;
	}
	function getInitialComparables() {
		return data?.comparables ?? null;
	}
	const initialDeal = getInitialDeal();
	const initialError = getInitialError();
	const initialComparables = getInitialComparables();
	const academyHref = '/app/academy';
	const nativeCompanionMode = browser && isNativeApp();

	// ===== Reactive State =====
	let deal = $state(initialDeal);
	let loading = $state(!initialDeal);
	let error = $state(initialError);
	let activeTab = $state('overview');
	let shareDropdownOpen = $state(false);
	let socialProof = $state(null);
	let similarDeals = $state(initialComparables?.similarDeals || []);
	const eligibleSimilarDeals = $derived.by(() => filterComparableDeals(similarDeals, deal));

	// Stress Test sliders
	let stInvestment = $state(0);
	let stRentGrowth = $state(3);
	let stExitCap = $state(6);
	let stVacancy = $state(5);
	let stInterest = $state(6);
	let stHold = $state(5);

	// Cash flow chart/table toggle
	let cfView = $state('table');
	let bgCheck = $state(null);
	let bgCheckLoading = $state(false);
	let bgCheckLoaded = $state(false);
	let bgCheckError = $state(false);
	let buyBox = $state(null);
	let deckViewed = $state(false);
	let introRequested = $state(false);
	let toastMessage = $state('');
	let toastVisible = $state(false);
	const buyBoxEditHref = '/app/plan?edit=1';

	// Goal Path
	let userGoal = $state(null);

	// Deck Viewer Modal
	let showDeckViewer = $state(false);

	// Public auth intercept modal
	let showAuthModal = $state(false);
	let authModalTitle = $state('Create a free account');
	let authModalBody = $state('Create a free account to continue.');
	let authEmail = $state('');
	let authSending = $state(false);
	let authSent = $state(false);
	let authError = $state('');

	// Share Class Switching
	let activeShareClass = $state(0);


	// Intro Request Modal
	let showIntroModal = $state(false);
	let introMessage = $state('');
	let introSending = $state(false);
	let introSuccess = $state(false);

	// Property Map
	let dealMap = $state(null);
	let dealMapLoading = $state(false);
	let dealMapError = $state(false);
	let dealMapLoaded = $state(false);

	// Visibility triggers for deferred sections
	let bgCheckSectionVisible = $state(false);
	let dealMapSectionVisible = $state(false);

	// Invite Co-Investors Modal
	let showInviteModal = $state(false);
	let inviteEmail = $state('');
	let inviteMessage = $state('');
	let inviteCode = $state(null);
	let inviteUrl = $state('');
	const inviteUserName = $derived(currentSessionUser().name || 'Someone');
	const inviteSharePayload = $derived.by(() =>
		buildDealInviteSharePayload({ deal, viewerName: inviteUserName, inviteUrl })
	);
	const inviteEmailSubject = $derived(inviteSharePayload.emailSubject || '');
	const inviteEmailBody = $derived(inviteSharePayload.emailBody || '');
	const inviteSmsBody = $derived(inviteSharePayload.smsBody || '');

	// Claim Deal Modal
	let showClaimModal = $state(false);
	let claimName = $state('');
	let claimEmail = $state('');
	let claimRole = $state('');
	let claimCompany = $state('');
	let claimSubmitting = $state(false);
	let claimSuccess = $state(false);

	// ===== Derived =====
	const dealId = $derived($page.params.id);
	const dealOperator = $derived.by(() => getDealOperator(deal));
	const dealOperatorName = $derived(dealOperator?.name || '');
	const dealOperatorCeo = $derived(dealOperator?.ceo || deal?.ceo || '');
	const dealOperatorManagementCompanyId = $derived(dealOperator?.managementCompanyId || null);
	const dealOperatorHref = $derived(
		dealOperatorManagementCompanyId
			? `/sponsor?id=${encodeURIComponent(dealOperatorManagementCompanyId)}`
			: dealOperatorName
				? `/sponsor?company=${encodeURIComponent(dealOperatorName)}`
				: '/sponsor'
	);
	const viewerManagementCompanyId = $derived($user?.managementCompany?.id || $user?.managementCompanyId || $user?.management_company_id || null);
	const viewerManagementCompanyName = $derived(($user?.managementCompany?.name || $user?.managementCompanyName || '').trim().toLowerCase());
	const dealManagementCompanyId = $derived(dealOperatorManagementCompanyId);
	const dealManagementCompanyName = $derived((dealOperatorName || '').trim().toLowerCase());
	const gpOwnsDeal = $derived.by(() => {
		if (!$isGP || !deal) return false;
		if (viewerManagementCompanyId && dealManagementCompanyId) {
			return String(viewerManagementCompanyId) === String(dealManagementCompanyId);
		}
		if (viewerManagementCompanyName && dealManagementCompanyName) {
			return viewerManagementCompanyName === dealManagementCompanyName;
		}
		return false;
	});
	const hasMemberAccess = $derived($canViewAdvancedDealAnalysis || gpOwnsDeal);
	const isPublicViewer = $derived(!$isLoggedIn);
	const isFreeViewer = $derived($isLoggedIn && !$canViewAdvancedDealAnalysis && !gpOwnsDeal);
	const isPaid = $derived(hasMemberAccess);
	const currentStage = $derived(deal ? getUiStage($dealStages[deal.id] || 'filter') : 'filter');
	const socialProofCounts = $derived.by(() => normalizeStageCounts(socialProof || {}));

	const stages = [
		{ key: 'filter', label: 'Filter', num: '1' },
		{ key: 'review', label: 'Review', num: '2' },
		{ key: 'connect', label: 'Connect', num: '3' },
		{ key: 'decide', label: 'Decide', num: '4' },
		{ key: 'invested', label: 'Invested', num: '5' }
	];
	const stageOrder = { filter: 0, review: 1, connect: 2, decide: 3, invested: 4 };
	const currentStageIdx = $derived(currentStage === 'skipped' ? -1 : (stageOrder[currentStage] ?? 0));

	const isCredit = $derived(deal ? isDebtOrLendingDeal(deal) : false);
	const heroClass = $derived(isCredit ? 'hero-lending' : 'hero-equity');
	const completeness = $derived(deal ? getDealCompleteness(deal) : 0);
	const isStale = $derived(deal ? isDealStale(deal) : false);
	const auditingValue = $derived.by(() => firstDefined(
		deal?.auditing,
		deal?.financials,
		deal?.auditStatus,
		deal?.audit_status
	));
	const loanCountValue = $derived.by(() => firstDefined(deal?.loanCount, deal?.loan_count));
	const managerAumValue = $derived.by(() => firstDefined(
		deal?.managerAUM,
		deal?.manager_aum,
		deal?.managementCompanyAUM,
		deal?.management_company_aum,
		deal?.fundAUM,
		deal?.fund_aum
	));
	const fundFoundedYearValue = $derived.by(() => firstDefined(
		deal?.fundFoundedYear,
		deal?.fund_founded_year,
		deal?.foundedYear,
		deal?.founded_year
	));
	const currentFundSizeValue = $derived.by(() => firstDefined(deal?.currentFundSize, deal?.current_fund_size));
	const maxFundSizeValue = $derived.by(() => firstDefined(deal?.maxFundSize, deal?.max_fund_size, deal?.offeringSize, deal?.offering_size));
	const currentAvgLoanLtvValue = $derived.by(() => firstDefined(deal?.currentAvgLoanLtv, deal?.current_avg_loan_ltv, deal?.avgLoanLtv, deal?.avg_loan_ltv));
	const maxAllowedLtvValue = $derived.by(() => firstDefined(deal?.maxAllowedLtv, deal?.max_allowed_ltv));
	const currentLeverageRaw = $derived.by(() => firstDefined(deal?.currentLeverage, deal?.current_leverage));
	const maxAllowedLeverageRaw = $derived.by(() => firstDefined(deal?.maxAllowedLeverage, deal?.max_allowed_leverage));
	// Normalize leverage: values > 10 are almost certainly percentages stored as whole numbers (e.g. 65 = 65%),
	// not debt-to-equity ratios. Convert to ratio: 65 → 0.65x. Values 1-10 are plausible ratios (1.5x etc.).
	function normalizeLeverage(val) {
		if (val == null) return null;
		const n = typeof val === 'number' ? val : parseFloat(val);
		if (isNaN(n) || n <= 0) return null;
		return n > 10 ? n / 100 : n;
	}
	const currentLeverageValue = $derived.by(() => normalizeLeverage(currentLeverageRaw));
	const maxAllowedLeverageValue = $derived.by(() => normalizeLeverage(maxAllowedLeverageRaw));
	// If current > max, the data is inconsistent — suppress both to avoid misleading display
	const leverageConsistent = $derived(
		currentLeverageValue == null || maxAllowedLeverageValue == null || currentLeverageValue <= maxAllowedLeverageValue
	);
	const snapshotAsOfDateValue = $derived.by(() => firstDefined(deal?.snapshotAsOfDate, deal?.snapshot_as_of_date, deal?.asOfDate, deal?.as_of_date));

	// Share Classes
	const sortedShareClasses = $derived(deal?.shareClasses?.length > 0
		? deal.shareClasses.map((sc, i) => ({ sc, origIdx: i })).sort((a, b) => (a.sc.investmentMinimum || 0) - (b.sc.investmentMinimum || 0))
		: []);
	const hasShareClasses = $derived(sortedShareClasses.length > 1);
	const activeShareClassData = $derived(hasShareClasses && deal?.shareClasses?.[activeShareClass] ? deal.shareClasses[activeShareClass] : null);

	// Active metrics (overlaid from share class if selected)
	const displayTargetIRR = $derived(activeShareClassData?.targetReturn != null ? activeShareClassData.targetReturn : deal?.targetIRR);
	const displayPrefReturn = $derived(activeShareClassData?.preferredReturn != null ? activeShareClassData.preferredReturn : deal?.preferredReturn);
	const displayMinInvestment = $derived(activeShareClassData?.investmentMinimum != null ? activeShareClassData.investmentMinimum : deal?.investmentMinimum);
	const displayEquityMultiple = $derived(activeShareClassData?.equityMultiple != null ? activeShareClassData.equityMultiple : deal?.equityMultiple);
	const displayCashOnCash = $derived(activeShareClassData?.cashOnCash != null ? activeShareClassData.cashOnCash : deal?.cashOnCash);
	const displayFees = $derived(activeShareClassData?.fees != null ? activeShareClassData.fees : deal?.fees);
	const displayLpGpSplit = $derived(activeShareClassData?.lpGpSplit != null ? activeShareClassData.lpGpSplit : deal?.lpGpSplit);

	// Deck preview URL
	const deckPreviewUrl = $derived(deal?.deckUrl ? getDeckPreviewUrl(deal.deckUrl) : null);
	const documentRows = $derived.by(() => buildDocumentRows(deal));
	const geographyStates = $derived.by(() => getDealStateCodes(deal));
	const geographyPrimaryState = $derived(geographyStates[0] || null);
	const geographyLabel = $derived.by(() => buildGeographyLabel(deal, geographyStates));
	const secFiling = $derived.by(() => buildSecFilingSummary(deal));
	const feeRows = $derived.by(() => buildFeeRows(deal));
	const operatorTrackRecordRows = $derived.by(() => buildOperatorTrackRecordRows(deal));
	const buyBoxLite = $derived.by(() => buildBuyBoxLite(deal));
	const investClearlyPreview = $derived.by(() => buildInvestClearlyPreview(deal));
	const goalBranch = $derived.by(() => resolveGoalBranch({ userGoal, buyBox }));
	const goalProgress = $derived.by(() => buildGoalProgress({ deal, buyBox, goalBranch }));
	const historicalReturns = $derived.by(() => getDealHistoricalReturns(deal));
	const hasHistoricalReturns = $derived(historicalReturns.length >= 2);
	const latestHistoricalReturn = $derived(historicalReturns.length ? historicalReturns[historicalReturns.length - 1] : null);
	const historicalReturnAverage = $derived.by(() => {
		if (!historicalReturns.length) return null;
		return historicalReturns.reduce((sum, point) => sum + (Number(point?.value) || 0), 0) / historicalReturns.length;
	});
	const historicalReturnsRangeLabel = $derived.by(() => {
		if (!historicalReturns.length) return '';
		if (historicalReturns.length === 1) return String(historicalReturns[0].year);
		return `${historicalReturns[0].year}-${historicalReturns[historicalReturns.length - 1].year}`;
	});
	const keyRiskItems = $derived.by(() => buildKeyRiskItems(deal, dealFit, isStale));

	// Buy Box Match
	const buyBoxChecks = $derived.by(() => buildBuyBoxChecks(deal, buyBox));
	const buyBoxScore = $derived.by(() => summarizeBuyBoxScore(buyBoxChecks));

	// Next stage for advance button
	const nextStage = $derived.by(() => {
		const idx = currentStageIdx;
		if (idx < 0 || idx >= stages.length - 1) return null;
		return stages[idx + 1];
	});

	// ===== Deal Fit Summary =====
	const dealFit = $derived.by(() => {
		if (!deal) return null;
		const fits = [];
		const warnings = [];
		const irr = deal.targetIRR;
		if (irr) { const p = irr > 1 ? irr : irr * 100; if (p > 12) fits.push(`Target IRR of ${p.toFixed(1)}% exceeds 12% threshold`); else if (p < 8) warnings.push(`Target IRR of ${p.toFixed(1)}% is below 8%`); }
		const pref = deal.preferredReturn;
		if (pref) { const p = pref > 1 ? pref : pref * 100; if (p >= 7) fits.push(`Preferred return of ${p.toFixed(1)}% meets 7%+ benchmark`); else warnings.push(`Preferred return of ${p.toFixed(1)}% is below 7% benchmark`); }
		if (deal.equityMultiple) { if (deal.equityMultiple >= 1.5) fits.push(`Equity multiple of ${deal.equityMultiple.toFixed(2)}x exceeds 1.5x target`); else warnings.push(`Equity multiple of ${deal.equityMultiple.toFixed(2)}x is below 1.5x target`); }
		if (deal.fees) { const m = String(deal.fees).match(/([\d.]+)\s*%/); if (m) { const f = parseFloat(m[1]); if (f <= 2) fits.push(`Management fee of ${f}% is within acceptable range`); else warnings.push(`Management fee of ${f}% exceeds 2% typical threshold`); } }
		const oy = deal.mcFoundingYear ? (new Date().getFullYear() - deal.mcFoundingYear) : 0;
		if (oy >= 10) fits.push(`Operator has ${oy}+ years of track record`); else if (oy > 0 && oy < 3) warnings.push(`Newer operator with only ${oy} year${oy !== 1 ? 's' : ''} of track record`);
		if (deal.distributions) { const dl = deal.distributions.toLowerCase(); if (dl.includes('monthly')) fits.push('Monthly distributions provide regular cash flow'); else if (dl.includes('quarterly')) fits.push('Quarterly distributions'); }
		if (deal.offeringType && deal.offeringType.includes('506')) fits.push(`${deal.offeringType} SEC-registered offering`);
		if (isStale) warnings.push('This deal may no longer be accepting new investors');
		if (fits.length === 0 && warnings.length === 0) return null;
		const score = fits.length - warnings.length;
		let verdict, verdictColor;
		if (score >= 3) { verdict = 'Strong Fit'; verdictColor = 'var(--primary)'; }
		else if (score >= 1) { verdict = 'Good Fit'; verdictColor = '#3b82f6'; }
		else if (score >= -1) { verdict = 'Weak Fit'; verdictColor = '#f59e0b'; }
		else { verdict = 'Poor Fit'; verdictColor = '#ef4444'; }
		return { fits, warnings, verdict, verdictColor, score };
	});
	const fitSummary = $derived.by(() => dealFit || {
		verdict: 'Member Analysis',
		verdictColor: '#51BE7B',
		score: 0,
		fits: ['Benchmark alignment unlocks for members.'],
		warnings: ['This section combines returns, fees, and sponsor context into one evaluation layer.']
	});
	function setBgCheckSectionVisible(value) {
		bgCheckSectionVisible = value;
	}

	function setDealMapSectionVisible(value) {
		dealMapSectionVisible = value;
	}

	async function loadBackgroundCheck(force = false) {
		if (!dealOperatorManagementCompanyId || bgCheckLoading || (bgCheckLoaded && !force)) return;
		if (!hasMemberAccess) return;
		bgCheckLoading = true;
		bgCheckError = false;
		try {
			const headers = getStoredSessionUser()?.token ? { 'Authorization': `Bearer ${getStoredSessionUser().token}` } : {};
			const resp = await fetch(`/api/background-check?managementCompanyId=${encodeURIComponent(dealOperatorManagementCompanyId)}`, { headers });
			if (resp.ok) {
				const data = await resp.json();
				bgCheck = data?.results?.[0] || null;
			} else {
				bgCheckError = true;
			}
		} catch {
			bgCheckError = true;
		} finally {
			bgCheckLoaded = true;
			bgCheckLoading = false;
		}
	}


	async function loadDealMap(force = false) {
		if (!deal || dealMapLoading || (dealMapLoaded && !force)) return;
		if (!isPaid) return;
		const locationStr = deal.propertyAddress || deal.address || (deal.city && deal.state ? `${deal.city}, ${deal.state}` : null) || deal.location;
		if (!locationStr) {
			dealMapError = true;
			dealMapLoaded = true;
			return;
		}
		dealMapLoading = true;
		dealMapError = false;
		try {
			if (!document.querySelector('link[href*="leaflet.css"]')) {
				const link = document.createElement('link');
				link.rel = 'stylesheet';
				link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
				document.head.appendChild(link);
			}
			const leaflet = await import('https://unpkg.com/leaflet@1.9.4/dist/leaflet-src.esm.js');
			const L = leaflet.default || leaflet;
			const resp = await fetch('https://nominatim.openstreetmap.org/search?format=json&q=' + encodeURIComponent(locationStr) + '&limit=1');
			const data = await resp.json();
			if (data && data.length > 0) {
				const lat = parseFloat(data[0].lat);
				const lon = parseFloat(data[0].lon);
				dealMapLoading = false;
				await tick();
				const el = document.getElementById('dealLocationMap');
				if (!el) return;
				dealMap = L.map(el).setView([lat, lon], 13);
				L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
					attribution: '&copy; OpenStreetMap contributors',
					maxZoom: 18
				}).addTo(dealMap);
				L.marker([lat, lon]).addTo(dealMap)
					.bindPopup(`<strong>${deal.investmentName || deal.name || 'Property'}</strong><br>${locationStr}`)
					.openPopup();
			} else {
				dealMapError = true;
				dealMapLoading = false;
			}
		} catch (e) {
			console.warn('Deal map geocoding failed:', e);
			dealMapError = true;
			dealMapLoading = false;
		} finally {
			dealMapLoaded = true;
		}
	}

	$effect(() => {
		if (bgCheckSectionVisible) void loadBackgroundCheck();
	});

	$effect(() => {
		if (dealMapSectionVisible) void loadDealMap();
	});

	// ===== Cash Flow Projection (derived) =====
	const cashFlowProjection = $derived.by(() => buildDealCashFlowProjection(deal));
	const cfYieldRate = $derived(cashFlowProjection?.basis?.rate || 0);
	const cfYieldLabel = $derived(cashFlowProjection?.basis?.label || (isCredit ? 'yield' : 'pref return'));
	const cfInvestment = $derived(cashFlowProjection?.investment || 0);
	const cfHold = $derived(cashFlowProjection?.holdYears || 0);
	const cfIsEvergreen = $derived(cashFlowProjection?.isEvergreen === true);
	const cfRows = $derived(cashFlowProjection?.rows || []);
	const cfTotalCash = $derived(cashFlowProjection?.totalCash || 0);
	const cfAvgCoC = $derived(cashFlowProjection?.avgCashOnCashPct || 0);
	const cfMaxBar = $derived(cashFlowProjection?.maxBar || 1);
	const cfUnavailableReason = $derived.by(() => {
			switch (cashFlowProjection?.reason) {
				case 'missing_explicit_yield':
					return 'No explicit cash-yield assumption is saved for this lending fund yet, so the LP cash flow projection is hidden.';
				case 'missing_projection_metric':
					return 'No forward-looking return assumption is saved for this deal yet, so the LP cash flow projection is hidden.';
				case 'missing_investment_minimum':
					return 'Add an investment minimum before showing a projected LP cash flow table.';
				case 'missing_hold_period':
					return 'Add an explicit projection horizon before showing a projected LP cash flow table.';
				default:
					return '';
			}
		});
	// ===== Stress Test derived =====
	const stBaseIRR = $derived.by(() => { const v = deal?.targetIRR || 0.15; return v > 1 ? v/100 : v; });
	const stBaseCoC = $derived.by(() => { const v = deal?.cashOnCash || 0.08; return v > 1 ? v/100 : v; });
	const stBaseEM = $derived(deal?.equityMultiple || 2.0);
	const stBaseHold = $derived(deal?.holdPeriod || 5);
	const stResults = $derived.by(() => { if (!deal||isCredit) return null; const inv = stInvestment||deal?.investmentMinimum||50000; const rg = stRentGrowth/100; const ec = stExitCap/100; const vc = stVacancy/100; const ir = stInterest/100; const h = stHold; const bc = stBaseCoC; let noi = inv*(bc>0?bc:0.08); let td = 0; for (let y=1;y<=h;y++){const yn=noi*Math.pow(1+rg,y-1)*(1-vc);const ds=inv*0.65*ir;const cf=yn-ds*0.3;td+=Math.max(cf,0);} const en=noi*Math.pow(1+rg,h)*(1-vc);const sp=ec>0?en/ec:0;const tr=td+sp;const em=inv>0?tr/inv:0;const irr=h>0&&inv>0?(Math.pow(Math.max(tr/inv,0.01),1/h)-1):0;return{annualCF:h>0?td/h:0,totalDist:td,saleProceeds:sp,totalReturn:tr,irr,em}; });
	const stScenarios = $derived.by(() => { if (!deal||isCredit) return null; const bi = stBaseIRR; const be = stBaseEM; return { bear:{irr:bi*0.55,em:be*0.65}, base:{irr:bi,em:be}, bull:{irr:bi*1.35,em:be*1.3} }; });

	// ===== Formatters =====
	function fmt(val, type) {
		if (val === undefined || val === null || val === '') return '---';
		if (type === 'pct') {
			const n = typeof val === 'number' ? val : parseFloat(val);
			if (isNaN(n)) return '---';
			return (n > 1 ? n : n * 100).toFixed(1) + '%';
		}
		if (type === 'money') {
			const n = typeof val === 'string' ? parseFloat(val.replace(/[$,]/g, '')) : val;
			if (isNaN(n)) return '---';
			if (n === 0) return '$0';
			if (n >= 1e9) return '$' + (n / 1e9).toFixed(1) + 'B';
			if (n >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
			if (n >= 1e3) {
				const k = n / 1e3;
				// Use 1 decimal when rounding to integer would shift by >3%, otherwise integer
				const rounded = Math.round(k);
				const pctError = Math.abs(k - rounded) / k;
				return '$' + (pctError > 0.03 ? k.toFixed(1) : rounded) + 'K';
			}
			return '$' + n.toLocaleString();
		}
		if (type === 'multiple') {
			const n = typeof val === 'number' ? val : parseFloat(val);
			if (isNaN(n)) return '---';
			return n.toFixed(2) + 'x';
		}
		return String(val);
	}

	/** Display preferred return — shows "None" instead of "---" when absent */
	function fmtPref(val) {
		if (val === 'None' || val === 'none' || val === 'N/A') return 'None';
		const formatted = fmt(val, 'pct');
		return formatted === '---' ? 'None' : formatted;
	}

	function formatHold(val) {
		if (!val) return '---';
		if (typeof val === 'string' && val.toLowerCase().includes('open')) return 'Open-ended';
		const n = parseFloat(val);
		if (isNaN(n)) return String(val);
		if (n === 1) return '1 Year';
		return n + ' Years';
	}

	function getInitials(name) {
		if (!name) return '??';
		return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 3);
	}

	function openAuthModal({
		title = 'Create a free account',
		body = 'Create a free account to continue.'
	} = {}) {
		authModalTitle = title;
		authModalBody = body;
		authSending = false;
		authSent = false;
		authError = '';
		authEmail = $user?.email || '';
		showAuthModal = true;
	}

	function closeAuthModal() {
		showAuthModal = false;
		authSending = false;
		authSent = false;
		authError = '';
	}

	function requirePublicAuth(config) {
		if ($isLoggedIn) return false;
		openAuthModal(config);
		return true;
	}

	async function submitAuthModal() {
		if (authSending) return;
		const email = authEmail.trim();
		if (!email || !email.includes('@')) {
			authError = 'Enter a valid email address.';
			return;
		}
		authSending = true;
		authError = '';
		try {
			const response = await fetch('/api/auth', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ action: 'magic-link', email })
			});
			const result = await response.json().catch(() => ({}));
			if (!response.ok || result?.error) {
				authError = result?.error || 'Could not send your magic link.';
				return;
			}
			authSent = true;
		} catch {
			authError = 'Could not send your magic link.';
		} finally {
			authSending = false;
		}
	}

	// ===== Toast =====
	function showShareToast(msg) {
		toastMessage = msg;
		toastVisible = true;
		setTimeout(() => { toastVisible = false; }, 3000);
	}

	// ===== Share Actions =====
	function shareDealEmail() {
		if (!deal || !browser) return;
		window.open(buildDealShareMailtoHref(deal, window.location.href));
		shareDropdownOpen = false;
	}

	function shareDealText() {
		if (!deal || !browser) return;
		window.open(buildDealShareSmsHref(deal, window.location.href));
		shareDropdownOpen = false;
	}

	function copyDealLink() {
		if (!browser || !deal) return;
		navigator.clipboard.writeText(window.location.href).then(() => {
			showShareToast('Link copied to clipboard');
		}).catch(() => {
			showShareToast('Link copied to clipboard');
		});
		shareDropdownOpen = false;
	}

	function openInviteModal() {
		if (!deal || !browser) return;
		if (requirePublicAuth({ title: 'Create a free account', body: 'Create a free account to send tracked co-investor invites from your deal workspace.' })) return;
		shareDropdownOpen = false;
		inviteEmail = '';
		inviteMessage = '';
		inviteCode = null;

		const stored = currentSessionUser();
		const baseUrl = getDealUrl(window.location.origin, deal);

		// Try to get an invite code from API
		fetch('/api/invite', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${stored.token || ''}` },
			body: JSON.stringify({ dealId: deal.id })
		}).then(r => r.json()).then(data => {
			if (data.success && data.code) {
				inviteCode = data.code;
				inviteUrl = `${baseUrl}?inv=${data.code}`;
			} else {
				inviteUrl = baseUrl;
			}
		}).catch(() => {
			inviteUrl = baseUrl;
		});

		inviteUrl = baseUrl;
		showInviteModal = true;
	}

	function closeInviteModal() {
		showInviteModal = false;
	}

	function copyInviteLink() {
		if (!browser) return;
		navigator.clipboard.writeText(inviteUrl).then(() => {
			showShareToast('Invite link copied!');
		}).catch(() => {
			showShareToast('Invite link copied!');
		});
	}

	function trackDeckView() {
		if (!deal || !browser) return;
		writeScopedDealString(deal?.id, 'gycDeckViewed', 'true');
		deckViewed = true;
	}

	function openDeckViewer() {
		if (!deal?.deckUrl) return;
		if (requirePublicAuth({ title: 'Create a free account', body: 'Create a free account to view the investment deck and track document engagement.' })) return;
		showDeckViewer = true;
		trackDeckView();
	}

	function closeDeckViewer() {
		showDeckViewer = false;
	}

	function openDocumentRow(row) {
		if (!row) return;
		if (row.key === 'deck') {
			openDeckViewer();
			return;
		}
		if (requirePublicAuth({ title: 'Create a free account', body: 'Create a free account to open deal documents and keep access trackable.' })) return;
		if (browser && row.url) {
			window.open(row.url, '_blank', 'noopener,noreferrer');
		}
	}

	function openBuyBoxAction() {
		if (requirePublicAuth({ title: 'Create a free account', body: 'Create a free account to save this deal and start your Buy Box.' })) return;
		if (!hasMemberAccess) {
			window.location.href = academyHref;
			return;
		}
		window.location.href = buyBoxEditHref;
	}

	function switchShareClass(idx) {
		activeShareClass = idx;
	}


	function openClaimModal() {
		if (!deal || !browser) return;
		if (requirePublicAuth({ title: 'Create a free account', body: 'Create a free account to claim and manage your deal profile.' })) return;
		const stored = currentSessionUser();
		claimName = stored.name || '';
		claimEmail = stored.email || '';
		claimCompany = dealOperatorName || deal.managementCompany || '';
		claimRole = '';
		claimSubmitting = false;
		claimSuccess = false;
		showClaimModal = true;
	}

	function closeClaimModal() {
		showClaimModal = false;
	}

	async function submitClaim() {
		if (!deal || claimSubmitting) return;
		claimSubmitting = true;
		try {
			const stored = currentSessionUser();
			const r = await fetch('/api/deal-claim', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${stored.token || ''}` },
				body: JSON.stringify({
					dealId: deal.id,
					name: claimName,
					email: claimEmail,
					company: claimCompany,
					role: claimRole
				})
			});
			const data = await r.json();
			if (data.success !== false) {
				claimSuccess = true;
				showShareToast('Claim submitted successfully');
			} else {
				showShareToast('Something went wrong. Please try again.');
			}
		} catch {
			showShareToast('Something went wrong. Please try again.');
		}
		claimSubmitting = false;
	}

		// ===== Goal Path =====
		function setUserGoal(goal) {
		const normalizedGoal = normalizeGoalBranch(goal);
		if (!normalizedGoal) return;
		userGoal = normalizedGoal;
		if (browser) {
			writeUserScopedString('gycInvestmentGoal', normalizedGoal);
		}
	}

	// ===== Actions =====
	function advanceStage() {
		if (!deal) return;
		if (requirePublicAuth({ title: 'Create a free account', body: 'Create a free account to save deals and keep your pipeline synced.' })) return;
		const next = nextStage;
		if (next) {
			dealStages.setStage(deal.id, next.key);
		}
	}

	function skipDeal() {
		if (!deal) return;
		if (requirePublicAuth({ title: 'Create a free account', body: 'Create a free account to skip deals and keep your pipeline synced.' })) return;
		dealStages.setStage(deal.id, 'skipped');
	}

	function setStage(stageKey) {
		if (!deal) return;
		if (requirePublicAuth({ title: 'Create a free account', body: 'Create a free account to save deals and update your pipeline stage.' })) return;
		dealStages.setStage(deal.id, stageKey);
	}

		function requestIntroduction() {
			if (!deal) return;
			if (requirePublicAuth({ title: 'Create a free account', body: 'Create a free account to request an introduction to the sponsor.' })) return;
		const gate = getDealIntroductionRequestGate(deal.id);
		if (!gate.ok) {
			showShareToast(gate.message || 'Introduction requests are unavailable right now.');
			return;
		}
		introMessage = '';
		introSending = false;
		introSuccess = false;
		showIntroModal = true;
	}

	function closeIntroModal() {
		showIntroModal = false;
	}

	async function submitIntroRequest() {
		if (!deal || introSending) return;
		introSending = true;
		const result = await submitDealIntroductionRequest({
			deal,
			message: introMessage
		});
		if (result.success) {
			introRequested = true;
			introSuccess = true;
			if (currentStageIdx < 2) {
				dealStages.setStage(deal.id, 'connect');
			}
		} else {
			showShareToast(result.error || 'Something went wrong. Please try again.');
		}
		introSending = false;
	}

	// ===== Investment Report PDF =====
	function generateReport() {
		if (!hasMemberAccess) {
			if (nativeCompanionMode) {
				showShareToast('Investment reports are available to existing members on the web.');
				return;
			}
			window.location.href = '/app/academy';
			return;
		}
		if (!deal) { alert('Deal data not available.'); return; }
		const stored = currentSessionUser();
		const full = buildInvestmentReportHtml({
			deal,
			buyBox,
			buyBoxChecks,
			dealFit,
			cfRows,
			cfInvestment,
			cfYieldRate,
			cfHold,
			cfTotalCash,
			cfAvgCoC,
			bgCheck,
			isCredit,
			stResults,
			stRentGrowth,
			stExitCap,
			stVacancy,
			stInterest,
			stHold,
			reportUserName: (stored.name || stored.firstName || 'Investor').split(' ').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
			reportDate: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
		});
		const rw = window.open('', '_blank');
		if (rw) { rw.document.write(full); rw.document.close(); setTimeout(() => { rw.print(); }, 500); }
		else { alert('Please allow popups to generate your investment report.'); }
	}

	// ===== Lifecycle =====
	onMount(async () => {
		const storedUser = currentSessionUser();
		let token = '';
		try {
			token = await getFreshSessionToken();
		} catch {}
		const userEmail = storedUser.email || '';
		const headers = token ? { 'Authorization': `Bearer ${token}` } : {};

		if (!deal && token && dealId) {
			try {
				const dealUrl = new URL('/api/deals', window.location.origin);
				dealUrl.searchParams.set('id', dealId);
				applyAdminImpersonationToUrl(dealUrl);
				const resp = await fetch(`${dealUrl.pathname}${dealUrl.search}`, { headers });
				if (resp.ok) {
					const data = await resp.json();
					if (data?.deal) {
						deal = data.deal;
						error = null;
						loading = false;
					}
				} else {
					error = 'Failed to load deal';
					loading = false;
				}
			} catch (err) {
				error = err?.message || 'Failed to load deal';
				loading = false;
			}
		}

		if (!deal) {
			loading = false;
			return;
		}
			// Load social proof
			fetch(`/api/deal-stats?dealId=${encodeURIComponent(deal.id)}`, { headers })
			.then(r => r.ok ? r.json() : null)
			.then(stats => { if (stats) socialProof = stats; })
			.catch(() => {});

		// Load deck-viewed and intro-requested state
		deckViewed = !!readScopedDealString(deal?.id, 'gycDeckViewed');
		introRequested = hasRequestedDealIntroduction(deal.id);

		// Load investment goal from storage
		try {
			const storedGoal = readUserScopedString('gycInvestmentGoal', '');
			const normalizedStoredGoal = normalizeGoalBranch(storedGoal);
			if (normalizedStoredGoal) {
				userGoal = normalizedStoredGoal;
			}
		} catch {}

		// Auto-select first share class (sorted by highest min investment) on initial load
		if (deal.shareClasses && deal.shareClasses.length > 0) {
			let bestIdx = 0, bestMin = Infinity;
			for (let i = 0; i < deal.shareClasses.length; i++) {
				const min = deal.shareClasses[i].investmentMinimum || 0;
				if (min < bestMin) {
					bestMin = min;
					bestIdx = i;
				}
			}
			activeShareClass = bestIdx;
		}

		// Load buy box from scoped browser state (saved by buy box wizard)
		try {
			buyBox = readUserScopedJson('gycBuyBoxWizard', null);
		} catch {}

		// Also try fetching buy box from API
		if (token && userEmail) {
			const realUser = currentAdminRealUser();
			const isAdminImpersonation = !!realUser?.email && realUser.email.toLowerCase() !== userEmail.toLowerCase();
			const buyBoxUrl = new URL('/api/buybox', window.location.origin);
			buyBoxUrl.searchParams.set('email', userEmail);
			if (isAdminImpersonation) buyBoxUrl.searchParams.set('admin', 'true');
			fetch(buyBoxUrl.pathname + buyBoxUrl.search, { headers })
				.then(r => r.ok ? r.json() : null)
				.then(data => {
					const nextBuyBox = data?.buyBox || data;
					if (nextBuyBox && Object.keys(nextBuyBox).length > 0) {
						buyBox = nextBuyBox;
						// Auto-set goal from buy box if not already set
						if (!userGoal && (nextBuyBox._branch || nextBuyBox.goal)) {
							const normalizedBuyBoxGoal = normalizeGoalBranch(nextBuyBox._branch || nextBuyBox.goal);
							if (normalizedBuyBoxGoal) userGoal = normalizedBuyBoxGoal;
						}
					}
				})
				.catch(() => {});
		}

		// Initialize stress test sliders from deal data
		stInvestment = deal.investmentMinimum || 50000;
		stHold = deal.holdPeriod || 5;

		// Set document title
		document.title = `${deal.investmentName} - GYC Dealflow`;
	});

	// Close share dropdown on outside click
	function handleOutsideClick(e) {
		if (shareDropdownOpen) shareDropdownOpen = false;
	}
</script>

<svelte:window onclick={handleOutsideClick} />

<Sidebar currentPage="deals" hideHamburgerOnPhone={true} />

<main class="main ly-page">
	<div class="content-wrap ly-dealflow-frame">
		{#if loading}
			<!-- Loading Skeleton -->
			<div class="skeleton skeleton-header"></div>
			<div class="skeleton skeleton-stats"></div>
			<div class="skeleton skeleton-card"></div>
			<div class="skeleton skeleton-card"></div>
		{:else if !deal}
			<!-- Not Found -->
			<div class="not-found">
				<div class="not-found-icon">
					<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="48" height="48"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
				</div>
				<h2>Deal Not Found</h2>
				<p>This deal may have been removed or the link may be incorrect.</p>
				<a href="/app/deals" class="btn-primary">Browse All Deals</a>
			</div>
		{:else}
			<!-- Breadcrumb -->
			<nav class="breadcrumb">
				<a href="/app/deals">Deals</a>
				<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><polyline points="9 18 15 12 9 6"/></svg>
				<span>{deal.investmentName}</span>
			</nav>

				<div class="deal-page-content ly-min-0">
				<!-- ==================== HERO ==================== -->
				<div class="deal-header {heroClass}" style={deal.propertyImageUrl ? `background-image:linear-gradient(to right, rgba(20,36,30,0.92) 0%, rgba(20,36,30,0.7) 60%, rgba(20,36,30,0.3) 100%), url(${deal.propertyImageUrl});background-size:cover;background-position:center;` : ''}>
					{#if !deal.propertyImageUrl}
						<div class="hero-type-icon">
							{#if isCredit}
								<svg viewBox="0 0 24 24"><path d="M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
							{:else}
								<svg viewBox="0 0 24 24"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
							{/if}
						</div>
					{/if}
					<div class="deal-header-inner">
						<div class="hero-left">
							<h1 class="deal-name">{deal.investmentName}</h1>
							<div class="deal-company">by <a href={dealOperatorHref}>{dealOperatorName || 'Unknown'}</a></div>

							<!-- Badges -->
							<div class="deal-badges">
								{#if isCredit}
									<span class="deal-badge asset-class">{getDealCreditBadgeLabel(deal)}</span>
								{:else if deal.assetClass}
									<span class="deal-badge asset-class">{deal.assetClass}</span>
								{/if}
								{#if deal.dealType}
									<span class="deal-badge deal-type">{deal.dealType}</span>
								{/if}
								{#if deal.status}
									<span class="deal-badge {statusBadgeClass(deal.status)}">{deal.status}</span>
								{/if}
								{#if isStale}
									<span class="deal-badge stale">Archived</span>
								{/if}
							</div>

							<!-- Hero Metrics -->
							<div class="hero-metrics">
								{#if isCredit}
									{#if deal.targetIRR}<div class="hero-metric"><div class="hero-metric-value highlight">{fmt(deal.targetIRR, 'pct')}</div><div class="hero-metric-label">Target Yield</div></div>{/if}
									{#if deal.investmentMinimum}<div class="hero-metric"><div class="hero-metric-value">{fmt(deal.investmentMinimum, 'money')}</div><div class="hero-metric-label">Min Investment</div></div>{/if}
									{#if deal.holdPeriod}<div class="hero-metric"><div class="hero-metric-value">{formatHold(deal.holdPeriod)}</div><div class="hero-metric-label">Lockup</div></div>{/if}
									{#if managerAumValue}<div class="hero-metric"><div class="hero-metric-value">{fmt(managerAumValue, 'money')}</div><div class="hero-metric-label">Manager AUM</div></div>{/if}
								{:else}
									{#if deal.targetIRR}<div class="hero-metric"><div class="hero-metric-value highlight">{fmt(deal.targetIRR, 'pct')}</div><div class="hero-metric-label">Target IRR</div></div>{/if}
									{#if deal.equityMultiple}<div class="hero-metric"><div class="hero-metric-value">{fmt(deal.equityMultiple, 'multiple')}</div><div class="hero-metric-label">Equity Multiple</div></div>{/if}
									<div class="hero-metric"><div class="hero-metric-value">{fmtPref(deal.preferredReturn)}</div><div class="hero-metric-label">Pref Return</div></div>
									{#if deal.investmentMinimum}<div class="hero-metric"><div class="hero-metric-value">{fmt(deal.investmentMinimum, 'money')}</div><div class="hero-metric-label">Min Investment</div></div>{/if}
									{#if deal.holdPeriod}<div class="hero-metric"><div class="hero-metric-value">{formatHold(deal.holdPeriod)}</div><div class="hero-metric-label">Hold Period</div></div>{/if}
								{/if}
							</div>

							<!-- Strategy Summary -->
							{#if deal.investmentStrategy}
								<div class="hero-summary">{getDealHeroSummary(deal)}</div>
							{/if}

							<!-- Operated by -->
							{#if dealOperatorName}
								<div class="hero-operator-line">
									<span class="hero-operator-label">Operated by</span>
									<a href={dealOperatorHref} class="hero-operator-link">
										<span class="hero-operator-avatar">{getInitials(dealOperatorName)}</span>
										{dealOperatorName}
										{#if dealOperator.foundingYear}
											<span class="hero-operator-years">&middot; {new Date().getFullYear() - dealOperator.foundingYear}+ yrs</span>
										{/if}
									</a>
								</div>
							{/if}

							<!-- Social Proof -->
							{#if socialProof}
								{@const reviewing = socialProofCounts.reviewing || 0}
								{@const invested = socialProofCounts.invested || 0}
								{@const total = reviewing + invested}
								{#if total > 0}
									<div class="hero-social-proof">
										<div class="sp-avatars">
											{#each Array(Math.min(total, 3)) as _, i}
												<div class="sp-avatar" style="background:{['#51BE7B','#3b82f6','#f59e0b'][i % 3]}">
													<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
												</div>
											{/each}
											{#if total > 3}
												<div class="sp-avatar sp-count">+{total - 3}</div>
											{/if}
										</div>
										<div class="sp-text">
											{#if total === 1}
												<span>1 GYC investor is currently invested</span>
											{:else if total <= 4}
												<span>{total} GYC investors are currently invested in this deal</span>
											{:else}
												<span>{total}+ GYC investors have invested or are currently investing</span>
											{/if}
										</div>
									</div>
								{/if}
							{/if}
						</div>

						<!-- Hero Right: CTA buttons -->
						<div class="hero-right">
							<div class="hero-action-stack">
								{#if deal.deckUrl && !deal.deckUrl.includes('airtableusercontent.com')}
									<button class="hero-deck-btn" onclick={openDeckViewer}>
										<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
										View Investment Deck
									</button>
								{:else}
									<div class="hero-deck-btn hero-deck-locked" aria-hidden="true">
										<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
										View Investment Deck
									</div>
								{/if}
								<button class="hero-deck-btn hero-intro-btn" onclick={requestIntroduction}>
									<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/></svg>
									Request Introduction
								</button>
								<button class="hero-share-btn" onclick={copyDealLink}>
									<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
									Share
								</button>
							</div>
						</div>
					</div>
				</div>

				<!-- Archived Banner -->
				{#if isStale}
					<div class="archived-banner">
						<svg viewBox="0 0 24 24" fill="none" stroke="#8A9AA0" stroke-width="2" width="18" height="18"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
						<div>
							<strong>Archived Deal</strong>
							<span>{deal.stalenessReason || 'This deal may no longer be accepting new investors.'}</span>
						</div>
					</div>
				{/if}

				<!-- ==================== JOURNEY BAR ==================== -->
				<div class="journey-bar">
					<div class="journey-process-group">
						{#each stages as stage, i}
							{#if i > 0}
								<div class="journey-connector journey-arrow" class:done={currentStageIdx >= i}>
									<svg viewBox="0 0 8 12" width="8" height="12" fill="none"><path d="M1 1l5 5-5 5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
								</div>
							{/if}
							<button
								class="journey-step"
								class:active={currentStage === stage.key}
								class:completed={currentStageIdx > i}
								class:skipped={currentStage === 'skipped' && i === 0}
								onclick={() => setStage(stage.key)}
							>
								<div class="step-dot">
									{#if currentStageIdx > i}
										<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" width="14" height="14"><polyline points="20 6 9 17 4 12"/></svg>
									{:else}
										{stage.num}
									{/if}
								</div>
								{stage.label}
							</button>
						{/each}
					</div>
					<div class="journey-outcome-divider"></div>
					<div class="journey-outcome-group">
						<button class="journey-step journey-step-skip" class:active={currentStage === 'skipped'} class:skipped={currentStage === 'skipped'} onclick={skipDeal}>
							<div class="step-dot">
								{#if currentStage === 'skipped'}
									<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" width="14" height="14"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
								{:else}
									<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
								{/if}
							</div>
							Skipped
						</button>
					</div>
				</div>

				<!-- ==================== PART 1: THE OPPORTUNITY ==================== -->
				<DealOpportunityCard
					{deal}
					{buyBox}
					{buyBoxChecks}
					{buyBoxScore}
					goal={goalBranch}
					{goalProgress}
					investmentAmount={deal?.investmentMinimum}
					isLoggedIn={$isLoggedIn}
					{isPaid}
					onSetGoal={setUserGoal}
					onOpenAuth={() => openAuthModal({ title: 'Create a free account', body: 'Create a free account to see personalized deal projections.' })}
					onOpenBuyBox={openBuyBoxAction}
					{nativeCompanionMode}
				/>

				<!-- ==================== DEAL TERMS ==================== -->
				<div class="two-col-grid ly-min-0">
					<div class="section">
						<div class="section-header">
							<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="18" height="18"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
							<span class="section-title">Deal Terms</span>
						</div>
						{#if hasShareClasses}
							<div style="padding:4px 20px 16px;">
								<div class="sc-toggle-bar">
									{#each sortedShareClasses as { sc, origIdx }}
										<button class="sc-toggle-pill" class:active={activeShareClass === origIdx} onclick={() => switchShareClass(origIdx)}>{sc.label}</button>
									{/each}
								</div>
							</div>
						{/if}
						<div class="section-body">
							<div class="details-grid">
								<div class="detail-item"><div class="detail-label">Target IRR</div><div class="detail-value">{fmt(displayTargetIRR, 'pct')}</div></div>
								<div class="detail-item"><div class="detail-label">Pref Return</div><div class="detail-value">{fmtPref(displayPrefReturn)}</div></div>
								{#if !isCredit}
									<div class="detail-item"><div class="detail-label">Cash-on-Cash</div><div class="detail-value">{fmt(displayCashOnCash, 'pct')}</div></div>
								{/if}
								<div class="detail-item"><div class="detail-label">Min Investment</div><div class="detail-value">{fmt(displayMinInvestment, 'money')}</div></div>
								<div class="detail-item"><div class="detail-label">Lockup</div><div class="detail-value">{formatHold(deal.holdPeriod)}</div></div>
								{#if deal.redemption}
									<div class="detail-item"><div class="detail-label">Redemption</div><div class="detail-value">{deal.redemption}</div></div>
								{/if}
								<div class="detail-item"><div class="detail-label">Distributions</div><div class="detail-value">{deal.distributions || '---'}</div></div>
								<div class="detail-item"><div class="detail-label">Offering Type</div><div class="detail-value">{deal.offeringType || '---'}</div></div>
								{#if displayEquityMultiple}
									<div class="detail-item"><div class="detail-label">Equity Multiple</div><div class="detail-value">{fmt(displayEquityMultiple, 'multiple')}</div></div>
								{/if}
								{#if displayLpGpSplit && /\d+\s*\/\s*\d+/.test(String(displayLpGpSplit))}
									<div class="detail-item"><div class="detail-label">LP/GP Split</div><div class="detail-value">{displayLpGpSplit}</div></div>
								{/if}
								<div class="detail-item"><div class="detail-label">Available To</div><div class="detail-value">{deal.availableTo || '---'}</div></div>
								<div class="detail-item"><div class="detail-label">Offering Size</div><div class="detail-value">{fmt(deal.offeringSize, 'money')}</div></div>
								<div class="detail-item"><div class="detail-label">Strategy</div><div class="detail-value">{deal.strategy || '---'}</div></div>
								{#if auditingValue}
									<div class="detail-item"><div class="detail-label">Auditing</div><div class="detail-value">{auditingValue}</div></div>
								{/if}
								{#if loanCountValue != null}
									<div class="detail-item"><div class="detail-label">Loan Count</div><div class="detail-value">{Number(loanCountValue).toLocaleString()}</div></div>
								{/if}
								{#if managerAumValue}
									<div class="detail-item"><div class="detail-label">Manager AUM</div><div class="detail-value">{fmt(managerAumValue, 'money')}</div></div>
								{/if}
								{#if fundFoundedYearValue}
									<div class="detail-item"><div class="detail-label">Fund Founded</div><div class="detail-value">{fundFoundedYearValue}</div></div>
								{/if}
								{#if deal.debtPosition}
									<div class="detail-item"><div class="detail-label">Debt Position</div><div class="detail-value">{deal.debtPosition}</div></div>
								{/if}
								{#if currentFundSizeValue}
									<div class="detail-item"><div class="detail-label">Current Fund Size</div><div class="detail-value">{fmt(currentFundSizeValue, 'money')}</div></div>
								{/if}
								{#if maxFundSizeValue}
									<div class="detail-item"><div class="detail-label">Max Fund Size</div><div class="detail-value">{fmt(maxFundSizeValue, 'money')}</div></div>
								{/if}
								{#if currentAvgLoanLtvValue}
									<div class="detail-item"><div class="detail-label">Current Avg LTV</div><div class="detail-value">{fmt(currentAvgLoanLtvValue, 'pct')}</div></div>
								{/if}
								{#if maxAllowedLtvValue}
									<div class="detail-item"><div class="detail-label">Max Allowed LTV</div><div class="detail-value">{fmt(maxAllowedLtvValue, 'pct')}</div></div>
								{/if}
								{#if currentLeverageValue && leverageConsistent}
									<div class="detail-item"><div class="detail-label">Current Leverage</div><div class="detail-value">{fmt(currentLeverageValue, 'multiple')}</div></div>
								{/if}
								{#if maxAllowedLeverageValue && leverageConsistent}
									<div class="detail-item"><div class="detail-label">Max Allowed Leverage</div><div class="detail-value">{fmt(maxAllowedLeverageValue, 'multiple')}</div></div>
								{/if}
								{#if snapshotAsOfDateValue}
									<div class="detail-item detail-item-wide"><div class="detail-label">Snapshot As Of</div><div class="detail-value">{formatReviewDate(snapshotAsOfDateValue)}</div></div>
								{/if}
							</div>
						</div>
					</div>

					<!-- Right column: Who's Behind the Deal + Documents -->
					<div>
						<!-- Who's Behind the Deal -->
						{#if dealOperatorName}
							<div class="section">
								<div class="section-header">
									<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
									<span class="section-title">Who’s Behind the Deal</span>
								</div>
								<div class="section-body">
									<div class="operator-card-content">
										<div class="operator-avatar">{getInitials(dealOperatorName)}</div>
										<div class="operator-info">
											<a href={dealOperatorHref} class="operator-name">{dealOperatorName}</a>
											{#if dealOperatorCeo}<div class="operator-ceo">{dealOperatorCeo}</div>{/if}
											{#if dealOperator.foundingYear}<div class="operator-meta">Founded {dealOperator.foundingYear}</div>{/if}
										</div>
									</div>
									<div class="rail-fact-list">
										{#if dealOperatorCeo}
											<div class="rail-fact"><span>Lead</span><strong>{dealOperatorCeo}</strong></div>
										{/if}
										{#if dealOperator.foundingYear}
											<div class="rail-fact"><span>Track Record</span><strong>{new Date().getFullYear() - dealOperator.foundingYear}+ years</strong></div>
										{/if}
										{#if managerAumValue}
											<div class="rail-fact"><span>Manager AUM</span><strong>{fmt(managerAumValue, 'money')}</strong></div>
										{/if}
									</div>
									<a href={dealOperatorHref} class="operator-link">View Sponsor Profile &rarr;</a>
									{#if gpOwnsDeal}
										<button class="operator-link operator-link-btn" onclick={openClaimModal}>Manage Deal</button>
									{/if}
								</div>
							</div>
						{/if}

						<!-- Documents -->
						<div class="section">
							<div class="section-header">
								<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
								<span class="section-title">Documents</span>
							</div>
							<div class="section-body doc-list">
								{#if documentRows.length > 0}
									{#each documentRows as row}
										<button class="doc-item doc-row-button" onclick={() => openDocumentRow(row)}>
											<svg viewBox="0 0 24 24" fill="none" stroke="var(--primary)" stroke-width="2" width="16" height="16"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
											<span>{row.label}</span>
											{#if isPublicViewer}
												<span class="doc-item-status">Create free account to open</span>
											{/if}
										</button>
									{/each}
								{:else}
									<div class="doc-empty">No documents available yet.</div>
								{/if}
							</div>
						</div>
					</div>
				</div>

				<!-- ==================== PART 3: DETAILED SECTIONS ==================== -->
				<div class="canonical-lower-flow">
					<!-- ==================== DEAL ANALYSIS DASHBOARD ==================== -->
					<div class="flow-order-35">
						<DealAnalysisDashboard
							{deal}
							{buyBox}
							{feeRows}
							{operatorTrackRecordRows}
							{secFiling}
							{bgCheck}
							{bgCheckLoading}
							{bgCheckLoaded}
							onLoadBgCheck={() => loadBackgroundCheck()}
							{isPaid}
							{isPublicViewer}
							{isFreeViewer}
							{hasMemberAccess}
							isAdmin={$isAdmin}
							{nativeCompanionMode}
							{academyHref}
							onOpenAuth={() => openAuthModal({ title: 'Create a free account', body: 'Create a free account to save deals and start your analysis.' })}
							{fmt}
						/>
					</div>
					<div class="section geography-section flow-order-30">
						<div class="section-header">
							<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
							<span class="section-title">Investing Geography</span>
						</div>
						<div class="section-body geography-body">
							<InvestingGeographyMap {deal} />
						</div>
					</div>

					<!-- SEC Filing now in Analysis Dashboard -->

					<!-- Fees now in Analysis Dashboard -->

					<!-- Operator Track Record now in Analysis Dashboard -->

						<!-- ==================== HISTORICAL RETURNS ==================== -->
						{#if isCredit}
							<div class="section flow-order-10 historical-returns-section">
								<div class="section-header">
									<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><path d="M3 3v18h18"/><path d="M7 15l3-3 3 2 4-6"/></svg>
									<span class="section-title">Historical Returns</span>
									{#if historicalReturnsRangeLabel}
										<span class="historical-returns-range">{historicalReturnsRangeLabel}</span>
									{/if}
								</div>
								<div class="section-body historical-returns-body">
									{#if hasHistoricalReturns}
										<div class="historical-returns-grid">
											<div class="historical-returns-chart-card">
												<DealReturnsMiniChart series={historicalReturns} variant="hero" />
											</div>
											<div class="historical-returns-summary">
												<div class="historical-returns-kicker">Actual annual returns to LPs</div>
												{#if latestHistoricalReturn}
													<div class="historical-returns-headline">
														{latestHistoricalReturn.year}: {latestHistoricalReturn.value.toFixed(2)}%
													</div>
												{/if}
												<p class="historical-returns-copy">
													Use this as the backward-looking proof point for the fund. The projected LP cash-flow card below remains forward-looking and assumption-based.
												</p>
												<div class="historical-returns-stat-row">
													<div class="historical-returns-stat">
														<span>Years shown</span>
														<strong>{historicalReturns.length}</strong>
													</div>
													{#if historicalReturnAverage !== null}
														<div class="historical-returns-stat">
															<span>Average</span>
															<strong>{historicalReturnAverage.toFixed(2)}%</strong>
														</div>
													{/if}
													{#if displayTargetIRR}
														<div class="historical-returns-stat">
															<span>Target</span>
															<strong>{fmt(displayTargetIRR, 'pct')}</strong>
														</div>
													{/if}
												</div>
											</div>
										</div>
									{:else}
										<div class="empty-detail-card">
											<strong>Historical returns are not available yet.</strong>
											<p>This card appears once at least two annual return data points have been captured for the fund.</p>
										</div>
									{/if}
								</div>
							</div>
						{/if}

				<!-- ==================== PROJECTED LP CASH FLOW ==================== -->
				{#if cfRows.length > 0 || cfUnavailableReason}
					<div class="section flow-order-20">
						<div class="section-header">
							<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><path d="M12 1v22"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
							<span class="section-title">Projected LP Cash Flow</span>
						</div>
						<div class="section-body" style="position:relative;min-height:120px;">
							{#if cfUnavailableReason}
								<div class="empty-detail-card">
									<strong>Projection hidden until the assumptions are trustworthy.</strong>
									<p>{cfUnavailableReason}</p>
								</div>
							{:else}
							{#if !isPaid}
								<div class="gate-overlay">
									<div class="gate-content">
										<div class="gate-icon">
											<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
										</div>
										<div class="gate-title">{nativeCompanionMode ? 'Available to members on web' : 'Become a Member'}</div>
										<div class="gate-text">
											{#if nativeCompanionMode}
												Year-by-year projected distributions, capital returns, and cash-on-cash analysis remain available to existing members on the web.
											{:else}
												See year-by-year projected distributions, capital returns, and cash-on-cash analysis for this deal.
											{/if}
										</div>
										{#if !nativeCompanionMode}
											<a href={academyHref} class="gate-cta">Become a Member</a>
										{/if}
									</div>
								</div>
							{/if}
							<div class:blurred={!isPaid}>
								<div class="cf-assumptions">
									Based on {fmt(cfInvestment, 'money')} invested at {fmt(cfYieldRate, 'pct')} {cfYieldLabel} over {cfHold}{cfIsEvergreen && cfHold === 5 ? '+ years' : ' years'}. Projections are illustrative only.
								</div>

								<div class="cf-toggle">
									<button class:active={cfView === 'chart'} onclick={() => cfView = 'chart'}>Chart</button>
									<button class:active={cfView === 'table'} onclick={() => cfView = 'table'}>Table</button>
								</div>

								{#if cfView === 'chart'}
									<div class="cf-chart-wrap">
										{#each cfRows as row, i}
											<div class="cf-bar-row">
												<div class="cf-bar-label">Yr {row.year}</div>
												<div class="cf-bar-track">
													<div class="cf-bar-dist" style="width: {((row.dist) / cfMaxBar) * 100}%"></div>
													{#if row.capReturn > 0}
														<div class="cf-bar-cap" style="width: {(row.capReturn / cfMaxBar) * 100}%; left: {(row.dist / cfMaxBar) * 100}%"></div>
													{/if}
												</div>
												<div class="cf-bar-value">{fmt(row.dist + row.capReturn, 'money')}</div>
											</div>
										{/each}
										<div class="cf-legend">
											<span class="cf-legend-item"><span class="cf-legend-dot dist"></span>Distributions</span>
											{#if cfRows.some(r => r.capReturn > 0)}
												<span class="cf-legend-item"><span class="cf-legend-dot cap"></span>Capital Return</span>
											{/if}
										</div>
									</div>
								{:else}
										<div class="cf-table-wrap ly-table-scroll">
										<table class="cf-table">
											<thead>
												<tr>
													<th>Year</th><th>Capital</th><th>Distributions</th><th>% CoC</th><th>Total Cash</th><th>Cumulative</th>
												</tr>
											</thead>
											<tbody>
												{#each cfRows as row, i}
													{@const investment = cfInvestment}
													<tr class:cf-total-row={i === cfRows.length - 1}>
														<td>Year {row.year}</td>
														<td>
															{#if i === 0}
																<span class="cf-cap-out">({fmt(investment, 'money')})</span>
															{:else if row.capReturn > 0}
																<span class="cf-cap-in">{fmt(row.capReturn, 'money')}</span>
															{:else}
																&mdash;
															{/if}
														</td>
														<td class="cf-highlight">{fmt(row.dist, 'money')}</td>
														<td class="cf-highlight">{investment > 0 ? ((row.dist / investment) * 100).toFixed(1) : '0.0'}%</td>
														<td>{fmt(row.dist + row.capReturn, 'money')}</td>
														<td>{fmt(row.cumDist + (i === cfRows.length - 1 ? row.capReturn : 0), 'money')}</td>
													</tr>
												{/each}
											</tbody>
											<tfoot>
												<tr class="cf-summary-row">
													<td><div class="cf-summary-value">{fmt(cfInvestment, 'money')}</div><div class="cf-summary-label">Invested</div></td>
													<td></td>
													<td><div class="cf-summary-value green">{fmt(cfRows[cfRows.length-1]?.cumDist || 0, 'money')}</div><div class="cf-summary-label">Total Distributions</div></td>
													<td>{#if cfAvgCoC > 0}<div class="cf-summary-value green">{cfAvgCoC.toFixed(1)}%</div><div class="cf-summary-label">Avg CoC</div>{/if}</td>
													<td><div class="cf-summary-value">{fmt(cfTotalCash, 'money')}</div><div class="cf-summary-label">Total Cash</div></td>
													<td></td>
												</tr>
											</tfoot>
										</table>
									</div>
								{/if}
							</div>
							{/if}
						</div>
					</div>
				{/if}

				<!-- Key Risks now in Analysis Dashboard Risk layer -->

				<!-- ==================== STRESS TEST CALCULATOR ==================== -->
				{#if deal && !isCredit}
					<div class="section flow-order-65">
						<div class="section-header">
							<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><path d="M12 20V10"/><path d="M18 20V4"/><path d="M6 20v-4"/></svg>
							<span class="section-title">Stress Test Calculator</span>
							<span class="investclearly-preview-pill coming-soon">Coming Soon</span>
						</div>
						<div class="section-body">
							<ComingSoonOverlay label="Coming Soon" description="Model bear, base, and bull scenarios with adjustable rent growth, cap rates, vacancy, and interest rates.">
							<div>
								<div class="st-base-case">
									<div class="st-base-title">Base Case from Deal Data</div>
									<div class="st-base-pills">
										<span class="st-pill">IRR {fmt(stBaseIRR, 'pct')}</span>
										<span class="st-pill">CoC {fmt(stBaseCoC, 'pct')}</span>
										<span class="st-pill">EM {stBaseEM.toFixed(2)}x</span>
										<span class="st-pill">Hold {stBaseHold} yrs</span>
									</div>
								</div>

								<div class="st-grid">
									<div class="st-inputs">
										<div class="st-input-group">
											<div class="st-input-label">Investment Amount <span class="st-input-val">{fmt(stInvestment, 'money')}</span></div>
											<input type="number" class="st-number-input" bind:value={stInvestment} min="5000" step="5000" />
										</div>
										<div class="st-input-group">
											<div class="st-input-label">Annual Rent Growth <span class="st-input-val">{stRentGrowth.toFixed(1)}%</span></div>
											<input type="range" class="st-slider" bind:value={stRentGrowth} min="0" max="8" step="0.5" />
										</div>
										<div class="st-input-group">
											<div class="st-input-label">Exit Cap Rate <span class="st-input-val">{stExitCap.toFixed(2)}%</span></div>
											<input type="range" class="st-slider" bind:value={stExitCap} min="4" max="10" step="0.25" />
										</div>
										<div class="st-input-group">
											<div class="st-input-label">Vacancy Rate <span class="st-input-val">{stVacancy}%</span></div>
											<input type="range" class="st-slider" bind:value={stVacancy} min="0" max="20" step="1" />
										</div>
										<div class="st-input-group">
											<div class="st-input-label">Interest Rate <span class="st-input-val">{stInterest.toFixed(2)}%</span></div>
											<input type="range" class="st-slider" bind:value={stInterest} min="3" max="10" step="0.25" />
										</div>
										<div class="st-input-group">
											<div class="st-input-label">Hold Period <span class="st-input-val">{stHold} yrs</span></div>
											<input type="range" class="st-slider" bind:value={stHold} min="3" max="10" step="1" />
										</div>
									</div>

									<div class="st-outputs">
										<div class="st-outputs-title">
											<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
											Projected Returns
										</div>
										{#if stResults}
											{@const res = stResults}
											<div class="st-output-item"><span class="st-output-label">Annual Cash Flow</span><span class="st-output-value">{fmt(res.annualCF, 'money')}</span></div>
											<div class="st-output-item"><span class="st-output-label">Total Distributions</span><span class="st-output-value">{fmt(res.totalDist, 'money')}</span></div>
											<div class="st-output-item"><span class="st-output-label">Projected Sale Proceeds</span><span class="st-output-value">{fmt(res.saleProceeds, 'money')}</span></div>
											<div class="st-output-item"><span class="st-output-label">Total Return</span><span class="st-output-value">{fmt(res.totalReturn, 'money')}</span></div>
											<div class="st-output-item"><span class="st-output-label">Projected IRR</span><span class="st-output-value">{(res.irr * 100).toFixed(1)}%</span></div>
											<div class="st-output-item"><span class="st-output-label">Equity Multiple</span><span class="st-output-value">{res.em.toFixed(2)}x</span></div>
										{/if}
									</div>
								</div>

								{#if stScenarios}
									{@const sc = stScenarios}
									<div class="st-scenarios">
										<div class="st-scenarios-title">Scenario Comparison</div>
										<table class="st-scenario-table">
											<thead>
												<tr><th></th><th class="bear">Bear Case</th><th class="base">Base Case</th><th class="bull">Bull Case</th></tr>
											</thead>
											<tbody>
												<tr><td class="st-sc-label">Projected IRR</td><td class="bear">{(sc.bear.irr * 100).toFixed(1)}%</td><td class="base">{(sc.base.irr * 100).toFixed(1)}%</td><td class="bull">{(sc.bull.irr * 100).toFixed(1)}%</td></tr>
												<tr><td class="st-sc-label">Equity Multiple</td><td class="bear">{sc.bear.em.toFixed(2)}x</td><td class="base">{sc.base.em.toFixed(2)}x</td><td class="bull">{sc.bull.em.toFixed(2)}x</td></tr>
											</tbody>
										</table>
									</div>
								{/if}
							</div>
							</ComingSoonOverlay>
						</div>
					</div>
				{/if}

				<!-- ==================== SIMILAR DEALS ==================== -->
				<div class="section flow-order-50">
						<div class="section-header">
							<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><path d="M18 20V10"/><path d="M12 20V4"/><path d="M6 20v-6"/></svg>
							<span class="section-title">Similar Deals</span>
							<span class="peer-count-label">
								{#if eligibleSimilarDeals.length > 0}
									{eligibleSimilarDeals.length} comparable {isCredit ? 'Lending' : (deal.assetClass || '')} deals
								{:else if similarDeals.length > 0}
									Comparable deals need more structured data
								{:else}
									No comparable deals yet
								{/if}
							</span>
					</div>
					<div class="section-body" style="position:relative;min-height:140px;">
						{#if !hasMemberAccess}
							<div class="gate-overlay">
								<div class="gate-content">
									<div class="gate-icon">
										<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
									</div>
									<div class="gate-title">Become a Member</div>
									<div class="gate-text">
										{#if nativeCompanionMode}
											Available to members on web.
										{:else}
											Unlock comparable deal analysis and positioning context.
										{/if}
									</div>
									{#if !nativeCompanionMode}
										<a href={academyHref} class="gate-cta">Become a Member</a>
									{/if}
								</div>
							</div>
						{/if}
							<div class:blurred={!hasMemberAccess}>
									<SimilarDealsPanel
										{deal}
										similarDeals={eligibleSimilarDeals}
										hasFilteredComparables={similarDeals.length > 0 && eligibleSimilarDeals.length === 0}
										{dealOperatorName}
									{fmt}
								/>
						</div>
					</div>
				</div>

				<!-- ==================== DEAL FIT SUMMARY ==================== -->
				<div class="section flow-order-60">
					<div class="section-header">
						<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
						<span class="section-title">Deal Fit Summary</span>
						<span class="investclearly-preview-pill coming-soon">Coming Soon</span>
					</div>
					<div class="section-body deal-fit-body" style="position:relative;overflow:hidden;">
						<div class="investclearly-preview-surface" aria-hidden="true">
							<div class="fit-verdict" style={`--verdict-color: ${fitSummary.verdictColor};`}>
								<div class="fit-verdict-icon" aria-hidden="true">
									{#if fitSummary.score >= 3}
										<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="20" height="20"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
									{:else if fitSummary.score >= 1}
										<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="20" height="20"><path d="M12 6v6l4 2"/><circle cx="12" cy="12" r="10"/></svg>
									{:else if fitSummary.score >= -1}
										<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="20" height="20"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
									{:else}
										<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="20" height="20"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
									{/if}
								</div>
								<div>
									<div class="fit-verdict-text">{fitSummary.verdict}</div>
									<div class="fit-verdict-sub">
										{#if dealFit}
											Based on target returns, fee load, distributions, and operator history.
										{:else}
											We&apos;ll sharpen this read as more deal and investor profile data becomes available.
										{/if}
									</div>
								</div>
							</div>

							{#if fitSummary.fits.length > 0}
								<div class="fit-list-section">
									<div class="fit-list-label fit-label-good">What works</div>
									{#each fitSummary.fits as item}
										<div class="fit-list-item">
											<svg viewBox="0 0 24 24" fill="none" stroke="var(--primary)" stroke-width="2.5" width="16" height="16"><polyline points="20 6 9 17 4 12"/></svg>
											<span>{item}</span>
										</div>
									{/each}
								</div>
							{/if}

							{#if fitSummary.warnings.length > 0}
								<div class="fit-list-section">
									<div class="fit-list-label fit-label-warn">Watch out</div>
									{#each fitSummary.warnings as item}
										<div class="fit-list-item">
											<svg viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="2.5" width="16" height="16"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
											<span>{item}</span>
										</div>
									{/each}
								</div>
							{/if}
						</div>
						<div class="investclearly-coming-soon-overlay">
							<div class="investclearly-coming-soon-badge">Coming Soon</div>
							<div class="investclearly-coming-soon-copy">Automated deal fit scoring based on your plan, returns, fees, and sponsor context is coming soon.</div>
						</div>
					</div>
				</div>

					<!-- ==================== INVEST CLEARLY REVIEWS (admin preview) ==================== -->
					{#if investClearlyPreview}
						<div class="section flow-order-70">
							<div class="section-header">
								<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="18" height="18"><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/></svg>
								<span class="section-title">Invest Clearly Reviews</span>
								<span class="investclearly-preview-pill coming-soon">Coming Soon</span>
							</div>
							<div class="section-body investclearly-body">
								<div class="investclearly-preview-surface" aria-hidden="true">
									<div class="investclearly-intro">
										<div class="investclearly-intro-copy">
											Sponsor-level reviews for <strong>{investClearlyPreview.sponsorName}</strong> will live here once Invest Clearly launches.
										</div>
									</div>
									<div class="investclearly-review-list">
										{#each investClearlyPreview.reviews as review}
											<article class="investclearly-review-card">
												<div class="investclearly-review-top">
													<div class="investclearly-review-photo" aria-hidden="true">
														<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
															<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
															<circle cx="12" cy="7" r="4"/>
														</svg>
														<span class="investclearly-review-photo-badge">{getInitials(review.reviewer)}</span>
													</div>
													<div class="investclearly-reviewer-copy">
														<div class="investclearly-reviewer-name-row">
															<div class="investclearly-reviewer-name">{review.reviewer}</div>
															<span class="investclearly-review-date">{formatReviewDate(review.publishedAt)}</span>
														</div>
														<div class="investclearly-reviewer-meta">
															<div class="investclearly-review-stars" aria-hidden="true">
																{#each [1, 2, 3, 4, 5] as star}
																	<span class:filled={star <= review.rating}>★</span>
																{/each}
															</div>
															<span class="investclearly-reviewer-role">Verified third-party review</span>
														</div>
													</div>
												</div>
												<div class="investclearly-review-title">{review.title}</div>
												<div class="investclearly-review-body">{review.body}</div>
											</article>
										{/each}
									</div>
								</div>
								<div class="investclearly-coming-soon-overlay">
									<div class="investclearly-coming-soon-badge">Coming Soon</div>
									<div class="investclearly-coming-soon-copy">Sponsor-level third-party reviews will live here once Invest Clearly launches.</div>
								</div>
							</div>
						</div>
					{/if}

					</div>

				<!-- ==================== DISCLAIMER ==================== -->
				<DealDisclaimer variant="standard" />

			</div><!-- /deal-page-content -->

			<!-- ==================== STICKY ACTION BAR ==================== -->
			<div class="sticky-action-bar"><div class="sticky-action-bar-inner">
				{#if currentStage === 'filter' || !currentStage}
					<button class="btn-pass" onclick={skipDeal}>
						<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
						Skip
					</button>
					<button class="btn-advance" onclick={() => setStage('review')}>
						<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>
						Save Deal
					</button>
				{:else if currentStage === 'review'}
					<button class="btn-pass" onclick={skipDeal}>
						<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
						Skip
					</button>
					{#if !deckViewed && deal.deckUrl && !deal.deckUrl.includes('airtableusercontent.com')}
						<button class="btn-advance" onclick={openDeckViewer}>
							View Investment Deck &rarr;
						</button>
					{:else}
						<button class="btn-advance" onclick={() => setStage('connect')}>
							Ready to Connect &rarr;
						</button>
					{/if}
				{:else if currentStage === 'connect'}
					<button class="btn-pass" onclick={skipDeal}>
						<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
						Skip
					</button>
					{#if !introRequested}
						<button class="btn-advance" onclick={requestIntroduction}>
							Request Introduction
						</button>
					{:else}
						<button class="btn-advance" onclick={() => setStage('decide')}>
							Move to Decide &rarr;
						</button>
					{/if}
				{:else if currentStage === 'decide'}
					<button class="btn-pass" onclick={skipDeal}>
						<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
						Skip
					</button>
					<button class="btn-advance" onclick={() => setStage('invested')}>
						I'm Investing &rarr;
					</button>
				{:else if currentStage === 'invested'}
					<a href="/app/deals#portfolio" class="btn-pass" style="text-decoration:none;">My Portfolio</a>
					<button class="btn-advance" onclick={generateReport}>
						<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
						Generate Investment Report
					</button>
				{:else if currentStage === 'skipped'}
					<button class="btn-pass" onclick={() => setStage('review')}>
						Review Deal
					</button>
					<button class="btn-advance" onclick={() => setStage('review')}>
						Reconsider Deal &rarr;
					</button>
				{/if}
			</div></div>
		{/if}
	</div>
</main>

<nav class="deal-mobile-tabs" aria-label="Primary">
	{#each PRIMARY_MOBILE_NAV_ITEMS as item}
		<a
			href={item.href}
			class="deal-mobile-tab"
			class:active={item.key === 'deals'}
			aria-current={item.key === 'deals' ? 'page' : undefined}
			onclick={tapLight}
		>
			<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20">
				{@html item.icon}
			</svg>
			<span>{item.label}</span>
		</a>
	{/each}
</nav>


<!-- ==================== TOAST ==================== -->
{#if toastVisible}
	<div class="toast-notification" class:visible={toastVisible}>
		<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><polyline points="20 6 9 17 4 12"/></svg>
		{toastMessage}
	</div>
{/if}

<!-- ==================== PUBLIC AUTH MODAL ==================== -->
<DealModalLayer
	{deal}
	{showAuthModal}
	{authSent}
	{authModalTitle}
	{authModalBody}
	bind:authEmail
	{authSending}
	{authError}
	{closeAuthModal}
	{submitAuthModal}
	{showIntroModal}
	{dealOperator}
	{dealOperatorName}
	{dealOperatorCeo}
	{introSuccess}
	bind:introMessage
	{introSending}
	{closeIntroModal}
	{submitIntroRequest}
	{showInviteModal}
	{inviteUrl}
	bind:inviteEmail
	bind:inviteMessage
	{inviteEmailSubject}
	{inviteEmailBody}
	{inviteSmsBody}
	{closeInviteModal}
	{copyInviteLink}
	{showClaimModal}
	{claimName}
	{claimEmail}
	{claimCompany}
	bind:claimRole
	{claimSubmitting}
	{claimSuccess}
	{closeClaimModal}
	{submitClaim}
	{showDeckViewer}
	{deckPreviewUrl}
	{closeDeckViewer}
/>

<style>
	.main {
		--deal-mobile-tab-bar-offset: calc(72px + env(safe-area-inset-bottom, 0px));
		margin-left: var(--sidebar-width, 240px);
		width: calc(100% - var(--sidebar-width, 240px));
		min-height: 100vh;
		min-width: 0;
		max-width: 100%;
		background: var(--bg-cream);
		transition: margin-left 0.3s ease;
		overflow-x: clip;
	}
	.content-wrap {
		--ly-dealflow-frame-max: 1440px;
		--ly-dealflow-frame-pad-desktop: clamp(32px, 3vw, 40px);
		--ly-dealflow-frame-pad-tablet: 24px;
		--ly-dealflow-frame-pad-mobile: 16px;
		--ly-dealflow-frame-pad-top: 32px;
		--ly-dealflow-frame-pad-bottom: 64px;
		margin: 0 auto;
		min-width: 0;
	}
	.deal-page-content,
	.deal-page-content > *,
	.deal-header-inner > *,
	.hero-metrics > *,
	.hero-social-proof > *,
	.two-col-grid > *,
	.details-grid > *,
	.st-grid > *,
	.summary-row > *,
	.buybox-header > *,
	.buybox-criterion > *,
	.operator-card-content > *,
	.peer-mobile-metrics > * {
		min-width: 0;
	}
	.deal-mobile-tabs {
		display: none;
		position: fixed;
		bottom: 0;
		left: 0;
		right: 0;
		background: var(--bg-sidebar, #1a1a2e);
		border-top: 1px solid rgba(255,255,255,0.08);
		z-index: 140;
		padding: 6px 0 calc(env(safe-area-inset-bottom, 0px) + 8px);
	}
	.deal-mobile-tab {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 2px;
		min-width: 64px;
		min-height: 44px;
		color: rgba(255,255,255,0.5);
		text-decoration: none;
		font-size: 10px;
		font-family: var(--font-ui);
		padding: 4px 0;
		transition: color 0.2s;
	}
	.deal-mobile-tab.active {
		color: var(--primary, #00c9a7);
	}
	.deal-mobile-tab:hover {
		color: rgba(255,255,255,0.8);
	}
	.skeleton { position: relative; overflow: hidden; background: var(--border-light); border-radius: 8px; }
	.skeleton::after { content: ''; position: absolute; inset: 0; background: linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.6) 50%, transparent 100%); animation: shimmer 1.5s infinite; }
	@keyframes shimmer { 0% { transform: translateX(-100%); } 100% { transform: translateX(100%); } }
	.skeleton-header { height: 180px; margin-bottom: 24px; }
	.skeleton-stats { height: 80px; margin-bottom: 24px; }
	.skeleton-card { height: 200px; margin-bottom: 20px; }
	.not-found { text-align: center; padding: 80px 20px; }
	.not-found-icon { color: var(--text-muted); margin-bottom: 16px; }
	.not-found h2 { font-family: var(--font-headline); font-size: 28px; color: var(--text-dark); margin-bottom: 12px; }
	.not-found p { font-family: var(--font-body); font-size: 16px; color: var(--text-secondary); margin-bottom: 24px; }
	.not-found a { display: inline-flex; align-items: center; gap: 8px; color: var(--primary); font-family: var(--font-ui); font-size: 14px; font-weight: 600; text-decoration: none; }
	.not-found a:hover { text-decoration: underline; }
	.btn-primary { display: inline-block; padding: 12px 24px; background: var(--primary); color: #fff; border-radius: var(--radius-sm); font-family: var(--font-ui); font-weight: 700; text-decoration: none; }
	.btn-primary:hover { background: var(--primary-hover); }
	.breadcrumb { display: flex; align-items: center; gap: 8px; margin-bottom: 20px; font-family: var(--font-ui); font-size: 13px; font-weight: 500; color: var(--text-muted); }
	.breadcrumb a { color: var(--primary); text-decoration: none; }
	.deal-header { background: linear-gradient(145deg, #1a1f2e 0%, #252b3b 100%); border-radius: 10px; padding: 28px 32px; margin-bottom: 18px; position: relative; overflow: hidden; border: 1px solid rgba(255,255,255,0.05); }
	.deal-header.hero-lending { background: linear-gradient(145deg, #1a2433 0%, #1e2d3d 100%); }
	.deal-header.hero-equity { background: linear-gradient(145deg, #1a1f2e 0%, #252b3b 100%); }
	.deal-header::after { display: none; }
	.deal-header.hero-lending::before { display: none; }
	.deal-header.hero-lending::after { display: none; }
	.hero-type-icon { position: absolute; bottom: 20px; right: 24px; opacity: 0.06; z-index: 0; }
	.hero-type-icon svg { width: 120px; height: 120px; stroke: #fff; stroke-width: 1; fill: none; }
	.deal-header-inner { position: relative; z-index: 1; display: flex; gap: 32px; align-items: center; justify-content: space-between; }
	.hero-left { flex: 1; min-width: 0; }
	.hero-right { flex-shrink: 0; display: flex; flex-direction: column; align-items: stretch; justify-content: center; gap: 14px; text-align: center; width: min(100%, 260px); }
	.hero-action-stack { display: flex; flex-direction: column; gap: 12px; justify-content: center; min-height: 100%; }
	.deal-name { font-family: var(--font-headline); font-size: 32px; color: #fff; line-height: 1.2; letter-spacing: -0.5px; margin-bottom: 8px; }
	.deal-company { font-family: var(--font-ui); font-size: 15px; font-weight: 500; margin-bottom: 16px; color: rgba(255,255,255,0.7); }
	.deal-company a { color: #40E47F; text-decoration: none; }
	.deal-company a:hover { color: #fff; text-decoration: underline; }
	.deal-badges { display: flex; gap: 8px; flex-wrap: wrap; }
	.deal-badge { display: inline-flex; align-items: center; padding: 4px 12px; border-radius: 20px; font-family: var(--font-ui); font-size: 12px; font-weight: 600; letter-spacing: 0.3px; }
	.deal-badge.asset-class { background: rgba(81,190,123,0.15); color: #40E47F; }
	.deal-badge.deal-type { background: rgba(37,99,235,0.15); color: #93C5FD; }
	.deal-badge.status-open { background: rgba(81,190,123,0.15); color: #40E47F; }
	.deal-badge.status-evergreen { background: rgba(37,99,235,0.15); color: #93C5FD; }
	.deal-badge.status-closed { background: rgba(208,64,64,0.15); color: #FCA5A5; }
	.deal-badge.stale { background: rgba(138,154,160,0.15); color: #8A9AA0; }
	.hero-metrics { display: flex; gap: 16px 18px; margin-top: 14px; flex-wrap: wrap; }
	.hero-metric { display: flex; flex-direction: column; min-width: 84px; }
	.hero-metric-value { font-family: var(--font-ui); font-size: 20px; font-weight: 800; color: #fff; letter-spacing: -0.4px; line-height: 1.1; }
	.hero-metric-value.highlight { color: #40E47F; }
	.hero-metric-label { font-family: var(--font-ui); font-size: 9px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.45px; color: rgba(255,255,255,0.45); margin-top: 2px; }
	.hero-summary { font-family: var(--font-body); font-size: 12px; color: rgba(255,255,255,0.62); line-height: 1.5; margin-top: 10px; max-width: 520px; }
	.hero-operator-line { display: flex; align-items: center; gap: 10px; margin-top: 12px; padding-top: 10px; border-top: 1px solid rgba(255,255,255,0.1); }
	.hero-operator-label { font-family: var(--font-ui); font-size: 12px; color: rgba(255,255,255,0.5); text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600; }
	.hero-operator-link { display: flex; align-items: center; gap: 8px; color: #fff; text-decoration: none; font-family: var(--font-ui); font-size: 13px; font-weight: 600; }
	.hero-operator-avatar { width: 28px; height: 28px; border-radius: 50%; background: rgba(255,255,255,0.15); display: flex; align-items: center; justify-content: center; font-size: 10px; font-weight: 700; }
	.hero-operator-years { color: rgba(255,255,255,0.4); font-weight: 400; font-size: 11px; }
	.hero-social-proof { display: flex; align-items: center; gap: 12px; margin-top: 14px; font-family: var(--font-ui); font-size: 12px; color: rgba(255,255,255,0.72); padding: 8px 10px; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.08); border-radius: 10px; width: fit-content; max-width: 100%; }
	.sp-avatars { display: flex; flex-shrink: 0; }
	.sp-avatar { width: 30px; height: 30px; border-radius: 50%; border: 2px solid #252b3b; background: linear-gradient(135deg, #51BE7B 0%, #2d8a54 100%); color: #fff; font-size: 10px; font-weight: 800; display: flex; align-items: center; justify-content: center; margin-left: -8px; position: relative; overflow: hidden; }
	.sp-avatar:first-child { margin-left: 0; }
	.sp-count { background: rgba(255,255,255,0.15); font-size: 9px; font-weight: 700; letter-spacing: -0.3px; }
	.sp-text { line-height: 1.4; }
	.sp-text strong { color: #fff; font-weight: 700; }
	.sp-dim { color: rgba(255,255,255,0.55); }
	.hero-operator-photo { width: 80px; height: 80px; border-radius: 50%; object-fit: cover; background: rgba(255,255,255,0.12); display: flex; align-items: center; justify-content: center; font-family: var(--font-ui); font-weight: 800; color: rgba(255,255,255,0.9); font-size: 26px; letter-spacing: -0.5px; border: 2px solid rgba(255,255,255,0.15); }
	.hero-operator-name { font-family: var(--font-ui); font-size: 14px; font-weight: 700; color: #fff; }
	.hero-operator-title-text { font-family: var(--font-ui); font-size: 11px; color: rgba(255,255,255,0.55); }
	.hero-deck-btn { display: inline-flex; align-items: center; justify-content: center; gap: 10px; padding: 12px 22px; background: var(--accent-green); color: #0a1628; font-family: var(--font-ui); font-size: 13px; font-weight: 700; border-radius: 10px; text-decoration: none; cursor: pointer; transition: background 0.15s, transform 0.1s; white-space: nowrap; border: none; }
	.hero-deck-btn:hover { background: #34d399; transform: translateY(-1px); }
	.hero-deck-btn.hero-deck-locked { background: rgba(255,255,255,0.08); color: rgba(255,255,255,0.5); cursor: default; border: 1px solid rgba(255,255,255,0.12); }
	.hero-intro-btn { background: rgba(255,255,255,0.12); border: 1px solid rgba(255,255,255,0.25); color: #fff; width: 100%; padding: 12px 18px; }
	.hero-intro-btn:hover { background: rgba(255,255,255,0.18); }
	.hero-share-btn { display: inline-flex; align-items: center; gap: 6px; padding: 0; background: none; color: rgba(255,255,255,0.5); font-family: var(--font-ui); font-size: 11px; font-weight: 600; border: none; cursor: pointer; letter-spacing: 0.3px; text-transform: uppercase; }
	.hero-share-btn:hover { color: rgba(255,255,255,0.85); }
	.share-wrapper { position: relative; }
	.share-dropdown { position: absolute; bottom: 100%; right: 0; margin-bottom: 8px; background: #fff; border: 1px solid var(--border); border-radius: 8px; box-shadow: 0 8px 24px rgba(0,0,0,0.12); padding: 6px 0; min-width: 200px; z-index: 50; }
	.share-dropdown-item { display: flex; align-items: center; gap: 10px; padding: 10px 16px; font-family: var(--font-ui); font-size: 13px; font-weight: 500; color: var(--text-dark); cursor: pointer; transition: background 0.1s; border: none; background: none; width: 100%; }
	.share-dropdown-item:hover { background: var(--bg-cream); }
	.share-dropdown-item svg { width: 16px; height: 16px; color: var(--text-secondary); flex-shrink: 0; }
	.share-toast { position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%) translateY(20px); background: var(--bg-sidebar); color: #fff; padding: 12px 24px; border-radius: var(--radius-sm); font-family: var(--font-ui); font-size: 13px; font-weight: 600; box-shadow: 0 8px 24px rgba(0,0,0,0.2); z-index: 9999; opacity: 0; transition: opacity 0.2s, transform 0.2s; pointer-events: none; display: flex; align-items: center; gap: 8px; }
	.share-toast.show { opacity: 1; transform: translateX(-50%) translateY(0); }
	.archived-banner { background: rgba(138,154,160,0.08); border: 1px solid rgba(138,154,160,0.2); border-radius: 8px; padding: 14px 20px; margin-bottom: 16px; display: flex; align-items: center; gap: 10px; font-family: var(--font-ui); font-size: 13px; }
	.archived-banner strong { color: var(--text-secondary); font-weight: 700; }
	.archived-banner span { color: var(--text-muted); font-size: 12px; margin-left: 8px; }
	.journey-bar { display: flex; align-items: center; gap: 0; margin: 0 auto 18px; padding: 8px 16px; background: var(--bg-card); border: 1px solid var(--border); border-radius: 10px; max-width: 680px; width: 100%; }
	.journey-process-group { display: flex; align-items: center; gap: 4px; flex: 1; min-width: 0; }
	.journey-outcome-divider { width: 1px; height: 28px; background: var(--border); margin: 0 12px; flex-shrink: 0; align-self: center; }
	.journey-outcome-group { display: flex; align-items: center; gap: 4px; flex-shrink: 0; }
	.journey-step { display: flex; flex-direction: column; align-items: center; gap: 3px; cursor: default; padding: 4px 8px; border-radius: 8px; transition: all 0.2s; font-family: var(--font-ui); font-size: 9px; font-weight: 700; color: var(--text-muted); white-space: nowrap; text-align: center; background: none; border: none; text-transform: uppercase; letter-spacing: 0.35px; }
	.journey-step:hover { background: var(--bg-cream); color: var(--text-dark); }
	.step-dot { width: 24px; height: 24px; border-radius: 50%; border: 1.5px solid var(--border); display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 700; color: var(--text-muted); background: var(--bg-page); transition: all 0.2s; flex-shrink: 0; }
	.journey-step.active .step-dot { background: var(--primary); border-color: var(--primary); color: #fff; }
	.journey-step.active { color: var(--primary); background: rgba(81,190,123,0.08); }
	.journey-step.completed .step-dot { background: var(--primary); border-color: var(--primary); color: #fff; }
	.journey-step.completed { color: var(--text-dark); }
	.journey-step.skipped .step-dot { background: #D04040; border-color: #D04040; color: #fff; }
	.journey-step.skipped { color: #D04040; }
	.journey-step-skip { opacity: 0.7; }
	.journey-step-skip.active, .journey-step-skip.skipped { opacity: 1; }
	.journey-arrow { display: flex; align-items: center; justify-content: center; flex-shrink: 0; color: var(--border); margin-top: -12px; }
	.journey-arrow.done { color: var(--primary); }
	.journey-connector { flex: 1; min-width: 12px; max-width: 34px; height: 2px; background: var(--border); align-self: center; margin-top: -12px; }
	.journey-connector.done { background: var(--primary); }
	.data-completeness { display: flex; align-items: center; gap: 14px; padding: 12px 16px; background: var(--bg-card); border: 1px solid var(--border); border-radius: 10px; margin-bottom: 20px; font-family: var(--font-ui); }
	.data-completeness-label { font-size: 13px; font-weight: 700; color: var(--text-dark); white-space: nowrap; }
	.data-completeness-bar { flex: 1; height: 6px; background: var(--border-light); border-radius: 3px; overflow: hidden; }
	.data-completeness-fill { height: 100%; border-radius: 3px; transition: width 0.5s ease; }
	.data-completeness-fill.high { background: var(--primary); }
	.data-completeness-fill.medium { background: #f59e0b; }
	.data-completeness-fill.low { background: #ef4444; }
	.data-completeness-pct { font-size: 14px; font-weight: 800; color: var(--text-dark); min-width: 36px; text-align: right; }
	.data-completeness-hint { font-size: 12px; color: var(--text-muted); white-space: nowrap; }
	.metrics-strip { display: grid; grid-template-columns: repeat(auto-fit, minmax(132px, 1fr)); gap: 10px; margin-bottom: 20px; }
	.metric-card { background: var(--bg-card); border: 1px solid var(--border); border-radius: 10px; padding: 13px 14px; text-align: center; box-shadow: none; }
	.metric-label { font-family: var(--font-ui); font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.7px; color: var(--text-muted); margin-bottom: 4px; }
	.metric-value { font-family: var(--font-ui); font-size: 18px; font-weight: 800; color: var(--text-dark); letter-spacing: -0.4px; }
	.metric-value.highlight { color: var(--primary); }
	.metric-locked { display: flex; align-items: center; justify-content: center; min-height: 52px; cursor: pointer; border-style: dashed; background: rgba(59,130,246,0.04); border-color: rgba(59,130,246,0.2); }
	.metric-locked-link { text-decoration: none; }
	.metric-locked .metric-label { color: #3b82f6; font-size: 11px; margin: 0; }
	.two-col-grid { display: grid; grid-template-columns: 2fr 1fr; gap: 20px; align-items: start; margin-bottom: 20px; }
	.canonical-lower-flow { display: flex; flex-direction: column; }
	.flow-order-10 { order: 10; }
	.flow-order-20 { order: 20; }
		.flow-order-30 { order: 30; }
		.flow-order-35 { order: 35; }
		.flow-order-40 { order: 40; }
		.flow-order-45 { order: 45; }
		.flow-order-50 { order: 50; }
	.flow-order-55 { order: 55; }
	.flow-order-60 { order: 60; }
	.flow-order-65 { order: 65; }
	.flow-order-70 { order: 70; }
	.flow-order-80 { order: 80; }
	.flow-order-90 { order: 90; }
	.flow-order-100 { order: 100; }
	.flow-order-110 { order: 110; }
	.flow-order-120 { order: 120; }
	.flow-order-130 { order: 130; }
		.section { background: var(--bg-card); border: 1px solid var(--border); border-radius: 10px; margin-bottom: 18px; box-shadow: none; overflow: hidden; }
		.section-header { padding: 16px 20px; border-bottom: 1px solid var(--border-light); display: flex; align-items: center; gap: 10px; }
		.section-header svg { color: var(--primary); flex-shrink: 0; }
		.section-title { font-family: var(--font-ui); font-size: 14px; font-weight: 700; color: var(--text-dark); letter-spacing: -0.15px; }
		.section-body { padding: 24px; }
		.historical-returns-range {
			margin-left: auto;
			display: inline-flex;
			align-items: center;
			padding: 4px 10px;
			border-radius: 999px;
			background: rgba(81,190,123,0.08);
			border: 1px solid rgba(81,190,123,0.18);
			font-family: var(--font-ui);
			font-size: 10px;
			font-weight: 700;
			letter-spacing: 0.35px;
			text-transform: uppercase;
			color: var(--primary);
		}
		.historical-returns-body {
			padding-top: 18px;
		}
		.historical-returns-grid {
			display: grid;
			grid-template-columns: minmax(0, 1.35fr) minmax(260px, 0.85fr);
			gap: 18px;
			align-items: stretch;
		}
		.historical-returns-chart-card {
			padding: 18px 20px 16px;
			border-radius: 14px;
			background: linear-gradient(160deg, #102128 0%, #17333a 52%, #214650 100%);
			border: 1px solid rgba(255,255,255,0.06);
			box-shadow: inset 0 1px 0 rgba(255,255,255,0.04);
			min-height: 230px;
		}
		.historical-returns-summary {
			display: grid;
			align-content: start;
			gap: 12px;
			padding: 18px;
			border-radius: 14px;
			border: 1px solid var(--border-light);
			background: linear-gradient(180deg, rgba(248,248,246,0.85) 0%, rgba(255,255,255,0.98) 100%);
		}
		.historical-returns-kicker {
			font-family: var(--font-ui);
			font-size: 10px;
			font-weight: 800;
			letter-spacing: 0.45px;
			text-transform: uppercase;
			color: var(--primary);
		}
		.historical-returns-headline {
			font-family: var(--font-headline);
			font-size: 28px;
			line-height: 1.1;
			letter-spacing: -0.5px;
			color: var(--text-dark);
		}
		.historical-returns-copy {
			margin: 0;
			font-family: var(--font-body);
			font-size: 13px;
			line-height: 1.65;
			color: var(--text-secondary);
		}
		.historical-returns-stat-row {
			display: grid;
			grid-template-columns: repeat(auto-fit, minmax(110px, 1fr));
			gap: 10px;
		}
		.historical-returns-stat {
			padding: 12px;
			border-radius: 12px;
			background: var(--bg-card);
			border: 1px solid var(--border-light);
		}
		.historical-returns-stat span {
			display: block;
			font-family: var(--font-ui);
			font-size: 10px;
			font-weight: 700;
			letter-spacing: 0.4px;
			text-transform: uppercase;
			color: var(--text-muted);
			margin-bottom: 6px;
		}
		.historical-returns-stat strong {
			font-family: var(--font-ui);
			font-size: 16px;
			font-weight: 800;
			color: var(--text-dark);
		}
		.details-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; }
	.detail-item {}
	.detail-item-wide { grid-column: 1 / -1; }
	.detail-label { font-family: var(--font-ui); font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.8px; color: var(--text-muted); margin-bottom: 4px; }
	.detail-value { font-family: var(--font-ui); font-size: 14px; font-weight: 600; color: var(--text-dark); }
	.overview-text { font-family: var(--font-body); font-size: 15px; line-height: 1.7; color: var(--text-secondary); }
	.operator-card-content { display: flex; align-items: center; gap: 14px; margin-bottom: 12px; }
	.operator-profile { display: flex; gap: 24px; align-items: flex-start; }
	.operator-photo { width: 80px; height: 80px; border-radius: 50%; object-fit: cover; flex-shrink: 0; background: var(--teal-deep); display: flex; align-items: center; justify-content: center; font-family: var(--font-ui); font-weight: 800; color: #fff; font-size: 28px; letter-spacing: -0.5px; }
	.operator-avatar { width: 56px; height: 56px; border-radius: 50%; background: var(--primary); display: flex; align-items: center; justify-content: center; color: #fff; font-family: var(--font-ui); font-weight: 800; font-size: 18px; flex-shrink: 0; letter-spacing: -0.5px; }
	.operator-details { flex: 1; min-width: 0; }
	.operator-info { flex: 1; min-width: 0; }
	.operator-name { font-family: var(--font-ui); font-size: 18px; font-weight: 700; color: var(--text-dark); margin-bottom: 2px; text-decoration: none; }
	.operator-name:hover { color: var(--primary); }
	.operator-title { font-family: var(--font-ui); font-size: 13px; color: var(--text-secondary); margin-bottom: 12px; }
	.operator-bio { font-family: var(--font-body); font-size: 14px; line-height: 1.6; color: var(--text-secondary); margin-bottom: 16px; }
	.operator-ceo { font-family: var(--font-ui); font-size: 12px; color: var(--text-secondary); margin-top: 2px; }
	.operator-meta { font-family: var(--font-ui); font-size: 11px; color: var(--text-muted); }
	.operator-stats { display: flex; gap: 24px; flex-wrap: wrap; margin-bottom: 16px; }
	.operator-stat { text-align: center; }
	.operator-stat-value { font-family: var(--font-ui); font-size: 20px; font-weight: 800; color: var(--text-dark); }
	.operator-stat-label { font-family: var(--font-ui); font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: var(--text-muted); margin-top: 2px; }
	.operator-links { display: flex; gap: 8px; flex-wrap: wrap; }
	.operator-link { display: inline-flex; align-items: center; gap: 6px; padding: 6px 12px; border: 1px solid var(--border); border-radius: 20px; font-family: var(--font-ui); font-size: 12px; font-weight: 600; color: var(--text-secondary); text-decoration: none; transition: all var(--transition); }
	.operator-link:hover { border-color: var(--primary); color: var(--primary); background: rgba(81,190,123,0.04); }
	.operator-link svg { width: 14px; height: 14px; }
	.operator-link-btn { margin-top: 10px; background: none; cursor: pointer; }
	.rail-fact-list { display: grid; gap: 8px; margin-bottom: 14px; }
	.rail-fact-list-wide { grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); }
	.rail-fact { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 10px 12px; border: 1px solid var(--border-light); border-radius: 10px; background: var(--bg-cream); }
	.rail-fact span { font-family: var(--font-ui); font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.4px; color: var(--text-muted); }
	.rail-fact strong { font-family: var(--font-ui); font-size: 13px; font-weight: 700; color: var(--text-dark); text-align: right; }
	.sponsor-card { display: flex; align-items: center; gap: 16px; }
	.sponsor-avatar { width: 56px; height: 56px; border-radius: 50%; background: var(--primary); display: flex; align-items: center; justify-content: center; font-family: var(--font-ui); font-weight: 800; color: #fff; font-size: 18px; flex-shrink: 0; letter-spacing: -0.5px; }
	.sponsor-ceo-name { font-family: var(--font-ui); font-size: 15px; font-weight: 700; color: var(--text-dark); margin-bottom: 2px; }
	.sponsor-company-link { font-family: var(--font-ui); font-size: 13px; font-weight: 500; color: var(--primary); text-decoration: none; transition: color var(--transition); }
	.sponsor-company-link:hover { color: var(--primary-hover); text-decoration: underline; }
	.operator-deals-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 12px; }
	.operator-deal-card { display: block; background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius-sm); padding: 16px; text-decoration: none; transition: box-shadow 0.2s; }
	.operator-deal-card:hover { box-shadow: var(--shadow-card-hover); }
	.operator-deal-name { font-family: var(--font-ui); font-size: 14px; font-weight: 700; color: var(--text-dark); margin-bottom: 4px; }
	.operator-deal-meta { font-family: var(--font-ui); font-size: 12px; color: var(--text-muted); margin-bottom: 10px; }
	.operator-deal-stats { display: flex; gap: 16px; align-items: center; }
	.operator-deal-stat { font-family: var(--font-ui); font-size: 11px; color: var(--text-secondary); }
	.operator-deal-stat strong { font-size: 15px; font-weight: 800; color: var(--text-dark); }
		.investclearly-preview-pill {
			display: inline-flex;
			align-items: center;
		padding: 3px 8px;
		border-radius: 999px;
		background: rgba(37, 99, 235, 0.1);
		color: #2563eb;
		font-family: var(--font-ui);
		font-size: 10px;
			font-weight: 800;
			text-transform: uppercase;
			letter-spacing: 0.45px;
		}
		.investclearly-preview-pill.coming-soon {
			background: rgba(15,23,42,0.06);
			color: var(--text-dark);
		}
		.investclearly-summary {
			margin-left: auto;
		display: inline-flex;
		align-items: center;
		gap: 8px;
		padding: 6px 10px;
		border-radius: 999px;
		background: rgba(81,190,123,0.08);
		border: 1px solid rgba(81,190,123,0.18);
	}
	.investclearly-summary-stars {
		font-size: 12px;
		line-height: 1;
		letter-spacing: 0.8px;
		color: #f59e0b;
	}
	.investclearly-summary-copy {
		font-family: var(--font-ui);
		font-size: 11px;
		font-weight: 700;
		color: var(--text-dark);
	}
		.investclearly-body {
			padding-top: 18px;
			position: relative;
			overflow: hidden;
		}
		.investclearly-preview-surface {
			position: relative;
			filter: blur(2px);
			opacity: 0.55;
			transform: scale(0.995);
			pointer-events: none;
			user-select: none;
		}
		.investclearly-intro {
			margin-bottom: 14px;
		padding: 10px 12px;
		border-radius: 10px;
		background: rgba(81,190,123,0.05);
		border: 1px solid rgba(81,190,123,0.12);
	}
	.investclearly-intro-copy {
		font-family: var(--font-body);
		font-size: 12px;
		line-height: 1.55;
		color: var(--text-secondary);
	}
	.investclearly-intro-copy strong {
		color: var(--text-dark);
		font-weight: 700;
	}
	.investclearly-review-list {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 12px;
		align-items: stretch;
	}
	.investclearly-review-card {
		display: flex;
		flex-direction: column;
		padding: 14px;
		border: 1px solid var(--border-light);
		border-radius: 12px;
		background: linear-gradient(180deg, rgba(255,255,255,0.98), rgba(248,248,246,0.78));
	}
	.investclearly-review-top {
		display: flex;
		align-items: flex-start;
		gap: 12px;
	}
	.investclearly-review-photo {
		position: relative;
		width: 70px;
		height: 88px;
		border-radius: 18px;
		border: 1px solid rgba(255,255,255,0.55);
		background: linear-gradient(160deg, #ddebf6, #bfdad0);
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
		overflow: hidden;
		box-shadow: inset 0 1px 0 rgba(255,255,255,0.7);
	}
	.investclearly-review-card:nth-child(2) .investclearly-review-photo { background: linear-gradient(160deg, #e9e3f6, #cadff1); }
	.investclearly-review-card:nth-child(3) .investclearly-review-photo { background: linear-gradient(160deg, #f5e6df, #d9eadf); }
	.investclearly-review-photo svg {
		width: 34px;
		height: 34px;
		color: rgba(255,255,255,0.95);
		transform: translateY(-6px);
	}
	.investclearly-review-photo::after {
		content: '';
		position: absolute;
		inset: auto 10px 8px;
		height: 28px;
		border-radius: 999px;
		background: rgba(255,255,255,0.16);
		filter: blur(6px);
	}
	.investclearly-review-photo-badge {
		position: absolute;
		left: 8px;
		bottom: 8px;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: 30px;
		height: 22px;
		padding: 0 8px;
		border-radius: 999px;
		background: rgba(15,23,42,0.65);
		backdrop-filter: blur(6px);
		-webkit-backdrop-filter: blur(6px);
		color: #fff;
		font-family: var(--font-ui);
		font-size: 10px;
		font-weight: 800;
		letter-spacing: 0.3px;
	}
	.investclearly-reviewer-copy {
		display: grid;
		gap: 6px;
		min-width: 0;
		flex: 1;
	}
	.investclearly-reviewer-name-row {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 8px;
	}
	.investclearly-reviewer-name {
		font-family: var(--font-ui);
		font-size: 15px;
		font-weight: 700;
		color: var(--text-dark);
	}
	.investclearly-review-date {
		flex-shrink: 0;
		font-family: var(--font-ui);
		font-size: 11px;
		font-weight: 600;
		color: var(--text-muted);
	}
	.investclearly-reviewer-meta {
		display: flex;
		align-items: center;
		gap: 6px;
		flex-wrap: wrap;
		font-family: var(--font-ui);
		font-size: 11px;
		font-weight: 600;
		color: var(--text-muted);
	}
	.investclearly-review-stars {
		display: inline-flex;
		align-items: center;
		gap: 2px;
		font-size: 12px;
		line-height: 1;
		color: rgba(245,158,11,0.3);
	}
	.investclearly-review-stars .filled {
		color: #f59e0b;
	}
	.investclearly-reviewer-role {
		font-family: var(--font-ui);
		font-size: 10px;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.4px;
		color: var(--text-muted);
	}
	.investclearly-review-title {
		margin-top: 12px;
		font-family: var(--font-ui);
		font-size: 15px;
		font-weight: 700;
		color: var(--text-dark);
		letter-spacing: -0.15px;
		line-height: 1.35;
	}
		.investclearly-review-body {
			margin-top: 8px;
			font-family: var(--font-body);
		font-size: 13px;
		line-height: 1.55;
		color: var(--text-secondary);
		display: -webkit-box;
			-webkit-line-clamp: 5;
			-webkit-box-orient: vertical;
			overflow: hidden;
		}
		.investclearly-coming-soon-overlay {
			position: absolute;
			inset: 18px 24px 24px;
			display: flex;
			flex-direction: column;
			align-items: center;
			justify-content: center;
			gap: 12px;
			padding: 24px;
			border-radius: 16px;
			background: linear-gradient(180deg, rgba(255,255,255,0.72) 0%, rgba(248,248,246,0.84) 100%);
			border: 1px solid rgba(15,23,42,0.08);
			backdrop-filter: blur(10px);
			-webkit-backdrop-filter: blur(10px);
			text-align: center;
		}
		.investclearly-coming-soon-badge {
			display: inline-flex;
			align-items: center;
			justify-content: center;
			padding: 8px 14px;
			border-radius: 999px;
			background: var(--text-dark);
			color: #fff;
			font-family: var(--font-ui);
			font-size: 11px;
			font-weight: 800;
			text-transform: uppercase;
			letter-spacing: 0.5px;
		}
		.investclearly-coming-soon-copy {
			max-width: 420px;
			font-family: var(--font-body);
			font-size: 14px;
			line-height: 1.6;
			color: var(--text-dark);
		}
	.deal-map-container { height: 260px; border-radius: 8px; overflow: hidden; z-index: 0; }
	.deal-map-placeholder { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px; height: 180px; background: var(--bg-cream); border-radius: 8px; }
	.deal-map-spinner { width: 24px; height: 24px; border: 3px solid var(--border); border-top-color: var(--primary); border-radius: 50%; animation: spin 0.8s linear infinite; }
	@keyframes spin { to { transform: rotate(360deg); } }
	.btn-upgrade-map { margin-top: 6px; padding: 6px 16px; background: var(--primary); color: #fff; border-radius: var(--radius-sm); font-family: var(--font-ui); font-size: 12px; font-weight: 700; text-decoration: none; }
	.btn-upgrade-map:hover { opacity: 0.9; }
	.doc-list { display: flex; flex-direction: column; gap: 8px; }
	.doc-item { display: flex; align-items: center; gap: 10px; padding: 10px 14px; background: var(--bg-cream); border-radius: 8px; text-decoration: none; font-family: var(--font-ui); font-size: 13px; font-weight: 600; color: var(--text-dark); transition: background 0.15s; }
	.doc-item:hover { background: rgba(81,190,123,0.08); }
	.doc-row-button { width: 100%; border: none; cursor: pointer; justify-content: flex-start; }
	.doc-item-status { margin-left: auto; font-size: 10px; font-weight: 700; color: var(--primary); text-transform: uppercase; letter-spacing: 0.4px; }
	.doc-locked { color: var(--text-muted); cursor: default; }
	.doc-empty { font-family: var(--font-body); font-size: 13px; color: var(--text-muted); }
	.geography-body { padding: 20px 24px; }
	.geography-hero-card { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; padding: 18px 20px; border-radius: 14px; background: linear-gradient(135deg, rgba(81,190,123,0.08), rgba(59,130,246,0.06)); border: 1px solid rgba(81,190,123,0.14); }
	.geography-label { font-family: var(--font-ui); font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: var(--text-muted); margin-bottom: 6px; }
	.geography-title { font-family: var(--font-ui); font-size: 24px; font-weight: 800; color: var(--text-dark); line-height: 1.1; }
	.geography-subtitle { margin-top: 6px; font-family: var(--font-body); font-size: 13px; color: var(--text-secondary); }
	.geography-state-stack { display: flex; gap: 8px; flex-wrap: wrap; justify-content: flex-end; }
	.geo-pill { display: inline-flex; align-items: center; padding: 6px 12px; border-radius: 999px; background: var(--bg-card); border: 1px solid var(--border); font-family: var(--font-ui); font-size: 11px; font-weight: 700; color: var(--text-secondary); }
	.geo-pill.active { background: rgba(81,190,123,0.12); border-color: rgba(81,190,123,0.2); color: var(--primary); }
	.metric-grid { display: grid; gap: 12px; }
	.metric-grid-three { grid-template-columns: repeat(3, minmax(0, 1fr)); }
	.metric-pill { padding: 14px 16px; border-radius: 12px; background: var(--bg-cream); border: 1px solid var(--border-light); }
	.metric-pill-label { font-family: var(--font-ui); font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: var(--text-muted); margin-bottom: 6px; }
	.metric-pill-value { font-family: var(--font-ui); font-size: 15px; font-weight: 800; color: var(--text-dark); }
	.sec-footer-row { display: flex; align-items: center; justify-content: space-between; gap: 16px; margin-top: 14px; }
	.sec-footnote { font-family: var(--font-body); font-size: 13px; color: var(--text-secondary); }
	.locked-preview-shell { display: grid; gap: 10px; }
	.locked-preview-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 12px 14px; border: 1px solid var(--border-light); border-radius: 10px; background: linear-gradient(180deg, rgba(248,248,246,0.9), rgba(255,255,255,0.98)); }
	.locked-preview-row span { font-family: var(--font-ui); font-size: 12px; font-weight: 600; color: var(--text-secondary); }
	.locked-preview-row strong { font-family: var(--font-ui); font-size: 11px; font-weight: 800; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.45px; }
	.locked-preview-footer { display: flex; align-items: center; justify-content: space-between; gap: 16px; margin-top: 14px; }
	.locked-preview-title { font-family: var(--font-ui); font-size: 14px; font-weight: 700; color: var(--text-dark); }
	.locked-preview-copy { font-family: var(--font-body); font-size: 13px; color: var(--text-secondary); margin-top: 4px; }
	.native-helper-copy { font-family: var(--font-ui); font-size: 12px; font-weight: 700; color: var(--text-muted); }
	.fee-table { display: grid; gap: 10px; }
	.fee-row { display: flex; align-items: center; justify-content: space-between; gap: 14px; padding: 12px 14px; border: 1px solid var(--border-light); border-radius: 10px; background: var(--bg-cream); }
	.fee-copy { min-width: 0; }
	.fee-label { font-family: var(--font-ui); font-size: 12px; font-weight: 700; color: var(--text-dark); }
	.fee-value { font-family: var(--font-body); font-size: 13px; color: var(--text-secondary); margin-top: 2px; }
	.fee-verdict { flex-shrink: 0; padding: 5px 10px; border-radius: 999px; background: rgba(81,190,123,0.12); color: var(--primary); font-family: var(--font-ui); font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.45px; }
	.fee-verdict-muted { background: rgba(15,23,42,0.06); color: var(--text-muted); }
	.empty-state-card { padding: 18px 20px; border-radius: 12px; border: 1px dashed var(--border); background: linear-gradient(180deg, rgba(248,248,246,0.9), rgba(255,255,255,0.98)); }
	.empty-state-title { font-family: var(--font-ui); font-size: 14px; font-weight: 700; color: var(--text-dark); }
	.empty-state-copy { margin-top: 6px; font-family: var(--font-body); font-size: 13px; color: var(--text-secondary); }
	.materials-grid { display: flex; flex-direction: column; gap: 0; }
	.material-tile { display: flex; align-items: center; gap: 10px; padding: 10px 14px; border-bottom: 1px solid var(--border-light); font-family: var(--font-ui); font-size: 13px; font-weight: 600; color: var(--text-dark); text-decoration: none; transition: background var(--transition); }
	.material-tile:last-child { border-bottom: none; }
	.material-tile:hover { background: var(--bg-cream); color: var(--primary); }
	.material-tile svg { width: 16px; height: 16px; flex-shrink: 0; color: var(--text-muted); }
	.materials-missing { font-size: 13px; color: var(--text-muted); margin-top: 12px; }
	.materials-missing button { background: none; border: none; color: var(--primary); font-size: 13px; font-weight: 600; cursor: pointer; text-decoration: underline; text-underline-offset: 2px; padding: 0; }
	.material-tile-locked { display: flex; align-items: center; gap: 10px; padding: 10px 14px; background: rgba(0,0,0,0.02); border-bottom: 1px solid var(--border-light); font-family: var(--font-ui); font-size: 13px; font-weight: 600; color: var(--text-muted); cursor: default; position: relative; }
	.material-tile-locked:last-child { border-bottom: none; }
	.material-tile-locked .lock-badge { margin-left: auto; padding: 2px 8px; background: linear-gradient(135deg, #3b82f6, #4ade80); border-radius: 10px; font-size: 9px; font-weight: 700; color: #fff; text-transform: uppercase; letter-spacing: 0.5px; }
	.dd-section-body { position: relative; min-height: 120px; }
	.dd-progress-ring { margin-left: auto; flex-shrink: 0; }
	.dd-checklist-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px; }
	.dd-checklist-subtitle { font-size: 12px; color: var(--text-muted); font-family: var(--font-ui); margin-bottom: 16px; }
	.dd-accordion { border: 1px solid var(--border-light); border-radius: 10px; overflow: hidden; background: var(--bg-card); }
	.dd-accordion.blurred { opacity: 0.15; pointer-events: none; user-select: none; }
	.dd-accordion-section + .dd-accordion-section { border-top: 1px solid var(--border-light); }
	.dd-accordion-section { border: none; border-radius: 0; margin-bottom: 0; }
	.dd-accordion-header { display: flex; justify-content: space-between; align-items: center; width: 100%; padding: 12px 14px; background: var(--bg-card); border: none; cursor: pointer; user-select: none; transition: background 0.15s; font-family: var(--font-ui); }
	.dd-accordion-header:hover { background: var(--bg-page); }
	.dd-accordion-title { font-family: var(--font-ui); font-size: 13px; font-weight: 700; color: var(--text-dark); display: flex; align-items: center; gap: 6px; }
	.dd-accordion-title svg { width: 14px; height: 14px; transition: transform 0.2s; color: var(--text-muted); }
	.chevron { transition: transform 0.2s; }
	.chevron.open { transform: rotate(90deg); }
	.dd-accordion-progress { font-family: var(--font-ui); font-size: 11px; font-weight: 600; color: var(--text-muted); background: var(--bg-page); padding: 2px 8px; border-radius: 8px; border: 1px solid var(--border-light); }
	.dd-accordion-body { padding: 0 14px 14px; background: var(--bg-card); }
	.dd-question { padding: 10px 0; border-bottom: 1px solid var(--border-light); }
	.dd-question:last-child { border-bottom: none; }
	.dd-question.answered { }
	.dd-question-text { font-family: var(--font-ui); font-size: 12px; font-weight: 500; color: var(--text-dark); margin-bottom: 5px; line-height: 1.4; }
	.dd-answer { display: flex; align-items: flex-start; gap: 8px; }
	.dd-answer-icon { flex-shrink: 0; width: 18px; height: 18px; margin-top: 1px; }
	.dd-answer-icon.auto { color: var(--primary); }
	.dd-answer-icon.auto svg { color: var(--primary); }
	.dd-answer-icon.user { color: #3b82f6; }
	.dd-answer-icon.user svg { color: #3b82f6; }
	.dd-answer-icon.empty { color: var(--text-muted); }
	.dd-answer-icon.empty svg { color: var(--text-muted); }
	.dd-answer-text { font-family: var(--font-ui); font-size: 12px; color: var(--text-dark); flex: 1; }
	.dd-answer-badge { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; padding: 2px 6px; border-radius: 4px; flex-shrink: 0; }
	.dd-answer-badge.auto { background: rgba(81,190,123,0.12); color: var(--primary); }
	.dd-answer-badge.user { background: rgba(59,130,246,0.12); color: #3b82f6; }
	.dd-answer-badge.community { background: rgba(168,85,247,0.12); color: #a855f7; }
	.dd-answer-input { width: 100%; padding: 8px 12px; border: 1px solid var(--border); border-radius: var(--radius-sm); font-family: var(--font-ui); font-size: 12px; background: var(--bg-page); color: var(--text-dark); box-sizing: border-box; }
	.dd-answer-input:focus { outline: none; border-color: var(--primary); }
	.dd-perspectives { margin-top: 20px; padding-top: 20px; border-top: 1px solid var(--border-light); }
	.dd-perspectives-title { font-family: var(--font-ui); font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: var(--text-muted); margin-bottom: 12px; }
	.dd-perspective-links { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 20px; }
	.dd-section-locked { position: relative; overflow: hidden; max-height: 120px; }
	.dd-section-locked::after { content: ''; position: absolute; bottom: 0; left: 0; right: 0; height: 80px; background: linear-gradient(transparent, var(--bg-card)); pointer-events: none; }
	.gate-overlay { position: absolute; inset: 0; z-index: 5; display: flex; align-items: center; justify-content: center; background: rgba(255,255,255,0.7); backdrop-filter: blur(4px); -webkit-backdrop-filter: blur(4px); border-radius: 12px; }
	.gate-content { text-align: center; max-width: 340px; padding: 28px 20px 36px; }
	.gate-icon { width: 40px; height: 40px; border-radius: 50%; background: linear-gradient(135deg, #3b82f6, #4ade80); display: flex; align-items: center; justify-content: center; margin: 0 auto 12px; }
	.gate-title { font-family: var(--font-ui); font-size: 15px; font-weight: 800; color: var(--text-dark); margin-bottom: 4px; }
	.gate-text { font-family: var(--font-body); font-size: 12px; color: var(--text-secondary); margin-bottom: 14px; line-height: 1.5; }
	.gate-cta { display: inline-block; padding: 10px 24px; background: var(--primary); color: #fff; border-radius: 8px; font-family: var(--font-ui); font-size: 13px; font-weight: 700; text-decoration: none; }
	/* Deferred section overlay (now handled by ComingSoonOverlay component) */
	.qa-placeholder-item { padding: 12px 0; border-bottom: 1px solid var(--border); font-size: 13px; color: var(--text-secondary); }
	.qa-placeholder-item:last-child { border-bottom: none; }
	.community-stat { display: flex; align-items: center; gap: 8px; font-family: var(--font-ui); font-size: 14px; font-weight: 700; color: var(--text-dark); margin-bottom: 10px; }
	.community-stat.invested { color: var(--primary); }
	.community-privacy { font-family: var(--font-body); font-size: 11px; color: var(--text-muted); margin-top: 14px; padding-top: 10px; border-top: 1px solid var(--border-light); }
	.community-stat-row { display: flex; align-items: center; gap: 12px; margin-bottom: 10px; }
	.community-avatar-stack { display: flex; align-items: center; flex-shrink: 0; }
	.community-avatar {
		width: 32px;
		height: 32px;
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
		font-family: var(--font-ui);
		font-size: 10px;
		font-weight: 700;
		color: #fff;
		border: 2px solid var(--bg-card, #fff);
		margin-right: -8px;
		position: relative;
	}
	.community-avatar-more {
		background: var(--text-muted) !important;
		font-size: 9px;
	}
	.sticky-action-bar { position: fixed; bottom: 16px; left: calc(var(--sidebar-width, 240px) + 24px); right: 24px; display: flex; align-items: center; justify-content: center; z-index: 100; }
	.sticky-action-bar-inner { display: flex; align-items: center; justify-content: center; gap: 12px; padding: 10px 24px; background: var(--bg-card); border: 1px solid var(--border); border-radius: 12px; box-shadow: 0 8px 24px rgba(0,0,0,0.08); }
	.btn-pass { padding: 9px 18px; border: 1px solid var(--border); background: var(--bg-card); border-radius: var(--radius-sm); font-family: var(--font-ui); font-size: 12px; font-weight: 600; color: var(--text-muted); cursor: pointer; display: flex; align-items: center; gap: 6px; }
	.btn-pass:hover { border-color: #ef4444; color: #ef4444; }
	.btn-advance { padding: 9px 18px; background: var(--primary); color: #fff; border: none; border-radius: var(--radius-sm); font-family: var(--font-ui); font-size: 12px; font-weight: 700; cursor: pointer; display: flex; align-items: center; gap: 6px; transition: all 0.15s; }
	.btn-advance:hover { background: #3da86a; transform: translateY(-1px); }
	.btn-stage-select { padding: 9px 18px; background: var(--bg-page); border: 1px solid var(--border); border-radius: var(--radius-sm); font-family: var(--font-ui); font-size: 12px; font-weight: 600; color: var(--text-dark); cursor: pointer; display: flex; align-items: center; gap: 6px; }
	.btn-compare { display: none; }
	.btn-compare:hover { border-color: var(--primary); color: var(--primary); }
	.btn-compare.is-active { border-color: rgba(81, 190, 123, 0.34); color: var(--primary); background: rgba(81, 190, 123, 0.1); }
	.floating-compare-badge { position: fixed; bottom: 80px; right: 24px; background: var(--primary); color: #fff; padding: 8px 16px; border-radius: 20px; font-family: var(--font-ui); font-size: 12px; font-weight: 700; text-decoration: none; display: flex; align-items: center; gap: 6px; z-index: 101; box-shadow: 0 4px 12px rgba(0,0,0,0.15); transition: transform 0.15s; border: none; cursor: pointer; }
	.floating-compare-badge:hover { transform: translateY(-2px); box-shadow: 0 6px 16px rgba(0,0,0,0.2); }
	.stage-label { font-size: 11px; color: var(--text-muted); font-family: var(--font-ui); flex: 1; text-align: center; }
	.deal-page-content { padding-bottom: 112px; }
	.share-invite { border-bottom: 1px solid var(--border-light); padding-bottom: 10px; margin-bottom: 4px; }
	.share-invite-text { color: var(--primary); font-weight: 700; }
	.deck-viewed-prompt {
		background: rgba(81,190,123,0.08);
		border: 1px solid rgba(81,190,123,0.2);
		border-radius: 10px;
		padding: 12px 20px;
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 16px;
		gap: 12px;
	}
	.deck-viewed-left { display: flex; align-items: center; gap: 4px; flex-wrap: wrap; }
	.deck-viewed-title { font-family: var(--font-ui); font-size: 13px; font-weight: 600; color: var(--text-dark); }
	.deck-viewed-sub { font-family: var(--font-body); font-size: 13px; color: var(--text-secondary); }
	.intro-nudge-banner {
		background: rgba(245,158,11,0.06);
		border: 1px solid rgba(245,158,11,0.15);
		border-radius: 10px;
		padding: 16px 20px;
		margin-bottom: 16px;
		display: flex;
		align-items: center;
		gap: 16px;
	}
	.intro-nudge-banner { display: none; }
	.intro-nudge-icon {
		width: 40px; height: 40px; border-radius: 50%;
		background: rgba(245,158,11,0.12);
		display: flex; align-items: center; justify-content: center;
		flex-shrink: 0;
	}
	.intro-nudge-text { flex: 1; }
	.intro-nudge-title { font-family: var(--font-ui); font-size: 14px; font-weight: 700; color: var(--text-dark); margin-bottom: 2px; }
	.intro-nudge-desc { font-family: var(--font-body); font-size: 13px; color: var(--text-secondary); }
	.claim-deal-banner {
		background: linear-gradient(135deg, rgba(37,99,235,0.06), rgba(37,99,235,0.02));
		border: 1px solid rgba(37,99,235,0.2);
		border-radius: var(--radius-sm, 8px);
		padding: 18px 20px;
		margin-bottom: 16px;
		display: flex;
		align-items: center;
		gap: 14px;
		flex-wrap: wrap;
	}
	.claim-deal-icon {
		width: 44px; height: 44px; border-radius: 12px;
		background: rgba(37,99,235,0.1);
		display: flex; align-items: center; justify-content: center;
		flex-shrink: 0;
	}
	.claim-deal-text { flex: 1; min-width: 200px; }
	.claim-deal-title { font-family: var(--font-ui); font-size: 14px; font-weight: 700; color: var(--text-dark); margin-bottom: 2px; }
	.claim-deal-desc { font-family: var(--font-body); font-size: 12px; color: var(--text-secondary); line-height: 1.5; }
	.btn-claim {
		flex-shrink: 0; padding: 10px 20px;
		background: #2563eb; color: #fff; border: none; border-radius: 8px;
		font-family: var(--font-ui); font-size: 13px; font-weight: 700;
		cursor: pointer; white-space: nowrap; transition: background 0.15s;
	}
	.btn-claim:hover { background: #1d4ed8; }
	.buybox-card {
		background: var(--bg-page);
		border: 1px solid var(--border);
		border-radius: 10px;
		padding: 14px 16px;
		margin-bottom: 18px;
	}
	.buybox-header {
		display: flex;
		align-items: center;
		gap: 10px;
		margin-bottom: 12px;
		flex-wrap: wrap;
	}
	.buybox-title { font-family: var(--font-ui); font-size: 14px; font-weight: 800; color: var(--text-dark); }
	.buybox-badge {
		display: inline-flex; align-items: center; gap: 4px;
		padding: 3px 10px; border-radius: 10px;
		font-family: var(--font-ui); font-size: 11px; font-weight: 700;
	}
	.buybox-score { font-family: var(--font-ui); font-size: 14px; font-weight: 800; }
	.buybox-progress {
		flex: 1; min-width: 60px; max-width: 96px;
		height: 5px; background: var(--border-light); border-radius: 3px; overflow: hidden;
	}
	.buybox-progress-fill { height: 100%; border-radius: 3px; }
	.buybox-edit {
		margin-left: auto;
		font-family: var(--font-ui); font-size: 11px; font-weight: 700;
		color: var(--primary); text-decoration: none; opacity: 0.8; border: none; background: none; cursor: pointer;
	}
	.buybox-edit:hover { opacity: 1; }
	.buybox-badge-lite { background: rgba(81,190,123,0.12); color: var(--primary); }
	.buybox-lite-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
	.buybox-lite-card-shell { padding: 14px; border-radius: 12px; border: 1px solid var(--border-light); background: linear-gradient(180deg, rgba(81,190,123,0.04), rgba(255,255,255,0.96)); }
	.buybox-lite-card-shell.locked { background: linear-gradient(180deg, rgba(15,23,42,0.03), rgba(255,255,255,0.96)); }
	.buybox-lite-label { font-family: var(--font-ui); font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: var(--text-muted); }
	.buybox-lite-status { font-family: var(--font-ui); font-size: 18px; font-weight: 800; color: var(--text-dark); margin-top: 4px; }
	.buybox-lite-description { font-family: var(--font-body); font-size: 13px; color: var(--text-secondary); margin-top: 8px; line-height: 1.5; }
	.buybox-lite-actions { margin-top: 14px; display: flex; justify-content: flex-end; }
	.locked-preview-footer .buybox-edit { margin-left: 0; }
	.buybox-criteria-grid { display: grid; gap: 10px; }
	.buybox-criterion {
		text-decoration: none;
		display: flex; align-items: flex-start; gap: 8px;
		padding: 9px 10px;
		border-radius: 8px;
		transition: background 0.15s;
		border: 1px solid;
		background: none;
		width: 100%;
		text-align: left;
		cursor: pointer;
	}
	.buybox-criterion.match { background: rgba(74,222,128,0.04); border-color: rgba(74,222,128,0.14); }
	.buybox-criterion.match:hover { background: rgba(74,222,128,0.08); }
	.buybox-criterion.miss { background: rgba(248,113,113,0.04); border-color: rgba(248,113,113,0.14); }
	.buybox-criterion.miss:hover { background: rgba(248,113,113,0.08); }
	.buybox-criterion-icon { flex-shrink: 0; margin-top: 1px; }
	.buybox-criterion-content { flex: 1; min-width: 0; }
	.buybox-criterion-label { font-family: var(--font-ui); font-size: 12px; font-weight: 700; }
	.buybox-criterion-detail { font-family: var(--font-ui); font-size: 11px; color: var(--text-muted); margin-top: 3px; line-height: 1.4; }
	.buybox-criterion-detail strong { color: var(--text-secondary); font-weight: 600; }
	.buybox-criterion-got { font-family: var(--font-ui); font-size: 11px; color: var(--text-muted); margin-top: 2px; }
	.btn-sm { padding: 8px 20px; font-size: 12px; }
	@media (max-width: 1024px) {
		.main {
			margin-left: 0;
			width: 100%;
			padding-top: 0;
			padding-bottom: var(--deal-mobile-tab-bar-offset);
		}
		.content-wrap {
			--ly-dealflow-frame-pad-top-tablet: 20px;
			--ly-dealflow-frame-pad-bottom-tablet: 48px;
			--ly-dealflow-frame-pad-top-mobile: 20px;
			--ly-dealflow-frame-pad-bottom-mobile: 48px;
		}
		.deal-mobile-tabs {
			display: flex;
			justify-content: space-around;
		}
		.deal-mobile-tab {
			font-size: 12px;
			padding: 8px 0;
		}
		.deal-mobile-tab svg {
			width: 24px;
			height: 24px;
		}
		.sticky-action-bar {
			left: 16px;
			right: 16px;
			bottom: calc(var(--deal-mobile-tab-bar-offset) + 12px);
		}
		.sticky-action-bar-inner { padding: 10px 16px; gap: 8px; }
		.sticky-action-bar-inner .btn-pass, .sticky-action-bar-inner .btn-advance { padding: 8px 14px; font-size: 12px; }
		.sticky-action-bar-inner .stage-label { font-size: 11px; }
		.deal-page-content { padding-bottom: calc(var(--deal-mobile-tab-bar-offset) + 108px); }
		.floating-compare-badge { bottom: calc(var(--deal-mobile-tab-bar-offset) + 88px); }
		.metrics-strip { grid-template-columns: repeat(3, 1fr); }
		.details-grid { grid-template-columns: repeat(3, 1fr); }
		.historical-returns-grid { grid-template-columns: 1fr; }
		.investclearly-review-list { grid-template-columns: repeat(2, minmax(0, 1fr)); }
	}
	@media (max-width: 900px) {
		.deal-header-inner { flex-direction: column; align-items: flex-start; }
		.hero-right { flex-direction: row; align-items: center; gap: 8px; text-align: left; flex-wrap: wrap; }
		.hero-right .hero-deck-btn { padding: 10px 16px; font-size: 13px; gap: 6px; }
		.hero-right .hero-deck-btn svg { width: 16px; height: 16px; }
		.hero-right .hero-share-btn { display: inline-flex; }
		.hero-operator-photo { width: 48px; height: 48px; font-size: 18px; }
		.hero-metrics { gap: 12px 16px; }
		.hero-metric-value { font-size: 18px; }
		.hero-type-icon { width: 60px !important; height: 60px !important; opacity: 0.15 !important; }
		.two-col-grid { grid-template-columns: 1fr; }
		.buybox-criteria-grid { grid-template-columns: repeat(2, 1fr) !important; }
	}
	@media (max-width: 768px) {
		.main {
			padding-top: 0;
			padding-bottom: var(--deal-mobile-tab-bar-offset);
		}
		.metric-grid-three,
		.buybox-lite-grid { grid-template-columns: 1fr; }
		.geography-hero-card,
		.locked-preview-footer,
		.sec-footer-row { flex-direction: column; align-items: flex-start; }
		.deal-mobile-tab {
			font-size: 10px;
			padding: 4px 0;
		}
		.deal-mobile-tab svg {
			width: 20px;
			height: 20px;
		}
		.data-completeness-hint { display: none; }
		.data-completeness { padding: 10px 14px; gap: 10px; }
		.data-completeness-label { font-size: 11px; }
			.metrics-strip { grid-template-columns: repeat(2, 1fr); }
			.details-grid { grid-template-columns: repeat(2, 1fr); gap: 14px; }
			.deal-name { font-size: 24px; }
			.deal-header { padding: 24px 20px; }
			.section-body { padding: 20px 18px; }
			.section-header { padding: 16px 18px; }
			.historical-returns-headline { font-size: 24px; }
			.summary-row { flex-direction: column; gap: 4px; }
			.summary-label { min-width: 0; }
			.investclearly-summary {
				margin-left: 0;
				width: 100%;
				justify-content: flex-start;
			}
			.investclearly-review-list { grid-template-columns: 1fr; }
			.investclearly-coming-soon-overlay { inset: 14px 18px 18px; padding: 18px; }
			.investclearly-review-photo {
				width: 64px;
				height: 80px;
			border-radius: 16px;
		}
		.investclearly-reviewer-name-row {
			flex-direction: column;
			gap: 3px;
		}
		.journey-bar { padding: 8px 12px; max-width: 100%; }
		.journey-step { padding: 3px 5px; font-size: 8px; }
		.step-dot { width: 28px; height: 28px; font-size: 11px; }
		.journey-outcome-divider { height: 24px; margin: 0 8px; }
		.hero-type-icon svg { width: 80px; height: 80px; }
		.deal-tags { flex-wrap: wrap; gap: 6px !important; }
		.deal-tag { font-size: 11px !important; padding: 3px 10px !important; }
		.material-tile { padding: 8px 12px; font-size: 12px; }
		.dd-accordion-header { padding: 12px 14px; }
		.dd-accordion-body { padding: 0 14px 14px; }
		.dd-question-text { font-size: 12px; }
		.dd-answer-text { font-size: 12px; }
		.returns-chart-container { height: 160px; padding: 12px; }
		.operator-profile { flex-direction: column; align-items: center; text-align: center; }
		.operator-stats { justify-content: center; }
		.operator-links { justify-content: center; }
		.operator-deals-grid { grid-template-columns: 1fr; }
		.buybox-criteria-grid { grid-template-columns: 1fr !important; }
		.intro-nudge-banner { flex-direction: column; text-align: center; }
		.claim-deal-banner { flex-direction: column; text-align: center; }
		.deck-viewed-prompt { flex-direction: column; text-align: center; gap: 8px; }
		.peer-count-label { width: 100%; margin-left: 0; }
	}
	@media (max-width: 480px) {
		.metrics-strip { grid-template-columns: 1fr 1fr !important; gap: 8px !important; }
		.details-grid { grid-template-columns: 1fr; }
		.deal-name { font-size: 20px !important; }
		.hero-metrics { flex-wrap: wrap !important; }
		.action-buttons { flex-direction: column; }
		.btn-action { justify-content: center; width: 100%; }
		.geo-info { flex-direction: column; gap: 12px; }
		.journey-bar { padding: 6px 6px; }
		.journey-step { padding: 2px 3px; font-size: 7px; }
		.step-dot { width: 24px; height: 24px; font-size: 10px; }
		.journey-arrow svg { width: 6px; height: 10px; }
		.journey-outcome-divider { height: 20px; margin: 0 6px; }
		.hero-social-proof { font-size: 12px; gap: 10px; }
		.sp-avatar { width: 26px; height: 26px; font-size: 9px; }
		.dd-perspective-links { flex-direction: column; }
		.btn-link { font-size: 11px; }
	}
	.cf-assumptions { font-family: var(--font-body); font-size: 11px; color: var(--text-muted); margin-bottom: 14px; padding: 8px 12px; background: var(--bg-main, var(--bg-cream)); border-radius: 6px; }
	.cf-toggle { display: inline-flex; border: 1px solid var(--border); border-radius: 6px; overflow: hidden; margin-bottom: 16px; }
	.cf-toggle button { padding: 6px 16px; border: none; background: none; font-family: var(--font-ui); font-size: 12px; font-weight: 600; color: var(--text-muted); cursor: pointer; transition: all 0.15s; }
	.cf-toggle button.active { background: var(--primary); color: #fff; }
	.cf-chart-wrap { padding: 8px 0; }
	.cf-bar-row { display: flex; align-items: center; gap: 10px; margin-bottom: 8px; }
	.cf-bar-label { font-family: var(--font-ui); font-size: 11px; font-weight: 600; color: var(--text-muted); min-width: 36px; text-align: right; }
	.cf-bar-track { flex: 1; height: 24px; background: var(--bg-cream, #f8f8f6); border-radius: 4px; position: relative; overflow: hidden; }
	.cf-bar-dist { position: absolute; top: 0; left: 0; height: 100%; background: #51be7b; border-radius: 4px 0 0 4px; transition: width 0.3s ease; }
	.cf-bar-cap { position: absolute; top: 0; height: 100%; background: #2d8a54; border-radius: 0 4px 4px 0; transition: all 0.3s ease; }
	.cf-bar-value { font-family: var(--font-ui); font-size: 12px; font-weight: 700; color: var(--text-dark); min-width: 60px; }
	.cf-legend { display: flex; gap: 16px; margin-top: 8px; justify-content: flex-end; }
	.cf-legend-item { font-size: 11px; color: var(--text-muted); display: flex; align-items: center; gap: 5px; }
	.cf-legend-dot { width: 12px; height: 6px; border-radius: 2px; display: inline-block; }
	.cf-legend-dot.dist { background: #51be7b; }
	.cf-legend-dot.cap { background: #2d8a54; }
	.cf-table-wrap { overflow-x: auto; -webkit-overflow-scrolling: touch; min-width: 0; max-width: 100%; }
	.cf-table { width: 100%; border-collapse: collapse; font-family: var(--font-ui); font-size: 13px; }
	.cf-table thead th { padding: 8px 12px; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: var(--text-muted); border-bottom: 2px solid var(--border); text-align: right; }
	.cf-table thead th:first-child { text-align: left; }
	.cf-table tbody td { padding: 10px 12px; text-align: right; border-bottom: 1px solid var(--border-light); font-weight: 600; color: var(--text-dark); }
	.cf-table tbody td:first-child { text-align: left; }
	.cf-total-row { background: rgba(81,190,123,0.04); }
	.cf-highlight { color: var(--primary) !important; font-weight: 700 !important; }
	.cf-cap-out { color: var(--text-muted); }
	.cf-cap-in { color: var(--primary); font-weight: 700; }
	.cf-note { font-size: 10px !important; color: var(--text-muted) !important; font-style: italic; font-weight: 400 !important; }
	.cf-summary-row td { padding: 14px 12px; border-bottom: none; vertical-align: top; text-align: right; }
	.cf-summary-row td:first-child { text-align: left; }
	.cf-summary-value { font-size: 16px; font-weight: 800; color: var(--text-dark); }
	.cf-summary-value.green { color: var(--primary); }
	.cf-summary-label { font-size: 10px; color: var(--text-muted); margin-top: 2px; }
	.blurred { opacity: 0.45; pointer-events: none; user-select: none; filter: blur(2px); }
	.peer-count-label { font-family: var(--font-ui); font-size: 11px; color: var(--text-muted); margin-left: auto; }
	.peer-table-wrap { overflow-x: auto; -webkit-overflow-scrolling: touch; min-width: 0; max-width: 100%; }
	.peer-table { width: 100%; border-collapse: collapse; font-family: var(--font-ui); font-size: 13px; }
	.peer-th { padding: 8px 12px; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: var(--text-muted); border-bottom: 2px solid var(--border); text-align: left; }
	.peer-th.center { text-align: center; }
	.peer-td { padding: 10px 12px; border-bottom: 1px solid var(--border-light); }
	.peer-td.center { text-align: center; }
	.peer-td.label { font-weight: 600; color: var(--text-dark); }
	.peer-td.bold { font-weight: 700; color: var(--text-dark); }
	.peer-td.muted { color: var(--text-muted); }
	.peer-verdict { display: inline-block; padding: 3px 10px; border-radius: 12px; font-size: 11px; font-weight: 700; }
	.peer-verdict.good { color: #10b981; background: rgba(16,185,129,0.08); }
	.peer-verdict.bad { color: #ef4444; background: rgba(239,68,68,0.08); }
	.peer-verdict.neutral { color: var(--text-muted); background: var(--bg-cream, #f8f8f6); }
	.peer-footnote { margin-top: 12px; padding: 10px 14px; background: var(--bg-cream, #f8f8f6); border-radius: 6px; font-family: var(--font-body); font-size: 11px; color: var(--text-muted); line-height: 1.5; }
	.peer-mobile-list { display: grid; gap: 12px; }
	.peer-mobile-list.ly-mobile-only { display: grid !important; }
	.peer-mobile-card {
		padding: 14px;
		border: 1px solid var(--border-light);
		border-radius: 12px;
		background: linear-gradient(180deg, rgba(248,248,246,0.7) 0%, rgba(255,255,255,0.96) 100%);
	}
	.peer-mobile-head {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 12px;
		margin-bottom: 12px;
	}
	.peer-mobile-label {
		font-family: var(--font-ui);
		font-size: 13px;
		font-weight: 700;
		color: var(--text-dark);
	}
	.peer-mobile-metrics {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 10px;
	}
	.peer-mobile-metric {
		padding: 10px 12px;
		border-radius: 10px;
		background: var(--bg-cream, #f8f8f6);
	}
	.peer-mobile-metric-label {
		display: block;
		font-family: var(--font-ui);
		font-size: 10px;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.5px;
		color: var(--text-muted);
		margin-bottom: 4px;
	}
	.peer-mobile-metric-value {
		display: block;
		font-family: var(--font-ui);
		font-size: 14px;
		font-weight: 800;
		color: var(--text-dark);
	}
	.st-base-case { background: linear-gradient(135deg, rgba(81,190,123,0.08) 0%, #f0fdf4 100%); border: 1px solid rgba(81,190,123,0.15); border-radius: 8px; padding: 16px 20px; margin-bottom: 24px; }
	.st-base-title { font-family: var(--font-ui); font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.8px; color: var(--text-muted); margin-bottom: 10px; }
	.st-base-pills { display: flex; flex-wrap: wrap; gap: 8px; }
	.st-pill { display: inline-flex; align-items: center; gap: 4px; padding: 6px 12px; background: #fff; border: 1px solid rgba(81,190,123,0.2); border-radius: 20px; font-family: var(--font-ui); font-size: 12px; font-weight: 700; color: var(--primary); }
	.st-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }
	.st-inputs { display: flex; flex-direction: column; gap: 16px; }
	.st-input-label { display: flex; align-items: center; justify-content: space-between; font-family: var(--font-ui); font-size: 13px; font-weight: 600; color: var(--text-dark); margin-bottom: 6px; }
	.st-input-val { font-weight: 700; color: var(--primary); font-size: 12px; }
	.st-number-input { width: 100%; padding: 8px 12px; border: 1px solid var(--border); border-radius: 6px; font-family: var(--font-ui); font-size: 14px; font-weight: 600; outline: none; }
	.st-number-input:focus { border-color: var(--primary); }
	.st-slider { width: 100%; height: 6px; -webkit-appearance: none; appearance: none; background: var(--border-light); border-radius: 3px; outline: none; }
	.st-slider::-webkit-slider-thumb { -webkit-appearance: none; appearance: none; width: 18px; height: 18px; border-radius: 50%; background: var(--primary); cursor: pointer; border: 2px solid #fff; box-shadow: 0 1px 4px rgba(0,0,0,0.15); }
	.st-slider::-moz-range-thumb { width: 18px; height: 18px; border-radius: 50%; background: var(--primary); cursor: pointer; border: 2px solid #fff; box-shadow: 0 1px 4px rgba(0,0,0,0.15); }
	.st-outputs { background: var(--bg-cream, #f8f8f6); border-radius: 8px; padding: 20px; }
	.st-outputs-title { font-family: var(--font-ui); font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.8px; color: var(--primary); margin-bottom: 14px; display: flex; align-items: center; gap: 6px; }
	.st-output-item { display: flex; align-items: center; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid var(--border-light); }
	.st-output-item:last-child { border-bottom: none; }
	.st-output-label { font-family: var(--font-ui); font-size: 13px; color: var(--text-secondary); }
	.st-output-value { font-family: var(--font-ui); font-size: 14px; font-weight: 800; color: var(--text-dark); }
	.st-scenarios { margin-top: 24px; }
	.st-scenarios-title { font-family: var(--font-ui); font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: var(--text-muted); margin-bottom: 12px; }
	.st-scenario-table { width: 100%; border-collapse: collapse; font-family: var(--font-ui); font-size: 13px; }
	.st-scenario-table thead th { padding: 10px 16px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 2px solid var(--border); text-align: center; }
	.st-scenario-table thead th:first-child { text-align: left; }
	.st-scenario-table thead th.bear { color: #ef4444; }
	.st-scenario-table thead th.base { color: var(--text-dark); }
	.st-scenario-table thead th.bull { color: #10b981; }
	.st-scenario-table tbody td { padding: 10px 16px; text-align: center; font-weight: 700; border-bottom: 1px solid var(--border-light); }
	.st-sc-label { text-align: left !important; font-weight: 600 !important; color: var(--text-dark); }
	.st-scenario-table tbody td.bear { color: #ef4444; }
	.st-scenario-table tbody td.base { color: var(--text-dark); }
	.st-scenario-table tbody td.bull { color: #10b981; }
	@media (max-width: 768px) {
		.st-grid { grid-template-columns: 1fr; }
		.cf-table, .peer-table { font-size: 12px; }
		.st-scenario-table { font-size: 12px; }
		.cf-legend { justify-content: flex-start; }
	}
	@media (max-width: 480px) {
		.cf-bar-row { gap: 6px; }
		.cf-bar-value { font-size: 11px; min-width: 48px; }
		.st-base-pills { gap: 6px; }
		.st-pill { font-size: 11px; padding: 4px 8px; }
		.peer-mobile-metrics { grid-template-columns: 1fr; }
	}
	.deal-fit-body { position: relative; min-height: 100px; }
	.deal-fit-body.gated { min-height: 180px; }
	.fit-verdict { display: flex; align-items: center; gap: 14px; padding: 16px 20px; background: color-mix(in srgb, var(--verdict-color) 6%, transparent); border: 1px solid color-mix(in srgb, var(--verdict-color) 15%, transparent); border-radius: 10px; margin-bottom: 20px; }
	.fit-verdict-icon { flex-shrink: 0; color: var(--verdict-color); }
	.fit-verdict-text { font-family: var(--font-ui); font-size: 15px; font-weight: 700; color: var(--verdict-color); }
	.fit-verdict-sub { font-family: var(--font-body); font-size: 12px; color: var(--text-muted); margin-top: 2px; }
	.fit-list-section { margin-bottom: 16px; }
	.fit-list-label { font-family: var(--font-ui); font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px; }
	.fit-label-good { color: var(--primary); }
	.fit-label-warn { color: #f59e0b; }
	.fit-list-item { display: flex; align-items: flex-start; gap: 10px; padding: 6px 0; font-family: var(--font-body); font-size: 13px; color: var(--text-dark); line-height: 1.5; }
	.fit-list-item svg { flex-shrink: 0; margin-top: 2px; }
	.bg-check-body { position: relative; min-height: 100px; }
	.bg-check-body.gated { min-height: 180px; }
	.bg-status-badge { display: inline-flex; align-items: center; gap: 5px; padding: 3px 12px; border-radius: 20px; font-family: var(--font-ui); font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; margin-left: auto; }
	.bg-status-badge.bg-clear { background: #E7F5F0; color: #51BE7B; }
	.bg-status-badge.bg-flagged { background: #FEE2E2; color: #DC2626; }
	.bg-status-badge.bg-pending { background: #FFF3E6; color: #CF7A30; }
	.bg-sources { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 12px; }
	.bg-source-badge { display: inline-flex; align-items: center; gap: 6px; padding: 6px 12px; border-radius: 20px; font-family: var(--font-ui); font-size: 11px; font-weight: 600; }
	.bg-source-badge.bg-clear { background: #E7F5F0; color: #51BE7B; }
	.bg-source-badge.bg-flagged { background: #FEE2E2; color: #DC2626; }
	.bg-source-badge.bg-pending { background: var(--bg-main, #f5f5f5); color: var(--text-muted); }
	.bg-source-label { font-weight: 700; }
	.bg-source-detail { font-weight: 500; }
	.bg-source-link { color: inherit; opacity: 0.7; transition: opacity 0.15s; }
	.bg-source-link:hover { opacity: 1; }
	.bg-flags { padding: 10px 14px; background: #FEF2F2; border: 1px solid #FECACA; border-radius: 8px; margin-bottom: 12px; }
	.bg-flag-item { font-family: var(--font-ui); font-size: 11px; color: #991B1B; line-height: 1.6; }
	.bg-footer { display: flex; align-items: center; justify-content: space-between; }
	.bg-full-report { font-family: var(--font-ui); font-size: 12px; font-weight: 600; color: var(--primary); text-decoration: none; }
	.bg-run-date { font-family: var(--font-ui); font-size: 10px; color: var(--text-muted); }
	.bg-loading { text-align: center; padding: 20px; color: var(--text-muted); font-size: 13px; }
	.bg-empty { text-align: center; padding: 16px; }
	.bg-empty-text { font-family: var(--font-ui); font-size: 13px; color: var(--text-secondary); margin-bottom: 10px; }
	.bg-run-cta { display: inline-flex; align-items: center; gap: 6px; padding: 10px 20px; background: var(--primary); color: #fff; border-radius: 8px; font-family: var(--font-ui); font-size: 12px; font-weight: 700; text-decoration: none; }
	.qa-count { font-family: var(--font-ui); font-size: 11px; font-weight: 700; background: var(--primary); color: #fff; padding: 2px 8px; border-radius: 10px; margin-left: 6px; }
	.qa-ask-form { display: flex; gap: 10px; align-items: flex-start; margin-bottom: 20px; }
	.qa-input { flex: 1; padding: 10px 14px; border: 1px solid var(--border); border-radius: 8px; font-family: var(--font-body); font-size: 13px; resize: vertical; min-height: 40px; }
	.qa-input:focus { border-color: var(--primary); outline: none; }
	.qa-submit-btn { padding: 10px 20px; background: var(--primary); color: #fff; border: none; border-radius: 8px; font-family: var(--font-ui); font-size: 13px; font-weight: 700; cursor: pointer; white-space: nowrap; transition: background 0.15s; }
	.qa-submit-btn:hover:not(:disabled) { background: #3da86a; }
	.qa-submit-btn:disabled { opacity: 0.5; cursor: not-allowed; }
	.qa-loading, .qa-empty { text-align: center; padding: 24px; color: var(--text-muted); font-size: 13px; }
	.qa-list { }
	.qa-item { display: flex; gap: 12px; padding: 16px 0; border-bottom: 1px solid var(--border-light); }
	.qa-item:last-child { border-bottom: none; }
	.qa-vote-col { flex-shrink: 0; display: flex; flex-direction: column; align-items: center; gap: 2px; }
	.qa-upvote-btn { background: none; border: none; cursor: pointer; padding: 2px; color: var(--text-muted); transition: color 0.15s; }
	.qa-upvote-btn.upvoted { color: var(--primary); cursor: default; }
	.qa-upvote-btn:hover:not(.upvoted) { color: var(--primary); }
	.qa-vote-count { font-family: var(--font-ui); font-size: 13px; font-weight: 700; color: var(--text-muted); }
	.qa-vote-count.has-votes { color: var(--text-dark); }
	.qa-content { flex: 1; min-width: 0; }
	.qa-question-text { font-family: var(--font-body); font-size: 14px; color: var(--text-dark); line-height: 1.5; }
	.qa-meta { font-size: 11px; color: var(--text-muted); margin-top: 4px; }
	.qa-author { font-weight: 600; }
	.qa-time { margin-left: 4px; }
	.qa-answer { margin-top: 12px; padding: 12px 16px; background: rgba(81,190,123,0.06); border-left: 3px solid var(--primary); border-radius: 0 8px 8px 0; }
	.qa-answer-header { display: flex; align-items: center; gap: 6px; margin-bottom: 6px; }
	.qa-answer-avatar { width: 24px; height: 24px; border-radius: 50%; background: var(--primary); color: #fff; display: flex; align-items: center; justify-content: center; font-family: var(--font-ui); font-size: 10px; font-weight: 800; }
	.qa-answer-by { font-family: var(--font-ui); font-size: 12px; font-weight: 700; color: var(--text-dark); }
	.qa-answer-time { font-size: 11px; color: var(--text-muted); }
	.qa-answer-text { font-family: var(--font-body); font-size: 13px; color: var(--text-dark); line-height: 1.6; }
	.qa-answer-form { margin-top: 8px; }
	.qa-answer-input { width: 100%; padding: 8px 10px; border: 1px solid var(--border); border-radius: 8px; font-family: var(--font-body); font-size: 12px; resize: vertical; box-sizing: border-box; }
	.qa-answer-submit { margin-top: 4px; padding: 6px 14px; background: var(--primary); color: #fff; border: none; border-radius: 8px; font-family: var(--font-ui); font-weight: 700; font-size: 11px; cursor: pointer; }
	.qa-awaiting { margin-top: 8px; font-size: 12px; color: var(--text-muted); font-style: italic; }
	.academy-gate-inline { background: linear-gradient(135deg, #eff6ff, #f0fdf4); border: 2px solid rgba(59,130,246,0.2); border-radius: var(--radius); padding: 24px; text-align: center; margin: 8px 0; }
	.academy-gate-inline .gate-icon { width: 48px; height: 48px; background: linear-gradient(135deg, #3b82f6, #4ade80); border-radius: 12px; margin: 0 auto 12px; display: flex; align-items: center; justify-content: center; }
	.academy-gate-inline .gate-title { font-family: var(--font-ui); font-size: 15px; font-weight: 700; color: var(--text-dark); margin-bottom: 6px; }
	.academy-gate-inline .gate-sub { font-size: 13px; color: var(--text-secondary); margin-bottom: 14px; line-height: 1.5; max-width: 420px; margin-left: auto; margin-right: auto; }
	.academy-gate-inline .gate-btn { display: inline-block; padding: 10px 24px; background: #3b82f6; color: #fff; border: none; border-radius: 8px; font-family: var(--font-ui); font-weight: 700; font-size: 13px; cursor: pointer; text-decoration: none; }
	.academy-gate-inline .gate-btn:hover { background: #2563eb; }
	.academy-gate-inline .gate-features { display: flex; gap: 16px; justify-content: center; margin-top: 14px; font-family: var(--font-ui); font-size: 11px; color: var(--text-muted); }
	.gp-insights-section { border-color: rgba(59,130,246,0.2); }
	.gp-insights-panel { border: 1px solid rgba(59,130,246,0.25); background: linear-gradient(135deg, var(--bg-card) 0%, rgba(59,130,246,0.02) 100%); }
	.gp-insights-panel .section-header { border-bottom-color: rgba(59,130,246,0.15); }
	.gp-admin-badge { font-family: var(--font-ui); font-size: 10px; font-weight: 700; padding: 2px 8px; background: rgba(59,130,246,0.1); color: #3b82f6; border-radius: 10px; margin-left: 8px; }
	.gp-loading, .gp-empty { text-align: center; padding: 20px; color: var(--text-muted); font-size: 13px; }
	.gp-funnel { display: flex; align-items: center; justify-content: center; gap: 0; margin-bottom: 20px; flex-wrap: wrap; }
	.gp-funnel-step { text-align: center; padding: 12px 16px; }
	.gp-funnel-count { font-family: var(--font-ui); font-size: 28px; font-weight: 800; color: var(--text-dark); line-height: 1; }
	.gp-funnel-label { font-family: var(--font-ui); font-size: 11px; font-weight: 600; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px; margin-top: 4px; }
	.gp-funnel-arrow { color: var(--text-muted); opacity: 0.4; }
	.gp-funnel-invested .gp-funnel-count { color: var(--primary); }
	.gp-stats-row { display: flex; gap: 20px; justify-content: center; margin-bottom: 20px; flex-wrap: wrap; }
	.gp-stat { font-family: var(--font-ui); font-size: 13px; color: var(--text-secondary); }
	.gp-stat-value { font-weight: 800; color: var(--text-dark); }
	.gp-share-card { margin-top: 20px; padding: 16px 20px; border: 1px dashed var(--primary); border-radius: 10px; background: rgba(81,190,123,0.03); }
	.gp-share-label { font-family: var(--font-ui); font-size: 13px; font-weight: 700; color: var(--primary); margin-bottom: 4px; }
	.gp-share-desc { font-family: var(--font-body); font-size: 12px; color: var(--text-secondary); margin-bottom: 12px; }
	.gp-share-row { display: flex; gap: 8px; align-items: center; }
	.gp-share-input { flex: 1; padding: 10px 14px; border: 1px solid var(--border); border-radius: 8px; font-family: var(--font-ui); font-size: 12px; color: var(--text-dark); background: var(--bg-cream); }
	.gp-share-copy { padding: 10px 20px; background: var(--primary); color: #fff; border: none; border-radius: 8px; font-family: var(--font-ui); font-weight: 700; font-size: 12px; cursor: pointer; white-space: nowrap; }
	.gp-agenda-btn { display: inline-flex; align-items: center; gap: 6px; padding: 8px 16px; background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius-sm); font-family: var(--font-ui); font-size: 12px; font-weight: 600; color: var(--text-dark); cursor: pointer; transition: all var(--transition); margin-bottom: 16px; }
	.gp-agenda-btn:hover { border-color: var(--primary); color: var(--primary); }
	.gp-agenda-btn svg { width: 14px; height: 14px; }
	.gp-agenda-panel { background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius); padding: 20px; margin-bottom: 16px; max-height: 500px; overflow-y: auto; }
	.gp-agenda-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; padding-bottom: 12px; border-bottom: 1px solid var(--border-light); }
	.gp-agenda-title { font-family: var(--font-ui); font-size: 15px; font-weight: 700; color: var(--text-dark); }
	.gp-agenda-date { font-family: var(--font-ui); font-size: 11px; color: var(--text-muted); }
	.gp-agenda-copy { display: inline-flex; align-items: center; gap: 6px; padding: 6px 14px; background: var(--primary); color: #fff; border: none; border-radius: var(--radius-sm); font-family: var(--font-ui); font-size: 12px; font-weight: 600; cursor: pointer; transition: all var(--transition); }
	.gp-agenda-copy:hover { background: var(--primary-hover); }
	.gp-agenda-copy svg { width: 14px; height: 14px; }
	.gp-agenda-section-title { font-family: var(--font-ui); font-size: 13px; font-weight: 700; color: var(--text-dark); margin-top: 16px; margin-bottom: 8px; }
	.gp-agenda-question { font-family: var(--font-body); font-size: 14px; color: var(--text-secondary); padding: 4px 0 4px 20px; position: relative; line-height: 1.6; }
	.gp-agenda-question::before { content: '\25A1'; position: absolute; left: 0; color: var(--text-muted); }
	.gp-agenda-empty { font-family: var(--font-ui); font-size: 13px; color: var(--text-muted); text-align: center; padding: 24px; }
	@media (max-width: 768px) {
		.qa-ask-form { flex-direction: column; }
		.qa-submit-btn { width: 100%; }
		.bg-sources { gap: 6px; }
		.bg-source-badge { font-size: 10px; padding: 4px 8px; }
		.gp-funnel-step { padding: 8px 10px; }
		.gp-funnel-count { font-size: 22px; }
		.gp-share-row { flex-direction: column; }
		.gp-share-copy { width: 100%; text-align: center; }
		.fit-verdict { flex-direction: column; gap: 8px; padding: 12px 16px; }
	}
	.toast-notification {
		position: fixed;
		bottom: 80px;
		left: 50%;
		transform: translateX(-50%);
		background: var(--text-dark, #1a1a2e);
		color: #fff;
		padding: 12px 24px;
		border-radius: 10px;
		font-family: var(--font-ui);
		font-size: 13px;
		font-weight: 600;
		display: flex;
		align-items: center;
		gap: 8px;
		z-index: 10000;
		box-shadow: 0 8px 32px rgba(0,0,0,0.2);
		animation: toastIn 0.25s ease, toastOut 0.25s ease 2.5s forwards;
	}
	@keyframes toastIn { from { opacity: 0; transform: translateX(-50%) translateY(20px); } to { opacity: 1; transform: translateX(-50%) translateY(0); } }
	@keyframes toastOut { from { opacity: 1; } to { opacity: 0; transform: translateX(-50%) translateY(20px); } }
	.summary-row { display: flex; gap: 12px; margin-bottom: 12px; }
	.summary-label { font-family: var(--font-ui); font-size: 13px; font-weight: 600; color: var(--text-muted); min-width: 140px; flex-shrink: 0; }
	.summary-value { font-family: var(--font-body); font-size: 14px; color: var(--text-dark); }
	.map-container { height: 340px; border-radius: var(--radius-sm); overflow: hidden; margin-top: 16px; border: 1px solid var(--border); }
	.geo-info { display: flex; gap: 32px; flex-wrap: wrap; margin-bottom: 8px; }
	.geo-label { font-family: var(--font-ui); font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.8px; color: var(--text-muted); margin-bottom: 4px; }
	.geo-value { font-family: var(--font-ui); font-size: 14px; font-weight: 600; color: var(--text-dark); }
	.action-buttons { display: flex; gap: 12px; flex-wrap: wrap; }
	.btn-action { display: inline-flex; align-items: center; gap: 8px; padding: 12px 24px; border-radius: var(--radius-sm); font-family: var(--font-ui); font-size: 14px; font-weight: 600; cursor: pointer; border: none; transition: all var(--transition); text-decoration: none; }
	.btn-action svg { width: 16px; height: 16px; }
	.btn-secondary { background: var(--bg-card); color: var(--text-dark); border: 1px solid var(--border); }
	.btn-secondary:hover { background: var(--bg-cream); border-color: var(--primary); color: var(--primary); }
	.btn-link { background: none; border: none; color: var(--primary); font-size: 13px; font-weight: 500; cursor: pointer; padding: 6px 12px; display: inline-flex; align-items: center; gap: 4px; text-decoration: underline; text-underline-offset: 2px; }
	.btn-link:hover { color: var(--text-dark); }
	.offering-status { display: inline-flex; align-items: center; gap: 6px; font-size: 13px; font-weight: 600; }
	.offering-available { color: var(--primary); }
	.offering-missing { color: var(--text-muted); }
	.returns-chart-section { margin-bottom: 24px; }
	.returns-chart-container { position: relative; height: 200px; background: linear-gradient(135deg, #0A1E21 0%, #1F5159 100%); border-radius: var(--radius); padding: 16px; }
	.returns-chart-legend { display: flex; gap: 16px; justify-content: center; padding: 10px 0 0; font-family: var(--font-ui); font-size: 11px; color: var(--text-muted); }
	.returns-chart-legend-item { display: flex; align-items: center; gap: 6px; }
	.returns-chart-legend-line { display: inline-block; width: 16px; height: 3px; border-radius: 2px; }
	.returns-chart-legend-dot { display: inline-block; width: 6px; height: 6px; border-radius: 50%; }
	.sc-toggle-bar {
		display: inline-flex;
		gap: 0;
		background: var(--bg-main, var(--bg-cream));
		border: 1px solid var(--border);
		border-radius: 8px;
		padding: 3px;
		margin-bottom: 12px;
	}
	.sc-toggle-pill {
		padding: 6px 16px;
		border: none;
		background: transparent;
		border-radius: 6px;
		font-family: var(--font-ui);
		font-size: 12px;
		font-weight: 600;
		color: var(--text-muted);
		cursor: pointer;
		transition: all 0.2s;
		white-space: nowrap;
	}
	.sc-toggle-pill:hover { color: var(--text-dark); }
	.sc-toggle-pill.active {
		background: var(--primary);
		color: #fff;
		box-shadow: 0 1px 3px rgba(81,190,123,0.3);
	}
	.doc-item-row {
		display: flex;
		gap: 8px;
	}
	.doc-view-btn {
		flex: 1;
		cursor: pointer;
		border: none;
		background: rgba(81,190,123,0.08);
		color: var(--primary);
		font-weight: 700;
	}
	.doc-view-btn:hover { background: rgba(81,190,123,0.15); }
	.doc-download-link {
		flex: 1;
	}
	@media (max-width: 768px) {
		.doc-item-row { flex-direction: column; }
	}
</style>
