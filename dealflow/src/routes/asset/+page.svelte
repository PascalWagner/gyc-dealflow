<script>
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';
	import { getStoredSessionUser, user, isLoggedIn } from '$lib/stores/auth.js';
	import Sidebar from '$lib/components/Sidebar.svelte';

	// ===== State =====
	let loading = $state(true);
	let sidebarOpen = $state(false);

	let propertyName = $state('Loading...');
	let propertyAddress = $state('');
	let assetClass = $state('');
	let location = $state('');
	let status = $state('');
	let matchingDeals = $state([]);
	let nearbyDeals = $state([]);
	let propertyDetails = $state({});
	let rentCastData = $state(null);
	let marketData = $state(null);
	let currentCoords = $state(null);

	// Chart instances for cleanup
	let chartInstances = [];

	// View toggles
	let empView = $state('chart');
	let brView = $state('bars');

	// ===== Helpers =====
	function currency(val) {
		if (val == null) return '--';
		if (val >= 1000000) return '$' + (val / 1000000).toFixed(1) + 'M';
		if (val >= 1000) return '$' + Math.round(val).toLocaleString();
		return '$' + val;
	}
	function pct(val) {
		if (val == null) return '--';
		if (val > 1) return val.toFixed(1) + '%';
		return (val * 100).toFixed(1) + '%';
	}
	function multiple(val) {
		if (val == null) return '--';
		return val.toFixed(1) + 'x';
	}
	function fmtDate(str) {
		if (!str) return '--';
		return new Date(str).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
	}
	function fmtK(n) {
		if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
		if (n >= 1000) return (n / 1000).toFixed(0) + 'K';
		return n.toLocaleString();
	}
	function statusColor(s) {
		if (!s) return 'green';
		const sl = s.toLowerCase();
		if (sl.includes('open') || sl.includes('active') || sl.includes('evergreen')) return 'green';
		if (sl.includes('closed') || sl.includes('fully funded') || sl.includes('completed')) return 'orange';
		return 'green';
	}
	function statusToEvent(s) {
		if (!s) return { label: 'Acquired', cls: 'new-offering' };
		const sl = s.toLowerCase();
		if (sl.includes('closed') || sl.includes('fully subscribed')) return { label: 'Acquired', cls: 'closed' };
		if (sl.includes('open') || sl.includes('active')) return { label: 'Raising', cls: 'new-offering' };
		if (sl.includes('evergreen')) return { label: 'Active', cls: 'open' };
		if (sl.includes('sold') || sl.includes('exited')) return { label: 'Sold', cls: 'sold' };
		if (sl.includes('refinanc')) return { label: 'Refinanced', cls: 'refinanced' };
		if (sl.includes('listed')) return { label: 'Listed for Sale', cls: 'listed' };
		if (sl.includes('acquired') || sl.includes('purchas')) return { label: 'Acquired', cls: 'acquired' };
		return { label: s, cls: 'closed' };
	}
	function extractAddress(dealName) {
		if (!dealName) return '';
		const m = dealName.match(/(\d{2,5}\s+[A-Za-z][\w\s]+(?:Dr|St|Ave|Blvd|Rd|Ln|Way|Ct|Cir|Pl|Pkwy|Loop)[^,]*(?:,\s*[A-Za-z\s]+,\s*[A-Z]{2}\s*\d{5})?)/i);
		return m ? m[1].trim() : '';
	}
	function extractState(text) {
		if (!text) return '';
		const m = text.match(/\b([A-Z]{2})\s*\d{5}\b/) || text.match(/,\s*([A-Z]{2})\b/);
		return m ? m[1] : '';
	}
	function shortLabel(deal) {
		return deal.investmentName || deal.address || '';
	}

	// ===== Derived =====
	let heroStats = $derived.by(() => {
		const stats = [];
		const d0 = matchingDeals[0];
		const unitCount = d0?.unitCount || propertyDetails.units;
		const yearBuilt = d0?.yearBuilt;
		const opSet = {};
		const operators = [];
		matchingDeals.forEach(d => {
			if (d.managementCompany && !opSet[d.managementCompany]) {
				opSet[d.managementCompany] = true;
				operators.push(d.managementCompany);
			}
		});
		const dates = matchingDeals.map(d => d.addedDate).filter(Boolean).sort();
		const lastSeen = dates.length ? dates[dates.length - 1] : null;

		if (unitCount) stats.push({ value: Number(unitCount).toLocaleString(), label: 'Units' });
		stats.push({ value: yearBuilt || 'N/A', label: 'Year Built' });
		stats.push({ value: operators.length || '--', label: operators.length === 1 ? 'Owner' : 'Owners' });
		if (lastSeen) stats.push({ value: fmtDate(lastSeen), label: 'Latest Transaction' });
		return stats;
	});

	let operators = $derived.by(() => {
		const opSet = {};
		const ops = [];
		matchingDeals.forEach(d => {
			if (d.managementCompany && !opSet[d.managementCompany]) {
				opSet[d.managementCompany] = true;
				ops.push(d.managementCompany);
			}
		});
		return ops;
	});

	let gmapsUrl = $derived(propertyAddress ? 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(propertyAddress) : '');

	let sortedDealsForTable = $derived(
		matchingDeals
			.filter(d => d.addedDate)
			.slice()
			.sort((a, b) => new Date(b.addedDate) - new Date(a.addedDate))
	);

	let chronologicalDeals = $derived(sortedDealsForTable.slice().reverse());

	let valuationPoints = $derived(
		chronologicalDeals.filter(d => d.purchasePrice || d.offeringSize)
	);

	let hasValuationChart = $derived(valuationPoints.length >= 2);

	let valuationChange = $derived.by(() => {
		if (valuationPoints.length < 2) return null;
		const values = valuationPoints.map(d => d.purchasePrice || d.offeringSize);
		const first = values[0];
		const last = values[values.length - 1];
		const pctChange = ((last - first) / first * 100).toFixed(1);
		return {
			pctChange,
			isPositive: pctChange >= 0,
			first,
			last,
			firstLabel: new Date(valuationPoints[0].addedDate).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
			lastLabel: new Date(valuationPoints[valuationPoints.length - 1].addedDate).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
		};
	});

	// Property summary text
	let summaryText = $derived.by(() => {
		const d0 = matchingDeals[0] || {};
		const pd = propertyDetails || {};
		const parts = [];
		const name = propertyName || 'This property';

		let opening = name;
		if (assetClass) opening += ' is a ' + assetClass.toLowerCase() + ' property';
		else opening += ' is a property';
		if (location) opening += ' located in ' + location;
		opening += '.';
		parts.push(opening);

		const details = [];
		const units = d0.unitCount || pd.units;
		const sqft = d0.squareFootage;
		const yrBuilt = d0.yearBuilt;
		if (units) details.push(Number(units).toLocaleString() + ' units');
		if (sqft) details.push(Number(sqft).toLocaleString() + ' square feet');
		if (yrBuilt) details.push('built in ' + yrBuilt);
		if (details.length) parts.push('The property has ' + details.join(', ') + '.');

		const occ = d0.occupancyPct ? Math.round(d0.occupancyPct * 100) : pd.occupancy;
		if (occ) parts.push('Current occupancy is ' + occ + '%.');

		const strat = d0.strategy || pd.strategy;
		if (strat) parts.push('The current investment strategy is ' + strat.toLowerCase() + '.');

		const ops = operators();
		if (ops.length === 1) parts.push('It is currently owned by ' + ops[0] + '.');
		else if (ops.length > 1) parts.push('It has had ' + ops.length + ' operators in our database: ' + ops.join(', ') + '.');

		if (matchingDeals.length > 1) {
			const dates = matchingDeals.map(d => d.addedDate).filter(Boolean).sort();
			if (dates.length >= 2) {
				parts.push("We've tracked " + matchingDeals.length + ' transactions from ' + new Date(dates[0]).getFullYear() + ' to ' + new Date(dates[dates.length - 1]).getFullYear() + '.');
			}
		}
		return parts.length > 1 ? parts.join(' ') : '';
	});

	let showOperatorComp = $derived(matchingDeals.length >= 2);

	let operatorCompRows = $derived.by(() => {
		if (matchingDeals.length < 2) return [];
		const sorted = matchingDeals.slice().sort((a, b) => new Date(a.addedDate || 0) - new Date(b.addedDate || 0));
		const allRows = [
			{ label: 'Purchase Price', key: 'purchasePrice', fmt: d => d.purchasePrice ? currency(d.purchasePrice) : '--' },
			{ label: 'Equity Raise', key: 'offeringSize', fmt: d => d.offeringSize ? currency(d.offeringSize) : '--' },
			{ label: 'Target IRR', key: 'targetIRR', fmt: d => d.targetIRR ? pct(d.targetIRR) : '--' },
			{ label: 'Equity Multiple', key: 'equityMultiple', fmt: d => d.equityMultiple ? multiple(d.equityMultiple) : '--' },
			{ label: 'Preferred Return', key: 'preferredReturn', fmt: d => d.preferredReturn ? pct(d.preferredReturn) : '--' },
			{ label: 'LP/GP Split', key: 'lpGpSplit', fmt: d => d.lpGpSplit && /\d+\s*\/\s*\d+/.test(d.lpGpSplit) ? d.lpGpSplit : '--' },
			{ label: 'Min Investment', key: 'investmentMinimum', fmt: d => d.investmentMinimum ? currency(d.investmentMinimum) : '--' },
			{ label: 'Cash-on-Cash', key: 'cashOnCash', fmt: d => d.cashOnCash ? pct(d.cashOnCash) : '--' },
			{ label: 'Hold Period', key: 'holdPeriod', fmt: d => d.holdPeriod ? d.holdPeriod + ' Years' : '--' },
			{ label: 'Offering Type', key: 'offeringType', fmt: d => d.offeringType || '--' },
			{ label: 'Acquisition Fee', key: 'acquisitionFeePct', fmt: d => d.acquisitionFeePct ? pct(d.acquisitionFeePct) : '--' },
			{ label: 'Asset Mgmt Fee', key: 'assetMgmtFeePct', fmt: d => d.assetMgmtFeePct ? pct(d.assetMgmtFeePct) + ' / yr' : '--' },
			{ label: 'Property Mgmt Fee', key: 'propertyMgmtFeePct', fmt: d => d.propertyMgmtFeePct ? pct(d.propertyMgmtFeePct) : '--' },
			{ label: 'Disposition Fee', key: 'dispositionFeePct', fmt: d => (d.dispositionFeePct || d.capitalEventFeePct) ? pct(d.dispositionFeePct || d.capitalEventFeePct) : '--' },
		];
		return {
			deals: sorted,
			rows: allRows.filter(row => sorted.some(d => {
				const v = d[row.key];
				return v != null && v !== '' && v !== 0;
			}))
		};
	});

	// Property records
	let recordItems = $derived.by(() => {
		const rc = rentCastData;
		if (!rc) return [];
		const items = [];
		if (rc.propertyType) items.push({ l: 'Property Type', v: rc.propertyType });
		if (rc.unitCount) items.push({ l: 'Units', v: String(rc.unitCount) });
		if (rc.squareFootage) items.push({ l: 'Square Footage', v: rc.squareFootage.toLocaleString() + ' sqft' });
		if (rc.lotSize) items.push({ l: 'Lot Size', v: rc.lotSize.toLocaleString() + ' sqft' });
		if (rc.yearBuilt) items.push({ l: 'Year Built', v: String(rc.yearBuilt) });
		if (rc.floorCount) items.push({ l: 'Floors', v: String(rc.floorCount) });
		if (rc.unitCount && rc.squareFootage) {
			const sqftPerUnit = Math.round(rc.squareFootage / rc.unitCount);
			items.push({ l: 'Avg sqft / Unit', v: sqftPerUnit.toLocaleString() + ' sqft' });
		}
		return items;
	});

	let taxYears = $derived.by(() => {
		if (!rentCastData?.taxAssessments) return [];
		return Object.keys(rentCastData.taxAssessments).sort().reverse().slice(0, 5);
	});

	let showRecords = $derived(recordItems.length > 0 || rentCastData?.lastSalePrice || taxYears.length > 0);

	// Market intelligence
	let pop = $derived(marketData?.population?.filter(d => d.population > 0) || []);
	let income = $derived(marketData?.population?.filter(d => d.medianIncome > 0) || []);
	let showMarketIntel = $derived(pop.length >= 2);

	let cleanAreaName = $derived.by(() => {
		if (!pop.length || !pop[0].name) return '';
		return pop[0].name.replace(/^ZCTA5\s*/, 'ZIP ');
	});

	let isMultifamily = $derived(
		assetClass && (assetClass.toLowerCase().includes('multi') || assetClass.toLowerCase().includes('apartment') || assetClass.toLowerCase().includes('residential'))
	);

	let risks = $derived.by(() => {
		const r = marketData?.risks?.slice() || [];
		if (marketData?.populationTrend && !marketData.populationTrend.declining && marketData.populationTrend.annualGrowth > 0.5) {
			r.push({
				type: 'population_growth',
				severity: 'positive',
				message: 'Strong population growth',
				detail: '+' + marketData.populationTrend.pctChange + '% over ' + (marketData.populationTrend.endYear - marketData.populationTrend.startYear) + ' years (' + marketData.populationTrend.annualGrowth + '%/yr)'
			});
		}
		return r;
	});

	let industries = $derived(
		(marketData?.employment?.topIndustries || [])
			.filter(i => !i.industry.includes('Total') && !i.industry.includes('Unclassified'))
			.slice(0, 8)
	);

	// ===== Data Fetching =====
	const PROD_API = 'https://dealflow.growyourcashflow.io/api/deals';

	async function fetchAllDeals() {
		const cached = sessionStorage.getItem('gycDealsCache');
		const cacheTime = sessionStorage.getItem('gycDealsCacheTime');
		const CACHE_TTL = 5 * 60 * 1000;
		if (cached && cacheTime && (Date.now() - parseInt(cacheTime)) < CACHE_TTL) {
			try { return JSON.parse(cached); } catch {}
		}
		const urls = ['/api/deals?include506b=true', PROD_API + '?include506b=true'];
		for (const url of urls) {
			try {
				const resp = await fetch(url);
				if (!resp.ok) continue;
				const data = await resp.json();
				if (data?.deals) {
					sessionStorage.setItem('gycDealsCache', JSON.stringify(data.deals));
					sessionStorage.setItem('gycDealsCacheTime', String(Date.now()));
					return data.deals;
				}
			} catch { continue; }
		}
		return [];
	}

	function findMatchingDeals(allDeals, name, addr) {
		if (!allDeals.length) return [];
		const nameNorm = (name || '').toLowerCase().trim();
		const addrNorm = (addr || '').toLowerCase().trim();
		const extractedAddr = extractAddress(name).toLowerCase();
		return allDeals.filter(d => {
			const dName = (d.investmentName || '').toLowerCase();
			const dAddr = (d.address || '').toLowerCase();
			const dExtracted = extractAddress(d.investmentName).toLowerCase();
			if (addrNorm && dAddr && dAddr === addrNorm) return true;
			if (extractedAddr && dExtracted && extractedAddr === dExtracted) return true;
			if (nameNorm && dName.includes(nameNorm)) return true;
			if (nameNorm && nameNorm.includes(dName) && dName.length > 8) return true;
			if (extractedAddr && dExtracted && extractedAddr.length > 5) {
				const streetNum = extractedAddr.match(/^\d+/);
				if (streetNum && dExtracted.startsWith(streetNum[0])) return true;
			}
			return false;
		});
	}

	function findNearbyDeals(allDeals, loc, ac, excludeIds, st) {
		if (!allDeals.length) return [];
		const locNorm = (loc || '').toLowerCase();
		const stateNorm = (st || '').toUpperCase();
		const exclude = new Set(excludeIds || []);
		const nearby = allDeals.filter(d => {
			if (exclude.has(d.id)) return false;
			const dLoc = (d.investingGeography || d.location || '').toLowerCase();
			if (locNorm && dLoc) {
				const locParts = locNorm.split(',').map(s => s.trim());
				const dParts = dLoc.split(',').map(s => s.trim());
				if (locParts.length > 1 && dParts.length > 1 && locParts[locParts.length - 1] === dParts[dParts.length - 1]) return true;
			}
			if (stateNorm) {
				const dState = extractState(d.investmentName) || extractState(d.investingGeography || d.location);
				if (dState === stateNorm) return true;
			}
			return false;
		});
		nearby.sort((a, b) => {
			const aMatch = (a.assetClass || '') === ac ? 1 : 0;
			const bMatch = (b.assetClass || '') === ac ? 1 : 0;
			if (aMatch !== bMatch) return bMatch - aMatch;
			return new Date(b.addedDate || 0) - new Date(a.addedDate || 0);
		});
		return nearby.slice(0, 6);
	}

	function extractPropertyDetails(deals) {
		const details = {};
		deals.forEach(d => {
			const text = (d.investmentStrategy || '') + ' ' + (d.investmentName || '');
			if (!details.units) {
				const m = text.match(/(\d{2,4})[\s-]*(?:unit|apt|apartment)/i);
				if (m) details.units = parseInt(m[1]);
			}
			if (!details.city) {
				const m = text.match(/\bin\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?),\s*([A-Z]{2})\b/);
				if (m) { details.city = m[1]; details.state = m[2]; }
			}
			if (!details.occupancy) {
				const m = text.match(/(\d{1,3})%\s*(?:occupan|occupied|leased)/i);
				if (m) details.occupancy = parseInt(m[1]);
			}
			if (!details.holdPeriod && d.holdPeriod) details.holdPeriod = d.holdPeriod;
			if (!details.offeringType && d.offeringType) details.offeringType = d.offeringType;
			if (/value[\s-]?add/i.test(text)) details.strategy = 'Value-Add';
			else if (/core[\s-]?plus/i.test(text)) details.strategy = 'Core Plus';
			else if (/opportunistic/i.test(text)) details.strategy = 'Opportunistic';
			else if (/stabilized/i.test(text)) details.strategy = 'Stabilized';
		});
		return details;
	}

	async function geocodeAddress(address) {
		try {
			const res = await fetch('https://nominatim.openstreetmap.org/search?format=json&limit=1&q=' + encodeURIComponent(address));
			const data = await res.json();
			if (data?.length > 0) return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
		} catch {}
		return null;
	}

	async function fetchMarketData(zip, stateAbbr, countyFips, lat, lng) {
		const params = [];
		if (zip) params.push('zip=' + encodeURIComponent(zip));
		if (countyFips) params.push('fips=' + encodeURIComponent(countyFips));
		if (stateAbbr) params.push('stateAbbr=' + encodeURIComponent(stateAbbr));
		if (lat) params.push('lat=' + encodeURIComponent(lat));
		if (lng) params.push('lng=' + encodeURIComponent(lng));
		if (!params.length) return null;
		try {
			const resp = await fetch('/api/market-data?' + params.join('&'));
			if (!resp.ok) return null;
			const data = await resp.json();
			return data.success ? data : null;
		} catch { return null; }
	}

	// ===== Map Rendering =====
	let L;
	let propertyMap;
	let nearbyMapInstance;

	async function loadLeaflet() {
		if (typeof window !== 'undefined' && !window.L) {
			// Load CSS
			const link = document.createElement('link');
			link.rel = 'stylesheet';
			link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
			document.head.appendChild(link);
			// Load JS
			await new Promise((resolve, reject) => {
				const script = document.createElement('script');
				script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
				script.onload = resolve;
				script.onerror = reject;
				document.head.appendChild(script);
			});
		}
		L = window.L;
	}

	function renderPropertyMap(lat, lng) {
		if (!L || !lat || !lng) return;
		const el = document.getElementById('propertyMap');
		if (!el) return;
		if (propertyMap) { propertyMap.remove(); propertyMap = null; }
		try {
			propertyMap = L.map(el).setView([lat, lng], 14);
			L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
				attribution: '&copy; OpenStreetMap', maxZoom: 18
			}).addTo(propertyMap);
			L.marker([lat, lng]).addTo(propertyMap);
		} catch (e) { console.warn('Map failed:', e); }
	}

	async function renderNearbyMap(nearby, coords, name) {
		if (!L || !nearby.length) return;
		const mapEl = document.getElementById('nearbyMap');
		if (!mapEl) return;
		try {
			nearbyMapInstance = L.map(mapEl);
			L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
				attribution: '&copy; OpenStreetMap', maxZoom: 18
			}).addTo(nearbyMapInstance);

			const markers = [];
			if (coords) {
				const greenIcon = L.divIcon({
					className: '',
					html: '<div style="width:16px;height:16px;background:#51BE7B;border:3px solid #fff;border-radius:50%;box-shadow:0 2px 8px rgba(0,0,0,0.3);"></div>',
					iconSize: [16, 16], iconAnchor: [8, 8]
				});
				const m = L.marker([coords.lat, coords.lng], { icon: greenIcon }).addTo(nearbyMapInstance);
				m.bindTooltip('<span style="font-weight:700;">' + name + '</span>', {
					permanent: true, direction: 'top', offset: [0, -12],
					className: 'map-label map-label-current'
				});
				markers.push(m);
				nearbyMapInstance.setView([coords.lat, coords.lng], 10);
			}

			for (let i = 0; i < nearby.length; i++) {
				const deal = nearby[i];
				let addr = deal.address || '';
				if (!addr || addr.length < 10) addr = extractAddress(deal.investmentName) || deal.investingGeography || '';
				if (!addr || addr.length < 5) continue;

				setTimeout(async () => {
					const gc = await geocodeAddress(addr);
					if (!gc) return;
					const blueIcon = L.divIcon({
						className: '',
						html: '<div style="width:12px;height:12px;background:#2563EB;border:2px solid #fff;border-radius:50%;box-shadow:0 2px 6px rgba(0,0,0,0.25);"></div>',
						iconSize: [12, 12], iconAnchor: [6, 6]
					});
					const mk = L.marker([gc.lat, gc.lng], { icon: blueIcon }).addTo(nearbyMapInstance);
					mk.bindTooltip(shortLabel(deal), {
						permanent: true, direction: 'top', offset: [0, -10],
						className: 'map-label map-label-nearby'
					});
					mk.on('click', () => goto('/deal?id=' + encodeURIComponent(deal.id)));
					markers.push(mk);
					if (markers.length > 1) {
						const group = L.featureGroup(markers);
						nearbyMapInstance.fitBounds(group.getBounds().pad(0.15));
					}
				}, i * 1100);
			}
		} catch (e) { console.warn('Nearby map failed:', e); }
	}

	// ===== Chart Rendering =====
	let Chart;

	async function loadChartJs() {
		if (typeof window !== 'undefined' && !window.Chart) {
			await new Promise((resolve, reject) => {
				const script = document.createElement('script');
				script.src = 'https://cdn.jsdelivr.net/npm/chart.js';
				script.onload = resolve;
				script.onerror = reject;
				document.head.appendChild(script);
			});
		}
		Chart = window.Chart;
	}

	function createChart(canvasId, config) {
		const canvas = document.getElementById(canvasId);
		if (!canvas || !Chart) return null;
		const instance = new Chart(canvas.getContext('2d'), config);
		chartInstances.push(instance);
		return instance;
	}

	function renderValuationChart() {
		if (!hasValuationChart || !Chart) return;
		const labels = valuationPoints.map(d => new Date(d.addedDate).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }));
		const values = valuationPoints.map(d => d.purchasePrice || d.offeringSize);
		createChart('valuationChart', {
			type: 'line',
			data: {
				labels,
				datasets: [{
					data: values,
					borderColor: '#51BE7B',
					backgroundColor: 'rgba(81,190,123,0.06)',
					fill: true, tension: 0.35, borderWidth: 3,
					pointRadius: 6, pointHoverRadius: 9,
					pointBackgroundColor: (ctx) => ctx.dataIndex === values.length - 1 ? '#51BE7B' : '#8A9AA0',
					pointBorderColor: '#fff', pointBorderWidth: 2
				}]
			},
			options: {
				responsive: true, maintainAspectRatio: false,
				plugins: {
					legend: { display: false },
					tooltip: {
						backgroundColor: '#0A1E21',
						titleFont: { family: "'Plus Jakarta Sans'", size: 13, weight: '600' },
						bodyFont: { family: "'Source Sans 3'", size: 13 },
						padding: 12, cornerRadius: 8,
						callbacks: { label: ctx => currency(ctx.parsed.y) }
					}
				},
				scales: {
					x: { grid: { display: false }, ticks: { font: { family: "'Plus Jakarta Sans'", size: 11, weight: '500' }, color: '#8A9AA0' } },
					y: { grid: { color: '#EDF1F2' }, ticks: { font: { family: "'Plus Jakarta Sans'", size: 11, weight: '500' }, color: '#8A9AA0', callback: v => currency(v) } }
				}
			}
		});
	}

	function renderMarketCharts() {
		if (!marketData || !Chart) return;
		const trend = marketData.populationTrend;

		// Population chart
		if (pop.length >= 3) {
			const lineColor = trend?.declining ? '#D04040' : '#51BE7B';
			const fillColor = trend?.declining ? 'rgba(208,64,64,0.06)' : 'rgba(81,190,123,0.06)';
			createChart('populationChart', {
				type: 'line',
				data: {
					labels: pop.map(d => d.year),
					datasets: [{
						data: pop.map(d => d.population),
						borderColor: lineColor, backgroundColor: fillColor,
						fill: true, tension: 0.35, borderWidth: 2.5,
						pointRadius: 4, pointHoverRadius: 7,
						pointBackgroundColor: lineColor, pointBorderColor: '#fff', pointBorderWidth: 2
					}]
				},
				options: {
					responsive: true, maintainAspectRatio: false,
					plugins: { legend: { display: false }, tooltip: { backgroundColor: '#0A1E21', padding: 10, cornerRadius: 8, callbacks: { label: ctx => ctx.parsed.y.toLocaleString() + ' residents' } } },
					scales: {
						x: { grid: { display: false }, ticks: { font: { family: "'Plus Jakarta Sans'", size: 11 }, color: '#8A9AA0' } },
						y: { grid: { color: '#EDF1F2' }, ticks: { font: { family: "'Plus Jakarta Sans'", size: 11 }, color: '#8A9AA0', callback: v => v >= 1000000 ? (v/1000000).toFixed(1)+'M' : v >= 1000 ? (v/1000).toFixed(0)+'K' : v } }
					}
				}
			});
		}

		// Income chart
		if (income.length >= 3) {
			const incValues = income.map(d => d.medianIncome);
			const incDeclining = incValues[incValues.length - 1] < incValues[0];
			const incLineColor = incDeclining ? '#D04040' : '#2563EB';
			const incFillColor = incDeclining ? 'rgba(208,64,64,0.06)' : 'rgba(37,99,235,0.06)';
			createChart('incomeChart', {
				type: 'line',
				data: {
					labels: income.map(d => d.year),
					datasets: [{
						data: incValues,
						borderColor: incLineColor, backgroundColor: incFillColor,
						fill: true, tension: 0.35, borderWidth: 2.5,
						pointRadius: 4, pointHoverRadius: 7,
						pointBackgroundColor: incLineColor, pointBorderColor: '#fff', pointBorderWidth: 2
					}]
				},
				options: {
					responsive: true, maintainAspectRatio: false,
					plugins: { legend: { display: false }, tooltip: { backgroundColor: '#0A1E21', padding: 10, cornerRadius: 8, callbacks: { label: ctx => '$' + ctx.parsed.y.toLocaleString() } } },
					scales: {
						x: { grid: { display: false }, ticks: { font: { family: "'Plus Jakarta Sans'", size: 11 }, color: '#8A9AA0' } },
						y: { grid: { color: '#EDF1F2' }, ticks: { font: { family: "'Plus Jakarta Sans'", size: 11 }, color: '#8A9AA0', callback: v => '$' + (v/1000).toFixed(0) + 'K' } }
					}
				}
			});
		}

		// Age pyramid
		if (marketData.ageDistribution?.length) {
			const ageReversed = marketData.ageDistribution.slice().reverse();
			const maxVal = Math.max(...ageReversed.map(g => Math.max(g.male, g.female)));
			createChart('agePyramidChart', {
				type: 'bar',
				data: {
					labels: ageReversed.map(g => g.label),
					datasets: [
						{ label: 'Male', data: ageReversed.map(g => -g.male), backgroundColor: '#38bdf8', borderRadius: 2, barPercentage: 0.85, categoryPercentage: 0.9 },
						{ label: 'Female', data: ageReversed.map(g => g.female), backgroundColor: '#fbbf24', borderRadius: 2, barPercentage: 0.85, categoryPercentage: 0.9 }
					]
				},
				options: {
					indexAxis: 'y', responsive: true, maintainAspectRatio: false,
					plugins: { legend: { display: false }, tooltip: { backgroundColor: '#0A1E21', padding: 10, cornerRadius: 8, callbacks: { label: ctx => ctx.dataset.label + ': ' + Math.abs(ctx.parsed.x).toLocaleString() } } },
					scales: {
						x: { grid: { color: '#EDF1F2' }, ticks: { font: { family: "'Plus Jakarta Sans'", size: 10 }, color: '#8A9AA0', callback: v => { const a = Math.abs(v); return a >= 1000 ? (a/1000).toFixed(0)+'K' : a; } }, min: -maxVal * 1.1, max: maxVal * 1.1 },
						y: { grid: { display: false }, ticks: { font: { family: "'Plus Jakarta Sans'", size: 10 }, color: '#607179' } }
					}
				}
			});
		}

		// Occupancy chart (housing)
		if (isMultifamily && marketData.housing?.timeSeries?.length >= 2) {
			const h = marketData.housing;
			const occRates = h.timeSeries.map(d => d.occupancyRate);
			const occMin = Math.min(...occRates);
			createChart('occupancyChart', {
				type: 'line',
				data: {
					labels: h.timeSeries.map(d => d.year),
					datasets: [{ label: 'Occupancy Rate', data: occRates, borderColor: '#51BE7B', backgroundColor: 'rgba(81,190,123,0.06)', fill: true, tension: 0.35, borderWidth: 2.5, pointRadius: 4, pointHoverRadius: 7, pointBackgroundColor: '#51BE7B', pointBorderColor: '#fff', pointBorderWidth: 2 }]
				},
				options: {
					responsive: true, maintainAspectRatio: false,
					plugins: { legend: { display: false }, tooltip: { backgroundColor: '#0A1E21', padding: 10, cornerRadius: 8, callbacks: { label: ctx => 'Occupancy: ' + ctx.parsed.y + '%' } } },
					scales: {
						x: { grid: { display: false }, ticks: { font: { family: "'Plus Jakarta Sans'", size: 11 }, color: '#8A9AA0' } },
						y: { grid: { color: '#EDF1F2' }, min: Math.max(0, Math.floor(occMin - 3)), max: 100, ticks: { font: { family: "'Plus Jakarta Sans'", size: 11 }, color: '#8A9AA0', callback: v => v + '%' } }
					}
				}
			});
		}

		// Bedroom trend chart
		if (isMultifamily && marketData.housing?.bedroomTimeSeries?.length >= 3) {
			const bts = marketData.housing.bedroomTimeSeries;
			createChart('bedroomTrendChart', {
				type: 'bar',
				data: {
					labels: bts.map(d => d.year),
					datasets: [
						{ label: 'Studio', data: bts.map(d => d.noBr), backgroundColor: '#94a3b8', borderRadius: 2 },
						{ label: '1 BR', data: bts.map(d => d.oneBr), backgroundColor: '#38bdf8', borderRadius: 2 },
						{ label: '2 BR', data: bts.map(d => d.twoBr), backgroundColor: '#2563EB', borderRadius: 2 },
						{ label: '3 BR', data: bts.map(d => d.threeBr), backgroundColor: '#51BE7B', borderRadius: 2 },
						{ label: '4+ BR', data: bts.map(d => d.fourPlusBr), backgroundColor: '#f59e0b', borderRadius: 2 }
					]
				},
				options: {
					responsive: true, maintainAspectRatio: false,
					plugins: { legend: { display: true, position: 'bottom', labels: { font: { family: "'Plus Jakarta Sans'", size: 9, weight: '600' }, boxWidth: 10, padding: 8 } }, tooltip: { backgroundColor: '#0A1E21', padding: 10, cornerRadius: 8, callbacks: { label: ctx => ctx.dataset.label + ': ' + ctx.parsed.y + '%' } } },
					scales: {
						x: { stacked: true, grid: { display: false }, ticks: { font: { family: "'Plus Jakarta Sans'", size: 10 }, color: '#8A9AA0' } },
						y: { stacked: true, max: 100, grid: { color: '#EDF1F2' }, ticks: { font: { family: "'Plus Jakarta Sans'", size: 10 }, color: '#8A9AA0', callback: v => v + '%' } }
					}
				}
			});
		}

		// Industry trend chart
		if (marketData.employment?.timeSeries && marketData.employment?.years?.length >= 2) {
			const trendColors = ['#51BE7B','#2563EB','#f59e0b','#a855f7','#ef4444','#06b6d4','#f97316','#6366f1'];
			const datasets = [];
			let idx = 0;
			for (const indName in marketData.employment.timeSeries) {
				const series = marketData.employment.timeSeries[indName];
				const color = trendColors[idx % trendColors.length];
				datasets.push({
					label: indName, data: series.map(s => s.employment),
					borderColor: color, backgroundColor: color + '10',
					fill: true, tension: 0.35, borderWidth: 2,
					pointRadius: 3, pointBackgroundColor: color, pointBorderColor: '#fff', pointBorderWidth: 1
				});
				idx++;
			}
			createChart('industryTrendChart', {
				type: 'line',
				data: { labels: marketData.employment.years, datasets },
				options: {
					responsive: true, maintainAspectRatio: false,
					interaction: { mode: 'index', intersect: false },
					plugins: { legend: { display: true, position: 'bottom', labels: { font: { family: "'Plus Jakarta Sans'", size: 9, weight: '600' }, boxWidth: 10, padding: 8 } }, tooltip: { backgroundColor: '#0A1E21', padding: 10, cornerRadius: 8, callbacks: { label: ctx => ctx.dataset.label + ': ' + (ctx.parsed.y ? ctx.parsed.y.toLocaleString() : '--') } } },
					scales: {
						x: { grid: { display: false }, ticks: { font: { family: "'Plus Jakarta Sans'", size: 11 }, color: '#8A9AA0' } },
						y: { grid: { color: '#EDF1F2' }, ticks: { font: { family: "'Plus Jakarta Sans'", size: 11 }, color: '#8A9AA0', callback: v => v >= 1000 ? (v/1000).toFixed(0)+'K' : v } }
					}
				}
			});
		}
	}

	// ===== Price Change for Table Row =====
	function getPriceChange(deal) {
		const price = deal.purchasePrice || deal.offeringSize;
		if (!price) return null;
		const idx = chronologicalDeals.findIndex(d => d.id === deal.id);
		if (idx <= 0) return null;
		const prev = chronologicalDeals[idx - 1];
		const prevPrice = prev.purchasePrice || prev.offeringSize;
		if (!prevPrice) return null;
		return ((price - prevPrice) / prevPrice * 100);
	}

	// ===== Init =====
	onMount(async () => {
		if (!browser) return;

		// Auth check
		const sessionUser = getStoredSessionUser();
		if (!sessionUser?.token || sessionUser.token === 'local-session') {
			user.logout();
			goto('/login');
			return;
		}

		// Load external libs
		await Promise.all([loadLeaflet(), loadChartJs()]);

		const params = new URLSearchParams(window.location.search);
		const dealId = params.get('id') || '';
		const addressParam = params.get('address') || '';
		const nameParam = params.get('name') || '';

		const allDeals = await fetchAllDeals();
		let anchorDeal = dealId ? allDeals.find(d => d.id === dealId) : null;

		let dealName = anchorDeal?.investmentName || '';
		let pAddr = addressParam || anchorDeal?.address || '';
		if (!pAddr && dealName) pAddr = extractAddress(dealName);

		let pName = nameParam || dealName || addressParam || 'Unknown Property';
		if (pName.length > 20) {
			const sepMatch = pName.match(/^(.+?)\s*[--\/]\s*(\d{2,5}\s+.+)/);
			if (sepMatch) {
				pName = sepMatch[1].trim();
				if (!pAddr) pAddr = sepMatch[2].trim();
			}
		}

		let ac = anchorDeal?.assetClass || '';
		let loc = anchorDeal?.investingGeography || anchorDeal?.location || '';
		let st = extractState(pAddr) || extractState(dealName) || extractState(loc);
		if (!loc && st) {
			const addrParts = (pAddr || dealName).match(/,\s*([A-Za-z\s]+),\s*[A-Z]{2}/);
			loc = addrParts ? addrParts[1].trim() + ', ' + st : st;
		}

		let matched = findMatchingDeals(allDeals, pName, pAddr);
		if (anchorDeal && !matched.find(d => d.id === anchorDeal.id)) matched.unshift(anchorDeal);
		if (!matched.length && anchorDeal) matched = [anchorDeal];

		const hasActive = matched.some(d => {
			const s = (d.status || '').toLowerCase();
			return s.includes('open') || s.includes('active') || s.includes('evergreen');
		});

		if (!ac && matched.length) ac = matched[0].assetClass || '';
		if (!loc && matched.length) loc = matched[0].investingGeography || matched[0].location || '';

		const pd = extractPropertyDetails(matched);
		if (!pAddr && pd.city) pAddr = pd.city + ', ' + (pd.state || '');
		if ((!loc || loc === 'USA') && pd.city) loc = pd.city + ', ' + (pd.state || '');
		if (!st && pd.state) st = pd.state;

		// Update state
		propertyName = pName;
		propertyAddress = pAddr;
		assetClass = ac;
		location = loc;
		status = hasActive ? 'Active' : (matched.length ? 'Closed' : '');
		matchingDeals = matched;
		propertyDetails = pd;
		loading = false;

		// Title
		document.title = pName + ' - Asset Detail - GYC Dealflow';

		// Render charts after DOM updates
		await new Promise(r => setTimeout(r, 50));
		renderValuationChart();

		// Nearby deals
		const matchIds = matched.map(d => d.id);
		nearbyDeals = findNearbyDeals(allDeals, loc, ac, matchIds, st);

		// Geocode and render maps
		let coords = null;
		if (pAddr && pAddr.length > 5) {
			coords = await geocodeAddress(pAddr);
			if (coords) {
				currentCoords = coords;
				renderPropertyMap(coords.lat, coords.lng);
			}
		}
		if (nearbyDeals.length) {
			await new Promise(r => setTimeout(r, 100));
			renderNearbyMap(nearbyDeals, coords, pName);
		}

		// Market data
		let miZip = null;
		if (pAddr) {
			const zipMatch = pAddr.match(/\b(\d{5})\b/);
			if (zipMatch) miZip = zipMatch[1];
		}
		if (miZip || (coords?.lat && coords?.lng)) {
			const md = await fetchMarketData(miZip, st, null, coords?.lat, coords?.lng);
			if (md) {
				marketData = md;
				await new Promise(r => setTimeout(r, 50));
				renderMarketCharts();
			}
		}
	});

	// Cleanup
	$effect(() => {
		return () => {
			chartInstances.forEach(c => c?.destroy());
			if (propertyMap) propertyMap.remove();
			if (nearbyMapInstance) nearbyMapInstance.remove();
		};
	});
</script>

<svelte:head>
	<title>{propertyName} - Asset Detail - GYC Dealflow</title>
</svelte:head>

<!-- Sidebar -->
<Sidebar currentPage="asset" />

<!-- Mobile Top Bar -->
<div class="mobile-topbar">
	<button class="mobile-menu-btn" onclick={() => sidebarOpen = !sidebarOpen}>
		<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
	</button>
	<div class="mobile-topbar-title">{propertyName}</div>
	<a href="/" class="mobile-deals-link">Deals</a>
</div>

<!-- Main Content -->
<div class="main">
	<div class="content-wrap">

		{#if loading}
			<!-- Loading Skeleton -->
			<div class="skeleton-block" style="height:300px;"></div>
			<div class="skeleton-block" style="height:200px;"></div>
			<div class="skeleton-block" style="height:160px;"></div>
		{:else}
			<!-- Breadcrumb -->
			<div class="breadcrumb">
				<a href="/">Dashboard</a>
				<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
				<a href="/#assets">Assets</a>
				<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
				<span class="breadcrumb-current">{propertyName}</span>
			</div>

			<!-- Hero Card -->
			<div class="hero-card">
				<div class="hero-top">
					<div class="hero-info">
						<div class="hero-asset-type">{assetClass || 'Property'}</div>
						<h1 class="hero-name">{propertyName}</h1>
						{#if propertyAddress || location}
							<div class="hero-address">
								{propertyAddress || location}
								{#if gmapsUrl}
									<a href={gmapsUrl} target="_blank" rel="noopener" class="hero-gmaps-link">
										<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
										View on Google Maps
									</a>
								{/if}
							</div>
						{/if}
						<div class="hero-tags">
							{#if assetClass}<span class="tag tag-green">{assetClass}</span>{/if}
							{#if location}<span class="tag tag-blue">{location}</span>{/if}
							{#if status}<span class="tag tag-{statusColor(status)}">{status}</span>{/if}
						</div>
					</div>
					<div class="hero-map">
						<div id="propertyMap"></div>
						{#if !currentCoords}
							<div class="map-placeholder">
								<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="width:36px;height:36px;margin-bottom:8px;opacity:0.4;"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
								<div style="font-family:var(--font-ui);font-size:12px;font-weight:600;">Map loads with address data</div>
							</div>
						{/if}
					</div>
				</div>
				<div class="hero-stats">
					{#each heroStats as stat}
						<div class="hero-stat">
							<div class="hero-stat-value">{stat.value}</div>
							<div class="hero-stat-label">{stat.label}</div>
						</div>
					{/each}
				</div>
			</div>

			<!-- Property Summary -->
			{#if summaryText}
				<div class="section">
					<div class="section-label">Property Summary</div>
					<div class="section-card">
						<div class="summary-text">{summaryText}</div>
					</div>
				</div>
			{/if}

			<!-- Valuation History -->
			{#if hasValuationChart}
				<div class="section">
					<div class="section-label">Valuation History</div>
					<div class="section-card">
						<div class="chart-wrap">
							{#if valuationChange}
								<div class="chart-subtitle">
									<span class={valuationChange.isPositive ? 'positive' : 'negative'}>
										{valuationChange.isPositive ? '+' : ''}{valuationChange.pctChange}%
									</span>
									since {valuationChange.firstLabel}
									({currency(valuationChange.first)} &rarr; {currency(valuationChange.last)})
								</div>
							{/if}
							<div class="chart-container">
								<canvas id="valuationChart"></canvas>
							</div>
						</div>
					</div>
				</div>
			{/if}

			<!-- Transaction History -->
			{#if sortedDealsForTable.length > 0}
				<div class="section">
					<div class="section-label">Transaction History</div>
					<div class="section-card">
						<div class="table-scroll">
							<table class="price-table">
								<thead>
									<tr>
										<th>Date</th>
										<th>Event</th>
										<th>Purchase Price</th>
										<th class="col-change">% Change</th>
										<th>Buyer / Operator</th>
										<th class="col-deck">Deck / PPM</th>
									</tr>
								</thead>
								<tbody>
									{#each sortedDealsForTable as deal}
										{@const ev = statusToEvent(deal.status)}
										{@const price = deal.purchasePrice || deal.offeringSize}
										{@const unitCount = matchingDeals[0]?.unitCount}
										{@const perUnit = (price && unitCount && unitCount > 0) ? price / unitCount : null}
										{@const pctChange = getPriceChange(deal)}
										<tr class="clickable-row" onclick={() => goto('/deal?id=' + encodeURIComponent(deal.id))}>
											<td><span class="price-date">{new Date(deal.addedDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span></td>
											<td><span class="event-tag {ev.cls}">{ev.label}</span></td>
											<td>
												{#if price}
													<div class="price-amount">{currency(price)}</div>
													{#if perUnit}<div class="price-per-unit">${Math.round(perUnit).toLocaleString()}/unit</div>{/if}
													{#if deal.purchasePrice && deal.offeringSize}
														<div class="price-per-unit">Raise: {currency(deal.offeringSize)}</div>
													{/if}
												{:else}
													&mdash;
												{/if}
											</td>
											<td class="col-change">
												{#if pctChange !== null}
													<span class="price-change {pctChange >= 0 ? 'positive' : 'negative'}">
														{pctChange >= 0 ? '+' : ''}{pctChange.toFixed(1)}%
													</span>
												{:else}
													&mdash;
												{/if}
											</td>
											<td>
												{#if deal.managementCompany}
													<a href="/deal?id={encodeURIComponent(deal.id)}" class="price-operator" onclick={(e) => e.stopPropagation()}>{deal.managementCompany}</a>
												{:else}
													&mdash;
												{/if}
											</td>
											<td class="col-deck">
												{#if deal.deckUrl}
													<a href={deal.deckUrl} target="_blank" rel="noopener" class="deck-link" onclick={(e) => e.stopPropagation()}>
														<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>Deck
													</a>
												{/if}
												{#if deal.ppmUrl}
													<a href={deal.ppmUrl} target="_blank" rel="noopener" class="deck-link" onclick={(e) => e.stopPropagation()}>
														<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>PPM
													</a>
												{/if}
												{#if !deal.deckUrl && !deal.ppmUrl}&mdash;{/if}
											</td>
										</tr>
									{/each}
								</tbody>
							</table>
						</div>
					</div>
				</div>
			{/if}

			<!-- Operator Comparison -->
			{#if showOperatorComp}
				{@const compData = operatorCompRows}
				<div class="section">
					<div class="section-label">Operator Comparison</div>
					<div class="section-card">
						<div class="table-scroll">
							<table class="op-comp-table">
								<thead>
									<tr>
										<th>Metric</th>
										{#each compData.deals as d}
											<th>{d.managementCompany || 'Operator'}</th>
										{/each}
									</tr>
								</thead>
								<tbody>
									{#each compData.rows as row}
										<tr>
											<td>{row.label}</td>
											{#each compData.deals as d}
												<td><div class="op-comp-value">{row.fmt(d)}</div></td>
											{/each}
										</tr>
									{/each}
								</tbody>
							</table>
						</div>
					</div>
				</div>
			{/if}

			<!-- Property Records -->
			{#if showRecords}
				<div class="section">
					<div class="section-label">Property Records</div>
					<div class="section-card">
						<div class="records-source">
							<span class="mi-source">via {rentCastData ? 'RentCast' : 'Deal Data'}</span>
						</div>

						{#if rentCastData?.lastSalePrice}
							{@const perUnit = rentCastData.unitCount ? Math.round(rentCastData.lastSalePrice / rentCastData.unitCount) : null}
							<div class="records-highlight-wrap">
								<div class="records-highlight">
									<div class="records-highlight-label">Acquisition Price</div>
									<div class="records-highlight-row">
										<div class="records-highlight-value">${rentCastData.lastSalePrice.toLocaleString()}</div>
										{#if perUnit}<div class="records-highlight-per-unit">${perUnit.toLocaleString()} / unit</div>{/if}
									</div>
									{#if rentCastData.lastSaleDate}
										<div class="records-highlight-date">Recorded {fmtDate(rentCastData.lastSaleDate)}</div>
									{/if}
								</div>
							</div>
						{/if}

						{#if recordItems.length}
							<div class="records-grid">
								{#each recordItems as item}
									<div class="record-item">
										<div class="record-label">{item.l}</div>
										<div class="record-value">{item.v}</div>
									</div>
								{/each}
							</div>
						{/if}

						{#if taxYears.length}
							<div class="tax-section">
								<div class="tax-section-label">Tax Assessment History</div>
								<div class="table-scroll">
									<table class="tax-table">
										<thead>
											<tr>
												<th>Year</th><th>Total Value</th>
												{#if rentCastData?.unitCount}<th>Per Unit</th>{/if}
												<th>Land</th><th>Improvements</th><th>Tax</th>
											</tr>
										</thead>
										<tbody>
											{#each taxYears as yr}
												{@const a = rentCastData.taxAssessments[yr]}
												{@const tax = rentCastData.propertyTaxes?.[yr]?.total}
												<tr>
													<td style="font-weight:600;">{yr}</td>
													<td>${(a.value || 0).toLocaleString()}</td>
													{#if rentCastData.unitCount}
														<td style="color:var(--blue);font-weight:600;">${Math.round((a.value || 0) / rentCastData.unitCount).toLocaleString()}</td>
													{/if}
													<td>${(a.land || 0).toLocaleString()}</td>
													<td>${((a.improvements || (a.value - a.land)) || 0).toLocaleString()}</td>
													<td>{tax ? '$' + tax.toLocaleString() : '--'}</td>
												</tr>
											{/each}
										</tbody>
									</table>
								</div>
							</div>
						{/if}

						{#if rentCastData?.owner?.names?.length}
							<div class="owner-section">
								<div class="owner-card">
									<div class="owner-label">Owner of Record</div>
									<div class="owner-name">{rentCastData.owner.names.join(', ')}</div>
									{#if rentCastData.owner.type}
										<div class="owner-type">{rentCastData.owner.type}</div>
									{/if}
								</div>
							</div>
						{/if}
					</div>
				</div>
			{/if}

			<!-- Market Intelligence -->
			{#if showMarketIntel}
				<div class="section">
					<div class="section-label">Market Intelligence</div>
					<div class="section-card">
						<!-- Risk Flags -->
						{#if risks.length}
							<div class="market-risks">
								{#each risks as r}
									<div class="mi-risk-card {r.severity}">
										{#if r.severity === 'danger'}
											<svg class="mi-risk-icon danger" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
										{:else if r.severity === 'positive'}
											<svg class="mi-risk-icon positive" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
										{:else}
											<svg class="mi-risk-icon warning" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
										{/if}
										<div>
											<div class="mi-risk-title">{r.message}</div>
											<div class="mi-risk-detail">{r.detail}</div>
										</div>
									</div>
								{/each}
							</div>
						{/if}

						<!-- Summary Stats -->
						{#if pop.length >= 2}
							{@const latestPop = pop[pop.length - 1]}
							{@const latestIncome = income.length ? income[income.length - 1] : null}
							{@const b = marketData.benchmarks || {}}
							{@const stateB = b.state || {}}
							{@const natB = b.national || {}}
							<div class="mi-stat-row">
								<div class="mi-stat">
									<div class="mi-stat-value">{latestPop.population.toLocaleString()}</div>
									<div class="mi-stat-label">Population ({latestPop.year})</div>
								</div>
								{#if latestIncome}
									<div class="mi-stat">
										<div class="mi-stat-value">${latestIncome.medianIncome.toLocaleString()}</div>
										<div class="mi-stat-label">Median Income ({latestIncome.year})</div>
									</div>
								{/if}
							</div>
						{/if}

						<!-- Charts grid -->
						{#if pop.length >= 3}
							<div class="mi-grid">
								<div class="mi-chart-wrap">
									<div class="mi-chart-header">
										<div class="mi-chart-title">Population</div>
										{#if marketData.populationTrend}
											{@const t = marketData.populationTrend}
											<span class="mi-trend-badge {t.declining ? 'negative' : (t.annualGrowth > 0.5 ? 'positive' : 'neutral')}">
												{t.pctChange > 0 ? '+' : ''}{t.pctChange}% since {t.startYear}
											</span>
										{/if}
									</div>
									<div class="mi-subtitle">{cleanAreaName} ({pop[0].year}--{pop[pop.length-1].year})</div>
									<div class="mi-chart-container"><canvas id="populationChart"></canvas></div>
								</div>
								{#if income.length >= 3}
									{@const incFirst = income[0].medianIncome}
									{@const incLast = income[income.length-1].medianIncome}
									{@const incChange = Math.round(((incLast - incFirst) / incFirst) * 1000) / 10}
									<div class="mi-chart-wrap">
										<div class="mi-chart-header">
											<div class="mi-chart-title">Median Household Income</div>
											<span class="mi-trend-badge {incLast < incFirst ? 'negative' : 'positive'}">
												{incChange > 0 ? '+' : ''}{incChange}% since {income[0].year}
											</span>
										</div>
										<div class="mi-subtitle">{cleanAreaName} &middot; ${fmtK(income[0].medianIncome)} &rarr; ${fmtK(income[income.length-1].medianIncome)}</div>
										<div class="mi-chart-container"><canvas id="incomeChart"></canvas></div>
									</div>
								{/if}
							</div>
						{/if}

						<!-- Age Pyramid -->
						{#if marketData?.ageDistribution?.length}
							<div class="age-pyramid-section">
								<div class="mi-chart-title">Population by Age & Sex</div>
								<div class="mi-subtitle">{cleanAreaName} &middot; 2023 ACS 5-Year Estimates</div>
								<div style="height:360px;position:relative;"><canvas id="agePyramidChart"></canvas></div>
								<div class="pyramid-legend">
									<span class="legend-item"><span class="legend-swatch" style="background:#38bdf8;"></span>Male</span>
									<span class="legend-item"><span class="legend-swatch" style="background:#fbbf24;"></span>Female</span>
								</div>
							</div>
						{/if}

						<!-- Housing (multifamily) -->
						{#if isMultifamily && marketData?.housing}
							{@const h = marketData.housing}
							<div class="housing-section">
								<div class="housing-grid">
									<div>
										<div class="mi-chart-header">
											<div class="mi-chart-title">Housing Occupancy</div>
											<span class="mi-trend-badge {h.vacancyRate > 10 ? 'negative' : (h.vacancyRate > 7 ? 'neutral' : 'positive')}">{h.vacancyRate}% vacancy</span>
										</div>
										<div class="mi-subtitle">{h.totalUnits.toLocaleString()} total housing units in area</div>
										<div class="mi-chart-container"><canvas id="occupancyChart"></canvas></div>
									</div>
									<div>
										<div class="mi-chart-header">
											<div class="mi-chart-title">Bedrooms in Housing Units</div>
											{#if marketData.housing.bedroomTimeSeries?.length >= 3}
												<div class="view-toggle">
													<button class={brView === 'bars' ? 'active' : ''} onclick={() => brView = 'bars'}>Current</button>
													<button class={brView === 'trend' ? 'active' : ''} onclick={() => brView = 'trend'}>Trend</button>
												</div>
											{/if}
										</div>
										<div class="mi-subtitle">2023 ACS 5-Year Estimates</div>
										{#if brView === 'bars' && h.bedrooms?.length}
											{@const maxBrPct = Math.max(...h.bedrooms.map(b => b.pct))}
											<div class="bedroom-bars">
												{#each h.bedrooms as br}
													<div class="bedroom-bar-row">
														<div class="bedroom-bar-labels">
															<span class="bedroom-bar-name">{br.label}</span>
															<span class="bedroom-bar-pct">{br.pct}%</span>
														</div>
														<div class="bedroom-bar-track">
															<div class="bedroom-bar-fill" style="width:{maxBrPct > 0 ? Math.round((br.pct / maxBrPct) * 100) : 0}%"></div>
														</div>
													</div>
												{/each}
											</div>
										{:else}
											<div style="height:220px;position:relative;"><canvas id="bedroomTrendChart"></canvas></div>
										{/if}
									</div>
								</div>
							</div>
						{/if}

						<!-- Employment -->
						{#if industries.length}
							<div class="employment-section">
								<div class="mi-chart-header">
									<div class="mi-chart-title">Top Industries by Employment</div>
									{#if marketData.employment?.timeSeries && marketData.employment?.years?.length >= 2}
										<div class="view-toggle">
											<button class={empView === 'list' ? 'active' : ''} onclick={() => empView = 'list'}>List</button>
											<button class={empView === 'chart' ? 'active' : ''} onclick={() => empView = 'chart'}>Trend</button>
										</div>
									{/if}
								</div>
								<div class="mi-subtitle">
									{#if marketData.query?.countyName}{marketData.query.countyName}, {marketData.query?.stateAbbr || ''} &middot; {/if}
									{marketData.employment.year} annual averages
									{#if marketData.employment.totalEmployment} &middot; {marketData.employment.totalEmployment.toLocaleString()} total jobs{/if}
								</div>
								{#if empView === 'list'}
									{@const maxEmpl = industries[0].employment}
									<ul class="mi-industry-list">
										{#each industries as ind, i}
											<li class="mi-industry-item">
												<span class="mi-industry-rank">{i + 1}</span>
												<span class="mi-industry-name">
													{ind.industry}
													{#if ind.avgAnnualPay}
														<div class="mi-industry-sub">${Math.round(ind.avgAnnualPay / 1000)}K avg</div>
													{/if}
												</span>
												<span class="mi-industry-bar-wrap">
													<span class="mi-industry-bar" style="width:{Math.max(8, Math.round((ind.employment / maxEmpl) * 100))}%"></span>
												</span>
												<span class="mi-industry-count">{ind.employment.toLocaleString()}</span>
												{#if ind.yoyPct !== null && ind.yoyPct !== undefined}
													<span class="mi-industry-yoy" style="color:{ind.yoyPct >= 0 ? 'var(--green)' : 'var(--red)'}">
														{ind.yoyPct >= 0 ? '+' : ''}{ind.yoyPct}%
													</span>
												{/if}
											</li>
										{/each}
									</ul>
								{:else}
									<div style="height:300px;position:relative;"><canvas id="industryTrendChart"></canvas></div>
								{/if}
							</div>
						{/if}

						<!-- Source -->
						<div class="mi-source-footer">
							<a href="https://data.census.gov" target="_blank" rel="noopener" class="mi-source">via US Census Bureau ↗</a>
							<a href="https://data.bls.gov/cew/apps/data_views/data_views.htm" target="_blank" rel="noopener" class="mi-source">Bureau of Labor Statistics ↗</a>
						</div>
					</div>
				</div>
			{/if}

			<!-- Nearby Assets -->
			{#if nearbyDeals.length}
				<div class="section">
					<div class="section-label">Nearby Assets</div>
					<div class="section-card">
						<div id="nearbyMapWrap" class="nearby-map-wrap">
							<div id="nearbyMap" style="width:100%;height:100%;"></div>
						</div>
						<div class="nearby-table-wrap">
							<table class="nearby-table">
								<colgroup>
									<col class="col-irr" style="width:80px;">
									<col style="width:120px;">
									<col>
									<col class="col-deal">
									<col class="col-operator" style="width:160px;">
								</colgroup>
								<thead>
									<tr>
										<th class="col-irr" style="text-align:right;padding-left:20px;">Target IRR</th>
										<th>Asset Class</th>
										<th>Asset</th>
										<th class="col-deal">Deal</th>
										<th class="col-operator" style="padding-right:20px;">Operator</th>
									</tr>
								</thead>
								<tbody>
									{#each nearbyDeals as d}
										{@const assetName = (() => {
											let name = d.investmentName || '';
											const sep = name.match(/^(.+?)\s*[--\/]\s*\d{2,5}\s+/);
											return sep ? sep[1].trim() : name;
										})()}
										<tr class="nearby-row">
											<td class="col-irr" style="text-align:right;padding-left:20px;color:var(--green);font-weight:700;">{d.targetIRR ? pct(d.targetIRR) : '--'}</td>
											<td><span class="tag tag-green" style="font-size:11px;">{d.assetClass || '--'}</span></td>
											<td><a href="/asset?id={encodeURIComponent(d.id)}" class="nearby-link">{assetName}</a></td>
											<td class="col-deal"><a href="/deal?id={encodeURIComponent(d.id)}" class="nearby-link">{d.investmentName}</a></td>
											<td class="col-operator" style="padding-right:20px;">
												{#if d.managementCompany}
													<a href="/#operators&search={encodeURIComponent(d.managementCompany)}" class="nearby-link" style="color:var(--blue);">{d.managementCompany}</a>
												{:else}
													--
												{/if}
											</td>
										</tr>
									{/each}
								</tbody>
							</table>
						</div>
					</div>
				</div>
			{/if}
		{/if}
	</div>
</div>

<style>
	/* ====== LAYOUT ====== */
	.main {
		margin-left: 240px;
		min-height: 100vh;
	}
	.content-wrap {
		max-width: 1060px;
		padding: 40px 40px 80px;
		margin: 0 auto;
	}

	/* ====== MOBILE TOPBAR ====== */
	.mobile-topbar {
		display: none;
		position: sticky;
		top: 0;
		height: 56px;
		background: var(--bg-cream);
		border-bottom: 1px solid var(--border);
		align-items: center;
		padding: 0 20px;
		gap: 12px;
		z-index: 50;
	}
	.mobile-topbar-title {
		font-family: var(--font-ui);
		font-size: 14px;
		font-weight: 700;
		color: var(--text-dark);
		flex: 1;
	}
	.mobile-menu-btn {
		display: none;
		background: none;
		border: none;
		cursor: pointer;
		color: var(--text-dark);
		padding: 4px;
	}
	.mobile-menu-btn svg { width: 24px; height: 24px; }
	.mobile-deals-link {
		font-family: var(--font-ui);
		font-size: 12px;
		font-weight: 600;
		color: var(--primary);
		text-decoration: none;
	}

	/* ====== LOADING ====== */
	@keyframes shimmer { 0% { transform: translateX(-100%); } 100% { transform: translateX(100%); } }
	.skeleton-block {
		background: var(--border-light);
		border-radius: 12px;
		position: relative;
		overflow: hidden;
		margin-bottom: 20px;
	}
	.skeleton-block::after {
		content: '';
		position: absolute;
		inset: 0;
		background: linear-gradient(90deg, transparent, rgba(255,255,255,0.5), transparent);
		animation: shimmer 1.5s infinite;
	}

	/* ====== BREADCRUMB ====== */
	.breadcrumb {
		font-family: var(--font-ui);
		font-size: 13px;
		color: var(--text-muted);
		margin-bottom: 24px;
		display: flex;
		align-items: center;
		gap: 6px;
	}
	.breadcrumb a { color: var(--text-secondary); text-decoration: none; font-weight: 500; }
	.breadcrumb a:hover { color: var(--primary); }
	.breadcrumb svg { width: 14px; height: 14px; opacity: 0.4; }
	.breadcrumb-current { color: var(--text-dark); font-weight: 600; }

	/* ====== HERO CARD ====== */
	.hero-card {
		background: var(--bg-card);
		border-radius: 12px;
		border: 1px solid var(--border);
		box-shadow: 0 1px 3px rgba(0,0,0,0.06);
		overflow: hidden;
		margin-bottom: 32px;
	}
	.hero-top { display: grid; grid-template-columns: 1fr 280px; min-height: 240px; }
	.hero-info { padding: 36px 40px; display: flex; flex-direction: column; justify-content: center; }
	.hero-asset-type { font-family: var(--font-ui); font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1.2px; color: var(--primary); margin-bottom: 12px; }
	.hero-name { font-family: var(--font-headline); font-size: 36px; color: var(--text-dark); letter-spacing: -0.5px; line-height: 1.15; margin-bottom: 8px; }
	.hero-address { font-family: var(--font-body); font-size: 17px; color: var(--text-secondary); margin-bottom: 20px; }
	.hero-gmaps-link {
		display: inline-flex; align-items: center; gap: 4px; margin-left: 8px;
		font-family: var(--font-ui); font-size: 12px; font-weight: 600; color: var(--blue);
		text-decoration: none; padding: 3px 10px; background: #EFF6FF; border-radius: 20px; vertical-align: middle;
	}
	.hero-tags { display: flex; flex-wrap: wrap; gap: 8px; }
	.tag { font-family: var(--font-ui); font-size: 12px; font-weight: 600; padding: 5px 14px; border-radius: 20px; }
	.tag-green { background: var(--green-bg); color: var(--green); }
	.tag-blue { background: #EFF6FF; color: var(--blue); }
	.tag-orange { background: #FFF3E6; color: var(--orange); }
	.hero-map { position: relative; background: var(--border-light); }
	.hero-map :global(#propertyMap) { width: 100%; height: 100%; min-height: 240px; }
	.map-placeholder {
		position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center;
		justify-content: center; background: linear-gradient(135deg, #1F5159, #0A1E21); color: rgba(255,255,255,0.4);
	}
	.hero-stats { display: grid; grid-template-columns: repeat(4, 1fr); border-top: 1px solid var(--border-light); }
	.hero-stat { padding: 20px 24px; text-align: center; border-right: 1px solid var(--border-light); }
	.hero-stat:last-child { border-right: none; }
	.hero-stat-value { font-family: var(--font-ui); font-size: 22px; font-weight: 700; color: var(--text-dark); }
	.hero-stat-label { font-family: var(--font-ui); font-size: 11px; font-weight: 600; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px; margin-top: 2px; }

	/* ====== SECTIONS ====== */
	.section { margin-bottom: 32px; }
	.section-label { font-family: var(--font-ui); font-size: 20px; font-weight: 800; color: var(--text-dark); letter-spacing: -0.3px; margin-bottom: 16px; }
	.section-card { background: var(--bg-card); border-radius: 12px; border: 1px solid var(--border); box-shadow: 0 1px 3px rgba(0,0,0,0.06); overflow: hidden; }
	.summary-text { padding: 24px; font-family: var(--font-body); font-size: 15px; line-height: 1.7; color: var(--text-secondary); }

	/* ====== CHART ====== */
	.chart-wrap { padding: 24px; }
	.chart-subtitle { font-family: var(--font-ui); font-size: 13px; color: var(--text-muted); margin-bottom: 16px; }
	.chart-subtitle .positive { color: var(--green); font-weight: 700; }
	.chart-subtitle .negative { color: var(--red); font-weight: 700; }
	.chart-container { position: relative; height: 220px; }

	/* ====== TABLE SCROLL ====== */
	.table-scroll { overflow-x: auto; }

	/* ====== PRICE TABLE ====== */
	.price-table { width: 100%; border-collapse: collapse; font-family: var(--font-body); font-size: 14px; }
	.price-table th { font-family: var(--font-ui); font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: var(--text-muted); padding: 14px 20px; text-align: left; border-bottom: 2px solid var(--border); }
	.price-table td { padding: 18px 20px; border-bottom: 1px solid var(--border-light); vertical-align: middle; }
	.price-table tr:last-child td { border-bottom: none; }
	.price-table tr:hover { background: rgba(81,190,123,0.03); }
	.clickable-row { cursor: pointer; }
	.price-date { font-family: var(--font-ui); font-size: 13px; font-weight: 600; color: var(--text-dark); white-space: nowrap; }
	.price-amount { font-family: var(--font-ui); font-size: 16px; font-weight: 800; color: var(--text-dark); }
	.price-per-unit { font-family: var(--font-ui); font-size: 12px; color: var(--text-muted); margin-top: 2px; }
	.price-change { font-family: var(--font-ui); font-size: 14px; font-weight: 700; }
	.price-change.positive { color: var(--green); }
	.price-change.negative { color: var(--red); }
	.price-operator { font-family: var(--font-ui); font-size: 13px; font-weight: 600; color: var(--primary); text-decoration: none; }
	.price-operator:hover { text-decoration: underline; }
	.deck-link { display: inline-flex; align-items: center; gap: 4px; font-family: var(--font-ui); font-size: 12px; font-weight: 600; color: var(--primary); text-decoration: none; margin-right: 8px; }
	.deck-link:hover { text-decoration: underline; }
	.deck-link svg { width: 14px; height: 14px; }
	.event-tag { display: inline-block; font-family: var(--font-ui); font-size: 11px; font-weight: 700; padding: 4px 10px; border-radius: 6px; white-space: nowrap; }
	.event-tag.new-offering { background: #FEE2E2; color: #DC2626; }
	.event-tag.refinanced { background: #FEF3C7; color: #D97706; }
	.event-tag.sold { background: #D1FAE5; color: #059669; }
	.event-tag.listed { background: #D1FAE5; color: #059669; }
	.event-tag.acquired { background: #DBEAFE; color: #2563EB; }
	.event-tag.closed { background: #F3F4F6; color: #6B7280; }
	.event-tag.open { background: #D1FAE5; color: #059669; }

	/* ====== OPERATOR COMPARISON ====== */
	.op-comp-table { width: 100%; border-collapse: collapse; font-size: 14px; }
	.op-comp-table thead th { font-family: var(--font-ui); font-size: 13px; font-weight: 700; color: var(--text-dark); padding: 16px 20px; text-align: center; border-bottom: 2px solid var(--border); }
	.op-comp-table thead th:first-child { text-align: left; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: var(--text-muted); width: 160px; }
	.op-comp-table td { padding: 12px 20px; border-bottom: 1px solid var(--border-light); text-align: center; font-family: var(--font-ui); font-size: 13px; color: var(--text-dark); }
	.op-comp-table td:first-child { text-align: left; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.3px; color: var(--text-muted); }
	.op-comp-table tr:last-child td { border-bottom: none; }
	.op-comp-table tr:hover { background: rgba(81,190,123,0.03); }
	.op-comp-value { font-weight: 700; }

	/* ====== PROPERTY RECORDS ====== */
	.records-source { padding: 16px 24px 0; }
	.records-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(170px, 1fr)); gap: 12px; padding: 24px; }
	.record-item { padding: 14px 16px; background: var(--bg-cream); border-radius: 8px; }
	.record-label { font-family: var(--font-ui); font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: var(--text-muted); margin-bottom: 4px; }
	.record-value { font-family: var(--font-ui); font-size: 15px; font-weight: 700; color: var(--text-dark); }
	.records-highlight-wrap { padding: 24px 24px 0; }
	.records-highlight { padding: 20px 24px; background: linear-gradient(135deg, #0A1E21, #1F5159); border-radius: 12px; color: #fff; }
	.records-highlight-label { font-family: var(--font-ui); font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; opacity: 0.6; margin-bottom: 8px; }
	.records-highlight-row { display: flex; align-items: baseline; gap: 16px; flex-wrap: wrap; }
	.records-highlight-value { font-family: var(--font-ui); font-size: 28px; font-weight: 800; }
	.records-highlight-per-unit { font-size: 14px; opacity: 0.7; }
	.records-highlight-date { font-size: 12px; opacity: 0.5; margin-top: 6px; }
	.tax-section { padding: 0 24px 24px; }
	.tax-section-label { font-family: var(--font-ui); font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: var(--text-muted); margin-bottom: 8px; }
	.tax-table { width: 100%; border-collapse: collapse; font-family: var(--font-body); font-size: 13px; }
	.tax-table th { font-family: var(--font-ui); font-size: 10px; font-weight: 700; text-transform: uppercase; color: var(--text-muted); padding: 8px 12px; text-align: left; border-bottom: 2px solid var(--border); }
	.tax-table td { padding: 8px 12px; border-bottom: 1px solid var(--border-light); }
	.tax-table tr:last-child td { border-bottom: none; }
	.owner-section { padding: 0 24px 24px; }
	.owner-card { padding: 16px; background: var(--bg-cream); border-radius: 8px; }
	.owner-label { font-family: var(--font-ui); font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: var(--text-muted); margin-bottom: 4px; }
	.owner-name { font-family: var(--font-ui); font-size: 14px; font-weight: 700; color: var(--text-dark); }
	.owner-type { font-size: 12px; color: var(--text-muted); margin-top: 2px; }

	/* ====== MARKET INTELLIGENCE ====== */
	.market-risks { padding: 20px 24px 0; }
	.mi-stat-row { display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; padding: 20px 24px; border-bottom: 1px solid var(--border-light); }
	.mi-stat { text-align: center; }
	.mi-stat-value { font-family: var(--font-ui); font-size: 22px; font-weight: 800; color: var(--text-dark); }
	.mi-stat-label { font-family: var(--font-ui); font-size: 10px; font-weight: 600; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px; margin-top: 2px; }
	.mi-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; padding: 24px; }
	.mi-chart-wrap { position: relative; }
	.mi-chart-container { height: 220px; position: relative; }
	.mi-chart-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px; }
	.mi-chart-title { font-family: var(--font-ui); font-size: 14px; font-weight: 700; color: var(--text-dark); }
	.mi-subtitle { font-family: var(--font-ui); font-size: 12px; color: var(--text-muted); margin-bottom: 12px; }
	.mi-trend-badge { display: inline-flex; align-items: center; gap: 4px; padding: 3px 10px; border-radius: 20px; font-family: var(--font-ui); font-size: 11px; font-weight: 700; }
	.mi-trend-badge.positive { background: var(--green-bg); color: var(--green); }
	.mi-trend-badge.negative { background: #FEE2E2; color: var(--red); }
	.mi-trend-badge.neutral { background: #EFF6FF; color: var(--blue); }
	.mi-risk-card { display: flex; align-items: flex-start; gap: 12px; padding: 14px 16px; border-radius: 8px; margin-bottom: 8px; }
	.mi-risk-card:last-child { margin-bottom: 0; }
	.mi-risk-card.warning { background: #FFF7ED; border: 1px solid #FED7AA; }
	.mi-risk-card.danger { background: #FEF2F2; border: 1px solid #FECACA; }
	.mi-risk-card.positive { background: var(--green-bg); border: 1px solid rgba(81,190,123,0.2); }
	.mi-risk-icon { width: 20px; height: 20px; flex-shrink: 0; margin-top: 1px; }
	.mi-risk-icon.warning { color: var(--orange); }
	.mi-risk-icon.danger { color: var(--red); }
	.mi-risk-icon.positive { color: var(--green); }
	.mi-risk-title { font-family: var(--font-ui); font-size: 13px; font-weight: 700; color: var(--text-dark); }
	.mi-risk-detail { font-family: var(--font-body); font-size: 12px; color: var(--text-secondary); margin-top: 2px; }
	.mi-source { font-family: var(--font-ui); font-size: 9px; font-weight: 700; padding: 3px 10px; border-radius: 100px; background: rgba(37,99,235,0.08); color: var(--blue); text-transform: uppercase; letter-spacing: 0.5px; text-decoration: none; }
	.mi-source-footer { padding: 12px 24px; border-top: 1px solid var(--border-light); display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
	.mi-industry-list { list-style: none; padding: 0; }
	.mi-industry-item { display: flex; align-items: center; gap: 12px; padding: 10px 0; border-bottom: 1px solid var(--border-light); }
	.mi-industry-item:last-child { border-bottom: none; }
	.mi-industry-rank { font-family: var(--font-ui); font-size: 10px; font-weight: 700; color: var(--text-muted); width: 20px; text-align: center; }
	.mi-industry-name { flex: 1; font-family: var(--font-ui); font-size: 13px; font-weight: 600; color: var(--text-dark); }
	.mi-industry-sub { font-size: 10px; color: var(--text-muted); font-weight: 500; margin-top: 1px; }
	.mi-industry-bar-wrap { width: 180px; height: 8px; background: var(--border-light); border-radius: 4px; overflow: hidden; }
	.mi-industry-bar { height: 100%; background: var(--primary); border-radius: 3px; transition: width 0.5s ease; }
	.mi-industry-count { font-family: var(--font-ui); font-size: 12px; font-weight: 700; color: var(--text-secondary); min-width: 60px; text-align: right; }
	.mi-industry-yoy { font-family: var(--font-ui); font-size: 10px; font-weight: 700; min-width: 45px; text-align: right; }

	/* Age pyramid */
	.age-pyramid-section { padding: 24px; }
	.pyramid-legend { display: flex; justify-content: center; gap: 24px; margin-top: 8px; }
	.legend-item { display: flex; align-items: center; gap: 6px; font-family: var(--font-ui); font-size: 11px; font-weight: 600; color: var(--text-muted); }
	.legend-swatch { width: 12px; height: 12px; border-radius: 2px; }

	/* Housing */
	.housing-section { padding: 24px; border-top: 1px solid var(--border-light); }
	.housing-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }
	.bedroom-bars { }
	.bedroom-bar-row { margin-bottom: 10px; }
	.bedroom-bar-labels { display: flex; justify-content: space-between; margin-bottom: 3px; }
	.bedroom-bar-name { font-family: var(--font-ui); font-size: 12px; font-weight: 600; color: var(--text-dark); }
	.bedroom-bar-pct { font-family: var(--font-ui); font-size: 12px; font-weight: 600; color: var(--text-secondary); }
	.bedroom-bar-track { height: 20px; background: var(--border-light); border-radius: 4px; overflow: hidden; }
	.bedroom-bar-fill { height: 100%; background: var(--blue); border-radius: 4px; transition: width 0.5s; }

	/* Employment */
	.employment-section { padding: 24px; border-top: 1px solid var(--border-light); }

	/* View toggle */
	.view-toggle { display: flex; background: var(--border-light); border-radius: 6px; overflow: hidden; }
	.view-toggle button { padding: 4px 12px; font-family: var(--font-ui); font-size: 10px; font-weight: 700; border: none; cursor: pointer; background: transparent; color: var(--text-muted); }
	.view-toggle button.active { background: var(--text-dark); color: #fff; }

	/* ====== NEARBY ====== */
	.nearby-map-wrap { position: relative; height: 400px; }
	.nearby-table-wrap { border-top: 1px solid var(--border-light); overflow-x: auto; }
	.nearby-table { width: 100%; border-collapse: collapse; table-layout: fixed; }
	.nearby-table th { padding: 12px 16px; text-align: left; font-family: var(--font-ui); font-size: 11px; font-weight: 700; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 2px solid var(--border); }
	.nearby-table td { padding: 14px 16px; font-family: var(--font-ui); font-size: 13px; }
	.nearby-row:hover { background: var(--bg-cream); }
	.nearby-row td { border-bottom: 1px solid var(--border-light); }
	.nearby-link { text-decoration: none; font-weight: 600; color: var(--blue); }

	/* ====== MAP LABELS (global for Leaflet) ====== */
	:global(.map-label) { background: #fff !important; border: 1px solid var(--border) !important; border-radius: 6px !important; padding: 3px 8px !important; font-family: var(--font-ui) !important; font-size: 11px !important; font-weight: 600 !important; color: var(--text-dark) !important; box-shadow: 0 2px 6px rgba(0,0,0,0.1) !important; white-space: nowrap !important; cursor: pointer !important; }
	:global(.map-label-current) { background: #0A1E21 !important; color: #fff !important; font-weight: 700 !important; border-color: #0A1E21 !important; }
	:global(.map-label-nearby:hover) { background: var(--primary) !important; color: #fff !important; border-color: var(--primary) !important; }

	/* ====== RESPONSIVE ====== */
	@media (max-width: 768px) {
		.main { margin-left: 0; }
		.mobile-topbar { display: flex; }
		.mobile-menu-btn { display: block; }
		.content-wrap { padding: 20px 12px 48px; }
		.hero-top { grid-template-columns: 1fr; }
		.hero-map { height: 200px; order: -1; }
		.hero-info { padding: 20px 16px; }
		.hero-name { font-size: 24px; }
		.hero-address { font-size: 13px; }
		.hero-stats { grid-template-columns: repeat(2, 1fr); }
		.hero-stat { border-bottom: 1px solid var(--border-light); padding: 12px 16px; }
		.records-grid { grid-template-columns: repeat(2, 1fr); padding: 16px; }
		.mi-grid { grid-template-columns: 1fr; padding: 16px; }
		.mi-stat-row { gap: 8px; padding: 16px; }
		.mi-stat-value { font-size: 18px; }
		.mi-industry-bar-wrap { width: 80px; }
		.mi-industry-name { font-size: 12px; }
		.mi-industry-count { font-size: 11px; min-width: 45px; }
		.price-table { font-size: 12px; }
		.price-table th, .price-table td { padding: 10px 8px; }
		.price-table .col-deck { display: none; }
		.price-table .col-change { display: none; }
		.price-amount { font-size: 14px; }
		.section-label { font-size: 16px; }
		.section-card { border-radius: 8px; }
		.nearby-table .col-deal { display: none; }
		.nearby-table th, .nearby-table td { padding: 10px 8px; font-size: 12px; }
		.nearby-map-wrap { height: 280px; }
		.housing-grid { grid-template-columns: 1fr; }
		.content-wrap { padding-bottom: calc(48px + env(safe-area-inset-bottom, 0px)); }
		.hero-gmaps-link { min-height: 44px; display: inline-flex; align-items: center; }
	}
	@media (max-width: 480px) {
		.content-wrap { padding: 16px 8px 48px; }
		.hero-name { font-size: 20px; }
		.hero-stats { grid-template-columns: 1fr 1fr; }
		.hero-stat-value { font-size: 16px; }
		.hero-stat-label { font-size: 8px; }
		.mi-stat-row { grid-template-columns: 1fr; }
		.mi-industry-bar-wrap { width: 50px; }
		.nearby-table .col-operator { display: none; }
	}
</style>
