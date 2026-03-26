<script>
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import {
		bootstrapProtectedRouteSession
	} from '$lib/stores/auth.js';
	import Sidebar from '$lib/components/Sidebar.svelte';

	const PERSON_API_URL = '/api/person';
	const PERSON_PHOTOS = {
		'grant cardone': 'https://cardonecapital.com/wp-content/uploads/2024/05/gc-new-headshot.jpg'
	};

	let loading = $state(true);
	let person = $state(null);
	let companies = $state([]);
	let deals = $state([]);
	let personStats = $state({});
	let sidebarOpen = $state(false);

	function pct(val) { return val == null ? '--' : (val * 100).toFixed(1) + '%'; }
	function multiple(val) { return val == null ? '--' : val.toFixed(1) + 'x'; }
	function currency(val) { return val == null ? '--' : '$' + val.toLocaleString(); }
	function getInitials(name) { return name ? name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 3) : '?'; }
	function statusClass(status) {
		if (!status) return 'green';
		const s = status.toLowerCase();
		if (s.includes('open')) return 'green';
		if (s.includes('evergreen')) return 'blue';
		if (s.includes('closed')) return 'orange';
		return 'green';
	}
	function getPersonPhotoUrl(name) { return name ? PERSON_PHOTOS[name.toLowerCase()] || null : null; }

	let photoUrl = $derived(person ? getPersonPhotoUrl(person.name) : null);

	let allAssetClasses = $derived.by(() => {
		const acs = [];
		companies.forEach(c => (c.assetClasses || []).forEach(ac => { if (!acs.includes(ac)) acs.push(ac); }));
		return acs;
	});

	let statCards = $derived([
		{ label: 'Firms', value: personStats.totalFirms || companies.length },
		{ label: 'Total Deals', value: personStats.totalDeals || deals.length },
		{ label: 'Avg Target IRR', value: personStats.avgIRR != null ? pct(personStats.avgIRR) : '--' },
		{ label: 'Avg Pref Return', value: personStats.avgPrefReturn != null ? pct(personStats.avgPrefReturn) : '--' }
	]);

	let secUrl = $derived(person ? 'https://www.sec.gov/cgi-bin/browse-edgar?company=&CIK=' + encodeURIComponent(person.name) + '&type=D&dateb=&owner=include&count=40&search_text=&action=getcompany' : '');

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

		const name = $page.url.searchParams.get('name');
		if (!name) {
			loading = false;
			return;
		}

		try {
			const resp = await fetch(PERSON_API_URL + '?name=' + encodeURIComponent(name));
			if (!resp.ok) throw new Error('API returned ' + resp.status);
			const data = await resp.json();
			if (data?.person) {
				person = data.person;
				companies = data.person.companies || [];
				deals = data.person.deals || [];
				personStats = data.person.stats || {};
			}
		} catch (e) {
			console.warn('Person API unavailable, using fallback:', e.message);
			person = { name: 'Grant Cardone', linkedIn: 'https://www.linkedin.com/in/grantcardone/', companies: [{ id: 'fallback-cc', name: 'Cardone Capital', role: 'CEO', website: 'https://cardonecapital.com', linkedinCeo: 'https://www.linkedin.com/in/grantcardone/', foundingYear: 2017, type: 'Fund Manager', assetClasses: ['Multi Family'], dealCount: 3 }], deals: [{ id: 'fallback-deal-1', name: 'Cardone Capital Fund 10X', companyName: 'Cardone Capital', assetClass: 'Multi Family', dealType: 'Fund', targetIRR: 0.12, equityMultiple: 1.8, prefReturn: 0.06, minInvestment: 5000, holdPeriod: 7, status: 'Closed', strategy: 'Core Plus' }], stats: { totalDeals: 3, totalFirms: 1, avgIRR: 0.12, avgEquityMultiple: 1.8, avgPrefReturn: 0.06 } };
			companies = person.companies;
			deals = person.deals;
			personStats = person.stats;
		}

		loading = false;
	});

	function toggleSidebar() { sidebarOpen = !sidebarOpen; }
</script>

<svelte:head>
	<title>{person?.name || 'Person Profile'} - GYC Dealflow</title>
</svelte:head>

<div class="page-layout">
	<Sidebar currentPage="person" />

	<div class="sidebar-overlay" class:open={sidebarOpen} onclick={() => sidebarOpen = false}></div>

	<div class="mobile-topbar">
		<button class="mobile-menu-btn" onclick={toggleSidebar}>
			<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
		</button>
		<div class="mobile-topbar-title">{person?.name || 'Person Profile'}</div>
		<a href="/app/deals" class="mobile-deals-link">Deals</a>
	</div>

	<div class="main">
		<div class="content-wrap">

			{#if loading}
				<div class="skeleton skeleton-header"></div>
				<div class="skeleton skeleton-stats"></div>
				<div class="skeleton skeleton-card"></div>
				<div class="skeleton skeleton-card"></div>
			{:else if !person}
				<div class="empty-inline"><p>Person not found.</p></div>
			{:else}
				<!-- Person Header -->
				<div class="person-header">
					<div class="person-header-inner">
						<div class="person-header-photo">
							{#if photoUrl}
								<img src={photoUrl} alt={person.name} onerror={(e) => { e.target.style.display = 'none'; e.target.parentElement.textContent = person.name?.split(' ').map(w => w[0]).join('') || '?'; }} />
							{:else}
								{getInitials(person.name)}
							{/if}
						</div>
						<div class="person-header-info">
							<h1 class="person-header-name">{person.name}</h1>
							{#if companies.length > 0}
								<p class="person-header-role">
									{companies[0].role}, <a href="/sponsor?company={encodeURIComponent(companies[0].name)}">{companies[0].name}</a>
								</p>
							{/if}
							<div class="person-tags">
								{#each allAssetClasses as ac}
									<span class="person-tag asset-class">{ac}</span>
								{/each}
								{#each companies as c}
									{#if c.type}
										<span class="person-tag type-tag">{c.type}</span>
									{/if}
								{/each}
							</div>
							<div class="person-actions">
								{#if person.linkedIn}
									<a href={person.linkedIn} target="_blank" rel="noopener" class="btn-person btn-person-outline">
										<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-4 0v7h-4v-7a6 6 0 0 1 6-6z"/><rect x="2" y="9" width="4" height="12"/><circle cx="4" cy="4" r="2"/></svg>
										LinkedIn
									</a>
								{/if}
								{#if companies.length > 0 && companies[0].website}
									<a href={companies[0].website} target="_blank" rel="noopener" class="btn-person btn-person-outline">
										<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
										Website
									</a>
								{/if}
							</div>
						</div>
					</div>
				</div>

				<!-- Stats Strip -->
				<div class="stats-strip">
					{#each statCards as st}
						<div class="stat-card">
							<div class="stat-card-value">{st.value}</div>
							<div class="stat-card-label">{st.label}</div>
						</div>
					{/each}
				</div>

				<!-- Firms Section -->
				<div class="section-card">
					<div class="section-header">
						<div class="section-title">Firms</div>
						<span class="section-badge">{companies.length}</span>
					</div>
					<div class="section-body">
						<div class="firms-grid">
							{#each companies as c}
								<a href="/sponsor?company={encodeURIComponent(c.name)}" class="firm-card">
									<div class="firm-avatar">{getInitials(c.name)}</div>
									<div class="firm-info">
										<div class="firm-name">{c.name}</div>
										<div class="firm-meta">{c.role || 'CEO'}{c.foundingYear ? ' \u00B7 Founded ' + c.foundingYear : ''}</div>
										<div class="firm-stats">
											<span class="firm-stat"><strong>{c.dealCount}</strong> deals</span>
											{#if c.assetClasses?.length}
												<span class="firm-stat">{c.assetClasses.join(', ')}</span>
											{/if}
										</div>
									</div>
								</a>
							{/each}
						</div>
					</div>
				</div>

				<!-- Deals Section -->
				<div class="section-card">
					<div class="section-header">
						<div class="section-title">Deals</div>
						<span class="section-badge">{deals.length}</span>
					</div>
					<div class="section-body">
						{#if deals.length === 0}
							<div class="empty-inline"><p>No deals found for this person.</p></div>
						{:else}
							<div class="deals-grid">
								{#each deals as d}
									<a href="/app/deals?id={d.id}" class="deal-card">
										<div class="deal-card-header">
											<div class="deal-card-badges">
												<span class="deal-badge {statusClass(d.status)}">{d.status || 'Open'}</span>
												{#if d.strategy}<span class="deal-badge orange">{d.strategy}</span>{/if}
											</div>
											<div class="deal-card-title">{d.name}</div>
											<div class="deal-card-subtitle">{d.companyName || ''}{d.assetClass ? ' \u00B7 ' + d.assetClass : ''}{d.dealType ? ' \u00B7 ' + d.dealType : ''}</div>
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

				<!-- Research -->
				<div class="section-card">
					<div class="section-header">
						<div class="section-title">Research</div>
					</div>
					<div class="section-body">
						<div class="research-grid">
							{#if person.linkedIn}
								<a href={person.linkedIn} target="_blank" rel="noopener" class="research-tile">
									<div class="research-icon linkedin"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-4 0v7h-4v-7a6 6 0 0 1 6-6z"/><rect x="2" y="9" width="4" height="12"/><circle cx="4" cy="4" r="2"/></svg></div>
									<div><div class="research-label">LinkedIn</div><div class="research-url">Personal Profile</div></div>
								</a>
							{/if}
							<a href={secUrl} target="_blank" rel="noopener" class="research-tile">
								<div class="research-icon sec"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg></div>
								<div><div class="research-label">SEC EDGAR</div><div class="research-url">Search filings</div></div>
							</a>
							{#each companies as c}
								{#if c.website}
									<a href={c.website} target="_blank" rel="noopener" class="research-tile">
										<div class="research-icon website"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg></div>
										<div><div class="research-label">{c.name}</div><div class="research-url">{c.website.replace(/^https?:\/\//, '')}</div></div>
									</a>
								{/if}
							{/each}
						</div>
					</div>
				</div>
			{/if}
		</div>
	</div>
</div>

<style>
	.page-layout { display: flex; min-height: 100vh; }
	.main { flex: 1; margin-left: var(--sidebar-width, 240px); min-height: 100vh; transition: margin-left 0.3s ease; }
	.content-wrap { max-width: 1200px; padding: 32px 40px 64px; margin: 0 auto; }

	.mobile-menu-btn { display: none; background: none; border: none; cursor: pointer; color: var(--text-dark); padding: 4px; }
	.mobile-menu-btn svg { width: 24px; height: 24px; }
	.mobile-topbar { display: none; position: sticky; top: 0; height: 56px; background: var(--bg-cream); border-bottom: 1px solid var(--border); align-items: center; padding: 0 20px; gap: 12px; z-index: 50; }
	.mobile-topbar-title { font-family: var(--font-ui); font-size: 14px; font-weight: 700; color: var(--text-dark); flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
	.mobile-deals-link { font-family: var(--font-ui); font-size: 12px; font-weight: 600; color: var(--primary); text-decoration: none; }
	.sidebar-overlay { display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.5); z-index: 99; }
	.sidebar-overlay.open { display: block; }

	.skeleton { position: relative; overflow: hidden; background: var(--border-light); border-radius: var(--radius-sm); }
	.skeleton::after { content: ''; position: absolute; inset: 0; background: linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.6) 50%, transparent 100%); animation: shimmer 1.5s infinite; }
	@keyframes shimmer { 0% { transform: translateX(-100%); } 100% { transform: translateX(100%); } }
	.skeleton-header { height: 180px; margin-bottom: 24px; }
	.skeleton-stats { height: 80px; margin-bottom: 24px; }
	.skeleton-card { height: 200px; margin-bottom: 20px; }

	/* Person Header */
	.person-header { background: linear-gradient(145deg, var(--teal-midnight) 0%, var(--teal-deep) 100%); border-radius: var(--radius); padding: 36px 40px; margin-bottom: 24px; position: relative; overflow: hidden; }
	.person-header::after { content: ''; position: absolute; top: -60%; right: -10%; width: 300px; height: 300px; background: radial-gradient(circle, rgba(81,190,123,0.1) 0%, transparent 70%); border-radius: 50%; pointer-events: none; }
	.person-header-inner { display: flex; align-items: flex-start; gap: 28px; position: relative; z-index: 1; }
	.person-header-photo { width: 96px; height: 96px; border-radius: 50%; background: var(--primary); display: flex; align-items: center; justify-content: center; font-family: var(--font-ui); font-weight: 800; color: #fff; font-size: 28px; flex-shrink: 0; letter-spacing: -0.5px; overflow: hidden; border: 3px solid rgba(255,255,255,0.15); }
	.person-header-photo img { width: 100%; height: 100%; object-fit: cover; }
	.person-header-info { flex: 1; }
	.person-header-name { font-family: var(--font-headline); font-size: 32px; color: #fff; line-height: 1.2; letter-spacing: -0.5px; margin-bottom: 4px; }
	.person-header-role { font-family: var(--font-ui); font-size: 14px; font-weight: 500; color: rgba(255,255,255,0.6); margin-bottom: 12px; }
	.person-header-role a { color: var(--accent-green); text-decoration: none; }
	.person-header-role a:hover { text-decoration: underline; }
	.person-tags { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 20px; }
	.person-tag { display: inline-flex; align-items: center; padding: 4px 12px; border-radius: 20px; font-family: var(--font-ui); font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; }
	.person-tag.asset-class { background: rgba(81,190,123,0.2); color: var(--accent-green); }
	.person-tag.type-tag { background: rgba(255,255,255,0.1); color: rgba(255,255,255,0.7); }
	.person-actions { display: flex; gap: 10px; flex-wrap: wrap; }
	.btn-person { display: inline-flex; align-items: center; gap: 6px; padding: 10px 20px; font-family: var(--font-ui); font-size: 12px; font-weight: 700; letter-spacing: 0.3px; border-radius: var(--radius-sm); cursor: pointer; transition: all var(--transition); text-decoration: none; text-align: center; border: none; }
	.btn-person svg { width: 15px; height: 15px; }
	.btn-person-outline { background: none; border: 1px solid rgba(255,255,255,0.25); color: rgba(255,255,255,0.8); }
	.btn-person-outline:hover { border-color: rgba(255,255,255,0.5); color: #fff; background: rgba(255,255,255,0.05); }

	/* Stats */
	.stats-strip { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 24px; }
	.stat-card { background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius); padding: 20px 18px; text-align: center; box-shadow: var(--shadow-card); }
	.stat-card-value { font-family: var(--font-headline); font-size: 26px; color: var(--teal-deep); line-height: 1; margin-bottom: 4px; }
	.stat-card-label { font-family: var(--font-ui); font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 1.2px; color: var(--text-muted); }

	/* Section Cards */
	.section-card { background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius); box-shadow: var(--shadow-card); margin-bottom: 24px; overflow: hidden; }
	.section-header { display: flex; align-items: center; gap: 10px; padding: 20px 28px; border-bottom: 1px solid var(--border-light); }
	.section-title { font-family: var(--font-ui); font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1.5px; color: var(--primary); }
	.section-badge { background: var(--green-bg); color: var(--green); font-family: var(--font-ui); font-size: 11px; font-weight: 700; padding: 2px 10px; border-radius: 10px; }
	.section-body { padding: 24px 28px; }

	/* Firms Grid */
	.firms-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 16px; }
	.firm-card { display: flex; align-items: center; gap: 16px; padding: 20px; border: 1px solid var(--border-light); border-radius: var(--radius); cursor: pointer; transition: all var(--transition); text-decoration: none; color: inherit; }
	.firm-card:hover { border-color: var(--primary); background: var(--off-white); transform: translateY(-1px); box-shadow: var(--shadow-card-hover); }
	.firm-avatar { width: 48px; height: 48px; border-radius: var(--radius-sm); background: linear-gradient(135deg, var(--teal-midnight), var(--teal-deep)); display: flex; align-items: center; justify-content: center; font-family: var(--font-ui); font-weight: 700; color: var(--accent-green); font-size: 14px; flex-shrink: 0; }
	.firm-info { flex: 1; min-width: 0; }
	.firm-name { font-family: var(--font-ui); font-size: 15px; font-weight: 700; color: var(--text-dark); margin-bottom: 2px; }
	.firm-meta { font-family: var(--font-ui); font-size: 12px; color: var(--text-muted); }
	.firm-stats { display: flex; gap: 16px; margin-top: 8px; }
	.firm-stat { font-family: var(--font-ui); font-size: 11px; font-weight: 600; color: var(--text-secondary); }
	.firm-stat strong { color: var(--text-dark); }

	/* Deals Grid */
	.deals-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 20px; }
	.deal-card { background: var(--bg-card); border-radius: var(--radius); border: 1px solid var(--border); box-shadow: var(--shadow-card); overflow: hidden; cursor: pointer; transition: all 0.25s ease; display: flex; flex-direction: column; text-decoration: none; color: inherit; }
	.deal-card:hover { box-shadow: var(--shadow-card-hover); transform: translateY(-2px); border-color: #D4C9AD; }
	.deal-card-header { padding: 16px 18px 12px; border-bottom: 1px solid var(--border-light); }
	.deal-card-badges { display: flex; gap: 6px; margin-bottom: 10px; flex-wrap: wrap; }
	.deal-badge { display: inline-flex; align-items: center; padding: 3px 10px; border-radius: 20px; font-family: var(--font-ui); font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; }
	.deal-badge.green { background: var(--green-bg); color: var(--green); }
	.deal-badge.blue { background: var(--blue-bg); color: var(--blue); }
	.deal-badge.orange { background: var(--orange-bg); color: var(--orange); }
	.deal-card-title { font-family: var(--font-ui); font-size: 15px; font-weight: 700; color: var(--text-dark); margin-bottom: 4px; line-height: 1.3; letter-spacing: -0.2px; }
	.deal-card-subtitle { font-family: var(--font-body); font-size: 12px; color: var(--text-muted); font-weight: 500; }
	.deal-card-metrics { padding: 14px 18px; display: grid; grid-template-columns: 1fr 1fr; gap: 12px 16px; flex: 1; }
	.deal-metric-label { font-family: var(--font-ui); font-size: 10px; font-weight: 600; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px; }
	.deal-metric-value { font-family: var(--font-ui); font-size: 14px; font-weight: 700; color: var(--text-dark); }
	.deal-card-footer { padding: 12px 18px; border-top: 1px solid var(--border-light); display: flex; align-items: center; justify-content: space-between; }
	.deal-footer-tag { font-family: var(--font-ui); font-size: 11px; font-weight: 600; color: var(--text-muted); }
	.deal-footer-link { font-family: var(--font-ui); font-size: 11px; font-weight: 700; color: var(--primary); text-transform: uppercase; letter-spacing: 0.5px; }

	/* Research Grid */
	.research-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 14px; }
	.research-tile { display: flex; align-items: center; gap: 14px; padding: 16px 20px; border: 1px solid var(--border-light); border-radius: var(--radius); text-decoration: none; color: var(--text-dark); transition: all var(--transition); }
	.research-tile:hover { border-color: var(--primary); background: var(--off-white); transform: translateY(-1px); box-shadow: var(--shadow-card-hover); }
	.research-icon { width: 40px; height: 40px; border-radius: 10px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
	.research-icon.linkedin { background: var(--blue-bg); color: var(--blue); }
	.research-icon.sec { background: #F3E8FF; color: #7C3AED; }
	.research-icon.website { background: var(--green-bg); color: var(--green); }
	.research-icon svg { width: 20px; height: 20px; }
	.research-label { font-family: var(--font-ui); font-size: 13px; font-weight: 600; }
	.research-url { font-family: var(--font-body); font-size: 11px; color: var(--text-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 160px; }

	.empty-inline { text-align: center; padding: 40px 20px; color: var(--text-muted); }
	.empty-inline p { font-family: var(--font-ui); font-size: 13px; font-weight: 500; }

	@media (max-width: 1024px) {
		.stats-strip { grid-template-columns: repeat(2, 1fr); }
		.deals-grid { grid-template-columns: 1fr; }
		.firms-grid { grid-template-columns: 1fr; }
	}
	@media (max-width: 768px) {
		.mobile-topbar { display: flex; }
		.main { margin-left: 0; }
		.content-wrap { padding: 20px 16px 48px; }
		.person-header { padding: 24px 20px; }
		.person-header-inner { flex-direction: column; align-items: center; text-align: center; gap: 16px; }
		.person-tags { justify-content: center; }
		.person-actions { justify-content: center; }
		.person-header-name { font-size: 24px; }
		.section-body { padding: 20px 18px; }
		.section-header { padding: 16px 18px; }
		.research-grid { grid-template-columns: 1fr; }
	}
	@media (max-width: 480px) {
		.stats-strip { grid-template-columns: 1fr 1fr; }
		.person-actions { flex-direction: column; width: 100%; }
		.btn-person { justify-content: center; width: 100%; }
	}
</style>
