/**
 * Impersonation Test Suite
 *
 * Run from the browser console while logged in as admin (Pascal).
 * Validates that "View as User" correctly isolates all user data,
 * sidebar state, tier gates, and page content across every page.
 *
 * Usage: paste this entire script into the DevTools console.
 * Results print to console. localStorage is restored after tests.
 */
(async function impersonationTestSuite() {
  'use strict';

  // ── Config ──────────────────────────────────────────────
  const ADMIN_EMAILS = ['pascal@growyourcashflow.com', 'pascalwagner@gmail.com',
    'pascal.wagner@growyourcashflow.com', 'pascal@growyourcashflow.io', 'info@pascalwagner.com'];

  const FREE_USER = {
    email: 'test-free@impersonation-test.local',
    name: 'Test Freeuser',
    firstName: 'Test',
    lastName: 'Freeuser',
    contactId: 'imp-test-free-001',
    tier: 'free'
  };

  const ACADEMY_USER = {
    email: 'test-academy@impersonation-test.local',
    name: 'Test Academyuser',
    firstName: 'Test',
    lastName: 'Academyuser',
    contactId: 'imp-test-acad-002',
    tier: 'academy'
  };

  const ALL_PAGES = [
    'dashboard', 'buybox', 'portfolio', 'marketintel',
    'deals', 'managers', 'academy', 'incomefund', 'settings'
  ];

  const SETTINGS_TABS = ['profile', 'plan', 'investor', 'privacy', 'notifications'];

  const WAIT_MS = 300; // ms to wait after navigation for DOM to settle

  // ── Assertion lib ───────────────────────────────────────
  const results = [];
  let currentPhase = '';

  function pass(label) {
    results.push({ pass: true, label, phase: currentPhase });
    console.log('%c  ✓ ' + label, 'color:#16a34a');
  }

  function fail(label, detail) {
    const msg = detail ? label + ' (got: ' + detail + ')' : label;
    results.push({ pass: false, label: msg, phase: currentPhase });
    console.log('%c  ✗ ' + msg, 'color:#dc2626;font-weight:bold');
  }

  function assert(cond, label, detail) {
    cond ? pass(label) : fail(label, detail);
  }

  function assertEqual(actual, expected, label) {
    actual === expected ? pass(label) : fail(label, JSON.stringify(actual) + ' !== ' + JSON.stringify(expected));
  }

  function assertVisible(sel, label) {
    const el = document.getElementById(sel.replace('#', ''));
    if (!el) return fail(label || sel + ' visible', 'element not found');
    const visible = el.style.display !== 'none' && el.offsetParent !== null;
    assert(visible, label || sel + ' visible');
  }

  function assertHidden(sel, label) {
    const el = document.getElementById(sel.replace('#', ''));
    if (!el) return pass(label || sel + ' hidden (not in DOM)');
    const hidden = el.style.display === 'none' || el.offsetParent === null;
    assert(hidden, label || sel + ' hidden');
  }

  function assertInputValue(sel, expected, label) {
    const el = document.getElementById(sel.replace('#', ''));
    if (!el) return fail(label, 'element not found');
    assertEqual(el.value, expected, label);
  }

  function assertTextContains(sel, substr, label) {
    const el = document.getElementById(sel.replace('#', ''));
    if (!el) return fail(label, 'element not found');
    const text = el.textContent || '';
    assert(text.toLowerCase().includes(substr.toLowerCase()), label, 'text="' + text.trim().slice(0, 60) + '"');
  }

  function assertPageContentNotContains(pageId, substr, label) {
    const page = document.getElementById('page-' + pageId);
    if (!page) return fail(label, 'page not found');
    const text = page.textContent || '';
    assert(!text.toLowerCase().includes(substr.toLowerCase()), label);
  }

  const wait = ms => new Promise(r => setTimeout(r, ms));

  // ── Reusable checkers ───────────────────────────────────
  function assertSidebar(expectedTier, expectedNamePart, adminNavVisible) {
    const tierEl = document.getElementById('sidebarTier');
    const nameEl = document.getElementById('sidebarName');

    if (tierEl) {
      const tierText = tierEl.textContent.trim();
      assertEqual(tierText, expectedTier, 'sidebar tier = "' + expectedTier + '"');
    } else {
      fail('sidebar tier element exists');
    }

    if (nameEl) {
      const nameText = nameEl.textContent.trim().toLowerCase();
      assert(nameText.includes(expectedNamePart.toLowerCase()),
        'sidebar name contains "' + expectedNamePart + '"', 'name="' + nameEl.textContent.trim() + '"');
    } else {
      fail('sidebar name element exists');
    }

    if (adminNavVisible) {
      assertVisible('adminNav', '#adminNav visible');
    } else {
      assertHidden('adminNav', '#adminNav hidden');
    }

    // View As section should always be visible for real admin
    assertVisible('adminViewAs', '#adminViewAs visible');
  }

  function assertSidebarQuick(expectedTier, expectedNamePart, adminNavVisible, pageLabel) {
    const tierEl = document.getElementById('sidebarTier');
    const nameEl = document.getElementById('sidebarName');
    const adminNav = document.getElementById('adminNav');

    const tierOk = tierEl && tierEl.textContent.trim() === expectedTier;
    const nameOk = nameEl && nameEl.textContent.trim().toLowerCase().includes(expectedNamePart.toLowerCase());
    const navOk = adminNav && ((adminNavVisible && adminNav.style.display !== 'none') ||
      (!adminNavVisible && adminNav.style.display === 'none'));

    if (tierOk && nameOk && navOk) {
      pass(pageLabel + ': sidebar consistent');
    } else {
      if (!tierOk) fail(pageLabel + ': sidebar tier = "' + expectedTier + '"',
        tierEl ? tierEl.textContent.trim() : 'missing');
      if (!nameOk) fail(pageLabel + ': sidebar name contains "' + expectedNamePart + '"',
        nameEl ? nameEl.textContent.trim() : 'missing');
      if (!navOk) fail(pageLabel + ': adminNav ' + (adminNavVisible ? 'visible' : 'hidden'));
    }
  }

  function assertPageActive(pageId, label) {
    const el = document.getElementById('page-' + pageId);
    assert(el && el.classList.contains('active'), label || pageId + ': page active');
  }

  function assertNoAdminLeak(pageId, label) {
    // Check that admin email doesn't appear in page content
    // (excluding the viewAs section which legitimately shows the admin indicator)
    const page = document.getElementById('page-' + pageId);
    if (!page) return fail(label || pageId + ': no admin leak', 'page not found');
    // Clone and remove viewAs section to avoid false positives
    const clone = page.cloneNode(true);
    const viewAs = clone.querySelector('#adminViewAs');
    if (viewAs) viewAs.remove();
    const text = clone.textContent || '';
    const leaked = ADMIN_EMAILS.some(e => text.toLowerCase().includes(e.toLowerCase()));
    assert(!leaked, label || pageId + ': no admin email in content');
  }

  // ── Snapshot/restore ────────────────────────────────────
  function snapshotLS() {
    const snap = {};
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      snap[k] = localStorage.getItem(k);
    }
    return snap;
  }

  function restoreLS(snap) {
    // Remove keys that didn't exist in snapshot
    const toRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!(k in snap)) toRemove.push(k);
    }
    toRemove.forEach(k => localStorage.removeItem(k));
    // Restore original values
    Object.entries(snap).forEach(([k, v]) => localStorage.setItem(k, v));
  }

  // ── Stub network calls ─────────────────────────────────
  const stubs = {};
  function stubNetworkCalls() {
    const fns = ['fetchUserDataAsAdmin', 'fetchBuyBoxForUser', 'fetchBuyBoxFromGHL',
      'fetchUserDataFromSupabase', 'fetchBuyBoxForUserFromSupabase'];
    fns.forEach(fn => {
      if (typeof window[fn] === 'function') {
        stubs[fn] = window[fn];
        window[fn] = async () => {};
      }
    });
  }
  function restoreNetworkCalls() {
    Object.entries(stubs).forEach(([fn, orig]) => { window[fn] = orig; });
  }

  // ── Settings tab helper ─────────────────────────────────
  function clickSettingsTab(tabName) {
    const btn = document.querySelector('.settings-tab[data-stab="' + tabName + '"]');
    if (btn) {
      switchSettingsTab(btn);
      return true;
    }
    return false;
  }

  // ── Pre-flight check ───────────────────────────────────
  const preUser = typeof getUser === 'function' ? getUser() : null;
  if (!preUser || !preUser.email || !ADMIN_EMAILS.includes(preUser.email.toLowerCase())) {
    console.error('%c[ABORT] You must be logged in as an admin to run this test.', 'color:red;font-weight:bold');
    return { passed: 0, failed: 1, total: 1, results: [{ pass: false, label: 'Not logged in as admin', phase: 'Pre-flight' }] };
  }

  if (typeof isImpersonating === 'function' && isImpersonating()) {
    console.error('%c[ABORT] You are currently impersonating. Exit impersonation first.', 'color:red;font-weight:bold');
    return { passed: 0, failed: 1, total: 1, results: [{ pass: false, label: 'Currently impersonating', phase: 'Pre-flight' }] };
  }

  const adminEmail = preUser.email;
  const adminName = preUser.name || preUser.firstName || preUser.email.split('@')[0];
  const adminNamePart = adminName.split(' ')[0]; // first word of name for sidebar match
  const adminTier = preUser.tier || 'free';
  const adminTierLabel = adminTier === 'academy' ? 'Academy Member' : adminTier === 'alumni' ? 'Alumni'
    : adminTier === 'investor' ? 'Investor' : adminTier === 'family_office' ? 'Family Office' : 'Free Plan';

  console.log('%c\n=== Impersonation Test Suite ===\n', 'font-size:14px;font-weight:bold;color:#1f5159');
  console.log('Admin: ' + adminEmail + ' (' + adminTierLabel + ')');
  console.log('');

  const lsSnapshot = snapshotLS();
  const origAdminRealUser = window.adminRealUser;
  stubNetworkCalls();

  try {
    // ════════════════════════════════════════════════════════
    // PHASE A: Admin Baseline
    // ════════════════════════════════════════════════════════
    currentPhase = 'Phase A: Admin Baseline';
    console.group('%c' + currentPhase, 'font-weight:bold;color:#1f5159');

    assertEqual(isAdmin(), true, 'isAdmin() === true');
    assertEqual(isImpersonating(), false, 'isImpersonating() === false');
    assertEqual(isRealUserAdmin(), true, 'isRealUserAdmin() === true');
    assertSidebar(adminTierLabel, adminNamePart, true);
    assertVisible('gpNav', '#gpNav visible');

    console.groupEnd();

    // ════════════════════════════════════════════════════════
    // PHASE B: View As Free User
    // ════════════════════════════════════════════════════════
    currentPhase = 'Phase B: View As Free User';
    console.group('%c' + currentPhase, 'font-weight:bold;color:#1f5159');

    await viewAsUser(FREE_USER.email, FREE_USER.name, FREE_USER.contactId,
      FREE_USER.tier, FREE_USER.firstName, FREE_USER.lastName);
    await wait(WAIT_MS);

    // State checks
    assertEqual(isAdmin(), false, 'isAdmin() === false');
    assertEqual(isImpersonating(), true, 'isImpersonating() === true');
    assertEqual(isRealUserAdmin(), true, 'isRealUserAdmin() === true');

    const freeGycUser = JSON.parse(localStorage.getItem('gycUser') || '{}');
    assertEqual(freeGycUser.email, FREE_USER.email, 'gycUser.email = free user');
    assertEqual(freeGycUser.tier, 'free', 'gycUser.tier = free');
    assert(localStorage.getItem('_gycAdminRealUser') !== null, 'admin session saved in localStorage');

    assert(window._planSlots === null || window._planSlots === undefined, 'plan slots cleared');

    // Sidebar checks
    assertHidden('adminNav', '#adminNav hidden');
    assertHidden('gpNav', '#gpNav hidden');
    assertVisible('adminViewAs', '#adminViewAs visible');
    assertVisible('viewAsImpersonating', '#viewAsImpersonating visible');
    assertHidden('viewAsSearch', '#viewAsSearch hidden');

    assertSidebar('Free Plan', FREE_USER.firstName, false);

    console.groupEnd();

    // ════════════════════════════════════════════════════════
    // PHASE C: Navigate Every Page as Free User
    // ════════════════════════════════════════════════════════
    currentPhase = 'Phase C: Free User — Page Navigation';
    console.group('%c' + currentPhase, 'font-weight:bold;color:#1f5159');

    for (const page of ALL_PAGES) {
      navigateTo(page);
      await wait(WAIT_MS);

      assertPageActive(page, page + ': page active');
      assertSidebarQuick('Free Plan', FREE_USER.firstName, false, page);

      // Admin data leak check (skip admin-only pages and pages with static contact info)
      if (!['admindash', 'casestudies', 'admin-manage', 'incomefund'].includes(page)) {
        assertNoAdminLeak(page, page + ': no admin email leak');
      }

      // Page-specific checks
      if (page === 'buybox') {
        // Free user should see gate overlay
        const reportEl = document.getElementById('reportContent');
        if (reportEl) {
          const hasGate = reportEl.textContent.includes('Investment Plan Builder') ||
            reportEl.innerHTML.includes('backdrop-filter');
          assert(hasGate, 'buybox: free gate overlay present');
        } else {
          fail('buybox: reportContent element exists');
        }
      }

      if (page === 'settings') {
        // Check Profile tab content
        clickSettingsTab('profile');
        await wait(100);
        assertInputValue('profileFirstName', FREE_USER.firstName.charAt(0).toUpperCase() +
          FREE_USER.firstName.slice(1).toLowerCase(), 'settings/profile: firstName');
        assertInputValue('profileLastName', FREE_USER.lastName.charAt(0).toUpperCase() +
          FREE_USER.lastName.slice(1).toLowerCase(), 'settings/profile: lastName');
        assertInputValue('profileEmail', FREE_USER.email, 'settings/profile: email');

        // Check My Plan tab — Free tier should be current
        clickSettingsTab('plan');
        await wait(200);
        // initSubscription renders into #myPlanContent
        if (typeof initSubscription === 'function') initSubscription();
        await wait(100);
        const planContent = document.getElementById('myPlanContent');
        if (planContent) {
          const planText = planContent.textContent || '';
          assert(planText.includes('Free'), 'settings/plan: Free tier visible');
          // "CURRENT PLAN" should be on the Free card, not Academy
          const tierGrid = document.getElementById('tierGrid');
          if (tierGrid) {
            const cards = tierGrid.children;
            // First card (Free) should have CURRENT PLAN, second (Academy) should not
            const freeCard = cards[0];
            const academyCard = cards[1];
            if (freeCard) {
              assert(freeCard.textContent.includes('CURRENT PLAN'),
                'settings/plan: Free card is CURRENT PLAN');
            }
            if (academyCard) {
              assert(!academyCard.textContent.includes('CURRENT PLAN'),
                'settings/plan: Academy card NOT CURRENT PLAN');
            }
          }
        } else {
          fail('settings/plan: myPlanContent exists');
        }

        // Click through remaining settings tabs to verify no crash
        for (const tab of ['investor', 'privacy', 'notifications']) {
          clickSettingsTab(tab);
          await wait(100);
          assertSidebarQuick('Free Plan', FREE_USER.firstName, false, 'settings/' + tab);
        }
      }

      if (page === 'portfolio') {
        // Should show empty state or impersonated user's data, not Pascal's
        const portfolioEl = document.querySelector('#page-portfolio .content-area');
        if (portfolioEl) {
          // Check that admin-specific portfolio data isn't showing
          assertNoAdminLeak('portfolio', 'portfolio: no admin data');
        }
      }
    }

    // Dashboard sub-tabs
    navigateTo('dashboard');
    await wait(WAIT_MS);
    assertSidebarQuick('Free Plan', FREE_USER.firstName, false, 'dashboard/overview');

    navigateTo('portfolio');
    await wait(WAIT_MS);
    assertSidebarQuick('Free Plan', FREE_USER.firstName, false, 'dashboard/portfolio');

    navigateTo('buybox');
    await wait(WAIT_MS);
    assertSidebarQuick('Free Plan', FREE_USER.firstName, false, 'dashboard/myplan');

    console.groupEnd();

    // ════════════════════════════════════════════════════════
    // PHASE D: View As Academy User
    // ════════════════════════════════════════════════════════
    currentPhase = 'Phase D: Academy User';
    console.group('%c' + currentPhase, 'font-weight:bold;color:#1f5159');

    // Exit free user first
    exitViewAs();
    await wait(WAIT_MS);

    // Now impersonate academy user
    await viewAsUser(ACADEMY_USER.email, ACADEMY_USER.name, ACADEMY_USER.contactId,
      ACADEMY_USER.tier, ACADEMY_USER.firstName, ACADEMY_USER.lastName);
    await wait(WAIT_MS);

    assertEqual(isAdmin(), false, 'isAdmin() === false');
    assertEqual(isImpersonating(), true, 'isImpersonating() === true');
    assertSidebar('Academy Member', ACADEMY_USER.firstName, false);

    const acadGycUser = JSON.parse(localStorage.getItem('gycUser') || '{}');
    assertEqual(acadGycUser.email, ACADEMY_USER.email, 'gycUser.email = academy user');
    assertEqual(acadGycUser.tier, 'academy', 'gycUser.tier = academy');

    // Navigate all pages as academy user
    for (const page of ALL_PAGES) {
      navigateTo(page);
      await wait(WAIT_MS);

      assertPageActive(page, page + ': page active');
      assertSidebarQuick('Academy Member', ACADEMY_USER.firstName, false, page);

      if (!['admindash', 'casestudies', 'admin-manage', 'incomefund'].includes(page)) {
        assertNoAdminLeak(page, page + ': no admin email leak');
      }

      // Academy-specific checks: no free-tier gate should appear
      if (page === 'buybox') {
        const bbUser = JSON.parse(localStorage.getItem('gycUser') || '{}');
        assertEqual(bbUser.tier, 'academy', 'buybox: gycUser tier is academy');
        // The free gate contains "Join Academy" CTA text — this is the definitive marker
        const reportEl = document.getElementById('reportContent');
        if (reportEl) {
          assert(!reportEl.textContent.includes('Join Academy'),
            'buybox: NO free gate for academy user');
        }
      }

      if (page === 'settings') {
        clickSettingsTab('profile');
        await wait(100);
        assertInputValue('profileFirstName', ACADEMY_USER.firstName.charAt(0).toUpperCase() +
          ACADEMY_USER.firstName.slice(1).toLowerCase(), 'settings/profile: firstName');
        assertInputValue('profileEmail', ACADEMY_USER.email, 'settings/profile: email');

        clickSettingsTab('plan');
        await wait(200);
        if (typeof initSubscription === 'function') initSubscription();
        await wait(100);
        const tierGrid = document.getElementById('tierGrid');
        if (tierGrid && tierGrid.children.length >= 2) {
          const academyCard = tierGrid.children[1];
          assert(academyCard && academyCard.textContent.includes('CURRENT PLAN'),
            'settings/plan: Academy card is CURRENT PLAN');
          const freeCard = tierGrid.children[0];
          assert(freeCard && !freeCard.textContent.includes('CURRENT PLAN'),
            'settings/plan: Free card NOT CURRENT PLAN');
        } else {
          fail('settings/plan: tierGrid has cards');
        }
      }
    }

    console.groupEnd();

    // ════════════════════════════════════════════════════════
    // PHASE E: Exit Impersonation — Restore Admin
    // ════════════════════════════════════════════════════════
    currentPhase = 'Phase E: Restore Admin';
    console.group('%c' + currentPhase, 'font-weight:bold;color:#1f5159');

    exitViewAs();
    await wait(WAIT_MS);

    assertEqual(isAdmin(), true, 'isAdmin() === true');
    assertEqual(isImpersonating(), false, 'isImpersonating() === false');
    assertEqual(isRealUserAdmin(), true, 'isRealUserAdmin() === true');
    assert(localStorage.getItem('_gycAdminRealUser') === null, '_gycAdminRealUser removed');

    const restoredUser = JSON.parse(localStorage.getItem('gycUser') || '{}');
    assert(ADMIN_EMAILS.includes(restoredUser.email?.toLowerCase()), 'gycUser.email = admin');

    assertSidebar(adminTierLabel, adminNamePart, true);
    assertVisible('gpNav', '#gpNav visible');
    assertHidden('viewAsImpersonating', '#viewAsImpersonating hidden');
    assertVisible('viewAsSearch', '#viewAsSearch visible');

    // Navigate all pages as admin to verify restoration
    for (const page of ALL_PAGES) {
      navigateTo(page);
      await wait(WAIT_MS);
      assertPageActive(page, page + ': page active');
      assertSidebarQuick(adminTierLabel, adminNamePart, true, page);

      if (page === 'settings') {
        clickSettingsTab('profile');
        await wait(100);
        const emailEl = document.getElementById('profileEmail');
        if (emailEl) {
          assert(ADMIN_EMAILS.includes(emailEl.value.toLowerCase()),
            'settings/profile: admin email restored');
        }

        // Verify admin tier on My Plan
        clickSettingsTab('plan');
        await wait(200);
        if (typeof initSubscription === 'function') initSubscription();
        await wait(100);
      }

      if (page === 'buybox') {
        const reportEl = document.getElementById('reportContent');
        if (reportEl) {
          const hasGate = reportEl.textContent.includes('Investment Plan Builder') &&
            reportEl.innerHTML.includes('backdrop-filter');
          assert(!hasGate, 'buybox: NO free gate for admin');
        }
      }
    }

    console.groupEnd();

    // ════════════════════════════════════════════════════════
    // PHASE F: Edge Cases
    // ════════════════════════════════════════════════════════
    currentPhase = 'Phase F: Edge Cases';
    console.group('%c' + currentPhase, 'font-weight:bold;color:#1f5159');

    // F1: Refresh survival
    await viewAsUser(FREE_USER.email, FREE_USER.name, FREE_USER.contactId,
      FREE_USER.tier, FREE_USER.firstName, FREE_USER.lastName);
    await wait(WAIT_MS);

    // Simulate page refresh: clear in-memory state, re-init from localStorage
    window.adminRealUser = null;
    if (typeof initViewAs === 'function') initViewAs();
    if (typeof sidebarInitAuth === 'function') sidebarInitAuth();
    if (typeof showAdminNav === 'function') showAdminNav();
    await wait(100);

    assertEqual(isImpersonating(), true, 'F1: refresh — still impersonating');
    assertEqual(isAdmin(), false, 'F1: refresh — isAdmin still false');
    assertSidebarQuick('Free Plan', FREE_USER.firstName, false, 'F1: refresh');

    exitViewAs();
    await wait(WAIT_MS);

    // F2: Switch users without exiting
    await viewAsUser(FREE_USER.email, FREE_USER.name, FREE_USER.contactId,
      FREE_USER.tier, FREE_USER.firstName, FREE_USER.lastName);
    await wait(WAIT_MS);

    await viewAsUser(ACADEMY_USER.email, ACADEMY_USER.name, ACADEMY_USER.contactId,
      ACADEMY_USER.tier, ACADEMY_USER.firstName, ACADEMY_USER.lastName);
    await wait(WAIT_MS);

    const switchedUser = JSON.parse(localStorage.getItem('gycUser') || '{}');
    assertEqual(switchedUser.email, ACADEMY_USER.email, 'F2: switch — gycUser is academy user');
    assertEqual(switchedUser.tier, 'academy', 'F2: switch — tier is academy');
    assertSidebarQuick('Academy Member', ACADEMY_USER.firstName, false, 'F2: switch');

    // Free user's scoped data should have been saved
    const freeScopedKey = '_scopedBundle_' + FREE_USER.email;
    assert(localStorage.getItem(freeScopedKey) !== null, 'F2: free user scoped data saved');

    exitViewAs();
    await wait(WAIT_MS);

    assertEqual(isAdmin(), true, 'F2: exit — isAdmin restored');
    assertSidebarQuick(adminTierLabel, adminNamePart, true, 'F2: exit');

    console.groupEnd();

  } finally {
    // ── Cleanup ─────────────────────────────────────────
    restoreNetworkCalls();
    restoreLS(lsSnapshot);
    window.adminRealUser = origAdminRealUser;

    // Re-init sidebar and nav from restored state
    if (typeof sidebarInitAuth === 'function') sidebarInitAuth();
    if (typeof showAdminNav === 'function') showAdminNav();
    if (typeof initViewAs === 'function') initViewAs();
    navigateTo('dashboard');
  }

  // ── Summary ───────────────────────────────────────────
  const passed = results.filter(r => r.pass).length;
  const failed = results.filter(r => !r.pass).length;
  const total = results.length;

  console.log('');
  if (failed === 0) {
    console.log('%c=== ALL ' + total + ' TESTS PASSED ===', 'font-size:14px;font-weight:bold;color:#16a34a');
  } else {
    console.log('%c=== ' + passed + '/' + total + ' passed, ' + failed + ' FAILED ===',
      'font-size:14px;font-weight:bold;color:#dc2626');
    console.group('Failed tests:');
    results.filter(r => !r.pass).forEach(r => {
      console.log('%c  ✗ [' + r.phase + '] ' + r.label, 'color:#dc2626');
    });
    console.groupEnd();
  }

  return { passed, failed, total, results };
})();
