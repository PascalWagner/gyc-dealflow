const entryLinks = [
	{ label: 'Name', href: '/onboarding?review=1#name' },
	{ label: 'Role', href: '/onboarding?review=1#role' },
	{ label: 'LP Goal', href: '/onboarding?review=1#lp-goal' },
	{ label: 'LP Deals', href: '/onboarding?review=1#lp-deals' },
	{ label: 'LP Baseline', href: '/onboarding?review=1#lp-baseline' },
	{ label: 'LP Complete', href: '/onboarding?review=1#lp-complete' },
	{ label: 'GP Welcome', href: '/onboarding?review=1#gp' },
	{ label: 'GP Company', href: '/onboarding?review=1#gp-company' },
	{ label: 'GP Assets', href: '/onboarding?review=1#gp-assets' },
	{ label: 'GP IR', href: '/onboarding?review=1#gp-ir' },
	{ label: 'GP Agreement', href: '/onboarding?review=1#gp-agreement' },
	{ label: 'GP Upload', href: '/onboarding?review=1#gp-upload' },
	{ label: 'GP Presentation', href: '/onboarding?review=1#gp-presentation' },
	{ label: 'GP Upsell', href: '/onboarding?review=1#gp-upsell' },
	{ label: 'GP Checklist', href: '/onboarding?review=1#gp-checklist' },
	{ label: 'GP Also LP', href: '/onboarding?review=1#gp-also-lp' }
];

const lpFreeStages = [
	{ slug: 're-professional', label: 'RE Professional' },
	{ slug: 'asset-classes', label: 'Asset Classes' },
	{ slug: 'strategies', label: 'Strategies' },
	{ slug: 'risk-tolerance', label: 'Risk Tolerance' },
	{ slug: 'accreditation', label: 'Accreditation' }
];

const lpFreeBranches = [
	{ key: 'cashflow', label: 'LP Free - Cashflow' },
	{ key: 'growth', label: 'LP Free - Growth' },
	{ key: 'tax', label: 'LP Free - Tax' }
].map((group) => ({
	...group,
	links: lpFreeStages.map((stage) => ({
		label: stage.label,
		href: `/app/plan?stage=${stage.slug}&flow=free&branch=${group.key}`
	}))
}));

const lpPaidGroups = [
	{
		label: 'LP Paid - Cashflow',
		links: [
			['income-target', 'Income Target'],
			['net-worth', 'Net Worth'],
			['capital', 'Capital'],
			['source', 'Source'],
			['readiness', 'Readiness'],
			['diversification', 'Diversification'],
			['operator-focus', 'Operator Focus'],
			['lockup', 'Lockup'],
			['distributions', 'Distributions'],
			['plan', 'Plan'],
			['lp-network', 'LP Network'],
			['profile-review', 'Profile Review'],
			['completion', 'Completion']
		].map(([stage, label]) => ({
			label,
			href: `/app/plan?stage=${stage}&flow=paid_cashflow&branch=cashflow`
		}))
	},
	{
		label: 'LP Paid - Growth',
		links: [
			['growth-target', 'Growth Target'],
			['growth-priority', 'Growth Priority'],
			['net-worth', 'Net Worth'],
			['tax-baseline', 'Tax Baseline'],
			['capital', 'Capital'],
			['source', 'Source'],
			['readiness', 'Readiness'],
			['diversification', 'Diversification'],
			['operator-focus', 'Operator Focus'],
			['lockup', 'Lockup'],
			['distributions', 'Distributions'],
			['plan', 'Plan'],
			['lp-network', 'LP Network'],
			['profile-review', 'Profile Review'],
			['completion', 'Completion']
		].map(([stage, label]) => ({
			label,
			href: `/app/plan?stage=${stage}&flow=paid_growth&branch=growth`
		}))
	},
	{
		label: 'LP Paid - Tax',
		links: [
			['tax-target', 'Tax Target'],
			['tax-baseline', 'Tax Baseline'],
			['net-worth', 'Net Worth'],
			['capital', 'Capital'],
			['source', 'Source'],
			['readiness', 'Readiness'],
			['diversification', 'Diversification'],
			['operator-focus', 'Operator Focus'],
			['lockup', 'Lockup'],
			['distributions', 'Distributions'],
			['plan', 'Plan'],
			['lp-network', 'LP Network'],
			['profile-review', 'Profile Review'],
			['completion', 'Completion']
		].map(([stage, label]) => ({
			label,
			href: `/app/plan?stage=${stage}&flow=paid_tax&branch=tax`
		}))
	}
];

export const onboardingReviewGroups = [
	{
		title: 'Entry And GP',
		description: 'Current production entry flow and operator onboarding.',
		links: entryLinks
	},
	...lpFreeBranches.map((group) => ({
		title: group.label,
		description: 'Legacy LP preference screens rendered on the production route.',
		links: group.links
	})),
	...lpPaidGroups.map((group) => ({
		title: group.label,
		description: 'Production-wired paid plan flow with direct stage links.',
		links: group.links
	}))
];
