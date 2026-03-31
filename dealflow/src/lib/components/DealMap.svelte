<script>
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';
	import { getDealOperatorName } from '$lib/utils/dealSponsors.js';

	let { deals = [] } = $props();

	let mapEl = $state(null);
	let leafletMap = null;
	let leaflet = null;
	let markers = [];

	// State coordinate lookups for geocoding
	const STATE_COORDS = {
		'AL':[32.8,-86.8],'AK':[64.2,-152.5],'AZ':[34.0,-111.1],'AR':[35.2,-91.8],'CA':[36.8,-119.4],
		'CO':[39.1,-105.4],'CT':[41.6,-72.7],'DE':[38.9,-75.5],'FL':[27.8,-81.8],'GA':[33.0,-83.5],
		'HI':[19.9,-155.6],'ID':[44.2,-114.4],'IL':[40.6,-89.4],'IN':[40.3,-86.1],'IA':[42.0,-93.2],
		'KS':[39.0,-98.5],'KY':[37.8,-84.3],'LA':[30.9,-92.3],'ME':[45.3,-69.4],'MD':[39.0,-76.6],
		'MA':[42.4,-71.4],'MI':[44.3,-85.6],'MN':[46.7,-94.7],'MS':[32.7,-89.7],'MO':[38.5,-92.3],
		'MT':[46.9,-110.4],'NE':[41.5,-99.7],'NV':[38.8,-116.4],'NH':[43.2,-71.6],'NJ':[40.1,-74.5],
		'NM':[34.5,-105.9],'NY':[43.3,-74.0],'NC':[35.8,-80.0],'ND':[47.5,-100.4],'OH':[40.4,-82.8],
		'OK':[35.0,-97.1],'OR':[43.8,-120.6],'PA':[41.2,-77.2],'RI':[41.6,-71.5],'SC':[33.8,-81.2],
		'SD':[43.9,-99.9],'TN':[35.5,-86.0],'TX':[31.0,-100.0],'UT':[39.3,-111.1],'VT':[44.0,-72.7],
		'VA':[37.8,-79.4],'WA':[47.8,-120.7],'WV':[38.6,-80.6],'WI':[43.8,-88.8],'WY':[43.1,-107.6],
		'DC':[38.9,-77.0]
	};

	const STATE_NAMES = {
		'alabama':'AL','alaska':'AK','arizona':'AZ','arkansas':'AR','california':'CA','colorado':'CO',
		'connecticut':'CT','delaware':'DE','florida':'FL','georgia':'GA','hawaii':'HI','idaho':'ID',
		'illinois':'IL','indiana':'IN','iowa':'IA','kansas':'KS','kentucky':'KY','louisiana':'LA',
		'maine':'ME','maryland':'MD','massachusetts':'MA','michigan':'MI','minnesota':'MN',
		'mississippi':'MS','missouri':'MO','montana':'MT','nebraska':'NE','nevada':'NV',
		'new hampshire':'NH','new jersey':'NJ','new mexico':'NM','new york':'NY',
		'north carolina':'NC','north dakota':'ND','ohio':'OH','oklahoma':'OK','oregon':'OR',
		'pennsylvania':'PA','rhode island':'RI','south carolina':'SC','south dakota':'SD',
		'tennessee':'TN','texas':'TX','utah':'UT','vermont':'VT','virginia':'VA','washington':'WA',
		'west virginia':'WV','wisconsin':'WI','wyoming':'WY','district of columbia':'DC'
	};

	const CITY_COORDS = {
		'atlanta, ga':[33.75,-84.39],'houston, tx':[29.76,-95.37],'dallas, tx':[32.78,-96.80],
		'austin, tx':[30.27,-97.74],'phoenix, az':[33.45,-112.07],'denver, co':[39.74,-104.99],
		'nashville, tn':[36.16,-86.78],'charlotte, nc':[35.23,-80.84],'tampa, fl':[27.95,-82.46],
		'orlando, fl':[28.54,-81.38],'miami, fl':[25.76,-80.19],'los angeles, ca':[34.05,-118.24],
		'san francisco, ca':[37.77,-122.42],'seattle, wa':[47.61,-122.33],
		'new york, ny':[40.71,-74.01],'chicago, il':[41.88,-87.63],
		'boston, ma':[42.36,-71.06],'washington, dc':[38.91,-77.04]
	};

	const SCATTER_CITIES = [
		[33.75,-84.39],[30.27,-97.74],[42.36,-71.06],[35.23,-80.84],[41.88,-87.63],
		[32.78,-96.80],[39.74,-104.99],[42.33,-83.05],[29.76,-95.37],[39.77,-86.16],
		[30.33,-81.66],[39.10,-94.58],[36.17,-115.14],[34.05,-118.24],[25.76,-80.19],
		[44.98,-93.27],[36.16,-86.78],[40.71,-74.01],[35.47,-97.52],[28.54,-81.38]
	];

	function hashId(id) {
		let h = 0;
		for (let i = 0; i < (id || '').length; i++) {
			h = ((h << 5) - h + id.charCodeAt(i)) | 0;
		}
		return Math.abs(h);
	}

	function geocode(deal) {
		const h = hashId(deal.id);
		const jLat = ((h % 100) - 50) * 0.006;
		const jLng = (((h >> 8) % 100) - 50) * 0.008;
		const jitter = (c) => [c[0] + jLat, c[1] + jLng];

		const loc = (deal.location || '').trim().toLowerCase();
		if (loc && CITY_COORDS[loc]) return jitter(CITY_COORDS[loc]);
		if (loc && STATE_NAMES[loc]) return jitter(STATE_COORDS[STATE_NAMES[loc]]);
		if (loc) {
			const abbr = loc.toUpperCase();
			if (STATE_COORDS[abbr]) return jitter(STATE_COORDS[abbr]);
			const parts = loc.split(',').map(s => s.trim());
			if (parts.length === 2) {
				const ck = parts[0] + ', ' + parts[1];
				if (CITY_COORDS[ck]) return jitter(CITY_COORDS[ck]);
				const st = parts[1].toUpperCase();
				if (STATE_COORDS[st]) return jitter(STATE_COORDS[st]);
			}
		}
		const geo = (deal.investingGeography || '').trim().toLowerCase();
		if (geo && geo !== 'usa' && geo !== 'nationwide' && geo !== 'various') {
			if (CITY_COORDS[geo]) return jitter(CITY_COORDS[geo]);
			if (STATE_NAMES[geo]) return jitter(STATE_COORDS[STATE_NAMES[geo]]);
			const ga = geo.toUpperCase();
			if (STATE_COORDS[ga]) return jitter(STATE_COORDS[ga]);
		}
		return jitter(SCATTER_CITIES[h % SCATTER_CITIES.length]);
	}

	function fmtPct(val) {
		if (!val) return 'N/A';
		const n = typeof val === 'string' ? parseFloat(val) : val;
		if (isNaN(n)) return 'N/A';
		return (n > 1 ? n : n * 100).toFixed(1) + '%';
	}

	async function initMap() {
		if (!browser || !mapEl) return;
		const L = leaflet || await import('leaflet');
		leaflet = L;
		await import('leaflet/dist/leaflet.css');

		if (!leafletMap) {
			leafletMap = L.map(mapEl).setView([37.5, -96], 4);
			L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
				attribution: '&copy; OpenStreetMap contributors',
				maxZoom: 18
			}).addTo(leafletMap);
		}

		// Clear old markers
		markers.forEach(m => leafletMap.removeLayer(m));
		markers = [];

		const mappedDeals = deals.filter(Boolean);
		const sixMonthsAgo = new Date();
		sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

		mappedDeals.forEach(deal => {
			const coords = geocode(deal);
			const dealDate = new Date(deal.addedDate);
			const isActive = dealDate >= sixMonthsAgo;
			const color = isActive ? '#51BE7B' : '#8A9AA0';

			const marker = L.circleMarker(coords, {
				radius: 10,
				fillColor: color,
				color: '#fff',
				weight: 2,
				opacity: 1,
				fillOpacity: 0.85
			}).addTo(leafletMap);

			marker.bindPopup(
				`<div style="font-family:var(--font-ui);min-width:200px;">
					<a href="/deal/${deal.id}" style="font-weight:700;font-size:14px;display:block;color:#1a7a5a;text-decoration:underline;margin-bottom:6px;">${deal.investmentName}</a>
					<div style="font-size:12px;color:#607179;margin-bottom:2px;"><strong>Sponsor:</strong> ${getDealOperatorName(deal, 'N/A')}</div>
					<div style="font-size:12px;color:#607179;margin-bottom:2px;"><strong>Asset Class:</strong> ${deal.assetClass || 'N/A'}</div>
					<div style="font-size:12px;color:#607179;margin-bottom:2px;"><strong>Target IRR:</strong> ${fmtPct(deal.targetIRR)}</div>
					<div style="font-size:12px;color:#607179;"><strong>Location:</strong> ${deal.location || deal.investingGeography || 'N/A'}</div>
				</div>`
			);
			markers.push(marker);
		});

		if (markers.length > 0) {
			const bounds = L.latLngBounds(markers.map((marker) => marker.getLatLng()));
			leafletMap.fitBounds(bounds, { padding: [28, 28], maxZoom: 8 });
		} else {
			leafletMap.setView([37.5, -96], 4);
		}

		setTimeout(() => { if (leafletMap) leafletMap.invalidateSize(); }, 100);
	}

	onMount(() => { initMap(); });

	$effect(() => {
		// Re-render markers when deals change
		if (deals && leafletMap) initMap();
	});
</script>

<div class="map-container">
	<div class="map-disclaimer">Note: Locations are approximate. Nationwide deals are scattered across major metros for visibility.</div>
	<div class="leaflet-map" bind:this={mapEl}></div>
</div>

<style>
	.map-container {
		height: clamp(320px, 44vh, 460px);
		min-height: 320px;
		display: flex;
		flex-direction: column;
		background: var(--bg-card);
		border-radius: var(--radius, 8px);
		overflow: hidden;
		border: 1px solid var(--border);
	}

	.map-disclaimer {
		padding: 8px 16px;
		background: var(--bg-card);
		font-family: var(--font-ui);
		font-size: 11px;
		color: var(--text-muted);
		border-bottom: 1px solid var(--border-light);
	}

	.leaflet-map {
		flex: 1;
		width: 100%;
	}

	/* Leaflet CSS fix for Svelte scoping */
	.map-container :global(.leaflet-container) {
		height: 100%;
		width: 100%;
	}

	@media (max-width: 768px) {
		.map-container {
			height: 320px;
			min-height: 320px;
		}
	}
</style>
