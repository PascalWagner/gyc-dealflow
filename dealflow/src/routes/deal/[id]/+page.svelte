<script>
	import { page } from '$app/stores';
	import { browser } from '$app/environment';
	import { onMount } from 'svelte';
	import Sidebar from '$lib/components/Sidebar.svelte';
	import { user, isLoggedIn, isAdmin, userTier, isAcademy } from '$lib/stores/auth.js';
	import { dealStages, STAGE_META, PIPELINE_STAGES, normalizeStage, stageLabel } from '$lib/stores/deals.js';

	let { data } = $props();

	// ===== Reactive State =====
	let deal = $state(data.deal);
	let loading = $state(!data.deal);
	let error = $state(data.error || null);
	let activeTab = $state('overview');
	let ddAnswers = $state({});
	let ddAccordionOpen = $state({});
	let shareDropdownOpen = $state(false);
	let socialProof = $state(null);

	// ===== Derived =====
	const dealId = $derived($page.params.id);
	const isPaid = $derived($isAcademy || $isAdmin);
	const currentStage = $derived(deal ? ($dealStages[deal.id] || 'browse') : 'browse');

	const stages = [
		{ key: 'browse', label: 'Filter', num: '1' },
		{ key: 'saved', label: 'Review', num: '2' },
		{ key: 'diligence', label: 'Connect', num: '3' },
		{ key: 'decision', label: 'Decide', num: '4' },
		{ key: 'invested', label: 'Invested', num: '5' }
	];
	const stageOrder = { browse: 0, saved: 1, diligence: 2, decision: 3, invested: 4 };
	const currentStageIdx = $derived(currentStage === 'passed' ? -1 : (stageOrder[currentStage] ?? 0));

	const isCredit = $derived(deal ? isCreditFund(deal) : false);
	const heroClass = $derived(isCredit ? 'hero-lending' : 'hero-equity');

	const completenessKeys = ['investmentName','assetClass','dealType','strategy','investmentStrategy','targetIRR','preferredReturn','cashOnCash','investmentMinimum','holdPeriod','offeringType','offeringSize','distributions','lpGpSplit','fees','financials','investingGeography','instrument','deckUrl','ppmUrl','secCik','managementCompanyId','purchasePrice','status'];
	const completeness = $derived(deal ? getCompleteness(deal) : 0);

	const isStale = $derived(deal ? checkStaleness(deal) : false);

	// DD Checklist
	const checklist = $derived(deal ? getChecklistForDeal(deal) : null);
	const ddProgress = $derived(checklist ? calcDDProgress(checklist, ddAnswers, deal) : { answered: 0, total: 0, pct: 0 });

	// Next stage for advance button
	const nextStage = $derived(() => {
		const idx = currentStageIdx;
		if (idx < 0 || idx >= stages.length - 1) return null;
		return stages[idx + 1];
	});

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
		const next = nextStage();
		if (next) {
			dealStages.setStage(deal.id, next.key);
		}
	}

	function skipDeal() {
		if (!deal) return;
		dealStages.setStage(deal.id, 'passed');
	}

	function setStage(stageKey) {
		if (!deal) return;
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
			localStorage.setItem('gycDDChecklist_' + deal.id, JSON.stringify(updated));
		}
		// Sync to backend
		try {
			const stored = browser ? JSON.parse(localStorage.getItem('gycUser') || '{}') : {};
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

	function copyDealLink() {
		if (!browser || !deal) return;
		navigator.clipboard.writeText(window.location.href);
		shareDropdownOpen = false;
	}

	function requestIntroduction() {
		if (!deal) return;
		if (!$isLoggedIn) {
			// Show a simple alert for now; in production this would be a modal
			window.location.href = `/login?return=${encodeURIComponent(window.location.pathname)}`;
			return;
		}
		const stored = browser ? JSON.parse(localStorage.getItem('gycUser') || '{}') : {};
		fetch('/api/events', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${stored.token || ''}` },
			body: JSON.stringify({
				event: 'intro_requested',
				dealId: deal.id,
				dealName: deal.investmentName,
				managementCompany: deal.managementCompany
			})
		}).catch(() => {});
		// Advance stage to Connect
		if (currentStageIdx < 2) {
			dealStages.setStage(deal.id, 'diligence');
		}
	}

	// ===== Lifecycle =====
	onMount(() => {
		if (!deal) return;
		// Load DD answers from localStorage
		try {
			const stored = JSON.parse(localStorage.getItem('gycDDChecklist_' + deal.id) || '{}');
			ddAnswers = stored;
		} catch { ddAnswers = {}; }

		// Load social proof
		const token = (() => { try { return JSON.parse(localStorage.getItem('gycUser') || '{}').token || ''; } catch { return ''; } })();
		const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
		fetch(`/api/deal-stats?dealId=${encodeURIComponent(deal.id)}`, { headers })
			.then(r => r.ok ? r.json() : null)
			.then(stats => { if (stats) socialProof = stats; })
			.catch(() => {});

		// Set document title
		document.title = `${deal.investmentName} - GYC Dealflow`;
	});

	// Close share dropdown on outside click
	function handleOutsideClick(e) {
		if (shareDropdownOpen) shareDropdownOpen = false;
	}
</script>

<svelte:window onclick={handleOutsideClick} />

<Sidebar currentPage="deals" />

<main class="main">
	<div class="content-wrap">
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

			<div class="deal-page-content">
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
								{@const total = (socialProof.interested || 0) + (socialProof.saved || 0) + (socialProof.duediligence || 0) + (socialProof.vetting || 0) + (socialProof.portfolio || 0) + (socialProof.invested || 0)}
								{#if total > 0}
									<div class="hero-social-proof">
										<div class="sp-avatars">
											{#each (socialProof.namedInvestors || []).concat(socialProof.namedWatchers || []).slice(0, 5) as name, i}
												<div class="sp-avatar" style="background:{['#51BE7B','#3b82f6','#f59e0b','#ec4899','#8b5cf6'][i % 5]}" title={name}>{name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0,2)}</div>
											{/each}
											{#if total > 5}
												<div class="sp-avatar sp-count">+{total - 5}</div>
											{/if}
										</div>
										<div class="sp-text">
											<strong>{total}</strong> <span class="sp-dim">GYC member{total !== 1 ? 's are' : ' is'} reviewing this deal</span>
										</div>
									</div>
								{/if}
							{/if}
						</div>

						<!-- Hero Right: CTA buttons -->
						<div class="hero-right">
							{#if deal.deckUrl && !deal.deckUrl.includes('airtableusercontent.com')}
								<a href={deal.deckUrl} target="_blank" rel="noopener" class="hero-deck-btn">
									<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
									View Investment Deck
								</a>
							{/if}
							<button class="hero-deck-btn hero-intro-btn" onclick={requestIntroduction}>
								<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/></svg>
								Request Introduction
							</button>
							<!-- Share -->
							<div class="share-wrapper">
								<button class="hero-share-btn" onclick={(e) => { e.stopPropagation(); shareDropdownOpen = !shareDropdownOpen; }}>
									<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
									Share Deal
								</button>
								{#if shareDropdownOpen}
									<div class="share-dropdown active" onclick={(e) => e.stopPropagation()}>
										<button class="share-dropdown-item" onclick={copyDealLink}>
											<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
											Copy link
										</button>
									</div>
								{/if}
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
							class:passed={currentStage === 'passed' && i === 0}
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

				<!-- ==================== DATA COMPLETENESS ==================== -->
				<div class="data-completeness">
					<span class="data-completeness-label">Data Quality</span>
					<div class="data-completeness-bar">
						<div class="data-completeness-fill {completeness >= 70 ? 'high' : completeness >= 40 ? 'medium' : 'low'}" style="width:{completeness}%"></div>
					</div>
					<span class="data-completeness-pct">{completeness}%</span>
					<span class="data-completeness-hint">{completeness >= 70 ? 'Well documented' : completeness >= 40 ? 'Partial data' : 'Limited data'}</span>
				</div>

				<!-- ==================== KEY METRICS STRIP ==================== -->
				{#if deal.targetIRR || deal.investmentMinimum}
					<div class="metrics-strip">
						{#if deal.targetIRR}
							<div class="metric-card"><div class="metric-label">{isCredit ? 'Target Yield' : 'Target IRR'}</div><div class="metric-value highlight">{fmt(deal.targetIRR, 'pct')}</div></div>
						{/if}
						{#if deal.investmentMinimum}
							<div class="metric-card"><div class="metric-label">Min Investment</div><div class="metric-value">{fmt(deal.investmentMinimum, 'money')}</div></div>
						{/if}
						{#if isPaid}
							{#if !isCredit && deal.equityMultiple}
								<div class="metric-card"><div class="metric-label">Equity Multiple</div><div class="metric-value">{fmt(deal.equityMultiple, 'multiple')}</div></div>
							{/if}
							{#if deal.preferredReturn}
								<div class="metric-card"><div class="metric-label">Pref Return</div><div class="metric-value">{fmt(deal.preferredReturn, 'pct')}</div></div>
							{/if}
							{#if deal.holdPeriod}
								<div class="metric-card"><div class="metric-label">{isCredit ? 'Lockup' : 'Hold Period'}</div><div class="metric-value">{formatHold(deal.holdPeriod)}</div></div>
							{/if}
							{#if isCredit && deal.fundAUM}
								<div class="metric-card"><div class="metric-label">Fund AUM</div><div class="metric-value">{fmt(deal.fundAUM, 'money')}</div></div>
							{/if}
						{:else}
							<div class="metric-card metric-locked" onclick={() => window.location.href = '/app/deals#academy'}>
								<span class="metric-label">+ More Metrics</span>
							</div>
						{/if}
					</div>
				{/if}

				<!-- ==================== DEAL TERMS ==================== -->
				<div class="two-col-grid">
					<div class="section">
						<div class="section-header">
							<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="18" height="18"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
							<span class="section-title">Deal Terms</span>
						</div>
						<div class="section-body">
							<div class="details-grid">
								<div class="detail-item"><div class="detail-label">Target IRR</div><div class="detail-value">{fmt(deal.targetIRR, 'pct')}</div></div>
								{#if isCredit}
									<div class="detail-item"><div class="detail-label">Pref Return</div><div class="detail-value">{fmt(deal.preferredReturn, 'pct')}</div></div>
								{:else}
									<div class="detail-item"><div class="detail-label">Cash-on-Cash</div><div class="detail-value">{fmt(deal.cashOnCash, 'pct')}</div></div>
								{/if}
								<div class="detail-item"><div class="detail-label">Min Investment</div><div class="detail-value">{fmt(deal.investmentMinimum, 'money')}</div></div>
								<div class="detail-item"><div class="detail-label">Lockup</div><div class="detail-value">{formatHold(deal.holdPeriod)}</div></div>
								<div class="detail-item"><div class="detail-label">Distributions</div><div class="detail-value">{deal.distributions || '---'}</div></div>
								<div class="detail-item"><div class="detail-label">Offering Type</div><div class="detail-value">{deal.offeringType || '---'}</div></div>
								{#if deal.equityMultiple}
									<div class="detail-item"><div class="detail-label">Equity Multiple</div><div class="detail-value">{fmt(deal.equityMultiple, 'multiple')}</div></div>
								{/if}
								{#if deal.lpGpSplit && /\d+\s*\/\s*\d+/.test(deal.lpGpSplit)}
									<div class="detail-item"><div class="detail-label">LP/GP Split</div><div class="detail-value">{deal.lpGpSplit}</div></div>
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

					<!-- Right column: Operator + Documents -->
					<div>
						<!-- Operator Card -->
						{#if deal.managementCompany}
							<div class="section">
								<div class="section-header">
									<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
									<span class="section-title">Operator</span>
								</div>
								<div class="section-body">
									<div class="operator-card-content">
										<div class="operator-avatar">{getInitials(deal.managementCompany)}</div>
										<div class="operator-info">
											<a href="/sponsor?company={encodeURIComponent(deal.managementCompany)}" class="operator-name">{deal.managementCompany}</a>
											{#if deal.ceo}<div class="operator-ceo">CEO: {deal.ceo}</div>{/if}
											{#if deal.mcFoundingYear}<div class="operator-meta">Founded {deal.mcFoundingYear}</div>{/if}
										</div>
									</div>
									<a href="/sponsor?company={encodeURIComponent(deal.managementCompany)}" class="operator-link">View Operator Profile &rarr;</a>
								</div>
							</div>
						{/if}

						<!-- Documents Card -->
						<div class="section">
							<div class="section-header">
								<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
								<span class="section-title">Documents</span>
							</div>
							<div class="section-body doc-list">
								{#if deal.deckUrl && !deal.deckUrl.includes('airtableusercontent.com')}
									<a href={deal.deckUrl} target="_blank" rel="noopener" class="doc-item">
										<svg viewBox="0 0 24 24" fill="none" stroke="var(--primary)" stroke-width="2" width="16" height="16"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
										Investment Deck
									</a>
								{/if}
								{#if deal.ppmUrl && !deal.ppmUrl.includes('airtableusercontent.com')}
									{#if isPaid}
										<a href={deal.ppmUrl} target="_blank" rel="noopener" class="doc-item">
											<svg viewBox="0 0 24 24" fill="none" stroke="var(--primary)" stroke-width="2" width="16" height="16"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
											Private Placement Memorandum
										</a>
									{:else}
										<div class="doc-item doc-locked">
											<svg viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" stroke-width="2" width="16" height="16"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
											PPM (Academy Only)
										</div>
									{/if}
								{/if}
								{#if !deal.deckUrl && !deal.ppmUrl}
									<div class="doc-empty">No documents available yet</div>
								{/if}
							</div>
						</div>
					</div>
				</div>

				<!-- ==================== OVERVIEW ==================== -->
				{#if deal.investmentStrategy}
					<div class="section">
						<div class="section-header">
							<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
							<span class="section-title">Overview</span>
						</div>
						<div class="section-body">
							<div class="overview-text">{deal.investmentStrategy}</div>
						</div>
					</div>
				{/if}

				<!-- ==================== DD CHECKLIST ==================== -->
				{#if checklist}
					<div class="section">
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
										<div class="gate-title">Unlock Due Diligence Checklist</div>
										<div class="gate-text">Academy members get a {checklist.sections.length}-section interactive DD checklist with auto-filled answers for every deal.</div>
										<a href="/app/deals#academy" class="gate-cta">Join Academy &rarr;</a>
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

				<!-- ==================== Q&A (Coming Soon) ==================== -->
				<div class="section">
					<div class="section-header">
						<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
						<span class="section-title">Investor Q&A</span>
					</div>
					<div class="section-body coming-soon-section">
						<div class="coming-soon-overlay">
							<div class="coming-soon-label">Coming Soon</div>
							<div class="coming-soon-desc">Ask questions and discuss deals during weekly office hours</div>
						</div>
						<div class="coming-soon-placeholder">
							<div class="qa-placeholder-item">What is the redemption policy for this fund?</div>
							<div class="qa-placeholder-item">How are distributions calculated and paid?</div>
							<div class="qa-placeholder-item">What happens if the fund doesn't hit its raise target?</div>
						</div>
					</div>
				</div>

				<!-- ==================== COMMUNITY ==================== -->
				{#if socialProof}
					{@const reviewing = (socialProof.interested || 0) + (socialProof.saved || 0) + (socialProof.duediligence || 0) + (socialProof.vetting || 0)}
					{@const invested = (socialProof.portfolio || 0) + (socialProof.invested || 0)}
					{#if reviewing > 0 || invested > 0}
						<div class="section">
							<div class="section-header">
								<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
								<span class="section-title">GYC Community</span>
							</div>
							<div class="section-body">
								{#if reviewing > 0}
									<div class="community-stat">
										<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
										{reviewing} LP{reviewing === 1 ? '' : 's'} {reviewing === 1 ? 'is' : 'are'} reviewing this deal
									</div>
								{/if}
								{#if invested > 0}
									<div class="community-stat invested">
										<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
										{invested} LP{invested === 1 ? '' : 's'} from the network {invested === 1 ? 'has' : 'have'} invested
									</div>
								{/if}
								<div class="community-privacy">Your financial details are never shared.</div>
							</div>
						</div>
					{/if}
				{/if}

			</div><!-- /deal-page-content -->

			<!-- ==================== STICKY ACTION BAR ==================== -->
			<div class="sticky-action-bar">
				<button class="btn-pass" onclick={skipDeal}>
					<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
					Skip
				</button>
				<span class="stage-label">
					Stage: <strong>{STAGE_META[currentStage]?.label || 'Filter'}</strong>
				</span>
				{#if nextStage()}
					<button class="btn-advance" onclick={advanceStage}>
						Move to {nextStage().label}
						<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><polyline points="9 18 15 12 9 6"/></svg>
					</button>
				{:else if currentStage === 'invested'}
					<span class="stage-label" style="color:var(--primary);font-weight:700;">Invested</span>
				{/if}
			</div>
		{/if}
	</div>
</main>

<style>
	/* ===== Layout ===== */
	.main {
		margin-left: 240px;
		min-height: 100vh;
		background: var(--bg-cream);
		transition: margin-left 0.3s ease;
	}
	.content-wrap {
		max-width: 1200px;
		padding: 32px 40px 64px;
		margin: 0 auto;
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
	.not-found h2 { font-family: var(--font-headline); font-size: 28px; margin-bottom: 8px; }
	.not-found p { color: var(--text-secondary); margin-bottom: 24px; }
	.btn-primary { display: inline-block; padding: 12px 24px; background: var(--primary); color: #fff; border-radius: 8px; font-family: var(--font-ui); font-weight: 700; text-decoration: none; }

	/* ===== Breadcrumb ===== */
	.breadcrumb { display: flex; align-items: center; gap: 8px; margin-bottom: 20px; font-family: var(--font-ui); font-size: 13px; font-weight: 500; color: var(--text-muted); }
	.breadcrumb a { color: var(--primary); text-decoration: none; }

	/* ===== Deal Header / Hero ===== */
	.deal-header { background: linear-gradient(145deg, #1a1f2e 0%, #252b3b 100%); border-radius: 12px; padding: 36px 40px; margin-bottom: 24px; position: relative; overflow: hidden; }
	.deal-header.hero-lending { background: linear-gradient(145deg, #1a2433 0%, #1e2d3d 100%); }
	.hero-type-icon { position: absolute; bottom: 20px; right: 24px; opacity: 0.06; z-index: 0; }
	.hero-type-icon svg { width: 120px; height: 120px; stroke: #fff; stroke-width: 1; fill: none; }
	.deal-header-inner { position: relative; z-index: 1; display: flex; gap: 32px; align-items: center; justify-content: space-between; }
	.hero-left { flex: 1; min-width: 0; }
	.hero-right { flex-shrink: 0; display: flex; flex-direction: column; align-items: stretch; gap: 8px; text-align: center; }

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

	.hero-metrics { display: flex; gap: 24px; margin-top: 16px; flex-wrap: wrap; }
	.hero-metric { display: flex; flex-direction: column; }
	.hero-metric-value { font-family: var(--font-ui); font-size: 22px; font-weight: 800; color: #fff; letter-spacing: -0.5px; line-height: 1.1; }
	.hero-metric-value.highlight { color: #40E47F; }
	.hero-metric-label { font-family: var(--font-ui); font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: rgba(255,255,255,0.45); margin-top: 2px; }

	.hero-summary { font-family: var(--font-body); font-size: 13px; color: rgba(255,255,255,0.65); line-height: 1.5; margin-top: 12px; max-width: 560px; }

	.hero-operator-line { display: flex; align-items: center; gap: 12px; margin-top: 14px; padding-top: 12px; border-top: 1px solid rgba(255,255,255,0.1); }
	.hero-operator-label { font-family: var(--font-ui); font-size: 12px; color: rgba(255,255,255,0.5); text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600; }
	.hero-operator-link { display: flex; align-items: center; gap: 8px; color: #fff; text-decoration: none; font-family: var(--font-ui); font-size: 13px; font-weight: 600; }
	.hero-operator-avatar { width: 28px; height: 28px; border-radius: 50%; background: rgba(255,255,255,0.15); display: flex; align-items: center; justify-content: center; font-size: 10px; font-weight: 700; }
	.hero-operator-years { color: rgba(255,255,255,0.4); font-weight: 400; font-size: 11px; }

	/* Social Proof in hero */
	.hero-social-proof { display: flex; align-items: center; gap: 12px; margin-top: 14px; padding-top: 12px; border-top: 1px solid rgba(255,255,255,0.08); }
	.sp-avatars { display: flex; }
	.sp-avatar { width: 28px; height: 28px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-family: var(--font-ui); font-size: 10px; font-weight: 700; color: #fff; margin-left: -6px; border: 2px solid #1a1f2e; }
	.sp-avatar:first-child { margin-left: 0; }
	.sp-count { background: rgba(255,255,255,0.2); font-size: 9px; }
	.sp-text { font-family: var(--font-ui); font-size: 12px; color: rgba(255,255,255,0.7); }
	.sp-dim { color: rgba(255,255,255,0.45); }

	/* Hero CTA buttons */
	.hero-deck-btn { display: inline-flex; align-items: center; justify-content: center; gap: 10px; padding: 14px 28px; background: #40E47F; color: #0a1628; font-family: var(--font-ui); font-size: 14px; font-weight: 700; border-radius: 8px; text-decoration: none; cursor: pointer; transition: background 0.15s, transform 0.1s; white-space: nowrap; border: none; }
	.hero-deck-btn:hover { background: #34d399; transform: translateY(-1px); }
	.hero-intro-btn { background: rgba(255,255,255,0.12); border: 1px solid rgba(255,255,255,0.25); color: #fff; width: 100%; }
	.hero-intro-btn:hover { background: rgba(255,255,255,0.18); }
	.hero-share-btn { display: inline-flex; align-items: center; gap: 6px; padding: 0; background: none; color: rgba(255,255,255,0.5); font-family: var(--font-ui); font-size: 12px; font-weight: 600; border: none; cursor: pointer; }
	.hero-share-btn:hover { color: rgba(255,255,255,0.85); }
	.share-wrapper { position: relative; }
	.share-dropdown { position: absolute; bottom: 100%; right: 0; margin-bottom: 8px; background: #fff; border: 1px solid var(--border); border-radius: 8px; box-shadow: 0 8px 24px rgba(0,0,0,0.12); padding: 6px 0; min-width: 200px; z-index: 50; }
	.share-dropdown-item { display: flex; align-items: center; gap: 10px; padding: 10px 16px; font-family: var(--font-ui); font-size: 13px; font-weight: 500; color: var(--text-dark); cursor: pointer; transition: background 0.1s; border: none; background: none; width: 100%; }
	.share-dropdown-item:hover { background: var(--bg-cream); }

	/* Archived banner */
	.archived-banner { background: rgba(138,154,160,0.08); border: 1px solid rgba(138,154,160,0.2); border-radius: 8px; padding: 14px 20px; margin-bottom: 16px; display: flex; align-items: center; gap: 10px; font-family: var(--font-ui); font-size: 13px; }
	.archived-banner strong { color: var(--text-secondary); font-weight: 700; }
	.archived-banner span { color: var(--text-muted); font-size: 12px; margin-left: 8px; }

	/* ===== Journey Bar ===== */
	.journey-bar { display: flex; align-items: center; justify-content: center; gap: 0; margin-bottom: 20px; padding: 14px 12px; background: var(--bg-card); border: 1px solid var(--border); border-radius: 12px; }
	.journey-step { display: flex; flex-direction: column; align-items: center; gap: 4px; cursor: pointer; padding: 4px 8px; border-radius: 12px; transition: all 0.2s; font-family: var(--font-ui); font-size: 10px; font-weight: 600; color: var(--text-muted); white-space: nowrap; text-align: center; background: none; border: none; }
	.journey-step:hover { background: var(--bg-cream); color: var(--text-dark); }
	.step-dot { width: 28px; height: 28px; border-radius: 50%; border: 2px solid var(--border); display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 700; color: var(--text-muted); background: var(--bg-cream); transition: all 0.2s; flex-shrink: 0; }
	.journey-step.active .step-dot { background: var(--primary); border-color: var(--primary); color: #fff; }
	.journey-step.active { color: var(--primary); background: rgba(81,190,123,0.08); }
	.journey-step.completed .step-dot { background: var(--primary); border-color: var(--primary); color: #fff; }
	.journey-step.completed { color: var(--text-dark); }
	.journey-step.passed .step-dot { background: #D04040; border-color: #D04040; color: #fff; }
	.journey-step.passed { color: #D04040; }
	.journey-connector { flex: 1; min-width: 12px; max-width: 40px; height: 2px; background: var(--border); align-self: center; margin-top: -16px; }
	.journey-connector.done { background: var(--primary); }

	/* ===== Data Completeness ===== */
	.data-completeness { display: flex; align-items: center; gap: 14px; padding: 14px 20px; background: var(--bg-card); border: 1px solid var(--border); border-radius: 12px; margin-bottom: 24px; font-family: var(--font-ui); }
	.data-completeness-label { font-size: 13px; font-weight: 700; color: var(--text-dark); white-space: nowrap; }
	.data-completeness-bar { flex: 1; height: 6px; background: var(--border-light); border-radius: 3px; overflow: hidden; }
	.data-completeness-fill { height: 100%; border-radius: 3px; transition: width 0.5s ease; }
	.data-completeness-fill.high { background: var(--primary); }
	.data-completeness-fill.medium { background: #f59e0b; }
	.data-completeness-fill.low { background: #ef4444; }
	.data-completeness-pct { font-size: 14px; font-weight: 800; color: var(--text-dark); min-width: 36px; text-align: right; }
	.data-completeness-hint { font-size: 12px; color: var(--text-muted); white-space: nowrap; }

	/* ===== Metrics Strip ===== */
	.metrics-strip { display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 12px; margin-bottom: 24px; }
	.metric-card { background: var(--bg-card); border: 1px solid var(--border); border-radius: 12px; padding: 16px 18px; text-align: center; box-shadow: 0 1px 3px rgba(0,0,0,0.06); }
	.metric-label { font-family: var(--font-ui); font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.8px; color: var(--text-muted); margin-bottom: 6px; }
	.metric-value { font-family: var(--font-ui); font-size: 20px; font-weight: 800; color: var(--text-dark); letter-spacing: -0.5px; }
	.metric-value.highlight { color: var(--primary); }
	.metric-locked { display: flex; align-items: center; justify-content: center; min-height: 52px; cursor: pointer; border-style: dashed; background: rgba(59,130,246,0.04); border-color: rgba(59,130,246,0.2); }
	.metric-locked .metric-label { color: #3b82f6; font-size: 11px; margin: 0; }

	/* ===== Two Column Grid ===== */
	.two-col-grid { display: grid; grid-template-columns: 2fr 1fr; gap: 20px; align-items: start; margin-bottom: 20px; }

	/* ===== Sections ===== */
	.section { background: var(--bg-card); border: 1px solid var(--border); border-radius: 12px; margin-bottom: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.06); overflow: hidden; }
	.section-header { padding: 18px 24px; border-bottom: 1px solid var(--border-light); display: flex; align-items: center; gap: 10px; }
	.section-header svg { color: var(--primary); flex-shrink: 0; }
	.section-title { font-family: var(--font-ui); font-size: 15px; font-weight: 700; color: var(--text-dark); letter-spacing: -0.2px; }
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
	.operator-avatar { width: 44px; height: 44px; border-radius: 50%; background: var(--primary); display: flex; align-items: center; justify-content: center; color: #fff; font-family: var(--font-ui); font-weight: 800; font-size: 14px; flex-shrink: 0; }
	.operator-info { flex: 1; min-width: 0; }
	.operator-name { font-family: var(--font-ui); font-size: 14px; font-weight: 700; color: var(--text-dark); text-decoration: none; }
	.operator-name:hover { color: var(--primary); }
	.operator-ceo { font-family: var(--font-ui); font-size: 12px; color: var(--text-secondary); margin-top: 2px; }
	.operator-meta { font-family: var(--font-ui); font-size: 11px; color: var(--text-muted); }
	.operator-link { font-family: var(--font-ui); font-size: 12px; font-weight: 600; color: var(--primary); text-decoration: none; }

	/* ===== Documents ===== */
	.doc-list { display: flex; flex-direction: column; gap: 8px; }
	.doc-item { display: flex; align-items: center; gap: 10px; padding: 10px 14px; background: var(--bg-cream); border-radius: 8px; text-decoration: none; font-family: var(--font-ui); font-size: 13px; font-weight: 600; color: var(--text-dark); transition: background 0.15s; }
	.doc-item:hover { background: rgba(81,190,123,0.08); }
	.doc-locked { color: var(--text-muted); cursor: default; }
	.doc-empty { font-family: var(--font-body); font-size: 13px; color: var(--text-muted); }

	/* ===== DD Checklist ===== */
	.dd-section-body { position: relative; min-height: 120px; }
	.dd-progress-ring { margin-left: auto; flex-shrink: 0; }
	.dd-checklist-subtitle { font-family: var(--font-ui); font-size: 12px; color: var(--text-muted); margin-bottom: 16px; }
	.dd-accordion.blurred { opacity: 0.15; pointer-events: none; user-select: none; }
	.dd-accordion-section { border: 1px solid var(--border-light); border-radius: 8px; margin-bottom: 8px; }
	.dd-accordion-header { display: flex; align-items: center; justify-content: space-between; width: 100%; padding: 12px 16px; background: none; border: none; cursor: pointer; font-family: var(--font-ui); font-size: 13px; font-weight: 700; color: var(--text-dark); }
	.dd-accordion-title { display: flex; align-items: center; gap: 8px; }
	.chevron { transition: transform 0.2s; }
	.chevron.open { transform: rotate(90deg); }
	.dd-accordion-progress { font-size: 11px; color: var(--text-muted); font-weight: 600; }
	.dd-accordion-body { padding: 0 16px 12px; }
	.dd-question { padding: 10px 0; border-bottom: 1px solid var(--border-light); }
	.dd-question:last-child { border-bottom: none; }
	.dd-question.answered { }
	.dd-question-text { font-family: var(--font-ui); font-size: 13px; font-weight: 500; color: var(--text-dark); margin-bottom: 6px; }
	.dd-answer { display: flex; align-items: flex-start; gap: 8px; }
	.dd-answer-icon { width: 20px; height: 20px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; margin-top: 2px; }
	.dd-answer-icon.auto svg { color: var(--primary); }
	.dd-answer-icon.user svg { color: var(--blue); }
	.dd-answer-icon.empty svg { color: var(--text-muted); }
	.dd-answer-text { font-family: var(--font-body); font-size: 13px; color: var(--text-secondary); line-height: 1.5; }
	.dd-answer-badge { font-family: var(--font-ui); font-size: 9px; font-weight: 700; padding: 2px 6px; border-radius: 4px; text-transform: uppercase; letter-spacing: 0.3px; }
	.dd-answer-badge.auto { background: rgba(81,190,123,0.1); color: var(--primary); }
	.dd-answer-badge.user { background: rgba(59,130,246,0.1); color: var(--blue); }
	.dd-answer-input { flex: 1; padding: 6px 10px; border: 1px solid var(--border); border-radius: 6px; font-family: var(--font-body); font-size: 13px; outline: none; }
	.dd-answer-input:focus { border-color: var(--primary); }

	/* Gate overlay */
	.gate-overlay { position: absolute; inset: 0; z-index: 5; display: flex; align-items: center; justify-content: center; background: rgba(255,255,255,0.7); backdrop-filter: blur(4px); -webkit-backdrop-filter: blur(4px); border-radius: 12px; }
	.gate-content { text-align: center; max-width: 340px; padding: 28px 20px 36px; }
	.gate-icon { width: 40px; height: 40px; border-radius: 50%; background: linear-gradient(135deg, #3b82f6, #4ade80); display: flex; align-items: center; justify-content: center; margin: 0 auto 12px; }
	.gate-title { font-family: var(--font-ui); font-size: 15px; font-weight: 800; color: var(--text-dark); margin-bottom: 4px; }
	.gate-text { font-family: var(--font-body); font-size: 12px; color: var(--text-secondary); margin-bottom: 14px; line-height: 1.5; }
	.gate-cta { display: inline-block; padding: 10px 24px; background: var(--primary); color: #fff; border-radius: 8px; font-family: var(--font-ui); font-size: 13px; font-weight: 700; text-decoration: none; }

	/* Coming Soon */
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

	/* ===== Sticky Action Bar ===== */
	.sticky-action-bar { position: fixed; bottom: 0; left: 240px; right: 0; background: var(--bg-card); border-top: 1px solid var(--border); padding: 12px 32px; display: flex; align-items: center; justify-content: center; gap: 12px; z-index: 100; box-shadow: 0 -4px 20px rgba(0,0,0,0.06); }
	.btn-pass { padding: 10px 20px; border: 1px solid var(--border); background: var(--bg-card); border-radius: 8px; font-family: var(--font-ui); font-size: 13px; font-weight: 600; color: var(--text-muted); cursor: pointer; display: flex; align-items: center; gap: 6px; }
	.btn-pass:hover { border-color: #ef4444; color: #ef4444; }
	.btn-advance { padding: 10px 24px; background: var(--primary); color: #fff; border: none; border-radius: 8px; font-family: var(--font-ui); font-size: 13px; font-weight: 700; cursor: pointer; display: flex; align-items: center; gap: 6px; transition: all 0.15s; }
	.btn-advance:hover { background: #3da86a; transform: translateY(-1px); }
	.stage-label { font-size: 12px; color: var(--text-muted); font-family: var(--font-ui); }

	.deal-page-content { padding-bottom: 80px; }

	/* ===== Responsive ===== */
	@media (max-width: 900px) {
		.deal-header-inner { flex-direction: column; align-items: flex-start; }
		.hero-right { flex-direction: row; align-items: center; gap: 8px; flex-wrap: wrap; }
		.two-col-grid { grid-template-columns: 1fr; }
	}
	@media (max-width: 768px) {
		.main { margin-left: 0; padding-top: 56px; }
		.content-wrap { padding: 20px 16px 80px; }
		.sticky-action-bar { left: 0; padding: 10px 16px; }
		.data-completeness-hint { display: none; }
		.details-grid { grid-template-columns: repeat(2, 1fr); gap: 14px; }
		.deal-name { font-size: 22px; }
		.hero-metrics { gap: 12px 16px; }
		.hero-metric-value { font-size: 18px; }
		.deal-header { padding: 24px 20px; }
		.journey-bar { padding: 10px 6px; overflow-x: auto; -webkit-overflow-scrolling: touch; }
		.journey-step { font-size: 9px; padding: 3px 4px; }
		.step-dot { width: 24px; height: 24px; font-size: 11px; }
		.journey-connector { min-width: 8px; max-width: 20px; }
	}
	@media (max-width: 480px) {
		.details-grid { grid-template-columns: 1fr; }
		.deal-name { font-size: 20px; }
		.hero-metrics { flex-wrap: wrap; }
	}
</style>
