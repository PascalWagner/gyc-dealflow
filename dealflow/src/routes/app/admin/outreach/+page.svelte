<script>
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { isAdmin, userToken } from '$lib/stores/auth.js';

	let statsCards = $state([]);
	let outreachData = $state([]);
	let searchQuery = $state('');
	let statusFilter = $state('all');
	let currentPage = $state(1);
	let totalCount = $state(0);
	let loading = $state(true);
	let searchTimer;

	const statuses = [
		{ value: 'all', label: 'All Statuses' },
		{ value: 'backlog', label: 'Backlog' },
		{ value: 'researching', label: 'Researching' },
		{ value: 'ready_to_contact', label: 'Ready to Contact' },
		{ value: 'contacted', label: 'Contacted' },
		{ value: 'follow_up', label: 'Follow Up' },
		{ value: 'in_discussion', label: 'In Discussion' },
		{ value: 'approved', label: 'Approved' },
		{ value: 'denied', label: 'Denied' }
	];

	const statusColors = {
		backlog: '#64748b', researching: '#3b82f6', ready_to_contact: '#0ea5e9',
		contacted: '#f59e0b', follow_up: '#8b5cf6', in_discussion: '#d946ef',
		approved: '#10b981', denied: '#6b7280'
	};

	onMount(() => {
		if (!$isAdmin) { goto('/app/deals'); return; }
		loadStats();
		loadData();
	});

	async function outreachFetch(body) {
		const token = $userToken;
		const resp = await fetch('/api/operator-outreach', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
			body: JSON.stringify(body)
		});
		return resp.json();
	}

	async function loadStats() {
		try {
			const result = await outreachFetch({ action: 'stats' });
			if (!result.success) return;
			const s = result.stats;
			statsCards = [
				{ label: 'Backlog', value: s.backlog || 0, color: '#64748b', filter: 'backlog' },
				{ label: 'Researching', value: s.researching || 0, color: '#3b82f6', filter: 'researching' },
				{ label: 'Ready', value: s.ready_to_contact || 0, color: '#0ea5e9', filter: 'ready_to_contact' },
				{ label: 'Contacted', value: s.contacted || 0, color: '#f59e0b', filter: 'contacted' },
				{ label: 'Follow Up', value: s.follow_up || 0, color: '#8b5cf6', filter: 'follow_up' },
				{ label: 'Discussing', value: s.in_discussion || 0, color: '#d946ef', filter: 'in_discussion' },
				{ label: 'Approved', value: s.approved || 0, color: '#10b981', filter: 'approved' },
				{ label: 'Denied', value: s.denied || 0, color: '#6b7280', filter: 'denied' },
				{ label: 'Deals Covered', value: (s.deals_covered || 0) + '/' + (s.deals_total || 0), color: 'var(--primary)', filter: '' }
			];
		} catch (e) { console.error(e); }
	}

	async function loadData() {
		loading = true;
		try {
			const result = await outreachFetch({ action: 'list', page: currentPage, limit: 50, search: searchQuery.trim(), status: statusFilter });
			if (result.success) { outreachData = result.data || []; totalCount = result.total || outreachData.length; }
		} catch (e) { console.error(e); }
		loading = false;
	}

	function searchDebounce() { clearTimeout(searchTimer); searchTimer = setTimeout(() => { currentPage = 1; loadData(); }, 300); }

	function filterByStatus(filter) { if (!filter) return; statusFilter = filter; currentPage = 1; loadData(); }

	async function seedNew() {
		const result = await outreachFetch({ action: 'seed-new' });
		alert(result.success ? 'Seeded ' + (result.count || 0) + ' new operators' : 'Failed: ' + (result.error || 'Unknown'));
		loadStats(); loadData();
	}

	function statusLabel(s) { return (s || '').replace(/_/g, ' ').replace(/\b\w/g, function(l) { return l.toUpperCase(); }); }
</script>

{#if !$isAdmin}
	<div style="display:flex;align-items:center;justify-content:center;min-height:60vh;color:var(--text-muted)">Redirecting...</div>
{:else}
<div class="op">
	<div class="tb"><div class="tt">Operator Outreach</div></div>
	<div class="ct">
		<div class="sg">{#each statsCards as card}<div class="sc" class:ck={!!card.filter} onclick={() => filterByStatus(card.filter)}><div class="sv" style="color:{card.color}">{card.value}</div><div class="sl">{card.label}</div></div>{/each}</div>
		<div class="fl">
			<div class="sw"><input type="text" placeholder="Search operators..." bind:value={searchQuery} oninput={searchDebounce}></div>
			<select bind:value={statusFilter} onchange={() => { currentPage = 1; loadData(); }}>{#each statuses as s}<option value={s.value}>{s.label}</option>{/each}</select>
			<button class="sb" onclick={seedNew}>Seed New Operators</button>
			<div class="rc">{totalCount} operators</div>
		</div>
		{#if loading}<div class="lm">Loading...</div>
		{:else}
		<div class="tc"><div class="tw">
			<table><thead><tr><th class="c" style="width:50px">Pri</th><th>Operator</th><th class="c" style="width:50px">Deals</th><th>Status</th><th>Contact</th><th>Permission</th><th style="width:200px"></th></tr></thead>
			<tbody>{#each outreachData as row}<tr>
				<td class="c">{row.priority || '--'}</td><td class="b">{row.operatorName || row.name || '--'}</td><td class="c">{row.dealCount || 0}</td>
				<td><span class="stb" style="color:{statusColors[row.status] || '#666'}">{statusLabel(row.status)}</span></td>
				<td class="m">{row.contactEmail || row.contactName || '--'}</td><td class="m">{row.permission || '--'}</td>
				<td>{#if row.notes}<span class="np">{row.notes.substring(0, 40)}{row.notes.length > 40 ? '...' : ''}</span>{/if}</td>
			</tr>{:else}<tr><td colspan="7" class="em">No outreach records found.</td></tr>{/each}</tbody></table>
		</div></div>
		<div class="pg"><button class="pb" disabled={currentPage <= 1} onclick={() => { currentPage--; loadData(); }}>Prev</button><span>Page {currentPage}</span><button class="pb" onclick={() => { currentPage++; loadData(); }}>Next</button></div>
		{/if}
	</div>
</div>
{/if}

<style>
	.op { min-height: 100vh; }
	.tb { display: flex; align-items: center; padding: 16px 24px; border-bottom: 1px solid var(--border); background: var(--bg-card); }
	.tt { font-family: var(--font-ui); font-size: 18px; font-weight: 800; color: var(--text-dark); }
	.ct { padding: 24px; max-width: 1400px; margin: 0 auto; }
	.sg { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 12px; margin-bottom: 24px; }
	.sc { background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius); padding: 16px; text-align: center; }
	.sc.ck { cursor: pointer; } .sc.ck:hover { box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
	.sv { font-family: var(--font-ui); font-size: 24px; font-weight: 800; }
	.sl { font-family: var(--font-ui); font-size: 11px; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px; margin-top: 4px; }
	.fl { display: flex; align-items: center; gap: 12px; margin-bottom: 20px; flex-wrap: wrap; }
	.sw { flex: 1; min-width: 200px; }
	.sw input { width: 100%; padding: 10px 14px; border: 1px solid var(--border); border-radius: var(--radius-sm); font-size: 14px; background: var(--bg-card); }
	select { padding: 10px 12px; border: 1px solid var(--border); border-radius: var(--radius-sm); background: var(--bg-card); font-family: var(--font-ui); font-size: 13px; font-weight: 600; }
	.sb { padding: 10px 16px; background: transparent; border: 1px solid var(--border); border-radius: var(--radius-sm); font-family: var(--font-ui); font-weight: 600; font-size: 12px; cursor: pointer; color: var(--text-secondary); }
	.rc { font-family: var(--font-ui); font-size: 13px; color: var(--text-muted); }
	.tc { background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius); overflow: hidden; }
	.tw { overflow-x: auto; }
	table { width: 100%; border-collapse: collapse; font-size: 13px; font-family: var(--font-body); }
	thead tr { border-bottom: 2px solid var(--border); background: var(--bg-cream); }
	th { text-align: left; padding: 10px 12px; font-family: var(--font-ui); font-weight: 600; font-size: 11px; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px; }
	td { padding: 10px 12px; border-bottom: 1px solid var(--border); color: var(--text-secondary); }
	.c { text-align: center; } .b { font-weight: 600; color: var(--text-dark); } .m { color: var(--text-muted); }
	.em { text-align: center; padding: 24px; color: var(--text-muted); }
	.stb { font-weight: 600; font-size: 12px; } .np { font-size: 11px; color: var(--text-muted); }
	.pg { display: flex; justify-content: center; align-items: center; gap: 12px; margin-top: 16px; font-family: var(--font-ui); font-size: 13px; color: var(--text-muted); }
	.pb { padding: 8px 16px; border: 1px solid var(--border); border-radius: var(--radius-sm); background: var(--bg-card); cursor: pointer; font-size: 13px; color: var(--text-secondary); }
	.pb:disabled { opacity: 0.4; cursor: default; }
	.lm { text-align: center; padding: 40px; color: var(--text-muted); }
	@media (max-width: 768px) { .fl { flex-direction: column; align-items: stretch; } }
</style>
