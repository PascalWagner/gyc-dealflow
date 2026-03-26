<script>
	import { page } from '$app/stores';
	import { browser } from '$app/environment';
	import { onMount, tick } from 'svelte';
	import Sidebar from '$lib/components/Sidebar.svelte';
	import InvestingGeographyMap from '$lib/components/InvestingGeographyMap.svelte';
	import { getStoredSessionUser, user, isLoggedIn, isAdmin, isMember, isGP } from '$lib/stores/auth.js';
	import {
		currentAdminRealUser,
		readUserScopedJson,
		readUserScopedString,
		writeUserScopedJson,
		writeUserScopedString
	} from '$lib/utils/userScopedState.js';
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
	let ddAnswers = $state({});
	let ddAccordionOpen = $state({});
	let shareDropdownOpen = $state(false);
	let socialProof = $state(null);
	let similarDeals = $state(initialComparables?.similarDeals || []);
	let peerComparison = $state(initialComparables?.peerComparison || null);
	let peerStats = $state(null);

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
	let questions = $state([]);
	let qaLoading = $state(false);
	let qaLoaded = $state(false);
	let qaError = $state(false);
	let newQuestion = $state('');
	let qaSubmitting = $state(false);
	let gpInsights = $state(null);
	let gpInsightsLoading = $state(false);
	let gpInsightsLoaded = $state(false);
	let gpInsightsError = $state(false);
	let buyBox = $state(null);
	let deckViewed = $state(false);
	let introRequested = $state(false);
	let toastMessage = $state('');
	let toastVisible = $state(false);
	const buyBoxEditHref = '/app/plan?edit=1';

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

	// Enrichment Wizard (admin)
	let enrichmentData = $state(null);
	let showEnrichModal = $state(false);
	let enrichSaving = $state(false);
	let enrichSuccess = $state(false);
	let enrichChecked = $state({});

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
	let qaSectionVisible = $state(false);
	let bgCheckSectionVisible = $state(false);
	let gpInsightsSectionVisible = $state(false);
	let dealMapSectionVisible = $state(false);

	// Invite Co-Investors Modal
	let showInviteModal = $state(false);
	let inviteEmail = $state('');
	let inviteMessage = $state('');
	let inviteCode = $state(null);
	let inviteUrl = $state('');
	function currentSessionUser() {
		return browser ? (getStoredSessionUser() || {}) : {};
	}
	function scopedDealKey(prefix) {
		return deal?.id ? `${prefix}_${deal.id}` : prefix;
	}
	function readScopedDealJson(prefix, fallback) {
		return readUserScopedJson(scopedDealKey(prefix), fallback);
	}
	function readScopedDealString(prefix, fallback = '') {
		return readUserScopedString(scopedDealKey(prefix), fallback);
	}
	function writeScopedDealJson(prefix, value) {
		writeUserScopedJson(scopedDealKey(prefix), value);
	}
	function writeScopedDealString(prefix, value) {
		writeUserScopedString(scopedDealKey(prefix), value);
	}
	const inviteUserName = $derived(currentSessionUser().name || 'Someone');
	const inviteEmailSubject = $derived(deal ? encodeURIComponent(inviteUserName + ' shared a deal with you: ' + (deal.investmentName || deal.name || '')) : '');
	const inviteEmailBody = $derived(deal ? encodeURIComponent(inviteUserName + ' thinks you might be interested in this deal:\n\n' + (deal.investmentName || deal.name || '') + '\n\n' + inviteUrl + '\n\nView the full deal details on GYC Dealflow.') : '');
	const inviteSmsBody = $derived(deal ? encodeURIComponent(inviteUserName + ' shared a deal: ' + (deal.investmentName || deal.name || '') + ' - ' + inviteUrl) : '');

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
	const viewerManagementCompanyId = $derived($user?.managementCompany?.id || $user?.managementCompanyId || $user?.management_company_id || null);
	const viewerManagementCompanyName = $derived(($user?.managementCompany?.name || $user?.managementCompanyName || '').trim().toLowerCase());
	const dealManagementCompanyId = $derived(deal?.managementCompanyId || deal?.management_company_id || deal?.managementCompany?.id || null);
	const dealManagementCompanyName = $derived((deal?.managementCompany || deal?.managementCompanyName || deal?.managementCompany?.name || '').trim().toLowerCase());
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
	const hasMemberAccess = $derived($isAdmin || $isMember || gpOwnsDeal);
	const isPublicViewer = $derived(!$isLoggedIn);
	const isFreeViewer = $derived($isLoggedIn && !$isAdmin && !$isMember && !gpOwnsDeal);
	const isPaid = $derived(hasMemberAccess);
	const showGpInsights = $derived(($isAdmin || gpOwnsDeal) && !!deal?.managementCompany);
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

	const isCredit = $derived(deal ? isCreditFund(deal) : false);
	const heroClass = $derived(isCredit ? 'hero-lending' : 'hero-equity');

	const completenessKeys = ['investmentName','assetClass','dealType','strategy','investmentStrategy','targetIRR','preferredReturn','cashOnCash','investmentMinimum','holdPeriod','offeringType','offeringSize','distributions','lpGpSplit','fees','financials','investingGeography','instrument','deckUrl','ppmUrl','secCik','managementCompanyId','purchasePrice','status'];
	const completeness = $derived(deal ? getCompleteness(deal) : 0);

	const isStale = $derived(deal ? checkStaleness(deal) : false);

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

	// Buy Box Match
	const buyBoxChecks = $derived(deal && buyBox ? computeBuyBoxChecks(deal, buyBox) : []);
	const buyBoxScore = $derived.by(() => {
		if (buyBoxChecks.length === 0) return { matched: 0, total: 0, pct: 0 };
		const matched = buyBoxChecks.filter(c => c.match).length;
		const total = buyBoxChecks.length;
		return { matched, total, pct: Math.round((matched / total) * 100) };
	});

	// DD Checklist
	const checklist = $derived(deal ? getChecklistForDeal(deal) : null);
	const ddProgress = $derived(checklist ? calcDDProgress(checklist, ddAnswers, deal) : { answered: 0, total: 0, pct: 0 });

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
	const keyRiskItems = $derived.by(() => buildKeyRiskItems(deal, dealFit, isStale));

	function bgStatusClass(s) { return s === 'clear' ? 'bg-clear' : s === 'flagged' ? 'bg-flagged' : 'bg-pending'; }
	function bgStatusLabel(s) { return s === 'clear' ? 'Clear' : s === 'flagged' ? 'Flag' : 'Pending'; }

	function getRelativeTime(ds) { if (!ds) return ''; const d = Date.now() - new Date(ds).getTime(), m = Math.floor(d/60000); if (m<1) return 'just now'; if (m<60) return m+'m ago'; const h = Math.floor(m/60); if (h<24) return h+'h ago'; const dy = Math.floor(h/24); if (dy<30) return dy+'d ago'; return Math.floor(dy/30)+'mo ago'; }

	function loadWhenVisible(node, setVisible) {
		if (!browser || typeof IntersectionObserver === 'undefined') {
			setVisible(true);
			return { destroy() {} };
		}
		let triggered = false;
		const trigger = () => {
			if (triggered) return;
			triggered = true;
			setVisible(true);
		};
		const observer = new IntersectionObserver((entries) => {
			if (entries.some((entry) => entry.isIntersecting)) {
				observer.disconnect();
				trigger();
			}
		}, { rootMargin: '180px 0px' });
		observer.observe(node);
		return { destroy() { observer.disconnect(); } };
	}

	function setQaSectionVisible(value) {
		qaSectionVisible = value;
	}

	function setBgCheckSectionVisible(value) {
		bgCheckSectionVisible = value;
	}

	function setGpInsightsSectionVisible(value) {
		gpInsightsSectionVisible = value;
	}

	function setDealMapSectionVisible(value) {
		dealMapSectionVisible = value;
	}

	async function loadQuestions(force = false) {
		if (!deal || qaLoading || (qaLoaded && !force)) return;
		if (!hasMemberAccess) return;
		qaLoading = true;
		qaError = false;
		try {
			const r = await fetch(`/api/deal-qa?dealId=${encodeURIComponent(deal.id)}`);
			if (r.ok) {
				const d = await r.json();
				questions = d.questions || [];
			} else {
				qaError = true;
			}
		} catch {
			qaError = true;
		} finally {
			qaLoaded = true;
			qaLoading = false;
		}
	}

	async function loadBackgroundCheck(force = false) {
		if (!deal?.managementCompanyId || bgCheckLoading || (bgCheckLoaded && !force)) return;
		if (!hasMemberAccess) return;
		bgCheckLoading = true;
		bgCheckError = false;
		try {
			const headers = getStoredSessionUser()?.token ? { 'Authorization': `Bearer ${getStoredSessionUser().token}` } : {};
			const resp = await fetch(`/api/background-check?managementCompanyId=${encodeURIComponent(deal.managementCompanyId)}`, { headers });
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

	async function loadGpInsights(force = false) {
		if (!deal?.managementCompanyId || gpInsightsLoading || (gpInsightsLoaded && !force)) return;
		if (!showGpInsights) return;
		gpInsightsLoading = true;
		gpInsightsError = false;
		try {
			const headers = getStoredSessionUser()?.token ? { 'Authorization': `Bearer ${getStoredSessionUser().token}` } : {};
			const resp = await fetch(`/api/sponsor-analytics?dealId=${encodeURIComponent(deal.id)}&managementCompanyId=${encodeURIComponent(deal.managementCompanyId)}`, { headers });
			if (resp.ok) {
				gpInsights = await resp.json();
			} else {
				gpInsightsError = true;
			}
		} catch {
			gpInsightsError = true;
		} finally {
			gpInsightsLoaded = true;
			gpInsightsLoading = false;
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
		if (qaSectionVisible) void loadQuestions();
	});

	$effect(() => {
		if (bgCheckSectionVisible) void loadBackgroundCheck();
	});

	$effect(() => {
		if (gpInsightsSectionVisible) void loadGpInsights();
	});

	$effect(() => {
		if (dealMapSectionVisible) void loadDealMap();
	});

	async function submitQuestion() { if (!deal || !newQuestion.trim()) return; if (requirePublicAuth({ title: 'Create a free account', body: 'Create a free account to save this deal and start your investor profile.' })) return; if (!hasMemberAccess) { window.location.href = academyHref; return; } qaSubmitting = true; try { const stored = currentSessionUser(); const r = await fetch('/api/deal-qa', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'ask', dealId: deal.id, dealName: deal.investmentName, question: newQuestion.trim(), userEmail: stored.email || '', userName: stored.name || 'Anonymous' }) }); const d = await r.json(); if (d.success) { newQuestion = ''; await loadQuestions(); } } catch {} qaSubmitting = false; }

	async function submitAnswer(qid, text) { if (!text.trim()) return; try { const stored = currentSessionUser(); const r = await fetch('/api/deal-qa', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'answer', recordId: qid, answer: text.trim(), userName: stored.name || 'Pascal' }) }); const d = await r.json(); if (d.success) await loadQuestions(); } catch {} }

	async function upvoteQuestion(qid) {
		if (!$isLoggedIn || !browser) return;
		const up = readUserScopedJson('gycQAUpvoted', []);
		if (up.includes(qid)) return;
		up.push(qid);
		writeUserScopedJson('gycQAUpvoted', up);
		try { await fetch('/api/deal-qa', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'upvote', recordId: qid }) }); await loadQuestions(); } catch {}
	}

	function hasUpvoted(qid) { if (!browser) return false; return readUserScopedJson('gycQAUpvoted', []).includes(qid); }

	// ===== Cash Flow Projection (derived) =====
	const cfYieldRate = $derived.by(() => { if (!deal) return 0; let r = deal.preferredReturn || deal.cashOnCash || deal.targetIRR || 0; if (r > 1) r = r / 100; return r; });
	const cfInvestment = $derived(deal?.investmentMinimum || 100000);
	const cfHold = $derived.by(() => { if (!deal) return 5; let h = deal.holdPeriod || 5; if (h < 1) h = 1; if ((deal.status || '').toLowerCase() === 'evergreen') return 5; return Math.min(Math.ceil(h), 10); });
	const cfIsEvergreen = $derived(deal ? (deal.status || '').toLowerCase() === 'evergreen' : false);
	const cfRows = $derived.by(() => { const yr = cfYieldRate; if (!yr || yr <= 0) return []; const inv = cfInvestment; const yrs = cfHold; const em = deal?.equityMultiple || 0; const cr = isCredit; const ev = cfIsEvergreen; let rows = []; let td = 0; for (let y = 1; y <= yrs; y++) { let d, c = 0, n = ''; if (cr) { d = inv * yr; if (!ev && y === yrs) { c = inv; n = 'Capital returned'; } } else { if (y === 1) { d = inv * yr * 0.5; n = 'Partial year (ramp-up)'; } else { d = inv * yr; } if (y === yrs && em > 0) { const tp = inv * em; c = tp - td - d; if (c < 0) c = 0; n = 'Sale / capital event'; } else if (y === yrs && !ev) { c = inv; n = 'Capital returned'; } } td += d; rows.push({ year: y, dist: d, capReturn: c, cumDist: td, note: n }); } return rows; });
	const cfTotalCash = $derived.by(() => { const r = cfRows; if (!r.length) return 0; return r[r.length-1].cumDist + r[r.length-1].capReturn; });
	const cfAvgCoC = $derived.by(() => { const r = cfRows; const y = cfHold; const i = cfInvestment; if (!r.length||!y||!i) return 0; return (r[r.length-1].cumDist/y/i)*100; });
	const cfMaxBar = $derived.by(() => { const r = cfRows; let m = 0; for (const x of r) { const t = x.dist+x.capReturn; if (t>m) m=t; } return m||1; });
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
			if (n >= 1e3) return '$' + (n / 1e3).toFixed(0) + 'K';
			return '$' + n.toLocaleString();
		}
		if (type === 'multiple') {
			const n = typeof val === 'number' ? val : parseFloat(val);
			if (isNaN(n)) return '---';
			return n.toFixed(2) + 'x';
		}
		return String(val);
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

	function statusBadgeClass(status) {
		if (status === 'Open to invest') return 'status-open';
		if (status === 'Evergreen') return 'status-evergreen';
		return 'status-closed';
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

	// ===== Helpers =====
	function isCreditFund(d) {
		const ac = (d.assetClass || '').toLowerCase();
		const st = (d.strategy || '').toLowerCase();
		const inst = (d.instrument || '').toLowerCase();
		const name = (d.investmentName || '').toLowerCase();
		if (inst === 'debt' || st === 'lending' || ac === 'lending') return true;
		if (ac.includes('credit') || ac.includes('debt')) return true;
		if ((name.includes('debt fund') || name.includes('credit fund') || name.includes('income fund')) &&
			(st === 'lending' || inst === 'debt' || inst === 'preferred equity' || d.debtPosition)) return true;
		return false;
	}

	function getCompleteness(d) {
		let filled = 0;
		for (const k of completenessKeys) {
			const v = d[k];
			if (v !== null && v !== undefined && v !== '' && v !== 0 && !(Array.isArray(v) && v.length === 0)) filled++;
		}
		return Math.round((filled / completenessKeys.length) * 100);
	}

	function checkStaleness(d) {
		if (d.isStale) return true;
		const st = (d.status || '').toLowerCase();
		if (['closed', 'fully funded', 'completed'].includes(st)) return true;
		if (st !== 'evergreen' && d.addedDate) {
			const months = (Date.now() - new Date(d.addedDate).getTime()) / (1000 * 60 * 60 * 24 * 30.44);
			const dt = (d.dealType || '').toLowerCase();
			if (dt === 'syndication' && months > 18) return true;
			if (months > 24) return true;
		}
		return false;
	}

	function creditBadgeLabel(d) {
		const ac = (d.assetClass || '').toLowerCase();
		if (ac === 'lending') return 'LENDING';
		if (ac.includes('credit')) return 'CREDIT';
		const st = (d.strategy || '').toLowerCase();
		if (st === 'lending') return 'LENDING';
		return 'CREDIT';
	}

	function heroSummary(d) {
		if (!d.investmentStrategy) return '';
		const dot = d.investmentStrategy.indexOf('. ');
		return dot > 0 ? d.investmentStrategy.substring(0, dot + 1) : (d.investmentStrategy.length > 200 ? d.investmentStrategy.substring(0, 200) + '...' : d.investmentStrategy);
	}

	const STATE_NAME_BY_CODE = {
		AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas', CA: 'California', CO: 'Colorado',
		CT: 'Connecticut', DE: 'Delaware', FL: 'Florida', GA: 'Georgia', HI: 'Hawaii', ID: 'Idaho',
		IL: 'Illinois', IN: 'Indiana', IA: 'Iowa', KS: 'Kansas', KY: 'Kentucky', LA: 'Louisiana',
		ME: 'Maine', MD: 'Maryland', MA: 'Massachusetts', MI: 'Michigan', MN: 'Minnesota', MS: 'Mississippi',
		MO: 'Missouri', MT: 'Montana', NE: 'Nebraska', NV: 'Nevada', NH: 'New Hampshire', NJ: 'New Jersey',
		NM: 'New Mexico', NY: 'New York', NC: 'North Carolina', ND: 'North Dakota', OH: 'Ohio',
		OK: 'Oklahoma', OR: 'Oregon', PA: 'Pennsylvania', RI: 'Rhode Island', SC: 'South Carolina',
		SD: 'South Dakota', TN: 'Tennessee', TX: 'Texas', UT: 'Utah', VT: 'Vermont', VA: 'Virginia',
		WA: 'Washington', WV: 'West Virginia', WI: 'Wisconsin', WY: 'Wyoming'
	};
	const STATE_CODE_BY_NAME = Object.fromEntries(Object.entries(STATE_NAME_BY_CODE).map(([code, name]) => [name.toLowerCase(), code]));

	function normalizeStateCode(value) {
		if (!value) return null;
		const normalized = String(value).trim();
		if (STATE_NAME_BY_CODE[normalized.toUpperCase()]) return normalized.toUpperCase();
		return STATE_CODE_BY_NAME[normalized.toLowerCase()] || null;
	}

	function getDealStateCodes(d) {
		if (!d) return [];
		const matches = [];
		const addMatch = (value) => {
			const code = normalizeStateCode(value);
			if (code && !matches.includes(code)) matches.push(code);
		};
		addMatch(d.state);
		addMatch(d.regionState);
		const geography = [d.investingGeography, d.location, d.address, d.propertyAddress].filter(Boolean).join(' | ');
		for (const [code, name] of Object.entries(STATE_NAME_BY_CODE)) {
			if (new RegExp(`\\b${code}\\b`, 'i').test(geography) || new RegExp(`\\b${name}\\b`, 'i').test(geography)) {
				addMatch(code);
			}
		}
		return matches;
	}

	function buildGeographyLabel(d, states) {
		if (!d) return 'No investing geography provided yet.';
		if (states.length === 1) return `${STATE_NAME_BY_CODE[states[0]]} focus`;
		if (states.length > 1) return `${states.length} target states`;
		return d.investingGeography || d.location || 'Geography not specified';
	}

	function buildDocumentRows(d) {
		if (!d) return [];
		const rows = [];
		if (d.deckUrl && !String(d.deckUrl).includes('airtableusercontent.com')) {
			rows.push({ key: 'deck', label: 'Investment Deck', url: d.deckUrl });
		}
		if (d.ppmUrl && !String(d.ppmUrl).includes('airtableusercontent.com')) {
			rows.push({ key: 'ppm', label: 'PPM', url: d.ppmUrl });
		}
		return rows;
	}

	function buildSecFilingSummary(d) {
		if (!d) return null;
		const totalRaised = d.totalAmountSold ?? d.amountRaised ?? d.amount_raised ?? null;
		const totalInvestors = d.totalInvestors ?? d.total_investors ?? null;
		return {
			hasFiling: !!(d.secCik || totalRaised || totalInvestors || d.dateOfFirstSale),
			cik: d.secCik || null,
			totalRaised,
			totalInvestors,
			firstSaleDate: d.dateOfFirstSale || null,
			offeringType: d.offeringType || null
		};
	}

	function extractFeeValue(text, patterns) {
		const source = String(text || '');
		for (const pattern of patterns) {
			const match = source.match(pattern);
			if (match?.[1]) return match[1].trim();
		}
		return null;
	}

	function buildFeeRows(d) {
		if (!d) return [];
		const rawFees = String(d.fees || '');
		const rows = [];
		if (d.lpGpSplit) {
			rows.push({ label: 'LP / GP Split', value: String(d.lpGpSplit), verdict: 'Market-based split' });
		}
		const mgmtFee = extractFeeValue(rawFees, [/management fee[^0-9]*([\d.]+%?)/i, /asset management fee[^0-9]*([\d.]+%?)/i]);
		if (mgmtFee) rows.push({ label: 'Management Fee', value: mgmtFee, verdict: parseFloat(mgmtFee) <= 2 ? 'Investor-friendly' : 'Above benchmark' });
		const acquisitionFee = extractFeeValue(rawFees, [/acquisition fee[^0-9]*([\d.]+%?)/i]);
		if (acquisitionFee) rows.push({ label: 'Acquisition Fee', value: acquisitionFee, verdict: parseFloat(acquisitionFee) <= 2 ? 'Common range' : 'Above benchmark' });
		if (d.preferredReturn) {
			rows.push({ label: 'Preferred Return', value: fmt(d.preferredReturn, 'pct'), verdict: (d.preferredReturn > 1 ? d.preferredReturn : d.preferredReturn * 100) >= 7 ? 'Strong LP alignment' : 'Below common hurdle' });
		}
		if (rawFees && rows.length === 0) rows.push({ label: 'Fee Summary', value: rawFees, verdict: 'Benchmarking available for members' });
		return rows.slice(0, 5);
	}

	function buildOperatorTrackRecordRows(d) {
		if (!d) return [];
		const rows = [];
		if (d.managementCompany) rows.push({ label: 'Management Company', value: d.managementCompany });
		if (d.mcFoundingYear) rows.push({ label: 'Founded', value: String(d.mcFoundingYear) });
		if (d.fundAUM) rows.push({ label: 'AUM', value: fmt(d.fundAUM, 'money') });
		if (d.ceo) rows.push({ label: 'Lead Operator', value: d.ceo });
		if (d.sponsorInDeal) rows.push({ label: 'Sponsor Co-Invest', value: fmt(d.sponsorInDeal, 'pct') });
		return rows.slice(0, 5);
	}

	function buildBuyBoxLite(d) {
		if (!d) return null;
		const signals = [];
		if (d.preferredReturn) signals.push(fmt(d.preferredReturn, 'pct') + ' pref');
		if (d.cashOnCash) signals.push(fmt(d.cashOnCash, 'pct') + ' CoC');
		if (d.distributions && d.distributions !== 'Unknown') signals.push(d.distributions + ' distributions');
		const isStrong = signals.length > 0;
		return {
			label: isStrong ? 'Cash Flow Potential' : 'Cash Flow Needs Review',
			status: isStrong ? 'Aligned' : 'Needs more detail',
			description: isStrong ? signals.join(' • ') : 'Create your account to save this deal, set your preferences, and unlock a fuller Buy Box match.'
		};
	}

	function buildKeyRiskItems(d, fit, stale) {
		const items = [];
		if (stale) items.push('The deal may no longer be actively accepting new capital.');
		if (fit?.warnings?.length) items.push(...fit.warnings);
		if (!d?.managementCompanyId) items.push('Management company record is incomplete, which limits independent verification.');
		return items.slice(0, 4);
	}

	// ===== Buy Box Matching =====
	function bbFmtMoney(v) {
		const n = parseFloat(v);
		if (!n) return '---';
		if (n >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
		if (n >= 1e3) return '$' + (n / 1e3).toFixed(0) + 'K';
		return '$' + n.toLocaleString();
	}

	function computeBuyBoxChecks(d, bb) {
		const checks = [];
		if (bb.assetClasses?.length > 0) {
			checks.push({ label: 'Asset Class', match: bb.assetClasses.includes(d.assetClass), want: bb.assetClasses.join(', '), got: d.assetClass || '---' });
		}
		if (bb.checkSize) {
			checks.push({ label: 'Check Size', match: (d.investmentMinimum || 0) <= bb.checkSize, want: 'Up to ' + bbFmtMoney(bb.checkSize), got: fmt(d.investmentMinimum, 'money') });
		}
		if (bb.minIRR) {
			const bbIRR = parseFloat(bb.minIRR);
			const dealIRR = d.targetIRR || 0;
			const dealIRRpct = dealIRR <= 1 ? dealIRR * 100 : dealIRR;
			const bbIRRpct = bbIRR <= 1 ? bbIRR * 100 : bbIRR;
			checks.push({ label: 'Target Return', match: dealIRRpct >= bbIRRpct, want: bbIRRpct.toFixed(1) + '%+', got: dealIRRpct ? dealIRRpct.toFixed(1) + '%' : '---' });
		}
		if (bb.strategies?.length > 0) {
			checks.push({ label: 'Strategy', match: bb.strategies.includes(d.strategy), want: bb.strategies.join(', '), got: d.strategy || '---' });
		}
		if (bb.maxLockup) {
			const maxLock = parseFloat(bb.maxLockup);
			const holdYrs = parseFloat(d.holdPeriod) || 0;
			checks.push({ label: 'Hold Period', match: holdYrs <= maxLock, want: maxLock + ' yrs max', got: d.holdPeriod ? formatHold(d.holdPeriod) : '---' });
		}
		if (bb.distributions && d.distributions && d.distributions !== 'Unknown') {
			const distRank = { monthly: 1, quarterly: 2, 'semi-annually': 3, annually: 4 };
			const bbDR = distRank[(bb.distributions || '').toLowerCase()] || 99;
			const dealDR = distRank[(d.distributions || '').toLowerCase()] || 99;
			checks.push({ label: 'Distributions', match: dealDR <= bbDR, want: bb.distributions, got: d.distributions });
		}
		if (bb.goal || bb._branch) {
			const branch = bb._branch || bb.goal || '';
			let goalMatch = false;
			let goalGot = '';
			if (branch === 'cashflow') {
				const hasDist = d.distributions && d.distributions !== 'Unknown' && d.distributions !== 'None';
				goalMatch = !!(hasDist || (d.cashOnCash > 0) || (d.preferredReturn > 0));
				const parts = [];
				if (d.preferredReturn > 0) parts.push(fmt(d.preferredReturn, 'pct') + ' pref');
				if (d.cashOnCash > 0) parts.push(fmt(d.cashOnCash, 'pct') + ' CoC');
				if (hasDist) parts.push(d.distributions.toLowerCase() + ' dist.');
				goalGot = goalMatch ? parts.join(', ') : 'No regular income';
			} else if (branch === 'tax') {
				goalMatch = !!d.firstYrDepreciation;
				goalGot = d.firstYrDepreciation ? d.firstYrDepreciation + ' yr-1 depr.' : 'No depreciation data';
			} else if (branch === 'growth') {
				goalMatch = !!((d.equityMultiple >= 1.5) || (d.targetIRR && (d.targetIRR > 1 ? d.targetIRR : d.targetIRR * 100) >= 15));
				const gParts = [];
				if (d.equityMultiple) gParts.push(fmt(d.equityMultiple, 'multiple') + ' multiple');
				if (d.targetIRR) gParts.push(fmt(d.targetIRR, 'pct') + ' IRR');
				goalGot = gParts.length > 0 ? gParts.join(' / ') : 'No growth metrics';
			}
			const goalLabels = { cashflow: 'Income / Cash Flow', tax: 'Tax Benefits', growth: 'Growth / Appreciation' };
			checks.push({ label: 'Goal Alignment', match: goalMatch, want: goalLabels[branch] || branch, got: goalGot || '---' });
		}
		if (bb.capital90Day) {
			const cap = parseFloat(bb.capital90Day);
			if (cap && d.investmentMinimum) {
				checks.push({ label: 'Capital Fit', match: d.investmentMinimum <= cap, want: 'Up to ' + bbFmtMoney(cap) + ' (90-day)', got: fmt(d.investmentMinimum, 'money') + ' min' });
			}
		}
		return checks;
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
		const url = window.location.href;
		const subject = encodeURIComponent(`Check out this deal: ${deal.investmentName}`);
		const body = encodeURIComponent(`I found this deal on GYC Dealflow and thought you might be interested:\n\n${deal.investmentName}\n${url}\n\nYou can sign up for free to see deal details, pitch decks, and more.`);
		window.open(`mailto:?subject=${subject}&body=${body}`);
		shareDropdownOpen = false;
	}

	function shareDealText() {
		if (!deal || !browser) return;
		const url = window.location.href;
		const text = encodeURIComponent(`Check out this deal on GYC Dealflow: ${deal.investmentName} - ${url}`);
		window.open(`sms:?&body=${text}`);
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
		const userName = stored.name || stored.firstName || (stored.email ? stored.email.split('@')[0] : 'Someone');
		const baseUrl = `${window.location.origin}/deal/${deal.id}`;

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
		writeScopedDealString('gycDeckViewed', 'true');
		deckViewed = true;
	}

	function getDeckPreviewUrl(url) {
		if (!url) return null;
		// Google Drive file -> preview embed
		if (url.includes('google.com/file') || url.includes('drive.google.com')) {
			const match = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
			if (match) return `https://drive.google.com/file/d/${match[1]}/preview`;
		}
		// Dropbox -> raw content
		if (url.includes('dropbox.com')) {
			return url.replace('www.dropbox.com', 'dl.dropboxusercontent.com').replace('?dl=0', '').replace('?dl=1', '');
		}
		// Direct PDF or other URLs
		if (url.endsWith('.pdf') || url.includes('.pdf?')) {
			return url;
		}
		// Google Docs viewer fallback for other URLs
		return `https://docs.google.com/gview?url=${encodeURIComponent(url)}&embedded=true`;
	}

	function openDeckViewer() {
		if (!deal?.deckUrl) return;
		if (requirePublicAuth({ title: 'Create a free account', body: 'Create a free account to view the investment deck and track document engagement.' })) return;
		showDeckViewer = true;
		trackDeckView();
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

	const ENRICHMENT_FIELD_LABELS = {
		investmentName: 'Investment Name',
		managementCompany: 'Management Company',
		ceo: 'CEO / Managing Partner',
		assetClass: 'Asset Class',
		dealType: 'Deal Type',
		strategy: 'Strategy',
		investmentStrategy: 'Investment Strategy',
		targetIRR: 'Target IRR',
		preferredReturn: 'Preferred Return',
		cashOnCash: 'Cash-on-Cash',
		equityMultiple: 'Equity Multiple',
		investmentMinimum: 'Min Investment',
		holdPeriod: 'Hold Period',
		offeringType: 'Offering Type',
		offeringSize: 'Offering Size',
		distributions: 'Distributions',
		fees: 'Fees',
		lpGpSplit: 'LP/GP Split',
		investingGeography: 'Geography',
		sponsorCoinvest: 'Sponsor Co-Invest',
		redemption: 'Redemption Terms',
		taxForm: 'Tax Form'
	};

	function formatEnrichmentValue(key, val) {
		if (val === null || val === undefined) return '';
		if (['targetIRR', 'preferredReturn', 'cashOnCash', 'sponsorCoinvest'].includes(key)) {
			return typeof val === 'number' ? (val * 100).toFixed(1) + '%' : val;
		}
		if (key === 'equityMultiple') return typeof val === 'number' ? val.toFixed(2) + 'x' : val;
		if (['investmentMinimum', 'offeringSize', 'purchasePrice'].includes(key)) {
			return typeof val === 'number' ? '$' + val.toLocaleString() : val;
		}
		return String(val);
	}

	async function openEnrichModal() {
		if (!deal || !$isAdmin) return;
		showEnrichModal = true;
		enrichSuccess = false;
		enrichSaving = false;
		// Fetch enrichment data from the deal's deck
		try {
			const resp = await fetch(`/api/deal-extract-enrichment?dealId=${deal.id}`);
			if (resp.ok) {
				const data = await resp.json();
				enrichmentData = data.extractedData || {};
				// Initialize all fields as checked
				const checked = {};
				for (const key in enrichmentData) {
					if (enrichmentData[key] != null && ENRICHMENT_FIELD_LABELS[key]) {
						checked[key] = true;
					}
				}
				enrichChecked = checked;
			} else {
				enrichmentData = {};
			}
		} catch {
			enrichmentData = {};
		}
	}

	async function confirmEnrichment() {
		if (!deal || !enrichmentData) return;
		enrichSaving = true;
		const confirmed = {};
		for (const key in enrichChecked) {
			if (enrichChecked[key] && enrichmentData[key] != null) {
				confirmed[key] = enrichmentData[key];
			}
		}
		try {
			const stored = currentSessionUser();
			const resp = await fetch('/api/deal-confirm-enrichment', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ dealId: deal.id, confirmedData: confirmed, userEmail: stored.email || '' })
			});
			if (resp.ok) {
				enrichSuccess = true;
				// Refresh deal data
				const updated = await resp.json();
				if (updated.deal) deal = updated.deal;
			}
		} catch (err) {
			console.error('Enrichment save failed:', err);
		} finally {
			enrichSaving = false;
		}
	}

	function openClaimModal() {
		if (!deal || !browser) return;
		if (requirePublicAuth({ title: 'Create a free account', body: 'Create a free account to claim and manage your deal profile.' })) return;
		const stored = currentSessionUser();
		claimName = stored.name || '';
		claimEmail = stored.email || '';
		claimCompany = deal.managementCompany || '';
		claimRole = '';
		claimSubmitting = false;
		claimSuccess = false;
		showClaimModal = true;
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

	// ===== DD Checklist =====
	const DD_CHECKLIST_CREDIT = {
		label: 'Debt/Credit Fund Template',
		sections: [
			{ title: 'Firm Basics', questions: [
				{ q: 'What is the management company name?', autoField: 'managementCompany' },
				{ q: 'Who is the CEO or primary decision-maker?', autoField: 'ceo' },
				{ q: 'Who are the key team members beyond the CEO?' },
				{ q: 'When was the firm founded?', autoField: 'mcFoundingYear' },
				{ q: 'How many employees does the management firm have?' },
				{ q: "What is the firm's AUM (assets under management)?", autoField: 'fundAUM', format: 'money' },
				{ q: 'How many funds or vehicles have they launched to date?' },
				{ q: 'Has the manager ever lost investor capital?' },
				{ q: 'Is there a key person succession/backup plan in place?' },
				{ q: 'Are there any pending litigation issues?' }
			]},
			{ title: 'Fund Basics', questions: [
				{ q: 'What is the name of the fund?', autoField: 'investmentName' },
				{ q: 'What is the story of the fund?' },
				{ q: "What is the fund's investment strategy?", autoField: 'investmentStrategy' },
				{ q: 'When was the fund founded?' },
				{ q: 'How many investors are in the fund?' },
				{ q: 'What is the max AUM allowed inside this fund?' },
				{ q: 'What is the current AUM of this fund?', autoField: 'fundAUM', format: 'money' },
				{ q: 'What specific asset classes does the fund focus on?', autoField: 'assetClass' },
				{ q: 'How has the fund strategy shifted since inception?' },
				{ q: 'How much does the sponsor co-invest in this fund?' },
				{ q: 'What geographic markets does the fund operate in?', autoField: 'investingGeography' },
				{ q: 'How diversified is the fund by geography?' },
				{ q: 'How diversified is the fund by borrower/loan/project type?' },
				{ q: 'What percentage is concentrated in any single borrower or project?' }
			]},
			{ title: 'Fund Performance & Structure', questions: [
				{ q: 'What is the target IRR?', autoField: 'targetIRR', format: 'pct' },
				{ q: 'What is the preferred return offered?', autoField: 'preferredReturn', format: 'pct' },
				{ q: "What was the fund's return in 2024?" },
				{ q: "What was the fund's return in 2023?" },
				{ q: "What was the fund's return in 2022?" },
				{ q: 'How often are returns distributed?', autoField: 'distributions' },
				{ q: 'What is the current leverage ratio of the fund?' },
				{ q: 'What is the maximum leverage permitted by the fund documents?' },
				{ q: 'What is the fee structure (management, performance, other)?' },
				{ q: 'Is the fund open-ended or closed-ended?' },
				{ q: 'Has the fund experienced any capital calls or pauses in distributions?' }
			]},
			{ title: 'Loan Details', questions: [
				{ q: 'How are loans underwritten -- what credit criteria are used?' },
				{ q: 'Who on the sponsor team handles acquisitions?' },
				{ q: 'What are the typical borrower profiles?' },
				{ q: 'Are the loans senior secured, mezzanine, or unsecured?', autoField: 'debtPosition' },
				{ q: 'How many loans are currently in the portfolio?', autoField: 'loanCount' },
				{ q: 'What is the average loan size?' },
				{ q: 'What is the average loan term?' },
				{ q: 'Are the loans secured and/or personally guaranteed?' },
				{ q: 'How is downside risk mitigated (personal guarantees, collateral, etc.)?' },
				{ q: 'What happens if the loan defaults or goes into foreclosure?' },
				{ q: 'What is the historical default rate?' },
				{ q: 'What is the average loan-to-value (LTV)?', autoField: 'avgLoanLTV', format: 'pct' },
				{ q: 'What is the maximum LTV allowed in the PPM?' },
				{ q: 'What is the typical interest rate charged to borrowers?' },
				{ q: 'Who services the loans?' },
				{ q: 'What percent of your borrowers are repeat?' }
			]},
			{ title: 'Investor Experience', questions: [
				{ q: 'What accreditation status is required?', autoField: 'availableTo' },
				{ q: 'What is the minimum investment?', autoField: 'investmentMinimum', format: 'money' },
				{ q: 'What is the lock-up period?', autoField: 'holdPeriod', format: 'years' },
				{ q: 'What is the redemption policy & cadence?' },
				{ q: 'Does the fund issue K-1s or 1099s?' },
				{ q: 'Are investor earnings taxed as ordinary income, capital gains, or something else?' },
				{ q: 'Is the fund subject to UBIT in a self-directed IRA?' },
				{ q: 'Is there a compounding or DRIP option available?' },
				{ q: 'How frequent are updates provided from management?' },
				{ q: 'Were tax forms sent before April 1st last year?' },
				{ q: 'Are financials audited by a third-party CPA?', autoField: 'financials' },
				{ q: 'What fund administration tools or platforms are used?' },
				{ q: 'How regularly do you update & provide access to a loan tape & fund financials?' }
			]},
			{ title: 'External Due Diligence (LP Led)', questions: [
				{ q: 'Do we have a strong relationship with the sponsor?' },
				{ q: 'Were you initially referred to this sponsor from someone you know, like, trust?' },
				{ q: 'Do you know investors that have invested with this operator in the past with positive results?' },
				{ q: 'Does Google search show any negative/positive publicity in past 12 months?' },
				{ q: 'Does the sponsor have an InvestClearly profile and are all reviews positive?' },
				{ q: 'Is the sponsor active on LinkedIn or other professional platforms?' },
				{ q: 'What do WE believe the biggest risks in the deal are?' }
			]}
		]
	};

	const DD_CHECKLIST_SYNDICATION = {
		label: 'Multi-Family Syndication Template',
		sections: [
			{ title: 'Executive Summary', questions: [
				{ q: 'What is the name of the deal?', autoField: 'investmentName' },
				{ q: 'Minimum Investment', autoField: 'investmentMinimum', format: 'money' },
				{ q: 'Target Hold', autoField: 'holdPeriod', format: 'years' },
				{ q: 'Target IRR', autoField: 'targetIRR', format: 'pct' },
				{ q: 'Target Cash-on-Cash Return', autoField: 'cashOnCash', format: 'pct' },
				{ q: 'Is there a preferred return?', autoField: 'preferredReturn', format: 'pct' },
				{ q: 'Target Equity Multiple', autoField: 'equityMultiple', format: 'multiple' },
				{ q: 'Is this a 506B or 506C?', autoField: 'offeringType' },
				{ q: 'Target Equity Raise', autoField: 'offeringSize', format: 'money' },
				{ q: 'Basic business plan summary', autoField: 'investmentStrategy' }
			]},
			{ title: 'Firm Basics', questions: [
				{ q: 'What is the management company name?', autoField: 'managementCompany' },
				{ q: 'When was the firm founded?', autoField: 'mcFoundingYear' },
				{ q: 'Who is the CEO or primary decision-maker?', autoField: 'ceo' },
				{ q: "What is the firm's AUM?", autoField: 'fundAUM', format: 'money' },
				{ q: 'How many units does the firm currently have under management?' },
				{ q: 'How many deals has the sponsor acquired?' },
				{ q: 'How many deals have gone full-cycle?' },
				{ q: 'What is the average IRR of full-cycle deals?' },
				{ q: 'What is the average Equity Multiple of full-cycle deals?' },
				{ q: 'How many employees does the management firm have?' },
				{ q: 'Do we have a strong relationship with the sponsor?' },
				{ q: 'Were you initially referred to this sponsor from someone you know, like, trust?' },
				{ q: 'Do you know investors that have invested with this operator in the past?' },
				{ q: 'Does Google search show any negative/positive publicity?' },
				{ q: 'Does the sponsor have any negative/positive reviews on InvestClearly?' }
			]},
			{ title: 'Deal Basics', questions: [
				{ q: 'What is the address of the property?', autoField: 'address' },
				{ q: 'Number of units' },
				{ q: 'When was the property built?' },
				{ q: 'What is the class of the property?' },
				{ q: 'What is the current occupancy?' },
				{ q: 'How does the sponsor plan to grow NOI?' },
				{ q: '% of non-renovated units (value-add potential)' },
				{ q: 'Avg Rating & Reviews of the property' },
				{ q: 'What is the going-in cap rate?' },
				{ q: 'What is the assumed cap rate at sale?' },
				{ q: 'What is the loan size?' },
				{ q: 'Is the interest rate fixed or variable?' },
				{ q: 'What is the interest rate?' },
				{ q: 'What is the combined LTC or LTV?' },
				{ q: 'What is the loan term?' }
			]},
			{ title: 'Deal Fees & Economics', questions: [
				{ q: 'What is the LP / GP profit split?', autoField: 'lpGpSplit' },
				{ q: "What is the sponsor's acquisition fee?" },
				{ q: "What is the sponsor's annual Asset Management Fee?" },
				{ q: "What is the sponsor's transaction fee for refi or disposition?" },
				{ q: "What is the sponsor's construction management fee?" },
				{ q: 'What is the property management fee?' },
				{ q: 'Is the sponsor charging a marketing, admin, or other fee?' }
			]},
			{ title: 'Deal Details (Asked on Intro Call)', questions: [
				{ q: 'Can you describe your due diligence process to acquire this property?' },
				{ q: 'What major systems will need to be replaced during hold period?' },
				{ q: 'Will onsite staff be retained or new staff brought in?' },
				{ q: 'Will property management be in-house or 3rd party?' },
				{ q: 'What are the annual rent growth assumptions for the 1st 5 years?' },
				{ q: 'What are the annual expense growth assumptions?' },
				{ q: 'What % of the equity raise is set aside as reserves?' },
				{ q: 'What cashflow should I expect in the 1st year?' },
				{ q: 'How much depreciation should I expect in year 1 and 2?', autoField: 'firstYrDepreciation' },
				{ q: 'Is the target IRR dependent on a refinance?' },
				{ q: 'What do you believe the biggest risks in the deal are?' }
			]},
			{ title: 'Management Firm Deep Dive', questions: [
				{ q: 'Has the firm ever paused distributions?' },
				{ q: 'Has the firm ever issued a capital call?' },
				{ q: 'Has the firm ever lost investor capital?' },
				{ q: 'What % of your investors are repeat investors?' },
				{ q: 'What date did you get your K-1s out over the last 2 years?' },
				{ q: 'Who would take over management if the CEO passed away?' },
				{ q: 'How much is the firm or the CEO investing in this deal?', autoField: 'sponsorInDeal', format: 'pct' },
				{ q: 'How frequent do you expect to send out email updates?' },
				{ q: 'Have you or are you currently in any litigation?' }
			]},
			{ title: 'Post-Research Questions', questions: [
				{ q: 'What do WE believe the biggest risks in the deal are?' },
				{ q: 'Do we believe the sponsor wealthy enough to save the deal if things go wrong?' }
			]}
		]
	};

	function getChecklistForDeal(d) {
		return isCreditFund(d) ? DD_CHECKLIST_CREDIT : DD_CHECKLIST_SYNDICATION;
	}

	function getAutoValue(d, field, format) {
		if (!field) return null;
		const val = d[field];
		if (val === undefined || val === null || val === '' || val === 0) return null;
		if (format === 'pct') return fmt(val, 'pct');
		if (format === 'money') return fmt(val, 'money');
		if (format === 'multiple') return fmt(val, 'multiple');
		if (format === 'years') return formatHold(val);
		return String(val);
	}

	function calcDDProgress(cl, answers, d) {
		let total = 0, answered = 0;
		for (let si = 0; si < cl.sections.length; si++) {
			for (let qi = 0; qi < cl.sections[si].questions.length; qi++) {
				total++;
				const q = cl.sections[si].questions[qi];
				const key = `s${si}q${qi}`;
				const autoVal = q.autoField ? getAutoValue(d, q.autoField, q.format) : null;
				if (autoVal || answers[key]) answered++;
			}
		}
		return { answered, total, pct: total > 0 ? Math.round((answered / total) * 100) : 0 };
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

	function saveDDAnswer(key, value) {
		if (!deal) return;
		const updated = { ...ddAnswers };
		if (value) {
			updated[key] = value;
		} else {
			delete updated[key];
		}
		ddAnswers = updated;
		if (browser) {
			writeScopedDealJson('gycDDChecklist', updated);
		}
		// Sync to backend
		try {
			const stored = currentSessionUser();
			if (stored?.token) {
				fetch('/api/ddchecklist', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${stored.token}` },
					body: JSON.stringify({ dealId: deal.id, itemIndex: key, checked: !!value, answer: value || '', source: 'user' })
				}).catch(() => {});
			}
		} catch {}
	}

	function toggleAccordion(sectionIdx) {
		ddAccordionOpen = { ...ddAccordionOpen, [sectionIdx]: !ddAccordionOpen[sectionIdx] };
	}

	function requestIntroduction() {
		if (!deal) return;
		if (requirePublicAuth({ title: 'Create a free account', body: 'Create a free account to request an introduction to the sponsor.' })) return;
		// Check if already requested
		if (browser && readScopedDealString('gycIntroRequested')) {
			showShareToast("You've already requested an intro for this deal.");
			return;
		}
		// Rate limit: 3 intros per day
		if (browser) {
			const todayKey = 'gycIntroCount_' + new Date().toISOString().split('T')[0];
			const todayCount = parseInt(readUserScopedString(todayKey, '0'), 10);
			if (todayCount >= 3) {
				showShareToast("You've reached the daily limit of 3 introduction requests. Try again tomorrow.");
				return;
			}
		}
		introMessage = '';
		introSending = false;
		introSuccess = false;
		showIntroModal = true;
	}

	async function submitIntroRequest() {
		if (!deal || introSending) return;
		introSending = true;
		try {
			const stored = currentSessionUser();
			const sponsors = deal.sponsors || [];
			const op = sponsors.find(s => s.role === 'operator');
			const opName = op ? op.name : (deal.managementCompany || '');
			const opCeo = op ? (op.ceo || '') : (deal.ceo || '');

			const r = await fetch('/api/intro-request', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${stored.token || ''}` },
				body: JSON.stringify({
					dealId: deal.id,
					dealName: deal.investmentName,
					operatorName: opName,
					operatorCeo: opCeo,
					managementCompanyId: deal.managementCompanyId || '',
					message: introMessage
				})
			});
			const data = await r.json();
			if (data.success) {
				// Store in scoped browser state for dedup
				if (browser) {
					writeScopedDealString('gycIntroRequested', Date.now().toString());
					const todayKey = 'gycIntroCount_' + new Date().toISOString().split('T')[0];
					writeUserScopedString(todayKey, (parseInt(readUserScopedString(todayKey, '0'), 10) + 1).toString());
					// Store in gycIntroRequests array
					try {
						let intros = readUserScopedJson('gycIntroRequests', []);
						if (!Array.isArray(intros)) intros = [];
						intros.push({ dealId: deal.id, deal: deal.investmentName, company: opName, userEmail: stored.email || '', timestamp: Date.now() });
						writeUserScopedJson('gycIntroRequests', intros);
					} catch {}
				}
				introRequested = true;
				introSuccess = true;
				// Advance stage to Connect
				if (currentStageIdx < 2) {
					dealStages.setStage(deal.id, 'connect');
				}
			} else {
				showShareToast('Something went wrong. Please try again.');
			}
		} catch {
			showShareToast('Something went wrong. Please try again.');
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
		const d = deal;
		const stored = currentSessionUser();
		const bb = buyBox || {};
		const rpU = (stored.name || stored.firstName || 'Investor').split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
		const rpD = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
		function rF(v, t) { if (v == null || v === '' || v === '---') return '\u2014'; if (t === 'pct') { const n = typeof v === 'number' ? v : parseFloat(v); if (isNaN(n)) return '\u2014'; return (n > 1 ? n : n * 100).toFixed(1) + '%'; } if (t === 'money') { const n = typeof v === 'string' ? parseFloat(v.replace(/[$,]/g, '')) : v; if (isNaN(n)) return '\u2014'; if (n >= 1e9) return '$' + (n/1e9).toFixed(1) + 'B'; if (n >= 1e6) return '$' + (n/1e6).toFixed(1) + 'M'; if (n >= 1e3) return '$' + Math.round(n).toLocaleString(); return '$' + n.toLocaleString(); } if (t === 'multiple') { const n = typeof v === 'number' ? v : parseFloat(v); if (isNaN(n)) return '\u2014'; return n.toFixed(2) + 'x'; } return String(v); }
		const gL = { passive_income:'Cash Flow', reduce_taxes:'Tax Optimization', build_wealth:'Equity Growth', cashflow:'Cash Flow', tax:'Tax Optimization', growth:'Equity Growth' };
		let h = '';
		h += '<div class="rs"><h2>1. My Investment Criteria</h2><table class="rt"><tbody>';
		h += '<tr><td class="l">Investment Goal</td><td>' + (gL[bb._branch]||gL[bb.goal]||'\u2014') + '</td></tr>';
		h += '<tr><td class="l">Asset Classes</td><td>' + ((bb.assetClasses||[]).join(', ')||'\u2014') + '</td></tr>';
		h += '<tr><td class="l">Strategies</td><td>' + ((bb.strategies||[]).join(', ')||'\u2014') + '</td></tr>';
		h += '<tr><td class="l">Check Size</td><td>' + (bb.checkSize?rF(bb.checkSize,'money'):'\u2014') + '</td></tr>';
		h += '<tr><td class="l">Max Lockup</td><td>' + (bb.maxLockup?bb.maxLockup+' years':'\u2014') + '</td></tr>';
		h += '<tr><td class="l">Distribution Pref</td><td>' + (bb.distributions||'\u2014') + '</td></tr>';
		h += '</tbody></table></div>';
		const rpSp = d.sponsors||[]; const rpOp = rpSp.find(s => s.role==='operator')||null;
		const rpOpN = rpOp?(rpOp.name||rpOp.company||''):(d.managementCompany||d.sponsor||'\u2014');
		h += '<div class="rs"><h2>2. Deal Overview</h2><table class="rt"><tbody>';
		h += '<tr><td class="l">Deal Name</td><td>' + (d.investmentName||d.name||'\u2014') + '</td></tr>';
		h += '<tr><td class="l">Operator</td><td>' + rpOpN + '</td></tr>';
		h += '<tr><td class="l">Asset Class</td><td>' + (d.assetClass||'\u2014') + '</td></tr>';
		h += '<tr><td class="l">Deal Type</td><td>' + (d.dealType||'\u2014') + '</td></tr>';
		h += '<tr><td class="l">Strategy</td><td>' + (d.strategy||'\u2014') + '</td></tr>';
		h += '<tr><td class="l">Target IRR</td><td>' + (d.targetIRR?rF(d.targetIRR,'pct'):'\u2014') + '</td></tr>';
		h += '<tr><td class="l">Pref Return</td><td>' + (d.preferredReturn?rF(d.preferredReturn,'pct'):'\u2014') + '</td></tr>';
		h += '<tr><td class="l">Cash-on-Cash</td><td>' + (d.cashOnCash?rF(d.cashOnCash,'pct'):'\u2014') + '</td></tr>';
		h += '<tr><td class="l">Equity Multiple</td><td>' + (d.equityMultiple?rF(d.equityMultiple,'multiple'):'\u2014') + '</td></tr>';
		h += '<tr><td class="l">Hold Period</td><td>' + (d.holdPeriod?d.holdPeriod+' Years':'\u2014') + '</td></tr>';
		h += '<tr><td class="l">Offering Size</td><td>' + (d.offeringSize?rF(d.offeringSize,'money'):'\u2014') + '</td></tr>';
		h += '<tr><td class="l">Min Investment</td><td>' + (d.investmentMinimum?rF(d.investmentMinimum,'money'):'\u2014') + '</td></tr>';
		h += '<tr><td class="l">Distributions</td><td>' + (d.distributions||'\u2014') + '</td></tr>';
		h += '<tr><td class="l">Debt Position</td><td>' + (d.debtPosition||'\u2014') + '</td></tr>';
		h += '<tr><td class="l">Offering Type</td><td>' + (d.offeringType||'\u2014') + '</td></tr>';
		h += '</tbody></table></div>';
		const bbCh = buyBoxChecks;
		if (bbCh.length > 0) {
			const mc = bbCh.filter(c=>c.match).length;
			h += '<div class="rs"><h2>3. Buy Box Alignment <span class="mb">' + mc + '/' + bbCh.length + ' match</span></h2><table class="rt"><tbody>';
			bbCh.forEach(c => { const ic = c.match?'<span class="cy">\u2713</span>':'<span class="cn">\u2717</span>'; h += '<tr><td style="width:24px;text-align:center;">'+ic+'</td><td class="l">'+c.label+'</td><td>'+(c.got||'\u2014')+(c.want?' (want: '+c.want+')':'')+'</td></tr>'; });
			h += '</tbody></table></div>';
		} else { h += '<div class="rs"><h2>3. Buy Box Alignment</h2><p class="mu">Set up your Buy Box to see alignment.</p></div>'; }
		const rpFit = dealFit;
		h += '<div class="rs"><h2>4. Deal Fit Analysis</h2>';
		if (rpFit) {
			h += '<p style="font-weight:700;color:'+rpFit.verdictColor+';margin-bottom:8px;">'+rpFit.verdict+' (score: '+(rpFit.score>=0?'+':'')+rpFit.score+')</p>';
			if (rpFit.fits.length) { h += '<p style="font-weight:600;margin-bottom:4px;color:#16a34a;">Strengths</p><ul class="rl">'; rpFit.fits.forEach(f => { h += '<li>'+f+'</li>'; }); h += '</ul>'; }
			if (rpFit.warnings.length) { h += '<p style="font-weight:600;margin:8px 0 4px;color:#dc2626;">Concerns</p><ul class="rl">'; rpFit.warnings.forEach(w => { h += '<li>'+w+'</li>'; }); h += '</ul>'; }
		} else { h += '<p class="mu">Insufficient data to analyze deal fit.</p>'; }
		h += '</div>';
		h += '<div class="rs"><h2>5. Fee Structure</h2>';
		if (d.fees) { h += '<p>' + String(d.fees).replace(/\n/g,'<br>') + '</p>'; } else { h += '<p class="mu">Fee data not available for this deal.</p>'; }
		h += '</div>';
		const rpCfR = cfRows;
		h += '<div class="rs"><h2>6. Projected Cash Flow</h2>';
		if (rpCfR.length > 0) {
			const inv = cfInvestment;
			h += '<p class="mu" style="margin-bottom:8px;">Based on '+rF(inv,'money')+' invested at '+rF(cfYieldRate,'pct')+' '+(isCredit?'yield':'pref return')+' over '+cfHold+' years</p>';
			h += '<table class="rt cf"><thead><tr><th>Year</th><th>Distributions</th><th>Capital Return</th><th>Cumulative</th><th>Note</th></tr></thead><tbody>';
			rpCfR.forEach(r => { h += '<tr><td>Year '+r.year+'</td><td>'+rF(r.dist,'money')+'</td><td>'+(r.capReturn>0?rF(r.capReturn,'money'):'\u2014')+'</td><td>'+rF(r.cumDist,'money')+'</td><td>'+(r.note||'')+'</td></tr>'; });
			h += '</tbody></table><p style="margin-top:8px;font-size:13px;"><strong>Total Cash Returned:</strong> '+rF(cfTotalCash,'money')+' &nbsp; <strong>Avg Cash-on-Cash:</strong> '+cfAvgCoC.toFixed(1)+'%</p>';
		} else { h += '<p class="mu">Projected cash flow data not available.</p>'; }
		h += '</div>';
		h += '<div class="rs"><h2>7. Background Check Summary</h2>';
		if (bgCheck) {
			const bg = bgCheck;
			const sLabel = bg.overallStatus==='clear'?'Clear':bg.overallStatus==='flagged'?'Flagged':'Pending';
			const sCol = bg.overallStatus==='clear'?'#16a34a':bg.overallStatus==='flagged'?'#dc2626':'#f59e0b';
			h += '<p style="margin-bottom:8px;"><strong>Overall Status:</strong> <span style="color:'+sCol+';font-weight:700;">'+sLabel+'</span></p>';
			const bgI = [{label:'SEC Registration',val:bg.secRegistration},{label:'Legal / Litigation',val:bg.legalHistory},{label:'Regulatory',val:bg.regulatoryHistory},{label:'Bankruptcy',val:bg.bankruptcy}];
			h += '<table class="rt"><tbody>';
			bgI.forEach(c => { if (c.val != null) { const s = typeof c.val==='string'?c.val:(c.val?.status||'pending'); const col = s==='clear'?'#16a34a':s==='flagged'?'#dc2626':'#f59e0b'; h += '<tr><td class="l">'+c.label+'</td><td style="color:'+col+';font-weight:600;">'+s.charAt(0).toUpperCase()+s.slice(1)+'</td></tr>'; } });
			h += '</tbody></table>';
			if (bg.notes) h += '<p style="margin-top:8px;font-size:12px;color:#666;">'+bg.notes+'</p>';
		} else { h += '<p class="mu">Background check data not available.</p>'; }
		h += '</div>';
		if (!isCredit && stResults) {
			const st = stResults;
			h += '<div class="rs"><h2>8. Stress Test Scenario</h2>';
			h += '<p class="mu" style="margin-bottom:8px;">Rent Growth: '+stRentGrowth+'% | Exit Cap: '+stExitCap+'% | Vacancy: '+stVacancy+'% | Interest: '+stInterest+'% | Hold: '+stHold+' yrs</p>';
			h += '<table class="rt"><tbody>';
			h += '<tr><td class="l">Projected IRR</td><td>'+(st.irr*100).toFixed(1)+'%</td></tr>';
			h += '<tr><td class="l">Equity Multiple</td><td>'+st.em.toFixed(2)+'x</td></tr>';
			h += '<tr><td class="l">Avg Annual Cash Flow</td><td>'+rF(st.annualCF,'money')+'</td></tr>';
			h += '<tr><td class="l">Total Distributions</td><td>'+rF(st.totalDist,'money')+'</td></tr>';
			h += '<tr><td class="l">Sale Proceeds</td><td>'+rF(st.saleProceeds,'money')+'</td></tr>';
			h += '<tr><td class="l">Total Return</td><td>'+rF(st.totalReturn,'money')+'</td></tr>';
			h += '</tbody></table></div>';
		}
		const css = '*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; } body { font-family: "Source Sans 3", "Source Sans Pro", -apple-system, sans-serif; color: #1a1a1a; line-height: 1.5; padding: 40px; max-width: 800px; margin: 0 auto; } .rh { text-align: center; margin-bottom: 40px; padding-bottom: 24px; border-bottom: 2px solid #51be7b; } .rh h1 { font-family: "DM Serif Display", Georgia, serif; font-size: 28px; font-weight: 400; margin-bottom: 4px; } .rh .dn { font-size: 18px; color: #51be7b; font-weight: 600; margin-bottom: 8px; } .rh .mt { font-size: 12px; color: #888; } .rh .br { font-size: 11px; color: #aaa; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 12px; } .rs { margin-bottom: 28px; page-break-inside: avoid; } .rs h2 { font-family: -apple-system, "Segoe UI", sans-serif; font-size: 14px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: #1a1a1a; margin-bottom: 12px; padding-bottom: 6px; border-bottom: 1px solid #e5e5e5; } .mb { font-size: 12px; font-weight: 700; color: #51be7b; text-transform: none; letter-spacing: 0; margin-left: 8px; } .rt { width: 100%; border-collapse: collapse; font-size: 13px; } .rt td, .rt th { padding: 6px 12px; text-align: left; border-bottom: 1px solid #f0f0f0; } .rt .l { color: #666; font-weight: 500; width: 40%; } .rt th { font-weight: 700; font-size: 11px; text-transform: uppercase; letter-spacing: 0.3px; color: #888; border-bottom: 2px solid #e5e5e5; } .cf td:not(:first-child), .cf th:not(:first-child) { text-align: right; } .cy { color: #51be7b; font-weight: 700; font-size: 16px; } .cn { color: #d04040; font-weight: 700; font-size: 16px; } .rl { padding-left: 20px; font-size: 13px; } .rl li { margin-bottom: 4px; } .mu { color: #888; font-size: 12px; } .rf { text-align: center; margin-top: 40px; padding-top: 16px; border-top: 1px solid #e5e5e5; font-size: 11px; color: #aaa; } @media print { body { padding: 20px; } .no-print { display: none !important; } @page { margin: 0.75in; } }';
		const full = '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Investment Report \u2014 '+(d.investmentName||d.name||'Deal')+'</title><style>'+css+'</style></head><body>'
			+ '<div class="rh"><div class="br">Grow Your Cashflow</div><h1>Investment Report</h1><div class="dn">'+(d.investmentName||d.name||'Deal')+'</div><div class="mt">Prepared for '+rpU+' &middot; '+rpD+'</div></div>'
			+ h
			+ '<div class="rf">Generated by GYC Dealflow &middot; growyourcashflow.io</div>'
			+ '<div class="no-print" style="text-align:center;margin-top:24px;"><button onclick="window.print()" style="padding:12px 32px;background:#51be7b;color:#fff;border:none;border-radius:8px;font-size:14px;font-weight:700;cursor:pointer;">Save as PDF</button></div>'
			+ '</body></html>';
		const rw = window.open('', '_blank');
		if (rw) { rw.document.write(full); rw.document.close(); setTimeout(() => { rw.print(); }, 500); }
		else { alert('Please allow popups to generate your investment report.'); }
	}

	// ===== Lifecycle =====
	onMount(async () => {
		const storedUser = currentSessionUser();
		const token = storedUser.token || '';
		const userEmail = storedUser.email || '';
		const headers = token ? { 'Authorization': `Bearer ${token}` } : {};

		if (!deal && token && dealId) {
			try {
				const resp = await fetch(`/api/deals?id=${encodeURIComponent(dealId)}`, { headers });
				if (resp.ok) {
					const data = await resp.json();
					if (data?.deal) {
						deal = data.deal;
						error = null;
						loading = false;
					}
				}
			} catch {}
		}

		if (!deal) return;
		// Load DD answers from scoped browser state
		try {
			const stored = readScopedDealJson('gycDDChecklist', {});
			ddAnswers = stored;
		} catch { ddAnswers = {}; }

		// Load social proof
		fetch(`/api/deal-stats?dealId=${encodeURIComponent(deal.id)}`, { headers })
			.then(r => r.ok ? r.json() : null)
			.then(stats => { if (stats) socialProof = stats; })
			.catch(() => {});

		// Load deck-viewed and intro-requested state
		deckViewed = !!readScopedDealString('gycDeckViewed');
		introRequested = !!readScopedDealString('gycIntroRequested');

		// Auto-select first share class (sorted by highest min investment) on initial load
		if (deal.shareClasses && deal.shareClasses.length > 0) {
			let bestIdx = 0, bestMin = 0;
			for (let i = 0; i < deal.shareClasses.length; i++) {
				if ((deal.shareClasses[i].investmentMinimum || 0) > bestMin) {
					bestMin = deal.shareClasses[i].investmentMinimum || 0;
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
					if (nextBuyBox && Object.keys(nextBuyBox).length > 0) buyBox = nextBuyBox;
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
							<div class="deal-company">by <a href="/sponsor?company={encodeURIComponent(deal.managementCompany || '')}">{deal.managementCompany || 'Unknown'}</a></div>

							<!-- Badges -->
							<div class="deal-badges">
								{#if isCredit}
									<span class="deal-badge asset-class">{creditBadgeLabel(deal)}</span>
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
									{#if deal.fundAUM}<div class="hero-metric"><div class="hero-metric-value">{fmt(deal.fundAUM, 'money')}</div><div class="hero-metric-label">Fund AUM</div></div>{/if}
								{:else}
									{#if deal.targetIRR}<div class="hero-metric"><div class="hero-metric-value highlight">{fmt(deal.targetIRR, 'pct')}</div><div class="hero-metric-label">Target IRR</div></div>{/if}
									{#if deal.equityMultiple}<div class="hero-metric"><div class="hero-metric-value">{fmt(deal.equityMultiple, 'multiple')}</div><div class="hero-metric-label">Equity Multiple</div></div>{/if}
									{#if deal.preferredReturn}<div class="hero-metric"><div class="hero-metric-value">{fmt(deal.preferredReturn, 'pct')}</div><div class="hero-metric-label">Pref Return</div></div>{/if}
									{#if deal.investmentMinimum}<div class="hero-metric"><div class="hero-metric-value">{fmt(deal.investmentMinimum, 'money')}</div><div class="hero-metric-label">Min Investment</div></div>{/if}
									{#if deal.holdPeriod}<div class="hero-metric"><div class="hero-metric-value">{formatHold(deal.holdPeriod)}</div><div class="hero-metric-label">Hold Period</div></div>{/if}
								{/if}
							</div>

							<!-- Strategy Summary -->
							{#if deal.investmentStrategy}
								<div class="hero-summary">{heroSummary(deal)}</div>
							{/if}

							<!-- Operated by -->
							{#if deal.managementCompany}
								<div class="hero-operator-line">
									<span class="hero-operator-label">Operated by</span>
									<a href="/sponsor?company={encodeURIComponent(deal.managementCompany)}" class="hero-operator-link">
										<span class="hero-operator-avatar">{getInitials(deal.managementCompany)}</span>
										{deal.managementCompany}
										{#if deal.mcFoundingYear}
											<span class="hero-operator-years">&middot; {new Date().getFullYear() - deal.mcFoundingYear}+ yrs</span>
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
											{#each Array(Math.min(total, 5)) as _, i}
												<div class="sp-avatar" style="background:{['#51BE7B','#3b82f6','#f59e0b','#ec4899','#8b5cf6'][i % 5]}">LP</div>
											{/each}
											{#if total > 5}
												<div class="sp-avatar sp-count">+{total - 5}</div>
											{/if}
										</div>
										<div class="sp-text">
											<strong>{total}</strong>
											<span class="sp-dim">GYC member{total !== 1 ? 's are' : ' is'} active on this deal</span>
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
								<div class="share-wrapper">
									<button class="hero-share-btn" onclick={(e) => { e.stopPropagation(); shareDropdownOpen = !shareDropdownOpen; }}>
										<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
										Share
									</button>
									{#if shareDropdownOpen}
										<div
											class="share-dropdown active"
											role="menu"
											tabindex="-1"
											aria-label="Share deal options"
											onclick={(e) => e.stopPropagation()}
											onkeydown={(e) => {
												if (e.key === 'Escape') shareDropdownOpen = false;
												e.stopPropagation();
											}}
										>
											<button class="share-dropdown-item share-invite" onclick={openInviteModal}>
												<svg viewBox="0 0 24 24" fill="none" stroke="var(--primary)" stroke-width="2" width="16" height="16"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/></svg>
												<span class="share-invite-text">Invite a co-investor</span>
											</button>
											<button class="share-dropdown-item" onclick={copyDealLink}>
												<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
												Copy link
											</button>
											<button class="share-dropdown-item" onclick={shareDealEmail}>
												<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
												Email to a friend
											</button>
											<button class="share-dropdown-item" onclick={shareDealText}>
												<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
												Text message
											</button>
										</div>
									{/if}
								</div>
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
					{#each stages as stage, i}
						{#if i > 0}
							<div class="journey-connector" class:done={currentStageIdx >= i}></div>
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
					<div class="journey-connector" class:done={currentStage === 'skipped'}></div>
					<button class="journey-step journey-step-skip" class:active={currentStage === 'skipped'} class:skipped={currentStage === 'skipped'} onclick={skipDeal}>
						<div class="step-dot">
							{#if currentStage === 'skipped'}
								<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" width="14" height="14"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
							{:else}
								6
							{/if}
						</div>
						Skipped
					</button>
				</div>

				<!-- ==================== BUY BOX MATCH ==================== -->
				<div class="buybox-card" class:buybox-lite-card={!hasMemberAccess}>
					<div class="buybox-header">
						<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={hasMemberAccess && buyBoxChecks.length > 0 ? (buyBoxScore.pct >= 80 ? '#4ade80' : buyBoxScore.pct >= 50 ? '#fbbf24' : '#f87171') : '#51BE7B'} stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
						<span class="buybox-title">Buy Box Match</span>
						{#if hasMemberAccess && buyBoxChecks.length > 0}
							{@const score = buyBoxScore}
							{@const matchColor = score.pct >= 80 ? '#4ade80' : score.pct >= 50 ? '#fbbf24' : '#f87171'}
							{@const matchLabel = score.pct >= 80 ? 'Strong Match' : score.pct >= 50 ? 'Partial Match' : 'Low Match'}
							<span class="buybox-badge" style="background:{matchColor}18;color:{matchColor}">{matchLabel}</span>
							<span class="buybox-score" style="color:{matchColor}">{score.matched}/{score.total}</span>
							<div class="buybox-progress">
								<div class="buybox-progress-fill" style="width:{score.pct}%;background:{matchColor}"></div>
							</div>
							<button class="buybox-edit" onclick={openBuyBoxAction}>Edit Buy Box &rarr;</button>
						{:else}
							<span class="buybox-badge buybox-badge-lite">{isPublicViewer ? 'Create your Buy Box' : 'Cash Flow Lite'}</span>
						{/if}
					</div>
					{#if hasMemberAccess && buyBoxChecks.length > 0}
						{@const bbCols = buyBoxChecks.length <= 3 ? buyBoxChecks.length : (buyBoxChecks.length % 4 === 0 || buyBoxChecks.length >= 8 ? 4 : buyBoxChecks.length % 3 === 0 ? 3 : buyBoxChecks.length <= 4 ? 2 : buyBoxChecks.length <= 6 ? 3 : 4)}
						<div class="buybox-criteria-grid" style="grid-template-columns:repeat({bbCols}, 1fr)">
							{#each buyBoxChecks as check}
								<button class="buybox-criterion" class:match={check.match} class:miss={!check.match} onclick={openBuyBoxAction}>
									<div class="buybox-criterion-icon">
										{#if check.match}
											<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#4ade80" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>
										{:else}
											<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#f87171" stroke-width="3"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
										{/if}
									</div>
									<div class="buybox-criterion-content">
										<div class="buybox-criterion-label" style="color:{check.match ? '#4ade80' : '#f87171'}">{check.label}</div>
										<div class="buybox-criterion-detail">You want <strong>{check.want}</strong></div>
										<div class="buybox-criterion-got">Deal: {check.got}</div>
									</div>
								</button>
							{/each}
						</div>
					{:else}
						<div class="buybox-lite-grid">
							<div class="buybox-lite-card-shell">
								<div class="buybox-lite-label">{buyBoxLite?.label || 'Cash Flow Potential'}</div>
								<div class="buybox-lite-status">{buyBoxLite?.status || 'Create your Buy Box'}</div>
								<div class="buybox-lite-description">
									{#if isPublicViewer}
										Create a free account to save deals, start your Buy Box, and unlock a fuller match view.
									{:else}
										{buyBoxLite?.description || 'Start with a cash-flow-focused fit, then unlock the full multi-factor match as a member.'}
									{/if}
								</div>
							</div>
							<div class="buybox-lite-card-shell locked">
								<div class="buybox-lite-label">Full Match</div>
								<div class="buybox-lite-status">Member</div>
								<div class="buybox-lite-description">Asset class, target return, hold period, check size, and strategy fit unlock for members.</div>
							</div>
						</div>
						<div class="buybox-lite-actions">
							<button class="buybox-edit" onclick={openBuyBoxAction}>
								{isPublicViewer ? 'Create Free Account' : hasMemberAccess ? 'Edit Buy Box' : 'Become a Member'}
							</button>
						</div>
					{/if}
				</div>

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
								{#if isCredit}
									<div class="detail-item"><div class="detail-label">Pref Return</div><div class="detail-value">{fmt(displayPrefReturn, 'pct')}</div></div>
								{:else}
									<div class="detail-item"><div class="detail-label">Cash-on-Cash</div><div class="detail-value">{fmt(displayCashOnCash, 'pct')}</div></div>
								{/if}
								<div class="detail-item"><div class="detail-label">Min Investment</div><div class="detail-value">{fmt(displayMinInvestment, 'money')}</div></div>
								<div class="detail-item"><div class="detail-label">Lockup</div><div class="detail-value">{formatHold(deal.holdPeriod)}</div></div>
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
								{#if deal.debtPosition}
									<div class="detail-item"><div class="detail-label">Debt Position</div><div class="detail-value">{deal.debtPosition}</div></div>
								{/if}
								{#if deal.fundAUM}
									<div class="detail-item"><div class="detail-label">Fund AUM</div><div class="detail-value">{fmt(deal.fundAUM, 'money')}</div></div>
								{/if}
								{#if deal.financials}
									<div class="detail-item detail-item-wide"><div class="detail-label">Financials</div><div class="detail-value">{deal.financials}</div></div>
								{/if}
							</div>
						</div>
					</div>

					<!-- Right column: Who's Behind the Deal + Documents -->
					<div>
						<!-- Who's Behind the Deal -->
						{#if deal.managementCompany}
							<div class="section">
								<div class="section-header">
									<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
									<span class="section-title">Who’s Behind the Deal</span>
								</div>
								<div class="section-body">
									<div class="operator-card-content">
										<div class="operator-avatar">{getInitials(deal.managementCompany)}</div>
										<div class="operator-info">
											<a href="/sponsor?company={encodeURIComponent(deal.managementCompany)}" class="operator-name">{deal.managementCompany}</a>
											{#if deal.ceo}<div class="operator-ceo">{deal.ceo}</div>{/if}
											{#if deal.mcFoundingYear}<div class="operator-meta">Founded {deal.mcFoundingYear}</div>{/if}
										</div>
									</div>
									<div class="rail-fact-list">
										{#if deal.ceo}
											<div class="rail-fact"><span>Lead</span><strong>{deal.ceo}</strong></div>
										{/if}
										{#if deal.mcFoundingYear}
											<div class="rail-fact"><span>Track Record</span><strong>{new Date().getFullYear() - deal.mcFoundingYear}+ years</strong></div>
										{/if}
										{#if deal.fundAUM}
											<div class="rail-fact"><span>AUM</span><strong>{fmt(deal.fundAUM, 'money')}</strong></div>
										{/if}
									</div>
									<a href="/sponsor?company={encodeURIComponent(deal.managementCompany)}" class="operator-link">View Sponsor Profile &rarr;</a>
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
								{#if $isAdmin && deal.deckUrl}
									<button class="doc-item doc-enrich-btn" onclick={openEnrichModal}>
										<svg viewBox="0 0 24 24" fill="none" stroke="#3b82f6" stroke-width="2" width="16" height="16"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
										Enrich from Deck
									</button>
								{/if}
							</div>
						</div>
					</div>
				</div>

				<div class="canonical-lower-flow">
					<div class="section geography-section flow-order-10">
						<div class="section-header">
							<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
							<span class="section-title">Investing Geography</span>
						</div>
						<div class="section-body geography-body">
							<InvestingGeographyMap {deal} />
						</div>
					</div>

					<div class="section flow-order-20">
						<div class="section-header">
							<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
							<span class="section-title">SEC Filing</span>
						</div>
						<div class="section-body">
							{#if secFiling?.hasFiling}
								<div class="metric-grid metric-grid-three">
									<div class="metric-pill">
										<div class="metric-pill-label">Offering Type</div>
										<div class="metric-pill-value">{secFiling.offeringType || 'Form D filing'}</div>
									</div>
									<div class="metric-pill">
										<div class="metric-pill-label">Capital Raised</div>
										<div class="metric-pill-value">{secFiling.totalRaised ? fmt(secFiling.totalRaised, 'money') : 'Not disclosed'}</div>
									</div>
									<div class="metric-pill">
										<div class="metric-pill-label">Investors</div>
										<div class="metric-pill-value">{secFiling.totalInvestors || 'Not disclosed'}</div>
									</div>
								</div>
								<div class="sec-footer-row">
									<div class="sec-footnote">
										{#if secFiling.firstSaleDate}
											First sale reported {new Date(secFiling.firstSaleDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}.
										{:else}
											Structured from the sponsor’s SEC Form D footprint when available.
										{/if}
									</div>
									{#if secFiling.cik}
										<a href={"https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=" + encodeURIComponent(secFiling.cik) + "&type=D&dateb=&owner=include&count=40"} target="_blank" rel="noopener" class="operator-link">View on SEC EDGAR &rarr;</a>
									{/if}
								</div>
							{:else}
								<div class="empty-state-card">
									<div class="empty-state-title">No SEC Form D match found</div>
									<div class="empty-state-copy">We could not verify a filing from the structured deal record yet.</div>
								</div>
							{/if}
						</div>
					</div>

					<div class="section flow-order-30">
						<div class="section-header">
							<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><path d="M12 1v22"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
							<span class="section-title">Fees &amp; Compensation</span>
						</div>
						<div class="section-body">
							{#if isPublicViewer}
								<div class="locked-preview-shell">
									<div class="locked-preview-row"><span>Management Fee</span><strong>Member Preview</strong></div>
									<div class="locked-preview-row"><span>Preferred Return</span><strong>Member Preview</strong></div>
									<div class="locked-preview-row"><span>LP / GP Split</span><strong>Member Preview</strong></div>
								</div>
								<div class="locked-preview-footer">
									<div>
										<div class="locked-preview-title">See the structured fee schedule</div>
										<div class="locked-preview-copy">Create a free account to track deals. Become a member to unlock fee benchmarking.</div>
									</div>
									<button class="buybox-edit" onclick={() => openAuthModal({ title: 'Create a free account', body: 'Create a free account to save deals and review fee schedules.' })}>Create Free Account</button>
								</div>
							{:else}
								{#if feeRows.length > 0}
									<div class="fee-table">
										{#each feeRows as row}
											<div class="fee-row">
												<div class="fee-copy">
													<div class="fee-label">{row.label}</div>
													<div class="fee-value">{row.value}</div>
												</div>
												{#if hasMemberAccess}
													<span class="fee-verdict">{row.verdict}</span>
												{:else}
													<span class="fee-verdict fee-verdict-muted">Raw sponsor fee row</span>
												{/if}
											</div>
										{/each}
									</div>
								{:else}
									<div class="empty-state-card">
										<div class="empty-state-title">Fee schedule not available</div>
										<div class="empty-state-copy">We have not structured the fee rows for this deal yet.</div>
									</div>
								{/if}
							{/if}
						</div>
					</div>

					<div class="section flow-order-40">
						<div class="section-header">
							<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
							<span class="section-title">Operator Track Record</span>
						</div>
						<div class="section-body">
							{#if !hasMemberAccess}
								<div class="locked-preview-shell">
									<div class="locked-preview-row"><span>Management company history</span><strong>Locked</strong></div>
									<div class="locked-preview-row"><span>Experience and scale</span><strong>Locked</strong></div>
									<div class="locked-preview-row"><span>Operating context</span><strong>Locked</strong></div>
								</div>
								<div class="locked-preview-footer">
									<div>
										<div class="locked-preview-title">Unlock operator history</div>
										<div class="locked-preview-copy">This is part of the member diligence layer.</div>
									</div>
									{#if !nativeCompanionMode}
										<a href={academyHref} class="gate-cta">Become a Member</a>
									{:else}
										<div class="native-helper-copy">Available to members on web</div>
									{/if}
								</div>
							{:else if operatorTrackRecordRows.length > 0}
								<div class="rail-fact-list rail-fact-list-wide">
									{#each operatorTrackRecordRows as row}
										<div class="rail-fact"><span>{row.label}</span><strong>{row.value}</strong></div>
									{/each}
								</div>
							{:else}
								<div class="empty-state-card">
									<div class="empty-state-title">Track record not structured yet</div>
									<div class="empty-state-copy">We’ll keep the section visible and fill it as operator history is added.</div>
								</div>
							{/if}
						</div>
					</div>

				<!-- ==================== DD CHECKLIST ==================== -->
				{#if checklist}
					<div class="section flow-order-100">
						<div class="section-header">
							<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
							<span class="section-title">Deal Research Checklist</span>
							<div class="dd-progress-ring">
								<svg width="36" height="36" viewBox="0 0 80 80">
									<circle cx="40" cy="40" r="35" fill="none" stroke="var(--border)" stroke-width="6"/>
									<circle cx="40" cy="40" r="35" fill="none"
										stroke={ddProgress.pct < 33 ? '#f87171' : ddProgress.pct < 66 ? '#fbbf24' : '#4ade80'}
										stroke-width="6"
										stroke-dasharray="{(ddProgress.pct / 100) * 251.2} 251.2"
										stroke-dashoffset="0"
										transform="rotate(-90 40 40)"
										stroke-linecap="round"/>
									<text x="40" y="44" text-anchor="middle" font-size="18" font-weight="700"
										fill={ddProgress.pct < 33 ? '#f87171' : ddProgress.pct < 66 ? '#fbbf24' : '#4ade80'}
										font-family="var(--font-ui)">{ddProgress.pct}%</text>
								</svg>
							</div>
						</div>
						<div class="section-body dd-section-body">
							{#if !isPaid}
								<!-- Gate overlay for free users -->
								<div class="gate-overlay">
									<div class="gate-content">
										<div class="gate-icon">
											<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
										</div>
										<div class="gate-title">{nativeCompanionMode ? 'Available to members on web' : 'Become a Member'}</div>
										<div class="gate-text">
											{#if nativeCompanionMode}
												The {checklist.sections.length}-section interactive due diligence checklist remains available to existing members in their web account.
											{:else}
												Members get a {checklist.sections.length}-section interactive DD checklist with auto-filled answers for every deal.
											{/if}
										</div>
										{#if !nativeCompanionMode}
											<a href={academyHref} class="gate-cta">Become a Member</a>
										{/if}
									</div>
								</div>
							{/if}
							<div class="dd-checklist-subtitle">{checklist.label} &middot; {checklist.sections.length} sections</div>
							<div class="dd-accordion" class:blurred={!isPaid}>
								{#each checklist.sections as sec, si}
									<div class="dd-accordion-section">
										<button class="dd-accordion-header" onclick={() => toggleAccordion(si)}>
											<div class="dd-accordion-title">
												<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14" class="chevron" class:open={ddAccordionOpen[si]}><polyline points="9 18 15 12 9 6"/></svg>
												{sec.title}
											</div>
											<span class="dd-accordion-progress">
												{#each sec.questions as q, qi}
													{@const key = `s${si}q${qi}`}
													{@const autoVal = q.autoField ? getAutoValue(deal, q.autoField, q.format) : null}
													{@const isAnswered = !!(autoVal || ddAnswers[key])}
												{/each}
												{sec.questions.filter((q, qi) => {
													const key = `s${si}q${qi}`;
													return !!(q.autoField ? getAutoValue(deal, q.autoField, q.format) : null) || ddAnswers[key];
												}).length}/{sec.questions.length}
											</span>
										</button>
										{#if ddAccordionOpen[si]}
											<div class="dd-accordion-body">
												{#each sec.questions as q, qi}
													{@const key = `s${si}q${qi}`}
													{@const autoVal = q.autoField ? getAutoValue(deal, q.autoField, q.format) : null}
													{@const userVal = ddAnswers[key] || ''}
													<div class="dd-question" class:answered={!!autoVal || !!userVal}>
														<div class="dd-question-text">{q.q}</div>
														{#if autoVal}
															<div class="dd-answer">
																<div class="dd-answer-icon auto">
																	<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
																</div>
																<div class="dd-answer-text">{autoVal}</div>
																<span class="dd-answer-badge auto">auto</span>
															</div>
														{:else if userVal}
															<div class="dd-answer">
																<div class="dd-answer-icon user">
																	<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
																</div>
																<div class="dd-answer-text">{userVal}</div>
																<span class="dd-answer-badge user">you</span>
															</div>
														{:else}
															<div class="dd-answer">
																<div class="dd-answer-icon empty">
																	<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><circle cx="12" cy="12" r="10"/></svg>
																</div>
																<input class="dd-answer-input" type="text" placeholder="Add your research..."
																	onblur={(e) => saveDDAnswer(key, e.target.value)} />
															</div>
														{/if}
													</div>
												{/each}
											</div>
										{/if}
									</div>
								{/each}
							</div>
						</div>
					</div>
				{/if}

				<!-- ==================== PROJECTED LP CASH FLOW ==================== -->
				{#if cfRows.length > 0}
					<div class="section flow-order-50">
						<div class="section-header">
							<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><path d="M12 1v22"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
							<span class="section-title">Projected LP Cash Flow</span>
						</div>
						<div class="section-body" style="position:relative;min-height:120px;">
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
									Based on {fmt(cfInvestment, 'money')} invested at {fmt(cfYieldRate, 'pct')} {isCredit ? 'yield' : 'pref return'} over {cfHold}{cfIsEvergreen ? '+ years' : ' years'}. Projections are illustrative only.
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
													<th>Year</th><th>Capital</th><th>Distributions</th><th>% CoC</th><th>Total Cash</th><th>Cumulative</th><th>Notes</th>
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
														<td class="cf-note">{row.note || ''}</td>
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
													<td>{#if deal.targetIRR}<div class="cf-summary-value green">{fmt(deal.targetIRR, 'pct')}</div><div class="cf-summary-label">Target IRR</div>{/if}</td>
													<td></td>
												</tr>
											</tfoot>
										</table>
									</div>
								{/if}
							</div>
						</div>
					</div>
				{/if}

				<!-- ==================== KEY RISKS ==================== -->
				<div class="section flow-order-70">
					<div class="section-header">
						<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
						<span class="section-title">Key Risks</span>
					</div>
					<div class="section-body">
						{#if !hasMemberAccess}
							<div class="locked-preview-shell">
								<div class="locked-preview-row"><span>Operational risk review</span><strong>Locked</strong></div>
								<div class="locked-preview-row"><span>Deal structure concerns</span><strong>Locked</strong></div>
								<div class="locked-preview-row"><span>Execution watchouts</span><strong>Locked</strong></div>
							</div>
							<div class="locked-preview-footer">
								<div>
									<div class="locked-preview-title">Unlock risk analysis</div>
									<div class="locked-preview-copy">Members get the platform-added diligence layer, not just the structured deck facts.</div>
								</div>
								{#if !nativeCompanionMode}
									<a href={academyHref} class="gate-cta">Become a Member</a>
								{:else}
									<div class="native-helper-copy">Available to members on web</div>
								{/if}
							</div>
						{:else if keyRiskItems.length > 0}
							<div class="fit-list-section">
								{#each keyRiskItems as item}
									<div class="fit-list-item">
										<svg viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="2.5" width="16" height="16"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
										<span>{item}</span>
									</div>
								{/each}
							</div>
						{:else}
							<div class="empty-state-card">
								<div class="empty-state-title">No key risks structured yet</div>
								<div class="empty-state-copy">This section stays visible even when the diligence notes have not been completed.</div>
							</div>
						{/if}
					</div>
				</div>

				<!-- ==================== STRESS TEST CALCULATOR ==================== -->
				{#if deal && !isCredit}
					<div class="section flow-order-110">
						<div class="section-header">
							<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><path d="M12 20V10"/><path d="M18 20V4"/><path d="M6 20v-4"/></svg>
							<span class="section-title">Stress Test Calculator</span>
						</div>
						<div class="section-body" style="position:relative;min-height:120px;">
							{#if !isPaid}
								<div class="gate-overlay">
									<div class="gate-content">
										<div class="gate-icon">
											<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
										</div>
										<div class="gate-title">{nativeCompanionMode ? 'Available to members on web' : 'Become a Member'}</div>
										<div class="gate-text">
											{#if nativeCompanionMode}
												Scenario modeling for rent growth, cap rates, vacancy, and interest rates remains available to existing members on the web.
											{:else}
												Model bear, base, and bull scenarios with adjustable rent growth, cap rates, vacancy, and interest rates.
											{/if}
										</div>
										{#if !nativeCompanionMode}
											<a href={academyHref} class="gate-cta">Become a Member</a>
										{/if}
									</div>
								</div>
							{/if}
							<div class:blurred={!isPaid}>
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
						</div>
					</div>
				{/if}

				<!-- ==================== SIMILAR DEALS ==================== -->
				{#if similarDeals.length > 0 || !hasMemberAccess}
					<div class="section flow-order-60">
						<div class="section-header">
							<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><path d="M18 20V10"/><path d="M12 20V4"/><path d="M6 20v-6"/></svg>
							<span class="section-title">Similar Deals</span>
							<span class="peer-count-label">{similarDeals.length} comparable {isCredit ? 'Lending' : (deal.assetClass || '')} deals</span>
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
								<div class="similar-table-wrap ly-table-scroll ly-desktop-only">
								<table class="similar-table">
									<thead>
										<tr>
											<th class="sim-th left">Deal Name</th>
											<th class="sim-th">Target IRR</th>
											<th class="sim-th">Pref Return</th>
											<th class="sim-th">Eq Multiple</th>
											<th class="sim-th">Minimum</th>
											<th class="sim-th">Hold Period</th>
										</tr>
									</thead>
									<tbody>
										<tr class="sim-current-row">
											<td class="sim-td left">
												<div class="sim-deal-name current">{deal.investmentName}</div>
												<div class="sim-deal-company">{deal.managementCompany || ''}</div>
												<span class="sim-badge current">THIS DEAL</span>
											</td>
											<td class="sim-td">{deal.targetIRR ? fmt(deal.targetIRR, 'pct') : '---'}</td>
											<td class="sim-td">{deal.preferredReturn ? fmt(deal.preferredReturn, 'pct') : '---'}</td>
											<td class="sim-td">{deal.equityMultiple ? fmt(deal.equityMultiple, 'multiple') : '---'}</td>
											<td class="sim-td">{deal.investmentMinimum ? fmt(deal.investmentMinimum, 'money') : '---'}</td>
											<td class="sim-td">{deal.holdPeriod ? deal.holdPeriod + ' Yrs' : '---'}</td>
										</tr>
										{#each similarDeals as sd}
											<tr class="sim-peer-row">
												<td class="sim-td left">
													<a href="/deal/{sd.id}" class="sim-deal-link">{sd.investmentName}</a>
													<div class="sim-deal-company">{sd.managementCompany || ''}</div>
												</td>
												<td class="sim-td">{sd.targetIRR ? fmt(sd.targetIRR, 'pct') : '---'}</td>
												<td class="sim-td">{sd.preferredReturn ? fmt(sd.preferredReturn, 'pct') : '---'}</td>
												<td class="sim-td">{sd.equityMultiple ? fmt(sd.equityMultiple, 'multiple') : '---'}</td>
												<td class="sim-td">{sd.investmentMinimum ? fmt(sd.investmentMinimum, 'money') : '---'}</td>
												<td class="sim-td">{sd.holdPeriod ? sd.holdPeriod + ' Yrs' : '---'}</td>
											</tr>
										{/each}
									</tbody>
								</table>
							</div>
							<div class="similar-mobile-list ly-mobile-only">
								<article class="similar-mobile-card current">
									<div class="similar-mobile-header">
										<div class="similar-mobile-copy">
											<div class="sim-deal-name current">{deal.investmentName}</div>
											<div class="sim-deal-company">{deal.managementCompany || ''}</div>
											<span class="sim-badge current">THIS DEAL</span>
										</div>
									</div>
									<div class="similar-mobile-primary">
										<div class="similar-mobile-stat">
											<span class="similar-mobile-stat-label">Target IRR</span>
											<strong class="similar-mobile-stat-value">{deal.targetIRR ? fmt(deal.targetIRR, 'pct') : '---'}</strong>
										</div>
										<div class="similar-mobile-stat">
											<span class="similar-mobile-stat-label">Minimum</span>
											<strong class="similar-mobile-stat-value">{deal.investmentMinimum ? fmt(deal.investmentMinimum, 'money') : '---'}</strong>
										</div>
										<div class="similar-mobile-stat">
											<span class="similar-mobile-stat-label">Hold</span>
											<strong class="similar-mobile-stat-value">{deal.holdPeriod ? deal.holdPeriod + ' Yrs' : '---'}</strong>
										</div>
									</div>
									<details class="similar-mobile-details">
										<summary>More metrics</summary>
										<div class="similar-mobile-secondary">
											<div class="similar-mobile-detail"><span>Pref Return</span><strong>{deal.preferredReturn ? fmt(deal.preferredReturn, 'pct') : '---'}</strong></div>
											<div class="similar-mobile-detail"><span>Eq Multiple</span><strong>{deal.equityMultiple ? fmt(deal.equityMultiple, 'multiple') : '---'}</strong></div>
										</div>
									</details>
								</article>
								{#each similarDeals as sd}
									<article class="similar-mobile-card">
										<div class="similar-mobile-header">
											<div class="similar-mobile-copy">
												<a href="/deal/{sd.id}" class="sim-deal-link">{sd.investmentName}</a>
												<div class="sim-deal-company">{sd.managementCompany || ''}</div>
											</div>
										</div>
										<div class="similar-mobile-primary">
											<div class="similar-mobile-stat">
												<span class="similar-mobile-stat-label">Target IRR</span>
												<strong class="similar-mobile-stat-value">{sd.targetIRR ? fmt(sd.targetIRR, 'pct') : '---'}</strong>
											</div>
											<div class="similar-mobile-stat">
												<span class="similar-mobile-stat-label">Minimum</span>
												<strong class="similar-mobile-stat-value">{sd.investmentMinimum ? fmt(sd.investmentMinimum, 'money') : '---'}</strong>
											</div>
											<div class="similar-mobile-stat">
												<span class="similar-mobile-stat-label">Hold</span>
												<strong class="similar-mobile-stat-value">{sd.holdPeriod ? sd.holdPeriod + ' Yrs' : '---'}</strong>
											</div>
										</div>
										<details class="similar-mobile-details">
											<summary>More metrics</summary>
											<div class="similar-mobile-secondary">
												<div class="similar-mobile-detail"><span>Pref Return</span><strong>{sd.preferredReturn ? fmt(sd.preferredReturn, 'pct') : '---'}</strong></div>
												<div class="similar-mobile-detail"><span>Eq Multiple</span><strong>{sd.equityMultiple ? fmt(sd.equityMultiple, 'multiple') : '---'}</strong></div>
											</div>
										</details>
									</article>
								{/each}
							</div>
							</div>
						</div>
					</div>
				{/if}

				<!-- ==================== DEAL FIT SUMMARY ==================== -->
				{#if dealFit || !hasMemberAccess}
					<div class="section flow-order-80">
						<div class="section-header">
							<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="18" height="18"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
							<span class="section-title">Deal Fit Summary</span>
						</div>
						<div class="section-body deal-fit-body" class:gated={!isPaid && !$isAdmin}>
							{#if !isPaid && !$isAdmin}
								<div class="gate-overlay">
									<div class="gate-content">
										<div class="gate-icon">
											<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
										</div>
										<div class="gate-title">{nativeCompanionMode ? 'Available to members on web' : 'Become a Member'}</div>
										<div class="gate-text">
											{#if nativeCompanionMode}
												Deal fit scoring against common investor benchmarks remains available to existing members on the web.
											{:else}
												See how this deal matches common investor benchmarks.
											{/if}
										</div>
										{#if !nativeCompanionMode}
											<a href={academyHref} class="gate-cta">Become a Member</a>
										{/if}
									</div>
								</div>
							{/if}
							<div class:blurred={!isPaid && !$isAdmin}>
								<div class="fit-verdict" style="--verdict-color:{fitSummary.verdictColor}">
									<div class="fit-verdict-icon">
										{#if fitSummary.score >= 3}
											<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="20" height="20"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
										{:else if fitSummary.score >= -1}
											<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="20" height="20"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
										{:else}
											<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="20" height="20"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
										{/if}
									</div>
									<div>
										<div class="fit-verdict-text">{fitSummary.verdict}</div>
										<div class="fit-verdict-sub">Based on deal metrics and standard LP benchmarks</div>
									</div>
								</div>
								{#if fitSummary.fits.length > 0}
									<div class="fit-list-section">
										<div class="fit-list-label fit-label-good">What Works</div>
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
										<div class="fit-list-label fit-label-warn">Watch Out For</div>
										{#each fitSummary.warnings as item}
											<div class="fit-list-item">
												<svg viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="2.5" width="16" height="16"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
												<span>{item}</span>
											</div>
										{/each}
									</div>
								{/if}
							</div>
						</div>
					</div>
				{/if}

				<!-- ==================== BACKGROUND CHECK ==================== -->
				{#if deal.managementCompanyId}
					<div class="section flow-order-90" use:loadWhenVisible={setBgCheckSectionVisible}>
						<div class="section-header"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="18" height="18"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg><span class="section-title">Sponsor Background Report</span>{#if bgCheck}<span class="bg-status-badge {bgStatusClass(bgCheck.overall_status)}">{bgStatusLabel(bgCheck.overall_status)}</span>{/if}</div>
						<div class="section-body bg-check-body" class:gated={!isPaid && !$isAdmin}>
							{#if !isPaid && !$isAdmin}
								<div class="gate-overlay">
									<div class="gate-content">
										<div class="gate-icon">
											<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
										</div>
										<div class="gate-title">{nativeCompanionMode ? 'Available to members on web' : 'Become a Member'}</div>
										<div class="gate-text">
											{#if nativeCompanionMode}
												SEC EDGAR, FINRA, IAPD, and OFAC screening remains available to existing members on the web.
											{:else}
												Members get SEC EDGAR, FINRA, IAPD, and OFAC screening.
											{/if}
										</div>
										{#if !nativeCompanionMode}
											<a href={academyHref} class="gate-cta">Become a Member</a>
										{/if}
									</div>
								</div>
							{/if}
							<div class:blurred={!isPaid && !$isAdmin}>
								{#if !bgCheckLoaded && !bgCheckLoading}
									<div class="bg-empty"><div class="bg-empty-text">Background check loads when you scroll here.</div></div>
								{:else if bgCheckLoading}
									<div class="bg-loading">Loading background check data...</div>
								{:else if bgCheckError}
									<div class="bg-empty">
										<div class="bg-empty-text">Couldn’t load background check.</div>
										<button class="bg-run-cta" onclick={() => loadBackgroundCheck(true)}>Try Again</button>
									</div>
								{:else if bgCheck}{@const sources = [{ label: 'SEC EDGAR', status: bgCheck.sec_status, detail: `${bgCheck.sec_filings_count || 0} filing(s)`, url: bgCheck.sec_url },{ label: 'FINRA BrokerCheck', status: bgCheck.finra_status, detail: bgCheck.finra_found ? (bgCheck.finra_disclosures > 0 ? `${bgCheck.finra_disclosures} disclosure(s)` : 'No disclosures') : 'Not registered', url: 'https://brokercheck.finra.org/' },{ label: 'IAPD', status: bgCheck.iapd_status, detail: bgCheck.iapd_found ? (bgCheck.iapd_disclosures > 0 ? `${bgCheck.iapd_disclosures} disclosure(s)` : 'Clean') : 'Not found', url: 'https://adviserinfo.sec.gov/' },{ label: 'OFAC', status: bgCheck.ofac_status, detail: bgCheck.ofac_found ? 'Match found' : 'Clear', url: 'https://sanctionssearch.ofac.treas.gov/' },{ label: 'Courts', status: bgCheck.court_status, detail: `${bgCheck.court_cases_count || 0} case(s)`, url: null }]}<div class="bg-sources">{#each sources as src}<div class="bg-source-badge {bgStatusClass(src.status)}"><span class="bg-source-label">{src.label}</span><span class="bg-source-detail">{src.detail}</span>{#if src.url}<a href={src.url} target="_blank" rel="noopener" class="bg-source-link" title="Verify externally"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="12" height="12"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg></a>{/if}</div>{/each}</div>{#if bgCheck.flags && bgCheck.flags.length > 0}<div class="bg-flags">{#each bgCheck.flags as flag}<div class="bg-flag-item"><strong>{flag.source}:</strong> {flag.message}</div>{/each}</div>{/if}<div class="bg-footer"><a href="/sponsor?company={encodeURIComponent(deal.managementCompany || '')}#bgReportSection" class="bg-full-report">View Full Report &rarr;</a>{#if bgCheck.run_at}<span class="bg-run-date">Checked: {new Date(bgCheck.run_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>{/if}</div>{:else}<div class="bg-empty"><div class="bg-empty-text">No background check has been run yet.</div><a href="/sponsor?company={encodeURIComponent(deal.managementCompany || '')}#bgReportSection" class="bg-run-cta"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>Run Background Check</a></div>{/if}
							</div>
						</div>
					</div>
				{/if}

				<!-- ==================== INVESTOR Q&A ==================== -->
				<div class="section flow-order-120" use:loadWhenVisible={setQaSectionVisible}>
					<div class="section-header"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg><span class="section-title">Investor Q&A</span>{#if questions.length > 0}<span class="qa-count">{questions.length}</span>{/if}</div>
					<div class="section-body" style="position:relative;min-height:120px;">
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
											Investor Q&A is fully member-only, but the section stays visible here so the page contract is preserved.
										{/if}
									</div>
									{#if !nativeCompanionMode}
										<a href={academyHref} class="gate-cta">Become a Member</a>
									{/if}
								</div>
							</div>
						{/if}
						<div class:blurred={!hasMemberAccess}>
						<div class="qa-ask-form"><textarea class="qa-input" placeholder="Ask a question about this deal..." rows="2" bind:value={newQuestion} onkeydown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submitQuestion(); } }}></textarea><button class="qa-submit-btn" onclick={submitQuestion} disabled={qaSubmitting || !newQuestion.trim()}>{qaSubmitting ? 'Submitting...' : 'Ask Question'}</button></div>
						{#if !qaLoaded && !qaLoading}
							<div class="qa-empty qa-empty-deferred">Questions load when this section comes into view.</div>
						{:else if qaLoading}
							<div class="qa-loading">Loading questions...</div>
						{:else if qaError}
							<div class="qa-empty">
								Couldn't load questions.
								<div style="margin-top:10px;">
									<button class="qa-submit-btn" onclick={() => loadQuestions(true)}>Try Again</button>
								</div>
							</div>
						{:else if questions.length === 0}
							<div class="qa-empty">No questions yet. Be the first to ask!</div>
						{:else}
							<div class="qa-list">{#each questions as q}<div class="qa-item"><div class="qa-vote-col"><button class="qa-upvote-btn" class:upvoted={hasUpvoted(q.id)} onclick={() => upvoteQuestion(q.id)} disabled={hasUpvoted(q.id)} aria-label="Upvote question" title="Upvote question"><svg viewBox="0 0 24 24" fill={hasUpvoted(q.id) ? 'var(--primary)' : 'none'} stroke="currentColor" stroke-width="2" width="18" height="18"><path d="M12 19V5M5 12l7-7 7 7"/></svg></button><span class="qa-vote-count" class:has-votes={q.upvotes > 0}>{q.upvotes || 0}</span></div><div class="qa-content"><div class="qa-question-text">{q.question}</div><div class="qa-meta"><span class="qa-author">{q.askedBy || 'Anonymous'}</span>{#if q.askedAt}<span class="qa-time">&middot; {getRelativeTime(q.askedAt)}</span>{/if}</div>{#if q.answer}<div class="qa-answer"><div class="qa-answer-header"><div class="qa-answer-avatar">PW</div><span class="qa-answer-by">{q.answeredBy || 'Pascal'}</span>{#if q.answeredAt}<span class="qa-answer-time">{getRelativeTime(q.answeredAt)}</span>{/if}</div><div class="qa-answer-text">{q.answer}</div></div>{:else if $isAdmin}<div class="qa-answer-form"><textarea class="qa-answer-input" rows="2" placeholder="Write your answer..." id="qaAnswer_{q.id}"></textarea><button class="qa-answer-submit" onclick={() => { const el = document.getElementById('qaAnswer_' + q.id); if (el) submitAnswer(q.id, el.value); }}>Answer</button></div>{:else}<div class="qa-awaiting">Awaiting response from Pascal</div>{/if}</div></div>{/each}</div>
						{/if}
						</div>
					</div>
				</div>

				<!-- ==================== GP INSIGHTS (admin only) ==================== -->
				{#if showGpInsights}
					<div class="section gp-insights-section flow-order-130" use:loadWhenVisible={setGpInsightsSectionVisible}>
						<div class="section-header"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="18" height="18"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg><span class="section-title">GP Insights — Investor Pipeline</span><span class="gp-admin-badge">{$isAdmin ? 'ADMIN' : 'GP'}</span></div>
						<div class="section-body">
							{#if !gpInsightsLoaded && !gpInsightsLoading}
								<div class="gp-empty">Investor pipeline loads when you scroll here.</div>
							{:else if gpInsightsLoading}
								<div class="gp-loading">Loading investor pipeline...</div>
							{:else if gpInsightsError}
								<div class="gp-empty">
									Couldn't load investor pipeline.
									<div style="margin-top:10px;">
										<button class="gp-share-copy" onclick={() => loadGpInsights(true)}>Try Again</button>
									</div>
								</div>
							{:else if gpInsights}<div class="gp-funnel"><div class="gp-funnel-step"><div class="gp-funnel-count">{gpInsights.review || 0}</div><div class="gp-funnel-label">Review</div></div><div class="gp-funnel-arrow"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><polyline points="9 18 15 12 9 6"/></svg></div><div class="gp-funnel-step"><div class="gp-funnel-count">{gpInsights.connect || 0}</div><div class="gp-funnel-label">Connect</div></div><div class="gp-funnel-arrow"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><polyline points="9 18 15 12 9 6"/></svg></div><div class="gp-funnel-step"><div class="gp-funnel-count">{gpInsights.decide || 0}</div><div class="gp-funnel-label">Decide</div></div><div class="gp-funnel-arrow"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><polyline points="9 18 15 12 9 6"/></svg></div><div class="gp-funnel-step gp-funnel-invested"><div class="gp-funnel-count">{gpInsights.invested || 0}</div><div class="gp-funnel-label">Invested</div></div></div><div class="gp-stats-row">{#if gpInsights.deckViews !== undefined}<div class="gp-stat"><span class="gp-stat-value">{gpInsights.deckViews}</span> deck views</div>{/if}{#if gpInsights.introRequests !== undefined}<div class="gp-stat"><span class="gp-stat-value">{gpInsights.introRequests}</span> intro requests</div>{/if}{#if gpInsights.avgTimeOnPage}<div class="gp-stat"><span class="gp-stat-value">{gpInsights.avgTimeOnPage}</span> avg. time on page</div>{/if}</div>{:else}<div class="gp-empty">No investor pipeline data available yet.</div>{/if}</div>
					</div>
				{/if}
				</div>

			</div><!-- /deal-page-content -->

			<!-- ==================== STICKY ACTION BAR ==================== -->
			<div class="sticky-action-bar">
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
			</div>
		{/if}
	</div>
</main>

<nav class="deal-mobile-tabs" aria-label="Primary">
	<a href="/app/dashboard" class="deal-mobile-tab" onclick={tapLight}>
		<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/></svg>
		<span>Dashboard</span>
	</a>
	<a href="/app/market-intel" class="deal-mobile-tab" onclick={tapLight}>
		<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>
		<span>Intel</span>
	</a>
	<a href="/app/deals" class="deal-mobile-tab active" aria-current="page" onclick={tapLight}>
		<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>
		<span>Deal Flow</span>
	</a>
	<a href="/app/operators" class="deal-mobile-tab" onclick={tapLight}>
		<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
		<span>Operators</span>
	</a>
	<a href="/app/more" class="deal-mobile-tab" onclick={tapLight}>
		<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20"><circle cx="12" cy="12" r="1"/><circle cx="12" cy="5" r="1"/><circle cx="12" cy="19" r="1"/></svg>
		<span>More</span>
	</a>
</nav>

<!-- ==================== TOAST ==================== -->
{#if toastVisible}
	<div class="toast-notification" class:visible={toastVisible}>
		<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><polyline points="20 6 9 17 4 12"/></svg>
		{toastMessage}
	</div>
{/if}

<!-- ==================== PUBLIC AUTH MODAL ==================== -->
{#if showAuthModal}
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div class="modal-overlay" onclick={(e) => { if (e.target === e.currentTarget) closeAuthModal(); }}>
		<div class="modal-container auth-modal">
			<button class="modal-close" onclick={closeAuthModal}>&times;</button>
			{#if authSent}
				<div class="modal-success">
					<div class="modal-success-icon">
						<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#51BE7B" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
					</div>
					<div class="modal-success-title">Check your email</div>
					<div class="modal-success-text">We sent you a magic link so you can finish creating your free account and pick up right where you left off.</div>
					<button class="modal-btn-primary" onclick={closeAuthModal}>Close</button>
				</div>
			{:else}
				<div class="auth-modal-header">
					<div class="auth-modal-title">{authModalTitle}</div>
					<div class="auth-modal-copy">{authModalBody}</div>
				</div>
				<div class="modal-field">
					<label class="modal-label" for="auth-email">Email address</label>
					<input id="auth-email" type="email" class="modal-input" placeholder="you@example.com" bind:value={authEmail} onkeydown={(e) => { if (e.key === 'Enter') submitAuthModal(); }} />
				</div>
				{#if authError}
					<div class="auth-modal-error">{authError}</div>
				{/if}
				<div class="modal-actions">
					<button class="modal-btn-secondary" onclick={closeAuthModal}>Cancel</button>
					<button class="modal-btn-primary" onclick={submitAuthModal} disabled={authSending}>{authSending ? 'Sending...' : 'Continue'}</button>
				</div>
			{/if}
		</div>
	</div>
{/if}

<!-- ==================== INTRO REQUEST MODAL ==================== -->
{#if showIntroModal && deal}
	{@const sponsors = deal.sponsors || []}
	{@const op = sponsors.find(s => s.role === 'operator') || (deal.managementCompany ? { name: deal.managementCompany, ceo: deal.ceo, foundingYear: deal.mcFoundingYear, website: deal.mcWebsite } : null)}
	{@const opName = op ? op.name : (deal.managementCompany || 'the operator')}
	{@const opCeo = op ? (op.ceo || '') : (deal.ceo || '')}
	{@const opYears = op && op.foundingYear ? ((new Date().getFullYear()) - op.foundingYear) + '+ years' : ''}
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div class="modal-overlay" onclick={(e) => { if (e.target === e.currentTarget) showIntroModal = false; }}>
		<div class="modal-container">
			<button class="modal-close" onclick={() => showIntroModal = false}>&times;</button>
			{#if introSuccess}
				<div class="modal-success">
					<div class="modal-success-icon">
						<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#51BE7B" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
					</div>
					<div class="modal-success-title">You're all set</div>
					<div class="modal-success-text">Pascal will personally introduce you to {opName}. Check your email -- you'll be CC'd on the intro.</div>
					<button class="modal-btn-primary" style="background:var(--text-dark);" onclick={() => showIntroModal = false}>Back to Deal</button>
				</div>
			{:else}
				<div class="modal-header-centered">
					<div class="modal-avatar">{getInitials(opName)}</div>
					<div class="modal-avatar-name">{opName}</div>
					<div class="modal-avatar-meta">
						{#if opCeo}<span>{opCeo}</span>{/if}
						{#if opCeo && opYears}<span>&middot;</span>{/if}
						{#if opYears}<span>{opYears}</span>{/if}
						{#if op?.website}
							{#if opCeo || opYears}<span>&middot;</span>{/if}
							<a href={op.website} target="_blank" rel="noopener" class="modal-avatar-link">Website</a>
						{/if}
					</div>
				</div>
				<div class="modal-body-text">
					We'll connect you with {opName} for <strong>{deal.investmentName}</strong>. Pascal will make a personal email introduction on your behalf.
				</div>
				<div class="modal-field">
					<label class="modal-label" for="intro-message">Message to Operator (optional)</label>
					<textarea id="intro-message" class="modal-textarea" rows="3" placeholder="Hi, I'm interested in learning more about this opportunity..." bind:value={introMessage}></textarea>
				</div>
				<div class="modal-actions">
					<button class="modal-btn-secondary" onclick={() => showIntroModal = false}>Cancel</button>
					<button class="modal-btn-primary" onclick={submitIntroRequest} disabled={introSending}>
						{introSending ? 'Requesting...' : 'Request Introduction'}
					</button>
				</div>
				<div class="modal-footer-note">
					3 introductions available per day
				</div>
			{/if}
		</div>
	</div>
{/if}

<!-- ==================== INVITE CO-INVESTORS MODAL ==================== -->
{#if showInviteModal && deal}
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div class="modal-overlay" onclick={(e) => { if (e.target === e.currentTarget) showInviteModal = false; }}>
		<div class="modal-container">
			<div class="modal-header-row">
				<div class="modal-title">Invite a Co-Investor</div>
				<button class="modal-close-inline" onclick={() => showInviteModal = false}>&times;</button>
			</div>
			<div class="modal-body-text" style="margin-bottom:20px;">
				Share a personal invite link for <strong>{deal.investmentName}</strong>. Your friend will see the deal and can sign up to save it.
			</div>
			<div class="invite-link-row">
				<input type="text" class="modal-input invite-link-input" readonly value={inviteUrl} onclick={(e) => e.target.select()} />
				<button class="modal-btn-primary invite-copy-btn" onclick={copyInviteLink}>Copy Link</button>
			</div>
			<div class="modal-field" style="margin-top:16px;">
				<label class="modal-label" for="invite-email">Email a friend directly (optional)</label>
				<input id="invite-email" type="email" class="modal-input" placeholder="friend@example.com" bind:value={inviteEmail} />
			</div>
			<div class="modal-field">
				<label class="modal-label" for="invite-message">Personal message (optional)</label>
				<textarea id="invite-message" class="modal-textarea" rows="2" placeholder="Hey, check out this deal..." bind:value={inviteMessage}></textarea>
			</div>
			<div class="invite-share-row">
				<a href="mailto:{inviteEmail}?subject={inviteEmailSubject}&body={inviteEmailBody}" class="invite-share-btn">
					<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
					Email
				</a>
				<a href="sms:?&body={inviteSmsBody}" class="invite-share-btn">
					<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
					Text
				</a>
			</div>
		</div>
	</div>
{/if}

<!-- ==================== CLAIM DEAL MODAL ==================== -->
{#if showClaimModal && deal}
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div class="modal-overlay" onclick={(e) => { if (e.target === e.currentTarget) showClaimModal = false; }}>
		<div class="modal-container">
			<div class="modal-header-row">
				<div class="modal-title">Claim This Deal</div>
				<button class="modal-close-inline" onclick={() => showClaimModal = false}>&times;</button>
			</div>
			{#if claimSuccess}
				<div class="modal-success" style="padding:24px 0;">
					<div class="modal-success-icon">
						<svg viewBox="0 0 24 24" fill="none" stroke="#51BE7B" stroke-width="2" width="32" height="32"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
					</div>
					<div class="modal-success-title">Claim submitted!</div>
					<div class="modal-success-text">We'll review and get back to you within 24 hours.</div>
					<button class="modal-btn-primary" style="margin-top:16px;" onclick={() => showClaimModal = false}>Close</button>
				</div>
			{:else}
				<div class="modal-body-text" style="margin-bottom:20px;">
					Claim <strong>{deal.investmentName}</strong> to manage your deal listing, see investor interest, and respond to questions.
				</div>
				<div class="claim-user-card">
					<div class="claim-user-name">{claimName}</div>
					<div class="claim-user-email">{claimEmail}</div>
					{#if claimCompany}<div class="claim-user-company">{claimCompany}</div>{/if}
				</div>
				<div class="modal-field">
					<label class="modal-label" for="claim-role">Your Role</label>
					<select id="claim-role" class="modal-select" bind:value={claimRole} required>
						<option value="">Select your role...</option>
						<option value="founder">Founder / CEO</option>
						<option value="ir">IR / Investor Relations</option>
						<option value="partner">Managing Partner</option>
						<option value="authorized">Authorized Representative</option>
					</select>
				</div>
				<button class="modal-btn-claim" onclick={submitClaim} disabled={claimSubmitting || !claimRole}>
					{claimSubmitting ? 'Submitting...' : 'Submit Claim'}
				</button>
			{/if}
		</div>
	</div>
{/if}

<!-- ==================== DECK VIEWER MODAL ==================== -->
{#if showDeckViewer && deal?.deckUrl}
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div class="deck-viewer-overlay" onclick={(e) => { if (e.target === e.currentTarget) showDeckViewer = false; }}>
		<div class="deck-viewer-modal">
			<div class="deck-viewer-header">
				<span class="deck-viewer-title">{deal.investmentName} - Investment Deck</span>
				<div class="deck-viewer-actions">
					<a href={deal.deckUrl} target="_blank" rel="noopener" class="deck-viewer-download">
						<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
						Download
					</a>
					<button class="deck-viewer-close" onclick={() => showDeckViewer = false}>&times;</button>
				</div>
			</div>
			<div class="deck-viewer-body">
				<iframe
					src={deckPreviewUrl}
					title="Deck Viewer"
					class="deck-viewer-iframe"
					allowfullscreen
					sandbox="allow-scripts allow-same-origin allow-popups"
				></iframe>
			</div>
		</div>
	</div>
{/if}

<!-- ==================== ENRICHMENT WIZARD MODAL ==================== -->
{#if showEnrichModal && $isAdmin && deal}
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div class="modal-overlay" onclick={(e) => { if (e.target === e.currentTarget) showEnrichModal = false; }}>
		<div class="modal-container" style="max-width:560px;">
			<div class="modal-header-row">
				<div class="modal-title">Enrich from Deck</div>
				<button class="modal-close-inline" onclick={() => showEnrichModal = false}>&times;</button>
			</div>
			{#if enrichSuccess}
				<div class="modal-success" style="padding:24px 0;">
					<div class="modal-success-icon">
						<svg viewBox="0 0 24 24" fill="none" stroke="#51BE7B" stroke-width="2" width="32" height="32"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
					</div>
					<div class="modal-success-title">Enrichment saved!</div>
					<div class="modal-success-text">Deal data has been updated with the confirmed fields.</div>
					<button class="modal-btn-primary" style="margin-top:16px;" onclick={() => showEnrichModal = false}>Close</button>
				</div>
			{:else if enrichmentData === null}
				<div style="text-align:center;padding:40px 0;">
					<div class="enrich-spinner"></div>
					<div style="color:var(--text-muted);font-size:13px;margin-top:12px;">Extracting data from deck...</div>
				</div>
			{:else if Object.keys(enrichmentData).filter(k => enrichmentData[k] != null && ENRICHMENT_FIELD_LABELS[k]).length === 0}
				<div style="text-align:center;padding:32px 0;">
					<svg viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" stroke-width="2" width="32" height="32"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
					<div style="color:var(--text-muted);font-size:14px;margin-top:12px;">No extractable fields found in the deck.</div>
					<button class="modal-btn-secondary" style="margin-top:16px;" onclick={() => showEnrichModal = false}>Close</button>
				</div>
			{:else}
				<div class="enrich-wizard">
					<div class="enrich-header">
						<svg viewBox="0 0 24 24" fill="none" stroke="var(--primary)" stroke-width="2" width="28" height="28"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
						<div>
							<div style="font-family:var(--font-ui);font-size:15px;font-weight:700;color:var(--text-dark);">Review Extracted Fields</div>
							<div style="font-size:13px;color:var(--text-secondary);margin-top:2px;">{Object.keys(enrichChecked).length} fields extracted. Uncheck any you want to skip.</div>
						</div>
					</div>
					<div class="enrich-fields">
						{#each Object.entries(enrichmentData).filter(([k, v]) => v != null && ENRICHMENT_FIELD_LABELS[k]) as [key, value]}
							<div class="enrich-field">
								<label class="enrich-checkbox">
									<input type="checkbox" bind:checked={enrichChecked[key]} />
								</label>
								<span class="enrich-field-label">{ENRICHMENT_FIELD_LABELS[key]}</span>
								<span class="enrich-field-value">{formatEnrichmentValue(key, value)}</span>
							</div>
						{/each}
					</div>
					<div class="enrich-actions">
						<button class="modal-btn-secondary" onclick={() => showEnrichModal = false}>Skip</button>
						<button class="modal-btn-primary" onclick={confirmEnrichment} disabled={enrichSaving} style="flex:1;">
							{enrichSaving ? 'Saving...' : 'Confirm & Save'}
						</button>
					</div>
				</div>
			{/if}
		</div>
	</div>
{/if}

<style>
	/* ===== Layout ===== */
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
	.peer-mobile-metrics > *,
	.similar-mobile-primary > * {
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

	/* ===== Skeleton ===== */
	.skeleton { position: relative; overflow: hidden; background: var(--border-light); border-radius: 8px; }
	.skeleton::after { content: ''; position: absolute; inset: 0; background: linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.6) 50%, transparent 100%); animation: shimmer 1.5s infinite; }
	@keyframes shimmer { 0% { transform: translateX(-100%); } 100% { transform: translateX(100%); } }
	.skeleton-header { height: 180px; margin-bottom: 24px; }
	.skeleton-stats { height: 80px; margin-bottom: 24px; }
	.skeleton-card { height: 200px; margin-bottom: 20px; }

	/* ===== Not Found ===== */
	.not-found { text-align: center; padding: 80px 20px; }
	.not-found-icon { color: var(--text-muted); margin-bottom: 16px; }
	.not-found h2 { font-family: var(--font-headline); font-size: 28px; color: var(--text-dark); margin-bottom: 12px; }
	.not-found p { font-family: var(--font-body); font-size: 16px; color: var(--text-secondary); margin-bottom: 24px; }
	.not-found a { display: inline-flex; align-items: center; gap: 8px; color: var(--primary); font-family: var(--font-ui); font-size: 14px; font-weight: 600; text-decoration: none; }
	.not-found a:hover { text-decoration: underline; }
	.btn-primary { display: inline-block; padding: 12px 24px; background: var(--primary); color: #fff; border-radius: var(--radius-sm); font-family: var(--font-ui); font-weight: 700; text-decoration: none; }
	.btn-primary:hover { background: var(--primary-hover); }

	/* ===== Breadcrumb ===== */
	.breadcrumb { display: flex; align-items: center; gap: 8px; margin-bottom: 20px; font-family: var(--font-ui); font-size: 13px; font-weight: 500; color: var(--text-muted); }
	.breadcrumb a { color: var(--primary); text-decoration: none; }

	/* ===== Deal Header / Hero ===== */
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

	/* Social Proof in hero */
	.hero-social-proof { display: flex; align-items: center; gap: 12px; margin-top: 14px; font-family: var(--font-ui); font-size: 12px; color: rgba(255,255,255,0.72); padding: 8px 10px; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.08); border-radius: 10px; width: fit-content; max-width: 100%; }
	.sp-avatars { display: flex; flex-shrink: 0; }
	.sp-avatar { width: 30px; height: 30px; border-radius: 50%; border: 2px solid #252b3b; background: linear-gradient(135deg, #51BE7B 0%, #2d8a54 100%); color: #fff; font-size: 10px; font-weight: 800; display: flex; align-items: center; justify-content: center; margin-left: -8px; position: relative; overflow: hidden; }
	.sp-avatar:first-child { margin-left: 0; }
	.sp-count { background: rgba(255,255,255,0.15); font-size: 9px; font-weight: 700; letter-spacing: -0.3px; }
	.sp-text { line-height: 1.4; }
	.sp-text strong { color: #fff; font-weight: 700; }
	.sp-dim { color: rgba(255,255,255,0.55); }

	/* Hero operator photo */
	.hero-operator-photo { width: 80px; height: 80px; border-radius: 50%; object-fit: cover; background: rgba(255,255,255,0.12); display: flex; align-items: center; justify-content: center; font-family: var(--font-ui); font-weight: 800; color: rgba(255,255,255,0.9); font-size: 26px; letter-spacing: -0.5px; border: 2px solid rgba(255,255,255,0.15); }
	.hero-operator-name { font-family: var(--font-ui); font-size: 14px; font-weight: 700; color: #fff; }
	.hero-operator-title-text { font-family: var(--font-ui); font-size: 11px; color: rgba(255,255,255,0.55); }

	/* Hero CTA buttons */
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

	/* Archived banner */
	.archived-banner { background: rgba(138,154,160,0.08); border: 1px solid rgba(138,154,160,0.2); border-radius: 8px; padding: 14px 20px; margin-bottom: 16px; display: flex; align-items: center; gap: 10px; font-family: var(--font-ui); font-size: 13px; }
	.archived-banner strong { color: var(--text-secondary); font-weight: 700; }
	.archived-banner span { color: var(--text-muted); font-size: 12px; margin-left: 8px; }

	/* ===== Journey Bar ===== */
	.journey-bar { display: flex; align-items: center; justify-content: space-between; gap: 0; margin-bottom: 18px; padding: 10px 14px; background: var(--bg-card); border: 1px solid var(--border); border-radius: 10px; }
	.journey-step { display: flex; flex-direction: column; align-items: center; gap: 3px; cursor: default; padding: 2px 6px; border-radius: 10px; transition: all 0.2s; font-family: var(--font-ui); font-size: 9px; font-weight: 700; color: var(--text-muted); white-space: nowrap; text-align: center; background: none; border: none; text-transform: uppercase; letter-spacing: 0.35px; }
	.journey-step:hover { background: var(--bg-cream); color: var(--text-dark); }
	.step-dot { width: 24px; height: 24px; border-radius: 50%; border: 1.5px solid var(--border); display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 700; color: var(--text-muted); background: var(--bg-page); transition: all 0.2s; flex-shrink: 0; }
	.journey-step.active .step-dot { background: var(--primary); border-color: var(--primary); color: #fff; }
	.journey-step.active { color: var(--primary); background: rgba(81,190,123,0.08); }
	.journey-step.completed .step-dot { background: var(--primary); border-color: var(--primary); color: #fff; }
	.journey-step.completed { color: var(--text-dark); }
	.journey-step.skipped .step-dot { background: #D04040; border-color: #D04040; color: #fff; }
	.journey-step.skipped { color: #D04040; }
	.journey-connector { flex: 1; min-width: 12px; max-width: 34px; height: 2px; background: var(--border); align-self: center; margin-top: -12px; }
	.journey-connector.done { background: var(--primary); }

	/* ===== Data Completeness ===== */
	.data-completeness { display: flex; align-items: center; gap: 14px; padding: 12px 16px; background: var(--bg-card); border: 1px solid var(--border); border-radius: 10px; margin-bottom: 20px; font-family: var(--font-ui); }
	.data-completeness-label { font-size: 13px; font-weight: 700; color: var(--text-dark); white-space: nowrap; }
	.data-completeness-bar { flex: 1; height: 6px; background: var(--border-light); border-radius: 3px; overflow: hidden; }
	.data-completeness-fill { height: 100%; border-radius: 3px; transition: width 0.5s ease; }
	.data-completeness-fill.high { background: var(--primary); }
	.data-completeness-fill.medium { background: #f59e0b; }
	.data-completeness-fill.low { background: #ef4444; }
	.data-completeness-pct { font-size: 14px; font-weight: 800; color: var(--text-dark); min-width: 36px; text-align: right; }
	.data-completeness-hint { font-size: 12px; color: var(--text-muted); white-space: nowrap; }

	/* ===== Metrics Strip ===== */
	.metrics-strip { display: grid; grid-template-columns: repeat(auto-fit, minmax(132px, 1fr)); gap: 10px; margin-bottom: 20px; }
	.metric-card { background: var(--bg-card); border: 1px solid var(--border); border-radius: 10px; padding: 13px 14px; text-align: center; box-shadow: none; }
	.metric-label { font-family: var(--font-ui); font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.7px; color: var(--text-muted); margin-bottom: 4px; }
	.metric-value { font-family: var(--font-ui); font-size: 18px; font-weight: 800; color: var(--text-dark); letter-spacing: -0.4px; }
	.metric-value.highlight { color: var(--primary); }
	.metric-locked { display: flex; align-items: center; justify-content: center; min-height: 52px; cursor: pointer; border-style: dashed; background: rgba(59,130,246,0.04); border-color: rgba(59,130,246,0.2); }
	.metric-locked-link { text-decoration: none; }
	.metric-locked .metric-label { color: #3b82f6; font-size: 11px; margin: 0; }

	/* ===== Two Column Grid ===== */
	.two-col-grid { display: grid; grid-template-columns: 2fr 1fr; gap: 20px; align-items: start; margin-bottom: 20px; }
	.canonical-lower-flow { display: flex; flex-direction: column; }
	.flow-order-10 { order: 10; }
	.flow-order-20 { order: 20; }
	.flow-order-30 { order: 30; }
	.flow-order-40 { order: 40; }
	.flow-order-50 { order: 50; }
	.flow-order-60 { order: 60; }
	.flow-order-70 { order: 70; }
	.flow-order-80 { order: 80; }
	.flow-order-90 { order: 90; }
	.flow-order-100 { order: 100; }
	.flow-order-110 { order: 110; }
	.flow-order-120 { order: 120; }
	.flow-order-130 { order: 130; }

	/* ===== Sections ===== */
	.section { background: var(--bg-card); border: 1px solid var(--border); border-radius: 10px; margin-bottom: 18px; box-shadow: none; overflow: hidden; }
	.section-header { padding: 16px 20px; border-bottom: 1px solid var(--border-light); display: flex; align-items: center; gap: 10px; }
	.section-header svg { color: var(--primary); flex-shrink: 0; }
	.section-title { font-family: var(--font-ui); font-size: 14px; font-weight: 700; color: var(--text-dark); letter-spacing: -0.15px; }
	.section-body { padding: 24px; }

	/* ===== Deal Terms Grid ===== */
	.details-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; }
	.detail-item {}
	.detail-item-wide { grid-column: 1 / -1; }
	.detail-label { font-family: var(--font-ui); font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.8px; color: var(--text-muted); margin-bottom: 4px; }
	.detail-value { font-family: var(--font-ui); font-size: 14px; font-weight: 600; color: var(--text-dark); }

	/* ===== Overview ===== */
	.overview-text { font-family: var(--font-body); font-size: 15px; line-height: 1.7; color: var(--text-secondary); }

	/* ===== Operator Card ===== */
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

	/* ===== Property Location Map ===== */
	.deal-map-container { height: 260px; border-radius: 8px; overflow: hidden; z-index: 0; }
	.deal-map-placeholder { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px; height: 180px; background: var(--bg-cream); border-radius: 8px; }
	.deal-map-spinner { width: 24px; height: 24px; border: 3px solid var(--border); border-top-color: var(--primary); border-radius: 50%; animation: spin 0.8s linear infinite; }
	@keyframes spin { to { transform: rotate(360deg); } }
	.btn-upgrade-map { margin-top: 6px; padding: 6px 16px; background: var(--primary); color: #fff; border-radius: var(--radius-sm); font-family: var(--font-ui); font-size: 12px; font-weight: 700; text-decoration: none; }
	.btn-upgrade-map:hover { opacity: 0.9; }

	/* ===== Documents / Materials ===== */
	.doc-list { display: flex; flex-direction: column; gap: 8px; }
	.doc-item { display: flex; align-items: center; gap: 10px; padding: 10px 14px; background: var(--bg-cream); border-radius: 8px; text-decoration: none; font-family: var(--font-ui); font-size: 13px; font-weight: 600; color: var(--text-dark); transition: background 0.15s; }
	.doc-item:hover { background: rgba(81,190,123,0.08); }
	.doc-row-button { width: 100%; border: none; cursor: pointer; justify-content: flex-start; }
	.doc-item-status { margin-left: auto; font-size: 10px; font-weight: 700; color: var(--primary); text-transform: uppercase; letter-spacing: 0.4px; }
	.doc-locked { color: var(--text-muted); cursor: default; }
	.doc-empty { font-family: var(--font-body); font-size: 13px; color: var(--text-muted); }

	/* ===== Canonical lower-flow sections ===== */
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

	/* ===== DD Checklist ===== */
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

	/* Gate overlay */
	.gate-overlay { position: absolute; inset: 0; z-index: 5; display: flex; align-items: center; justify-content: center; background: rgba(255,255,255,0.7); backdrop-filter: blur(4px); -webkit-backdrop-filter: blur(4px); border-radius: 12px; }
	.gate-content { text-align: center; max-width: 340px; padding: 28px 20px 36px; }
	.gate-icon { width: 40px; height: 40px; border-radius: 50%; background: linear-gradient(135deg, #3b82f6, #4ade80); display: flex; align-items: center; justify-content: center; margin: 0 auto 12px; }
	.gate-title { font-family: var(--font-ui); font-size: 15px; font-weight: 800; color: var(--text-dark); margin-bottom: 4px; }
	.gate-text { font-family: var(--font-body); font-size: 12px; color: var(--text-secondary); margin-bottom: 14px; line-height: 1.5; }
	.gate-cta { display: inline-block; padding: 10px 24px; background: var(--primary); color: #fff; border-radius: 8px; font-family: var(--font-ui); font-size: 13px; font-weight: 700; text-decoration: none; }

	/* Deferred section overlay */
	.coming-soon-section { position: relative; min-height: 120px; }
	.coming-soon-overlay { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); z-index: 5; text-align: center; padding: 32px 48px; background: rgba(255,255,255,0.92); border-radius: 12px; border: 1px solid var(--border); box-shadow: 0 4px 24px rgba(0,0,0,0.08); }
	.coming-soon-label { font-family: var(--font-ui); font-size: 20px; font-weight: 800; color: var(--text-dark); margin-bottom: 6px; }
	.coming-soon-desc { font-size: 13px; color: var(--text-secondary); }
	.coming-soon-placeholder { opacity: 0.15; pointer-events: none; user-select: none; }
	.qa-placeholder-item { padding: 12px 0; border-bottom: 1px solid var(--border); font-size: 13px; color: var(--text-secondary); }
	.qa-placeholder-item:last-child { border-bottom: none; }

	/* Community */
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

	/* ===== Sticky Action Bar ===== */
	.sticky-action-bar { position: fixed; bottom: 16px; left: calc(var(--sidebar-width, 240px) + 24px); right: 24px; background: var(--bg-card); border: 1px solid var(--border); padding: 10px 18px; display: flex; align-items: center; justify-content: space-between; gap: 12px; z-index: 100; box-shadow: 0 8px 24px rgba(0,0,0,0.08); border-radius: 12px; }
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

	/* ===== Share Dropdown Enhancements ===== */
	.share-invite { border-bottom: 1px solid var(--border-light); padding-bottom: 10px; margin-bottom: 4px; }
	.share-invite-text { color: var(--primary); font-weight: 700; }

	/* ===== Deck Viewed Prompt ===== */
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

	/* ===== Intro Nudge Banner ===== */
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

	/* ===== Claim Deal Banner ===== */
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

	/* ===== Buy Box Match ===== */
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

	/* Small advance button variant */
	.btn-sm { padding: 8px 20px; font-size: 12px; }

	/* ===== Responsive ===== */
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
			padding: 10px 16px;
			gap: 8px;
			border-radius: 12px;
			border-left: 1px solid var(--border);
			border-right: 1px solid var(--border);
		}
		.sticky-action-bar .btn-pass, .sticky-action-bar .btn-advance { padding: 8px 14px; font-size: 12px; }
		.sticky-action-bar .stage-label { font-size: 11px; }
		.deal-page-content { padding-bottom: calc(var(--deal-mobile-tab-bar-offset) + 108px); }
		.floating-compare-badge { bottom: calc(var(--deal-mobile-tab-bar-offset) + 88px); }
		.metrics-strip { grid-template-columns: repeat(3, 1fr); }
		.details-grid { grid-template-columns: repeat(3, 1fr); }
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
		.summary-row { flex-direction: column; gap: 4px; }
		.summary-label { min-width: 0; }
		.journey-bar { padding: 12px 16px; gap: 0; justify-content: space-between; overflow: visible; }
		.journey-step { padding: 4px; font-size: 9px; flex-direction: column; text-align: center; gap: 4px; }
		.step-dot { width: 32px; height: 32px; font-size: 12px; }
		.journey-connector { width: 20px; min-width: 12px; flex: 1; }
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
		.modal-container { max-width: 100%; border-radius: 16px; }
	}
	@media (max-width: 480px) {
		.metrics-strip { grid-template-columns: 1fr 1fr !important; gap: 8px !important; }
		.details-grid { grid-template-columns: 1fr; }
		.deal-name { font-size: 20px !important; }
		.hero-metrics { flex-wrap: wrap !important; }
		.action-buttons { flex-direction: column; }
		.btn-action { justify-content: center; width: 100%; }
		.geo-info { flex-direction: column; gap: 12px; }
		.journey-bar { padding: 10px 8px; }
		.journey-step { padding: 2px; font-size: 8px; }
		.step-dot { width: 28px; height: 28px; font-size: 11px; }
		.journey-connector { width: 8px; min-width: 8px; }
		.hero-social-proof { font-size: 12px; gap: 10px; }
		.sp-avatar { width: 26px; height: 26px; font-size: 9px; }
		.dd-perspective-links { flex-direction: column; }
		.btn-link { font-size: 11px; }
		.modal-overlay { padding: 12px; }
	}

	/* ===== Cash Flow Projection ===== */
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
	.blurred { opacity: 0.15; pointer-events: none; user-select: none; filter: blur(3px); }

	/* ===== Peer Comparison ===== */
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

	/* ===== Stress Test Calculator ===== */
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

	/* ===== Similar Deals Table ===== */
	.similar-table-wrap { overflow-x: auto; -webkit-overflow-scrolling: touch; min-width: 0; max-width: 100%; }
	.similar-table { width: 100%; border-collapse: collapse; min-width: 600px; }
	.sim-th { padding: 10px 12px; font-family: var(--font-ui); font-size: 11px; font-weight: 700; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.3px; text-align: right; white-space: nowrap; border-bottom: 2px solid var(--border); }
	.sim-th.left { text-align: left; min-width: 180px; }
	.sim-td { padding: 10px 12px; font-family: var(--font-ui); font-size: 13px; font-weight: 600; color: var(--text-dark); text-align: right; border-bottom: 1px solid var(--border-light); }
	.sim-td.left { text-align: left; }
	.sim-current-row { background: rgba(81,190,123,0.06); }
	.sim-deal-name { font-weight: 700; color: var(--text-dark); }
	.sim-deal-name.current { font-weight: 800; color: var(--primary); }
	.sim-deal-company { font-size: 11px; font-weight: 500; color: var(--text-muted); }
	.sim-deal-link { color: var(--text-dark); text-decoration: none; font-weight: 600; }
	.sim-deal-link:hover { color: var(--primary); text-decoration: underline; }
	.sim-badge { display: inline-block; padding: 1px 6px; border-radius: 4px; font-size: 9px; font-weight: 700; margin-top: 2px; }
	.sim-badge.current { background: var(--primary); color: #fff; }
	.sim-peer-row { transition: background 0.1s; }
	.sim-peer-row:hover { background: var(--bg-cream, #f8f8f6); }
	.similar-mobile-list { display: grid; gap: 12px; }
	.similar-mobile-list.ly-mobile-only { display: grid !important; }
	.similar-mobile-card {
		padding: 14px;
		border: 1px solid var(--border-light);
		border-radius: 12px;
		background: linear-gradient(180deg, rgba(248,248,246,0.7) 0%, rgba(255,255,255,0.96) 100%);
	}
	.similar-mobile-card.current {
		border-color: rgba(81,190,123,0.25);
		background: linear-gradient(180deg, rgba(81,190,123,0.06) 0%, rgba(255,255,255,0.98) 100%);
	}
	.similar-mobile-header {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 12px;
	}
	.similar-mobile-copy {
		min-width: 0;
	}
	.similar-mobile-primary {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 10px;
		margin-top: 14px;
	}
	.similar-mobile-stat {
		padding: 10px 12px;
		border-radius: 10px;
		background: var(--bg-cream, #f8f8f6);
	}
	.similar-mobile-stat-label {
		display: block;
		font-family: var(--font-ui);
		font-size: 10px;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.5px;
		color: var(--text-muted);
		margin-bottom: 4px;
	}
	.similar-mobile-stat-value {
		display: block;
		font-family: var(--font-ui);
		font-size: 14px;
		font-weight: 800;
		color: var(--text-dark);
	}
	.similar-mobile-details {
		margin-top: 12px;
		padding-top: 12px;
		border-top: 1px solid var(--border-light);
	}
	.similar-mobile-details summary {
		list-style: none;
		cursor: pointer;
		font-family: var(--font-ui);
		font-size: 12px;
		font-weight: 700;
		color: var(--primary);
	}
	.similar-mobile-details summary::-webkit-details-marker {
		display: none;
	}
	.similar-mobile-secondary {
		display: grid;
		gap: 8px;
		margin-top: 10px;
	}
	.similar-mobile-detail {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		font-family: var(--font-ui);
		font-size: 12px;
		color: var(--text-secondary);
	}
	.similar-mobile-detail strong {
		color: var(--text-dark);
		font-weight: 700;
		text-align: right;
	}

	/* ===== Responsive for new sections ===== */
	@media (max-width: 768px) {
		.st-grid { grid-template-columns: 1fr; }
		.cf-table, .peer-table, .similar-table { font-size: 12px; }
		.st-scenario-table { font-size: 12px; }
		.cf-legend { justify-content: flex-start; }
	}
	@media (max-width: 480px) {
		.cf-bar-row { gap: 6px; }
		.cf-bar-value { font-size: 11px; min-width: 48px; }
		.st-base-pills { gap: 6px; }
		.st-pill { font-size: 11px; padding: 4px 8px; }
		.peer-mobile-metrics { grid-template-columns: 1fr; }
		.similar-mobile-primary { grid-template-columns: repeat(2, minmax(0, 1fr)); }
	}

	/* ===== Deal Fit Summary ===== */
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

	/* ===== Background Check ===== */
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

	/* ===== Q&A Section ===== */
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

	/* ===== Academy Gate CTA ===== */
	.academy-gate-inline { background: linear-gradient(135deg, #eff6ff, #f0fdf4); border: 2px solid rgba(59,130,246,0.2); border-radius: var(--radius); padding: 24px; text-align: center; margin: 8px 0; }
	.academy-gate-inline .gate-icon { width: 48px; height: 48px; background: linear-gradient(135deg, #3b82f6, #4ade80); border-radius: 12px; margin: 0 auto 12px; display: flex; align-items: center; justify-content: center; }
	.academy-gate-inline .gate-title { font-family: var(--font-ui); font-size: 15px; font-weight: 700; color: var(--text-dark); margin-bottom: 6px; }
	.academy-gate-inline .gate-sub { font-size: 13px; color: var(--text-secondary); margin-bottom: 14px; line-height: 1.5; max-width: 420px; margin-left: auto; margin-right: auto; }
	.academy-gate-inline .gate-btn { display: inline-block; padding: 10px 24px; background: #3b82f6; color: #fff; border: none; border-radius: 8px; font-family: var(--font-ui); font-weight: 700; font-size: 13px; cursor: pointer; text-decoration: none; }
	.academy-gate-inline .gate-btn:hover { background: #2563eb; }
	.academy-gate-inline .gate-features { display: flex; gap: 16px; justify-content: center; margin-top: 14px; font-family: var(--font-ui); font-size: 11px; color: var(--text-muted); }

	/* ===== GP Insights ===== */
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

	/* ===== GP Call Agenda ===== */
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

	/* ===== Responsive for new sections ===== */
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
		.modal-container { max-width: 95vw; padding: 24px; }
		.invite-link-row { flex-direction: column; }
		.invite-copy-btn { width: 100%; }
		.invite-share-row { flex-direction: column; }
		.invite-share-btn { width: 100%; }
		.modal-actions { flex-direction: column-reverse; }
		.modal-btn-secondary, .modal-btn-primary { width: 100%; }
	}

	/* ===== Toast Notification ===== */
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

	/* ===== Modal Overlay & Container ===== */
	.modal-overlay {
		position: fixed;
		top: 0; left: 0; right: 0; bottom: 0;
		background: rgba(0,0,0,0.55);
		backdrop-filter: blur(4px);
		-webkit-backdrop-filter: blur(4px);
		z-index: 1100;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 20px;
		opacity: 0;
		animation: modalFadeIn 0.25s ease forwards;
	}
	@keyframes modalFadeIn { from { opacity: 0; } to { opacity: 1; } }
	@keyframes modalSlideUp { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }

	.modal-container {
		background: #fff;
		border-radius: 20px;
		max-width: 440px;
		width: 100%;
		box-shadow: 0 24px 80px rgba(0,0,0,0.25), 0 0 0 1px rgba(0,0,0,0.05);
		overflow: hidden;
		padding: 32px;
		animation: modalSlideUp 0.3s ease forwards;
		position: relative;
	}
	.auth-modal-header { margin-bottom: 20px; }
	.auth-modal-title { font-family: var(--font-ui); font-size: 22px; font-weight: 800; color: var(--text-dark); letter-spacing: -0.4px; }
	.auth-modal-copy { margin-top: 8px; font-family: var(--font-body); font-size: 14px; line-height: 1.6; color: var(--text-secondary); }
	.auth-modal-error { margin-bottom: 12px; font-family: var(--font-ui); font-size: 12px; font-weight: 700; color: #dc2626; }

	.modal-close {
		position: absolute;
		top: 16px;
		right: 16px;
		background: none;
		border: none;
		cursor: pointer;
		color: var(--text-muted);
		font-size: 20px;
		line-height: 1;
		width: 32px; height: 32px;
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
		transition: background 0.15s;
	}
	.modal-close:hover { background: rgba(0,0,0,0.05); }

	.modal-close-inline {
		background: none;
		border: none;
		cursor: pointer;
		color: var(--text-muted);
		font-size: 20px;
		line-height: 1;
	}
	.modal-close-inline:hover { color: var(--text-dark); }

	.modal-header-row {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 12px;
	}
	.modal-title {
		font-family: var(--font-display, var(--font-headline));
		font-size: 20px;
		font-weight: 800;
		color: var(--text-dark);
	}

	.modal-header-centered {
		padding: 8px 0 0;
		text-align: center;
	}
	.modal-avatar {
		width: 72px;
		height: 72px;
		border-radius: 50%;
		background: linear-gradient(135deg, #0f2027, #1a3a4a);
		display: flex;
		align-items: center;
		justify-content: center;
		font-family: var(--font-ui);
		font-size: 22px;
		font-weight: 700;
		color: #fff;
		margin: 0 auto 16px;
		box-shadow: 0 4px 16px rgba(0,0,0,0.1);
	}
	.modal-avatar-name {
		font-family: var(--font-ui);
		font-size: 20px;
		font-weight: 800;
		color: var(--text-dark);
		margin-bottom: 4px;
	}
	.modal-avatar-meta {
		font-family: var(--font-body);
		font-size: 13px;
		color: var(--text-muted);
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 6px;
		flex-wrap: wrap;
		margin-bottom: 16px;
	}
	.modal-avatar-link {
		color: var(--primary);
		text-decoration: none;
		font-weight: 600;
	}

	.modal-body-text {
		font-family: var(--font-body);
		font-size: 14px;
		color: var(--text-secondary);
		line-height: 1.6;
		text-align: center;
	}
	.modal-body-text strong { color: var(--text-dark); }

	.modal-field {
		margin-bottom: 16px;
	}
	.modal-label {
		display: block;
		font-family: var(--font-ui);
		font-size: 11px;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.5px;
		color: var(--text-muted);
		margin-bottom: 6px;
	}
	.modal-input {
		width: 100%;
		padding: 10px 12px;
		border: 1px solid var(--border);
		border-radius: 8px;
		font-family: var(--font-body);
		font-size: 13px;
		color: var(--text-dark);
		background: var(--bg-page, #f5f5f5);
		box-sizing: border-box;
	}
	.modal-input:focus { border-color: var(--primary); outline: none; }

	.modal-textarea {
		width: 100%;
		padding: 10px 12px;
		border: 1px solid var(--border);
		border-radius: 8px;
		font-family: var(--font-body);
		font-size: 13px;
		color: var(--text-dark);
		resize: vertical;
		box-sizing: border-box;
	}
	.modal-textarea:focus { border-color: var(--primary); outline: none; }

	.modal-select {
		width: 100%;
		padding: 10px 12px;
		border: 1px solid var(--border);
		border-radius: 8px;
		font-family: var(--font-body);
		font-size: 13px;
		color: var(--text-dark);
		background: var(--bg-page, #f5f5f5);
		box-sizing: border-box;
	}

	.modal-radio-group {
		display: flex;
		gap: 16px;
		flex-wrap: wrap;
	}
	.modal-radio {
		font-family: var(--font-ui);
		font-size: 13px;
		font-weight: 600;
		color: var(--text-dark);
		display: flex;
		align-items: center;
		gap: 6px;
		cursor: pointer;
	}
	.modal-radio input[type="radio"] { accent-color: var(--primary); }

	.modal-actions {
		display: flex;
		align-items: center;
		gap: 12px;
		margin-top: 20px;
	}
	.modal-btn-secondary {
		padding: 14px 24px;
		background: none;
		border: 1px solid var(--border);
		border-radius: 12px;
		font-family: var(--font-ui);
		font-size: 14px;
		font-weight: 600;
		color: var(--text-muted);
		cursor: pointer;
		transition: all 0.15s;
		white-space: nowrap;
	}
	.modal-btn-secondary:hover { border-color: var(--text-muted); }

	.modal-btn-primary {
		flex: 1;
		padding: 14px 24px;
		background: var(--primary);
		color: #fff;
		border: none;
		border-radius: 12px;
		font-family: var(--font-ui);
		font-size: 14px;
		font-weight: 700;
		cursor: pointer;
		transition: all 0.15s;
		box-shadow: 0 2px 8px rgba(81,190,123,0.3);
	}
	.modal-btn-primary:hover:not(:disabled) { background: #3dbd6d; box-shadow: 0 4px 16px rgba(81,190,123,0.4); }
	.modal-btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }

	.modal-footer-note {
		text-align: center;
		padding-top: 12px;
		font-family: var(--font-body);
		font-size: 11px;
		color: var(--text-muted);
	}

	/* Modal Success State */
	.modal-success {
		text-align: center;
		padding: 16px 0;
	}
	.modal-success-icon {
		width: 64px;
		height: 64px;
		border-radius: 50%;
		background: rgba(81,190,123,0.1);
		display: flex;
		align-items: center;
		justify-content: center;
		margin: 0 auto 20px;
	}
	.modal-success-title {
		font-family: var(--font-ui);
		font-size: 20px;
		font-weight: 800;
		color: var(--text-dark);
		margin-bottom: 8px;
	}
	.modal-success-text {
		font-family: var(--font-body);
		font-size: 14px;
		color: var(--text-secondary);
		line-height: 1.6;
		max-width: 320px;
		margin: 0 auto 20px;
	}

	/* ===== Invite Modal Specifics ===== */
	.invite-link-row {
		display: flex;
		gap: 8px;
		margin-bottom: 16px;
	}
	.invite-link-input {
		flex: 1;
		min-width: 0;
		font-size: 12px !important;
	}
	.invite-copy-btn {
		flex-shrink: 0;
		white-space: nowrap;
	}
	.invite-share-row {
		display: flex;
		gap: 8px;
		margin-top: 16px;
	}
	.invite-share-btn {
		flex: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 6px;
		padding: 10px;
		border: 1px solid var(--border);
		border-radius: 8px;
		font-family: var(--font-ui);
		font-size: 12px;
		font-weight: 600;
		color: var(--text-secondary);
		text-decoration: none;
		transition: background 0.15s;
	}
	.invite-share-btn:hover { background: var(--bg-page, #f5f5f5); }

	/* ===== Claim Modal Specifics ===== */
	.claim-user-card {
		background: var(--bg-page, #f5f5f5);
		border: 1px solid var(--border);
		border-radius: 10px;
		padding: 14px 16px;
		margin-bottom: 20px;
	}
	.claim-user-name {
		font-family: var(--font-ui);
		font-size: 13px;
		font-weight: 700;
		color: var(--text-dark);
		margin-bottom: 2px;
	}
	.claim-user-email {
		font-family: var(--font-body);
		font-size: 12px;
		color: var(--text-muted);
	}
	.claim-user-company {
		font-family: var(--font-body);
		font-size: 12px;
		color: var(--text-muted);
		margin-top: 2px;
	}
	.modal-btn-claim {
		width: 100%;
		padding: 14px;
		background: #2563eb;
		color: #fff;
		border: none;
		border-radius: 10px;
		font-family: var(--font-ui);
		font-size: 14px;
		font-weight: 700;
		cursor: pointer;
		transition: background 0.15s;
	}
	.modal-btn-claim:hover:not(:disabled) { background: #1d4ed8; }
	.modal-btn-claim:disabled { opacity: 0.5; cursor: not-allowed; }

	/* ===== Summary Rows & Fees ===== */
	.summary-row { display: flex; gap: 12px; margin-bottom: 12px; }
	.summary-label { font-family: var(--font-ui); font-size: 13px; font-weight: 600; color: var(--text-muted); min-width: 140px; flex-shrink: 0; }
	.summary-value { font-family: var(--font-body); font-size: 14px; color: var(--text-dark); }

	/* ===== Geography / Map ===== */
	.map-container { height: 340px; border-radius: var(--radius-sm); overflow: hidden; margin-top: 16px; border: 1px solid var(--border); }
	.geo-info { display: flex; gap: 32px; flex-wrap: wrap; margin-bottom: 8px; }
	.geo-label { font-family: var(--font-ui); font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.8px; color: var(--text-muted); margin-bottom: 4px; }
	.geo-value { font-family: var(--font-ui); font-size: 14px; font-weight: 600; color: var(--text-dark); }

	/* ===== Action Buttons ===== */
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

	/* ===== Returns Chart ===== */
	.returns-chart-section { margin-bottom: 24px; }
	.returns-chart-container { position: relative; height: 200px; background: linear-gradient(135deg, #0A1E21 0%, #1F5159 100%); border-radius: var(--radius); padding: 16px; }
	.returns-chart-legend { display: flex; gap: 16px; justify-content: center; padding: 10px 0 0; font-family: var(--font-ui); font-size: 11px; color: var(--text-muted); }
	.returns-chart-legend-item { display: flex; align-items: center; gap: 6px; }
	.returns-chart-legend-line { display: inline-block; width: 16px; height: 3px; border-radius: 2px; }
	.returns-chart-legend-dot { display: inline-block; width: 6px; height: 6px; border-radius: 50%; }

	/* ===== Share Class Toggle ===== */
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

	/* ===== Deck Viewer Modal ===== */
	.deck-viewer-overlay {
		position: fixed;
		top: 0; left: 0; right: 0; bottom: 0;
		background: rgba(0,0,0,0.75);
		z-index: 1000;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 24px;
	}
	.deck-viewer-modal {
		background: var(--bg-card, #fff);
		border-radius: 12px;
		width: 100%;
		max-width: 1100px;
		height: 85vh;
		display: flex;
		flex-direction: column;
		box-shadow: 0 20px 60px rgba(0,0,0,0.4);
		overflow: hidden;
	}
	.deck-viewer-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 14px 20px;
		border-bottom: 1px solid var(--border);
		flex-shrink: 0;
	}
	.deck-viewer-title {
		font-family: var(--font-ui);
		font-size: 14px;
		font-weight: 700;
		color: var(--text-dark);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.deck-viewer-actions {
		display: flex;
		align-items: center;
		gap: 12px;
	}
	.deck-viewer-download {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		padding: 6px 14px;
		font-family: var(--font-ui);
		font-size: 12px;
		font-weight: 600;
		color: var(--primary);
		text-decoration: none;
		border: 1px solid var(--border);
		border-radius: 6px;
		transition: background 0.15s;
	}
	.deck-viewer-download:hover { background: var(--bg-cream, #f8f8f6); }
	.deck-viewer-close {
		width: 32px;
		height: 32px;
		display: flex;
		align-items: center;
		justify-content: center;
		background: none;
		border: none;
		font-size: 24px;
		color: var(--text-muted);
		cursor: pointer;
		border-radius: 6px;
		transition: background 0.15s;
	}
	.deck-viewer-close:hover { background: var(--bg-cream, #f8f8f6); color: var(--text-dark); }
	.deck-viewer-body {
		flex: 1;
		overflow: hidden;
	}
	.deck-viewer-iframe {
		width: 100%;
		height: 100%;
		border: none;
	}

	/* ===== Doc item enhancements ===== */
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
	.doc-enrich-btn {
		cursor: pointer;
		border: 1px dashed rgba(59,130,246,0.3);
		background: rgba(59,130,246,0.04);
		color: #3b82f6;
		font-weight: 600;
	}
	.doc-enrich-btn:hover { background: rgba(59,130,246,0.1); }

	/* ===== Enrichment Wizard ===== */
	.enrich-wizard { text-align: left; }
	.enrich-header {
		display: flex;
		align-items: center;
		gap: 14px;
		margin-bottom: 16px;
	}
	.enrich-fields {
		max-height: 360px;
		overflow-y: auto;
		border: 1px solid var(--border-light, #eee);
		border-radius: 8px;
	}
	.enrich-field {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 10px 14px;
		border-bottom: 1px solid var(--border-light, #eee);
	}
	.enrich-field:last-child { border-bottom: none; }
	.enrich-checkbox input {
		width: 16px;
		height: 16px;
		accent-color: var(--primary);
		cursor: pointer;
	}
	.enrich-field-label {
		flex: 0 0 130px;
		font-family: var(--font-ui);
		font-size: 11px;
		font-weight: 600;
		color: var(--text-muted);
		text-transform: uppercase;
		letter-spacing: 0.3px;
	}
	.enrich-field-value {
		flex: 1;
		font-family: var(--font-body);
		font-size: 13px;
		color: var(--text-dark);
	}
	.enrich-actions {
		display: flex;
		gap: 10px;
		margin-top: 16px;
	}
	.enrich-spinner {
		width: 32px;
		height: 32px;
		border: 3px solid var(--border);
		border-top-color: var(--primary);
		border-radius: 50%;
		animation: spin 0.8s linear infinite;
		margin: 0 auto;
	}
	@keyframes spin { to { transform: rotate(360deg); } }

	@media (max-width: 768px) {
		.deck-viewer-overlay { padding: 8px; }
		.deck-viewer-modal { height: 90vh; }
		.deck-viewer-title { font-size: 12px; }
		.doc-item-row { flex-direction: column; }
		.enrich-field-label { flex: 0 0 100px; font-size: 10px; }
	}
</style>
