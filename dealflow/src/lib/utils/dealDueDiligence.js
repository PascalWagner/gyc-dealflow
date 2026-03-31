import { isDebtOrLendingDeal } from '$lib/utils/dealReturns.js';

export const DD_CHECKLIST_CREDIT = {
	label: 'Debt/Credit Fund Template',
	sections: [
		{ title: 'Firm Basics', questions: [
			{ q: 'What is the management company name?', autoField: 'managementCompany' },
			{ q: 'Who is the CEO or primary decision-maker?', autoField: 'ceo' },
			{ q: 'Who are the key team members beyond the CEO?' },
			{ q: 'When was the firm founded?', autoField: 'mcFoundingYear' },
			{ q: 'How many employees does the management firm have?' },
			{ q: "What is the firm's AUM (assets under management)?", autoField: 'fundAUM', format: 'money' },
			{ q: 'How many funds or vehicles have they launched to date?' },
			{ q: 'Has the manager ever lost investor capital?' },
			{ q: 'Is there a key person succession/backup plan in place?' },
			{ q: 'Are there any pending litigation issues?' }
		]},
		{ title: 'Fund Basics', questions: [
			{ q: 'What is the name of the fund?', autoField: 'investmentName' },
			{ q: 'What is the story of the fund?' },
			{ q: "What is the fund's investment strategy?", autoField: 'investmentStrategy' },
			{ q: 'When was the fund founded?' },
			{ q: 'How many investors are in the fund?' },
			{ q: 'What is the max AUM allowed inside this fund?' },
			{ q: 'What is the current AUM of this fund?', autoField: 'fundAUM', format: 'money' },
			{ q: 'What specific asset classes does the fund focus on?', autoField: 'assetClass' },
			{ q: 'How has the fund strategy shifted since inception?' },
			{ q: 'How much does the sponsor co-invest in this fund?' },
			{ q: 'What geographic markets does the fund operate in?', autoField: 'investingGeography' },
			{ q: 'How diversified is the fund by geography?' },
			{ q: 'How diversified is the fund by borrower/loan/project type?' },
			{ q: 'What percentage is concentrated in any single borrower or project?' }
		]},
		{ title: 'Fund Performance & Structure', questions: [
			{ q: 'What is the target IRR?', autoField: 'targetIRR', format: 'pct' },
			{ q: 'What is the preferred return offered?', autoField: 'preferredReturn', format: 'pct' },
			{ q: "What was the fund's return in 2024?" },
			{ q: "What was the fund's return in 2023?" },
			{ q: "What was the fund's return in 2022?" },
			{ q: 'How often are returns distributed?', autoField: 'distributions' },
			{ q: 'What is the current leverage ratio of the fund?' },
			{ q: 'What is the maximum leverage permitted by the fund documents?' },
			{ q: 'What is the fee structure (management, performance, other)?' },
			{ q: 'Is the fund open-ended or closed-ended?' },
			{ q: 'Has the fund experienced any capital calls or pauses in distributions?' }
		]},
		{ title: 'Loan Details', questions: [
			{ q: 'How are loans underwritten -- what credit criteria are used?' },
			{ q: 'Who on the sponsor team handles acquisitions?' },
			{ q: 'What are the typical borrower profiles?' },
			{ q: 'Are the loans senior secured, mezzanine, or unsecured?', autoField: 'debtPosition' },
			{ q: 'How many loans are currently in the portfolio?', autoField: 'loanCount' },
			{ q: 'What is the average loan size?' },
			{ q: 'What is the average loan term?' },
			{ q: 'Are the loans secured and/or personally guaranteed?' },
			{ q: 'How is downside risk mitigated (personal guarantees, collateral, etc.)?' },
			{ q: 'What happens if the loan defaults or goes into foreclosure?' },
			{ q: 'What is the historical default rate?' },
			{ q: 'What is the average loan-to-value (LTV)?', autoField: 'avgLoanLTV', format: 'pct' },
			{ q: 'What is the maximum LTV allowed in the PPM?' },
			{ q: 'What is the typical interest rate charged to borrowers?' },
			{ q: 'Who services the loans?' },
			{ q: 'What percent of your borrowers are repeat?' }
		]},
		{ title: 'Investor Experience', questions: [
			{ q: 'What accreditation status is required?', autoField: 'availableTo' },
			{ q: 'What is the minimum investment?', autoField: 'investmentMinimum', format: 'money' },
			{ q: 'What is the lock-up period?', autoField: 'holdPeriod', format: 'years' },
			{ q: 'What is the redemption policy & cadence?' },
			{ q: 'Does the fund issue K-1s or 1099s?' },
			{ q: 'Are investor earnings taxed as ordinary income, capital gains, or something else?' },
			{ q: 'Is the fund subject to UBIT in a self-directed IRA?' },
			{ q: 'Is there a compounding or DRIP option available?' },
			{ q: 'How frequent are updates provided from management?' },
			{ q: 'Were tax forms sent before April 1st last year?' },
			{ q: 'Are financials audited by a third-party CPA?', autoField: 'financials' },
			{ q: 'What fund administration tools or platforms are used?' },
			{ q: 'How regularly do you update & provide access to a loan tape & fund financials?' }
		]},
		{ title: 'External Due Diligence (LP Led)', questions: [
			{ q: 'Do we have a strong relationship with the sponsor?' },
			{ q: 'Were you initially referred to this sponsor from someone you know, like, trust?' },
			{ q: 'Do you know investors that have invested with this operator in the past with positive results?' },
			{ q: 'Does Google search show any negative/positive publicity in past 12 months?' },
			{ q: 'Does the sponsor have an InvestClearly profile and are all reviews positive?' },
			{ q: 'Is the sponsor active on LinkedIn or other professional platforms?' },
			{ q: 'What do WE believe the biggest risks in the deal are?' }
		]}
	]
};

export const DD_CHECKLIST_SYNDICATION = {
	label: 'Multi-Family Syndication Template',
	sections: [
		{ title: 'Executive Summary', questions: [
			{ q: 'What is the name of the deal?', autoField: 'investmentName' },
			{ q: 'Minimum Investment', autoField: 'investmentMinimum', format: 'money' },
			{ q: 'Target Hold', autoField: 'holdPeriod', format: 'years' },
			{ q: 'Target IRR', autoField: 'targetIRR', format: 'pct' },
			{ q: 'Target Cash-on-Cash Return', autoField: 'cashOnCash', format: 'pct' },
			{ q: 'Is there a preferred return?', autoField: 'preferredReturn', format: 'pct' },
			{ q: 'Target Equity Multiple', autoField: 'equityMultiple', format: 'multiple' },
			{ q: 'Is this a 506B or 506C?', autoField: 'offeringType' },
			{ q: 'Target Equity Raise', autoField: 'offeringSize', format: 'money' },
			{ q: 'Basic business plan summary', autoField: 'investmentStrategy' }
		]},
		{ title: 'Firm Basics', questions: [
			{ q: 'What is the management company name?', autoField: 'managementCompany' },
			{ q: 'When was the firm founded?', autoField: 'mcFoundingYear' },
			{ q: 'Who is the CEO or primary decision-maker?', autoField: 'ceo' },
			{ q: "What is the firm's AUM?", autoField: 'fundAUM', format: 'money' },
			{ q: 'How many units does the firm currently have under management?' },
			{ q: 'How many deals has the sponsor acquired?' },
			{ q: 'How many deals have gone full-cycle?' },
			{ q: 'What is the average IRR of full-cycle deals?' },
			{ q: 'What is the average Equity Multiple of full-cycle deals?' },
			{ q: 'How many employees does the management firm have?' },
			{ q: 'Do we have a strong relationship with the sponsor?' },
			{ q: 'Were you initially referred to this sponsor from someone you know, like, trust?' },
			{ q: 'Do you know investors that have invested with this operator in the past?' },
			{ q: 'Does Google search show any negative/positive publicity?' },
			{ q: 'Does the sponsor have any negative/positive reviews on InvestClearly?' }
		]},
		{ title: 'Deal Basics', questions: [
			{ q: 'What is the address of the property?', autoField: 'address' },
			{ q: 'Number of units' },
			{ q: 'When was the property built?' },
			{ q: 'What is the class of the property?' },
			{ q: 'What is the current occupancy?' },
			{ q: 'How does the sponsor plan to grow NOI?' },
			{ q: '% of non-renovated units (value-add potential)' },
			{ q: 'Avg Rating & Reviews of the property' },
			{ q: 'What is the going-in cap rate?' },
			{ q: 'What is the assumed cap rate at sale?' },
			{ q: 'What is the loan size?' },
			{ q: 'Is the interest rate fixed or variable?' },
			{ q: 'What is the interest rate?' },
			{ q: 'What is the combined LTC or LTV?' },
			{ q: 'What is the loan term?' }
		]},
		{ title: 'Deal Fees & Economics', questions: [
			{ q: 'What is the LP / GP profit split?', autoField: 'lpGpSplit' },
			{ q: "What is the sponsor's acquisition fee?" },
			{ q: "What is the sponsor's annual Asset Management Fee?" },
			{ q: "What is the sponsor's transaction fee for refi or disposition?" },
			{ q: "What is the sponsor's construction management fee?" },
			{ q: 'What is the property management fee?' },
			{ q: 'Is the sponsor charging a marketing, admin, or other fee?' }
		]},
		{ title: 'Deal Details (Asked on Intro Call)', questions: [
			{ q: 'Can you describe your due diligence process to acquire this property?' },
			{ q: 'What major systems will need to be replaced during hold period?' },
			{ q: 'Will onsite staff be retained or new staff brought in?' },
			{ q: 'Will property management be in-house or 3rd party?' },
			{ q: 'What are the annual rent growth assumptions for the 1st 5 years?' },
			{ q: 'What are the annual expense growth assumptions?' },
			{ q: 'What % of the equity raise is set aside as reserves?' },
			{ q: 'What cashflow should I expect in the 1st year?' },
			{ q: 'How much depreciation should I expect in year 1 and 2?', autoField: 'firstYrDepreciation' },
			{ q: 'Is the target IRR dependent on a refinance?' },
			{ q: 'What do you believe the biggest risks in the deal are?' }
		]},
		{ title: 'Management Firm Deep Dive', questions: [
			{ q: 'Has the firm ever paused distributions?' },
			{ q: 'Has the firm ever issued a capital call?' },
			{ q: 'Has the firm ever lost investor capital?' },
			{ q: 'What % of your investors are repeat investors?' },
			{ q: 'What date did you get your K-1s out over the last 2 years?' },
			{ q: 'Who would take over management if the CEO passed away?' },
			{ q: 'How much is the firm or the CEO investing in this deal?', autoField: 'sponsorInDeal', format: 'pct' },
			{ q: 'How frequent do you expect to send out email updates?' },
			{ q: 'Have you or are you currently in any litigation?' }
		]},
		{ title: 'Post-Research Questions', questions: [
			{ q: 'What do WE believe the biggest risks in the deal are?' },
			{ q: 'Do we believe the sponsor wealthy enough to save the deal if things go wrong?' }
		]}
	]
};

export function getChecklistForDeal(deal) {
	return isDebtOrLendingDeal(deal) ? DD_CHECKLIST_CREDIT : DD_CHECKLIST_SYNDICATION;
}

export function calcDDProgress(checklist, answers = {}, deal) {
	let total = 0;
	let answered = 0;

	for (let sectionIndex = 0; sectionIndex < checklist.sections.length; sectionIndex++) {
		for (let questionIndex = 0; questionIndex < checklist.sections[sectionIndex].questions.length; questionIndex++) {
			total++;
			const question = checklist.sections[sectionIndex].questions[questionIndex];
			const key = `s${sectionIndex}q${questionIndex}`;
			const autoValue = question.autoField ? getAutoValue(deal, question.autoField, question.format) : null;
			if (autoValue || answers[key]) answered++;
		}
	}

	return { answered, total, pct: total > 0 ? Math.round((answered / total) * 100) : 0 };
}

function getAutoValue(deal, field, format) {
	if (!field) return null;
	const value = deal?.[field];
	if (value === undefined || value === null || value === '' || value === 0) return null;
	if (format === 'pct') return formatMetric(value, 'pct');
	if (format === 'money') return formatMetric(value, 'money');
	if (format === 'multiple') return formatMetric(value, 'multiple');
	if (format === 'years') return formatHoldPeriod(value);
	return String(value);
}

function formatMetric(value, type) {
	if (value === undefined || value === null || value === '') return '---';
	if (type === 'pct') {
		const numericValue = typeof value === 'number' ? value : parseFloat(value);
		if (Number.isNaN(numericValue)) return '---';
		return (numericValue > 1 ? numericValue : numericValue * 100).toFixed(1) + '%';
	}
	if (type === 'money') {
		const numericValue = typeof value === 'string' ? parseFloat(value.replace(/[$,]/g, '')) : value;
		if (Number.isNaN(numericValue)) return '---';
		if (numericValue === 0) return '$0';
		if (numericValue >= 1e9) return '$' + (numericValue / 1e9).toFixed(1) + 'B';
		if (numericValue >= 1e6) return '$' + (numericValue / 1e6).toFixed(1) + 'M';
		if (numericValue >= 1e3) return '$' + (numericValue / 1e3).toFixed(0) + 'K';
		return '$' + numericValue.toLocaleString();
	}
	if (type === 'multiple') {
		const numericValue = typeof value === 'number' ? value : parseFloat(value);
		if (Number.isNaN(numericValue)) return '---';
		return numericValue.toFixed(2) + 'x';
	}
	return String(value);
}

function formatHoldPeriod(value) {
	if (!value) return '---';
	if (typeof value === 'string' && value.toLowerCase().includes('open')) return 'Open-ended';
	const numericValue = parseFloat(value);
	if (Number.isNaN(numericValue)) return String(value);
	if (numericValue === 1) return '1 Year';
	return numericValue + ' Years';
}
