<script>
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';
	import { deals, dealStages, fetchDeals } from '$lib/stores/deals.js';
	import { getStoredSessionToken, isMember } from '$lib/stores/auth.js';
	import AddDealModal from '$lib/components/AddDealModal.svelte';
	import PageContainer from '$lib/layout/PageContainer.svelte';
	import PageHeader from '$lib/layout/PageHeader.svelte';
	import { readUserScopedJson, writeUserScopedJson } from '$lib/utils/userScopedState.js';
	import { buildInvestedPortfolio, normalizePortfolioRecord } from '$lib/utils/investedPortfolio.js';
	const USER_SCOPED_STATE_EVENT = 'gyc:user-scoped-state-updated';

	function createEmptyInvestmentDraft() {
		return {
			investmentName: '',
			sponsor: '',
			assetClass: '',
			amountInvested: '',
			dateInvested: '',
			status: 'Active',
			targetIRR: '',
			actualYear1CashFlow: '',
			actualYear1Depreciation: '',
			distributionsReceived: '',
			equityMultiple: '',
			investingEntity: '',
			entityInvestedInto: '',
			holdPeriod: '',
			notes: '',
			dealId: ''
		};
	}

	let portfolioDetails = $state([]);
	let wizardData = $state({});
	let showIntakeModal = $state(false);
	let editingId = $state('');
	let activePortfolioTab = $state('holdings');

	// Modal form data
	let modalData = $state(createEmptyInvestmentDraft());
	const portfolioView = $derived.by(() =>
		buildInvestedPortfolio({
			stageMap: $dealStages || {},
			deals: $deals || [],
			portfolio: portfolioDetails
		})
	);
	const portfolio = $derived.by(() => portfolioView.entries);
	const metricPortfolio = $derived.by(() => portfolioView.metricEntries || []);
	const pendingEntries = $derived.by(() => portfolioView.pendingEntries || []);
	const canViewAnalysis = $derived($isMember);
	const hasPersistedDetails = $derived.by(() =>
		portfolioDetails.some((investment) => investment.id === editingId)
	);

	const totalInvested = $derived(metricPortfolio.reduce((s, i) => s + (parseFloat(i.amountInvested) || 0), 0));
	const avgIRR = $derived.by(() => {
		const withIRR = metricPortfolio.filter(i => i.targetIRR);
		if (withIRR.length === 0) return 0;
		return withIRR.reduce((s, i) => s + parseFloat(i.targetIRR), 0) / withIRR.length;
	});
	const avgHoldPeriodYears = $derived.by(() => {
		const withHoldPeriod = metricPortfolio
			.map((investment) => parseFloat(investment.holdPeriod))
			.filter((value) => Number.isFinite(value) && value > 0);
		if (withHoldPeriod.length === 0) return 0;
		return withHoldPeriod.reduce((sum, value) => sum + value, 0) / withHoldPeriod.length;
	});
	const avgHoldPeriodMonths = $derived.by(() => (avgHoldPeriodYears > 0 ? avgHoldPeriodYears * 12 : 0));
	const totalYear1CashFlow = $derived.by(() =>
		metricPortfolio.reduce((sum, investment) => sum + (parsePortfolioCurrency(investment.displayYear1CashFlow) || 0), 0)
	);
	const totalYear1Depreciation = $derived.by(() =>
		metricPortfolio.reduce((sum, investment) => sum + (parsePortfolioCurrency(investment.displayYear1Depreciation) || 0), 0)
	);
	const assetClasses = $derived(new Set(metricPortfolio.map(i => i.assetClass).filter(Boolean)));
	const sponsors = $derived(new Set(metricPortfolio.map(i => i.sponsor).filter(Boolean)));

	const allocationMap = $derived.by(() => {
		const map = {};
		metricPortfolio.forEach(i => { const cls = i.assetClass || 'Other'; map[cls] = (map[cls] || 0) + (parseFloat(i.amountInvested) || 0); });
		return map;
	});
	const allocationEntries = $derived(Object.entries(allocationMap).sort((a, b) => b[1] - a[1]));
	const allocationTotal = $derived(allocationEntries.reduce((sum, [, amount]) => sum + amount, 0));
	const allocationSlices = $derived.by(() => {
		if (allocationEntries.length === 0 || allocationTotal === 0) return [];
		let currentAngle = -90;
		return allocationEntries.map(([assetClass, amount], index) => {
			const pct = amount / allocationTotal;
			const angle = pct * 360;
			const startAngle = currentAngle * Math.PI / 180;
			const endAngle = (currentAngle + angle) * Math.PI / 180;
			const largeArcFlag = angle > 180 ? 1 : 0;
			const x1 = 80 + 60 * Math.cos(startAngle);
			const y1 = 80 + 60 * Math.sin(startAngle);
			const x2 = 80 + 60 * Math.cos(endAngle);
			const y2 = 80 + 60 * Math.sin(endAngle);
			currentAngle += angle;
			return {
				assetClass,
				amount,
				pct,
				color: PIE_COLORS[index % PIE_COLORS.length],
				x1,
				y1,
				x2,
				y2,
				largeArcFlag,
				isOnly: allocationEntries.length === 1
			};
		});
	});
	const capitalGoal = $derived.by(() => {
		const candidates = [
			wizardData.targetPortfolio,
			wizardData.capitalGoal,
			wizardData.goalCapital,
			wizardData.growthCapital,
			wizardData.capitalAvailable
		];
		const matched = candidates
			.map((value) => parseDollar(value))
			.find((value) => value > 0);
		return matched || 1000000;
	});

	// Risk insights
	const riskInsights = $derived.by(() => {
		const insights = [];
		if (totalInvested === 0) return [{ type: 'ok', text: 'Add investments to see risk analysis.' }];
		const alloc = allocationMap;
		for (const [cls, amt] of Object.entries(alloc)) {
			const pct = (amt / totalInvested) * 100;
			if (pct > 50) {
				insights.push({
					type: 'danger',
					text: 'High concentration',
					detail: `${pct.toFixed(0)}% of portfolio in ${cls}. Consider diversifying across asset classes.`
				});
			}
		}
		const sponsorAlloc = {};
		metricPortfolio.forEach(i => { const sp = i.sponsor || 'Unknown'; sponsorAlloc[sp] = (sponsorAlloc[sp] || 0) + (parseFloat(i.amountInvested) || 0); });
		for (const [sp, amt] of Object.entries(sponsorAlloc)) {
			const pct = (amt / totalInvested) * 100;
			if (pct > 40) {
				insights.push({
					type: 'warn',
					text: 'Sponsor exposure',
					detail: `${pct.toFixed(0)}% allocated to ${sp}. Diversifying sponsors reduces counterparty risk.`
				});
			}
		}

		const lendingExposure = Object.entries(alloc).reduce((sum, [cls, amt]) => {
			const normalized = String(cls || '').toLowerCase();
			return ['lending', 'debt', 'credit'].some((keyword) => normalized.includes(keyword))
				? sum + amt
				: sum;
		}, 0);
		if (lendingExposure > 0) {
			const pct = (lendingExposure / totalInvested) * 100;
			if (pct > 35) {
				insights.push({
					type: 'warn',
					text: 'Interest rate risk',
					detail: `${pct.toFixed(0)}% in lending/debt funds. Rate changes can impact yields and borrower performance.`
				});
			}
		}

		const avgHoldMonths = avgHoldPeriodMonths;
		if (avgHoldMonths > 84) {
			insights.push({
				type: 'warn',
				text: 'Long hold periods',
				detail: `${(avgHoldMonths / 12).toFixed(1)} years average hold. Longer holds reduce liquidity flexibility.`
			});
		}
		if (insights.length === 0) return [{ type: 'ok', text: 'Portfolio looks well-diversified', detail: 'No major concentration risks detected.' }];
		return insights.slice(0, 3);
	});

	const PIE_COLORS = ['#51BE7B', '#2563EB', '#f59e0b', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316', '#6366f1'];

	const timelineChart = $derived.by(() => {
		const datedInvestments = portfolio
			.filter((investment) => investment.countsTowardPortfolioMetrics !== false)
			.map((investment) => ({
				amount: parseFloat(investment.amountInvested) || 0,
				date: investment.dateInvested ? new Date(investment.dateInvested) : null,
				name: investment.investmentName || 'Investment'
			}))
			.filter((investment) => investment.amount > 0 && investment.date && !Number.isNaN(investment.date.getTime()))
			.sort((a, b) => a.date - b.date);

		if (datedInvestments.length === 0) return null;

		const width = 1100;
		const height = 280;
		const padding = { top: 18, right: 24, bottom: 56, left: 64 };
		const plotWidth = width - padding.left - padding.right;
		const plotHeight = height - padding.top - padding.bottom;
		const chartStart = new Date(datedInvestments[0].date.getFullYear(), datedInvestments[0].date.getMonth(), 1);
		const latestDate = datedInvestments[datedInvestments.length - 1].date;
		const compareDate = latestDate > new Date() ? latestDate : new Date();
		const chartEnd = new Date(compareDate.getFullYear(), compareDate.getMonth() + 6, 1);
		const months = [];
		for (let cursor = new Date(chartStart); cursor <= chartEnd && months.length < 120; cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1)) {
			months.push(new Date(cursor));
		}

		const goal = capitalGoal;
		const xForIndex = (index) => padding.left + (months.length === 1 ? plotWidth / 2 : (index / (months.length - 1)) * plotWidth);
		const yStep = niceMoneyStep(Math.max(totalInvested, goal, 250000));
		const maxValue = Math.ceil(Math.max(totalInvested, goal, 250000) / yStep) * yStep;
		const yForValue = (value) => padding.top + plotHeight - (value / maxValue) * plotHeight;
		let eventIndex = 0;
		let cumulative = 0;
		const monthlyPoints = months.map((month, index) => {
			const monthEnd = new Date(month.getFullYear(), month.getMonth() + 1, 0, 23, 59, 59, 999);
			while (datedInvestments[eventIndex] && datedInvestments[eventIndex].date <= monthEnd) {
				cumulative += datedInvestments[eventIndex].amount;
				eventIndex += 1;
			}
			return {
				index,
				month,
				value: cumulative,
				x: xForIndex(index),
				y: yForValue(cumulative)
			};
		});

		let areaPath = '';
		let linePath = '';
		monthlyPoints.forEach((point, index) => {
			if (index === 0) {
				linePath = `M ${point.x} ${point.y}`;
				areaPath = `M ${point.x} ${padding.top + plotHeight} L ${point.x} ${point.y}`;
				return;
			}
			linePath += ` H ${point.x} V ${point.y}`;
			areaPath += ` H ${point.x} V ${point.y}`;
		});
		const lastPoint = monthlyPoints[monthlyPoints.length - 1];
		areaPath += ` L ${lastPoint.x} ${padding.top + plotHeight} Z`;

		let runningTotal = 0;
		const markers = datedInvestments.map((investment) => {
			runningTotal += investment.amount;
			const monthIndex = months.findIndex((month) =>
				month.getFullYear() === investment.date.getFullYear() &&
				month.getMonth() === investment.date.getMonth()
			);
			return {
				x: xForIndex(Math.max(0, monthIndex)),
				y: yForValue(runningTotal),
				label: investment.name
			};
		});

		const tickValues = [];
		for (let value = 0; value <= maxValue; value += yStep) {
			tickValues.push(value);
		}

		return {
			width,
			height,
			padding,
			months,
			tickValues,
			goal,
			goalY: yForValue(goal),
			maxValue,
			linePath,
			areaPath,
			markers,
			xForIndex,
			yForValue,
			labelForIndex: (index) => formatTimelineLabel(months[index])
		};
	});

	const sorted = $derived.by(() =>
		[...portfolio].sort((a, b) => {
			const aDate = a.dateInvested ? new Date(a.dateInvested).getTime() : 0;
			const bDate = b.dateInvested ? new Date(b.dateInvested).getTime() : 0;
			if (aDate !== bDate) return bDate - aDate;
			return (parseFloat(b.amountInvested) || 0) - (parseFloat(a.amountInvested) || 0);
		})
	);

	const statusColors = { Active: 'var(--primary)', Distributing: '#3b82f6', Exited: 'var(--text-muted)', Pending: '#f59e0b' };

	function parsePortfolioCurrency(value) {
		if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
		const normalized = String(value || '').trim();
		if (!normalized || !/^-?\$?[\d,\s]+(?:\.\d+)?$/.test(normalized)) return 0;
		const parsed = Number(normalized.replace(/[$,\s]/g, ''));
		return Number.isFinite(parsed) ? parsed : 0;
	}

	function formatPortfolioMoney(value, fallback = '—') {
		const amount = parsePortfolioCurrency(value);
		if (!amount && amount !== 0) return fallback;
		if (amount === 0 && String(value || '').trim() === '') return fallback;
		return `$${amount.toLocaleString()}`;
	}

	function formatHoldPeriodValue(value) {
		const amount = Number(value || 0);
		if (!Number.isFinite(amount) || amount <= 0) return '—';
		return `${amount} yr${amount === 1 ? '' : 's'}`;
	}

	function formatMetricSource(source) {
		return source === 'actual' ? 'Actual' : source === 'projected' ? 'Projected' : '';
	}

	function displayCashFlowValue(investment) {
		return formatPortfolioMoney(investment?.displayYear1CashFlow);
	}

	function displayDepreciationValue(investment) {
		if (investment?.displayYear1Depreciation !== '' && investment?.displayYear1Depreciation !== null && investment?.displayYear1Depreciation !== undefined) {
			return formatPortfolioMoney(investment.displayYear1Depreciation);
		}
		return investment?.displayYear1DepreciationText || '—';
	}

	function selectPortfolioTab(tab) {
		if (tab === 'analysis' && !canViewAnalysis) return;
		activePortfolioTab = tab;
	}

	function getToken() {
		return browser ? getStoredSessionToken() : null;
	}

	function savePortfolioDetails(nextPortfolio) {
		const normalizedPortfolio = [...nextPortfolio];
		portfolioDetails = normalizedPortfolio;
		if (browser) {
			writeUserScopedJson('gycPortfolio', normalizedPortfolio);
			window.dispatchEvent(new CustomEvent(USER_SCOPED_STATE_EVENT));
		}
	}

	function buildPortfolioPayload(investment) {
		return {
			_recordId: investment._recordId || undefined,
			'Deal ID': investment.dealId || '',
			'Investment Name': investment.investmentName || '',
			Sponsor: investment.sponsor || '',
			'Asset Class': investment.assetClass || '',
			'Amount Invested': parseFloat(investment.amountInvested) || 0,
			'Date Invested': investment.dateInvested || '',
			Status: investment.status || 'Active',
			'Target IRR': investment.targetIRR !== '' ? parseFloat(investment.targetIRR) || 0 : '',
			'Actual Year 1 Cash Flow': investment.actualYear1CashFlow !== '' ? parseFloat(investment.actualYear1CashFlow) || 0 : '',
			'Actual Year 1 Depreciation': investment.actualYear1Depreciation !== '' ? parseFloat(investment.actualYear1Depreciation) || 0 : '',
			'Distributions Received': parseFloat(investment.distributionsReceived) || 0,
			'Hold Period': investment.holdPeriod || '',
			'Investing Entity': investment.investingEntity || '',
			'Entity Invested Into': investment.entityInvestedInto || '',
			Notes: investment.notes || ''
		};
	}

	async function syncPortfolioRecord(investment) {
		const token = getToken();
		if (!token) return normalizePortfolioRecord(investment);
		const response = await fetch('/api/userdata', {
			method: 'POST',
			headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
			body: JSON.stringify({
				type: 'portfolio',
				data: buildPortfolioPayload(investment)
			})
		});
		if (!response.ok) {
			throw new Error(`Portfolio sync failed: ${response.status}`);
		}
		const result = await response.json();
		return normalizePortfolioRecord({
			...investment,
			...(result.record || {})
		});
	}

	async function deletePortfolioRecord(investment) {
		const token = getToken();
		if (!token || !investment?._recordId) return;
		const response = await fetch('/api/userdata', {
			method: 'DELETE',
			headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
			body: JSON.stringify({
				type: 'portfolio',
				recordId: investment._recordId
			})
		});
		if (!response.ok) {
			throw new Error(`Portfolio delete failed: ${response.status}`);
		}
	}

	async function loadPortfolioData() {
		if (!browser) return;
		const localPortfolio = readUserScopedJson('gycPortfolio', []).map((item) => normalizePortfolioRecord(item));
		savePortfolioDetails(localPortfolio);
		wizardData = readUserScopedJson('gycBuyBoxWizard', {});

		const token = getToken();
		if (!token) return;

		try {
			const portfolioResponse = await fetch('/api/userdata?type=portfolio', {
				headers: { Authorization: `Bearer ${token}` }
			});

			const portfolioData = portfolioResponse.ok ? await portfolioResponse.json() : { records: [] };
			const normalizedRemotePortfolio = Array.isArray(portfolioData?.records)
				? portfolioData.records.map((item) => normalizePortfolioRecord(item))
				: [];
			if (portfolioResponse.ok) {
				savePortfolioDetails(normalizedRemotePortfolio);
			}
		} catch (error) {
			console.warn('Portfolio sync load failed:', error);
		}
	}

	async function handlePortfolioDealSubmission() {
		await fetchDeals({ force: true }).catch(() => {});
		await loadPortfolioData();
	}

	function openAddModal(id = '') {
		editingId = id;
		if (id) {
			const inv = portfolio.find(i => i.id === id);
			if (inv) {
				modalData = {
					...createEmptyInvestmentDraft(),
					...inv
				};
			}
		} else {
			modalData = createEmptyInvestmentDraft();
		}
	}

	function closeInlineEditor() {
		editingId = '';
		modalData = createEmptyInvestmentDraft();
	}

	async function saveInvestment() {
		if (!modalData.investmentName.trim()) { alert('Please enter an investment name.'); return; }
		let draftInvestment;
		let nextPortfolio = [...portfolioDetails];
		const existingDetailIdx = editingId ? portfolioDetails.findIndex((investment) => investment.id === editingId) : -1;
		if (existingDetailIdx >= 0) {
			draftInvestment = normalizePortfolioRecord({ ...portfolioDetails[existingDetailIdx], ...modalData, id: editingId });
			nextPortfolio[existingDetailIdx] = draftInvestment;
		} else {
			const baseRecord = editingId ? portfolio.find((investment) => investment.id === editingId) : null;
			draftInvestment = normalizePortfolioRecord({
				...(baseRecord || {}),
				...modalData,
				id: baseRecord?.id && !String(baseRecord.id).startsWith('invested_')
					? baseRecord.id
					: 'inv_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7)
			});
			nextPortfolio = [...portfolioDetails, draftInvestment];
		}
		savePortfolioDetails(nextPortfolio);
		try {
			const synced = await syncPortfolioRecord(draftInvestment);
			savePortfolioDetails(
				nextPortfolio
					.filter((investment) => investment.id !== draftInvestment.id)
					.concat([synced])
			);
		} catch (error) {
			console.warn('Portfolio save sync failed:', error);
		}
		closeInlineEditor();
	}

	async function deleteInvestment(id) {
		if (!confirm('Delete these saved portfolio details? The deal will stay here until its stage changes from Invested.')) return;
		const existingInvestment = portfolioDetails.find((investment) => investment.id === id);
		if (!existingInvestment) return;
		savePortfolioDetails(portfolioDetails.filter(i => i.id !== id));
		if (editingId === id) closeInlineEditor();
		try {
			await deletePortfolioRecord(existingInvestment);
		} catch (error) {
			console.warn('Portfolio delete sync failed:', error);
		}
	}

	function parseDollar(value) {
		if (typeof value === 'number') return value;
		if (!value) return 0;
		return parseInt(String(value).replace(/[^0-9.-]/g, ''), 10) || 0;
	}

	function niceMoneyStep(value) {
		if (value <= 250000) return 50000;
		if (value <= 500000) return 100000;
		if (value <= 1000000) return 250000;
		if (value <= 2500000) return 500000;
		return 1000000;
	}

	function formatTimelineLabel(date) {
		if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '';
		return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
	}

	function formatAxisMoney(value) {
		const amount = Number(value) || 0;
		if (amount >= 1000000) return `$${(amount / 1000000).toFixed(amount % 1000000 === 0 ? 0 : 1)}M`;
		if (amount >= 1000) return `$${Math.round(amount / 1000)}K`;
		return `$${amount.toLocaleString()}`;
	}

	function formatCardDate(value) {
		if (!value) return '';
		const date = new Date(value);
		if (Number.isNaN(date.getTime())) return value;
		return date.toLocaleDateString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit' });
	}

	onMount(async () => {
		if (!browser) return;
		fetchDeals();
		await loadPortfolioData();
	});
</script>

<svelte:head>
	<title>Portfolio | GYC</title>
</svelte:head>

<PageContainer className="portfolio-shell ly-page-stack">
	<PageHeader title="Portfolio" className="dashboard-page-header">
		<button slot="actions" class="btn-add" onclick={() => (showIntakeModal = true)}>Add Existing Investment</button>
	</PageHeader>

	<div class="content-area">
	{#if portfolio.length === 0}
		<div class="import-section">
			<div class="import-card">
				<div class="empty-briefcase">
					<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" width="42" height="42"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/></svg>
				</div>
				<h3>No invested deals yet</h3>
				<p>Add an existing investment or move a deal to <strong>Invested</strong> in Deal Flow and it will appear here automatically.</p>
				<div class="browse-link">
					<button class="btn-add section-add-btn" onclick={() => (showIntakeModal = true)}>Add Existing Investment</button>
				</div>
			</div>
		</div>
	{:else}
		{#if pendingEntries.length > 0}
			<div class="pending-banner">
				<div class="pending-banner__title">Pending-review investments are visible now.</div>
				<div class="pending-banner__copy">
					They appear in your portfolio immediately, but they are excluded from the summary metrics until the underlying deal clears review.
				</div>
			</div>
		{/if}

		<div class="summary-grid">
			<div class="stat-card">
				<div class="stat-label">Total Invested</div>
				<div class="stat-value">{formatPortfolioMoney(totalInvested, '$0')}</div>
			</div>
			<div class="stat-card">
				<div class="stat-label">Year 1 Cash Flow</div>
				<div class="stat-value">{formatPortfolioMoney(totalYear1CashFlow, '$0')}</div>
			</div>
			<div class="stat-card">
				<div class="stat-label">Year 1 Depreciation</div>
				<div class="stat-value">{formatPortfolioMoney(totalYear1Depreciation, '$0')}</div>
			</div>
			<div class="stat-card">
				<div class="stat-label">Avg Target IRR</div>
				<div class="stat-value">{avgIRR ? `${avgIRR.toFixed(1)}%` : '—'}</div>
			</div>
			<div class="stat-card">
				<div class="stat-label">Avg Hold Period</div>
				<div class="stat-value">{avgHoldPeriodYears ? formatHoldPeriodValue(avgHoldPeriodYears) : '—'}</div>
			</div>
		</div>

		<div class="portfolio-view-switch" role="tablist" aria-label="Portfolio views">
			<button
				type="button"
				class="portfolio-tab"
				class:portfolio-tab--active={activePortfolioTab === 'holdings'}
				onclick={() => selectPortfolioTab('holdings')}
			>
				Holdings
			</button>
			<button
				type="button"
				class="portfolio-tab"
				class:portfolio-tab--active={activePortfolioTab === 'analysis'}
				class:portfolio-tab--locked={!canViewAnalysis}
				onclick={() => selectPortfolioTab('analysis')}
				disabled={!canViewAnalysis}
				aria-disabled={!canViewAnalysis}
			>
				Analysis
				{#if !canViewAnalysis}
					<span class="portfolio-tab-badge">Members</span>
				{/if}
			</button>
		</div>

		{#if activePortfolioTab === 'holdings'}
			<div class="holdings-panel">
				<div class="holdings-header">
					<div>
						<div class="holdings-title">Your Holdings</div>
						<div class="holdings-copy">Manage one line item per investment event. Actual LP results supersede projected deal figures whenever you add them.</div>
					</div>
				</div>

				<div class="holdings-table">
					<div class="holdings-table-head">
						<div>Investment</div>
						<div>Status</div>
						<div>Invested</div>
						<div>Year 1 Cash Flow</div>
						<div>Year 1 Depreciation</div>
						<div>Target IRR</div>
						<div>Hold Period</div>
						<div></div>
					</div>

					{#each sorted as inv}
						{@const sc = inv.isPendingReview ? '#f59e0b' : (statusColors[inv.status] || 'var(--text-muted)')}
						<div class="holdings-row" class:holdings-row--editing={editingId === inv.id}>
							<div class="holdings-row-grid">
								<div class="holding-cell holding-cell--primary" data-label="Investment">
									<div class="holding-primary">{inv.investmentName || 'Unnamed investment'}</div>
									<div class="holding-secondary">
										{inv.sponsor || 'Unknown sponsor'}{inv.assetClass ? ` · ${inv.assetClass}` : ''}{inv.dateInvested ? ` · ${formatCardDate(inv.dateInvested)}` : ''}
									</div>
									{#if inv._missingDetails}
										<div class="holding-note">Add your invested amount and actual first-year metrics to complete this line item.</div>
									{:else if inv.isPendingReview}
										<div class="holding-note">This line item is visible now and will count toward portfolio totals once the deal completes review.</div>
									{:else if inv.notes}
										<div class="holding-note">{inv.notes}</div>
									{/if}
								</div>

								<div class="holding-cell" data-label="Status">
									<span class="inv-status" style="--sc:{sc}">{inv.displayStatus || inv.status || 'Unknown'}</span>
									{#if inv.isPendingReview}
										<div class="holding-meta">Excluded from totals</div>
									{/if}
								</div>

								<div class="holding-cell" data-label="Invested">
									<div class="holding-metric">{formatPortfolioMoney(inv.amountInvested)}</div>
									<div class="holding-meta">{inv.dateInvested ? formatCardDate(inv.dateInvested) : 'Date not set'}</div>
								</div>

								<div class="holding-cell" data-label="Year 1 Cash Flow">
									<div class="holding-metric">{displayCashFlowValue(inv)}</div>
									<div class="holding-metric-source">{formatMetricSource(inv.displayYear1CashFlowSource) || 'No data yet'}</div>
								</div>

								<div class="holding-cell" data-label="Year 1 Depreciation">
									<div class="holding-metric">{displayDepreciationValue(inv)}</div>
									<div class="holding-metric-source">{formatMetricSource(inv.displayYear1DepreciationSource) || 'No data yet'}</div>
								</div>

								<div class="holding-cell" data-label="Target IRR">
									<div class="holding-metric">{inv.targetIRR ? `${inv.targetIRR}%` : '—'}</div>
								</div>

								<div class="holding-cell" data-label="Hold Period">
									<div class="holding-metric">{formatHoldPeriodValue(inv.holdPeriod)}</div>
								</div>

								<div class="holding-cell holding-cell--action" data-label="Actions">
									<button
										class="btn-edit"
										class:btn-edit--active={editingId === inv.id}
										onclick={() => (editingId === inv.id ? closeInlineEditor() : openAddModal(inv.id))}
									>
										{editingId === inv.id ? 'Close' : inv._missingDetails ? 'Add Details' : 'Edit'}
									</button>
								</div>
							</div>

							{#if editingId === inv.id}
								<div class="holding-editor">
									<div class="holding-editor-header">
										<div>
											<div class="holding-editor-title">{hasPersistedDetails ? 'Edit line item' : 'Add line-item details'}</div>
											<div class="holding-editor-copy">Use actual LP-level results when you have them. Those actuals will override projected values in the holdings table.</div>
										</div>
									</div>

									<div class="holding-editor-grid">
										<label class="editor-field">
											<span>Investment Name *</span>
											<input bind:value={modalData.investmentName} placeholder="e.g. Acme Multi-Family Fund II" />
										</label>
										<label class="editor-field">
											<span>Sponsor</span>
											<input bind:value={modalData.sponsor} placeholder="e.g. Acme Capital" />
										</label>
										<label class="editor-field">
											<span>Asset Class</span>
											<select bind:value={modalData.assetClass}>
												<option value="">Select...</option>
												<option>Multi Family</option>
												<option>Self Storage</option>
												<option>Industrial</option>
												<option>Lending</option>
												<option>Short Term Rental</option>
												<option>Hotels/Hospitality</option>
												<option>Mixed-Use</option>
												<option>RV/Mobile Home Parks</option>
												<option>Senior Living</option>
												<option>Land</option>
												<option>Car Wash</option>
												<option>Oil & Gas</option>
												<option>Other</option>
											</select>
										</label>
										<label class="editor-field">
											<span>Amount Invested ($)</span>
											<input type="number" bind:value={modalData.amountInvested} placeholder="50000" />
										</label>
										<label class="editor-field">
											<span>Date Invested</span>
											<input type="date" bind:value={modalData.dateInvested} />
										</label>
										<label class="editor-field">
											<span>Status</span>
											<select bind:value={modalData.status}>
												<option>Active</option>
												<option>Distributing</option>
												<option>Exited</option>
												<option>Pending</option>
											</select>
										</label>
										<label class="editor-field">
											<span>Actual Year 1 Cash Flow ($)</span>
											<input type="number" bind:value={modalData.actualYear1CashFlow} placeholder="8200" />
										</label>
										<label class="editor-field">
											<span>Actual Year 1 Depreciation ($)</span>
											<input type="number" bind:value={modalData.actualYear1Depreciation} placeholder="21000" />
										</label>
										<label class="editor-field">
											<span>Target IRR (%)</span>
											<input type="number" step="0.1" bind:value={modalData.targetIRR} placeholder="15" />
										</label>
										<label class="editor-field">
											<span>Hold Period (years)</span>
											<input bind:value={modalData.holdPeriod} placeholder="e.g. 5" />
										</label>
										<label class="editor-field">
											<span>Distributions Received ($)</span>
											<input type="number" bind:value={modalData.distributionsReceived} placeholder="0" />
										</label>
										<label class="editor-field">
											<span>Investing Entity</span>
											<input bind:value={modalData.investingEntity} placeholder="e.g. My LLC" />
										</label>
										<label class="editor-field full-width">
											<span>Entity Invested Into</span>
											<input bind:value={modalData.entityInvestedInto} placeholder="e.g. Acme Fund II LLC" />
										</label>
										<label class="editor-field full-width">
											<span>Notes</span>
											<textarea bind:value={modalData.notes} rows="3" placeholder="Optional notes about this investment..."></textarea>
										</label>
									</div>

									<div class="holding-projection-card">
										<div class="holding-projection-title">Deal-projected first-year performance</div>
										<div class="holding-projection-grid">
											<div class="holding-projection-metric">
												<span>Projected cash flow</span>
												<strong>{inv.projectedYear1CashFlow !== '' ? formatPortfolioMoney(inv.projectedYear1CashFlow) : 'Not available'}</strong>
											</div>
											<div class="holding-projection-metric">
												<span>Projected depreciation</span>
												<strong>{inv.projectedYear1DepreciationText || 'Not available'}</strong>
											</div>
										</div>
										<div class="holding-projection-copy">Projected figures stay attached to the deal for reference. Your LP-entered actuals become the primary numbers shown in holdings when available.</div>
									</div>

									<div class="holding-editor-actions">
										{#if hasPersistedDetails}
											<button class="btn-danger" onclick={() => deleteInvestment(editingId)}>Delete Line Item</button>
										{/if}
										<div class="holding-editor-actions-spacer"></div>
										<button class="btn-cancel" onclick={closeInlineEditor}>Cancel</button>
										<button class="btn-primary" onclick={saveInvestment}>{hasPersistedDetails ? 'Save Changes' : 'Save Line Item'}</button>
									</div>
								</div>
							{/if}
						</div>
					{/each}
				</div>
			</div>
		{:else if canViewAnalysis}
			<div class="analysis-panel">
				<div class="holdings-header">
					<div>
						<div class="holdings-title">Portfolio Analysis</div>
						<div class="holdings-copy">See how your current holdings are allocated, where concentration risk is building, and how quickly you are deploying capital against your plan.</div>
					</div>
				</div>

				<div class="charts-row">
					<div class="chart-card">
						<div class="chart-card-title">Asset Class Allocation</div>
						<div class="chartjs-donut-wrap">
							{#if allocationSlices.length > 0}
								<svg viewBox="0 0 160 160" class="allocation-donut" aria-hidden="true">
									{#each allocationSlices as slice}
										{#if slice.isOnly}
											<circle cx="80" cy="80" r="60" fill={slice.color}></circle>
										{:else}
											<path
												d={`M80,80 L${slice.x1},${slice.y1} A60,60 0 ${slice.largeArcFlag},1 ${slice.x2},${slice.y2} Z`}
												fill={slice.color}
											></path>
										{/if}
									{/each}
									<circle cx="80" cy="80" r="33" fill="var(--bg-card)"></circle>
								</svg>
							{:else}
								<div class="analysis-empty">Approved invested positions will populate allocation once they carry portfolio totals.</div>
							{/if}
						</div>
						{#if allocationEntries.length > 0}
							<div class="alloc-legend">
								{#each allocationEntries as [cls, amt], i}
									<div class="alloc-legend-item">
										<span class="alloc-legend-dot" style="background:{PIE_COLORS[i % PIE_COLORS.length]}"></span>
										<span class="alloc-legend-label">{cls}</span>
										<span class="alloc-legend-pct">{((amt / totalInvested) * 100).toFixed(0)}%</span>
									</div>
								{/each}
							</div>
						{/if}
						<div class="alloc-meta">
							<div class="alloc-stat"><div class="alloc-num">{assetClasses.size}</div><div class="alloc-label">Asset Classes</div></div>
							<div class="alloc-stat"><div class="alloc-num">{sponsors.size}</div><div class="alloc-label">Sponsors</div></div>
						</div>
					</div>
					<div class="chart-card">
						<div class="chart-card-title">Risk Analysis</div>
						<div class="risk-badges">
							{#each riskInsights as insight}
								<div class="risk-badge" class:badge-danger={insight.type === 'danger'} class:badge-warn={insight.type === 'warn'} class:badge-ok={insight.type === 'ok'}>
									<div class="risk-badge-content">
										<div class="risk-badge-text">{insight.text}</div>
										{#if insight.detail}
											<div class="risk-badge-detail">{insight.detail}</div>
										{/if}
									</div>
								</div>
							{/each}
						</div>
					</div>
				</div>

				{#if timelineChart}
					<div class="chart-card timeline-card">
						<div class="timeline-card-header">
							<div class="chart-card-title">Capital Deployed Over Time</div>
							<div class="timeline-legend">
								<span class="timeline-legend-item"><span class="timeline-legend-dot capital"></span>Capital Deployed</span>
								<span class="timeline-legend-item"><span class="timeline-legend-dot goal"></span>Goal</span>
							</div>
						</div>
						<div class="timeline-svg-shell ly-table-scroll">
							<svg viewBox={`0 0 ${timelineChart.width} ${timelineChart.height}`} class="timeline-svg" aria-label="Capital deployed over time">
								{#each timelineChart.tickValues as value}
									{@const y = timelineChart.yForValue(value)}
									<line x1={timelineChart.padding.left} y1={y} x2={timelineChart.width - timelineChart.padding.right} y2={y} class="timeline-grid-line"></line>
									<text x={timelineChart.padding.left - 10} y={y + 4} text-anchor="end" class="timeline-axis-label">{formatAxisMoney(value)}</text>
								{/each}

								<line
									x1={timelineChart.padding.left}
									y1={timelineChart.goalY}
									x2={timelineChart.width - timelineChart.padding.right}
									y2={timelineChart.goalY}
									class="timeline-goal-line"
								></line>
								<text x={timelineChart.width - timelineChart.padding.right} y={timelineChart.goalY - 8} text-anchor="end" class="timeline-goal-label">
									Goal {formatAxisMoney(timelineChart.goal)}
								</text>

								<path d={timelineChart.areaPath} class="timeline-series-area"></path>
								<path d={timelineChart.linePath} class="timeline-series-line"></path>

								{#each timelineChart.markers as marker}
									<circle cx={marker.x} cy={marker.y} r="4.5" class="timeline-marker"></circle>
								{/each}

								{#each timelineChart.months as month, index}
									{#if index % Math.max(1, Math.ceil(timelineChart.months.length / 10)) === 0 || index === timelineChart.months.length - 1}
										<text
											x={timelineChart.xForIndex(index)}
											y={timelineChart.height - 14}
											text-anchor="end"
											transform={`rotate(-55 ${timelineChart.xForIndex(index)} ${timelineChart.height - 14})`}
											class="timeline-x-label"
										>
											{timelineChart.labelForIndex(index)}
										</text>
									{/if}
								{/each}
							</svg>
						</div>
					</div>
				{:else}
					<div class="chart-card analysis-empty-card">
						<div class="chart-card-title">Capital Deployed Over Time</div>
						<div class="analysis-empty">Add invested amounts and dates to see your deployment path against the capital goal in your plan.</div>
					</div>
				{/if}
			</div>
		{:else}
			<div class="analysis-locked-card">
				<div class="analysis-locked-eyebrow">Members only</div>
				<div class="analysis-locked-title">Unlock portfolio analysis.</div>
				<p>Free members can manage holdings today. Upgrade to see allocation, risk, and deployment analysis across your portfolio.</p>
				<a href="/app/office-hours" class="analysis-locked-link">See Office Hours</a>
			</div>
		{/if}
	{/if}
	</div>
</PageContainer>

{#if showIntakeModal}
	<AddDealModal
		entrySurface="portfolio"
		defaultIntent="invested"
		onclose={() => (showIntakeModal = false)}
		onsubmitted={handlePortfolioDealSubmission}
	/>
{/if}

<style>
	.content-area {
		min-width: 0;
	}
	.btn-add {
		padding: 8px 18px;
		background: var(--primary);
		color: #fff;
		border: none;
		border-radius: var(--radius-sm);
		font-family: var(--font-ui);
		font-weight: 700;
		font-size: 13px;
		cursor: pointer;
		transition: background var(--transition);
	}
	.btn-add:hover { background: var(--primary-hover); }
	.section-add-btn {
		padding: 8px 20px;
		font-size: 12px;
	}
	.pending-banner {
		margin: 0 0 18px;
		padding: 16px 18px;
		border-radius: 18px;
		background: rgba(245, 158, 11, 0.08);
		border: 1px solid rgba(245, 158, 11, 0.18);
	}
	.pending-banner__title {
		font-family: var(--font-ui);
		font-size: 13px;
		font-weight: 800;
		color: #9a6700;
	}
	.pending-banner__copy {
		margin-top: 6px;
		font-size: 14px;
		line-height: 1.6;
		color: #7c5a00;
	}

	.summary-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
		gap: 12px;
		margin-bottom: 18px;
	}
	.stat-card {
		background: var(--bg-card);
		border: 1px solid var(--border);
		border-radius: var(--radius);
		padding: 18px 20px;
	}
	.stat-label {
		font-size: 12px;
		font-weight: 600;
		color: var(--text-secondary);
		margin-bottom: 8px;
		font-family: var(--font-ui);
		text-transform: uppercase;
		letter-spacing: 0.5px;
	}
	.stat-value {
		font-size: 22px;
		font-weight: 800;
		color: var(--primary);
		font-family: var(--font-ui);
		font-variant-numeric: tabular-nums;
	}

	.portfolio-view-switch {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		margin-bottom: 18px;
		padding: 6px;
		background: color-mix(in srgb, var(--bg-card) 86%, var(--bg-cream));
		border: 1px solid var(--border);
		border-radius: 999px;
	}
	.portfolio-tab {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		padding: 9px 16px;
		border-radius: 999px;
		border: none;
		background: transparent;
		color: var(--text-secondary);
		font-family: var(--font-ui);
		font-size: 13px;
		font-weight: 700;
		cursor: pointer;
		transition: background 0.15s ease, color 0.15s ease;
	}
	.portfolio-tab:hover:not(:disabled) {
		background: rgba(81, 190, 123, 0.08);
		color: var(--text-dark);
	}
	.portfolio-tab--active {
		background: var(--primary);
		color: #fff;
	}
	.portfolio-tab--locked {
		opacity: 0.78;
	}
	.portfolio-tab:disabled {
		cursor: not-allowed;
	}
	.portfolio-tab-badge {
		display: inline-flex;
		align-items: center;
		padding: 2px 7px;
		border-radius: 999px;
		background: rgba(17, 24, 39, 0.08);
		font-size: 10px;
		font-weight: 800;
		letter-spacing: 0.04em;
		text-transform: uppercase;
	}
	.portfolio-tab--active .portfolio-tab-badge {
		background: rgba(255, 255, 255, 0.18);
		color: #fff;
	}

	.holdings-panel,
	.analysis-panel {
		display: flex;
		flex-direction: column;
		gap: 18px;
	}
	.holdings-header {
		display: flex;
		justify-content: space-between;
		align-items: flex-end;
		gap: 16px;
	}
	.holdings-title {
		font-family: var(--font-ui);
		font-size: 16px;
		font-weight: 800;
		color: var(--text-dark);
	}
	.holdings-copy {
		margin-top: 6px;
		max-width: 720px;
		font-family: var(--font-body);
		font-size: 14px;
		line-height: 1.6;
		color: var(--text-secondary);
	}

	.holdings-table {
		border: 1px solid var(--border);
		border-radius: 22px;
		background: var(--bg-card);
		overflow: hidden;
	}
	.holdings-table-head,
	.holdings-row-grid {
		display: grid;
		grid-template-columns: minmax(0, 2.4fr) minmax(110px, 1fr) minmax(110px, 1fr) minmax(120px, 1fr) minmax(120px, 1fr) minmax(100px, 0.85fr) minmax(100px, 0.85fr) auto;
		gap: 16px;
		align-items: center;
	}
	.holdings-table-head {
		padding: 14px 22px;
		background: color-mix(in srgb, var(--bg-card) 78%, var(--bg-cream));
		border-bottom: 1px solid var(--border);
		font-family: var(--font-ui);
		font-size: 11px;
		font-weight: 800;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: var(--text-muted);
	}
	.holdings-row + .holdings-row {
		border-top: 1px solid var(--border);
	}
	.holdings-row--editing {
		background: color-mix(in srgb, var(--bg-card) 92%, var(--bg-cream));
	}
	.holdings-row-grid {
		padding: 18px 22px;
	}
	.holding-cell {
		min-width: 0;
	}
	.holding-cell--primary {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}
	.holding-cell--action {
		display: flex;
		justify-content: flex-end;
	}
	.holding-primary {
		font-family: var(--font-ui);
		font-size: 15px;
		font-weight: 800;
		color: var(--text-dark);
	}
	.holding-secondary,
	.holding-meta,
	.holding-note,
	.holding-metric-source {
		font-family: var(--font-body);
		font-size: 12px;
		line-height: 1.5;
		color: var(--text-muted);
	}
	.holding-note {
		color: var(--text-secondary);
	}
	.holding-metric {
		font-family: var(--font-ui);
		font-size: 15px;
		font-weight: 800;
		color: var(--text-dark);
		font-variant-numeric: tabular-nums;
	}
	.holding-metric-source {
		margin-top: 2px;
	}
	.inv-status {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		padding: 5px 12px;
		border-radius: 999px;
		font-family: var(--font-ui);
		font-size: 11px;
		font-weight: 700;
		background: color-mix(in srgb, var(--sc) 8%, transparent);
		color: var(--sc);
	}
	.btn-edit {
		background: transparent;
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		padding: 7px 12px;
		cursor: pointer;
		font-family: var(--font-ui);
		font-size: 11px;
		font-weight: 700;
		color: var(--text-muted);
		transition: all 0.15s ease;
		white-space: nowrap;
	}
	.btn-edit:hover {
		border-color: var(--primary);
		color: var(--primary);
	}
	.btn-edit--active {
		border-color: rgba(81, 190, 123, 0.3);
		background: rgba(81, 190, 123, 0.1);
		color: var(--primary);
	}

	.holding-editor {
		padding: 0 22px 22px;
		border-top: 1px solid rgba(17, 24, 39, 0.06);
	}
	.holding-editor-header {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		gap: 16px;
		padding: 18px 0 14px;
	}
	.holding-editor-title {
		font-family: var(--font-ui);
		font-size: 14px;
		font-weight: 800;
		color: var(--text-dark);
	}
	.holding-editor-copy {
		margin-top: 4px;
		max-width: 760px;
		font-size: 13px;
		line-height: 1.6;
		color: var(--text-secondary);
	}
	.holding-editor-grid {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 14px 16px;
	}
	.editor-field {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}
	.editor-field.full-width {
		grid-column: 1 / -1;
	}
	.editor-field span {
		font-family: var(--font-ui);
		font-size: 11px;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--text-muted);
	}
	.editor-field input,
	.editor-field select,
	.editor-field textarea {
		width: 100%;
		padding: 10px 12px;
		border: 1px solid var(--border);
		border-radius: 12px;
		background: var(--bg-card);
		color: var(--text-dark);
		font-family: var(--font-body);
		font-size: 14px;
		box-sizing: border-box;
	}
	.editor-field textarea {
		resize: vertical;
		min-height: 88px;
	}
	.editor-field input:focus,
	.editor-field select:focus,
	.editor-field textarea:focus {
		outline: none;
		border-color: var(--primary);
	}
	.holding-projection-card {
		margin-top: 16px;
		padding: 16px 18px;
		border: 1px solid rgba(81, 190, 123, 0.18);
		border-radius: 16px;
		background: rgba(81, 190, 123, 0.05);
	}
	.holding-projection-title {
		font-family: var(--font-ui);
		font-size: 12px;
		font-weight: 800;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: var(--primary);
	}
	.holding-projection-grid {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 12px;
		margin-top: 12px;
	}
	.holding-projection-metric span {
		display: block;
		font-size: 12px;
		color: var(--text-secondary);
	}
	.holding-projection-metric strong {
		display: block;
		margin-top: 4px;
		font-family: var(--font-ui);
		font-size: 15px;
		font-weight: 800;
		color: var(--text-dark);
	}
	.holding-projection-copy {
		margin-top: 12px;
		font-size: 12px;
		line-height: 1.6;
		color: var(--text-secondary);
	}
	.holding-editor-actions {
		display: flex;
		align-items: center;
		gap: 10px;
		margin-top: 16px;
	}
	.holding-editor-actions-spacer {
		flex: 1;
	}

	.charts-row {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 20px;
	}
	.chart-card {
		background: var(--bg-card);
		border: 1px solid var(--border);
		border-radius: var(--radius);
		padding: 20px;
		min-width: 0;
	}
	.chart-card-title {
		font-family: var(--font-ui);
		font-size: 14px;
		font-weight: 700;
		color: var(--text-dark);
		margin-bottom: 16px;
	}
	.analysis-empty-card {
		margin-top: 0;
	}
	.analysis-empty {
		font-family: var(--font-body);
		font-size: 13px;
		line-height: 1.6;
		color: var(--text-secondary);
	}
	.alloc-meta {
		display: flex;
		justify-content: center;
		gap: 24px;
		margin-top: 16px;
	}
	.alloc-stat { text-align: center; }
	.alloc-num { font-family: var(--font-ui); font-size: 22px; font-weight: 800; color: var(--text-dark); }
	.alloc-label { font-family: var(--font-ui); font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: var(--text-muted); }
	.chartjs-donut-wrap {
		display: flex;
		justify-content: center;
		align-items: center;
		min-height: 172px;
		margin-bottom: 12px;
	}
	.allocation-donut {
		width: 180px;
		height: 180px;
		display: block;
	}
	.alloc-legend { display: flex; flex-direction: column; gap: 6px; margin-bottom: 16px; }
	.alloc-legend-item { display: flex; align-items: center; gap: 8px; width: 100%; font-family: var(--font-ui); font-size: 12px; }
	.alloc-legend-dot { width: 10px; height: 10px; border-radius: 3px; flex-shrink: 0; }
	.alloc-legend-label { flex: 1; color: var(--text-secondary); }
	.alloc-legend-pct { font-weight: 700; color: var(--text-dark); }
	.risk-badges { display: flex; flex-direction: column; gap: 10px; }
	.risk-badge {
		background: var(--bg-card);
		border: 1px solid var(--border);
		border-left: 4px solid var(--orange);
		border-radius: var(--radius-sm);
		padding: 14px 16px;
		font-family: var(--font-body);
		font-size: 14px;
		color: var(--text-dark);
	}
	.risk-badge-content { flex: 1; }
	.risk-badge-text { font-family: var(--font-ui); font-size: 13px; font-weight: 700; line-height: 1.4; }
	.risk-badge-detail { font-family: var(--font-body); font-size: 12px; color: var(--text-secondary); line-height: 1.5; margin-top: 2px; }
	.risk-badge.badge-danger {
		background: var(--bg-card);
		border: 1px solid var(--border);
		border-left: 4px solid var(--red, #D04040);
	}
	.risk-badge.badge-warn {
		background: var(--bg-card);
		border: 1px solid var(--border);
		border-left: 4px solid var(--orange);
	}
	.risk-badge.badge-ok {
		background: var(--bg-card);
		border: 1px solid var(--border);
		border-left: 4px solid var(--green);
	}
	.timeline-card { margin-bottom: 0; }
	.timeline-card-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 16px;
		margin-bottom: 8px;
		flex-wrap: wrap;
	}
	.timeline-legend {
		display: flex;
		align-items: center;
		gap: 14px;
		flex-wrap: wrap;
	}
	.timeline-legend-item {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		font-family: var(--font-ui);
		font-size: 12px;
		color: var(--text-secondary);
	}
	.timeline-legend-dot {
		width: 10px;
		height: 10px;
		border-radius: 999px;
	}
	.timeline-legend-dot.capital { background: var(--primary); }
	.timeline-legend-dot.goal {
		background: transparent;
		border: 2px dashed #f59e0b;
		box-sizing: border-box;
	}
	.timeline-svg-shell {
		padding-top: 6px;
	}
	.timeline-svg {
		display: block;
		width: 100%;
		min-width: 980px;
		height: auto;
	}
	.timeline-grid-line {
		stroke: rgba(17, 24, 39, 0.08);
		stroke-width: 1;
	}
	.timeline-axis-label,
	.timeline-x-label {
		font-family: var(--font-ui);
		font-size: 11px;
		fill: var(--text-muted);
	}
	.timeline-series-area {
		fill: rgba(81, 190, 123, 0.14);
	}
	.timeline-series-line {
		fill: none;
		stroke: var(--primary);
		stroke-width: 3;
		stroke-linecap: round;
		stroke-linejoin: round;
	}
	.timeline-marker {
		fill: var(--primary);
		stroke: #fff;
		stroke-width: 2;
	}
	.timeline-goal-line {
		stroke: #f59e0b;
		stroke-width: 2;
		stroke-dasharray: 7 7;
	}
	.timeline-goal-label {
		font-family: var(--font-ui);
		font-size: 11px;
		font-weight: 700;
		fill: #f59e0b;
	}

	.import-section {
		max-width: 520px;
		margin: 0 auto;
		padding: 40px 24px 24px;
	}
	.import-card {
		background: var(--bg-card);
		border: 1px solid var(--border);
		border-radius: var(--radius);
		padding: 28px 24px;
		text-align: center;
	}
	.empty-briefcase {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 68px;
		height: 68px;
		border-radius: 20px;
		background: var(--bg-cream);
		color: var(--text-muted);
		margin-bottom: 14px;
	}
	.import-card h3 {
		font-family: var(--font-ui);
		font-size: 18px;
		font-weight: 800;
		color: var(--text-dark);
		margin: 0 0 6px;
	}
	.import-card p {
		font-family: var(--font-body);
		font-size: 14px;
		color: var(--text-muted);
		margin: 0 0 24px;
		line-height: 1.5;
	}
	.browse-link {
		margin-top: 20px;
		padding-top: 20px;
		border-top: 1px solid var(--border);
	}
	.browse-link a {
		font-family: var(--font-ui);
		font-size: 13px;
		font-weight: 600;
		color: var(--primary);
		text-decoration: none;
		cursor: pointer;
	}
	.browse-link a:hover { text-decoration: underline; }

	.btn-cancel {
		padding: 10px 20px;
		background: transparent;
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		font-family: var(--font-ui);
		font-weight: 600;
		font-size: 13px;
		cursor: pointer;
		color: var(--text-secondary);
		transition: all 0.15s ease;
	}
	.btn-cancel:hover { border-color: var(--text-muted); color: var(--text-dark); }
	.btn-primary {
		padding: 10px 24px;
		background: var(--primary);
		color: #fff;
		border: none;
		border-radius: var(--radius-sm);
		font-family: var(--font-ui);
		font-weight: 700;
		font-size: 13px;
		cursor: pointer;
		transition: background var(--transition);
	}
	.btn-primary:hover { background: var(--primary-hover); }
	.btn-danger {
		padding: 10px 20px;
		background: transparent;
		border: none;
		border-radius: 10px;
		font-family: var(--font-ui);
		font-weight: 600;
		font-size: 13px;
		cursor: pointer;
		color: var(--red, #D04040);
		transition: all 0.15s ease;
	}
	.btn-danger:hover { background: #fde8e8; }

	.analysis-locked-card {
		padding: 26px 24px;
		border-radius: 22px;
		border: 1px solid rgba(81, 190, 123, 0.16);
		background: linear-gradient(135deg, rgba(81, 190, 123, 0.08), rgba(245, 158, 11, 0.06));
	}
	.analysis-locked-eyebrow {
		font-family: var(--font-ui);
		font-size: 11px;
		font-weight: 800;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: var(--primary);
	}
	.analysis-locked-title {
		margin-top: 8px;
		font-family: var(--font-ui);
		font-size: 22px;
		font-weight: 800;
		color: var(--text-dark);
	}
	.analysis-locked-card p {
		margin: 10px 0 0;
		max-width: 640px;
		font-size: 14px;
		line-height: 1.7;
		color: var(--text-secondary);
	}
	.analysis-locked-link {
		display: inline-flex;
		align-items: center;
		margin-top: 18px;
		padding: 10px 16px;
		border-radius: 999px;
		background: var(--bg-card);
		border: 1px solid var(--border);
		color: var(--text-dark);
		font-family: var(--font-ui);
		font-size: 13px;
		font-weight: 700;
		text-decoration: none;
	}
	.analysis-locked-link:hover {
		border-color: var(--primary);
		color: var(--primary);
	}

	@media (min-width: 769px) and (max-width: 1024px) {
		.summary-grid {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
		.holdings-table-head,
		.holdings-row-grid {
			grid-template-columns: minmax(0, 2fr) repeat(6, minmax(90px, 1fr)) auto;
			gap: 14px;
		}
		.charts-row {
			grid-template-columns: minmax(0, 1fr);
			gap: 20px;
		}
		.import-section {
			max-width: 640px;
			padding: 40px 24px;
		}
	}

	@media (max-width: 768px) {
		.summary-grid {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
		.portfolio-view-switch {
			display: flex;
			width: 100%;
		}
		.portfolio-tab {
			flex: 1;
			justify-content: center;
		}
		.holdings-header {
			align-items: stretch;
		}
		.holdings-table {
			border-radius: 18px;
		}
		.holdings-table-head {
			display: none;
		}
		.holdings-row-grid {
			grid-template-columns: 1fr;
			gap: 12px;
			padding: 16px;
		}
		.holding-cell {
			display: flex;
			align-items: baseline;
			justify-content: space-between;
			gap: 14px;
		}
		.holding-cell::before {
			content: attr(data-label);
			flex-shrink: 0;
			font-family: var(--font-ui);
			font-size: 10px;
			font-weight: 800;
			text-transform: uppercase;
			letter-spacing: 0.06em;
			color: var(--text-muted);
		}
		.holding-cell--primary,
		.holding-cell--action {
			display: block;
		}
		.holding-cell--primary::before,
		.holding-cell--action::before {
			content: none;
		}
		.holding-cell--action {
			margin-top: 2px;
		}
		.holding-editor {
			padding: 0 16px 16px;
		}
		.holding-editor-grid,
		.holding-projection-grid {
			grid-template-columns: 1fr;
		}
		.holding-editor-actions {
			flex-wrap: wrap;
		}
		.holding-editor-actions-spacer {
			display: none;
		}
		.holding-editor-actions .btn-danger,
		.holding-editor-actions .btn-cancel,
		.holding-editor-actions .btn-primary {
			width: 100%;
		}
		.charts-row { grid-template-columns: 1fr; }
		.section-add-btn { width: 100%; }
		.chart-card { padding: 18px 16px; }
		.chartjs-donut-wrap {
			width: 100%;
			max-width: none;
			min-height: 160px;
			margin: 0 auto 12px;
		}
		.allocation-donut {
			width: min(180px, 100%);
			height: auto;
			aspect-ratio: 1;
		}
		.alloc-legend {
			width: min(100%, 320px);
			margin-inline: auto;
		}
		.alloc-meta {
			width: min(100%, 240px);
			margin-inline: auto;
			justify-content: space-between;
			gap: 16px;
		}
		.timeline-svg { min-width: 760px; }
		.analysis-locked-card {
			padding: 22px 18px;
		}
		.analysis-locked-title {
			font-size: 20px;
		}
	}
</style>
