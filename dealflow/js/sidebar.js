// ========== GYC SHARED SIDEBAR ==========
// Single source of truth for sidebar across all pages.
// Usage: <script src="sidebar.js" data-page="deal"></script>
//   data-page: current page identifier for active highlighting
//   On index.html (SPA), set window.SIDEBAR_SPA = true before loading.

(function() {
  'use strict';

  // Detect context
  var scriptTag = document.currentScript;
  var currentPage = scriptTag ? scriptTag.getAttribute('data-page') : '';
  var isSPA = window.SIDEBAR_SPA === true;

  // Admin emails
  var ADMIN_EMAILS = ['pascal@growyourcashflow.com', 'pascalwagner@gmail.com', 'pascal.wagner@growyourcashflow.com', 'pascal@growyourcashflow.io', 'info@pascalwagner.com'];

  // Helper: get user from localStorage
  function getUser() {
    try { return JSON.parse(localStorage.getItem('gycUser') || 'null'); } catch(e) { return null; }
  }

  // Admin real user key — must match index.html's key
  var ADMIN_REAL_USER_KEY = '_gycAdminRealUser';

  function getAdminRealUser() {
    try {
      return JSON.parse(localStorage.getItem(ADMIN_REAL_USER_KEY) || 'null');
    } catch(e) { return null; }
  }

  function isAdmin() {
    var realUser = getAdminRealUser();
    if (realUser && realUser.email && ADMIN_EMAILS.indexOf(realUser.email.toLowerCase()) !== -1) return true;
    var user = getUser();
    return user && user.email && ADMIN_EMAILS.indexOf(user.email.toLowerCase()) !== -1;
  }

  // Navigation helper: SPA uses navigateTo(), sub-pages link to index.html#hash
  function navHref(page) {
    if (isSPA) return '#';
    return 'index.html#' + page;
  }
  function navOnclick(page) {
    if (isSPA) return 'navigateTo(\'' + page + '\'); return false';
    return '';
  }
  // Dashboard sub-pages: buybox, portfolio, taxprep all highlight Dashboard
  var dashSubPages = ['buybox', 'portfolio', 'taxprep'];
  function navClass(page) {
    var isActive = currentPage === page;
    if (page === 'dashboard' && dashSubPages.indexOf(currentPage) !== -1) isActive = true;
    return 'nav-item' + (isActive ? ' active' : '');
  }

  // SVG icons
  var icons = {
    dashboard: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/></svg>',
    buybox: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>',
    deals: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>',
    debtfunds: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="12" width="4" height="8"/><rect x="10" y="8" width="4" height="12"/><rect x="17" y="4" width="4" height="16"/></svg>',
    operators: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
    compare: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="2" x2="12" y2="22"/><rect x="2" y="4" width="8" height="16" rx="1"/><rect x="14" y="4" width="8" height="16" rx="1"/></svg>',
    assets: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>',
    portfolio: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>',
    taxprep: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>',
    academy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>',
    incomefund: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>',
    subscription: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>',
    settings: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>',
    gpdashboard: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>',
    feedback: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="16" height="16"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>',
    theme: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>',
    settingsGear: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:16px;height:16px;opacity:0.4;flex-shrink:0;"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>',
    viewAs: '<svg viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" stroke-width="2" width="12" height="12"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>',
    viewAsAmber: '<svg viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="2" width="12" height="12"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>',
    // Admin nav icons
    analytics: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>',
    analyticsBar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 20V10"/><path d="M12 20V4"/><path d="M6 20v-6"/></svg>',
    marketIntel: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>',
    devnotes: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 18l2-2-2-2"/><path d="M8 18l-2-2 2-2"/><line x1="12" y1="2" x2="12" y2="6"/><line x1="12" y1="18" x2="12" y2="22"/><polyline points="4 8 4 2 20 2 20 8"/><polyline points="4 16 4 22 20 22 20 16"/><rect x="2" y="8" width="20" height="8" rx="1"/></svg>',
    schema: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg>',
    casestudies: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>',
    manage: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>',
    outreach: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>',
    network: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M2 12h20"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>',
    growth: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>',
    transactions: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>'
  };

  // Build nav item HTML
  // Check if current user is free tier (for lock badges)
  var _sbUser = getUser();
  var _sbTier = (_sbUser && _sbUser.tier) || 'free';
  var _sbIsAdmin = isAdmin();
  var _sbIsFree = _sbTier === 'free' && !_sbIsAdmin;

  function navItem(page, icon, label, opts) {
    opts = opts || {};
    var cls = navClass(page);
    if (opts.disabled) cls += ' nav-item-disabled';
    var href = navHref(page);
    var onclick = navOnclick(page);
    var extra = '';
    if (opts.badge) extra += '<span class="nav-badge" id="' + opts.badge + '"></span>';
    if (opts.comingSoon) extra += '<span style="font-size:8px;font-weight:700;color:var(--text-muted);opacity:0.6;margin-left:auto;white-space:nowrap;" id="' + opts.comingSoon + '">COMING SOON</span>';
    if (opts.paidOnly && _sbIsFree) extra += '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="12" height="12" style="margin-left:auto;opacity:0.35;flex-shrink:0;"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>';
    var id = opts.id ? ' id="' + opts.id + '"' : '';
    var onclickAttr = onclick ? ' onclick="' + onclick + '"' : '';
    if (opts.disabled) onclickAttr = ' onclick="if(this.classList.contains(\'nav-item-disabled\')){return false;}' + (onclick ? onclick.replace(/"/g, '&quot;') : '') + '"';
    return '<a class="' + cls + '"' + id + ' href="' + href + '" data-page="' + page + '"' + onclickAttr + '>' + icon + ' ' + label + extra + '</a>';
  }

  // Build external nav item (always a direct link)
  function navItemExt(href, icon, label, opts) {
    opts = opts || {};
    var cls = 'nav-item' + (currentPage === opts.page ? ' active' : '');
    return '<a class="' + cls + '" href="' + href + '">' + icon + ' ' + label + '</a>';
  }

  // Determine theme label
  var isDark = document.documentElement.classList.contains('dark');
  var themeLabel = isDark ? 'Dark Mode' : 'Light Mode';

  // Build sidebar HTML
  var html = '<aside class="sidebar" id="sidebar">'
    + '<div class="sidebar-logo">'
    + '<div class="sidebar-logo-text">Grow Your Cashflow</div>'
    + '</div>';

  html += '<nav class="sidebar-nav">';

  // HOME
  html += '<div class="nav-section-label">Home</div>';
  html += navItem('dashboard', icons.dashboard, 'Dashboard');

  // RESEARCH
  html += '<div class="nav-section-label">Research</div>';
  html += navItem('marketintel', icons.marketIntel, 'Market Intel', { paidOnly: true });
  html += navItem('deals', icons.deals, 'Deal Flow', { badge: 'dealCountBadge' });
  html += navItem('managers', icons.operators, 'Operators');

  // SUPPORT
  html += '<div class="nav-section-label">Support</div>';
  html += navItem('academy', icons.academy, 'Cash Flow Academy', { id: 'navAcademy' });
  if (isSPA) {
    html += '<a class="nav-item" href="#" id="navIncomeFund" onclick="event.preventDefault();navigateTo(\'incomefund\')">' + icons.incomefund + ' GYC Income Fund</a>';
  } else {
    html += navItemExt('index.html#incomefund', icons.incomefund, 'GYC Income Fund');
  }

  // GP PORTAL
  html += '<div id="' + (isSPA ? 'gpNav' : 'gpNavSidebar') + '" style="display:none;">'
    + '<div class="nav-section-label">GP Portal</div>'
    + navItemExt('gp-dashboard.html', icons.gpdashboard, 'GP Dashboard', { page: 'gpdashboard' })
    + '<a class="nav-item" id="' + (isSPA ? 'gpOnboardingLink' : 'gpOnboardingLinkSidebar') + '" href="onboarding.html" style="display:none;">' + icons.buybox + ' Onboarding</a>'
    + '</div>';

  // ACCOUNT (push to bottom)
  html += '<div style="margin-top:auto;"></div>';
  html += navItem('settings', icons.settings, 'Settings');

  // ADMIN NAV
  html += '<div id="' + (isSPA ? 'adminNav' : 'adminNavSidebar') + '" style="display:none;">'
    + '<div class="nav-section-label">Admin</div>';
  var adminPages = [
    ['admindash', icons.schema, 'Admin Dashboard'],
    ['casestudies', icons.casestudies, 'Member Success'],
    ['admin-manage', icons.manage, 'Manage Data']
  ];
  adminPages.forEach(function(p) {
    html += navItem(p[0], p[1], p[2]);
  });
  html += '</div>';

  html += '</nav>';

  // ADMIN VIEW-AS
  html += '<div id="adminViewAs" style="display:none;padding:0 16px;margin-bottom:4px;">'
    + '<div id="viewAsImpersonating" style="display:none;background:#f59e0b22;border:1px solid #f59e0b44;border-radius:var(--radius-sm);padding:8px 10px;margin-bottom:4px;">'
    + '<div style="display:flex;align-items:center;gap:6px;margin-bottom:4px;">'
    + icons.viewAsAmber
    + '<span style="font-size:10px;font-weight:700;color:#f59e0b;text-transform:uppercase;letter-spacing:0.5px;">Viewing as</span>'
    + '</div>'
    + '<div style="font-size:12px;font-weight:700;color:var(--text-dark);" id="viewAsName"></div>'
    + '<div style="font-size:10px;color:var(--text-muted);margin-bottom:6px;" id="viewAsEmail"></div>'
    + '<button onclick="exitViewAs()" style="width:100%;padding:4px 8px;background:transparent;border:1px solid var(--border);border-radius:var(--radius-sm);font-family:var(--font-ui);font-size:10px;font-weight:700;cursor:pointer;color:var(--text-secondary);display:flex;align-items:center;justify-content:center;gap:4px;">'
    + '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="10" height="10"><polyline points="15 18 9 12 15 6"/></svg>'
    + 'Back to My Account</button>'
    + '</div>'
    + '<div id="viewAsSearch" style="position:relative;">'
    + '<div style="display:flex;align-items:center;gap:6px;cursor:pointer;padding:4px 0;" onclick="toggleViewAsDropdown()">'
    + icons.viewAs
    + '<span style="font-family:var(--font-ui);font-size:10px;font-weight:600;color:var(--text-muted);">View as another user</span>'
    + '</div>'
    + '<div id="viewAsDropdown" style="display:none;position:absolute;bottom:100%;left:0;right:0;background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius);box-shadow:0 -8px 24px rgba(0,0,0,0.15);z-index:100;margin-bottom:4px;overflow:hidden;min-width:200px;">'
    + '<div style="padding:8px;">'
    + '<input id="viewAsInput" type="text" placeholder="Search by name or email..." oninput="searchViewAsUsers(this.value)" style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:var(--radius-sm);background:var(--bg-main);font-family:var(--font-body);font-size:12px;color:var(--text-dark);box-sizing:border-box;" />'
    + '</div>'
    + '<div id="viewAsResults" style="max-height:200px;overflow-y:auto;"></div>'
    + '</div>'
    + '</div>'
    + '</div>';

  // FOOTER
  html += '<div class="sidebar-footer">';
  if (isSPA) {
    html += '<a href="#" onclick="event.preventDefault();showFeedbackModal();" style="font-family:var(--font-ui);font-size:13px;font-weight:500;color:var(--text-sidebar);text-decoration:none;display:flex;align-items:center;gap:10px;padding:4px 0;transition:opacity var(--transition);opacity:0.8;" onmouseover="this.style.opacity=\'1\'" onmouseout="this.style.opacity=\'0.8\'">'
      + icons.feedback + ' Send Feedback</a>';
  } else {
    html += '<a href="#" onclick="event.preventDefault();window.open(\'mailto:pascal@growyourcashflow.io?subject=Dealflow Feedback\',\'_blank\')" style="font-family:var(--font-ui);font-size:13px;font-weight:500;color:var(--text-sidebar);text-decoration:none;display:flex;align-items:center;gap:10px;padding:4px 0;transition:opacity var(--transition);opacity:0.8;" onmouseover="this.style.opacity=\'1\'" onmouseout="this.style.opacity=\'0.8\'">'
      + icons.feedback + ' Send Feedback</a>';
  }
  html += '<div class="theme-toggle" onclick="sidebarToggleTheme()" style="padding:4px 0;">'
    + icons.theme
    + '<span id="sidebarThemeLabel">' + themeLabel + '</span>'
    + '<div class="toggle-track' + (isDark ? ' on' : '') + '" id="themeToggle"><div class="toggle-thumb"></div></div>'
    + '</div>';
  html += '</div>';

  // USER
  var settingsClick = isSPA ? ' onclick="navigateTo(\'settings\')"' : ' onclick="window.location.href=\'index.html#settings\'"';
  html += '<div class="sidebar-user" id="sidebarUser" style="display:none;cursor:pointer;"' + settingsClick + '>'
    + '<div class="sidebar-user-avatar" id="sidebarAvatar">PW</div>'
    + '<div class="sidebar-user-info">'
    + '<div class="sidebar-user-name" id="sidebarName">User</div>'
    + '<div class="sidebar-user-tier" id="sidebarTier" style="font-family:var(--font-ui);font-size:11px;font-weight:600;color:#51BE7B;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;"></div>'
    + '</div>'
    + icons.settingsGear
    + '</div>';

  html += '</aside>';

  // Sidebar overlay for mobile
  html += '<div class="sidebar-backdrop" id="sidebarBackdrop" style="display:none;position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.4);z-index:99;backdrop-filter:blur(2px);-webkit-backdrop-filter:blur(2px);" onclick="sidebarClose()"></div>';

  // Inject into page
  var container = document.getElementById('sidebar-root');
  if (container) {
    container.innerHTML = html;
  } else {
    // Insert at the beginning of body
    document.body.insertAdjacentHTML('afterbegin', html);
  }

  // ========== GLOBAL FUNCTIONS ==========

  // Theme toggle
  window.sidebarToggleTheme = function() {
    document.documentElement.classList.toggle('dark');
    var track = document.getElementById('themeToggle');
    if (track) track.classList.toggle('on');
    var label = document.getElementById('sidebarThemeLabel');
    var nowDark = document.documentElement.classList.contains('dark');
    if (label) label.textContent = nowDark ? 'Dark Mode' : 'Light Mode';
    localStorage.setItem('gycTheme', nowDark ? 'dark' : 'light');
    // Call page-specific toggleTheme if it exists (index.html has extra logic)
    if (typeof window.toggleTheme === 'function') window.toggleTheme();
  };

  // Sidebar mobile toggle
  window.sidebarToggle = function() {
    var sidebar = document.getElementById('sidebar');
    var backdrop = document.getElementById('sidebarBackdrop');
    if (sidebar) sidebar.classList.toggle('open');
    if (backdrop) backdrop.style.display = sidebar && sidebar.classList.contains('open') ? 'block' : 'none';
  };

  window.sidebarClose = function() {
    var sidebar = document.getElementById('sidebar');
    var backdrop = document.getElementById('sidebarBackdrop');
    if (sidebar) sidebar.classList.remove('open');
    if (backdrop) backdrop.style.display = 'none';
    // Also handle legacy overlay
    var overlay = document.getElementById('sidebarOverlay');
    if (overlay) overlay.classList.remove('open');
  };

  // Keep legacy function names working
  window.toggleSidebar = window.sidebarToggle;
  window.closeSidebar = window.sidebarClose;

  // Auth init
  window.sidebarInitAuth = function() {
    var user = getUser();
    var userEl = document.getElementById('sidebarUser');
    if (!userEl) return;

    if (user && user.email) {
      userEl.style.display = 'flex';
      var name = user.name || ((user.firstName || '') + ' ' + (user.lastName || '')).trim() || user.email.split('@')[0];
      name = name.split(' ').map(function(w) { return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase(); }).join(' ');
      var initials = name.split(' ').map(function(n) { return n[0]; }).join('').toUpperCase().slice(0, 2);
      document.getElementById('sidebarAvatar').textContent = initials;
      document.getElementById('sidebarName').textContent = name;
      var sidebarTierEl = document.getElementById('sidebarTier');
      if (sidebarTierEl) {
        var t = (user.tier || 'free');
        var tLabel = t === 'academy' ? 'Academy Member' : t === 'alumni' ? 'Alumni' : t === 'investor' ? 'Investor' : t === 'family_office' ? 'Family Office' : 'Free Plan';
        var tColor = t !== 'free' ? '#51BE7B' : 'rgba(255,255,255,0.45)';
        sidebarTierEl.textContent = tLabel;
        sidebarTierEl.style.color = tColor;
      }
    } else {
      // Show sign-in prompt for non-logged-in users
      userEl.innerHTML = '<a href="deal-login.html" style="display:flex;align-items:center;gap:10px;padding:8px 12px;background:var(--primary);border-radius:8px;text-decoration:none;color:#fff;font-family:var(--font-ui);font-size:13px;font-weight:700;width:100%;box-sizing:border-box;"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/></svg>Sign Up / Log In</a>';
      userEl.style.display = 'flex';
    }

    // Show admin sections
    var adminEl = document.getElementById(isSPA ? 'adminNav' : 'adminNavSidebar');
    if (adminEl) adminEl.style.display = isAdmin() ? 'block' : 'none';

    // Show GP nav (visible to all users — non-GPs see "Apply as GP" on the dashboard)
    var gpEl = document.getElementById(isSPA ? 'gpNav' : 'gpNavSidebar');
    if (gpEl) {
      gpEl.style.display = 'block';

      // Show GP onboarding link if onboarding not complete
      var gpObLink = document.getElementById(isSPA ? 'gpOnboardingLink' : 'gpOnboardingLinkSidebar');
      if (gpObLink && user && user.onboardingRole === 'gp' && !user.gpOnboardingComplete) {
        gpObLink.style.display = 'flex';
      }
    }

    // Show admin view-as
    var viewAsEl = document.getElementById('adminViewAs');
    if (viewAsEl) viewAsEl.style.display = isAdmin() ? 'block' : 'none';

    // Enable Coming Soon items for admins
    ['navAssets', 'navAcademy'].forEach(function(id) {
      var el = document.getElementById(id);
      if (!el) return;
      var label = document.getElementById(id.replace('nav', '').toLowerCase() + 'ComingSoon');
      if (isAdmin()) {
        el.classList.remove('nav-item-disabled');
        if (label) label.style.display = 'none';
      }
    });

    // Check if impersonating
    var stored = localStorage.getItem(ADMIN_REAL_USER_KEY);
    if (stored) {
      var searchEl = document.getElementById('viewAsSearch');
      var impEl = document.getElementById('viewAsImpersonating');
      if (searchEl) searchEl.style.display = 'none';
      if (impEl) impEl.style.display = 'block';
      var currentUser = getUser();
      var nameEl = document.getElementById('viewAsName');
      var emailEl = document.getElementById('viewAsEmail');
      if (nameEl) nameEl.textContent = currentUser ? (currentUser.name || 'Unknown') : 'Unknown';
      if (emailEl) emailEl.textContent = currentUser ? (currentUser.email || '') : '';
    }
  };

  // View-as functions (for sub-pages, simplified; index.html overrides with full versions)
  if (!isSPA) {
    window.toggleViewAsDropdown = window.toggleViewAsDropdown || function() {
      var dd = document.getElementById('viewAsDropdown');
      if (!dd) return;
      if (dd.style.display === 'none') {
        dd.style.display = 'block';
        var input = document.getElementById('viewAsInput');
        if (input) input.focus();
        var results = document.getElementById('viewAsResults');
        if (results) results.innerHTML = '<div style="padding:12px;text-align:center;font-size:11px;color:var(--text-muted);">Type a name or email to search</div>';
      } else {
        dd.style.display = 'none';
      }
    };

    var viewAsTimer;
    window.searchViewAsUsers = window.searchViewAsUsers || function(query) {
      clearTimeout(viewAsTimer);
      var results = document.getElementById('viewAsResults');
      if (!results) return;
      if (query.length < 2) {
        results.innerHTML = '<div style="padding:12px;text-align:center;font-size:11px;color:var(--text-muted);">Type at least 2 characters</div>';
        return;
      }
      results.innerHTML = '<div style="padding:12px;text-align:center;font-size:11px;color:var(--text-muted);">Searching...</div>';
      viewAsTimer = setTimeout(function() {
        var adminEmail = getUser() ? getUser().email : '';
        var realAdmin = getAdminRealUser();
        if (realAdmin && realAdmin.email) { adminEmail = realAdmin.email; }
        fetch('/api/users?q=' + encodeURIComponent(query) + '&admin=' + encodeURIComponent(adminEmail))
          .then(function(r) { return r.json(); })
          .then(function(data) {
            if (!data.success || !data.contacts || !data.contacts.length) {
              results.innerHTML = '<div style="padding:12px;text-align:center;font-size:11px;color:var(--text-muted);">No users found</div>';
              return;
            }
            results.innerHTML = data.contacts.map(function(c) {
              var ini = c.name.split(' ').map(function(n) { return n[0]; }).join('').toUpperCase().slice(0, 2);
              var tierBadge = c.tier === 'academy' ? '<span style="font-size:8px;font-weight:700;color:var(--primary);text-transform:uppercase;">Academy</span>'
                : c.tier === 'alumni' ? '<span style="font-size:8px;font-weight:700;color:#8b5cf6;text-transform:uppercase;">Alumni</span>'
                : c.tier === 'investor' ? '<span style="font-size:8px;font-weight:700;color:#3b82f6;text-transform:uppercase;">Investor</span>'
                : '<span style="font-size:8px;font-weight:700;color:var(--text-muted);text-transform:uppercase;">Free</span>';
              return '<div onclick="viewAsUser(\'' + c.email.replace(/'/g, "\\'") + '\', \'' + c.name.replace(/'/g, "\\'") + '\', \'' + c.id + '\', \'' + (c.tier || 'free') + '\', \'' + (c.firstName || '').replace(/'/g, "\\'") + '\', \'' + (c.lastName || '').replace(/'/g, "\\'") + '\')" style="padding:8px 12px;cursor:pointer;display:flex;align-items:center;gap:10px;transition:background var(--transition);" onmouseover="this.style.background=\'var(--bg-main)\'" onmouseout="this.style.background=\'\'">'
                + '<div style="width:28px;height:28px;border-radius:50%;background:var(--primary);color:#fff;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:800;flex-shrink:0;">' + ini + '</div>'
                + '<div style="flex:1;min-width:0;">'
                + '<div style="font-size:12px;font-weight:700;color:var(--text-dark);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + c.name + '</div>'
                + '<div style="display:flex;align-items:center;gap:6px;"><span style="font-size:10px;color:var(--text-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + c.email + '</span>' + tierBadge + '</div>'
                + '</div></div>';
            }).join('');
          })
          .catch(function() {
            results.innerHTML = '<div style="padding:12px;text-align:center;font-size:11px;color:#e74c3c;">Search failed. Try again.</div>';
          });
      }, 400);
    };

    window.viewAsUser = window.viewAsUser || function(email, name, contactId, tier, firstName, lastName) {
      // Save admin session
      var adminUser = JSON.parse(localStorage.getItem('gycUser'));
      localStorage.setItem(ADMIN_REAL_USER_KEY, JSON.stringify(adminUser));
      // Parse firstName/lastName from name if not provided
      if (!firstName && name) {
        var parts = name.trim().split(/\s+/);
        firstName = parts[0] || '';
        lastName = parts.slice(1).join(' ') || '';
      }
      // Swap to target user
      localStorage.setItem('gycUser', JSON.stringify({ email: email, name: name, firstName: firstName || '', lastName: lastName || '', contactId: contactId, tier: tier, token: 'impersonated' }));
      window.location.reload();
    };

    window.exitViewAs = window.exitViewAs || function() {
      var stored = localStorage.getItem(ADMIN_REAL_USER_KEY);
      if (stored) {
        localStorage.setItem('gycUser', stored);
        localStorage.removeItem(ADMIN_REAL_USER_KEY);
        window.location.reload();
      }
    };
  }

  // Expose getUser and isAdmin globally if not already defined
  if (typeof window.getUser !== 'function') {
    window.getUser = getUser;
  }
  if (typeof window.isAdmin !== 'function') {
    window.isAdmin = isAdmin;
  }

  // Logout (only define if not already defined — index.html has its own)
  if (typeof window.logout !== 'function') {
    window.logout = function() {
      localStorage.removeItem('gycUser');
      localStorage.removeItem('gycDealStages');
      localStorage.removeItem('gycPortfolio');
      localStorage.removeItem('gycGoals');
      localStorage.removeItem('gycPortfolioPlan');
      localStorage.removeItem('gycBuyBoxWizard');
      localStorage.removeItem('gycBuyBox');
      localStorage.removeItem('gycUserDeals');
      localStorage.removeItem('_gycAdminRealUser');
      sessionStorage.clear();
      window.location.href = 'deal-login.html';
    };
  }

  // Auto-init auth
  window.sidebarInitAuth();

  // Apply saved theme on load
  var savedTheme = localStorage.getItem('gycTheme');
  if (savedTheme === 'dark' && !document.documentElement.classList.contains('dark')) {
    document.documentElement.classList.add('dark');
    var track = document.getElementById('themeToggle');
    if (track) track.classList.add('on');
    var label = document.getElementById('sidebarThemeLabel');
    if (label) label.textContent = 'Dark Mode';
  }

})();
