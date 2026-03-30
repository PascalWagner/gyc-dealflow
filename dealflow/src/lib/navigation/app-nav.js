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
		label: 'Dashboard',
		icon: '<rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/>'
	},
	{
		key: 'deals',
		href: APP_ROUTES.deals,
		label: 'Deal Flow',
		icon: '<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>'
	},
	{
		key: 'resources',
		href: APP_ROUTES.resources,
		label: 'Resources',
		icon: '<polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>'
	},
	{
		key: 'more',
		href: APP_ROUTES.more,
		label: 'More',
		icon: '<circle cx="12" cy="12" r="1"/><circle cx="12" cy="5" r="1"/><circle cx="12" cy="19" r="1"/>'
	}
];

export const MORE_DASHBOARD_ITEMS = [
	{ href: APP_ROUTES.portfolio, label: 'Portfolio', moreIcon: '📊' },
	{ href: APP_ROUTES.plan, label: 'My Plan', moreIcon: '🎯' },
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
				{ page: 'dashboard', icon: 'dashboard', label: 'Dashboard' },
				{ page: 'deals', icon: 'deals', label: 'Deal Flow', badge: true }
			]
		},
		{
			label: 'Support',
			items: getSupportNavItems(options)
		}
	];
}
