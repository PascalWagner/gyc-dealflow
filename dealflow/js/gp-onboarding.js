// ========== GP Onboarding Wizard ==========
// Controls the multi-step GP onboarding flow: role fork → welcome → company →
// IR contact → deal upload → presentation → checklist → LP buy box prompt.

(function() {
  'use strict';

  // ── Auth ──
  var user = JSON.parse(localStorage.getItem('gycUser') || 'null');
  if (!user || !user.token || user.token === 'local-session') {
    localStorage.removeItem('gycUser');
    window.location.href = 'deal-login.html';
    return;
  }

  var headers = {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer ' + user.token
  };

  // ── State ──
  var state = {
    currentStep: 0,
    selectedRole: null,
    companyId: null,
    companyData: null,
    irSelf: false,
    dealUploaded: false,
    dealSkipped: false,
    presentationInterest: null,
    networkStats: null,
    onboardingData: null
  };

  // Asset class options
  var ASSET_CLASSES = [
    'Multi-Family', 'Self Storage', 'Industrial', 'Mobile Home Parks',
    'Hotels/Hospitality', 'Retail', 'Office', 'Senior Living',
    'Student Housing', 'Medical Office', 'Data Centers', 'Lending',
    'Short Term Rental', 'Land', 'Mixed Use', 'Build-to-Rent'
  ];
  var selectedAssetClasses = [];

  // ── Init ──
  initAssetClassPills();
  loadOnboardingState();
  loadNetworkStats();

  // Apply saved theme
  if (localStorage.getItem('gycTheme') === 'dark') {
    document.documentElement.classList.add('dark');
  }

  // ── Step Navigation ──
  window.goToStep = function(step) {
    // Hide all steps
    var steps = document.querySelectorAll('.step');
    for (var i = 0; i < steps.length; i++) {
      steps[i].classList.remove('active');
    }

    // Show target step
    var target = document.getElementById('step' + step);
    if (target) target.classList.add('active');
    state.currentStep = step;

    // Update progress bar
    var progressWrap = document.getElementById('progressWrap');
    var progressFill = document.getElementById('progressFill');
    if (step === 0) {
      progressWrap.style.display = 'none';
    } else {
      progressWrap.style.display = 'block';
      // Steps 1-7, map to 0-100%
      var pct = Math.min(100, Math.round(((step - 1) / 6) * 100));
      progressFill.style.width = pct + '%';
    }

    // Build checklist when reaching step 6
    if (step === 6) buildChecklist();

    // Scroll to top
    window.scrollTo(0, 0);
  };

  // ── Phase 0: Role Selection ──
  window.selectRole = function(role) {
    state.selectedRole = role;

    var lpCard = document.getElementById('roleLp');
    var gpCard = document.getElementById('roleGp');
    lpCard.classList.toggle('selected', role === 'lp');
    gpCard.classList.toggle('selected', role === 'gp');

    document.getElementById('roleNextBtn').disabled = false;
  };

  window.confirmRole = function() {
    if (!state.selectedRole) return;

    if (state.selectedRole === 'lp') {
      // Save role, then redirect to LP buy box wizard
      fetch('/api/gp-onboarding', {
        method: 'POST',
        headers: headers,
        body: JSON.stringify({ email: user.email, step: 'role-select', data: { role: 'lp' } })
      }).then(function() {
        window.location.href = 'index.html#buybox';
      }).catch(function() {
        window.location.href = 'index.html#buybox';
      });
      return;
    }

    // GP flow → save role and advance to welcome
    fetch('/api/gp-onboarding', {
      method: 'POST',
      headers: headers,
      body: JSON.stringify({ email: user.email, step: 'role-select', data: { role: 'gp' } })
    }).then(function() {
      goToStep(1);
    }).catch(function() {
      goToStep(1);
    });
  };

  // ── Phase 2a: Company Profile ──
  function initAssetClassPills() {
    var container = document.getElementById('assetClassPills');
    if (!container) return;
    var html = '';
    for (var i = 0; i < ASSET_CLASSES.length; i++) {
      var ac = ASSET_CLASSES[i];
      html += '<div class="pill-option" data-value="' + escAttr(ac) + '" onclick="toggleAssetClass(this)">' + escHtml(ac) + '</div>';
    }
    container.innerHTML = html;
  }

  window.toggleAssetClass = function(el) {
    var value = el.getAttribute('data-value');
    var idx = selectedAssetClasses.indexOf(value);
    if (idx === -1) {
      selectedAssetClasses.push(value);
      el.classList.add('selected');
    } else {
      selectedAssetClasses.splice(idx, 1);
      el.classList.remove('selected');
    }
  };

  window.saveCompanyProfile = function() {
    var companyName = document.getElementById('companyName').value.trim();
    if (!companyName) {
      document.getElementById('companyName').focus();
      return;
    }

    var data = {
      companyName: companyName,
      gpType: document.getElementById('gpType').value,
      ceo: document.getElementById('ceo').value.trim(),
      linkedinCeo: document.getElementById('linkedinCeo').value.trim(),
      website: document.getElementById('website').value.trim(),
      foundingYear: document.getElementById('foundingYear').value,
      firmType: document.getElementById('firmType').value,
      assetClasses: selectedAssetClasses
    };

    var btn = document.getElementById('companyNextBtn');
    btn.disabled = true;
    btn.textContent = 'Saving...';

    fetch('/api/gp-onboarding', {
      method: 'POST',
      headers: headers,
      body: JSON.stringify({ email: user.email, step: 'company-profile', data: data })
    })
    .then(function(r) { return r.json(); })
    .then(function(result) {
      if (result.companyId) state.companyId = result.companyId;
      btn.disabled = false;
      btn.innerHTML = 'Continue <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>';
      goToStep(3);
    })
    .catch(function(err) {
      btn.disabled = false;
      btn.innerHTML = 'Continue <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>';
      console.error('Save company error:', err);
      // Still advance — data may have saved
      goToStep(3);
    });
  };

  // ── Phase 2b: IR Contact ──
  window.toggleIrSelf = function() {
    state.irSelf = !state.irSelf;
    var check = document.getElementById('irSelfCheck');
    check.classList.toggle('checked', state.irSelf);

    if (state.irSelf) {
      document.getElementById('irContactName').value = user.name || user.full_name || '';
      document.getElementById('irContactEmail').value = user.email || '';
    }
  };

  window.saveIrContact = function() {
    var name = document.getElementById('irContactName').value.trim();
    var email = document.getElementById('irContactEmail').value.trim();

    if (!name || !email) {
      if (!name) document.getElementById('irContactName').focus();
      else document.getElementById('irContactEmail').focus();
      return;
    }

    var data = {
      irContactName: name,
      irContactEmail: email,
      bookingUrl: document.getElementById('bookingUrl').value.trim()
    };

    var btn = document.getElementById('irNextBtn');
    btn.disabled = true;
    btn.textContent = 'Saving...';

    fetch('/api/gp-onboarding', {
      method: 'POST',
      headers: headers,
      body: JSON.stringify({ email: user.email, step: 'ir-contact', data: data })
    })
    .then(function(r) { return r.json(); })
    .then(function() {
      btn.disabled = false;
      btn.innerHTML = 'Continue <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>';
      goToStep(4);
    })
    .catch(function(err) {
      btn.disabled = false;
      btn.innerHTML = 'Continue <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>';
      console.error('Save IR error:', err);
      goToStep(4);
    });
  };

  // ── Phase 3: Deal Upload ──
  window.showDropZone = function() {
    document.getElementById('uploadOptions').style.display = 'none';
    var dz = document.getElementById('dropZone');
    dz.style.display = 'block';
    dz.classList.add('active');

    // Click to browse
    dz.onclick = function() { document.getElementById('deckFileInput').click(); };

    // Drag events
    dz.addEventListener('dragover', function(e) {
      e.preventDefault();
      dz.classList.add('dragging');
    });
    dz.addEventListener('dragleave', function() {
      dz.classList.remove('dragging');
    });
    dz.addEventListener('drop', function(e) {
      e.preventDefault();
      dz.classList.remove('dragging');
      if (e.dataTransfer.files.length) handleDeckUpload(e.dataTransfer.files[0]);
    });

    // File input change
    document.getElementById('deckFileInput').onchange = function() {
      if (this.files.length) handleDeckUpload(this.files[0]);
    };
  };

  function handleDeckUpload(file) {
    // Show processing state
    document.getElementById('dropZone').style.display = 'none';
    document.getElementById('processingState').style.display = 'block';

    // Upload to the existing deck submission endpoint
    var formData = new FormData();
    formData.append('file', file);
    formData.append('email', user.email);
    if (state.companyId) formData.append('companyId', state.companyId);

    fetch('/api/deck-upload', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + user.token },
      body: formData
    })
    .then(function(r) { return r.json(); })
    .then(function(result) {
      state.dealUploaded = true;
      // Mark onboarding step
      return fetch('/api/gp-onboarding', {
        method: 'POST',
        headers: headers,
        body: JSON.stringify({ email: user.email, step: 'deal-uploaded', data: {} })
      });
    })
    .then(function() {
      goToStep(5);
    })
    .catch(function(err) {
      console.error('Deck upload error:', err);
      // Still advance — they can retry from dashboard
      state.dealUploaded = false;
      document.getElementById('processingState').style.display = 'none';
      document.getElementById('uploadOptions').style.display = 'grid';
      alert('Upload failed. You can try again or skip for now.');
    });
  }

  window.goToManualDeal = function() {
    // Save step first, then redirect to deal creation page
    fetch('/api/gp-onboarding', {
      method: 'POST',
      headers: headers,
      body: JSON.stringify({ email: user.email, step: 'deal-uploaded', data: {} })
    }).then(function() {
      // Redirect to deal creation with return URL
      window.location.href = 'deal-create.html?returnTo=gp-onboarding&step=5';
    }).catch(function() {
      window.location.href = 'deal-create.html?returnTo=gp-onboarding&step=5';
    });
  };

  window.skipDealUpload = function() {
    state.dealSkipped = true;
    fetch('/api/gp-onboarding', {
      method: 'POST',
      headers: headers,
      body: JSON.stringify({ email: user.email, step: 'deal-skipped', data: {} })
    }).then(function() {
      goToStep(5);
    }).catch(function() {
      goToStep(5);
    });
  };

  // ── Phase 4: Presentation Interest ──
  window.savePresentation = function(interested) {
    state.presentationInterest = interested;
    fetch('/api/gp-onboarding', {
      method: 'POST',
      headers: headers,
      body: JSON.stringify({ email: user.email, step: 'presentation', data: { interested: interested } })
    }).then(function() {
      buildChecklist();
      goToStep(6);
    }).catch(function() {
      buildChecklist();
      goToStep(6);
    });
  };

  // ── Phase 5: Completion Checklist ──
  function buildChecklist() {
    var items = [
      {
        label: 'Company profile',
        done: !!state.companyId,
        action: state.companyId ? 'Edit' : 'Set up',
        onclick: 'goToStep(2)'
      },
      {
        label: 'IR contact set',
        done: !!(document.getElementById('irContactName') && document.getElementById('irContactName').value.trim()),
        action: 'Edit',
        onclick: 'goToStep(3)'
      },
      {
        label: 'First deal uploaded',
        done: state.dealUploaded,
        skipped: state.dealSkipped,
        action: state.dealUploaded ? 'View' : 'Add deal',
        onclick: state.dealUploaded ? '' : 'goToStep(4)'
      },
      {
        label: 'Presentation interest',
        done: state.presentationInterest === true,
        skipped: state.presentationInterest === false,
        action: state.presentationInterest === true ? 'Scheduled' : 'Learn more',
        onclick: 'goToStep(5)'
      }
    ];

    var html = '';
    for (var i = 0; i < items.length; i++) {
      var item = items[i];
      var iconClass = item.done ? 'done' : (item.skipped ? 'skipped' : 'pending');
      var iconSvg = item.done
        ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>'
        : (item.skipped
          ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="5" y1="12" x2="19" y2="12"/></svg>'
          : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/></svg>');
      var statusText = item.done ? 'Complete' : (item.skipped ? 'Skipped' : 'Pending');

      html += '<li class="checklist-item">'
        + '<div class="checklist-icon ' + iconClass + '">' + iconSvg + '</div>'
        + '<div class="checklist-info">'
        + '<div class="checklist-label">' + escHtml(item.label) + '</div>'
        + '<div class="checklist-status">' + statusText + '</div>'
        + '</div>';
      if (item.onclick) {
        html += '<button class="checklist-action" onclick="' + item.onclick + '">' + escHtml(item.action) + '</button>';
      }
      html += '</li>';
    }

    document.getElementById('completionChecklist').innerHTML = html;
  }

  // ── Phase 6: LP Buy Box Prompt ──
  window.finishOnboarding = function(wantsBuyBox) {
    var step = wantsBuyBox ? 'buybox-interest' : 'complete';

    fetch('/api/gp-onboarding', {
      method: 'POST',
      headers: headers,
      body: JSON.stringify({ email: user.email, step: step, data: {} })
    }).then(function(r) { return r.json(); })
    .then(function(result) {
      if (wantsBuyBox) {
        // Redirect to the LP buy box wizard
        window.location.href = 'index.html#buybox';
      } else {
        // Go to GP dashboard
        window.location.href = 'gp-dashboard.html';
      }
    }).catch(function() {
      if (wantsBuyBox) {
        window.location.href = 'index.html#buybox';
      } else {
        window.location.href = 'gp-dashboard.html';
      }
    });
  };

  // ── Load Onboarding State (resume where they left off) ──
  function loadOnboardingState() {
    fetch('/api/gp-onboarding?email=' + encodeURIComponent(user.email), { headers: headers })
    .then(function(r) { return r.json(); })
    .then(function(data) {
      state.onboardingData = data;

      // Pre-fill company data if exists
      if (data.company) {
        state.companyId = data.company.id;
        prefillCompanyForm(data.company);
        prefillIrForm(data.company);
      }

      // Pre-fill user info
      if (data.profile) {
        state.selectedRole = data.profile.onboardingRole;
        state.presentationInterest = data.profile.presentationInterest;
      }

      if (data.dealCount > 0) {
        state.dealUploaded = true;
      }

      // Resume at the right step
      var step = (data.profile && data.profile.onboardingStep) || 0;

      // If already complete, go to dashboard
      if (data.profile && data.profile.onboardingComplete) {
        window.location.href = 'gp-dashboard.html';
        return;
      }

      // If they chose LP role, send to buy box
      if (data.profile && data.profile.onboardingRole === 'lp') {
        window.location.href = 'index.html#buybox';
        return;
      }

      // Auto-detect GP from authorized emails (skip role fork)
      if (data.company && step === 0) {
        // Their email was already in authorized_emails — skip to welcome
        state.selectedRole = 'gp';
        goToStep(1);
        return;
      }

      // Map onboarding step to UI step
      // DB steps: 0=not started, 1=role done, 2=company done, 3=IR done, 4=deal done, 5=pres done, 6=complete
      // UI steps: 0=role, 1=welcome, 2=company, 3=IR, 4=deal, 5=pres, 6=checklist, 7=LP prompt
      var stepMap = { 0: 0, 1: 1, 2: 3, 3: 4, 4: 5, 5: 6 };
      var uiStep = stepMap[step] !== undefined ? stepMap[step] : 0;
      if (uiStep > 0) goToStep(uiStep);
    })
    .catch(function(err) {
      console.error('Load onboarding state error:', err);
      // Start fresh
    });
  }

  function prefillCompanyForm(company) {
    if (company.operator_name) document.getElementById('companyName').value = company.operator_name;
    if (company.ceo) document.getElementById('ceo').value = company.ceo;
    if (company.website) document.getElementById('website').value = company.website;
    if (company.linkedin_ceo) document.getElementById('linkedinCeo').value = company.linkedin_ceo;
    if (company.founding_year) document.getElementById('foundingYear').value = company.founding_year;
    if (company.type) document.getElementById('firmType').value = company.type;

    // Pre-select asset class pills
    if (Array.isArray(company.asset_classes)) {
      selectedAssetClasses = company.asset_classes.slice();
      var pills = document.querySelectorAll('#assetClassPills .pill-option');
      for (var i = 0; i < pills.length; i++) {
        var val = pills[i].getAttribute('data-value');
        if (selectedAssetClasses.indexOf(val) !== -1) {
          pills[i].classList.add('selected');
        }
      }
    }
  }

  function prefillIrForm(company) {
    if (company.ir_contact_name) document.getElementById('irContactName').value = company.ir_contact_name;
    if (company.ir_contact_email) document.getElementById('irContactEmail').value = company.ir_contact_email;
    if (company.booking_url) document.getElementById('bookingUrl').value = company.booking_url;
  }

  // ── Load Network Stats ──
  function loadNetworkStats() {
    fetch('/api/lp-network-stats', { headers: headers })
    .then(function(r) { return r.json(); })
    .then(function(stats) {
      state.networkStats = stats;
      renderNetworkStats(stats);
    })
    .catch(function(err) {
      console.error('Network stats error:', err);
    });
  }

  function renderNetworkStats(stats) {
    // Phase 1 stats
    animateNumber('statTotalLPs', stats.totalLPs);
    animateNumber('statAccredited', stats.accreditedCount);
    animateNumber('statActive', stats.activeInvestors);
    animateNumber('statBuyBoxes', stats.completedBuyBoxes);

    // Phase 4 stats
    animateNumber('presLpCount', stats.totalLPs);

    // Asset demand bar chart
    renderAssetDemandChart(stats.topAssetClasses || []);

    // Goal distribution donut
    renderGoalDonut(stats.goalDistribution || { income: 0, tax: 0, growth: 0 });

    // Check size chart (Phase 4)
    renderCheckSizeChart(stats.capitalRanges || {});
  }

  function animateNumber(elementId, target) {
    var el = document.getElementById(elementId);
    if (!el) return;

    target = target || 0;
    var duration = 1200;
    var start = 0;
    var startTime = null;

    function step(timestamp) {
      if (!startTime) startTime = timestamp;
      var progress = Math.min((timestamp - startTime) / duration, 1);
      // Ease out
      var eased = 1 - Math.pow(1 - progress, 3);
      var current = Math.round(eased * target);
      el.textContent = current.toLocaleString();
      if (progress < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  function renderAssetDemandChart(topClasses) {
    var container = document.getElementById('assetDemandChart');
    if (!container || topClasses.length === 0) return;

    var maxCount = topClasses[0].count || 1;
    var html = '';
    var colors = ['green', 'teal', 'blue', 'green', 'teal', 'blue', 'green', 'teal'];

    for (var i = 0; i < Math.min(topClasses.length, 6); i++) {
      var ac = topClasses[i];
      var pct = Math.max(5, Math.round((ac.count / maxCount) * 100));
      html += '<div class="bar-chart-row">'
        + '<div class="bar-label">' + escHtml(ac.name) + '</div>'
        + '<div class="bar-track"><div class="bar-fill ' + colors[i] + '" style="width:' + pct + '%"></div></div>'
        + '<div class="bar-count">' + ac.count + '</div>'
        + '</div>';
    }
    container.innerHTML = html;
  }

  function renderGoalDonut(goalDist) {
    var total = goalDist.income + goalDist.tax + goalDist.growth;
    if (total === 0) return;

    var data = [
      { label: 'Income', count: goalDist.income, color: '#51BE7B' },
      { label: 'Tax Savings', count: goalDist.tax, color: '#2563EB' },
      { label: 'Growth', count: goalDist.growth, color: '#CF7A30' }
    ];

    // Draw donut segments
    var svg = document.getElementById('goalDonut');
    if (!svg) return;

    var circumference = 2 * Math.PI * 15.9;
    var offset = 0;
    var svgHtml = '<circle cx="21" cy="21" r="15.9" fill="none" stroke="var(--border-light)" stroke-width="5"/>';

    for (var i = 0; i < data.length; i++) {
      var d = data[i];
      if (d.count === 0) continue;
      var pct = d.count / total;
      var segLen = circumference * pct;
      var gap = circumference - segLen;

      svgHtml += '<circle cx="21" cy="21" r="15.9" fill="none"'
        + ' stroke="' + d.color + '" stroke-width="5"'
        + ' stroke-dasharray="' + segLen + ' ' + gap + '"'
        + ' stroke-dashoffset="' + (-offset) + '"'
        + ' transform="rotate(-90 21 21)"/>';
      offset += segLen;
    }
    svg.innerHTML = svgHtml;

    // Legend
    var legend = document.getElementById('goalLegend');
    if (!legend) return;
    var legendHtml = '';
    for (var j = 0; j < data.length; j++) {
      var d2 = data[j];
      var pctLabel = total > 0 ? Math.round((d2.count / total) * 100) : 0;
      legendHtml += '<div class="donut-legend-item">'
        + '<div class="donut-dot" style="background:' + d2.color + '"></div>'
        + d2.label + ' <span style="color:var(--text-muted);margin-left:auto;">' + pctLabel + '%</span>'
        + '</div>';
    }
    legend.innerHTML = legendHtml;
  }

  function renderCheckSizeChart(capitalRanges) {
    var container = document.getElementById('checkSizeChart');
    if (!container) return;

    var entries = Object.entries(capitalRanges);
    if (entries.length === 0) return;

    var maxCount = 1;
    for (var i = 0; i < entries.length; i++) {
      if (entries[i][1] > maxCount) maxCount = entries[i][1];
    }

    var colors = ['blue', 'teal', 'green', 'teal', 'green'];
    var html = '';
    for (var j = 0; j < entries.length; j++) {
      var label = entries[j][0];
      var count = entries[j][1];
      var pct = Math.max(5, Math.round((count / maxCount) * 100));
      html += '<div class="bar-chart-row">'
        + '<div class="bar-label">' + escHtml(label) + '</div>'
        + '<div class="bar-track"><div class="bar-fill ' + colors[j % colors.length] + '" style="width:' + pct + '%"></div></div>'
        + '<div class="bar-count">' + count + '</div>'
        + '</div>';
    }
    container.innerHTML = html;
  }

  // ── Helpers ──
  function escHtml(str) {
    if (!str) return '';
    var el = document.createElement('span');
    el.textContent = str;
    return el.innerHTML;
  }

  function escAttr(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  // ── Handle returnTo param (coming back from deal-create) ──
  var params = new URLSearchParams(window.location.search);
  if (params.get('fromDealCreate') === 'true') {
    state.dealUploaded = true;
    // Jump to presentation step
    setTimeout(function() { goToStep(5); }, 100);
  }

})();
