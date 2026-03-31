<script>
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';
	import { deals, dealStages, fetchDeals } from '$lib/stores/deals.js';
	import { getStoredSessionToken } from '$lib/stores/auth.js';
	import PageContainer from '$lib/layout/PageContainer.svelte';
	import PageHeader from '$lib/layout/PageHeader.svelte';
	import { readUserScopedJson, writeUserScopedJson } from '$lib/utils/userScopedState.js';
	import { buildInvestedPortfolio, normalizePortfolioRecord } from '$lib/utils/investedPortfolio.js';
	const USER_SCOPED_STATE_EVENT = 'gyc:user-scoped-state-updated';

	let portfolioDetails = $state([]);
	let wizardData = $state({});
	let showAddModal = $state(false);
	let editingId = $state('');

	// Modal form data
	let modalData = $state({
		investmentName: '', sponsor: '', assetClass: '', amountInvested: '',
		dateInvested: '', status: 'Active', targetIRR: '', distributionsReceived: '',
		equityMultiple: '', investingEntity: '', entityInvestedInto: '',
		holdPeriod: '', notes: '', dealId: ''
	});
	const portfolioView = $derived.by(() =>
		buildInvestedPortfolio({
			stageMap: $dealStages || {},
			deals: $deals || [],
			portfolio: portfolioDetails
		})
	);
	const portfolio = $derived.by(() => portfolioView.entries);
	const hasPersistedDetails = $derived.by(() =>
		portfolioDetails.some((investment) => investment.id === editingId)
	);

	const totalInvested = $derived(portfolio.reduce((s, i) => s + (parseFloat(i.amountInvested) || 0), 0));
	const totalDistributions = $derived(portfolio.reduce((s, i) => s + (parseFloat(i.distributionsReceived) || 0), 0));
	const activeCount = $derived(portfolio.filter(i => i.status === 'Active' || i.status === 'Distributing').length);
	const avgIRR = $derived.by(() => {
		const withIRR = portfolio.filter(i => i.targetIRR);
		if (withIRR.length === 0) return 0;
		return withIRR.reduce((s, i) => s + parseFloat(i.targetIRR), 0) / withIRR.length;
	});
	const avgHoldPeriod = $derived.by(() => {
		const withDate = portfolio.filter(i => i.dateInvested && (i.status === 'Active' || i.status === 'Distributing'));
		if (withDate.length === 0) return 0;
		const now = new Date();
		const totalMonths = withDate.reduce((s, i) => {
			const d = new Date(i.dateInvested);
			return s + ((now - d) / (1000 * 60 * 60 * 24 * 30.44));
		}, 0);
		return totalMonths / withDate.length;
	});
	const assetClasses = $derived(new Set(portfolio.map(i => i.assetClass).filter(Boolean)));
	const sponsors = $derived(new Set(portfolio.map(i => i.sponsor).filter(Boolean)));

	const allocationMap = $derived.by(() => {
		const map = {};
		portfolio.forEach(i => { const cls = i.assetClass || 'Other'; map[cls] = (map[cls] || 0) + (parseFloat(i.amountInvested) || 0); });
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
		portfolio.forEach(i => { const sp = i.sponsor || 'Unknown'; sponsorAlloc[sp] = (sponsorAlloc[sp] || 0) + (parseFloat(i.amountInvested) || 0); });
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

		const avgHoldMonths = avgHoldPeriod;
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

	function openAddModal(id = '') {
		editingId = id;
		if (id) {
			const inv = portfolio.find(i => i.id === id);
			if (inv) modalData = { ...inv };
		} else {
			modalData = {
				investmentName: '', sponsor: '', assetClass: '', amountInvested: '',
				dateInvested: '', status: 'Active', targetIRR: '', distributionsReceived: '',
				equityMultiple: '', investingEntity: '', entityInvestedInto: '',
				holdPeriod: '', notes: '', dealId: ''
			};
		}
		showAddModal = true;
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
			nextPortfolio = draftInvestment.dealId
				? [...portfolioDetails.filter((investment) => investment.dealId !== draftInvestment.dealId), draftInvestment]
				: [...portfolioDetails, draftInvestment];
		}
		savePortfolioDetails(nextPortfolio);
		try {
			const synced = await syncPortfolioRecord(draftInvestment);
			savePortfolioDetails(
				nextPortfolio
					.filter((investment) =>
						investment.id !== draftInvestment.id &&
						(!synced.dealId || investment.dealId !== synced.dealId)
					)
					.concat([synced])
			);
		} catch (error) {
			console.warn('Portfolio save sync failed:', error);
		}
		showAddModal = false;
	}

	async function deleteInvestment(id) {
		if (!confirm('Delete these saved portfolio details? The deal will stay here until its stage changes from Invested.')) return;
		const existingInvestment = portfolioDetails.find((investment) => investment.id === id);
		if (!existingInvestment) return;
		savePortfolioDetails(portfolioDetails.filter(i => i.id !== id));
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

<PageContainer className="portfolio-shell ly-page-stack">
	<PageHeader title="Portfolio" className="dashboard-page-header">
		<nav slot="secondaryRow" class="ly-dashboard-tabs" aria-label="Dashboard sections">
			<a href="/app/dashboard" class="ly-dashboard-tab">Overview</a>
			<a href="/app/portfolio" class="ly-dashboard-tab active">Portfolio</a>
			<a href="/app/plan" class="ly-dashboard-tab">My Plan</a>
		</nav>
	</PageHeader>

	<div class="content-area">
	{#if portfolio.length === 0}
		<div class="import-section">
			<div class="import-card">
				<div class="empty-briefcase">
					<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" width="42" height="42"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/></svg>
				</div>
				<h3>No invested deals yet</h3>
				<p>Move a deal to <strong>Invested</strong> in Deal Flow and it will appear here automatically.</p>
				<div class="browse-link"><a href="/app/deals">Open Deal Flow →</a></div>
			</div>
		</div>
	{:else}
		<!-- Summary cards -->
		<div class="summary-grid">
			<div class="stat-card"><div class="stat-label">Total Invested</div><div class="stat-value">${totalInvested.toLocaleString()}</div></div>
			<div class="stat-card"><div class="stat-label">Active Investments</div><div class="stat-value">{activeCount}</div></div>
			<div class="stat-card"><div class="stat-label">Total Distributions</div><div class="stat-value">${totalDistributions.toLocaleString()}</div></div>
			<div class="stat-card"><div class="stat-label">Avg Target IRR</div><div class="stat-value">{avgIRR ? avgIRR.toFixed(1) + '%' : '--'}</div></div>
		</div>

		<!-- Charts row -->
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
					{/if}
				</div>
				<div class="alloc-legend">
					{#each allocationEntries as [cls, amt], i}
						<div class="alloc-legend-item">
							<span class="alloc-legend-dot" style="background:{PIE_COLORS[i % PIE_COLORS.length]}"></span>
							<span class="alloc-legend-label">{cls}</span>
							<span class="alloc-legend-pct">{((amt / totalInvested) * 100).toFixed(0)}%</span>
						</div>
					{/each}
				</div>
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
							<div class="risk-badge-icon">
								{#if insight.type === 'danger'}
									<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
								{:else if insight.type === 'warn'}
									<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
								{:else}
									<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
								{/if}
							</div>
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
		{/if}

		<div class="inv-header">
			<div class="inv-title">Active Investments</div>
			<div class="inv-subtitle">Deals moved to <strong>Invested</strong> appear here automatically. Add amounts and notes as needed.</div>
		</div>

		<div class="inv-list">
			{#each sorted as inv}
				{@const sc = statusColors[inv.status] || 'var(--text-muted)'}
				<div class="inv-card">
					<div class="inv-card-stripe" style="background:{sc}"></div>
					<div class="inv-card-body">
						<div class="inv-card-top">
							<div class="inv-card-info">
								<div class="inv-card-name">{inv.investmentName || 'Unnamed investment'}</div>
								<div class="inv-card-sub">
									{inv.sponsor || 'Unknown sponsor'}{inv.assetClass ? ` · ${inv.assetClass}` : ''}{inv.dateInvested ? ` · ${formatCardDate(inv.dateInvested)}` : ''}
								</div>
							</div>
							<div class="inv-card-actions">
								<span class="inv-status" style="--sc:{sc}">{inv.status || 'Unknown'}</span>
								<button class="btn-edit" onclick={() => openAddModal(inv.id)}>{inv._missingDetails ? 'Add Details' : 'Edit'}</button>
							</div>
						</div>
						<div class="inv-card-metrics">
							<div class="inv-metric">
								<div class="m-label">Invested</div>
								<div class="m-value">${(parseFloat(inv.amountInvested) || 0).toLocaleString()}</div>
							</div>
							{#if inv.targetIRR}
								<div class="inv-metric">
									<div class="m-label">Target IRR</div>
									<div class="m-value green">{inv.targetIRR}%</div>
								</div>
							{/if}
							<div class="inv-metric">
								<div class="m-label">Distributions</div>
								<div class="m-value" class:green={parseFloat(inv.distributionsReceived || 0) > 0}>${(parseFloat(inv.distributionsReceived) || 0).toLocaleString()}</div>
							</div>
							{#if inv.equityMultiple}
								<div class="inv-metric">
									<div class="m-label">Equity Multiple</div>
									<div class="m-value">{inv.equityMultiple}x</div>
								</div>
							{/if}
						</div>
						{#if inv.notes}
							<div class="inv-card-notes">{inv.notes}</div>
						{:else if inv._missingDetails}
							<div class="inv-card-notes">Add amount, date, and other details to complete this invested deal.</div>
						{/if}
					</div>
				</div>
			{/each}
		</div>
	{/if}
	</div>
</PageContainer>

<!-- Add/Edit Investment Modal -->
{#if showAddModal}
	<div
		class="modal-overlay"
		role="button"
		tabindex="0"
		aria-label="Close investment form modal"
		onclick={(e) => { if (e.target === e.currentTarget) showAddModal = false; }}
		onkeydown={(e) => {
			if (e.target !== e.currentTarget) return;
			if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') {
				e.preventDefault();
				showAddModal = false;
			}
		}}
	>
		<div class="modal-card">
			<div class="modal-top">
				<div class="modal-title">{editingId ? (hasPersistedDetails ? 'Edit Details' : 'Add Details') : 'Add Investment'}</div>
				<button class="modal-close" aria-label="Close investment form modal" onclick={() => showAddModal = false}>&times;</button>
			</div>
			<div class="modal-grid">
				<div class="modal-field"><label for="portfolioInvestmentName">Investment Name *</label><input id="portfolioInvestmentName" bind:value={modalData.investmentName} placeholder="e.g. Acme Multi-Family Fund II"></div>
				<div class="modal-field"><label for="portfolioSponsor">Sponsor</label><input id="portfolioSponsor" bind:value={modalData.sponsor} placeholder="e.g. Acme Capital"></div>
				<div class="modal-field">
					<label for="portfolioAssetClass">Asset Class</label>
					<select id="portfolioAssetClass" bind:value={modalData.assetClass}>
						<option value="">Select...</option>
						<option>Multi Family</option><option>Self Storage</option><option>Industrial</option>
						<option>Lending</option><option>Short Term Rental</option><option>Hotels/Hospitality</option>
						<option>Mixed-Use</option><option>RV/Mobile Home Parks</option><option>Senior Living</option>
						<option>Land</option><option>Car Wash</option><option>Oil & Gas</option><option>Other</option>
					</select>
				</div>
				<div class="modal-field"><label for="portfolioAmountInvested">Amount Invested ($)</label><input id="portfolioAmountInvested" type="number" bind:value={modalData.amountInvested} placeholder="50000"></div>
				<div class="modal-field"><label for="portfolioDateInvested">Date Invested</label><input id="portfolioDateInvested" type="date" bind:value={modalData.dateInvested}></div>
				<div class="modal-field">
					<label for="portfolioStatus">Status</label>
					<select id="portfolioStatus" bind:value={modalData.status}>
						<option>Active</option><option>Distributing</option><option>Exited</option><option>Pending</option>
					</select>
				</div>
				<div class="modal-field"><label for="portfolioTargetIRR">Target IRR (%)</label><input id="portfolioTargetIRR" type="number" step="0.1" bind:value={modalData.targetIRR} placeholder="15"></div>
				<div class="modal-field"><label for="portfolioDistributionsReceived">Distributions Received ($)</label><input id="portfolioDistributionsReceived" type="number" bind:value={modalData.distributionsReceived} placeholder="0"></div>
				<div class="modal-field"><label for="portfolioEquityMultiple">Equity Multiple</label><input id="portfolioEquityMultiple" type="number" step="0.01" bind:value={modalData.equityMultiple} placeholder="1.8"></div>
				<div class="modal-field"><label for="portfolioHoldPeriod">Hold Period (years)</label><input id="portfolioHoldPeriod" bind:value={modalData.holdPeriod} placeholder="e.g. 5"></div>
				<div class="modal-field"><label for="portfolioInvestingEntity">Investing Entity</label><input id="portfolioInvestingEntity" bind:value={modalData.investingEntity} placeholder="e.g. My LLC"></div>
				<div class="modal-field"><label for="portfolioEntityInvestedInto">Entity Invested Into</label><input id="portfolioEntityInvestedInto" bind:value={modalData.entityInvestedInto} placeholder="e.g. Acme Fund II LLC"></div>
				<div class="modal-field full-width"><label for="portfolioNotes">Notes</label><textarea id="portfolioNotes" bind:value={modalData.notes} rows="2" placeholder="Optional notes about this investment..."></textarea></div>
			</div>
			<div class="modal-actions">
				{#if editingId && hasPersistedDetails}
					<button class="btn-danger" onclick={() => { showAddModal = false; deleteInvestment(editingId); }}>Delete Details</button>
				{/if}
				<div style="flex:1"></div>
				<button class="btn-cancel" onclick={() => showAddModal = false}>Cancel</button>
				<button class="btn-primary" onclick={saveInvestment}>{editingId ? 'Save Details' : 'Add Investment'}</button>
			</div>
		</div>
	</div>
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
	/* ── Summary Stat Cards ── */
	.summary-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px; margin-bottom: 20px; }
	.summary-grid .stat-card:nth-child(5) { display: none; }
	.stat-card {
		background: var(--bg-card);
		border: 1px solid var(--border);
		border-radius: var(--radius);
		padding: 18px;
		text-align: center;
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
		font-size: 24px;
		font-weight: 800;
		color: var(--primary);
		font-family: var(--font-ui);
	}

	/* ── Charts Row ── */
	.charts-row { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 20px; }
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
	.alloc-meta { display: flex; justify-content: center; gap: 24px; margin-top: 16px; }
	.alloc-stat { text-align: center; }
	.alloc-num { font-family: var(--font-ui); font-size: 22px; font-weight: 800; color: var(--text-dark); }
	.alloc-label { font-family: var(--font-ui); font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: var(--text-muted); }

	/* ── Allocation Donut ── */
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

	/* ── Risk Insights (matches old border-left style) ── */
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
	.risk-badge-icon { display: none; }
	.risk-badge-icon svg { width: 20px; height: 20px; }
	.risk-badge-content { flex: 1; }
	.risk-badge-text { font-family: var(--font-ui); font-size: 13px; font-weight: 700; line-height: 1.4; }
	.risk-badge-detail { font-family: var(--font-body); font-size: 12px; color: var(--text-secondary); line-height: 1.5; margin-top: 2px; }
	.risk-badge.badge-danger {
		background: var(--bg-card);
		border: 1px solid var(--border);
		border-left: 4px solid var(--red, #D04040);
	}
	.risk-badge.badge-danger .risk-badge-text { color: var(--text-dark); }
	.risk-badge.badge-warn {
		background: var(--bg-card);
		border: 1px solid var(--border);
		border-left: 4px solid var(--orange);
	}
	.risk-badge.badge-warn .risk-badge-text { color: var(--text-dark); }
	.risk-badge.badge-ok {
		background: var(--bg-card);
		border: 1px solid var(--border);
		border-left: 4px solid var(--green);
	}
	.risk-badge.badge-ok .risk-badge-text { color: var(--text-dark); }

	/* ── Timeline Chart ── */
	.timeline-card { margin-bottom: 20px; }
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

	/* ── Investment List Header ── */
	.inv-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
	.inv-title { font-family: var(--font-ui); font-size: 14px; font-weight: 700; color: var(--text-dark); }
	.inv-subtitle { max-width: 420px; font-family: var(--font-body); font-size: 13px; line-height: 1.5; color: var(--text-secondary); text-align: right; }
	.pending-section-label {
		margin: 20px 0 8px;
		scroll-margin-top: 96px;
		font-family: var(--font-ui);
		font-size: 12px;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.5px;
		color: var(--text-muted);
	}

	/* ── Investment Cards ── */
	.inv-list { display: flex; flex-direction: column; gap: 12px; margin-bottom: 24px; }
	.inv-card {
		background: var(--bg-card);
		border: 1px solid var(--border);
		border-radius: var(--radius);
		overflow: hidden;
		display: flex;
		transition: all 0.25s ease;
		box-shadow: 0 2px 10px rgba(15, 23, 42, 0.03);
	}
	.inv-card:hover { border-color: color-mix(in srgb, var(--primary) 18%, var(--border)); }
	.inv-card-stripe { width: 5px; flex-shrink: 0; }
	.inv-card-body { flex: 1; padding: 18px 22px; }
	.inv-card-top { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 14px; }
	.inv-card-info { min-width: 0; flex: 1; }
	.inv-card-name { font-family: var(--font-ui); font-size: 16px; font-weight: 700; color: var(--text-dark); margin-bottom: 2px; }
	.inv-card-sub { font-family: var(--font-body); font-size: 12px; color: var(--text-muted); }
	.inv-card-actions { display: flex; align-items: center; gap: 8px; flex-shrink: 0; margin-left: 12px; }
	.inv-status { padding: 4px 12px; border-radius: 100px; font-family: var(--font-ui); font-size: 11px; font-weight: 700; background: color-mix(in srgb, var(--sc) 8%, transparent); color: var(--sc); }
	.pending-status {
		--sc: #f59e0b;
		background: rgba(245, 158, 11, 0.08);
		color: #f59e0b;
	}
	.btn-edit {
		background: transparent;
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		padding: 5px 12px;
		cursor: pointer;
		font-family: var(--font-ui);
		font-size: 11px;
		font-weight: 600;
		color: var(--text-muted);
		transition: all 0.15s ease;
	}
	.btn-edit:hover {
		background: transparent;
		border-color: var(--primary);
		color: var(--primary);
	}
	.inv-card-metrics { display: flex; gap: 28px; flex-wrap: wrap; }
	.inv-metric { min-width: 110px; }
	.m-label { font-family: var(--font-ui); font-size: 9px; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px; }
	.m-value { font-family: var(--font-ui); font-size: 16px; font-weight: 800; color: var(--text-dark); font-variant-numeric: tabular-nums; }
	.m-value.green { color: var(--primary); }
	.pending-stripe { background: #f59e0b; }
	.pending-card-desc {
		font-family: var(--font-body);
		font-size: 12px;
		color: var(--text-secondary);
		line-height: 1.5;
	}
	.btn-pending-add {
		padding: 6px 14px;
		background: var(--primary);
		color: #fff;
		border: none;
		border-radius: var(--radius-sm);
		font-family: var(--font-ui);
		font-size: 11px;
		font-weight: 700;
		cursor: pointer;
		white-space: nowrap;
	}
	.btn-pending-add:hover { background: var(--primary-hover); }

	/* ── Import / Empty Card ── */
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
	.btn-manual {
		padding: 10px 24px;
		background: var(--primary);
		color: #fff;
		border: 1px solid var(--primary);
		border-radius: var(--radius-sm);
		font-family: var(--font-ui);
		font-weight: 700;
		font-size: 13px;
		cursor: pointer;
		transition: background 0.2s, border-color 0.2s;
	}
	.btn-manual:hover { background: var(--primary-hover); border-color: var(--primary-hover); color: #fff; }
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

	/* ── Investment Notes ── */
	.inv-card-notes {
		margin-top: 10px;
		padding-top: 10px;
		border-top: 1px solid var(--border);
		font-family: var(--font-body);
		font-size: 12px;
		color: var(--text-secondary);
		line-height: 1.5;
	}

	/* ── Deal Search Modal ── */
	.deal-search-hint { font-size: 13px; color: var(--text-secondary); margin: 0 0 16px; }
	.deal-search-input {
		width: 100%;
		padding: 10px 14px;
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		font-family: var(--font-body);
		font-size: 14px;
		margin-bottom: 12px;
		box-sizing: border-box;
		background: var(--bg-card);
		color: var(--text-dark);
	}
	.deal-search-input:focus { outline: none; border-color: var(--primary); }
	.deal-search-results { max-height: 280px; overflow-y: auto; margin-bottom: 16px; }
	.deal-search-empty { text-align: center; padding: 24px; color: var(--text-muted); font-size: 13px; }
	.deal-search-item {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 10px 12px;
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		margin-bottom: 6px;
		cursor: pointer;
		transition: background 0.15s;
		width: 100%;
		background: none;
		text-align: left;
		font-family: inherit;
	}
	.deal-search-item:hover:not(:disabled) { background: var(--bg-cream); }
	.deal-search-item.already { opacity: 0.5; cursor: default; }
	.deal-search-name { font-family: var(--font-ui); font-size: 13px; font-weight: 700; color: var(--text-dark); }
	.deal-search-sub { font-size: 11px; color: var(--text-secondary); }
	.deal-search-action { font-size: 11px; color: var(--text-muted); font-weight: 600; flex-shrink: 0; margin-left: 12px; }
	.deal-search-item.already .deal-search-action { color: var(--primary); }
	.deal-search-divider { border-top: 1px solid var(--border); padding-top: 12px; text-align: center; }
	.btn-manual-add {
		padding: 10px 20px;
		background: transparent;
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		font-family: var(--font-ui);
		font-weight: 600;
		font-size: 13px;
		cursor: pointer;
		color: var(--text-secondary);
		transition: border-color 0.2s, color 0.2s;
	}
	.btn-manual-add:hover { border-color: var(--primary); color: var(--primary); }

	/* ── Modal ── */
	.modal-overlay {
		position: fixed;
		top: 0; left: 0; right: 0; bottom: 0;
		background: rgba(0,0,0,0.22);
		z-index: 9999;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 20px;
		animation: modalFadeIn 0.2s ease;
	}
	@keyframes modalFadeIn { from { opacity: 0; } to { opacity: 1; } }
	@keyframes modalSlideUp {
		from { opacity: 0; transform: translateY(12px) scale(0.98); }
		to { opacity: 1; transform: translateY(0) scale(1); }
	}
	.modal-card {
		background: var(--bg-card);
		border-radius: 16px;
		padding: 28px;
		max-width: 600px;
		width: 100%;
		max-height: 90vh;
		overflow-y: auto;
		box-shadow: 0 24px 60px rgba(0,0,0,0.12), 0 0 0 1px rgba(0,0,0,0.03);
		animation: modalSlideUp 0.3s cubic-bezier(0.2, 0.8, 0.2, 1);
	}
	:global(html.dark) .modal-card { box-shadow: 0 24px 80px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.06); }
	.modal-top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; }
	.modal-title {
		font-family: var(--font-ui);
		font-size: 17px;
		font-weight: 700;
		color: var(--text-dark);
		letter-spacing: -0.2px;
	}
	.modal-close {
		width: 30px;
		height: 30px;
		border-radius: 50%;
		border: none;
		background: var(--bg-cream);
		color: var(--text-muted);
		font-size: 15px;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		transition: all 0.15s ease;
		line-height: 1;
	}
	.modal-close:hover { background: var(--border); color: var(--text-dark); }
	.modal-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0 16px; }
	.modal-field { margin-bottom: 16px; }
	.modal-field.full-width { grid-column: 1 / -1; }
	.modal-field label {
		display: block;
		font-family: var(--font-ui);
		font-size: 12px;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.5px;
		color: var(--text-muted);
		margin-bottom: 6px;
	}
	.modal-field input,
	.modal-field select,
	.modal-field textarea {
		width: 100%;
		padding: 10px 14px;
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		background: var(--bg-card);
		color: var(--text-dark);
		font-family: var(--font-body);
		font-size: 14px;
		box-sizing: border-box;
	}
	.modal-field textarea { resize: vertical; min-height: 60px; }
	.modal-field input:focus,
	.modal-field select:focus,
	.modal-field textarea:focus { outline: none; border-color: var(--primary); }
	.modal-actions { display: flex; align-items: center; gap: 10px; margin-top: 8px; }
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

	@media (min-width: 769px) and (max-width: 1024px) {
		.summary-grid {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}

		.charts-row {
			grid-template-columns: minmax(0, 1fr);
			gap: 20px;
		}

		.import-section {
			max-width: 640px;
			padding: 40px 24px;
		}

		.modal-card {
			max-width: 560px;
		}
	}

	/* ── Mobile Breakpoints ── */
	@media (max-width: 768px) {
		.charts-row { grid-template-columns: 1fr; }
		.modal-grid { grid-template-columns: 1fr; }
		.inv-header { flex-direction: column; gap: 12px; align-items: stretch; }
		.section-add-btn { width: 100%; }
		.summary-grid { grid-template-columns: repeat(2, 1fr); }
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
	}
</style>
