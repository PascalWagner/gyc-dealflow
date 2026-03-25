<script>
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';
	import { goto } from '$app/navigation';
	import { user, isLoggedIn, userEmail, userToken, isAdmin } from '$lib/stores/auth.js';
	import Sidebar from '$lib/components/Sidebar.svelte';

	// ===== Reactive State (Svelte 5 Runes) =====
	let loading = $state(true);
	let refreshing = $state(false);
	let accessDenied = $state(false);
	let toastMsg = $state('');
	let toastVisible = $state(false);
	let sidebarOpen = $state(false);

	// GP State
	let companyId = $state(null);
	let companyName = $state('');
	let gpIsAdmin = $state(false);
	let deals = $state([]);
	let allDeals = $state([]);
	let analytics = $state({ totalSaves: 0, totalVetting: 0, totalInvested: 0, recentActivity: [], weeklyActivity: [], highIntentCount: 0 });
	let investorInsights = $state({});

	// Settings
	let calendarUrl = $state('');
	let irContactName = $state('');
	let irContactEmail = $state('');
	let authorizedEmails = $state([]);
	let calendarSaving = $state(false);
	let calendarStatus = $state('');
	let calendarStatusColor = $state('');
	let irSaving = $state(false);
	let irStatus = $state('');
	let irStatusColor = $state('');
	let emailStatus = $state('');
	let emailStatusColor = $state('');
	let newEmailInput = $state('');

	// Sorting
	let sortCol = $state('completeness');
	let sortAsc = $state(true);

	// Weekly chart ref
	let weeklyChartEl = $state(null);
	let weeklyChartInstance = $state(null);
	let gpChartJsLoaded = $state(false);

	// Competitive Analysis state
	let compExtraFields = $state({}); // keyed by tableId -> array of field keys
	let compDropdownOpen = $state({}); // keyed by tableId -> boolean

	// ===== Admin Emails =====
	const ADMIN_EMAILS = ['pascal@growyourcashflow.com','pascalwagner@gmail.com','pascal.wagner@growyourcashflow.com','info@pascalwagner.com','pascal@growyourcashflow.io'];
	const DIST_COLORS = ['#51BE7B', '#2563EB', '#CF7A30', '#CA8A04', '#D04040', '#8B5CF6'];
	const DEAL_TYPE_COLORS = ['#2563EB', '#51BE7B', '#CF7A30', '#CA8A04', '#8B5CF6', '#D04040'];

	// ===== Helpers =====
	function escHtml(str) { return str || ''; }

	function relativeTime(dateStr) {
		if (!dateStr) return '';
		const now = new Date();
		const then = new Date(dateStr);
		const diffMs = now - then;
		const diffMin = Math.floor(diffMs / 60000);
		if (diffMin < 1) return 'just now';
		if (diffMin < 60) return diffMin + 'm ago';
		const diffHrs = Math.floor(diffMin / 60);
		if (diffHrs < 24) return diffHrs + 'h ago';
		const diffDays = Math.floor(diffHrs / 24);
		if (diffDays < 30) return diffDays + 'd ago';
		const diffMonths = Math.floor(diffDays / 30);
		if (diffMonths < 12) return diffMonths + 'mo ago';
		return Math.floor(diffMonths / 12) + 'y ago';
	}

	function formatPctDisplay(val) {
		if (val == null) return '--';
		if (val <= 1) return (val * 100).toFixed(1) + '%';
		return val.toFixed(1) + '%';
	}

	function getInitials(name) {
		if (!name) return '?';
		return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 3);
	}

	function statusBadgeClass(status) {
		if (!status) return 'green';
		const s = status.toLowerCase();
		if (s.includes('open')) return 'green';
		if (s.includes('evergreen')) return 'blue';
		if (s.includes('closed')) return 'orange';
		return 'green';
	}

	function maxPct(items = []) {
		return items.reduce((max, item) => Math.max(max, Number(item?.pct || 0)), 0);
	}

	function widthFromPct(value, max) {
		if (!max || !value) return 0;
		return Math.round((Number(value) / max) * 100);
	}

	function buildDonutGradient(items = [], colors = DIST_COLORS) {
		if (!items.length) return '';
		const stops = [];
		let cumulative = 0;
		items.forEach((item, index) => {
			const pct = Number(item?.pct || 0);
			const color = colors[index % colors.length];
			stops.push(`${color} ${cumulative}%`);
			cumulative += pct;
			stops.push(`${color} ${cumulative}%`);
		});
		return `conic-gradient(${stops.join(', ')})`;
	}

	function checkSizeBarHeight(value, max) {
		if (!max || !value) return 0;
		return Math.max(Math.round((Number(value) / max) * 90), 4);
	}

	// ===== Deal Field Helpers =====
	function getDealName(d) {
		return d.investmentName || d.investment_name || d.name || d.deal_name || d.Name || 'Untitled Deal';
	}
	function getDealAssetClass(d) {
		return d.assetClass || d.asset_class || '';
	}
	function getDealStatus(d) {
		return d.status || d.Status || '';
	}
	function getDealId(d) {
		return d.id || d.airtable_id || '';
	}
	function hasPPM(d) {
		return !!(d.ppmUrl || d.ppm_url);
	}
	function hasDeck(d) {
		return !!(d.deckUrl || d.deck_url);
	}
	function hasStrategy(d) {
		return !!(d.investmentStrategy || d.investment_strategy || d.strategy || d.Strategy);
	}
	function hasTargetIRR(d) {
		return d.targetIRR != null || d.target_irr != null || d.targetIrr != null;
	}
	function hasPrefReturn(d) {
		return d.preferredReturn != null || d.pref_return != null || d.prefReturn != null;
	}
	function hasMinInvestment(d) {
		return d.investmentMinimum != null || d.investment_minimum != null || d.minInvestment != null || d.min_investment != null || d.minimumInvestment != null;
	}
	function hasDealType(d) {
		return !!(d.dealType || d.deal_type);
	}
	function hasOfferingType(d) {
		return !!(d.offeringType || d.offering_type);
	}
	function hasDistributions(d) {
		return !!(d.distributions || d.Distributions);
	}

	// ===== Competitive Analysis Field Helpers =====
	function getDealPref(d) {
		const v = d.preferredReturn ?? d.pref_return ?? d.prefReturn;
		return v != null ? Number(v) : null;
	}
	function getDealMin(d) {
		return d.investmentMinimum ?? d.investment_minimum ?? d.minInvestment ?? d.min_investment ?? d.minimumInvestment ?? null;
	}
	function getDealDist(d) {
		return d.distributions || d.Distributions || null;
	}
	function getDealIRR(d) {
		const v = d.targetIRR ?? d.target_irr ?? d.targetIrr;
		return v != null ? Number(v) : null;
	}
	function getDealHoldPeriod(d) {
		const v = d.holdPeriod ?? d.hold_period_years ?? d.hold_period;
		return v != null ? Number(v) : null;
	}

	const extraFieldDefs = [
		{ key: 'equityMultiple', label: 'Equity Multiple', format: 'x', get: (d) => d.equityMultiple ?? d.equity_multiple ?? null },
		{ key: 'cashOnCash', label: 'Cash on Cash', format: 'pct', get: (d) => d.cashOnCash ?? d.cash_on_cash ?? null },
		{ key: 'holdPeriod', label: 'Hold Period', format: 'yr', get: (d) => getDealHoldPeriod(d) },
		{ key: 'offeringType', label: 'Offering Type', format: 'text', get: (d) => d.offeringType || d.offering_type || null },
		{ key: 'occupancyPct', label: 'Occupancy', format: 'pct', get: (d) => d.occupancyPct ?? d.occupancy_pct ?? null },
		{ key: 'loanToValue', label: 'Loan to Value', format: 'pct', get: (d) => d.loanToValue ?? d.loan_to_value ?? null },
		{ key: 'purchasePrice', label: 'Purchase Price', format: 'dollar', get: (d) => d.purchasePrice ?? d.purchase_price ?? null },
		{ key: 'location', label: 'Location', format: 'text', get: (d) => d.location || d.investing_geography || null },
		{ key: 'assetClass', label: 'Asset Class', format: 'text', get: (d) => d.assetClass || d.asset_class || null }
	];

	function formatFieldValue(val, fmt) {
		if (val == null) return '--';
		if (fmt === 'pct') return formatPctDisplay(val);
		if (fmt === 'x') return Number(val).toFixed(1) + 'x';
		if (fmt === 'yr') return Number(val).toFixed(0) + ' yrs';
		if (fmt === 'dollar') return '$' + Number(val).toLocaleString();
		return String(val);
	}

	function computePercentile(sortedArr, value) {
		if (!sortedArr.length) return 0;
		let below = 0;
		for (const v of sortedArr) { if (v < value) below++; }
		return Math.round((below / sortedArr.length) * 100);
	}

	function toggleCompDropdown(tableId) {
		compDropdownOpen = { ...compDropdownOpen, [tableId]: !compDropdownOpen[tableId] };
	}

	function addCompField(tableId, fieldKey) {
		const current = compExtraFields[tableId] || [];
		if (!current.includes(fieldKey)) {
			compExtraFields = { ...compExtraFields, [tableId]: [...current, fieldKey] };
			try { localStorage.setItem('compExtraFields_' + tableId, JSON.stringify(compExtraFields[tableId])); } catch {}
		}
		compDropdownOpen = { ...compDropdownOpen, [tableId]: false };
	}

	function removeCompField(tableId, fieldKey) {
		const current = (compExtraFields[tableId] || []).filter(k => k !== fieldKey);
		compExtraFields = { ...compExtraFields, [tableId]: current };
		try { localStorage.setItem('compExtraFields_' + tableId, JSON.stringify(current)); } catch {}
	}

	function loadSavedCompFields(tableId) {
		if (compExtraFields[tableId]) return compExtraFields[tableId];
		try {
			const saved = JSON.parse(localStorage.getItem('compExtraFields_' + tableId) || '[]');
			compExtraFields = { ...compExtraFields, [tableId]: saved };
			return saved;
		} catch { return []; }
	}

	function dealCompleteness(d) {
		let filled = 0;
		if (getDealName(d) && getDealName(d) !== 'Untitled Deal') filled++;
		if (getDealAssetClass(d)) filled++;
		if (hasDealType(d)) filled++;
		if (hasTargetIRR(d) || hasPrefReturn(d)) filled++;
		if (hasMinInvestment(d)) filled++;
		if (hasPPM(d)) filled++;
		if (hasDeck(d)) filled++;
		if (hasStrategy(d)) filled++;
		if (hasOfferingType(d)) filled++;
		if (hasDistributions(d)) filled++;
		return Math.round((filled / 10) * 100);
	}

	// ===== Derived State =====
	const gpUserType = $derived(gpIsAdmin ? 'Platform Admin' : ($user?.gp_type || $user?.gpType || 'General Partner'));
	const gpUserName = $derived($user?.name || ($user?.email ? $user.email.split('@')[0] : ''));

	const assetClassTags = $derived.by(() => {
		const classes = {};
		deals.forEach(d => {
			const ac = getDealAssetClass(d);
			if (ac) classes[ac] = true;
		});
		return Object.keys(classes);
	});

	const actionItems = $derived.by(() => {
		const items = [];
		deals.forEach(d => {
			const name = getDealName(d);
			const id = getDealId(d);
			if (!hasPPM(d)) {
				items.push({ urgency: 'red', icon: 'red', name, desc: 'Missing PPM document', btnLabel: 'Upload PPM', action: () => uploadDealDoc(id, 'ppm') });
			}
			if (!hasDeck(d)) {
				items.push({ urgency: 'orange', icon: 'orange', name, desc: 'Missing investor deck', btnLabel: 'Upload Deck', action: () => uploadDealDoc(id, 'deck') });
			}
			if (!hasStrategy(d)) {
				items.push({ urgency: 'yellow', icon: 'yellow', name, desc: 'No investment strategy description', href: `/deal/${id}`, btnLabel: 'Add Description' });
			}
			if (!hasTargetIRR(d) && !hasPrefReturn(d)) {
				items.push({ urgency: 'yellow', icon: 'yellow', name, desc: 'Missing key terms (IRR / Pref Return)', href: `/deal/${id}`, btnLabel: 'Complete Terms' });
			}
		});
		const urgencyOrder = { red: 0, orange: 1, yellow: 2 };
		items.sort((a, b) => (urgencyOrder[a.urgency] || 9) - (urgencyOrder[b.urgency] || 9));
		return items.slice(0, 10);
	});

	const sortedDeals = $derived.by(() => {
		const enriched = deals.map(d => ({
			raw: d,
			name: getDealName(d),
			status: getDealStatus(d),
			assetClass: getDealAssetClass(d),
			completeness: dealCompleteness(d),
			ppm: hasPPM(d),
			deck: hasDeck(d),
			id: getDealId(d),
			gpReviewedAt: d.gp_reviewed_at
		}));
		enriched.sort((a, b) => {
			let va = a[sortCol];
			let vb = b[sortCol];
			if (typeof va === 'boolean') { va = va ? 1 : 0; vb = vb ? 1 : 0; }
			if (typeof va === 'string') { va = va.toLowerCase(); vb = (vb || '').toLowerCase(); }
			if (va < vb) return sortAsc ? -1 : 1;
			if (va > vb) return sortAsc ? 1 : -1;
			return 0;
		});
		return enriched;
	});

	// Activity feed items
	const activityItems = $derived.by(() => {
		const recent = analytics.recentActivity || [];
		const dealNameMap = {};
		deals.forEach(d => { dealNameMap[getDealId(d)] = getDealName(d); });

		return recent.map(item => {
			const dealName = dealNameMap[item.deal_id] || 'Unknown Deal';
			const timeAgo = relativeTime(item.updated_at);
			const tier = item.intent_tier || 'browsing';
			let tierLabel = 'Browsing', tierEmoji = '\uD83D\uDC40', tierClass = 'intent-browsing';
			if (tier === 'high') { tierLabel = 'High Intent'; tierEmoji = '\uD83D\uDD25'; tierClass = 'intent-high'; }
			else if (tier === 'engaged') { tierLabel = 'Engaged'; tierEmoji = '\u2B50'; tierClass = 'intent-engaged'; }

			const stage = item.stage;
			const stageLabel = (stage === 'saved' || stage === 'interested') ? 'Started review' :
				(stage === 'diligence') ? 'Ready to connect' :
				(stage === 'invested' || stage === 'portfolio') ? 'Invested' : stage;

			const signalParts = [stageLabel];
			if (item.capital_range) signalParts.push('LP with ' + item.capital_range + ' to deploy');

			return { dealName, timeAgo, tierLabel, tierEmoji, tierClass, signalParts };
		});
	});

	const hasActivity = $derived((analytics.totalSaves || 0) + (analytics.totalVetting || 0) + (analytics.totalInvested || 0) > 0);

	// Weekly chart data
	const weeklyChartData = $derived.by(() => {
		const weeks = analytics.weeklyActivity || [];
		const hasAny = weeks.some(w => (w.interested || 0) + (w.duediligence || 0) + (w.portfolio || 0) > 0);
		if (weeks.length === 0 || !hasAny) return null;
		let maxTotal = 1;
		weeks.forEach(w => {
			const t = (w.interested || 0) + (w.duediligence || 0) + (w.portfolio || 0);
			if (t > maxTotal) maxTotal = t;
		});
		const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
		return weeks.map(w => {
			const d = new Date(w.week + 'T00:00:00');
			const label = monthNames[d.getMonth()] + ' ' + d.getDate();
			const intCount = w.interested || 0;
			const ddCount = w.duediligence || 0;
			const portCount = w.portfolio || 0;
			const maxH = 120;
			return {
				label,
				intCount, ddCount, portCount,
				intH: intCount > 0 ? Math.max(intCount / maxTotal * maxH, 3) : 0,
				ddH: ddCount > 0 ? Math.max(ddCount / maxTotal * maxH, 3) : 0,
				portH: portCount > 0 ? Math.max(portCount / maxTotal * maxH, 3) : 0
			};
		});
	});

	// Webinar CTA
	const webinarCtaStat = $derived.by(() => {
		const gpAssetClasses = {};
		deals.forEach(d => { const ac = d.assetClass || d.asset_class || ''; if (ac) gpAssetClasses[ac] = (gpAssetClasses[ac] || 0) + 1; });
		let primaryAC = '', maxCount = 0;
		Object.keys(gpAssetClasses).forEach(ac => { if (gpAssetClasses[ac] > maxCount) { maxCount = gpAssetClasses[ac]; primaryAC = ac; } });
		const totalInterest = (analytics.totalSaves || 0) + (analytics.totalVetting || 0) + (analytics.totalInvested || 0);
		const activeDeals = (allDeals || []).filter(d => { const s = (d.status || '').toLowerCase(); return s !== 'closed' && s !== 'fully funded' && s !== 'completed'; });
		if (primaryAC && activeDeals.length > 0) {
			const acDeals = activeDeals.filter(d => (d.assetClass || d.asset_class || '') === primaryAC).length;
			return acDeals + ' investors are currently browsing ' + primaryAC + ' deals';
		}
		if (totalInterest > 0) return totalInterest + ' investors have engaged with deals on the platform';
		return 'Hundreds of accredited investors are actively reviewing deals';
	});

	const webinarCtaDesc = $derived.by(() => {
		const items = actionItems;
		if (items.length > 0) return 'Complete your deal profile first, then amplify your reach by pitching directly to our investor network.';
		return 'Your deals are getting attention. Take it further \u2014 pitch directly to our investor network in a live webinar.';
	});

	// ===== Competitive Analysis Derived Data =====
	const activeDeals = $derived((allDeals || []).filter(d => {
		const s = (d.status || '').toLowerCase();
		return s !== 'closed' && s !== 'fully funded' && s !== 'completed';
	}));

	const competitiveData = $derived.by(() => {
		if (deals.length === 0 || activeDeals.length < 3) return [];
		const prefDists = investorInsights?.preferredDistributions || [];
		let monthlyDistPct = 0;
		for (const pd of prefDists) {
			if ((pd.name || '').toLowerCase().includes('month')) { monthlyDistPct = pd.pct; break; }
		}

		return deals.map(deal => {
			const name = getDealName(deal);
			const ac = getDealAssetClass(deal);
			if (!ac) return null;

			const myId = getDealId(deal);
			const peers = activeDeals.filter(d => {
				const dAc = d.assetClass || d.asset_class || '';
				const dId = d.id || d.airtable_id || '';
				return dAc === ac && dId !== myId;
			});
			if (peers.length === 0) return null;

			const sorted = [...peers].sort((a, b) => (getDealPref(b) || 0) - (getDealPref(a) || 0));
			const top3 = sorted.slice(0, 3);
			const tableId = 'comp-table-' + (myId || '').replace(/[^a-zA-Z0-9]/g, '');

			const myPref = getDealPref(deal);
			const myMin = getDealMin(deal);
			const myDist = getDealDist(deal);
			const myIRR = getDealIRR(deal);

			const compPrefs = top3.map(d => getDealPref(d));
			const compMins = top3.map(d => getDealMin(d));
			const compDists = top3.map(d => getDealDist(d));

			// Insights
			const insights = [];
			const validCompPrefs = compPrefs.filter(v => v != null);
			if (myPref != null && validCompPrefs.length > 0) {
				const avgCompPref = validCompPrefs.reduce((a, b) => a + b, 0) / validCompPrefs.length;
				if (myPref < avgCompPref) {
					insights.push({ type: 'bad', text: `Your preferred return (${formatPctDisplay(myPref)}) is below the top ${validCompPrefs.length} competitors (avg ${formatPctDisplay(avgCompPref)}). Consider increasing to attract more LP interest.` });
				} else {
					insights.push({ type: 'good', text: `Your preferred return (${formatPctDisplay(myPref)}) is competitive with the top ${validCompPrefs.length} deals (avg ${formatPctDisplay(avgCompPref)}).` });
				}
			}
			const validCompMins = compMins.filter(v => v != null);
			if (myMin != null && validCompMins.length > 0) {
				const lowerCount = validCompMins.filter(v => v < myMin).length;
				if (lowerCount > 0) {
					insights.push({ type: 'bad', text: `Your minimum ($${Number(myMin).toLocaleString()}) is higher than ${lowerCount} of the top ${validCompMins.length} competitors. A lower entry point could increase deal flow.` });
				} else {
					insights.push({ type: 'good', text: `Your minimum ($${Number(myMin).toLocaleString()}) is at or below competitors.` });
				}
			}
			if (myDist && monthlyDistPct > 30) {
				const isMonthly = (myDist || '').toLowerCase().includes('month');
				if (!isMonthly) {
					insights.push({ type: 'bad', text: `Monthly distributions are preferred by ${monthlyDistPct}% of LPs — your ${myDist.toLowerCase()} schedule may reduce appeal.` });
				} else {
					insights.push({ type: 'good', text: `Your monthly distribution schedule aligns with what ${monthlyDistPct}% of LPs prefer.` });
				}
			}

			return { deal, name, ac, top3, tableId, myPref, myMin, myDist, myIRR, insights };
		}).filter(Boolean);
	});

	// ===== Market Intelligence Derived Data =====
	const marketIntelData = $derived.by(() => {
		const cards = [];
		const gpDeals = deals;

		// Card 1: Competitive Position
		if (gpDeals.length > 0 && activeDeals.length >= 3) {
			const prefReturns = activeDeals
				.map(d => getDealPref(d))
				.filter(v => v != null && !isNaN(v))
				.sort((a, b) => a - b);

			let bestDeal = null, bestPct = -1;
			for (const d of gpDeals) {
				const pref = getDealPref(d);
				if (pref != null && prefReturns.length >= 3) {
					const pct = computePercentile(prefReturns, pref);
					if (pct > bestPct) { bestPct = pct; bestDeal = d; }
				}
			}
			if (bestDeal) {
				const posColor = bestPct >= 75 ? 'var(--green)' : bestPct >= 40 ? 'var(--yellow)' : 'var(--red)';
				const posLabel = bestPct >= 75 ? 'Top quartile' : bestPct >= 50 ? 'Above average' : bestPct >= 25 ? 'Below average' : 'Bottom quartile';
				const posAdvice = bestPct >= 75 ? 'Your pref return is highly competitive. Highlight this in your deck.' : bestPct >= 50 ? 'Solid positioning. Consider emphasizing track record to stand out.' : 'Consider increasing your pref return or lowering your minimum to attract more LPs.';
				cards.push({ key: 'position', icon: 'bar-chart', color: posColor, title: 'Competitive Position', value: posLabel, desc: posAdvice });
			}
		}

		// Card 2: LP Demand
		const totalActivity = (analytics.totalSaves || 0) + (analytics.totalVetting || 0) + (analytics.totalInvested || 0);
		const saves = analytics.totalSaves || 0;
		const vetting = analytics.totalVetting || 0;
		const invested = analytics.totalInvested || 0;
		const demandLevel = totalActivity >= 20 ? 'High' : totalActivity >= 5 ? 'Growing' : totalActivity > 0 ? 'Early' : 'No activity yet';
		const demandColor = totalActivity >= 20 ? 'var(--green)' : totalActivity >= 5 ? '#2563EB' : totalActivity > 0 ? 'var(--yellow)' : 'var(--text-muted)';
		const demandAdvice = totalActivity >= 20 ? `${saves} saves, ${vetting} vetting, ${invested} invested. Strong interest — follow up with active LPs.` :
			totalActivity >= 5 ? `${saves} saves, ${vetting} vetting. Momentum building — consider a webinar to convert interest.` :
			totalActivity > 0 ? 'A few LPs are watching. Complete your deal profile and add your deck to increase visibility.' :
			'No LP activity yet. Make sure your deals have complete profiles, decks, and competitive terms.';
		cards.push({ key: 'demand', icon: 'users', color: demandColor, title: 'LP Demand', value: demandLevel, desc: demandAdvice });

		// Card 3: Market Share
		const gpAssetClasses = {};
		gpDeals.forEach(d => { const ac = getDealAssetClass(d); if (ac) gpAssetClasses[ac] = (gpAssetClasses[ac] || 0) + 1; });
		const acKeys = Object.keys(gpAssetClasses);
		if (acKeys.length > 0 && activeDeals.length > 0) {
			let totalInClass = 0, gpInClass = 0;
			acKeys.forEach(ac => {
				activeDeals.forEach(d => { if ((d.assetClass || d.asset_class) === ac) totalInClass++; });
				gpInClass += gpAssetClasses[ac];
			});
			const sharePct = totalInClass > 0 ? Math.round((gpInClass / totalInClass) * 100) : 0;
			const shareAdvice = sharePct >= 10 ? 'You have strong representation in your asset classes.' : 'Adding more deals in your asset class could increase your visibility to targeted LPs.';
			cards.push({ key: 'share', icon: 'globe', color: '#2563EB', title: 'Market Share', value: `${gpInClass} of ${totalInClass} deals`, desc: shareAdvice });
		}

		// Card 4: Investor Preferences
		if (investorInsights?.topAssetClasses?.length > 0) {
			const topAC = investorInsights.topAssetClasses[0];
			const gpMatch = investorInsights.topAssetClasses.find(a => a.isGP);
			const matchAdvice = gpMatch ? `Your ${gpMatch.name} deals align with ${gpMatch.pct}% of investor interest.` : `Most investors prefer ${topAC.name} (${topAC.pct}%). Consider if your strategy aligns.`;
			cards.push({ key: 'prefs', icon: 'message', color: '#8B5CF6', title: 'Investor Preferences', value: `${topAC.name} — ${topAC.pct}%`, desc: matchAdvice,
				barData: investorInsights.topAssetClasses.slice(0, 4) });
		}

		return cards;
	});

	// ===== Toast =====
	function showToast(message) {
		toastMsg = message;
		toastVisible = true;
		setTimeout(() => { toastVisible = false; }, 3000);
	}

	// ===== Column Sort =====
	function handleSort(col) {
		if (sortCol === col) { sortAsc = !sortAsc; }
		else { sortCol = col; sortAsc = true; }
	}

	// ===== Upload =====
	function uploadDealDoc(dealId, docType) {
		const accept = docType === 'ppm' ? '.pdf' : '.pdf,.pptx,.ppt,.key';
		const label = docType === 'ppm' ? 'PPM' : 'Deck';
		const input = document.createElement('input');
		input.type = 'file';
		input.accept = accept;
		input.onchange = () => {
			if (!input.files?.[0]) return;
			const file = input.files[0];
			const dealMatch = deals.find(d => d.id === dealId);
			const dealName = dealMatch ? (dealMatch.investmentName || dealMatch.investment_name || '') : '';
			showToast('Uploading ' + file.name + '...');
			const reader = new FileReader();
			reader.onload = () => {
				const base64 = reader.result.split(',')[1];
				const headers = { 'Content-Type': 'application/json' };
				if ($userToken) headers['Authorization'] = 'Bearer ' + $userToken;
				fetch('/api/deck-upload', {
					method: 'POST', headers,
					body: JSON.stringify({ dealId, dealName, filedata: base64, filename: file.name, docType, companyId: companyId || '', userEmail: $userEmail || '', userName: gpUserName || '' })
				})
				.then(resp => { if (!resp.ok) return resp.json().then(b => { throw new Error(b.error || 'Upload failed'); }); return resp.json(); })
				.then(() => { showToast(label + ' uploaded successfully!'); loadData(); })
				.catch(e => { console.warn(label + ' upload failed:', e.message); showToast('Upload failed. Please try again later.'); });
			};
			reader.readAsDataURL(file);
		};
		input.click();
	}

	// ===== Settings: Save Calendar URL =====
	async function saveCalendarUrl() {
		calendarSaving = true;
		calendarStatus = '';
		const headers = { 'Content-Type': 'application/json' };
		if ($userToken) headers['Authorization'] = 'Bearer ' + $userToken;

		if (!companyId) {
			try { const s = JSON.parse(localStorage.getItem('gycGPSettings') || '{}'); s.calendarUrl = calendarUrl; localStorage.setItem('gycGPSettings', JSON.stringify(s)); } catch {}
			calendarSaving = false;
			calendarStatus = 'Saved locally.';
			calendarStatusColor = 'var(--green)';
			showToast('Calendar URL saved');
			return;
		}
		try {
			const resp = await fetch(`/api/management-companies/${encodeURIComponent(companyId)}/settings`, { method: 'PATCH', headers, body: JSON.stringify({ calendar_url: calendarUrl }) });
			if (!resp.ok) throw new Error('Failed to save');
			await resp.json();
			calendarStatus = 'Saved successfully.';
			calendarStatusColor = 'var(--green)';
			showToast('Calendar URL saved');
		} catch (e) {
			try { const s = JSON.parse(localStorage.getItem('gycGPSettings') || '{}'); s.calendarUrl = calendarUrl; localStorage.setItem('gycGPSettings', JSON.stringify(s)); } catch {}
			calendarStatus = 'Saved locally (API unavailable).';
			calendarStatusColor = 'var(--orange)';
			showToast('Calendar URL saved locally');
		} finally {
			calendarSaving = false;
		}
	}

	// ===== Settings: Save IR Contact =====
	async function saveIRContact() {
		if (irContactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(irContactEmail)) {
			irStatus = 'Please enter a valid email address.';
			irStatusColor = 'var(--red)';
			return;
		}
		irSaving = true;
		irStatus = '';
		const headers = { 'Content-Type': 'application/json' };
		if ($userToken) headers['Authorization'] = 'Bearer ' + $userToken;

		if (!companyId) {
			try { const s = JSON.parse(localStorage.getItem('gycGPSettings') || '{}'); s.irContactName = irContactName; s.irContactEmail = irContactEmail; localStorage.setItem('gycGPSettings', JSON.stringify(s)); } catch {}
			irSaving = false;
			irStatus = 'Saved locally.';
			irStatusColor = 'var(--green)';
			showToast('IR contact saved');
			return;
		}
		try {
			const resp = await fetch(`/api/management-companies/${encodeURIComponent(companyId)}/settings`, { method: 'PATCH', headers, body: JSON.stringify({ ir_contact_name: irContactName, ir_contact_email: irContactEmail }) });
			if (!resp.ok) throw new Error('Failed to save');
			await resp.json();
			irStatus = 'Saved successfully.';
			irStatusColor = 'var(--green)';
			showToast('IR contact saved');
		} catch (e) {
			try { const s = JSON.parse(localStorage.getItem('gycGPSettings') || '{}'); s.irContactName = irContactName; s.irContactEmail = irContactEmail; localStorage.setItem('gycGPSettings', JSON.stringify(s)); } catch {}
			irStatus = 'Saved locally (API unavailable).';
			irStatusColor = 'var(--orange)';
			showToast('IR contact saved locally');
		} finally {
			irSaving = false;
		}
	}

	// ===== Settings: Emails =====
	function addEmail() {
		const email = newEmailInput.trim().toLowerCase();
		emailStatus = '';
		if (!email || !email.includes('@')) { emailStatus = 'Please enter a valid email address.'; emailStatusColor = 'var(--red)'; return; }
		if (authorizedEmails.some(e => e.toLowerCase() === email)) { emailStatus = 'This email is already authorized.'; emailStatusColor = 'var(--orange)'; return; }
		authorizedEmails = [...authorizedEmails, email];
		newEmailInput = '';
		saveAuthorizedEmails('Email added.');
	}

	function removeEmail(email) {
		authorizedEmails = authorizedEmails.filter(e => e.toLowerCase() !== email.toLowerCase());
		saveAuthorizedEmails('Email removed.');
	}

	async function saveAuthorizedEmails(successMsg) {
		const headers = { 'Content-Type': 'application/json' };
		if ($userToken) headers['Authorization'] = 'Bearer ' + $userToken;
		if (!companyId) {
			try { const s = JSON.parse(localStorage.getItem('gycGPSettings') || '{}'); s.authorizedEmails = authorizedEmails; localStorage.setItem('gycGPSettings', JSON.stringify(s)); } catch {}
			emailStatus = (successMsg || 'Saved') + ' (stored locally)';
			emailStatusColor = 'var(--green)';
			showToast(successMsg || 'Saved');
			return;
		}
		try {
			const resp = await fetch(`/api/management-companies/${encodeURIComponent(companyId)}/settings`, { method: 'PATCH', headers, body: JSON.stringify({ authorized_emails: authorizedEmails }) });
			if (!resp.ok) throw new Error('Failed');
			await resp.json();
			emailStatus = successMsg || 'Saved successfully.';
			emailStatusColor = 'var(--green)';
			showToast(successMsg || 'Saved');
		} catch (e) {
			try { const s = JSON.parse(localStorage.getItem('gycGPSettings') || '{}'); s.authorizedEmails = authorizedEmails; localStorage.setItem('gycGPSettings', JSON.stringify(s)); } catch {}
			emailStatus = (successMsg || 'Saved') + ' (API unavailable, stored locally)';
			emailStatusColor = 'var(--orange)';
			showToast(successMsg || 'Saved locally');
		}
	}

	// ===== GP Access Check =====
	function checkGPAccess() {
		const u = $user;
		if (!u) return false;
		if (u.isAdmin || (u.email && ADMIN_EMAILS.includes(u.email.toLowerCase()))) {
			companyId = u.management_company_id || u.managementCompanyId || '8971cd85-60d8-41b5-abc0-c878d5f92cb3';
			companyName = u.management_company_name || u.managementCompanyName || u.company || 'Grow Your Cashflow';
			gpIsAdmin = true;
			return true;
		}
		if (u.gp_type || u.gpType || u.is_gp) {
			companyId = u.management_company_id || u.managementCompanyId || null;
			companyName = u.management_company_name || u.managementCompanyName || u.company || '';
			return true;
		}
		if (u.management_company_id || u.managementCompanyId) {
			companyId = u.management_company_id || u.managementCompanyId;
			companyName = u.management_company_name || u.managementCompanyName || u.company || '';
			return true;
		}
		return false;
	}

	// ===== API Fetchers =====
	function authHeaders() {
		const h = { 'Content-Type': 'application/json' };
		if ($userToken) h['Authorization'] = 'Bearer ' + $userToken;
		return h;
	}

	async function fetchGPDeals() {
		try {
			const resp = await fetch('/api/deals', { headers: authHeaders() });
			if (!resp.ok) throw new Error('API returned ' + resp.status);
			const data = await resp.json();
			let list = data.deals || data.records || data || [];
			if (!Array.isArray(list)) return [];
			if (companyId) {
				return list.filter(d => d.managementCompanyId === companyId || (d.sponsors?.some(s => s.id === companyId)));
			}
			if (companyName) {
				const cn = companyName.toLowerCase();
				return list.filter(d => { const mc = (d.managementCompany || '').toLowerCase(); return mc === cn || mc.includes(cn) || cn.includes(mc); });
			}
			return list;
		} catch (e) { console.warn('Deals API unavailable:', e.message); return []; }
	}

	async function fetchGPSettings() {
		if (!companyId) return {};
		try {
			const resp = await fetch(`/api/management-companies/${encodeURIComponent(companyId)}/settings`, { headers: authHeaders() });
			if (!resp.ok) throw new Error('API returned ' + resp.status);
			return await resp.json();
		} catch (e) { console.warn('GP settings API unavailable:', e.message); return {}; }
	}

	async function fetchGPAnalytics() {
		if (!companyId) return { totalSaves: 0, totalVetting: 0, totalInvested: 0, recentActivity: [], weeklyActivity: [], highIntentCount: 0 };
		try {
			const resp = await fetch(`/api/gp-analytics?companyId=${encodeURIComponent(companyId)}`, { headers: authHeaders() });
			if (!resp.ok) throw new Error('API returned ' + resp.status);
			return await resp.json();
		} catch (e) { console.warn('GP analytics API unavailable:', e.message); return { totalSaves: 0, totalVetting: 0, totalInvested: 0, recentActivity: [], weeklyActivity: [], highIntentCount: 0 }; }
	}

	async function fetchAllDeals() {
		try {
			const resp = await fetch('/api/deals', { headers: authHeaders() });
			if (!resp.ok) throw new Error('API returned ' + resp.status);
			const data = await resp.json();
			return data.deals || data.records || data || [];
		} catch (e) { console.warn('Could not fetch all deals:', e.message); return []; }
	}

	async function fetchInvestorInsights() {
		if (!companyId) return {};
		try {
			const resp = await fetch(`/api/gp-investor-insights?companyId=${encodeURIComponent(companyId)}`, { headers: authHeaders() });
			if (!resp.ok) throw new Error('API returned ' + resp.status);
			return await resp.json();
		} catch (e) { console.warn('Investor insights API unavailable:', e.message); return {}; }
	}

	// ===== Main Data Loader =====
	async function loadData() {
		const [gpDeals, settings, analData, allDealData, insights] = await Promise.all([
			fetchGPDeals(), fetchGPSettings(), fetchGPAnalytics(), fetchAllDeals(), fetchInvestorInsights()
		]);

		// Merge local settings fallback
		let localSettings = {};
		try { localSettings = JSON.parse(localStorage.getItem('gycGPSettings') || '{}'); } catch {}

		const settingsObj = settings || {};
		deals = gpDeals;
		allDeals = allDealData;
		analytics = analData || { totalSaves: 0, totalVetting: 0, totalInvested: 0, recentActivity: [], weeklyActivity: [], highIntentCount: 0 };
		investorInsights = insights || {};

		calendarUrl = settingsObj.calendar_url || settingsObj.calendarUrl || localSettings.calendarUrl || '';
		irContactName = settingsObj.ir_contact_name || settingsObj.irContactName || '';
		irContactEmail = settingsObj.ir_contact_email || settingsObj.irContactEmail || '';
		const emails = settingsObj.authorized_emails || settingsObj.authorizedEmails || localSettings.authorizedEmails || [];
		authorizedEmails = emails.length > 0 ? emails : ($user?.email ? [$user.email] : []);

		loading = false;
	}

	// ===== Chart.js for Weekly Activity =====
	async function loadGPChartJs() {
		if (gpChartJsLoaded) return;
		const { Chart, BarController, BarElement, CategoryScale, LinearScale, Tooltip, Legend } = await import('chart.js');
		Chart.register(BarController, BarElement, CategoryScale, LinearScale, Tooltip, Legend);
		gpChartJsLoaded = true;
	}

	function renderWeeklyChartJs() {
		if (!weeklyChartEl || !gpChartJsLoaded) return;
		const data = weeklyChartData;
		if (!data) return;

		if (weeklyChartInstance) weeklyChartInstance.destroy();

		import('chart.js').then(({ Chart: C }) => {
			weeklyChartInstance = new C(weeklyChartEl, {
				type: 'bar',
				data: {
					labels: data.map(w => w.label),
					datasets: [
						{
							label: 'In Review',
							data: data.map(w => w.intCount),
							backgroundColor: '#27ae60',
							borderRadius: 2,
							maxBarThickness: 28
						},
						{
							label: 'Connecting',
							data: data.map(w => w.ddCount),
							backgroundColor: '#2563eb',
							borderRadius: 2,
							maxBarThickness: 28
						},
						{
							label: 'Invested',
							data: data.map(w => w.portCount),
							backgroundColor: '#1a2332',
							borderRadius: 2,
							maxBarThickness: 28
						}
					]
				},
				options: {
					responsive: true,
					maintainAspectRatio: false,
					plugins: {
						legend: {
							display: false,
							position: 'top',
							labels: {
								boxWidth: 10,
								boxHeight: 10,
								padding: 16,
								font: { size: 11, weight: '600' }
							}
						},
						tooltip: {
							mode: 'index',
							intersect: false
						}
					},
					scales: {
						x: {
							stacked: true,
							ticks: { font: { size: 11 } },
							grid: { display: false }
						},
						y: {
							stacked: true,
							beginAtZero: true,
							ticks: {
								stepSize: 1,
								font: { size: 11 }
							},
							grid: { color: 'rgba(0,0,0,0.05)' }
						}
					}
				}
			});
		});
	}

	// Re-render chart when analytics data changes
	$effect(() => {
		const _data = weeklyChartData;
		if (gpChartJsLoaded && browser && weeklyChartEl) {
			renderWeeklyChartJs();
		}
	});

	// ===== Init =====
	onMount(async () => {
		if (!$isLoggedIn) {
			goto('/login?return=/gp-dashboard');
			return;
		}
		if (!checkGPAccess()) {
			loading = false;
			accessDenied = true;
			return;
		}
		loadData();
		// Load Chart.js dynamically (SSR-safe)
		await loadGPChartJs();
	});

	async function refreshData() {
		refreshing = true;
		await loadData();
		refreshing = false;
		showToast('Dashboard data refreshed');
	}

	function toggleSidebar() { sidebarOpen = !sidebarOpen; }
	function closeSidebar() { sidebarOpen = false; }

	// Completeness bar color
	function pctClass(val) {
		return val < 40 ? 'pct-low' : val < 70 ? 'pct-mid' : 'pct-high';
	}
</script>

<svelte:head>
	<title>GP Dashboard - GYC Dealflow</title>
</svelte:head>

<Sidebar currentPage="gpdashboard" />

<!-- Mobile top bar -->
<div class="mobile-topbar">
	<button class="mobile-menu-btn" aria-label="Open navigation menu" onclick={toggleSidebar}>
		<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
	</button>
	<div class="mobile-topbar-title">GP Dashboard</div>
</div>

{#if sidebarOpen}
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div class="sidebar-overlay open" onclick={closeSidebar}></div>
{/if}

<div class="main">
	<div class="content-wrap">

		{#if accessDenied}
			<!-- Access Denied -->
			<div class="access-denied">
				<div class="access-denied-icon">
					<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
				</div>
				<h2>GP Access Required</h2>
				<p>This dashboard is for General Partners who list deals on our platform. If you're a sponsor or operator, get started below.</p>
				<div style="display:flex;flex-direction:column;gap:12px;align-items:center;">
					<a href="/gp-onboarding?resumeStep=2" class="btn-back-home">Apply as a GP</a>
					<a href="/app/dashboard" style="font-family:var(--font-ui);font-size:13px;color:var(--text-muted);text-decoration:none;">Back to Dashboard</a>
				</div>
			</div>
		{:else if loading}
			<!-- Loading Skeleton -->
			<div class="skeleton skeleton-header"></div>
			<div class="skeleton skeleton-stats"></div>
			<div class="skeleton skeleton-card"></div>
			<div class="skeleton skeleton-card"></div>
		{:else}
			<!-- GP Header -->
			<div class="gp-header">
				<div class="gp-header-inner">
					<div class="gp-header-avatar">{getInitials(companyName || 'GP')}</div>
					<div class="gp-header-info">
						<h1 class="gp-header-company">{companyName || 'Your Company'}</h1>
						<p class="gp-header-meta"><strong>{gpUserName}</strong> &middot; {gpUserType}</p>
						<p class="gp-header-subtitle">Manage your deals and track investor interest</p>
						<div class="gp-header-tags">
							{#each assetClassTags as ac}
								<span class="gp-tag">{ac}</span>
							{/each}
							<span class="gp-tag type-tag">GP Portal</span>
						</div>
					</div>
					<button class="btn-refresh" onclick={refreshData} disabled={refreshing} title="Refresh dashboard data">
						<svg class:spinning={refreshing} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
						{refreshing ? 'Refreshing...' : 'Refresh'}
					</button>
				</div>
			</div>

			<!-- 1. Action Items -->
			<div class="section-card">
				<div class="section-header">
					<div class="section-title">Action Items</div>
					<span class="section-badge">{actionItems.length}</span>
				</div>
				<div class="section-body">
					{#if actionItems.length === 0}
						<div class="empty-inline"><p>All deals look good! No action items at this time.</p></div>
					{:else}
						{#each actionItems as item}
							<div class="action-item urgency-{item.urgency}">
								<div class="action-item-icon icon-{item.icon}">
									{#if item.urgency === 'red' || item.urgency === 'orange'}
										<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
									{:else}
										<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
									{/if}
								</div>
								<div class="action-item-info">
									<div class="action-item-name">{item.name}</div>
									<div class="action-item-desc">{item.desc}</div>
								</div>
								{#if item.href}
									<a href={item.href} class="action-item-btn">{item.btnLabel}</a>
								{:else}
									<button class="action-item-btn" onclick={item.action}>{item.btnLabel}</button>
								{/if}
							</div>
						{/each}
					{/if}
				</div>
			</div>

			<!-- 2. Deal Health Table -->
			<div class="section-card">
				<div class="section-header">
					<div class="section-title">Deal Health</div>
					<span class="section-badge">{deals.length}</span>
				</div>
				<div class="section-body" style="padding-bottom:16px;">
					{#if deals.length === 0}
						<div class="empty-inline"><p>No deals found. Your deals will appear here once they are added to the platform.</p></div>
					{:else}
						<div class="health-table-wrap">
							<table class="health-table">
								<thead>
									<tr>
										<th class:sorted={sortCol === 'name'} onclick={() => handleSort('name')}>Deal Name <span class="sort-arrow">{sortCol === 'name' ? (sortAsc ? '\u25B2' : '\u25BC') : '\u25B2'}</span></th>
										<th class:sorted={sortCol === 'status'} onclick={() => handleSort('status')}>Status <span class="sort-arrow">{sortCol === 'status' ? (sortAsc ? '\u25B2' : '\u25BC') : '\u25B2'}</span></th>
										<th class:sorted={sortCol === 'assetClass'} onclick={() => handleSort('assetClass')}>Asset Class <span class="sort-arrow">{sortCol === 'assetClass' ? (sortAsc ? '\u25B2' : '\u25BC') : '\u25B2'}</span></th>
										<th class:sorted={sortCol === 'completeness'} onclick={() => handleSort('completeness')}>Completeness <span class="sort-arrow">{sortCol === 'completeness' ? (sortAsc ? '\u25B2' : '\u25BC') : '\u25B2'}</span></th>
										<th class:sorted={sortCol === 'ppm'} onclick={() => handleSort('ppm')}>PPM <span class="sort-arrow">{sortCol === 'ppm' ? (sortAsc ? '\u25B2' : '\u25BC') : '\u25B2'}</span></th>
										<th class:sorted={sortCol === 'deck'} onclick={() => handleSort('deck')}>Deck <span class="sort-arrow">{sortCol === 'deck' ? (sortAsc ? '\u25B2' : '\u25BC') : '\u25B2'}</span></th>
										<th style="text-align:center;width:70px;"></th>
									</tr>
								</thead>
								<tbody>
									{#each sortedDeals as d}
										<tr>
											<td><a href="/deal/{d.id}" class="health-table-name">{d.name}</a></td>
											<td>
												{#if d.status}
													<span class="deal-badge {statusBadgeClass(d.status)}">{d.status}</span>
												{:else}
													<span style="color:var(--text-muted)">--</span>
												{/if}
											</td>
											<td>{d.assetClass || '--'}</td>
											<td>
												<div class="progress-bar-wrap">
													<div class="progress-bar"><div class="progress-bar-fill {pctClass(d.completeness)}" style="width:{d.completeness}%"></div></div>
													<span class="progress-pct">{d.completeness}%</span>
												</div>
											</td>
											<td style="text-align:center;">
												{#if d.ppm}
													<span class="check-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg></span>
												{:else}
													<span class="x-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></span>
												{/if}
											</td>
											<td style="text-align:center;">
												{#if d.deck}
													<span class="check-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg></span>
												{:else}
													<span class="x-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></span>
												{/if}
											</td>
											<td style="text-align:center;">
												{#if d.gpReviewedAt}
													<a href="/deal-review?id={d.id}" style="font-size:13px;color:var(--text-muted);text-decoration:none;">Edit</a>
												{:else}
													<a href="/deal-review?id={d.id}" style="font-size:13px;color:var(--orange);font-weight:600;text-decoration:none;">Review</a>
												{/if}
											</td>
										</tr>
									{/each}
								</tbody>
							</table>
						</div>
					{/if}
				</div>
			</div>

			<!-- 3. Investor Activity + Webinar CTA -->
			<div class="dashboard-grid-3-2">
				<!-- LEFT: Investor Activity -->
				<div class="section-card">
					<div class="section-header">
						<div class="section-title">Investor Activity</div>
					</div>
					<div class="section-body">
						<div class="analytics-grid">
							<div class="analytics-metric">
								<div class="analytics-metric-value">{analytics.totalSaves || 0}</div>
								<div class="analytics-metric-label">In Review</div>
							</div>
							<div class="analytics-metric">
								<div class="analytics-metric-value">{analytics.totalVetting || 0}</div>
								<div class="analytics-metric-label">Connecting</div>
							</div>
							<div class="analytics-metric">
								<div class="analytics-metric-value">{analytics.totalInvested || 0}</div>
								<div class="analytics-metric-label">Invested</div>
							</div>
						</div>

						{#if !hasActivity}
							<div class="activity-empty-nudge">
								<p>Investor activity will appear here as LPs discover your deals. Complete your action items above to increase visibility.</p>
							</div>
						{/if}

						{#if hasActivity}
							<div class="weekly-chart-wrap">
								<div class="weekly-chart-title">Investor Activity Over Time</div>
								<div class="weekly-chart-legend">
									<span class="weekly-chart-legend-item"><span class="weekly-chart-legend-swatch" style="background:#27ae60;"></span>In Review</span>
									<span class="weekly-chart-legend-item"><span class="weekly-chart-legend-swatch" style="background:#2563eb;"></span>Connecting</span>
									<span class="weekly-chart-legend-item"><span class="weekly-chart-legend-swatch" style="background:#1a2332;"></span>Invested</span>
								</div>
								{#if weeklyChartData}
									<div class="weekly-chartjs-container">
										<canvas bind:this={weeklyChartEl}></canvas>
									</div>
								{:else}
									<div class="weekly-chart-empty">No activity yet. As investors discover your deals, you'll see their engagement here.</div>
								{/if}
							</div>

							{#if activityItems.length > 0}
								<div class="recent-activity-list">
									{#if analytics.highIntentCount > 0}
										<div class="high-intent-summary">
											{analytics.highIntentCount} high-intent LP{analytics.highIntentCount !== 1 ? 's' : ''} engaged with your deals this month
										</div>
									{/if}
									{#each activityItems as item}
										<div class="activity-card-item">
											<span class="intent-badge {item.tierClass}">{item.tierEmoji} {item.tierLabel}</span>
											<div class="activity-card-body">
												<div class="activity-card-deal">{item.dealName}</div>
												<div class="activity-card-signal">{item.signalParts.join(' \u00B7 ')}</div>
											</div>
											<span class="activity-card-time">{item.timeAgo}</span>
										</div>
									{/each}
								</div>
							{/if}
						{/if}
					</div>
				</div>

				<!-- RIGHT: Webinar CTA -->
				<div class="section-card webinar-cta-section">
					<div class="section-header">
						<div class="section-title">Get In Front of LPs</div>
					</div>
					<div class="section-body">
						<div class="webinar-cta-card">
							<div class="webinar-cta-title">Pitch to Our Investor Network</div>
							<div class="webinar-cta-stat">{webinarCtaStat}</div>
							<div class="webinar-cta-desc">{webinarCtaDesc}</div>
							<ul class="webinar-cta-features">
								<li>30-minute dedicated pitch slot</li>
								<li>Qualified accredited investor audience</li>
								<li>Recorded &amp; shared with all platform members</li>
								<li>Q&amp;A session with interested LPs</li>
							</ul>
							<a href="/book-pitch" class="webinar-cta-btn">Book Your Pitch &mdash; $1,000 &rarr;</a>
						</div>
					</div>
				</div>
			</div>

			<!-- 4. Competitive Analysis -->
			<div class="section-card">
				<div class="section-header">
					<div class="section-title">Competitive Analysis</div>
				</div>
				<div class="section-body">
					{#if deals.length === 0 || activeDeals.length < 3}
						<div class="empty-inline">
							<p>Not enough active deals to generate competitive analysis. At least 3 active deals are needed on the platform.</p>
						</div>
					{:else if competitiveData.length === 0}
						<div class="empty-inline">
							<p>Add asset class and financial details to your deals to see competitive analysis.</p>
						</div>
					{:else}
						{#each competitiveData as comp}
							{@const savedFields = loadSavedCompFields(comp.tableId)}
							{@const usedKeys = ['targetIRR', 'preferredReturn', 'investmentMinimum', 'distributions', ...savedFields]}
							{@const availableFields = extraFieldDefs.filter(f => !usedKeys.includes(f.key))}
							<div class="comp-deal-section">
								<div class="comp-deal-title">{comp.name} vs Top {comp.top3.length} {comp.ac} Deals</div>
								<div class="comp-table-wrap">
									<table class="comp-table">
										<thead>
											<tr>
												<th></th>
												<th class="col-gp"><a href="/deal/{getDealId(comp.deal)}">{comp.name}</a></th>
												{#each comp.top3 as peer}
													<th><a href="/deal/{getDealId(peer)}">{getDealName(peer)}</a></th>
												{/each}
											</tr>
										</thead>
										<tbody>
											<tr>
												<td class="comp-metric-label">Target IRR</td>
												<td class="col-gp">{comp.myIRR != null ? formatPctDisplay(comp.myIRR) : '--'}</td>
												{#each comp.top3 as peer}
													<td>{getDealIRR(peer) != null ? formatPctDisplay(getDealIRR(peer)) : '--'}</td>
												{/each}
											</tr>
											<tr>
												<td class="comp-metric-label">Pref Return</td>
												<td class="col-gp">{comp.myPref != null ? formatPctDisplay(comp.myPref) : '--'}</td>
												{#each comp.top3 as peer}
													<td>{getDealPref(peer) != null ? formatPctDisplay(getDealPref(peer)) : '--'}</td>
												{/each}
											</tr>
											<tr>
												<td class="comp-metric-label">Min Investment</td>
												<td class="col-gp">{comp.myMin != null ? '$' + Number(comp.myMin).toLocaleString() : '--'}</td>
												{#each comp.top3 as peer}
													{@const peerMin = getDealMin(peer)}
													<td>{peerMin != null ? '$' + Number(peerMin).toLocaleString() : '--'}</td>
												{/each}
											</tr>
											<tr>
												<td class="comp-metric-label">Distributions</td>
												<td class="col-gp">{comp.myDist || '--'}</td>
												{#each comp.top3 as peer}
													<td>{getDealDist(peer) || '--'}</td>
												{/each}
											</tr>
											{#each savedFields as fieldKey}
												{@const def = extraFieldDefs.find(f => f.key === fieldKey)}
												{#if def}
													<tr class="comp-extra-row">
														<td class="comp-metric-label">
															{def.label}
															<button class="comp-remove-field-btn" onclick={() => removeCompField(comp.tableId, fieldKey)} title="Remove field">&times;</button>
														</td>
														<td class="col-gp">{formatFieldValue(def.get(comp.deal), def.format)}</td>
														{#each comp.top3 as peer}
															<td>{formatFieldValue(def.get(peer), def.format)}</td>
														{/each}
													</tr>
												{/if}
											{/each}
											{#if availableFields.length > 0}
												<tr class="comp-add-field-row">
													<td colspan={2 + comp.top3.length}>
														<button class="comp-add-field-trigger" onclick={() => toggleCompDropdown(comp.tableId)}>
															<span class="comp-add-icon">+</span> Add Field to Compare
														</button>
														{#if compDropdownOpen[comp.tableId]}
															<div class="comp-add-dropdown">
																{#each availableFields as f}
																	<button class="comp-add-option" onclick={() => addCompField(comp.tableId, f.key)}>{f.label}</button>
																{/each}
															</div>
														{/if}
													</td>
												</tr>
											{/if}
										</tbody>
									</table>
								</div>
								{#if comp.insights.length > 0}
									<ul class="comp-insights">
										{#each comp.insights as item}
											<li><span class="comp-insight-{item.type}">{item.text}</span></li>
										{/each}
									</ul>
								{/if}
							</div>
						{/each}
					{/if}
				</div>
			</div>

			<!-- 5. Market Intelligence -->
			<div class="section-card">
				<div class="section-header">
					<div class="section-title">Market Intelligence</div>
				</div>
				<div class="section-body">
					{#if marketIntelData.length === 0}
						<div class="empty-inline">
							<p>Not enough data to generate market intelligence yet. Add deals with financial details to get started.</p>
						</div>
					{:else}
						<div class="mi-grid">
							{#each marketIntelData as card}
								<div class="mi-card">
									<div class="mi-card-icon" style="background: {card.color}20;">
										{#if card.icon === 'bar-chart'}
											<svg viewBox="0 0 24 24" fill="none" stroke={card.color} stroke-width="2"><path d="M18 20V10"/><path d="M12 20V4"/><path d="M6 20v-6"/></svg>
										{:else if card.icon === 'users'}
											<svg viewBox="0 0 24 24" fill="none" stroke={card.color} stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
										{:else if card.icon === 'globe'}
											<svg viewBox="0 0 24 24" fill="none" stroke={card.color} stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 2a10 10 0 0 1 0 20"/><path d="M12 2v20"/></svg>
										{:else if card.icon === 'message'}
											<svg viewBox="0 0 24 24" fill="none" stroke={card.color} stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
										{/if}
									</div>
									<div class="mi-card-title">{card.title}</div>
									<div class="mi-card-value" style="color: {card.color};">{card.value}</div>
									<div class="mi-card-desc">{card.desc}</div>
									{#if card.barData}
										{@const maxBarPct = Math.max(...card.barData.map(a => a.pct))}
										{#each card.barData as item}
											<div class="mi-bar-row">
												<span class="mi-bar-label">{item.name}</span>
												<div class="mi-bar-track">
													<div class="mi-bar-fill" style="width: {maxBarPct > 0 ? Math.round((item.pct / maxBarPct) * 100) : 0}%; background: {item.isGP ? 'var(--primary)' : 'var(--border)'};"></div>
												</div>
												<span class="mi-bar-pct">{item.pct}%</span>
											</div>
										{/each}
									{/if}
								</div>
							{/each}
						</div>
						{#if investorInsights?.totalInvestors}
							<div class="mi-footer">Based on {investorInsights.totalInvestors} investor profiles</div>
						{/if}
					{/if}
				</div>
			</div>

			<!-- 6. Settings -->
			<div class="section-card">
				<div class="section-header">
					<div class="section-title">Settings</div>
				</div>
				<div class="section-body">
					<!-- Calendar Booking URL -->
					<div class="settings-group">
						<div class="settings-label">Calendar Booking URL</div>
						<div class="settings-hint">Investors who request an intro will be directed to this link to schedule a meeting.</div>
						<div class="settings-input-row">
							<input type="url" class="settings-input" bind:value={calendarUrl} placeholder="https://calendly.com/your-link" />
							<button class="btn-save" disabled={calendarSaving} onclick={saveCalendarUrl}>
								<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
								{calendarSaving ? 'Saving...' : 'Save'}
							</button>
						</div>
						<div class="save-status" style:color={calendarStatusColor}>{calendarStatus}</div>
					</div>

					<!-- IR Contact -->
					<div class="settings-group">
						<div class="settings-label">Investor Relations Contact</div>
						<div class="settings-hint">This is the person investors will be introduced to when they request a connection. If left blank, intros will go through our team manually.</div>
						<div class="settings-input-row" style="flex-wrap:wrap;gap:8px;">
							<input type="text" class="settings-input" bind:value={irContactName} placeholder="Jane Smith" style="flex:1;min-width:140px;" />
							<input type="email" class="settings-input" bind:value={irContactEmail} placeholder="ir@yourcompany.com" style="flex:1;min-width:200px;" />
							<button class="btn-save" disabled={irSaving} onclick={saveIRContact}>
								<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
								{irSaving ? 'Saving...' : 'Save'}
							</button>
						</div>
						<div class="save-status" style:color={irStatusColor}>{irStatus}</div>
					</div>

					<!-- Authorized Emails -->
					<div class="settings-group">
						<div class="settings-label">Authorized Emails</div>
						<div class="settings-hint">These email addresses can sign in and manage your GP portal. The primary email cannot be removed.</div>
						<ul class="email-list">
							{#each authorizedEmails as email}
								{@const isPrimary = email.toLowerCase() === ($user?.email || '').toLowerCase()}
								<li>
									<div>
										<span class="email-list-addr">{email}</span>
										{#if isPrimary}<span class="email-list-primary">Primary</span>{/if}
									</div>
									{#if !isPrimary}
										<button class="btn-remove-email" onclick={() => removeEmail(email)} title="Remove email">
											<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
										</button>
									{/if}
								</li>
							{/each}
						</ul>
						<div class="settings-input-row">
							<input type="email" class="settings-input" bind:value={newEmailInput} placeholder="team-member@yourcompany.com" onkeydown={(e) => { if (e.key === 'Enter') addEmail(); }} />
							<button class="btn-save" onclick={addEmail}>
								<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
								Add
							</button>
						</div>
						<div class="save-status" style:color={emailStatusColor}>{emailStatus}</div>
					</div>
				</div>
			</div>
		{/if}
	</div>
</div>

<!-- Toast -->
<div class="toast" class:show={toastVisible}>{toastMsg}</div>

<!-- Mobile Bottom Tab Bar -->
<div class="mobile-tab-bar">
	<a class="mobile-tab-item" href="/app/dashboard">
		<svg viewBox="0 0 24 24"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
		<span>Dashboard</span>
	</a>
	<a class="mobile-tab-item" href="/app/marketintel">
		<svg viewBox="0 0 24 24"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
		<span>Intel</span>
	</a>
	<a class="mobile-tab-item" href="/app/deals">
		<svg viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>
		<span>Deal Flow</span>
	</a>
	<a class="mobile-tab-item active" href="/gp-dashboard">
		<svg viewBox="0 0 24 24"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
		<span>GP Portal</span>
	</a>
	<a class="mobile-tab-item" href="/app/settings">
		<svg viewBox="0 0 24 24"><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
		<span>More</span>
	</a>
</div>

<style>
	/* ====== MAIN LAYOUT ====== */
	.main {
		margin-left: var(--sidebar-width, 240px);
		min-height: 100vh;
		transition: margin-left 0.3s ease;
	}
	.content-wrap {
		max-width: 1200px;
		padding: 32px 40px 64px;
		margin: 0 auto;
	}

	/* ====== MOBILE TOP BAR ====== */
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
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.mobile-menu-btn {
		display: none;
		background: none;
		border: none;
		cursor: pointer;
		color: var(--text-dark);
		padding: 4px;
	}
	.mobile-menu-btn :global(svg) { width: 24px; height: 24px; }
	.sidebar-overlay {
		display: none;
		position: fixed;
		inset: 0;
		background: rgba(0,0,0,0.5);
		z-index: 99;
	}
	.sidebar-overlay.open { display: block; }

	/* ====== LOADING SKELETON ====== */
	.skeleton {
		position: relative;
		overflow: hidden;
		background: var(--border-light);
		border-radius: var(--radius-sm, 8px);
	}
	.skeleton::after {
		content: '';
		position: absolute;
		inset: 0;
		background: linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.6) 50%, transparent 100%);
		animation: shimmer 1.5s infinite;
	}
	@keyframes shimmer {
		0% { transform: translateX(-100%); }
		100% { transform: translateX(100%); }
	}
	.skeleton-header { height: 180px; margin-bottom: 24px; }
	.skeleton-stats { height: 80px; margin-bottom: 24px; }
	.skeleton-card { height: 200px; margin-bottom: 20px; }

	/* ====== GP HEADER ====== */
	.gp-header {
		background: linear-gradient(145deg, var(--teal-midnight, #0A1E21) 0%, var(--teal-deep, #1F5159) 100%);
		border-radius: 10px;
		padding: 28px 32px;
		margin-bottom: 20px;
		position: relative;
		overflow: hidden;
	}
	.gp-header::after {
		content: '';
		position: absolute;
		top: -60%; right: -10%;
		width: 220px; height: 220px;
		background: radial-gradient(circle, rgba(81,190,123,0.08) 0%, transparent 70%);
		border-radius: 50%;
		pointer-events: none;
	}
	.gp-header-inner {
		display: flex;
		align-items: flex-start;
		gap: 22px;
		position: relative;
		z-index: 1;
	}
	.gp-header-avatar {
		width: 68px; height: 68px;
		border-radius: 10px;
		background: var(--primary, #51BE7B);
		display: flex;
		align-items: center;
		justify-content: center;
		font-family: var(--font-ui);
		font-weight: 800;
		color: #fff;
		font-size: 22px;
		flex-shrink: 0;
		letter-spacing: -0.5px;
		overflow: hidden;
		border: 2px solid rgba(255,255,255,0.15);
	}
	.gp-header-avatar :global(img) {
		width: 100%; height: 100%;
		object-fit: cover;
	}
	.gp-header-info { flex: 1; }
	.gp-header-company {
		font-family: var(--font-headline);
		font-size: 28px;
		color: #fff;
		line-height: 1.2;
		letter-spacing: -0.5px;
		margin-bottom: 4px;
	}
	.gp-header-meta {
		font-family: var(--font-ui);
		font-size: 14px;
		font-weight: 500;
		color: rgba(255,255,255,0.6);
		margin-bottom: 6px;
	}
	.gp-header-meta :global(strong) { color: rgba(255,255,255,0.85); font-weight: 600; }
	.gp-header-subtitle {
		font-family: var(--font-ui);
		font-size: 12px;
		font-weight: 400;
		color: rgba(255,255,255,0.4);
		margin-bottom: 12px;
	}
	.gp-header-tags { display: flex; gap: 8px; flex-wrap: wrap; }
	.gp-tag {
		display: inline-flex;
		align-items: center;
		padding: 4px 10px;
		border-radius: 20px;
		font-family: var(--font-ui);
		font-size: 10px;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.5px;
		background: rgba(81,190,123,0.2);
		color: var(--accent-green, #40E47F);
	}
	.gp-tag.type-tag { background: rgba(255,255,255,0.1); color: rgba(255,255,255,0.7); }

	/* ====== REFRESH BUTTON ====== */
	.btn-refresh {
		display: inline-flex;
		align-items: center;
		gap: 7px;
		padding: 10px 20px;
		font-family: var(--font-ui);
		font-size: 12px;
		font-weight: 700;
		border-radius: var(--radius-sm, 8px);
		cursor: pointer;
		transition: all var(--transition, 0.2s ease);
		background: rgba(255,255,255,0.12);
		color: rgba(255,255,255,0.85);
		border: 1px solid rgba(255,255,255,0.2);
		white-space: nowrap;
		flex-shrink: 0;
		align-self: flex-start;
	}
	.btn-refresh:hover { background: rgba(255,255,255,0.2); color: #fff; }
	.btn-refresh:disabled { opacity: 0.6; cursor: not-allowed; }
	.btn-refresh :global(svg) { width: 14px; height: 14px; }
	.btn-refresh :global(svg.spinning) {
		animation: spin 1s linear infinite;
	}
	@keyframes spin {
		from { transform: rotate(0deg); }
		to { transform: rotate(360deg); }
	}

	/* ====== STATS BAR ====== */
	.stats-strip {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 16px;
		margin-bottom: 24px;
	}
	.stat-card {
		background: var(--bg-card);
		border: 1px solid var(--border);
		border-radius: var(--radius, 12px);
		padding: 20px 18px;
		text-align: center;
		box-shadow: var(--shadow-card, 0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04));
	}
	.stat-card-value {
		font-family: var(--font-headline);
		font-size: 26px;
		color: var(--teal-deep, #1F5159);
		line-height: 1;
		margin-bottom: 4px;
	}
	.stat-card-label {
		font-family: var(--font-ui);
		font-size: 10px;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 1.2px;
		color: var(--text-muted);
	}

	/* ====== SECTION CARDS ====== */
	.section-card {
		background: var(--bg-card);
		border: 1px solid var(--border);
		border-radius: 10px;
		box-shadow: none;
		margin-bottom: 20px;
		overflow: hidden;
	}
	.section-header {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 16px 20px;
		border-bottom: 1px solid var(--border-light);
	}
	.section-title {
		font-family: var(--font-ui);
		font-size: 11px;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 1.5px;
		color: var(--primary);
	}
	.section-badge {
		background: var(--green-bg);
		color: var(--green);
		font-family: var(--font-ui);
		font-size: 11px;
		font-weight: 700;
		padding: 2px 10px;
		border-radius: 10px;
	}
	.section-body { padding: 20px; }

	/* ====== ACTION ITEMS ====== */
	.action-item {
		display: flex;
		align-items: center;
		gap: 14px;
		padding: 14px 18px;
		border-radius: var(--radius-sm, 8px);
		background: var(--bg-card);
		border: 1px solid var(--border-light);
		margin-bottom: 8px;
		transition: all var(--transition, 0.2s ease);
	}
	.action-item:last-child { margin-bottom: 0; }
	.action-item:hover { border-color: var(--border); box-shadow: var(--shadow-card, 0 1px 3px rgba(0,0,0,0.06)); }
	.action-item.urgency-red { border-left: 4px solid var(--red); }
	.action-item.urgency-orange { border-left: 4px solid var(--orange); }
	.action-item.urgency-yellow { border-left: 4px solid var(--yellow); }
	.action-item-icon {
		width: 36px; height: 36px;
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
	}
	.action-item-icon :global(svg) { width: 16px; height: 16px; }
	.action-item-icon.icon-red { background: var(--red-bg); color: var(--red); }
	.action-item-icon.icon-orange { background: var(--orange-bg); color: var(--orange); }
	.action-item-icon.icon-yellow { background: var(--yellow-bg); color: var(--yellow); }
	.action-item-info { flex: 1; min-width: 0; }
	.action-item-name {
		font-family: var(--font-ui);
		font-size: 13px;
		font-weight: 700;
		color: var(--text-dark);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.action-item-desc {
		font-family: var(--font-ui);
		font-size: 12px;
		color: var(--text-muted);
		font-weight: 500;
	}
	.action-item-btn {
		display: inline-flex;
		align-items: center;
		gap: 5px;
		padding: 6px 14px;
		font-family: var(--font-ui);
		font-size: 11px;
		font-weight: 700;
		letter-spacing: 0.3px;
		border-radius: var(--radius-sm, 8px);
		cursor: pointer;
		transition: all var(--transition, 0.2s ease);
		text-decoration: none;
		border: 1px solid var(--border);
		background: var(--bg-card);
		color: var(--text-secondary);
		white-space: nowrap;
		flex-shrink: 0;
	}
	.action-item-btn:hover {
		border-color: var(--primary);
		color: var(--primary);
		background: var(--green-bg);
	}
	.action-item-btn :global(svg) { width: 12px; height: 12px; }

	/* ====== DEAL HEALTH TABLE ====== */
	.health-table-wrap {
		overflow-x: auto;
		margin: -4px -4px;
	}
	.health-table {
		width: 100%;
		border-collapse: collapse;
		font-family: var(--font-ui);
		font-size: 13px;
		min-width: 700px;
	}
	.health-table th {
		text-align: left;
		padding: 10px 14px;
		font-size: 10px;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 1px;
		color: var(--text-muted);
		border-bottom: 2px solid var(--border);
		cursor: pointer;
		white-space: nowrap;
		user-select: none;
		transition: color var(--transition, 0.2s ease);
	}
	.health-table th:hover { color: var(--text-dark); }
	.health-table th .sort-arrow,
	.sort-arrow {
		display: inline-block;
		margin-left: 4px;
		font-size: 10px;
		opacity: 0.4;
	}
	.health-table th.sorted .sort-arrow { opacity: 1; color: var(--primary); }
	.health-table td {
		padding: 12px 14px;
		border-bottom: 1px solid var(--border-light);
		vertical-align: middle;
	}
	.health-table tr:last-child td { border-bottom: none; }
	.health-table tr:hover td { background: var(--off-white); }
	.health-table-name {
		font-weight: 600;
		color: var(--primary);
		text-decoration: none;
		transition: color var(--transition, 0.2s ease);
	}
	.health-table-name:hover { color: var(--primary-hover); }
	.deal-badge {
		display: inline-flex;
		align-items: center;
		padding: 3px 10px;
		border-radius: 20px;
		font-family: var(--font-ui);
		font-size: 10px;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.5px;
	}
	.deal-badge.green { background: var(--green-bg); color: var(--green); }
	.deal-badge.blue { background: var(--blue-bg); color: var(--blue); }
	.deal-badge.orange { background: var(--orange-bg); color: var(--orange); }
	.progress-bar-wrap {
		display: flex;
		align-items: center;
		gap: 8px;
	}
	.progress-bar {
		flex: 1;
		height: 6px;
		background: var(--border-light);
		border-radius: 3px;
		overflow: hidden;
		min-width: 60px;
	}
	.progress-bar-fill {
		height: 100%;
		border-radius: 3px;
		transition: width 0.4s ease;
	}
	.progress-bar-fill.pct-low { background: var(--red); }
	.progress-bar-fill.pct-mid { background: var(--orange); }
	.progress-bar-fill.pct-high { background: var(--green); }
	.progress-pct {
		font-size: 11px;
		font-weight: 700;
		color: var(--text-muted);
		min-width: 32px;
		text-align: right;
	}
	.check-icon { color: var(--green); }
	.x-icon { color: var(--red); }
	.check-icon :global(svg), .x-icon :global(svg) { width: 16px; height: 16px; vertical-align: middle; }

	/* ====== SETTINGS ====== */
	.settings-group {
		margin-bottom: 28px;
	}
	.settings-group:last-child { margin-bottom: 0; }
	.settings-label {
		font-family: var(--font-ui);
		font-size: 13px;
		font-weight: 700;
		color: var(--text-dark);
		margin-bottom: 4px;
	}
	.settings-hint {
		font-family: var(--font-ui);
		font-size: 12px;
		color: var(--text-muted);
		margin-bottom: 10px;
	}
	.settings-input-row {
		display: flex;
		gap: 10px;
		align-items: stretch;
	}
	.settings-input {
		flex: 1;
		padding: 10px 14px;
		border: 1px solid var(--border);
		border-radius: var(--radius-sm, 8px);
		font-family: var(--font-body);
		font-size: 14px;
		color: var(--text-dark);
		background: var(--off-white);
		outline: none;
		transition: border-color var(--transition, 0.2s ease);
	}
	.settings-input:focus { border-color: var(--primary); }
	.settings-input::placeholder { color: var(--text-muted); }
	.btn-save {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		padding: 10px 24px;
		font-family: var(--font-ui);
		font-size: 12px;
		font-weight: 700;
		letter-spacing: 0.3px;
		border-radius: var(--radius-sm, 8px);
		cursor: pointer;
		transition: all var(--transition, 0.2s ease);
		background: var(--primary);
		color: #fff;
		border: none;
		white-space: nowrap;
	}
	.btn-save:hover { background: var(--primary-hover); }
	.btn-save:disabled {
		background: var(--border);
		color: var(--text-muted);
		cursor: not-allowed;
	}
	.btn-save :global(svg) { width: 14px; height: 14px; }
	.save-status {
		font-family: var(--font-ui);
		font-size: 12px;
		color: var(--green);
		margin-top: 8px;
		min-height: 18px;
	}
	.email-list {
		list-style: none;
		margin-bottom: 12px;
		padding: 0;
	}
	.email-list li {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 10px 14px;
		border: 1px solid var(--border-light);
		border-radius: var(--radius-sm, 8px);
		margin-bottom: 6px;
		background: var(--off-white);
	}
	.email-list-addr {
		font-family: var(--font-ui);
		font-size: 13px;
		font-weight: 500;
		color: var(--text-dark);
	}
	.email-list-primary {
		font-family: var(--font-ui);
		font-size: 10px;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.5px;
		color: var(--primary);
		margin-left: 8px;
	}
	.btn-remove-email {
		background: none;
		border: none;
		color: var(--text-muted);
		cursor: pointer;
		padding: 4px;
		transition: color 0.2s;
		display: flex;
		align-items: center;
	}
	.btn-remove-email:hover { color: var(--red); }
	.btn-remove-email :global(svg) { width: 16px; height: 16px; }

	/* ====== ACCESS DENIED ====== */
	.access-denied {
		text-align: center;
		padding: 80px 20px;
	}
	.access-denied-icon {
		width: 64px; height: 64px;
		margin: 0 auto 20px;
		background: var(--orange-bg);
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
		color: var(--orange);
	}
	.access-denied-icon :global(svg) { width: 28px; height: 28px; }
	.access-denied h2 {
		font-family: var(--font-headline);
		font-size: 24px;
		color: var(--text-dark);
		margin-bottom: 8px;
	}
	.access-denied p {
		font-family: var(--font-ui);
		font-size: 14px;
		color: var(--text-muted);
		margin-bottom: 24px;
	}
	.btn-back-home {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		padding: 12px 28px;
		font-family: var(--font-ui);
		font-size: 13px;
		font-weight: 700;
		border-radius: var(--radius-sm, 8px);
		cursor: pointer;
		transition: all var(--transition, 0.2s ease);
		background: var(--primary);
		color: #fff;
		border: none;
		text-decoration: none;
	}
	.btn-back-home:hover { background: var(--primary-hover); }

	/* ====== EMPTY STATE ====== */
	.empty-inline {
		text-align: center;
		padding: 40px 20px;
		color: var(--text-muted);
	}
	.empty-inline p {
		font-family: var(--font-ui);
		font-size: 13px;
		font-weight: 500;
	}

	/* ====== TOAST ====== */
	.toast {
		position: fixed;
		bottom: 24px;
		right: 24px;
		background: var(--teal-midnight, #0A1E21);
		color: #fff;
		padding: 14px 24px;
		border-radius: var(--radius-sm, 8px);
		font-family: var(--font-ui);
		font-size: 13px;
		font-weight: 600;
		box-shadow: 0 8px 24px rgba(0,0,0,0.2);
		z-index: 1000;
		transform: translateY(100px);
		opacity: 0;
		transition: all 0.3s ease;
	}
	.toast.show {
		transform: translateY(0);
		opacity: 1;
	}

	/* ====== GP ANALYTICS ====== */
	.analytics-grid {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 12px;
		margin-bottom: 18px;
	}
	.analytics-metric {
		background: var(--bg-card);
		border: 1px solid var(--border-light);
		border-radius: var(--radius-sm, 8px);
		padding: 16px 14px;
		text-align: center;
	}
	.analytics-metric-value {
		font-family: var(--font-headline);
		font-size: 28px;
		color: var(--teal-deep, #1F5159);
		line-height: 1;
		margin-bottom: 4px;
	}
	.analytics-metric-label {
		font-family: var(--font-ui);
		font-size: 10px;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 1.2px;
		color: var(--text-muted);
	}
	.activity-list {
		list-style: none;
	}
	.activity-item {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 10px 0;
		border-bottom: 1px solid var(--border-light);
		font-family: var(--font-ui);
		font-size: 13px;
	}
	.activity-item:last-child { border-bottom: none; }
	.activity-stage-badge {
		display: inline-flex;
		align-items: center;
		padding: 2px 10px;
		border-radius: 20px;
		font-size: 10px;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.5px;
		flex-shrink: 0;
	}
	.activity-stage-badge.stage-interested { background: var(--blue-bg); color: var(--blue); }
	.activity-stage-badge.stage-duediligence { background: var(--yellow-bg); color: var(--yellow); }
	.activity-stage-badge.stage-portfolio { background: var(--green-bg); color: var(--green); }
	.activity-time {
		margin-left: auto;
		font-size: 11px;
		color: var(--text-muted);
		flex-shrink: 0;
	}
	.activity-deal-name {
		font-weight: 600;
		color: var(--text-dark);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		flex: 1;
		min-width: 0;
	}
	.activity-empty-nudge {
		text-align: center;
		padding: 16px 20px;
		background: var(--bg-cream);
		border-radius: var(--radius-sm, 8px);
		margin-top: 8px;
	}
	.activity-empty-nudge p {
		color: var(--text-secondary);
		font-size: 13px;
		font-family: var(--font-ui);
		margin: 0;
	}

	/* ====== WEEKLY CHART ====== */
	.weekly-chartjs-container { height: 180px; position: relative; }
	.weekly-chart-wrap {
		margin: 20px 0 16px;
	}
	.weekly-chart-title {
		font-family: var(--font-ui);
		font-size: 13px;
		font-weight: 700;
		color: var(--text-dark);
		margin-bottom: 4px;
	}
	.weekly-chart-legend {
		display: flex;
		gap: 16px;
		margin-bottom: 14px;
	}
	.weekly-chart-legend-item {
		display: flex;
		align-items: center;
		gap: 6px;
		font-family: var(--font-ui);
		font-size: 11px;
		font-weight: 600;
		color: var(--text-secondary);
	}
	.weekly-chart-legend-swatch {
		width: 10px;
		height: 10px;
		border-radius: 2px;
		flex-shrink: 0;
	}
	.weekly-chart-container {
		display: flex;
		align-items: flex-end;
		gap: 0;
		height: 120px;
		padding-bottom: 28px;
		position: relative;
		border-bottom: 1px solid var(--border-light);
	}
	.weekly-chart-bar-group {
		flex: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		height: 100%;
		justify-content: flex-end;
		position: relative;
		cursor: pointer;
	}
	.weekly-chart-bar-stack {
		width: 60%;
		max-width: 40px;
		display: flex;
		flex-direction: column-reverse;
		border-radius: 4px 4px 0 0;
		overflow: hidden;
		transition: opacity 0.2s ease;
	}
	.weekly-chart-bar-group:hover .weekly-chart-bar-stack {
		opacity: 0.85;
	}
	.weekly-chart-bar-seg {
		width: 100%;
		transition: height 0.6s cubic-bezier(0.22, 1, 0.36, 1);
	}
	.weekly-chart-bar-seg.seg-interested { background: #27ae60; }
	.weekly-chart-bar-seg.seg-duediligence { background: #2563eb; }
	.weekly-chart-bar-seg.seg-portfolio { background: #1a2332; }
	.weekly-chart-bar-label {
		position: absolute;
		bottom: -24px;
		font-family: var(--font-ui);
		font-size: 10px;
		font-weight: 600;
		color: var(--text-muted);
		white-space: nowrap;
	}
	.weekly-chart-tooltip {
		display: none;
		position: absolute;
		bottom: calc(100% + 8px);
		left: 50%;
		transform: translateX(-50%);
		background: var(--charcoal, #141413);
		color: #fff;
		font-family: var(--font-ui);
		font-size: 11px;
		line-height: 1.5;
		padding: 8px 12px;
		border-radius: 6px;
		white-space: nowrap;
		z-index: 10;
		pointer-events: none;
	}
	.weekly-chart-tooltip::after {
		content: '';
		position: absolute;
		top: 100%;
		left: 50%;
		transform: translateX(-50%);
		border: 5px solid transparent;
		border-top-color: var(--charcoal, #141413);
	}
	.weekly-chart-bar-group:hover .weekly-chart-tooltip {
		display: block;
	}
	.weekly-chart-empty {
		display: flex;
		align-items: center;
		justify-content: center;
		height: 120px;
		background: var(--off-white);
		border-radius: var(--radius-sm, 8px);
		border: 1px solid var(--border-light);
		font-family: var(--font-ui);
		font-size: 13px;
		color: var(--text-muted);
		text-align: center;
		padding: 24px;
		line-height: 1.6;
		width: 100%;
	}

	/* ====== WEBINAR CTA CARD ====== */
	.webinar-cta-card {
		margin-top: 0;
		margin-bottom: 0;
		padding: 20px;
		background: linear-gradient(180deg, #f8fbf9 0%, #f2f7f4 100%);
		border: 1px solid var(--border-light);
		border-left: 3px solid var(--primary);
		border-radius: 10px;
		position: relative;
		overflow: hidden;
	}
	.webinar-cta-card::before {
		content: '';
		position: absolute;
		top: -32px;
		right: -32px;
		width: 96px;
		height: 96px;
		background: rgba(81, 190, 123, 0.04);
		border-radius: 50%;
	}
	.webinar-cta-title {
		font-family: var(--font-ui);
		font-size: 15px;
		font-weight: 800;
		color: var(--text-dark);
		margin-bottom: 8px;
	}
	.webinar-cta-stat {
		font-family: var(--font-ui);
		font-size: 12px;
		font-weight: 600;
		color: var(--primary);
		margin-bottom: 12px;
	}
	.webinar-cta-desc {
		font-family: var(--font-body);
		font-size: 13px;
		color: var(--text-secondary);
		line-height: 1.6;
		margin-bottom: 16px;
	}
	.webinar-cta-features {
		list-style: none;
		margin-bottom: 20px;
		padding: 0;
	}
	.webinar-cta-features li {
		font-family: var(--font-ui);
		font-size: 12px;
		font-weight: 500;
		color: var(--text-dark);
		padding: 4px 0;
	}
	.webinar-cta-features li::before {
		content: '\2022';
		color: var(--primary);
		font-weight: 700;
		margin-right: 8px;
	}
	.webinar-cta-btn {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		padding: 12px 28px;
		background: var(--primary);
		color: #fff;
		font-family: var(--font-ui);
		font-size: 14px;
		font-weight: 700;
		border: none;
		border-radius: var(--radius-sm, 8px);
		text-decoration: none;
		cursor: pointer;
		transition: background 0.2s ease, transform 0.15s ease;
	}
	.webinar-cta-btn:hover {
		background: var(--primary-hover);
		transform: translateY(-1px);
	}

	/* Webinar CTA as standalone section-card */
	.webinar-cta-section .section-header {
		background: transparent;
	}
	.webinar-cta-section .webinar-cta-card {
		margin: 0;
	}
	.webinar-cta-section .webinar-cta-btn {
		display: flex;
		width: 100%;
		justify-content: center;
	}

	/* ====== MARKET INTELLIGENCE ====== */
	.mi-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
		gap: 16px;
	}
	.mi-card {
		background: var(--off-white);
		border: 1px solid var(--border-light);
		border-radius: var(--radius-sm, 8px);
		padding: 20px;
		display: flex;
		flex-direction: column;
	}
	.mi-card-icon {
		width: 36px;
		height: 36px;
		border-radius: 10px;
		display: flex;
		align-items: center;
		justify-content: center;
		margin-bottom: 12px;
		flex-shrink: 0;
	}
	.mi-card-icon :global(svg) { width: 18px; height: 18px; }
	.mi-card-title {
		font-family: var(--font-ui);
		font-size: 13px;
		font-weight: 700;
		color: var(--text-dark);
		margin-bottom: 4px;
	}
	.mi-card-value {
		font-family: var(--font-ui);
		font-size: 24px;
		font-weight: 800;
		line-height: 1.2;
		margin-bottom: 6px;
	}
	.mi-card-desc {
		font-family: var(--font-body);
		font-size: 12px;
		color: var(--text-secondary);
		line-height: 1.5;
		margin-bottom: 12px;
		flex: 1;
	}
	.mi-card-action {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		font-family: var(--font-ui);
		font-size: 12px;
		font-weight: 700;
		color: var(--primary);
		text-decoration: none;
		cursor: pointer;
		border: none;
		background: none;
		padding: 0;
	}
	.mi-card-action:hover { text-decoration: underline; }
	.mi-bar-row {
		display: flex;
		align-items: center;
		gap: 8px;
		margin-bottom: 8px;
	}
	.mi-bar-row:last-child { margin-bottom: 0; }
	.mi-bar-label {
		font-family: var(--font-ui);
		font-size: 11px;
		font-weight: 600;
		color: var(--text-secondary);
		min-width: 80px;
		flex-shrink: 0;
	}
	.mi-bar-track {
		flex: 1;
		height: 6px;
		background: var(--border-light);
		border-radius: 3px;
		overflow: hidden;
	}
	.mi-bar-fill {
		height: 100%;
		border-radius: 3px;
		transition: width 0.5s ease;
	}
	.mi-bar-pct {
		font-family: var(--font-ui);
		font-size: 11px;
		font-weight: 700;
		color: var(--text-dark);
		min-width: 32px;
		text-align: right;
	}
	.mi-footer {
		margin-top: 16px;
		padding-top: 12px;
		border-top: 1px solid var(--border-light);
		font-family: var(--font-ui);
		font-size: 12px;
		color: var(--text-muted);
		text-align: center;
	}
	/* ====== INVESTOR INSIGHTS (What Our Investors Want) ====== */
	.insights-bar-chart {
		margin-bottom: 20px;
	}
	.insights-bar-row {
		display: flex;
		align-items: center;
		gap: 12px;
		margin-bottom: 10px;
	}
	.insights-bar-label {
		font-family: var(--font-ui);
		font-size: 12px;
		font-weight: 600;
		color: var(--text-secondary);
		min-width: 130px;
		flex-shrink: 0;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.insights-bar-track {
		flex: 1;
		height: 24px;
		background: var(--border-light);
		border-radius: 4px;
		overflow: hidden;
		position: relative;
	}
	.insights-bar-fill {
		height: 100%;
		background: var(--primary);
		border-radius: 4px;
		transition: width 0.6s cubic-bezier(0.22, 1, 0.36, 1);
		display: flex;
		align-items: center;
		padding-left: 8px;
		min-width: 0;
	}
	.insights-bar-fill.gp-highlight {
		background: var(--teal-deep, #1F5159);
	}
	.insights-bar-pct {
		font-family: var(--font-ui);
		font-size: 11px;
		font-weight: 700;
		color: var(--text-muted);
		min-width: 36px;
		text-align: right;
		flex-shrink: 0;
	}
	.insights-bar-gp-tag {
		display: inline-flex;
		align-items: center;
		padding: 1px 6px;
		border-radius: 3px;
		font-family: var(--font-ui);
		font-size: 9px;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.5px;
		background: rgba(255,255,255,0.9);
		color: var(--teal-deep, #1F5159);
		margin-left: 6px;
		flex-shrink: 0;
	}
	.insights-stat-cards {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
		gap: 14px;
		margin-bottom: 20px;
	}
	.insights-stat-card {
		background: var(--off-white);
		border: 1px solid var(--border-light);
		border-radius: var(--radius-sm, 8px);
		padding: 16px 14px;
		text-align: center;
	}
	.insights-stat-value {
		font-family: var(--font-headline);
		font-size: 20px;
		color: var(--teal-deep, #1F5159);
		line-height: 1.2;
		margin-bottom: 4px;
	}
	.insights-stat-label {
		font-family: var(--font-ui);
		font-size: 10px;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 1px;
		color: var(--text-muted);
	}
	.insights-donut-row {
		display: flex;
		gap: 12px;
		flex-wrap: wrap;
		margin-bottom: 20px;
	}
	.insights-donut-item {
		display: flex;
		align-items: center;
		gap: 8px;
		font-family: var(--font-ui);
		font-size: 12px;
		font-weight: 600;
		color: var(--text-dark);
	}
	.insights-donut-swatch {
		width: 12px;
		height: 12px;
		border-radius: 3px;
		flex-shrink: 0;
	}
	.insights-donut-pct {
		font-weight: 700;
		color: var(--teal-deep, #1F5159);
	}
	.insights-footer {
		font-family: var(--font-ui);
		font-size: 11px;
		color: var(--text-muted);
		font-weight: 500;
		text-align: center;
		padding-top: 12px;
		border-top: 1px solid var(--border-light);
	}
	.insights-sub-title {
		font-family: var(--font-ui);
		font-size: 12px;
		font-weight: 700;
		color: var(--text-dark);
		margin-bottom: 10px;
		text-transform: uppercase;
		letter-spacing: 0.8px;
	}
	.insights-empty {
		text-align: center;
		padding: 20px;
		color: var(--text-muted);
		font-family: var(--font-ui);
		font-size: 13px;
	}
	.check-size-chart {
		display: flex;
		align-items: flex-end;
		gap: 6px;
		height: 100px;
		padding-top: 8px;
	}
	.check-size-bar-col {
		flex: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 4px;
	}
	.check-size-bar-pct {
		font-family: var(--font-ui);
		font-size: 10px;
		font-weight: 700;
		color: var(--text-muted);
		min-height: 12px;
	}
	.check-size-bar {
		width: 100%;
		background: var(--border);
		border-radius: 4px 4px 0 0;
		transition: height 0.4s ease;
	}
	.check-size-bar.is-peak {
		background: var(--primary);
	}
	.check-size-bar-label {
		font-family: var(--font-ui);
		font-size: 10px;
		font-weight: 600;
		color: var(--text-secondary);
		white-space: nowrap;
	}

	/* ====== LEAD QUALITY / INTENT BADGES ====== */
	.activity-card-item {
		display: flex;
		align-items: flex-start;
		gap: 12px;
		padding: 14px 16px;
		border-radius: var(--radius-sm, 8px);
		background: var(--off-white);
		border: 1px solid var(--border-light);
		margin-bottom: 8px;
		transition: all var(--transition, 0.2s ease);
	}
	.activity-card-item:last-child { margin-bottom: 0; }
	.activity-card-item:hover { border-color: var(--border); box-shadow: var(--shadow-card, 0 1px 3px rgba(0,0,0,0.06)); }
	.intent-badge {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		padding: 3px 10px;
		border-radius: 20px;
		font-family: var(--font-ui);
		font-size: 10px;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.5px;
		flex-shrink: 0;
		white-space: nowrap;
	}
	.intent-badge.intent-high {
		background: #FEF2F2;
		color: #D04040;
	}
	.intent-badge.intent-engaged {
		background: var(--yellow-bg);
		color: var(--yellow);
	}
	.intent-badge.intent-browsing {
		background: var(--border-light);
		color: var(--text-muted);
	}
	.activity-card-body {
		flex: 1;
		min-width: 0;
	}
	.activity-card-deal {
		font-family: var(--font-ui);
		font-size: 13px;
		font-weight: 700;
		color: var(--text-dark);
		margin-bottom: 2px;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.activity-card-signal {
		font-family: var(--font-ui);
		font-size: 11px;
		color: var(--text-secondary);
		font-weight: 500;
	}
	.activity-card-time {
		font-family: var(--font-ui);
		font-size: 11px;
		color: var(--text-muted);
		flex-shrink: 0;
		white-space: nowrap;
	}
	.recent-activity-list {
		margin-top: 16px;
	}
	.high-intent-summary {
		padding: 10px 12px;
		margin-bottom: 10px;
		border-radius: 8px;
		background: rgba(81,190,123,0.08);
		color: var(--primary);
		font-family: var(--font-ui);
		font-size: 12px;
		font-weight: 700;
	}
	/* ====== COMPETITIVE ANALYSIS ====== */
	.comp-deal-section {
		margin-bottom: 28px;
	}
	.comp-deal-section:last-child { margin-bottom: 0; }
	.comp-deal-title {
		font-family: var(--font-ui);
		font-size: 13px;
		font-weight: 700;
		color: var(--text-dark);
		margin-bottom: 14px;
		text-transform: uppercase;
		letter-spacing: 0.5px;
	}
	.comp-table-wrap {
		overflow-x: auto;
		-webkit-overflow-scrolling: touch;
		margin-bottom: 16px;
	}
	.comp-table {
		width: 100%;
		border-collapse: collapse;
		font-family: var(--font-ui);
		font-size: 12px;
		min-width: 500px;
	}
	.comp-table th {
		text-align: left;
		padding: 8px 12px;
		font-size: 10px;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.8px;
		color: var(--text-muted);
		border-bottom: 2px solid var(--border);
		white-space: nowrap;
	}
	.comp-table th a {
		color: var(--primary);
		text-decoration: none;
		font-weight: 700;
	}
	.comp-table th a:hover { text-decoration: underline; }
	.comp-table th.col-gp {
		background: var(--green-bg);
		color: var(--teal-deep, #1F5159);
	}
	.comp-table th.col-gp a { color: var(--primary); }
	.comp-table td {
		padding: 10px 12px;
		border-bottom: 1px solid var(--border-light);
		vertical-align: middle;
		font-weight: 500;
	}
	.comp-table tr:last-child td { border-bottom: none; }
	.comp-table td.col-gp {
		background: rgba(231, 245, 240, 0.5);
		font-weight: 700;
		color: var(--teal-deep, #1F5159);
	}
	.comp-metric-label {
		font-weight: 700;
		color: var(--text-secondary);
		min-width: 100px;
	}
	.comp-value-better {
		color: var(--green);
		font-weight: 700;
	}
	.comp-value-worse {
		color: var(--orange);
		font-weight: 700;
	}
	.comp-value-neutral {
		color: var(--text-dark);
		font-weight: 500;
	}
	.comp-insights {
		list-style: none;
		padding: 0;
	}
	.comp-insights li {
		font-family: var(--font-ui);
		font-size: 12px;
		color: var(--text-secondary);
		padding: 6px 0;
		line-height: 1.5;
		border-bottom: 1px solid var(--border-light);
	}
	.comp-insights li:last-child { border-bottom: none; }
	.comp-insights li::before {
		content: '\2022';
		color: var(--primary);
		font-weight: 700;
		margin-right: 8px;
	}
	.comp-insight-good { color: var(--green); }
	.comp-insight-bad { color: var(--orange); }

	/* Add Field row */
	.comp-add-field-row td {
		border-bottom: none !important;
		padding: 0 !important;
	}
	.comp-add-field-trigger {
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 10px 14px;
		cursor: pointer;
		color: var(--text-muted);
		font-size: 13px;
		font-family: var(--font-ui);
		transition: color 0.15s;
		border-top: 1px dashed var(--border);
		background: none;
		border-left: none;
		border-right: none;
		border-bottom: none;
		width: 100%;
	}
	.comp-add-field-trigger:hover {
		color: var(--primary);
	}
	.comp-add-icon {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 20px;
		height: 20px;
		border-radius: 4px;
		border: 1px dashed var(--border);
		font-size: 14px;
		font-weight: 600;
		line-height: 1;
	}
	.comp-add-field-trigger:hover .comp-add-icon {
		border-color: var(--primary);
		color: var(--primary);
	}
	.comp-add-dropdown {
		padding: 4px 0;
		margin: 0 14px 8px;
		background: var(--bg-card, #fff);
		border: 1px solid var(--border);
		border-radius: 8px;
		box-shadow: 0 4px 12px rgba(0,0,0,0.08);
	}
	.comp-add-option {
		padding: 8px 14px;
		cursor: pointer;
		font-size: 13px;
		font-family: var(--font-ui);
		color: var(--text-dark);
		transition: background 0.1s;
		display: block;
		width: 100%;
		text-align: left;
		border: none;
		background: none;
	}
	.comp-add-option:hover {
		background: var(--off-white, #f0f0f0);
		color: var(--primary);
	}
	.comp-remove-field-btn {
		background: none;
		border: none;
		color: var(--text-muted);
		cursor: pointer;
		font-size: 14px;
		padding: 0 4px;
		margin-left: 4px;
		opacity: 0;
		transition: opacity 0.15s, color 0.15s;
	}
	.comp-extra-row:hover .comp-remove-field-btn {
		opacity: 1;
	}
	.comp-remove-field-btn:hover {
		color: var(--red, #e74c3c);
	}

	/* ====== DASHBOARD GRID ====== */
	.dashboard-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 20px;
		margin-bottom: 24px;
	}
	.dashboard-grid .section-card {
		margin-bottom: 0;
	}
	.dashboard-grid-full {
		grid-column: 1 / -1;
	}
	.dashboard-grid-3-2 {
		display: grid;
		grid-template-columns: 3fr 2fr;
		gap: 20px;
		margin-bottom: 24px;
	}
	.dashboard-grid-3-2 .section-card {
		margin-bottom: 0;
	}

	/* ====== DISTRIBUTION STACKED BAR ====== */
	.dist-stacked-bar {
		display: flex;
		height: 36px;
		border-radius: 6px;
		overflow: hidden;
		margin-bottom: 8px;
	}
	.dist-stacked-seg {
		display: flex;
		align-items: center;
		justify-content: center;
		font-family: var(--font-ui);
		font-size: 11px;
		font-weight: 700;
		color: #fff;
		transition: flex 0.4s ease;
		min-width: 0;
		overflow: hidden;
		white-space: nowrap;
	}
	.dist-stacked-labels {
		display: flex;
		gap: 16px;
		flex-wrap: wrap;
		margin-top: 8px;
	}

	/* ====== GOALS DONUT ====== */
	.goals-donut-wrap {
		display: flex;
		align-items: center;
		gap: 32px;
	}
	.goals-donut {
		width: 120px;
		height: 120px;
		border-radius: 50%;
		position: relative;
		flex-shrink: 0;
	}
	.goals-donut-center {
		position: absolute;
		inset: 20%;
		background: var(--bg-card);
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
		flex-direction: column;
	}
	.goals-donut-center-value {
		font-family: var(--font-headline);
		font-size: 20px;
		color: var(--teal-deep, #1F5159);
		line-height: 1;
	}
	.goals-donut-center-label {
		font-family: var(--font-ui);
		font-size: 9px;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.5px;
		color: var(--text-muted);
	}
	.goals-legend {
		display: flex;
		flex-direction: column;
		gap: 10px;
	}
	.goals-legend-item {
		display: flex;
		align-items: center;
		gap: 10px;
		font-family: var(--font-ui);
		font-size: 13px;
		font-weight: 600;
		color: var(--text-dark);
	}
	.goals-legend-swatch {
		width: 14px;
		height: 14px;
		border-radius: 4px;
		flex-shrink: 0;
	}
	.goals-legend-pct {
		font-weight: 700;
		color: var(--teal-deep, #1F5159);
		margin-left: auto;
	}

	/* ====== DEAL TYPE PILLS ====== */
	.deal-type-pills {
		display: flex;
		gap: 8px;
		flex-wrap: wrap;
	}
	.deal-type-pill {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		padding: 6px 14px;
		border-radius: 20px;
		background: var(--off-white);
		border: 1px solid var(--border);
		font-family: var(--font-ui);
		font-size: 12px;
		font-weight: 600;
		color: var(--text-dark);
	}
	.deal-type-pill-pct {
		font-weight: 700;
		color: var(--primary);
	}

	/* ====== INSIGHTS TWO-COL ====== */
	.insights-two-col {
		display: flex;
		gap: 32px;
		margin-bottom: 24px;
	}
	.insights-two-col > div {
		flex: 1;
	}

	/* ====== MOBILE TAB BAR ====== */
	.mobile-tab-bar {
		display: none;
		position: fixed;
		bottom: 0;
		left: 0;
		right: 0;
		height: calc(64px + env(safe-area-inset-bottom, 0px));
		padding-bottom: env(safe-area-inset-bottom, 0px);
		background: var(--bg-card);
		border-top: 1px solid var(--border);
		z-index: 200;
		align-items: center;
		justify-content: space-around;
		box-shadow: 0 -2px 12px rgba(0,0,0,0.06);
		-webkit-backdrop-filter: blur(20px);
		backdrop-filter: blur(20px);
		background: rgba(255,255,255,0.92);
	}
	.mobile-tab-item {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 3px;
		padding: 6px 0;
		min-width: 56px;
		text-decoration: none;
		cursor: pointer;
		border: none;
		background: none;
		-webkit-tap-highlight-color: transparent;
	}
	.mobile-tab-item :global(svg) {
		width: 22px;
		height: 22px;
		stroke: var(--text-muted);
		fill: none;
		stroke-width: 1.8;
		stroke-linecap: round;
		stroke-linejoin: round;
	}
	.mobile-tab-item span {
		font-family: var(--font-ui);
		font-size: 10px;
		font-weight: 600;
		color: var(--text-muted);
	}
	.mobile-tab-item.active :global(svg) { stroke: var(--primary); }
	.mobile-tab-item.active span { color: var(--primary); }

	/* ====== DARK MODE OVERRIDES ====== */
	:global(html.dark) .skeleton::after {
		background: linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.05) 50%, transparent 100%);
	}
	:global(html.dark) .section-card {
		border-color: var(--border);
	}
	:global(html.dark) .mi-card {
		background: var(--bg-card);
		border-color: var(--border);
	}
	:global(html.dark) .webinar-cta-card {
		background: linear-gradient(135deg, #0D2E1A 0%, #1A2332 100%);
		border-color: var(--border);
	}
	:global(html.dark) .webinar-cta-section .section-header {
		background: transparent;
	}
	:global(html.dark) .comp-table th.col-gp {
		background: var(--green-bg);
		color: var(--primary);
	}
	:global(html.dark) .comp-table td.col-gp {
		background: rgba(13, 46, 26, 0.3);
		color: var(--primary);
	}
	:global(html.dark) .comp-add-dropdown {
		background: var(--bg-card);
		border-color: var(--border);
	}
	:global(html.dark) .comp-add-option:hover {
		background: rgba(255,255,255,0.05);
	}
	:global(html.dark) .intent-badge.intent-high {
		background: var(--red-bg);
	}
	:global(html.dark) .weekly-chart-bar-seg.seg-portfolio {
		background: #9DB0B5;
	}
	:global(html.dark) .insights-bar-gp-tag {
		background: rgba(255,255,255,0.15);
		color: #E8EDE9;
	}
	:global(html.dark) .insights-bar-fill.gp-highlight {
		background: var(--primary);
	}
	:global(html.dark) .health-table tr:hover td {
		background: var(--bg-sidebar-hover);
	}
	:global(html.dark) .settings-input {
		background: var(--bg-cream);
		border-color: var(--border);
		color: var(--text-dark);
	}
	:global(html.dark) .email-list li {
		background: var(--bg-cream);
		border-color: var(--border);
	}
	:global(html.dark) .activity-card-item {
		background: var(--bg-card);
		border-color: var(--border);
	}
	:global(html.dark) .insights-stat-card {
		background: var(--bg-card);
		border-color: var(--border);
	}
	:global(html.dark) .deal-type-pill {
		background: var(--bg-card);
	}
	:global(html.dark) .high-intent-summary {
		background: rgba(13, 46, 26, 0.5);
		color: var(--primary);
	}
	:global(html.dark) .weekly-chart-empty {
		background: var(--bg-card);
		border-color: var(--border);
	}
	:global(html.dark) .stat-card-value,
	:global(html.dark) .analytics-metric-value,
	:global(html.dark) .insights-stat-value,
	:global(html.dark) .goals-donut-center-value,
	:global(html.dark) .goals-legend-pct,
	:global(html.dark) .insights-donut-pct,
	:global(html.dark) .mi-card-value {
		color: var(--primary);
	}
	:global(html.dark) .gp-header {
		background: linear-gradient(145deg, var(--teal-midnight) 0%, #1F5159 100%);
	}
	:global(html.dark) .mobile-tab-bar {
		background: rgba(10,30,33,0.92);
		border-top-color: rgba(255,255,255,0.08);
	}
	:global(html.dark) .mi-card-title { color: var(--text-muted); }
	:global(html.dark) .mi-card-desc { color: var(--text-secondary); }
	:global(html.dark) .mi-bar-track { background: var(--border); }
	:global(html.dark) .mi-footer { border-top-color: var(--border); color: var(--text-muted); }
	:global(html.dark) .empty-inline p { color: var(--text-muted); }
	/* Dark mode: Competitive Analysis */
	:global(html.dark) .comp-deal-title { color: var(--text-light, #E5E7EB); }
	:global(html.dark) .comp-table th { border-bottom-color: var(--border); color: var(--text-muted); }
	:global(html.dark) .comp-table td { border-bottom-color: var(--border); color: var(--text-secondary); }
	:global(html.dark) .comp-metric-label { color: var(--text-light, #E5E7EB); }
	:global(html.dark) .comp-remove-field-btn { background: var(--border); color: var(--text-muted); }
	:global(html.dark) .comp-add-field-trigger { border-color: var(--border); color: var(--text-muted); }

	/* ====== RESPONSIVE ====== */
	@media (max-width: 1024px) {
		.stats-strip { grid-template-columns: repeat(3, 1fr); }
		.analytics-grid { grid-template-columns: repeat(3, 1fr); }
		.dashboard-grid-3-2 { grid-template-columns: 1fr 1fr; }
	}
	@media (max-width: 768px) {
		.main { margin-left: 0; }
		.mobile-topbar { display: flex; }
		.mobile-menu-btn { display: block; }
		.content-wrap { padding: 20px 16px 100px; }
		.mobile-tab-bar { display: flex !important; }
		.gp-header { padding: 24px 20px; }
		.gp-header-inner {
			flex-direction: column;
			align-items: center;
			text-align: center;
			gap: 16px;
		}
		.gp-header-tags { justify-content: center; }
		.gp-header-company { font-size: 24px; }
		.section-body { padding: 20px 18px; }
		.section-header { padding: 16px 18px; }
		.settings-input-row { flex-direction: column; }
		.action-item { flex-wrap: wrap; }
		.action-item-btn { margin-left: auto; }
		.dashboard-grid { grid-template-columns: 1fr; }
		.dashboard-grid-3-2 { grid-template-columns: 1fr; }
		.mi-grid { grid-template-columns: 1fr; }
		.comp-table { font-size: 11px; }
		.comp-table th, .comp-table td { padding: 8px 10px; }
	}
	@media (max-width: 480px) {
		.stats-strip { grid-template-columns: 1fr 1fr; }
		.analytics-grid { grid-template-columns: 1fr; }
		.demand-cards { grid-template-columns: 1fr; }
		.insights-stat-cards { grid-template-columns: 1fr; }
		.insights-bar-label { min-width: 90px; font-size: 11px; }
		.insights-two-col { flex-direction: column; }
	}
</style>
