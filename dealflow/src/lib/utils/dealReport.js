import { getDealOperatorName } from '$lib/utils/dealSponsors.js';

const GOAL_LABELS = {
	passive_income: 'Cash Flow',
	reduce_taxes: 'Tax Optimization',
	build_wealth: 'Equity Growth',
	cashflow: 'Cash Flow',
	tax: 'Tax Optimization',
	growth: 'Equity Growth'
};

export function buildInvestmentReportHtml({
	deal,
	buyBox = {},
	buyBoxChecks = [],
	dealFit = null,
	cfRows = [],
	cfInvestment = 0,
	cfYieldRate = 0,
	cfHold = 0,
	cfTotalCash = 0,
	cfAvgCoC = 0,
	bgCheck = null,
	isCredit = false,
	stResults = null,
	stRentGrowth = 0,
	stExitCap = 0,
	stVacancy = 0,
	stInterest = 0,
	stHold = 0,
	reportUserName = 'Investor',
	reportDate = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
} = {}) {
	if (!deal) return '';

	let html = '';
	html += '<div class="rs"><h2>1. My Investment Criteria</h2><table class="rt"><tbody>';
	html += '<tr><td class="l">Investment Goal</td><td>' + (GOAL_LABELS[buyBox._branch] || GOAL_LABELS[buyBox.goal] || '\u2014') + '</td></tr>';
	html += '<tr><td class="l">Asset Classes</td><td>' + ((buyBox.assetClasses || []).join(', ') || '\u2014') + '</td></tr>';
	html += '<tr><td class="l">Strategies</td><td>' + ((buyBox.strategies || []).join(', ') || '\u2014') + '</td></tr>';
	html += '<tr><td class="l">Check Size</td><td>' + (buyBox.checkSize ? reportFormat(buyBox.checkSize, 'money') : '\u2014') + '</td></tr>';
	html += '<tr><td class="l">Max Lockup</td><td>' + (buyBox.maxLockup ? buyBox.maxLockup + ' years' : '\u2014') + '</td></tr>';
	html += '<tr><td class="l">Distribution Pref</td><td>' + (buyBox.distributions || '\u2014') + '</td></tr>';
	html += '</tbody></table></div>';

	html += '<div class="rs"><h2>2. Deal Overview</h2><table class="rt"><tbody>';
	html += '<tr><td class="l">Deal Name</td><td>' + (deal.investmentName || deal.name || '\u2014') + '</td></tr>';
	html += '<tr><td class="l">Operator</td><td>' + getDealOperatorName(deal, '\u2014') + '</td></tr>';
	html += '<tr><td class="l">Asset Class</td><td>' + (deal.assetClass || '\u2014') + '</td></tr>';
	html += '<tr><td class="l">Deal Type</td><td>' + (deal.dealType || '\u2014') + '</td></tr>';
	html += '<tr><td class="l">Strategy</td><td>' + (deal.strategy || '\u2014') + '</td></tr>';
	html += '<tr><td class="l">Target IRR</td><td>' + (deal.targetIRR ? reportFormat(deal.targetIRR, 'pct') : '\u2014') + '</td></tr>';
	html += '<tr><td class="l">Pref Return</td><td>' + (deal.preferredReturn ? reportFormat(deal.preferredReturn, 'pct') : '\u2014') + '</td></tr>';
	html += '<tr><td class="l">Cash-on-Cash</td><td>' + (deal.cashOnCash ? reportFormat(deal.cashOnCash, 'pct') : '\u2014') + '</td></tr>';
	html += '<tr><td class="l">Equity Multiple</td><td>' + (deal.equityMultiple ? reportFormat(deal.equityMultiple, 'multiple') : '\u2014') + '</td></tr>';
	html += '<tr><td class="l">Hold Period</td><td>' + (deal.holdPeriod ? deal.holdPeriod + ' Years' : '\u2014') + '</td></tr>';
	html += '<tr><td class="l">Offering Size</td><td>' + (deal.offeringSize ? reportFormat(deal.offeringSize, 'money') : '\u2014') + '</td></tr>';
	html += '<tr><td class="l">Min Investment</td><td>' + (deal.investmentMinimum ? reportFormat(deal.investmentMinimum, 'money') : '\u2014') + '</td></tr>';
	html += '<tr><td class="l">Distributions</td><td>' + (deal.distributions || '\u2014') + '</td></tr>';
	html += '<tr><td class="l">Debt Position</td><td>' + (deal.debtPosition || '\u2014') + '</td></tr>';
	html += '<tr><td class="l">Offering Type</td><td>' + (deal.offeringType || '\u2014') + '</td></tr>';
	html += '</tbody></table></div>';

	if (buyBoxChecks.length > 0) {
		const matchedCount = buyBoxChecks.filter((check) => check.match).length;
		html += '<div class="rs"><h2>3. Buy Box Alignment <span class="mb">' + matchedCount + '/' + buyBoxChecks.length + ' match</span></h2><table class="rt"><tbody>';
		buyBoxChecks.forEach((check) => {
			const icon = check.match ? '<span class="cy">\u2713</span>' : '<span class="cn">\u2717</span>';
			html += '<tr><td style="width:24px;text-align:center;">' + icon + '</td><td class="l">' + check.label + '</td><td>' + (check.got || '\u2014') + (check.want ? ' (want: ' + check.want + ')' : '') + '</td></tr>';
		});
		html += '</tbody></table></div>';
	} else {
		html += '<div class="rs"><h2>3. Buy Box Alignment</h2><p class="mu">Set up your Buy Box to see alignment.</p></div>';
	}

	html += '<div class="rs"><h2>4. Deal Fit Analysis</h2>';
	if (dealFit) {
		html += '<p style="font-weight:700;color:' + dealFit.verdictColor + ';margin-bottom:8px;">' + dealFit.verdict + ' (score: ' + (dealFit.score >= 0 ? '+' : '') + dealFit.score + ')</p>';
		if (dealFit.fits.length) {
			html += '<p style="font-weight:600;margin-bottom:4px;color:#16a34a;">Strengths</p><ul class="rl">';
			dealFit.fits.forEach((fit) => { html += '<li>' + fit + '</li>'; });
			html += '</ul>';
		}
		if (dealFit.warnings.length) {
			html += '<p style="font-weight:600;margin:8px 0 4px;color:#dc2626;">Concerns</p><ul class="rl">';
			dealFit.warnings.forEach((warning) => { html += '<li>' + warning + '</li>'; });
			html += '</ul>';
		}
	} else {
		html += '<p class="mu">Insufficient data to analyze deal fit.</p>';
	}
	html += '</div>';

	html += '<div class="rs"><h2>5. Fee Structure</h2>';
	if (deal.fees) {
		html += '<p>' + String(deal.fees).replace(/\n/g, '<br>') + '</p>';
	} else {
		html += '<p class="mu">Fee data not available for this deal.</p>';
	}
	html += '</div>';

	html += '<div class="rs"><h2>6. Projected Cash Flow</h2>';
	if (cfRows.length > 0) {
		html += '<p class="mu" style="margin-bottom:8px;">Based on ' + reportFormat(cfInvestment, 'money') + ' invested at ' + reportFormat(cfYieldRate, 'pct') + ' ' + (isCredit ? 'yield' : 'pref return') + ' over ' + cfHold + ' years</p>';
		html += '<table class="rt cf"><thead><tr><th>Year</th><th>Distributions</th><th>Capital Return</th><th>Cumulative</th><th>Note</th></tr></thead><tbody>';
		cfRows.forEach((row) => {
			html += '<tr><td>Year ' + row.year + '</td><td>' + reportFormat(row.dist, 'money') + '</td><td>' + (row.capReturn > 0 ? reportFormat(row.capReturn, 'money') : '\u2014') + '</td><td>' + reportFormat(row.cumDist, 'money') + '</td><td>' + (row.note || '') + '</td></tr>';
		});
		html += '</tbody></table><p style="margin-top:8px;font-size:13px;"><strong>Total Cash Returned:</strong> ' + reportFormat(cfTotalCash, 'money') + ' &nbsp; <strong>Avg Cash-on-Cash:</strong> ' + cfAvgCoC.toFixed(1) + '%</p>';
	} else {
		html += '<p class="mu">Projected cash flow data not available.</p>';
	}
	html += '</div>';

	html += '<div class="rs"><h2>7. Background Check Summary</h2>';
	if (bgCheck) {
		const statusLabel = bgCheck.overallStatus === 'clear' ? 'Clear' : bgCheck.overallStatus === 'flagged' ? 'Flagged' : 'Pending';
		const statusColor = bgCheck.overallStatus === 'clear' ? '#16a34a' : bgCheck.overallStatus === 'flagged' ? '#dc2626' : '#f59e0b';
		html += '<p style="margin-bottom:8px;"><strong>Overall Status:</strong> <span style="color:' + statusColor + ';font-weight:700;">' + statusLabel + '</span></p>';
		const backgroundItems = [
			{ label: 'SEC Registration', value: bgCheck.secRegistration },
			{ label: 'Legal / Litigation', value: bgCheck.legalHistory },
			{ label: 'Regulatory', value: bgCheck.regulatoryHistory },
			{ label: 'Bankruptcy', value: bgCheck.bankruptcy }
		];
		html += '<table class="rt"><tbody>';
		backgroundItems.forEach((item) => {
			if (item.value != null) {
				const normalizedStatus = typeof item.value === 'string' ? item.value : item.value?.status || 'pending';
				const color = normalizedStatus === 'clear' ? '#16a34a' : normalizedStatus === 'flagged' ? '#dc2626' : '#f59e0b';
				html += '<tr><td class="l">' + item.label + '</td><td style="color:' + color + ';font-weight:600;">' + normalizedStatus.charAt(0).toUpperCase() + normalizedStatus.slice(1) + '</td></tr>';
			}
		});
		html += '</tbody></table>';
		if (bgCheck.notes) html += '<p style="margin-top:8px;font-size:12px;color:#666;">' + bgCheck.notes + '</p>';
	} else {
		html += '<p class="mu">Background check data not available.</p>';
	}
	html += '</div>';

	if (!isCredit && stResults) {
		html += '<div class="rs"><h2>8. Stress Test Scenario</h2>';
		html += '<p class="mu" style="margin-bottom:8px;">Rent Growth: ' + stRentGrowth + '% | Exit Cap: ' + stExitCap + '% | Vacancy: ' + stVacancy + '% | Interest: ' + stInterest + '% | Hold: ' + stHold + ' yrs</p>';
		html += '<table class="rt"><tbody>';
		html += '<tr><td class="l">Projected IRR</td><td>' + (stResults.irr * 100).toFixed(1) + '%</td></tr>';
		html += '<tr><td class="l">Equity Multiple</td><td>' + stResults.em.toFixed(2) + 'x</td></tr>';
		html += '<tr><td class="l">Avg Annual Cash Flow</td><td>' + reportFormat(stResults.annualCF, 'money') + '</td></tr>';
		html += '<tr><td class="l">Total Distributions</td><td>' + reportFormat(stResults.totalDist, 'money') + '</td></tr>';
		html += '<tr><td class="l">Sale Proceeds</td><td>' + reportFormat(stResults.saleProceeds, 'money') + '</td></tr>';
		html += '<tr><td class="l">Total Return</td><td>' + reportFormat(stResults.totalReturn, 'money') + '</td></tr>';
		html += '</tbody></table></div>';
	}

	const css = '*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; } body { font-family: "Source Sans 3", "Source Sans Pro", -apple-system, sans-serif; color: #1a1a1a; line-height: 1.5; padding: 40px; max-width: 800px; margin: 0 auto; } .rh { text-align: center; margin-bottom: 40px; padding-bottom: 24px; border-bottom: 2px solid #51be7b; } .rh h1 { font-family: "DM Serif Display", Georgia, serif; font-size: 28px; font-weight: 400; margin-bottom: 4px; } .rh .dn { font-size: 18px; color: #51be7b; font-weight: 600; margin-bottom: 8px; } .rh .mt { font-size: 12px; color: #888; } .rh .br { font-size: 11px; color: #aaa; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 12px; } .rs { margin-bottom: 28px; page-break-inside: avoid; } .rs h2 { font-family: -apple-system, "Segoe UI", sans-serif; font-size: 14px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: #1a1a1a; margin-bottom: 12px; padding-bottom: 6px; border-bottom: 1px solid #e5e5e5; } .mb { font-size: 12px; font-weight: 700; color: #51be7b; text-transform: none; letter-spacing: 0; margin-left: 8px; } .rt { width: 100%; border-collapse: collapse; font-size: 13px; } .rt td, .rt th { padding: 6px 12px; text-align: left; border-bottom: 1px solid #f0f0f0; } .rt .l { color: #666; font-weight: 500; width: 40%; } .rt th { font-weight: 700; font-size: 11px; text-transform: uppercase; letter-spacing: 0.3px; color: #888; border-bottom: 2px solid #e5e5e5; } .cf td:not(:first-child), .cf th:not(:first-child) { text-align: right; } .cy { color: #51be7b; font-weight: 700; font-size: 16px; } .cn { color: #d04040; font-weight: 700; font-size: 16px; } .rl { padding-left: 20px; font-size: 13px; } .rl li { margin-bottom: 4px; } .mu { color: #888; font-size: 12px; } .rf { text-align: center; margin-top: 40px; padding-top: 16px; border-top: 1px solid #e5e5e5; font-size: 11px; color: #aaa; } @media print { body { padding: 20px; } .no-print { display: none !important; } @page { margin: 0.75in; } }';

	return (
		'<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Investment Report \u2014 '
		+ (deal.investmentName || deal.name || 'Deal')
		+ '</title><style>' + css + '</style></head><body>'
		+ '<div class="rh"><div class="br">Grow Your Cashflow</div><h1>Investment Report</h1><div class="dn">' + (deal.investmentName || deal.name || 'Deal') + '</div><div class="mt">Prepared for ' + reportUserName + ' &middot; ' + reportDate + '</div></div>'
		+ html
		+ '<div class="rf">Generated by GYC Dealflow &middot; growyourcashflow.io</div>'
		+ '<div class="no-print" style="text-align:center;margin-top:24px;"><button onclick="window.print()" style="padding:12px 32px;background:#51be7b;color:#fff;border:none;border-radius:8px;font-size:14px;font-weight:700;cursor:pointer;">Save as PDF</button></div>'
		+ '</body></html>'
	);
}

function reportFormat(value, type) {
	if (value == null || value === '' || value === '---') return '\u2014';
	if (type === 'pct') {
		const numericValue = typeof value === 'number' ? value : parseFloat(value);
		if (Number.isNaN(numericValue)) return '\u2014';
		return (numericValue > 1 ? numericValue : numericValue * 100).toFixed(1) + '%';
	}
	if (type === 'money') {
		const numericValue = typeof value === 'string' ? parseFloat(value.replace(/[$,]/g, '')) : value;
		if (Number.isNaN(numericValue)) return '\u2014';
		if (numericValue >= 1e9) return '$' + (numericValue / 1e9).toFixed(1) + 'B';
		if (numericValue >= 1e6) return '$' + (numericValue / 1e6).toFixed(1) + 'M';
		if (numericValue >= 1e3) return '$' + Math.round(numericValue).toLocaleString();
		return '$' + numericValue.toLocaleString();
	}
	if (type === 'multiple') {
		const numericValue = typeof value === 'number' ? value : parseFloat(value);
		if (Number.isNaN(numericValue)) return '\u2014';
		return numericValue.toFixed(2) + 'x';
	}
	return String(value);
}
