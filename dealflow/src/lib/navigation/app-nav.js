export const APP_ROUTES = {
	dashboard: '/app/dashboard',
	deals: '/app/deals',
	'market-intel': '/app/market-intel',
	operators: '/app/operators',
	resources: '/app/resources',
	academy: '/app/academy',
	'office-hours': '/app/office-hours',
	'income-fund': '/app/income-fund',
	settings: '/app/settings',
	admin: '/app/admin',
	'case-studies': '/app/case-studies',
	'admin-manage': '/app/admin/manage',
	outreach: '/app/admin/outreach',
	portfolio: '/app/portfolio',
	goals: '/app/goals',
	plan: '/app/plan',
	'tax-prep': '/app/tax-prep',
	assets: '/app/assets',
	'find-gp': '/app/find-gp',
	saved: '/app/saved',
	'deal-flow-stats': '/app/deal-flow-stats',
	more: '/app/more'
};

export const ADMIN_ONLY_PAGE_KEYS = ['admin', 'case-studies', 'admin-manage', 'outreach', 'market-intel', 'operators'];

export const ADMIN_NAV_ITEMS = [
	{ page: 'admin', href: APP_ROUTES.admin, icon: 'schema', label: 'Admin Dashboard', moreIcon: '🔧' },
	{ page: 'case-studies', href: APP_ROUTES['case-studies'], icon: 'casestudies', label: 'Member Success', moreIcon: '🏆' },
	{ page: 'admin-manage', href: APP_ROUTES['admin-manage'], icon: 'manage', label: 'Manage Data', moreIcon: '🗄️' },
	{ page: 'market-intel', href: APP_ROUTES['market-intel'], icon: 'marketIntel', label: 'Market Intel', moreIcon: '📈' },
	{ page: 'operators', href: APP_ROUTES.operators, icon: 'operators', label: 'Operators', moreIcon: '👥' }
];

export const PRIMARY_MOBILE_NAV_ITEMS = [
	{
		key: 'dashboard',
		href: APP_ROUTES.dashboard,
		label: 'Home',
		icon: '<rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/>'
	},
	{
		key: 'plan',
		href: APP_ROUTES.plan,
		label: 'Plan',
		icon: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r="1"/><line x1="12" y1="2" x2="12" y2="4"/><line x1="12" y1="20" x2="12" y2="22"/><line x1="2" y1="12" x2="4" y2="12"/><line x1="20" y1="12" x2="22" y2="12"/>'
	},
	{
		key: 'deals',
		href: APP_ROUTES.deals,
		label: 'Deals',
		icon: '<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>'
	},
	{
		key: 'portfolio',
		href: APP_ROUTES.portfolio,
		label: 'Portfolio',
		icon: '<rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/>'
	},
	{
		key: 'more',
		href: APP_ROUTES.more,
		label: 'More',
		icon: '<circle cx="12" cy="12" r="1"/><circle cx="12" cy="5" r="1"/><circle cx="12" cy="19" r="1"/>'
	}
];

export const MORE_DASHBOARD_ITEMS = [
	{ href: APP_ROUTES['tax-prep'], label: 'Tax Prep', moreIcon: '📄' }
];

export const MORE_ACCOUNT_ITEMS = [
	{ href: APP_ROUTES.settings, label: 'Settings', moreIcon: '⚙️' }
];

export function getSupportNavItems({
	nativeCompanionMode = false,
	canShowMemberHub = true,
	canShowOfficeHours = true
} = {}) {
	const items = [
		{
			page: 'resources',
			href: APP_ROUTES.resources,
			icon: 'academy',
			label: 'Resources',
			moreIcon: '🎬'
		}
	];

	if (canShowOfficeHours) {
		items.push({
			page: 'office-hours',
			href: APP_ROUTES['office-hours'],
			icon: 'officehours',
			label: 'Office Hours',
			moreIcon: '🕛'
		});
	}

	if (!nativeCompanionMode) {
		items.push({
			page: 'income-fund',
			href: APP_ROUTES['income-fund'],
			icon: 'incomefund',
			label: 'GYC Income Fund',
			moreIcon: '💰'
		});
	}

	if (canShowMemberHub) {
		items.push({
			page: 'academy',
			href: APP_ROUTES.academy,
			icon: 'academy',
			label: nativeCompanionMode ? 'Member Hub' : 'Cash Flow Academy',
			moreIcon: '📚'
		});
	}

	return items;
}

export function getSidebarSections(options = {}) {
	return [
		{
			label: 'Home',
			items: [
				{ page: 'dashboard', icon: 'dashboard', label: 'Home' },
				{ page: 'plan', icon: 'plan', label: 'Plan' },
				{ page: 'deals', icon: 'deals', label: 'Deals', badge: true },
				{ page: 'portfolio', icon: 'portfolio', label: 'Portfolio' }
			]
		},
		{
			label: 'Support',
			items: getSupportNavItems(options)
		}
	];
}
