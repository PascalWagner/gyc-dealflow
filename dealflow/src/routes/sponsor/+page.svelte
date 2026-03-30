<script>
	import { page } from '$app/stores';
	import { browser } from '$app/environment';
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import {
		bootstrapProtectedRouteSession,
		isAdmin,
		isMember,
		user
	} from '$lib/stores/auth.js';
	import { PRIMARY_MOBILE_NAV_ITEMS } from '$lib/navigation/app-nav.js';
	import Sidebar from '$lib/components/Sidebar.svelte';
	import { tapLight } from '$lib/utils/haptics.js';
	import { isNativeApp } from '$lib/utils/platform.js';

	const SPONSOR_API_URL = '/api/sponsor';

	const BG_CHECK_SOURCES = [
		{ key: 'sec', name: 'SEC EDGAR', icon: 'sec', description: "Searches all Form D filings with the SEC. Verifies that the sponsor has properly filed their securities offerings and shows total capital raised.", benefit: 'Confirms the sponsor is legally raising capital and shows their track record of offerings' },
		{ key: 'finra', name: 'FINRA BrokerCheck', icon: 'finra', description: "Checks FINRA's public database for broker/dealer registrations, customer complaints, regulatory actions, and employment history.", benefit: 'Reveals any complaints, disciplinary actions, or regulatory issues in the securities industry' },
		{ key: 'iapd', name: 'SEC Investment Adviser', icon: 'iapd', description: "Searches the SEC's Investment Adviser Public Disclosure database for adviser registrations and any enforcement actions.", benefit: "Shows if they're a registered investment adviser and any disclosure events" },
		{ key: 'ofac', name: 'OFAC Sanctions', icon: 'ofac', description: "Screens against the U.S. Treasury's Specially Designated Nationals (SDN) list for sanctions matches.", benefit: 'Ensures the sponsor is not on any government sanctions or watchlists' },
		{ key: 'court', name: 'Federal Court Records', icon: 'court', description: "Searches PACER/CourtListener for federal lawsuits, bankruptcies, and judgments involving the person.", benefit: 'Surfaces any litigation history, bankruptcies, or legal judgments' }
	];

	let loading = $state(true);
	let sponsor = $state(null);
	let deals = $state([]);
	let bgResult = $state(null);
	let bgLoading = $state(false);
	const nativeCompanionMode = browser && isNativeApp();

	let isPaid = $derived($isMember || $isAdmin);
	let isAdminUser = $derived($isAdmin);

	function pct(val) {
		if (val == null) return '--';
		return (val * 100).toFixed(1) + '%';
	}
	function multiple(val) {
		if (val == null) return '--';
		return val.toFixed(1) + 'x';
	}
	function currency(val) {
		if (val == null) return '--';
		return '$' + val.toLocaleString();
	}
	function getInitials(name) {
		if (!name) return '?';
		return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 3);
	}
	function statusClass(status) {
		if (!status) return 'green';
		const s = status.toLowerCase();
		if (s.includes('open')) return 'green';
		if (s.includes('evergreen')) return 'blue';
		if (s.includes('closed')) return 'orange';
		return 'green';
	}
	function fmtMoney(n) {
		if (n >= 1000000) return '$' + (n / 1000000).toFixed(1) + 'M';
		if (n >= 1000) return '$' + (n / 1000).toFixed(0) + 'K';
		return '$' + n.toLocaleString();
	}

	let avgIRR = $derived(deals.length ? deals.reduce((sum, d) => sum + (d.targetIRR || 0), 0) / deals.length : null);
	let avgEM = $derived(deals.length ? deals.reduce((sum, d) => sum + (d.equityMultiple || 0), 0) / deals.length : null);

	let stats = $derived([
		{ label: 'Total Deals', value: deals.length },
		{ label: 'Avg Target IRR', value: avgIRR != null ? pct(avgIRR) : '--' },
		{ label: 'Avg Equity Multiple', value: avgEM != null ? multiple(avgEM) : '--' },
		{ label: 'Founded', value: sponsor?.foundingYear || '--' },
		{ label: 'Total Investors', value: sponsor?.totalInvestors != null ? sponsor.totalInvestors.toLocaleString() : '--' }
	]);

	let details = $derived(sponsor ? [
		{ label: 'Founded', value: sponsor.foundingYear || '--' },
		{ label: 'Headquarters', value: '--' },
		{ label: 'Asset Classes', value: (sponsor.assetClasses || []).join(', ') || '--' },
		{ label: 'Accepted Investors', value: 'Accredited' },
		{ label: 'Offering Types', value: sponsor.type || '--' },
		{ label: 'Last Updated', value: sponsor.lastUpdated ? new Date(sponsor.lastUpdated).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : '--' }
	] : []);

	let secUrl = $derived(sponsor ? 'https://www.sec.gov/cgi-bin/browse-edgar?company=' + encodeURIComponent(sponsor.name) + '&CIK=&type=D&dateb=&owner=include&count=40&search_text=&action=getcompany' : '');

	// Portfolio calculations
	let portfolioData = $derived.by(() => {
		if (!sponsor?.portfolioSnapshot?.length) return null;
		const ps = sponsor.portfolioSnapshot;
		let totalPurchase = 0, totalValue = 0, totalSqft = 0, capSum = 0, capCount = 0;
		ps.forEach(p => {
			totalPurchase += (p.purchasePrice || 0);
			totalValue += (p.estimatedValue || p.purchasePrice || 0);
			totalSqft += (p.sqft || 0);
			if (p.capRate) { capSum += p.capRate; capCount++; }
		});
		const avgCap = capCount > 0 ? (capSum / capCount).toFixed(1) : null;
		return { items: ps, totalPurchase, totalValue, totalSqft, avgCap };
	});

	function getBgSourceUrls(result) {
		if (!result) return {};
		if (result.source_urls) return result.source_urls;
		if (result.sourceUrls) return result.sourceUrls;
		try {
			const parsed = typeof result.summary === 'string' && result.summary.charAt(0) === '{' ? JSON.parse(result.summary) : null;
			if (parsed?.sourceUrls) return parsed.sourceUrls;
		} catch {}
		return {};
	}

	function getBgSearchedNames(result) {
		if (!result) return {};
		if (result.searched_names) return result.searched_names;
		if (result.searchedNames) return result.searchedNames;
		try {
			const parsed = typeof result.summary === 'string' && result.summary.charAt(0) === '{' ? JSON.parse(result.summary) : null;
			if (parsed?.searchedNames) return parsed.searchedNames;
		} catch {}
		const pn = result.person_name || result.personName || '';
		const cn = result.company_name || result.companyName || '';
		return { sec: cn || pn, finra: pn, iapd: pn, ofac: pn, court: pn };
	}

	function getBgStatus(source, result) {
		if (!result) return 'pending';
		let s = result[source.key + 'Status'] || result[source.key + '_status'] || 'pending';
		if (source.key === 'iapd' && s === 'error') s = 'not_found';
		return s;
	}

	function getBgStatusLabel(status) {
		const labels = { clear: 'Clear', flagged: 'Flagged', needs_review: 'Review', not_found: 'Not Found', pending: 'Pending', not_checked: 'N/A', error: 'Error' };
		return labels[status] || status;
	}

	function getBgResultText(source, result) {
		if (!result) return '';
		switch (source.key) {
			case 'sec': {
				const cnt = result.sec_filings_count || result.secFilingsCount || 0;
				return cnt > 0 ? cnt + ' filing(s) found' : 'No Form D filings found';
			}
			case 'finra': {
				if (result.finra_found || result.finraFound) {
					const disc = result.finra_disclosures || result.finraDisclosures || 0;
					return disc > 0 ? disc + ' disclosure event(s) found' : 'Registered, no disclosures';
				}
				return 'Not registered with FINRA (common for real estate sponsors)';
			}
			case 'iapd': {
				if (result.iapd_found || result.iapdFound) {
					const disc = result.iapd_disclosures || result.iapdDisclosures || 0;
					return disc > 0 ? disc + ' disclosure(s) found' : 'Registered adviser, clean record';
				}
				return 'Not registered as investment adviser (common for real estate sponsors)';
			}
			case 'ofac': {
				return (result.ofac_found || result.ofacFound) ? 'Potential match found — verify identity' : 'No sanctions matches';
			}
			case 'court': {
				const cnt = result.court_cases_count || result.courtCasesCount || 0;
				const bk = result.court_bankruptcies || result.courtBankruptcies || 0;
				return cnt > 0 ? cnt + ' case(s) found' + (bk > 0 ? ', including ' + bk + ' bankruptcy' : '') : 'No federal court records found';
			}
		}
		return '';
	}

	function getBgDetailItems(source, result) {
		if (!result) return [];
		const items = [];
		const sourceUrls = getBgSourceUrls(result);
		const sourceUrl = sourceUrls[source.key] || '';

		switch (source.key) {
			case 'sec': {
				const secEntities = result.sec_entities || result.secEntities || [];
				secEntities.slice(0, 5).forEach(e => {
					const edgarLink = e.cik ? 'https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=' + e.cik + '&type=D&dateb=&owner=include&count=40' : '';
					items.push({ text: (e.entityName || 'Filing') + (e.filingDate ? ' (' + e.filingDate + ')' : ''), url: edgarLink });
				});
				if (secEntities.length > 5) items.push({ text: '+ ' + (secEntities.length - 5) + ' more filing(s)', url: sourceUrl });
				break;
			}
			case 'finra': {
				if (result.finra_found || result.finraFound) {
					const finraDet = result.finra_details || result.finraDetails || {};
					const disc = result.finra_disclosures || result.finraDisclosures || 0;
					if (finraDet.crd) items.push({ text: 'CRD# ' + finraDet.crd + (finraDet.firmName ? ' \u2014 ' + finraDet.firmName : ''), url: 'https://brokercheck.finra.org/individual/summary/' + finraDet.crd });
					if (disc > 0) items.push({ text: 'View ' + disc + ' disclosure(s) on BrokerCheck', url: sourceUrl, severity: 'medium' });
				}
				break;
			}
			case 'iapd': {
				if ((result.iapd_found || result.iapdFound) && (result.iapd_disclosures || result.iapdDisclosures || 0) > 0) {
					items.push({ text: 'View disclosure(s) on IAPD', url: sourceUrl, severity: 'medium' });
				}
				break;
			}
			case 'ofac': {
				if (result.ofac_found || result.ofacFound) {
					items.push({ text: 'Search OFAC sanctions list to verify', url: sourceUrl, severity: 'high' });
				}
				break;
			}
			case 'court': {
				const courtDetails = result.court_details || result.courtDetails || [];
				courtDetails.slice(0, 5).forEach(c => {
					const caseUrl = c.docketNumber ? 'https://www.courtlistener.com/?q=%22' + encodeURIComponent(c.docketNumber) + '%22&type=r' : sourceUrl;
					const isBk = (c.court || '').toLowerCase().includes('bankr') || (c.caseName || '').toLowerCase().includes('bankrupt');
					items.push({ text: (c.caseName || 'Case') + (c.dateFiled ? ' \u2014 ' + c.dateFiled : '') + (c.court ? ' (' + c.court + ')' : ''), url: caseUrl, severity: isBk ? 'high' : 'medium' });
				});
				if (courtDetails.length > 5) items.push({ text: '+ ' + (courtDetails.length - 5) + ' more case(s)', url: sourceUrl });
				break;
			}
		}
		return items;
	}

	function getCeoRegStatus(result) {
		if (!result) return { finra: null, sec: null };
		const finraFound = result.finra_found || result.finraFound;
		const iapdFound = result.iapd_found || result.iapdFound;
		return {
			finra: finraFound ? (result.finra_disclosures || result.finraDisclosures || 0) > 0 ? 'flagged' : 'registered' : null,
			sec: iapdFound ? (result.iapd_disclosures || result.iapdDisclosures || 0) > 0 ? 'flagged' : 'registered' : null
		};
	}

	let bgOverallStatus = $derived(bgResult?.overall_status || 'pending');

	async function triggerBgCheck() {
		bgLoading = true;
		try {
			const headers = {
				'Content-Type': 'application/json',
				...($user?.token ? { Authorization: `Bearer ${$user.token}` } : {})
			};
			const resp = await fetch('/api/background-check', {
				method: 'POST',
				headers,
				body: JSON.stringify({
					action: 'run',
					personName: sponsor.ceo || sponsor.name,
					companyName: sponsor.name,
					managementCompanyId: sponsor.id
				})
			});
			if (!resp.ok) {
				const errData = await resp.json().catch(() => ({}));
				if (errData.upgrade) {
					alert('Background checks are available to Academy members.');
				} else {
					alert('Error running background check: ' + (errData.error || resp.status));
				}
				bgLoading = false;
				return;
			}
			const data = await resp.json();
			bgResult = data.result;
		} catch (e) {
			alert('Error: ' + e.message);
		}
		bgLoading = false;
	}

	async function loadBgReport(s) {
		if (!isPaid) return;
		try {
			const resp = await fetch('/api/background-check?managementCompanyId=' + encodeURIComponent(s.id), {
				headers: $user?.token ? { Authorization: `Bearer ${$user.token}` } : {}
			});
			if (resp.ok) {
				const data = await resp.json();
				if (data.results?.length > 0) {
					bgResult = data.results[0];
				}
			}
		} catch (e) {
			console.warn('Could not load cached background check:', e.message);
		}
	}

	onMount(async () => {
		const returnPath = `${$page.url.pathname}${$page.url.search}`;
		const boot = await bootstrapProtectedRouteSession({
			returnPath,
			hydrateScopedData: true
		});
		if (!boot.ok) {
			goto(boot.redirect);
			return;
		}

		const params = $page.url.searchParams;
		const id = params.get('id');
		const company = params.get('company');

		try {
			const qs = id ? 'id=' + encodeURIComponent(id) : 'company=' + encodeURIComponent(company);
			const resp = await fetch(SPONSOR_API_URL + '?' + qs);
			if (!resp.ok) throw new Error('API returned ' + resp.status);
			const data = await resp.json();
			if (data?.sponsor) {
				sponsor = data.sponsor;
				deals = data.sponsor.deals || [];
			}
		} catch (e) {
			console.warn('Sponsor API unavailable:', e.message);
			// Fallback data
			sponsor = { id: 'rec04XU06Qn5rIRJP', name: 'Cohen Investment Group', ceo: 'Hugh D. Cohen', website: 'https://www.coheninvestmentgroup.com', linkedinCeo: 'https://linkedin.com/in/hugh-cohen', foundingYear: 2013, type: 'Operator', investClearlyUrl: 'https://investclearly.com/sponsors/cohen-investment-group', totalInvestors: null, lastUpdated: '2026-02-23', assetClasses: ['Multi Family'], deals: [{ id: 'rec0ZkWEkJd7kvA5l', name: 'Highland Hills Apartments', assetClass: 'Multi Family', dealType: 'Syndication', targetIRR: 0.15, equityMultiple: 2.0, prefReturn: 0.08, minInvestment: 25000, holdPeriod: 5, status: 'Open to invest', strategy: 'Value-Add' }] };
			deals = sponsor.deals;
		}

		loading = false;

		if (sponsor) {
			loadBgReport(sponsor);
		}
	});

	function openPersonProfile(name) {
		goto('/person?name=' + encodeURIComponent(name));
	}
	function handlePersonCardKeydown(event, name) {
		if (event.key === 'Enter' || event.key === ' ') {
			event.preventDefault();
			openPersonProfile(name);
		}
	}
</script>

<svelte:head>
	<title>{sponsor?.name || 'Sponsor Profile'} - GYC Dealflow</title>
</svelte:head>

<div class="page-layout ly-sidebar-shell">
	<Sidebar currentPage="sponsor" hideHamburgerOnPhone={true} />

	<div class="main ly-sidebar-main ly-page">
		<div class="content-wrap ly-frame">

			{#if loading}
				<div class="skeleton ly-skeleton skeleton-header ly-skeleton-header"></div>
				<div class="skeleton ly-skeleton skeleton-stats ly-skeleton-stats"></div>
				<div class="skeleton ly-skeleton skeleton-card ly-skeleton-card"></div>
				<div class="skeleton ly-skeleton skeleton-card ly-skeleton-card"></div>
			{:else if sponsor}
				<!-- Sponsor Header -->
				<div class="sponsor-header">
					<div class="sponsor-header-inner">
						<div class="sponsor-avatar">{getInitials(sponsor.ceo || sponsor.name)}</div>
						<div class="sponsor-header-info">
							<h1 class="sponsor-name">{sponsor.name}</h1>
							{#if sponsor.ceo}
								<p class="sponsor-ceo">CEO: <a href="/person?name={encodeURIComponent(sponsor.ceo)}">{sponsor.ceo}</a></p>
							{/if}
							<div class="sponsor-tags">
								{#each sponsor.assetClasses || [] as ac}
									<span class="sponsor-tag asset-class">{ac}</span>
								{/each}
								{#if sponsor.type}
									<span class="sponsor-tag type-tag">{sponsor.type}</span>
								{/if}
							</div>
							<div class="sponsor-actions">
								{#if sponsor.website}
									<a href={sponsor.website} target="_blank" rel="noopener" class="btn-sponsor btn-sponsor-outline">
										<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
										Website
									</a>
								{/if}
								{#if sponsor.linkedinCeo}
									<a href={sponsor.linkedinCeo} target="_blank" rel="noopener" class="btn-sponsor btn-sponsor-outline">
										<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"/><rect x="2" y="9" width="4" height="12"/><circle cx="4" cy="4" r="2"/></svg>
										LinkedIn
									</a>
								{/if}
								{#if sponsor.investClearlyUrl}
									<a href={sponsor.investClearlyUrl} target="_blank" rel="noopener" class="btn-sponsor btn-sponsor-outline">
										<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
										InvestClearly
									</a>
								{/if}
							</div>
						</div>
					</div>
				</div>

				<!-- Stats Strip -->
				<div class="stats-strip ly-stat-grid">
					{#each stats as st}
						<div class="stat-card ly-stat-card">
							<div class="stat-card-value ly-stat-card-value">{st.value}</div>
							<div class="stat-card-label ly-stat-card-label">{st.label}</div>
						</div>
					{/each}
				</div>

				<!-- About Section -->
				<div class="section-card ly-panel">
					<div class="section-header ly-panel-header">
						<div class="section-title ly-section-title">About</div>
					</div>
					<div class="section-body ly-panel-body">
						<div class="details-grid">
							{#each details as d}
								<div class="detail-item">
									<div class="detail-label">{d.label}</div>
									<div class="detail-value">{d.value}</div>
								</div>
							{/each}
						</div>
					</div>
				</div>

				<!-- Deals Section -->
				<div class="section-card ly-panel">
					<div class="section-header ly-panel-header">
						<div class="section-title ly-section-title">Deals</div>
						<span class="section-badge ly-section-badge">{deals.length}</span>
					</div>
					<div class="section-body ly-panel-body">
						{#if deals.length === 0}
							<div class="empty-inline"><p>No deals listed from this sponsor yet.</p></div>
						{:else}
							<div class="deals-grid">
								{#each deals as d}
									<a href="/app/deals?id={d.id}" class="deal-card">
										<div class="deal-card-header">
											<div class="deal-card-badges">
												<span class="deal-badge {statusClass(d.status)}">{d.status || 'Open'}</span>
												{#if d.strategy}
													<span class="deal-badge orange">{d.strategy}</span>
												{/if}
											</div>
											<div class="deal-card-title">{d.name}</div>
											<div class="deal-card-subtitle">{d.assetClass || ''}{d.dealType ? ' \u00B7 ' + d.dealType : ''}</div>
										</div>
										<div class="deal-card-metrics">
											<div><div class="deal-metric-label">Target IRR</div><div class="deal-metric-value">{pct(d.targetIRR)}</div></div>
											<div><div class="deal-metric-label">Equity Multiple</div><div class="deal-metric-value">{multiple(d.equityMultiple)}</div></div>
											<div><div class="deal-metric-label">Pref Return</div><div class="deal-metric-value">{pct(d.prefReturn)}</div></div>
											<div><div class="deal-metric-label">Min Investment</div><div class="deal-metric-value">{currency(d.minInvestment)}</div></div>
										</div>
										<div class="deal-card-footer">
											<span class="deal-footer-tag">{d.holdPeriod ? d.holdPeriod + ' yr hold' : ''}</span>
											<span class="deal-footer-link">View Deal &rarr;</span>
										</div>
									</a>
								{/each}
							</div>
						{/if}
					</div>
				</div>

				<!-- Existing Portfolio -->
				{#if sponsor.portfolioSnapshot?.length > 0}
					<div class="section-card ly-panel" style:opacity={isPaid ? '1' : '0.5'}>
						<div class="section-header ly-panel-header">
							<div class="section-title ly-section-title">Existing Portfolio</div>
							<span class="section-badge ly-section-badge">{sponsor.portfolioSnapshot.length}</span>
						</div>
						<div class="section-body ly-panel-body">
							{#if !isPaid}
								<div class="portfolio-gate">
									<div class="portfolio-gate-icon">
										<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
									</div>
									<div class="portfolio-gate-title">{nativeCompanionMode ? 'Portfolio data is available to existing members on the web' : 'Portfolio Data — Academy Only'}</div>
									<div class="portfolio-gate-sub">
										{#if nativeCompanionMode}
											This operator's full portfolio, property details, and performance metrics stay available to existing members on the web.
										{:else}
											See this operator's full portfolio, property details, and performance metrics.
										{/if}
									</div>
									{#if !nativeCompanionMode}
										<a href="/app/academy" class="portfolio-gate-btn">Join Academy &rarr;</a>
									{/if}
								</div>
							{:else}
								{@const pd = portfolioData}
								{#if pd}
									<div class="portfolio-summary-stats">
										{#if pd.totalPurchase > 0}
											<div class="portfolio-stat"><div class="portfolio-stat-value">{fmtMoney(pd.totalPurchase)}</div><div class="portfolio-stat-label">Total Invested</div></div>
										{/if}
										{#if pd.totalValue > 0 && pd.totalValue !== pd.totalPurchase}
											<div class="portfolio-stat"><div class="portfolio-stat-value" style="color:var(--primary)">{fmtMoney(pd.totalValue)}</div><div class="portfolio-stat-label">Est. Value</div></div>
										{/if}
										{#if pd.totalSqft > 0}
											<div class="portfolio-stat"><div class="portfolio-stat-value">{pd.totalSqft.toLocaleString()}</div><div class="portfolio-stat-label">Total Sq Ft</div></div>
										{/if}
										{#if pd.avgCap}
											<div class="portfolio-stat"><div class="portfolio-stat-value">{pd.avgCap}%</div><div class="portfolio-stat-label">Avg Cap Rate</div></div>
										{/if}
									</div>
									<div class="portfolio-table-wrap ly-table-scroll">
										<table class="portfolio-table">
											<thead>
												<tr>
													<th>Property</th><th>Location</th><th class="text-right">Sq Ft</th><th class="text-right">Purchase Price</th><th class="text-right">Cap Rate</th><th class="text-right">Est. Value</th>
												</tr>
											</thead>
											<tbody>
												{#each pd.items as row, i}
													<tr class:alt={i % 2 !== 0}>
														<td class="font-bold">{row.name || ''}</td>
														<td class="text-secondary">{row.location || ''}</td>
														<td class="text-right text-secondary">{row.sqft ? row.sqft.toLocaleString() : '--'}</td>
														<td class="text-right">{row.purchasePrice ? '$' + row.purchasePrice.toLocaleString() : '--'}</td>
														<td class="text-right">{row.capRate ? row.capRate + '%' : '--'}</td>
														<td class="text-right text-primary font-bold">{row.estimatedValue ? '$' + row.estimatedValue.toLocaleString() : '--'}</td>
													</tr>
												{/each}
											</tbody>
											<tfoot>
												<tr>
													<td class="font-bold">Total</td><td></td>
													<td class="text-right">{pd.totalSqft > 0 ? pd.totalSqft.toLocaleString() : ''}</td>
													<td class="text-right">{pd.totalPurchase > 0 ? '$' + pd.totalPurchase.toLocaleString() : ''}</td>
													<td class="text-right">{pd.avgCap ? pd.avgCap + '%' : ''}</td>
													<td class="text-right text-primary">{pd.totalValue > 0 ? '$' + pd.totalValue.toLocaleString() : ''}</td>
												</tr>
											</tfoot>
										</table>
									</div>
								{/if}
							{/if}
						</div>
					</div>
				{/if}

				<!-- Key People -->
				<div class="section-card ly-panel">
					<div class="section-header ly-panel-header">
						<div class="section-title ly-section-title">Key People</div>
					</div>
					<div class="section-body ly-panel-body">
						<div class="people-grid">
							{#if sponsor.ceo}
								{@const regStatus = getCeoRegStatus(bgResult)}
								<div
									class="person-card"
									style="cursor:pointer;"
									role="button"
									tabindex="0"
									aria-label={`Open profile for ${sponsor.ceo}`}
									onclick={() => openPersonProfile(sponsor.ceo)}
									onkeydown={(event) => handlePersonCardKeydown(event, sponsor.ceo)}
								>
									{#if sponsor.ceoPhoto}
										<img class="person-avatar-img" src={sponsor.ceoPhoto} alt={sponsor.ceo} />
									{:else}
										<div class="person-avatar">{getInitials(sponsor.ceo)}</div>
									{/if}
									<div class="person-info">
										<div class="person-name">{sponsor.ceo}</div>
										<div class="person-role">Chief Executive Officer</div>
										{#if regStatus.finra || regStatus.sec}
											<div class="person-reg-badges">
												{#if regStatus.finra}
													<span class="person-reg-badge" class:flagged={regStatus.finra === 'flagged'}>
														<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:10px;height:10px;"><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-4 0v7h-4v-7a6 6 0 0 1 6-6z"/><rect x="2" y="9" width="4" height="12"/><circle cx="4" cy="4" r="2"/></svg>
														FINRA {regStatus.finra === 'flagged' ? 'Flagged' : 'Registered'}
													</span>
												{/if}
												{#if regStatus.sec}
													<span class="person-reg-badge" class:flagged={regStatus.sec === 'flagged'}>
														<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:10px;height:10px;"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
														SEC RIA {regStatus.sec === 'flagged' ? 'Flagged' : 'Registered'}
													</span>
												{/if}
											</div>
										{/if}
										<div class="person-links">
											{#if sponsor.linkedinCeo}
												<a href={sponsor.linkedinCeo} target="_blank" rel="noopener" class="person-link" onclick={(e) => e.stopPropagation()}>
													<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-4 0v7h-4v-7a6 6 0 0 1 6-6z"/><rect x="2" y="9" width="4" height="12"/><circle cx="4" cy="4" r="2"/></svg>
													LinkedIn
												</a>
											{/if}
											<a href="/person?name={encodeURIComponent(sponsor.ceo)}" class="person-link" onclick={(e) => e.stopPropagation()}>View Profile &rarr;</a>
										</div>
									</div>
								</div>
							{/if}
							{#if sponsor.teamMembers?.length}
								{#each sponsor.teamMembers as member}
									<div
										class="person-card"
										style="cursor:pointer;"
										role="button"
										tabindex="0"
										aria-label={`Open profile for ${member.name}`}
										onclick={() => openPersonProfile(member.name)}
										onkeydown={(event) => handlePersonCardKeydown(event, member.name)}
									>
										{#if member.photo}
											<img class="person-avatar-img" src={member.photo} alt={member.name} />
										{:else}
											<div class="person-avatar">{getInitials(member.name)}</div>
										{/if}
										<div class="person-info">
											<div class="person-name">{member.name}</div>
											<div class="person-role">{member.title || 'Team Member'}</div>
											<div class="person-links">
												{#if member.linkedin}
													<a href={member.linkedin} target="_blank" rel="noopener" class="person-link" onclick={(e) => e.stopPropagation()}>
														<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-4 0v7h-4v-7a6 6 0 0 1 6-6z"/><rect x="2" y="9" width="4" height="12"/><circle cx="4" cy="4" r="2"/></svg>
														LinkedIn
													</a>
												{/if}
												<a href="/person?name={encodeURIComponent(member.name)}" class="person-link" onclick={(e) => e.stopPropagation()}>View Profile &rarr;</a>
											</div>
										</div>
									</div>
								{/each}
							{/if}
							<div class="person-card placeholder-card">
								<div class="person-avatar placeholder-avatar">+</div>
								<div class="person-info">
									<div class="person-name" style="color:var(--text-muted)">More team members</div>
									<div class="person-role">Profiles added regularly</div>
								</div>
							</div>
						</div>
					</div>
				</div>

				<!-- Background Report -->
				<div class="section-card ly-panel">
					<div class="section-header ly-panel-header bg-report-header">
						<div style="display:flex;align-items:center;gap:10px;">
							<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:18px;height:18px;color:var(--primary);"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
							<div class="section-title ly-section-title">Sponsor Background Report</div>
						</div>
						<div class="bg-report-status {bgOverallStatus}">
							{#if bgOverallStatus === 'clear'}
								<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
								<span>All Clear</span>
							{:else if bgOverallStatus === 'flagged'}
								<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
								<span>Flags Found</span>
							{:else if bgOverallStatus === 'needs_review'}
								<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 8v4"/><path d="M12 16h.01"/></svg>
								<span>Needs Review</span>
							{:else}
								<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
								<span>Not Yet Run</span>
							{/if}
						</div>
					</div>
					<div class="section-body ly-panel-body">
						<div class="bg-report-intro">
							<strong>What is this?</strong> We automatically search 5 free public databases on every sponsor to surface potential red flags before you invest.
							This includes SEC filings, FINRA broker records, investment adviser disclosures, Treasury sanctions screening, and federal court records.
							<strong>No sponsor can hide from public records.</strong>
						</div>

						{#if !isPaid}
							<!-- Free tier gate -->
							<div class="bg-checks-grid">
								{#each BG_CHECK_SOURCES as src}
									<div class="bg-check-row" style="opacity:0.6;">
										<div class="bg-check-icon {src.icon}">
											{#if src.key === 'sec'}
												<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
											{:else if src.key === 'finra'}
												<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-4 0v7h-4v-7a6 6 0 0 1 6-6z"/><rect x="2" y="9" width="4" height="12"/><circle cx="4" cy="4" r="2"/></svg>
											{:else if src.key === 'iapd'}
												<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
											{:else if src.key === 'ofac'}
												<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="M12 8v4"/><path d="M12 16h.01"/></svg>
											{:else if src.key === 'court'}
												<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 21h18"/><path d="M5 21V7l7-4 7 4v14"/><path d="M9 21v-4h6v4"/><path d="M9 10h.01"/><path d="M15 10h.01"/></svg>
											{/if}
										</div>
										<div class="bg-check-info">
											<div class="bg-check-source">{src.name}</div>
											<div class="bg-check-desc">{src.description}</div>
											<div class="bg-check-result" style="color:var(--primary);font-weight:600;">{src.benefit}</div>
										</div>
									</div>
								{/each}
							</div>
							<div class="bg-report-gate">
								<div class="bg-report-gate-title">{nativeCompanionMode ? 'Background checks stay available to existing members on the web' : 'Automated Background Checks'}</div>
								<div class="bg-report-gate-sub">
									{#if nativeCompanionMode}
										Automated searches across public government databases remain available to existing members in their web account.
									{:else}
										Academy members get automated public records searches across 5 government databases for every sponsor.
									{/if}
								</div>
								{#if !nativeCompanionMode}
									<button class="bg-report-run-btn" onclick={() => window.open('/app/academy', '_blank')}>Join Cashflow Academy &rarr;</button>
								{/if}
							</div>
						{:else if bgResult}
							<!-- Has results -->
							<div class="bg-checks-grid">
								{#each BG_CHECK_SOURCES as src}
									{@const status = getBgStatus(src, bgResult)}
									{@const sourceUrls = getBgSourceUrls(bgResult)}
									{@const searchedNames = getBgSearchedNames(bgResult)}
									{@const detailItems = getBgDetailItems(src, bgResult)}
									<div class="bg-check-row">
										<div class="bg-check-icon {src.icon}">
											{#if src.key === 'sec'}
												<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
											{:else if src.key === 'finra'}
												<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-4 0v7h-4v-7a6 6 0 0 1 6-6z"/><rect x="2" y="9" width="4" height="12"/><circle cx="4" cy="4" r="2"/></svg>
											{:else if src.key === 'iapd'}
												<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
											{:else if src.key === 'ofac'}
												<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="M12 8v4"/><path d="M12 16h.01"/></svg>
											{:else if src.key === 'court'}
												<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 21h18"/><path d="M5 21V7l7-4 7 4v14"/><path d="M9 21v-4h6v4"/><path d="M9 10h.01"/><path d="M15 10h.01"/></svg>
											{/if}
										</div>
										<div class="bg-check-info">
											<div class="bg-check-source">
												{src.name}
												<span class="check-badge {status}">{getBgStatusLabel(status)}</span>
											</div>
											<div class="bg-check-desc">{src.description}</div>
											<div class="bg-check-result" style="display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;">
												<span>{getBgResultText(src, bgResult)}</span>
												{#if searchedNames[src.key] || sourceUrls[src.key]}
													<span class="bg-check-result-links">
														{#if searchedNames[src.key]}
															<span class="searched-name">Searched: {searchedNames[src.key]}</span>
														{/if}
														{#if sourceUrls[src.key]}
															<a href={sourceUrls[src.key]} target="_blank" rel="noopener">View Search &rarr;</a>
														{/if}
													</span>
												{/if}
											</div>
											{#if detailItems.length > 0}
												{@const hasSevere = detailItems.some(d => d.severity)}
												<div class="bg-detail-items" class:has-severe={hasSevere}>
													{#each detailItems as item}
														<div class="bg-detail-item" style="color:{item.severity === 'high' ? '#DC2626' : item.severity === 'medium' ? '#CF7A30' : 'var(--text-secondary)'}">
															{#if item.severity}
																<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="bg-detail-icon"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
															{:else}
																<svg viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" stroke-width="2" class="bg-detail-icon"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
															{/if}
															{#if item.url}
																<a href={item.url} target="_blank" rel="noopener" class="bg-detail-link" class:bg-detail-severity={item.severity}>{item.text}</a>
															{:else}
																<span>{item.text}</span>
															{/if}
														</div>
													{/each}
												</div>
											{/if}
										</div>
									</div>
								{/each}
							</div>
							{#if bgResult.run_at}
								<div class="bg-report-timestamp">
									<span>Last checked: {new Date(bgResult.run_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
									{#if isAdminUser}
										<button class="bg-report-run-btn small" onclick={triggerBgCheck} disabled={bgLoading}>
											{#if bgLoading}Running...{:else}Re-run Check{/if}
										</button>
									{/if}
								</div>
							{/if}
						{:else}
							<!-- No results yet -->
							<div class="bg-checks-grid">
								{#each BG_CHECK_SOURCES as src}
									<div class="bg-check-row">
										<div class="bg-check-icon {src.icon}">
											{#if src.key === 'sec'}
												<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
											{:else if src.key === 'finra'}
												<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-4 0v7h-4v-7a6 6 0 0 1 6-6z"/><rect x="2" y="9" width="4" height="12"/><circle cx="4" cy="4" r="2"/></svg>
											{:else if src.key === 'iapd'}
												<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
											{:else if src.key === 'ofac'}
												<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="M12 8v4"/><path d="M12 16h.01"/></svg>
											{:else if src.key === 'court'}
												<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 21h18"/><path d="M5 21V7l7-4 7 4v14"/><path d="M9 21v-4h6v4"/><path d="M9 10h.01"/><path d="M15 10h.01"/></svg>
											{/if}
										</div>
										<div class="bg-check-info">
											<div class="bg-check-source">{src.name} <span class="check-badge pending">Pending</span></div>
											<div class="bg-check-desc">{src.description}</div>
											<div class="bg-check-result" style="color:var(--primary);font-weight:600;">{src.benefit}</div>
										</div>
									</div>
								{/each}
							</div>
							<div class="bg-not-run">
								<div>Background check has not been run for this sponsor yet. This runs automatically when a deal is enriched.</div>
								{#if isAdminUser}
									<button class="bg-report-run-btn" onclick={triggerBgCheck} disabled={bgLoading}>
										{#if bgLoading}Running checks...{:else}Run Background Check{/if}
									</button>
								{/if}
							</div>
						{/if}
					</div>
				</div>

				<!-- Research -->
				<div class="section-card ly-panel">
					<div class="section-header ly-panel-header">
						<div class="section-title ly-section-title">Research</div>
					</div>
					<div class="section-body ly-panel-body">
						<div class="research-grid">
							{#if sponsor.website}
								<a href={sponsor.website} target="_blank" rel="noopener" class="research-tile">
									<div class="research-icon website"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg></div>
									<div><div class="research-label">Website</div><div class="research-url">{sponsor.website.replace(/^https?:\/\//, '')}</div></div>
								</a>
							{/if}
							{#if sponsor.linkedinCeo}
								<a href={sponsor.linkedinCeo} target="_blank" rel="noopener" class="research-tile">
									<div class="research-icon linkedin"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-4 0v7h-4v-7a6 6 0 0 1 6-6z"/><rect x="2" y="9" width="4" height="12"/><circle cx="4" cy="4" r="2"/></svg></div>
									<div><div class="research-label">LinkedIn</div><div class="research-url">CEO Profile</div></div>
								</a>
							{/if}
							{#if sponsor.investClearlyUrl}
								<a href={sponsor.investClearlyUrl} target="_blank" rel="noopener" class="research-tile">
									<div class="research-icon investclearly"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg></div>
									<div><div class="research-label">InvestClearly</div><div class="research-url">Sponsor Reviews</div></div>
								</a>
							{/if}
							<a href={secUrl} target="_blank" rel="noopener" class="research-tile">
								<div class="research-icon sec"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg></div>
								<div><div class="research-label">SEC EDGAR</div><div class="research-url">Search filings</div></div>
							</a>
						</div>
					</div>
				</div>
			{/if}
		</div>
	</div>

	<nav class="sponsor-mobile-tabs" aria-label="Primary">
		{#each PRIMARY_MOBILE_NAV_ITEMS as item}
			<a
				href={item.href}
				class="sponsor-mobile-tab"
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
</div>

<style>
	.main {
		--sponsor-mobile-tab-bar-offset: calc(72px + env(safe-area-inset-bottom, 0px));
		--ly-main-pad-bottom-tablet: var(--sponsor-mobile-tab-bar-offset);
		--ly-main-pad-bottom-mobile: var(--sponsor-mobile-tab-bar-offset);
	}
	.content-wrap {
		--ly-frame-max: 1200px;
		--ly-frame-pad-desktop: clamp(32px, 3vw, 40px);
		--ly-frame-pad-tablet: 24px;
		--ly-frame-pad-mobile: 16px;
		--ly-frame-pad-top: 32px;
		--ly-frame-pad-bottom: 64px;
		margin: 0 auto;
		min-width: 0;
	}
	.content-wrap,
	.content-wrap > *,
	.sponsor-header-inner > *,
	.stats-strip > *,
	.details-grid > *,
	.deals-grid > *,
	.deal-card > *,
	.deal-card-metrics > *,
	.people-grid > *,
	.person-card > *,
	.person-links > *,
	.bg-report-header > *,
	.bg-check-row > *,
	.research-grid > *,
	.research-tile > *,
	.portfolio-summary-stats > *,
	.portfolio-table-wrap > * {
		min-width: 0;
	}

	.sponsor-mobile-tabs {
		display: none;
		position: fixed;
		bottom: 0;
		left: 0;
		right: 0;
		background: var(--bg-sidebar, #1a1a2e);
		border-top: 1px solid rgba(255,255,255,0.08);
		z-index: 100;
		padding: 6px 0 calc(env(safe-area-inset-bottom, 0px) + 8px);
	}
	.sponsor-mobile-tab {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 2px;
		color: rgba(255,255,255,0.5);
		text-decoration: none;
		font-size: 10px;
		font-family: var(--font-ui);
		padding: 4px 0;
		transition: color 0.2s;
	}
	.sponsor-mobile-tab.active {
		color: var(--primary, #00c9a7);
	}
	.sponsor-mobile-tab:hover {
		color: rgba(255,255,255,0.8);
	}

	/* Sponsor Header */
	.sponsor-header { background: linear-gradient(145deg, var(--teal-midnight) 0%, var(--teal-deep) 100%); border-radius: var(--radius); padding: 36px 40px; margin-bottom: 24px; position: relative; overflow: hidden; }
	.sponsor-header::after { content: ''; position: absolute; top: -60%; right: -10%; width: 300px; height: 300px; background: radial-gradient(circle, rgba(81,190,123,0.1) 0%, transparent 70%); border-radius: 50%; pointer-events: none; }
	.sponsor-header-inner { display: flex; align-items: flex-start; gap: 28px; position: relative; z-index: 1; min-width: 0; }
	.sponsor-avatar { width: 80px; height: 80px; border-radius: 50%; background: var(--primary); display: flex; align-items: center; justify-content: center; font-family: var(--font-ui); font-weight: 800; color: #fff; font-size: 24px; flex-shrink: 0; letter-spacing: -0.5px; }
	.sponsor-header-info { flex: 1; min-width: 0; }
	.sponsor-name { font-family: var(--font-headline); font-size: 32px; color: #fff; line-height: 1.2; letter-spacing: -0.5px; margin-bottom: 4px; }
	.sponsor-ceo { font-family: var(--font-ui); font-size: 14px; font-weight: 500; color: rgba(255,255,255,0.6); margin-bottom: 12px; }
	.sponsor-ceo a { color: rgba(255,255,255,0.85); font-weight: 600; text-decoration: none; border-bottom: 1px solid rgba(255,255,255,0.3); }
	.sponsor-tags { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 20px; }
	.sponsor-tag { display: inline-flex; align-items: center; padding: 4px 12px; border-radius: 20px; font-family: var(--font-ui); font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; }
	.sponsor-tag.asset-class { background: rgba(81,190,123,0.2); color: var(--accent-green); }
	.sponsor-tag.type-tag { background: rgba(255,255,255,0.1); color: rgba(255,255,255,0.7); }
	.sponsor-actions { display: flex; gap: 10px; flex-wrap: wrap; }
	.btn-sponsor { display: inline-flex; align-items: center; gap: 6px; padding: 10px 20px; font-family: var(--font-ui); font-size: 12px; font-weight: 700; letter-spacing: 0.3px; border-radius: var(--radius-sm); cursor: pointer; transition: all var(--transition); text-decoration: none; text-align: center; border: none; }
	.btn-sponsor svg { width: 15px; height: 15px; }
	.btn-sponsor-outline { background: none; border: 1px solid rgba(255,255,255,0.25); color: rgba(255,255,255,0.8); }
	.btn-sponsor-outline:hover { border-color: rgba(255,255,255,0.5); color: #fff; background: rgba(255,255,255,0.05); }

	/* Stats Strip */
	.stats-strip { grid-template-columns: repeat(5, minmax(0, 1fr)); }

	/* Details Grid */
	.details-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(200px, 100%), 1fr)); gap: 20px; }
	.detail-label { font-family: var(--font-ui); font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: var(--text-muted); margin-bottom: 4px; }
	.detail-value { font-family: var(--font-ui); font-size: 14px; font-weight: 700; color: var(--text-dark); }

	/* Deals Grid */
	.deals-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(320px, 100%), 1fr)); gap: 20px; }
	.deal-card { background: var(--bg-card); border-radius: var(--radius); border: 1px solid var(--border); box-shadow: var(--shadow-card); overflow: hidden; cursor: pointer; transition: all 0.25s ease; display: flex; flex-direction: column; text-decoration: none; color: inherit; width: 100%; max-width: 100%; box-sizing: border-box; }
	.deal-card:hover { box-shadow: var(--shadow-card-hover); transform: translateY(-2px); border-color: #D4C9AD; }
	.deal-card-header { padding: 16px 18px 12px; border-bottom: 1px solid var(--border-light); }
	.deal-card-badges { display: flex; gap: 6px; margin-bottom: 10px; flex-wrap: wrap; }
	.deal-badge { display: inline-flex; align-items: center; padding: 3px 10px; border-radius: 20px; font-family: var(--font-ui); font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; }
	.deal-badge.green { background: var(--green-bg); color: var(--green); }
	.deal-badge.blue { background: var(--blue-bg); color: var(--blue); }
	.deal-badge.orange { background: var(--orange-bg); color: var(--orange); }
	.deal-card-title { font-family: var(--font-ui); font-size: 15px; font-weight: 700; color: var(--text-dark); margin-bottom: 4px; line-height: 1.3; letter-spacing: -0.2px; }
	.deal-card-subtitle { font-family: var(--font-body); font-size: 12px; color: var(--text-muted); font-weight: 500; }
	.deal-card-metrics { padding: 14px 18px; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px 16px; flex: 1; }
	.deal-metric-label { font-family: var(--font-ui); font-size: 10px; font-weight: 600; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px; }
	.deal-metric-value { font-family: var(--font-ui); font-size: 14px; font-weight: 700; color: var(--text-dark); }
	.deal-card-footer { padding: 12px 18px; border-top: 1px solid var(--border-light); display: flex; align-items: center; justify-content: space-between; gap: 8px; flex-wrap: wrap; }
	.deal-footer-tag { font-family: var(--font-ui); font-size: 11px; font-weight: 600; color: var(--text-muted); }
	.deal-footer-link { font-family: var(--font-ui); font-size: 11px; font-weight: 700; color: var(--primary); text-transform: uppercase; letter-spacing: 0.5px; }

	/* People Grid */
	.people-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(280px, 100%), 1fr)); gap: 16px; }
	.person-card { display: flex; flex-direction: column; align-items: center; text-align: center; padding: 28px 24px 24px; border: 1px solid var(--border-light); border-radius: var(--radius); transition: border-color var(--transition), box-shadow var(--transition); width: 100%; max-width: 100%; box-sizing: border-box; }
	.person-card:hover { border-color: var(--primary); box-shadow: var(--shadow-card-hover); }
	.placeholder-card { border-style: dashed; opacity: 0.4; }
	.person-avatar { width: 64px; height: 64px; border-radius: 50%; background: linear-gradient(135deg, var(--teal-midnight), var(--teal-deep)); display: flex; align-items: center; justify-content: center; font-family: var(--font-ui); font-weight: 700; color: var(--accent-green); font-size: 20px; flex-shrink: 0; margin-bottom: 14px; }
	.person-avatar-img { width: 64px; height: 64px; border-radius: 50%; object-fit: cover; flex-shrink: 0; margin-bottom: 14px; border: 2px solid var(--border-light); }
	.placeholder-avatar { background: var(--border-light) !important; color: var(--text-muted) !important; font-size: 24px !important; }
	.person-info { width: 100%; }
	.person-name { font-family: var(--font-ui); font-size: 15px; font-weight: 700; color: var(--text-dark); margin-bottom: 3px; }
	.person-role { font-family: var(--font-ui); font-size: 12px; color: var(--text-muted); margin-bottom: 10px; }
	.person-reg-badges { display: flex; justify-content: center; gap: 6px; margin-bottom: 10px; flex-wrap: wrap; }
	.person-reg-badge { display: inline-flex; align-items: center; gap: 4px; font-family: var(--font-ui); font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; padding: 2px 8px; border-radius: 8px; background: var(--green-bg); color: var(--green); }
	.person-reg-badge.flagged { background: #FEE2E2; color: #DC2626; }
	.person-links { display: flex; justify-content: center; gap: 8px; flex-wrap: wrap; }
	.person-link { display: inline-flex; align-items: center; gap: 5px; font-family: var(--font-ui); font-size: 12px; font-weight: 600; color: var(--teal-deep); text-decoration: none; padding: 6px 14px; border-radius: 20px; border: 1px solid var(--border); transition: all var(--transition); }
	.person-link:hover { background: var(--mint-bg); border-color: var(--primary); }
	.person-link svg { width: 13px; height: 13px; }

	/* Background Report */
	.bg-report-header { display: flex; align-items: center; justify-content: space-between; gap: 10px; flex-wrap: wrap; }
	.bg-report-status { display: inline-flex; align-items: center; gap: 6px; padding: 4px 14px; border-radius: 20px; font-family: var(--font-ui); font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; }
	.bg-report-status svg { width: 14px; height: 14px; }
	.bg-report-status.clear { background: var(--green-bg); color: var(--green); }
	.bg-report-status.flagged { background: #FEE2E2; color: #DC2626; }
	.bg-report-status.needs_review { background: var(--orange-bg); color: var(--orange); }
	.bg-report-status.pending { background: var(--bg-cream); color: var(--text-muted); }
	.bg-report-intro { font-family: var(--font-body); font-size: 14px; line-height: 1.7; color: var(--text-secondary); margin-bottom: 20px; padding: 16px 20px; background: linear-gradient(135deg, var(--mint-bg) 0%, #f0fdf4 100%); border: 1px solid rgba(81,190,123,0.15); border-radius: var(--radius-sm); }
	.bg-report-intro strong { color: var(--text-dark); }
	.bg-checks-grid { display: grid; grid-template-columns: 1fr; gap: 12px; }
	.bg-check-row { display: flex; align-items: flex-start; gap: 14px; padding: 16px 20px; border: 1px solid var(--border-light); border-radius: var(--radius-sm); transition: border-color var(--transition); }
	.bg-check-row:hover { border-color: var(--border); }
	.bg-check-icon { width: 40px; height: 40px; border-radius: 10px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
	.bg-check-icon svg { width: 20px; height: 20px; }
	.bg-check-icon.sec { background: #F3E8FF; color: #7C3AED; }
	.bg-check-icon.finra { background: #DBEAFE; color: #1D4ED8; }
	.bg-check-icon.iapd { background: #E0E7FF; color: #4338CA; }
	.bg-check-icon.ofac { background: #FEF3C7; color: #D97706; }
	.bg-check-icon.court { background: #FEE2E2; color: #DC2626; }
	.bg-check-info { flex: 1; min-width: 0; }
	.bg-check-source { font-family: var(--font-ui); font-size: 13px; font-weight: 700; color: var(--text-dark); margin-bottom: 2px; display: flex; align-items: center; gap: 8px; }
	.check-badge { font-size: 9px; padding: 1px 8px; border-radius: 8px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; }
	.check-badge.clear { background: var(--green-bg); color: var(--green); }
	.check-badge.flagged { background: #FEE2E2; color: #DC2626; }
	.check-badge.needs_review { background: var(--orange-bg); color: var(--orange); }
	.check-badge.not_found, .check-badge.pending, .check-badge.not_checked { background: var(--bg-cream); color: var(--text-muted); }
	.check-badge.error { background: #FEE2E2; color: #DC2626; }
	.bg-check-desc { font-family: var(--font-body); font-size: 12px; color: var(--text-muted); line-height: 1.5; margin-bottom: 4px; }
	.bg-check-result { font-family: var(--font-ui); font-size: 12px; color: var(--text-secondary); font-weight: 500; }
	.bg-check-result a { color: var(--primary); text-decoration: none; font-weight: 600; }
	.bg-check-result a:hover { text-decoration: underline; }
	.bg-check-result-links { display: flex; align-items: center; gap: 8px; }
	.searched-name { color: var(--text-muted); font-size: 10px; }

	/* Background Detail Items */
	.bg-detail-items { margin-top: 8px; padding: 10px 12px; background: var(--bg-cream); border-radius: 6px; border: 1px solid var(--border-light); }
	.bg-detail-items.has-severe { background: #FEF2F2; border-color: #FECACA; }
	.bg-detail-item { display: flex; align-items: flex-start; gap: 6px; font-family: var(--font-ui); font-size: 11px; line-height: 1.5; }
	.bg-detail-item + .bg-detail-item { margin-top: 4px; }
	.bg-detail-icon { width: 12px; height: 12px; flex-shrink: 0; margin-top: 2px; }
	.bg-detail-link { color: inherit; text-decoration: none; border-bottom: 1px solid var(--border); }
	.bg-detail-link.bg-detail-severity { border-bottom-color: currentColor; }
	.bg-detail-link:hover { text-decoration: underline; }

	.bg-report-gate { text-align: center; padding: 32px 24px; background: linear-gradient(135deg, #EFF6FF 0%, #F0FDF4 100%); border: 1px dashed rgba(59,130,246,0.3); border-radius: var(--radius-sm); margin-top: 20px; }
	.bg-report-gate-title { font-family: var(--font-ui); font-size: 16px; font-weight: 800; color: var(--text-dark); margin-bottom: 8px; }
	.bg-report-gate-sub { font-family: var(--font-body); font-size: 13px; color: var(--text-secondary); margin-bottom: 16px; max-width: 480px; margin-left: auto; margin-right: auto; line-height: 1.6; }
	.bg-report-run-btn { display: inline-flex; align-items: center; gap: 8px; padding: 12px 24px; background: var(--primary); color: #fff; border: none; border-radius: var(--radius-sm); font-family: var(--font-ui); font-size: 13px; font-weight: 700; cursor: pointer; transition: all var(--transition); }
	.bg-report-run-btn:hover { background: var(--primary-hover); transform: translateY(-1px); box-shadow: 0 4px 16px rgba(81,190,123,0.4); }
	.bg-report-run-btn:disabled { opacity: 0.5; cursor: not-allowed; transform: none; box-shadow: none; }
	.bg-report-run-btn.small { padding: 8px 16px; font-size: 11px; }
	.bg-report-timestamp { font-family: var(--font-ui); font-size: 11px; color: var(--text-muted); margin-top: 16px; display: flex; align-items: center; justify-content: space-between; }
	.bg-not-run { text-align: center; margin-top: 20px; padding: 16px; background: var(--bg-cream); border-radius: var(--radius-sm); border: 1px solid var(--border); font-family: var(--font-ui); font-size: 13px; color: var(--text-secondary); }
	.bg-not-run button { margin-top: 12px; }

	/* Research Grid */
	.research-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(220px, 100%), 1fr)); gap: 14px; }
	.research-tile { display: flex; align-items: center; gap: 14px; padding: 16px 20px; border: 1px solid var(--border-light); border-radius: var(--radius); text-decoration: none; color: var(--text-dark); transition: all var(--transition); width: 100%; max-width: 100%; box-sizing: border-box; }
	.research-tile:hover { border-color: var(--primary); background: var(--off-white); transform: translateY(-1px); box-shadow: var(--shadow-card-hover); }
	.research-icon { width: 40px; height: 40px; border-radius: 10px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
	.research-icon.website { background: var(--green-bg); color: var(--green); }
	.research-icon.linkedin { background: var(--blue-bg); color: var(--blue); }
	.research-icon.investclearly { background: var(--orange-bg); color: var(--orange); }
	.research-icon.sec { background: #F3E8FF; color: #7C3AED; }
	.research-icon svg { width: 20px; height: 20px; }
	.research-label { font-family: var(--font-ui); font-size: 13px; font-weight: 600; }
	.research-url { font-family: var(--font-body); font-size: 11px; color: var(--text-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 160px; }

	/* Portfolio */
	.portfolio-gate { text-align: center; padding: 32px 20px; }
	.portfolio-gate-icon { width: 40px; height: 40px; border-radius: 50%; background: linear-gradient(135deg, #3b82f6, #4ade80); display: flex; align-items: center; justify-content: center; margin: 0 auto 12px; }
	.portfolio-gate-title { font-family: var(--font-ui); font-size: 14px; font-weight: 700; color: var(--text-dark); margin-bottom: 4px; }
	.portfolio-gate-sub { font-size: 12px; color: var(--text-secondary); margin-bottom: 12px; }
	.portfolio-gate-btn { display: inline-block; padding: 8px 20px; background: #3b82f6; color: #fff; border-radius: 6px; font-family: var(--font-ui); font-size: 12px; font-weight: 700; text-decoration: none; }
	.portfolio-summary-stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(130px, 100%), 1fr)); gap: 12px; margin-bottom: 20px; }
	.portfolio-stat { text-align: center; padding: 14px; background: var(--bg-cream); border-radius: var(--radius-sm); border: 1px solid var(--border); }
	.portfolio-stat-value { font-family: var(--font-ui); font-size: 20px; font-weight: 800; color: var(--text-dark); }
	.portfolio-stat-label { font-family: var(--font-ui); font-size: 11px; color: var(--text-muted); margin-top: 2px; }
	.portfolio-table-wrap { max-width: 100%; overflow-x: auto; }
	.portfolio-table { width: 100%; border-collapse: collapse; font-family: var(--font-body); font-size: 12px; }
	.portfolio-table thead tr { border-bottom: 2px solid var(--border); text-align: left; }
	.portfolio-table th { padding: 8px 10px; font-family: var(--font-ui); font-weight: 700; font-size: 11px; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px; }
	.portfolio-table td { padding: 8px 10px; }
	.portfolio-table tbody tr { border-bottom: 1px solid var(--border-light); }
	.portfolio-table tbody tr.alt { background: var(--bg-cream); }
	.portfolio-table tfoot tr { border-top: 2px solid var(--border); font-weight: 700; }
	.portfolio-table tfoot td { padding: 10px; font-family: var(--font-ui); }
	.text-right { text-align: right; }
	.text-secondary { color: var(--text-secondary); }
	.text-primary { color: var(--primary); }
	.font-bold { font-weight: 600; color: var(--text-dark); }

	/* Empty State */
	.empty-inline { text-align: center; padding: 40px 20px; color: var(--text-muted); }
	.empty-inline p { font-family: var(--font-ui); font-size: 13px; font-weight: 500; }

	/* Responsive */
	@media (max-width: 1024px) {
		.sponsor-mobile-tabs {
			display: flex;
			justify-content: space-around;
		}
		.sponsor-mobile-tab {
			font-size: 12px;
			padding: 8px 0;
			min-width: 64px;
			min-height: 44px;
		}
		.sponsor-mobile-tab svg {
			width: 24px;
			height: 24px;
		}
		.content-wrap {
			--ly-frame-pad-top-tablet: 20px;
			--ly-frame-pad-bottom-tablet: 48px;
		}
		.stats-strip { grid-template-columns: repeat(3, 1fr); }
		.deals-grid { grid-template-columns: 1fr; }
	}
	@media (max-width: 768px) {
		.sponsor-mobile-tab {
			font-size: 10px;
			padding: 4px 0;
		}
		.sponsor-mobile-tab svg {
			width: 20px;
			height: 20px;
		}
		.content-wrap {
			--ly-frame-pad-top-mobile: 20px;
			--ly-frame-pad-bottom-mobile: 48px;
		}
		.sponsor-header { padding: 24px 20px; }
		.sponsor-header-inner { flex-direction: column; align-items: center; text-align: center; gap: 16px; }
		.sponsor-tags { justify-content: center; }
		.sponsor-actions { justify-content: center; }
		.sponsor-name { font-size: 24px; }
		.stats-strip { grid-template-columns: repeat(2, 1fr); }
		.details-grid { grid-template-columns: 1fr 1fr; }
		.research-grid { grid-template-columns: 1fr; }
		.people-grid { grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); }
	}
	@media (max-width: 480px) {
		.stats-strip { grid-template-columns: 1fr 1fr; }
		.sponsor-actions { flex-direction: column; width: 100%; }
		.btn-sponsor { justify-content: center; width: 100%; }
		.details-grid { grid-template-columns: 1fr; }
	}
</style>
