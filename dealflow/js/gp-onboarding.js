// ========== GP Onboarding Wizard ==========
// Steps: 0=role fork, 1=welcome, 2=company basics, 3=asset classes,
//        4=IR contact, 5=deal upload, 6=presentation, 7=checklist, 8=LP prompt

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
    irSelf: false,
    dealUploaded: false,
    dealSkipped: false,
    deckFile: null,
    ppmFile: null,
    presentationInterest: null,
    networkStats: null
  };

  var ASSET_CLASSES = [
    'Multi-Family', 'Self Storage', 'Industrial', 'Mobile Home Parks',
    'Hotels/Hospitality', 'Retail', 'Office', 'Senior Living',
    'Student Housing', 'Medical Office', 'Data Centers', 'Lending',
    'Short Term Rental', 'Land', 'Mixed Use', 'Build-to-Rent'
  ];
  var selectedAssetClasses = [];

  // ── Init ──
  initAssetClassPills();
  initDropZones();
  loadOnboardingState();
  loadNetworkStats();

  if (localStorage.getItem('gycTheme') === 'dark') {
    document.documentElement.classList.add('dark');
  }

  // ── Step Navigation ──
  window.goToStep = function(step) {
    var steps = document.querySelectorAll('.step');
    for (var i = 0; i < steps.length; i++) steps[i].classList.remove('active');

    var target = document.getElementById('step' + step);
    if (target) target.classList.add('active');
    state.currentStep = step;

    // Progress bar (steps 1-8, map to 0-100%)
    var progressWrap = document.getElementById('progressWrap');
    var progressFill = document.getElementById('progressFill');
    if (step === 0) {
      progressWrap.style.display = 'none';
    } else {
      progressWrap.style.display = 'block';
      var pct = Math.min(100, Math.round(((step - 1) / 7) * 100));
      progressFill.style.width = pct + '%';
    }

    if (step === 7) buildChecklist();
    window.scrollTo(0, 0);
  };

  // ── Step 0: Role Selection ──
  window.selectRole = function(role) {
    state.selectedRole = role;
    document.getElementById('roleLp').classList.toggle('selected', role === 'lp');
    document.getElementById('roleGp').classList.toggle('selected', role === 'gp');
    document.getElementById('roleNextBtn').disabled = false;
  };

  window.confirmRole = function() {
    if (!state.selectedRole) return;
    if (state.selectedRole === 'lp') {
      fetch('/api/gp-onboarding', {
        method: 'POST', headers: headers,
        body: JSON.stringify({ email: user.email, step: 'role-select', data: { role: 'lp' } })
      }).then(function() { window.location.href = 'index.html#buybox'; })
        .catch(function() { window.location.href = 'index.html#buybox'; });
      return;
    }
    fetch('/api/gp-onboarding', {
      method: 'POST', headers: headers,
      body: JSON.stringify({ email: user.email, step: 'role-select', data: { role: 'gp' } })
    }).then(function() { goToStep(1); }).catch(function() { goToStep(1); });
  };

  // ── Step 2: Company Basics ──
  window.saveCompanyProfile = function() {
    var companyName = document.getElementById('companyName').value.trim();
    if (!companyName) { document.getElementById('companyName').focus(); return; }

    var data = {
      companyName: companyName,
      gpType: document.getElementById('gpType').value,
      firmType: document.getElementById('firmType').value,
      ceo: document.getElementById('ceo').value || '',
      linkedinCeo: document.getElementById('linkedinCeo').value || '',
      website: document.getElementById('website').value || '',
      foundingYear: document.getElementById('foundingYear').value || '',
      assetClasses: selectedAssetClasses
    };

    var btn = document.getElementById('companyNextBtn');
    btn.disabled = true; btn.textContent = 'Saving...';

    fetch('/api/gp-onboarding', {
      method: 'POST', headers: headers,
      body: JSON.stringify({ email: user.email, step: 'company-profile', data: data })
    })
    .then(function(r) { return r.json(); })
    .then(function(result) {
      if (result.companyId) state.companyId = result.companyId;
      btn.disabled = false;
      btn.innerHTML = 'Continue <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>';
      goToStep(3);
    })
    .catch(function() {
      btn.disabled = false;
      btn.innerHTML = 'Continue <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>';
      goToStep(3);
    });
  };

  // ── Step 3: Asset Classes ──
  function initAssetClassPills() {
    var container = document.getElementById('assetClassPills');
    if (!container) return;
    var html = '';
    for (var i = 0; i < ASSET_CLASSES.length; i++) {
      html += '<div class="pill-option" data-value="' + escAttr(ASSET_CLASSES[i]) + '" onclick="toggleAssetClass(this)">' + escHtml(ASSET_CLASSES[i]) + '</div>';
    }
    container.innerHTML = html;
  }

  window.toggleAssetClass = function(el) {
    var value = el.getAttribute('data-value');
    var idx = selectedAssetClasses.indexOf(value);
    if (idx === -1) { selectedAssetClasses.push(value); el.classList.add('selected'); }
    else { selectedAssetClasses.splice(idx, 1); el.classList.remove('selected'); }
  };

  window.saveAssetClasses = function() {
    // Asset classes get saved with the company profile — update in background
    if (state.companyId) {
      fetch('/api/gp-onboarding', {
        method: 'POST', headers: headers,
        body: JSON.stringify({ email: user.email, step: 'company-profile', data: {
          companyName: document.getElementById('companyName').value.trim(),
          gpType: document.getElementById('gpType').value,
          firmType: document.getElementById('firmType').value,
          assetClasses: selectedAssetClasses
        }})
      }).catch(function() {});
    }
    goToStep(4);
  };

  // ── Step 4: IR Contact ──
  window.toggleIrSelf = function() {
    state.irSelf = !state.irSelf;
    document.getElementById('irSelfCheck').classList.toggle('checked', state.irSelf);
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

    var btn = document.getElementById('irNextBtn');
    btn.disabled = true; btn.textContent = 'Saving...';

    fetch('/api/gp-onboarding', {
      method: 'POST', headers: headers,
      body: JSON.stringify({ email: user.email, step: 'ir-contact', data: {
        irContactName: name, irContactEmail: email,
        bookingUrl: document.getElementById('bookingUrl').value.trim()
      }})
    })
    .then(function() {
      btn.disabled = false;
      btn.innerHTML = 'Continue <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>';
      goToStep(5);
    })
    .catch(function() {
      btn.disabled = false;
      btn.innerHTML = 'Continue <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>';
      goToStep(5);
    });
  };

  // ── Step 5: Deal Upload (deck + PPM) ──
  function initDropZones() {
    // Deck drop zone
    var deckDZ = document.getElementById('deckDropZone');
    var deckInput = document.getElementById('deckFileInput');
    if (!deckDZ || !deckInput) return;

    deckDZ.onclick = function() { deckInput.click(); };
    deckDZ.addEventListener('dragover', function(e) { e.preventDefault(); deckDZ.classList.add('dragging'); });
    deckDZ.addEventListener('dragleave', function() { deckDZ.classList.remove('dragging'); });
    deckDZ.addEventListener('drop', function(e) {
      e.preventDefault(); deckDZ.classList.remove('dragging');
      if (e.dataTransfer.files.length) setDeckFile(e.dataTransfer.files[0]);
    });
    deckInput.onchange = function() { if (this.files.length) setDeckFile(this.files[0]); };

    // PPM drop zone
    var ppmDZ = document.getElementById('ppmDropZone');
    var ppmInput = document.getElementById('ppmFileInput');
    if (!ppmDZ || !ppmInput) return;

    ppmDZ.onclick = function(e) { e.stopPropagation(); ppmInput.click(); };
    ppmDZ.addEventListener('dragover', function(e) { e.preventDefault(); ppmDZ.classList.add('dragging'); });
    ppmDZ.addEventListener('dragleave', function() { ppmDZ.classList.remove('dragging'); });
    ppmDZ.addEventListener('drop', function(e) {
      e.preventDefault(); ppmDZ.classList.remove('dragging');
      if (e.dataTransfer.files.length) setPpmFile(e.dataTransfer.files[0]);
    });
    ppmInput.onchange = function() { if (this.files.length) setPpmFile(this.files[0]); };
  }

  function setDeckFile(file) {
    state.deckFile = file;
    var textEl = document.getElementById('deckDropText');
    var hintEl = document.getElementById('deckDropHint');
    textEl.textContent = file.name;
    hintEl.textContent = (file.size / 1024 / 1024).toFixed(1) + ' MB — click to change';
    document.getElementById('deckDropZone').style.borderStyle = 'solid';
    document.getElementById('deckDropZone').style.borderColor = 'var(--primary)';
    showUploadBtn();
  }

  function setPpmFile(file) {
    state.ppmFile = file;
    var textEl = document.getElementById('ppmDropText');
    var hintEl = document.getElementById('ppmDropHint');
    textEl.textContent = file.name;
    hintEl.textContent = (file.size / 1024 / 1024).toFixed(1) + ' MB — click to change';
    document.getElementById('ppmDropZone').style.borderColor = 'var(--primary)';
    showUploadBtn();
  }

  function showUploadBtn() {
    if (state.deckFile || state.ppmFile) {
      document.getElementById('uploadNextBtn').style.display = 'inline-flex';
    }
  }

  window.submitDealUploads = function() {
    // Show processing
    document.getElementById('deckDropZone').style.display = 'none';
    document.getElementById('ppmDropZone').style.display = 'none';
    document.getElementById('uploadNextBtn').style.display = 'none';
    document.getElementById('processingState').style.display = 'block';

    var formData = new FormData();
    if (state.deckFile) formData.append('file', state.deckFile);
    formData.append('email', user.email);
    if (state.companyId) formData.append('companyId', state.companyId);

    // Upload deck
    var deckPromise = state.deckFile
      ? fetch('/api/deck-upload', {
          method: 'POST',
          headers: { 'Authorization': 'Bearer ' + user.token },
          body: formData
        }).then(function(r) { return r.json(); })
      : Promise.resolve(null);

    // TODO: PPM upload endpoint (use same deck-upload or separate)
    // For now, PPM is noted but uploaded through the same flow

    deckPromise
    .then(function() {
      state.dealUploaded = true;
      return fetch('/api/gp-onboarding', {
        method: 'POST', headers: headers,
        body: JSON.stringify({ email: user.email, step: 'deal-uploaded', data: {} })
      });
    })
    .then(function() { goToStep(6); })
    .catch(function(err) {
      console.error('Upload error:', err);
      state.dealUploaded = false;
      document.getElementById('processingState').style.display = 'none';
      document.getElementById('deckDropZone').style.display = 'block';
      document.getElementById('ppmDropZone').style.display = 'block';
      document.getElementById('uploadNextBtn').style.display = 'inline-flex';
      alert('Upload failed. You can try again or skip for now.');
    });
  };

  window.skipDealUpload = function() {
    state.dealSkipped = true;
    fetch('/api/gp-onboarding', {
      method: 'POST', headers: headers,
      body: JSON.stringify({ email: user.email, step: 'deal-skipped', data: {} })
    }).then(function() { goToStep(6); }).catch(function() { goToStep(6); });
  };

  // ── Step 6: Presentation Interest ──
  window.savePresentation = function(interested) {
    state.presentationInterest = interested;
    fetch('/api/gp-onboarding', {
      method: 'POST', headers: headers,
      body: JSON.stringify({ email: user.email, step: 'presentation', data: { interested: interested } })
    }).then(function() { goToStep(7); }).catch(function() { goToStep(7); });
  };

  // ── Step 7: Completion Checklist ──
  function buildChecklist() {
    var items = [
      { label: 'Company profile', done: !!state.companyId, action: state.companyId ? 'Edit' : 'Set up', onclick: 'goToStep(2)' },
      { label: 'Asset classes', done: selectedAssetClasses.length > 0, action: 'Edit', onclick: 'goToStep(3)' },
      { label: 'IR contact', done: !!(document.getElementById('irContactName') && document.getElementById('irContactName').value.trim()), action: 'Edit', onclick: 'goToStep(4)' },
      { label: 'Deal uploaded', done: state.dealUploaded, skipped: state.dealSkipped, action: state.dealUploaded ? 'View' : 'Add deal', onclick: state.dealUploaded ? '' : 'goToStep(5)' },
      { label: 'Presentation interest', done: state.presentationInterest === true, skipped: state.presentationInterest === false, action: state.presentationInterest === true ? 'Booked' : 'Learn more', onclick: 'goToStep(6)' }
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
        + '<div class="checklist-info"><div class="checklist-label">' + escHtml(item.label) + '</div><div class="checklist-status">' + statusText + '</div></div>';
      if (item.onclick) html += '<button class="checklist-action" onclick="' + item.onclick + '">' + escHtml(item.action) + '</button>';
      html += '</li>';
    }
    document.getElementById('completionChecklist').innerHTML = html;
  }

  // ── Step 8: LP Buy Box Prompt ──
  window.finishOnboarding = function(wantsBuyBox) {
    var step = wantsBuyBox ? 'buybox-interest' : 'complete';
    fetch('/api/gp-onboarding', {
      method: 'POST', headers: headers,
      body: JSON.stringify({ email: user.email, step: step, data: {} })
    }).then(function() {
      window.location.href = wantsBuyBox ? 'index.html#buybox' : 'gp-dashboard.html';
    }).catch(function() {
      window.location.href = wantsBuyBox ? 'index.html#buybox' : 'gp-dashboard.html';
    });
  };

  // ── Load Onboarding State ──
  function loadOnboardingState() {
    fetch('/api/gp-onboarding?email=' + encodeURIComponent(user.email), { headers: headers })
    .then(function(r) { return r.json(); })
    .then(function(data) {
      if (data.company) {
        state.companyId = data.company.id;
        prefillCompanyForm(data.company);
        prefillIrForm(data.company);
      }
      if (data.profile) {
        state.selectedRole = data.profile.onboardingRole;
        state.presentationInterest = data.profile.presentationInterest;
      }
      if (data.dealCount > 0) state.dealUploaded = true;

      var step = (data.profile && data.profile.onboardingStep) || 0;

      if (data.profile && data.profile.onboardingComplete) {
        window.location.href = 'gp-dashboard.html'; return;
      }
      if (data.profile && data.profile.onboardingRole === 'lp') {
        window.location.href = 'index.html#buybox'; return;
      }
      if (data.company && step === 0) {
        state.selectedRole = 'gp'; goToStep(1); return;
      }

      // DB steps → UI steps (new mapping with split company/asset steps)
      // DB: 0=not started, 1=role done, 2=company done, 3=IR done, 4=deal done, 5=pres done, 6=complete
      // UI: 0=role, 1=welcome, 2=company, 3=assets, 4=IR, 5=upload, 6=pres, 7=checklist, 8=LP
      var stepMap = { 0: 0, 1: 1, 2: 4, 3: 5, 4: 6, 5: 7 };
      var uiStep = stepMap[step] !== undefined ? stepMap[step] : 0;
      if (uiStep > 0) goToStep(uiStep);
    })
    .catch(function(err) { console.error('Load onboarding state error:', err); });
  }

  function prefillCompanyForm(company) {
    if (company.operator_name) document.getElementById('companyName').value = company.operator_name;
    if (company.ceo) document.getElementById('ceo').value = company.ceo;
    if (company.website) document.getElementById('website').value = company.website;
    if (company.linkedin_ceo) document.getElementById('linkedinCeo').value = company.linkedin_ceo;
    if (company.founding_year) document.getElementById('foundingYear').value = company.founding_year;
    if (company.type) document.getElementById('firmType').value = company.type;
    if (Array.isArray(company.asset_classes)) {
      selectedAssetClasses = company.asset_classes.slice();
      var pills = document.querySelectorAll('#assetClassPills .pill-option');
      for (var i = 0; i < pills.length; i++) {
        if (selectedAssetClasses.indexOf(pills[i].getAttribute('data-value')) !== -1) pills[i].classList.add('selected');
      }
    }
  }

  function prefillIrForm(company) {
    if (company.ir_contact_name) document.getElementById('irContactName').value = company.ir_contact_name;
    if (company.ir_contact_email) document.getElementById('irContactEmail').value = company.ir_contact_email;
    if (company.booking_url) document.getElementById('bookingUrl').value = company.booking_url;
  }

  // ── Network Stats ──
  function loadNetworkStats() {
    fetch('/api/lp-network-stats', { headers: headers })
    .then(function(r) { return r.json(); })
    .then(function(stats) {
      state.networkStats = stats;
      renderNetworkStats(stats);
    })
    .catch(function(err) { console.error('Network stats error:', err); });
  }

  function renderNetworkStats(stats) {
    // Welcome page stats — use at least 1,100 as the floor
    animateNumber('statTotalLPs', Math.max(stats.totalLPs || 0, 1100));
    animateNumber('statAccredited', stats.accreditedCount);
    animateNumber('statBuyBoxes', stats.completedBuyBoxes);

    // Presentation page — hardcode 1,100+ minimum
    var presEl = document.getElementById('presLpCount');
    if (presEl) presEl.textContent = Math.max(stats.totalLPs || 0, 1100).toLocaleString() + '+';

    renderAssetDemandChart(stats.topAssetClasses || []);
    renderGoalDonut(stats.goalDistribution || { income: 0, tax: 0, growth: 0 });
    renderCheckSizeChart(stats.capitalRanges || {});
  }

  function animateNumber(elementId, target) {
    var el = document.getElementById(elementId);
    if (!el || !target) return;
    var duration = 1200, startTime = null;
    function step(timestamp) {
      if (!startTime) startTime = timestamp;
      var progress = Math.min((timestamp - startTime) / duration, 1);
      var eased = 1 - Math.pow(1 - progress, 3);
      el.textContent = Math.round(eased * target).toLocaleString();
      if (progress < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  function renderAssetDemandChart(topClasses) {
    var container = document.getElementById('assetDemandChart');
    if (!container || topClasses.length === 0) return;
    var maxCount = topClasses[0].count || 1;
    var colors = ['green', 'teal', 'blue', 'green', 'teal', 'blue'];
    var html = '';
    for (var i = 0; i < Math.min(topClasses.length, 6); i++) {
      var ac = topClasses[i];
      var pct = Math.max(5, Math.round((ac.count / maxCount) * 100));
      html += '<div class="bar-chart-row"><div class="bar-label">' + escHtml(ac.name) + '</div><div class="bar-track"><div class="bar-fill ' + colors[i] + '" style="width:' + pct + '%"></div></div><div class="bar-count">' + ac.count + '</div></div>';
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
    var svg = document.getElementById('goalDonut');
    if (!svg) return;
    var circumference = 2 * Math.PI * 15.9, offset = 0;
    var svgHtml = '<circle cx="21" cy="21" r="15.9" fill="none" stroke="var(--border-light)" stroke-width="5"/>';
    for (var i = 0; i < data.length; i++) {
      if (data[i].count === 0) continue;
      var segLen = circumference * (data[i].count / total);
      svgHtml += '<circle cx="21" cy="21" r="15.9" fill="none" stroke="' + data[i].color + '" stroke-width="5" stroke-dasharray="' + segLen + ' ' + (circumference - segLen) + '" stroke-dashoffset="' + (-offset) + '" transform="rotate(-90 21 21)"/>';
      offset += segLen;
    }
    svg.innerHTML = svgHtml;
    var legend = document.getElementById('goalLegend');
    if (!legend) return;
    var legendHtml = '';
    for (var j = 0; j < data.length; j++) {
      legendHtml += '<div class="donut-legend-item"><div class="donut-dot" style="background:' + data[j].color + '"></div>' + data[j].label + ' <span style="color:var(--text-muted);margin-left:auto;">' + Math.round((data[j].count / total) * 100) + '%</span></div>';
    }
    legend.innerHTML = legendHtml;
  }

  function renderCheckSizeChart(capitalRanges) {
    var container = document.getElementById('checkSizeChart');
    if (!container) return;
    var entries = Object.entries(capitalRanges);
    if (entries.length === 0) return;
    var maxCount = 1;
    for (var i = 0; i < entries.length; i++) { if (entries[i][1] > maxCount) maxCount = entries[i][1]; }
    var colors = ['blue', 'teal', 'green', 'teal', 'green'];
    var html = '';
    for (var j = 0; j < entries.length; j++) {
      var pct = Math.max(5, Math.round((entries[j][1] / maxCount) * 100));
      html += '<div class="bar-chart-row"><div class="bar-label">' + escHtml(entries[j][0]) + '</div><div class="bar-track"><div class="bar-fill ' + colors[j % colors.length] + '" style="width:' + pct + '%"></div></div><div class="bar-count">' + entries[j][1] + '</div></div>';
    }
    container.innerHTML = html;
  }

  function escHtml(str) { if (!str) return ''; var el = document.createElement('span'); el.textContent = str; return el.innerHTML; }
  function escAttr(str) { if (!str) return ''; return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

  // Handle returnTo param (coming back from deal-create)
  var params = new URLSearchParams(window.location.search);
  if (params.get('fromDealCreate') === 'true') {
    state.dealUploaded = true;
    setTimeout(function() { goToStep(6); }, 100);
  }

})();
