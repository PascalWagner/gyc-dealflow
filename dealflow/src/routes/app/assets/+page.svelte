<script>
	import { onMount, onDestroy } from 'svelte';
	import { deals, fetchDeals } from '$lib/stores/deals.js';

	let searchVal = $state('');
	let classFilter = $state('');
	let stateFilter = $state('');
	let highlightedId = $state(null);
	let map = null;
	let markers = [];
	let L;

	const STATE_COORDS = { AL:[32.8,-86.8],AK:[64.2,-153],AZ:[34.3,-111.7],AR:[34.8,-92.4],CA:[36.1,-119.7],CO:[39,-105.5],CT:[41.6,-72.7],DE:[39,-75.5],FL:[28.6,-82.4],GA:[32.7,-83.4],HI:[20.5,-157.5],ID:[44.4,-114.6],IL:[40,-89.4],IN:[39.8,-86.3],IA:[42,-93.5],KS:[38.5,-98.4],KY:[37.8,-85.3],LA:[31,-92],ME:[45.4,-69],MD:[39.3,-76.6],MA:[42.3,-71.8],MI:[44.2,-84.5],MN:[46.4,-94.3],MS:[32.8,-89.7],MO:[38.3,-92.5],MT:[47,-110],NE:[41.5,-99.8],NV:[39.5,-117.5],NH:[43.7,-71.6],NJ:[40.2,-74.7],NM:[34.5,-106],NY:[43,-75],NC:[35.6,-79.8],ND:[47.5,-100.5],OH:[40.2,-82.8],OK:[35.6,-97.5],OR:[43.9,-120.6],PA:[41.2,-77.2],RI:[41.7,-71.5],SC:[34,-81],SD:[44.5,-100.2],TN:[35.8,-86.6],TX:[31,-100],UT:[39.3,-111.7],VT:[44,-72.7],VA:[37.5,-79.5],WA:[47.4,-120.7],WV:[38.6,-80.6],WI:[44.3,-89.8],WY:[43,-107.6] };

	const assetClasses = $derived([...new Set($deals.map(d => d.assetClass).filter(Boolean))].sort());
	const locations = $derived([...new Set($deals.map(d => d.location || d.investingGeography || '').filter(Boolean))].sort());

	const assets = $derived(() => {
		return $deals.filter(d => {
			if (d.dealType === 'Fund') return false;
			if (classFilter && d.assetClass !== classFilter) return false;
			const loc = (d.location || d.investingGeography || '').toLowerCase();
			if (stateFilter && loc !== stateFilter.toLowerCase()) return false;
			if (searchVal) {
				const haystack = ((d.investmentName || '') + ' ' + (d.managementCompany || '') + ' ' + loc + ' ' + (d.assetClass || '')).toLowerCase();
				if (!haystack.includes(searchVal.toLowerCase())) return false;
			}
			return true;
		}).sort((a, b) => {
			const aAddr = (a.address || a.propertyAddress) ? 1 : 0;
			const bAddr = (b.address || b.propertyAddress) ? 1 : 0;
			if (bAddr !== aAddr) return bAddr - aAddr;
			return (a.investmentName || '').localeCompare(b.investmentName || '');
		});
	});

	function getCoords(deal) {
		const loc = (deal.location || '').toLowerCase().trim();
		const geo = (deal.investingGeography || '').toLowerCase().trim();
		const stateNames = { texas:'TX',colorado:'CO',florida:'FL',arizona:'AZ',california:'CA',georgia:'GA',tennessee:'TN',utah:'UT',ohio:'OH',michigan:'MI',virginia:'VA',nevada:'NV',oregon:'OR' };
		const text = loc + ' ' + geo;
		const stateMatch = text.match(/\b([A-Z]{2})\b/i) || text.match(/(texas|colorado|florida|arizona|california|georgia|tennessee|utah|ohio|michigan|virginia|nevada|oregon)/i);
		if (stateMatch) {
			const abbr = stateNames[stateMatch[1].toLowerCase()] || stateMatch[1].toUpperCase();
			if (STATE_COORDS[abbr]) return STATE_COORDS[abbr];
		}
		return null;
	}

	function getPlaceholder(ac) {
		const map = { 'Multi-Family': { bg: 'linear-gradient(135deg,#1F5159,#0A1E21)', icon: '&#127970;' }, 'Self-Storage': { bg: 'linear-gradient(135deg,#4C6A50,#2D3F2E)', icon: '&#128230;' } };
		return map[ac] || { bg: 'linear-gradient(135deg,#1F5159,#0A1E21)', icon: '&#128200;' };
	}

	function fmtPct(v) {
		if (!v) return '';
		const n = typeof v === 'number' ? (v <= 1 ? v * 100 : v) : 0;
		return n > 0 ? n.toFixed(1) + '%' : '';
	}

	function highlightAsset(id) {
		highlightedId = highlightedId === id ? null : id;
		updateMapMarkers();
		if (highlightedId && map) {
			const m = markers.find(mk => mk._dealId === id);
			if (m) { map.setView(m.getLatLng(), 8, { animate: true }); m.openPopup(); }
		}
	}

	function updateMapMarkers() {
		if (!map || !L) return;
		markers.forEach(m => map.removeLayer(m));
		markers = [];
		const list = assets();
		list.forEach(d => {
			const coords = getCoords(d);
			if (!coords) return;
			const isHL = highlightedId === d.id;
			const marker = L.circleMarker(coords, {
				radius: isHL ? 10 : 6, fillColor: isHL ? '#51BE7B' : '#1F5159',
				color: isHL ? '#51BE7B' : '#0A1E21', weight: isHL ? 3 : 1.5, fillOpacity: isHL ? 0.9 : 0.7
			}).addTo(map);
			marker.bindPopup(`<div style="font-family:var(--font-ui);min-width:180px;"><div style="font-size:13px;font-weight:700;margin-bottom:4px;">${d.investmentName}</div><div style="font-size:11px;color:#607179;margin-bottom:6px;">${d.managementCompany || ''} &middot; ${d.assetClass || ''}</div>${d.targetIRR ? `<div style="font-size:11px;"><strong>IRR:</strong> ${fmtPct(d.targetIRR)}</div>` : ''}<a href="/app/deals?id=${d.id}" style="display:inline-block;margin-top:6px;font-size:11px;font-weight:700;color:#51BE7B;">View Asset &rarr;</a></div>`);
			marker.on('click', () => { highlightedId = d.id; });
			marker._dealId = d.id;
			markers.push(marker);
		});
		setTimeout(() => map?.invalidateSize(), 100);
	}

	$effect(() => {
		assets(); // re-run when assets change
		if (map && L) updateMapMarkers();
	});

	onMount(async () => {
		await fetchDeals();
		const leaflet = await import('leaflet');
		L = leaflet.default || leaflet;
		// Leaflet CSS
		if (!document.querySelector('link[href*="leaflet.css"]')) {
			const link = document.createElement('link');
			link.rel = 'stylesheet';
			link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
			document.head.appendChild(link);
		}
		const el = document.getElementById('assetsMap');
		if (el) {
			map = L.map(el, { scrollWheelZoom: true }).setView([39.5, -98.5], 4);
			L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '&copy; OpenStreetMap', maxZoom: 18 }).addTo(map);
			updateMapMarkers();
		}
	});

	onDestroy(() => { if (map) { map.remove(); map = null; } });
</script>

<div class="assets-page">
	<div class="topbar">
		<div class="topbar-title">Assets</div>
		<div class="topbar-filters">
			<input type="text" bind:value={searchVal} placeholder="Search by name or location..." class="filter-input">
			<select bind:value={classFilter} class="filter-select">
				<option value="">All Asset Classes</option>
				{#each assetClasses as ac}<option value={ac}>{ac}</option>{/each}
			</select>
			<select bind:value={stateFilter} class="filter-select">
				<option value="">All Locations</option>
				{#each locations as loc}<option value={loc}>{loc}</option>{/each}
			</select>
		</div>
	</div>

	<div id="assetsMap" class="map-container"></div>

	<div class="asset-list">
		<div class="asset-count">{assets().length} assets</div>
		{#each assets() as d (d.id)}
			{@const ph = getPlaceholder(d.assetClass)}
			{@const loc = d.location || d.investingGeography || 'Unknown'}
			<button class="asset-row" class:highlighted={highlightedId === d.id} onclick={() => highlightAsset(d.id)}>
				<div class="asset-icon" style="background:{ph.bg}"><span>{@html ph.icon}</span></div>
				<div class="asset-info">
					<div class="asset-name">{d.investmentName}</div>
					<div class="asset-company">{d.managementCompany || ''}</div>
				</div>
				<span class="asset-class-badge">{d.assetClass || ''}</span>
				<div class="asset-loc">
					<div class="loc-label">Location</div>
					<div class="loc-value">{loc}</div>
				</div>
				{#if d.targetIRR}
					<div class="asset-irr">
						<div class="irr-label">IRR</div>
						<div class="irr-value">{fmtPct(d.targetIRR)}</div>
					</div>
				{/if}
				<a href="/app/deals?id={d.id}" class="btn-view" onclick={(e) => e.stopPropagation()}>View &rarr;</a>
			</button>
		{:else}
			<div class="empty-state">
				<div style="font-size:36px;opacity:0.3;margin-bottom:12px;">&#127968;</div>
				<div>No assets match your search</div>
			</div>
		{/each}
	</div>
</div>

<style>
	.assets-page { padding: 0; }
	.topbar { display: flex; align-items: center; gap: 16px; padding: 12px 24px; border-bottom: 1px solid var(--border); background: var(--bg-card); flex-wrap: wrap; }
	.topbar-title { font-family: var(--font-ui); font-size: 18px; font-weight: 800; color: var(--text-dark); }
	.topbar-filters { display: flex; gap: 8px; align-items: center; margin-left: auto; }
	.filter-input { padding: 7px 14px; border: 1px solid var(--border); border-radius: var(--radius-sm); font-family: var(--font-body); font-size: 13px; width: 220px; color: var(--text-dark); background: var(--bg-card); }
	.filter-select { padding: 7px 12px; border: 1px solid var(--border); border-radius: var(--radius-sm); font-family: var(--font-body); font-size: 13px; color: var(--text-dark); background: var(--bg-card); }
	.map-container { height: 340px; background: var(--border-light); }
	.asset-list { padding: 20px 24px; }
	.asset-count { font-family: var(--font-ui); font-size: 13px; color: var(--text-muted); margin-bottom: 14px; }
	.asset-row { display: flex; align-items: center; gap: 16px; padding: 14px 18px; background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius-sm); cursor: pointer; transition: all 0.15s; width: 100%; text-align: left; font-family: inherit; margin-bottom: 8px; }
	.asset-row:hover { border-color: var(--primary); }
	.asset-row.highlighted { background: var(--mint-bg, rgba(81,190,123,0.06)); border-color: var(--green, #51BE7B); }
	.asset-icon { width: 44px; height: 44px; border-radius: 10px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
	.asset-icon span { font-size: 20px; opacity: 0.5; }
	.asset-info { flex: 1; min-width: 0; }
	.asset-name { font-family: var(--font-ui); font-size: 14px; font-weight: 700; color: var(--text-dark); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
	.asset-company { font-family: var(--font-body); font-size: 12px; color: var(--text-muted); }
	.asset-class-badge { font-family: var(--font-ui); font-size: 10px; font-weight: 700; text-transform: uppercase; padding: 3px 10px; border-radius: 100px; background: rgba(81,190,123,0.08); color: var(--green, #51BE7B); flex-shrink: 0; }
	.asset-loc, .asset-irr { text-align: right; flex-shrink: 0; }
	.loc-label, .irr-label { font-family: var(--font-ui); font-size: 9px; color: var(--text-muted); text-transform: uppercase; }
	.loc-value { font-family: var(--font-ui); font-size: 12px; font-weight: 600; color: var(--text-dark); }
	.irr-value { font-family: var(--font-ui); font-size: 14px; font-weight: 800; color: var(--green, #51BE7B); }
	.btn-view { padding: 6px 14px; background: var(--primary); color: #fff; border-radius: var(--radius-sm); font-family: var(--font-ui); font-size: 11px; font-weight: 700; text-decoration: none; white-space: nowrap; flex-shrink: 0; }
	.empty-state { text-align: center; padding: 60px 20px; color: var(--text-muted); }
	@media (max-width: 768px) {
		.topbar { flex-direction: column; align-items: stretch; }
		.topbar-filters { margin-left: 0; flex-wrap: wrap; }
		.asset-row { flex-wrap: wrap; gap: 8px; }
		.asset-list { padding: 16px; }
	}
</style>
