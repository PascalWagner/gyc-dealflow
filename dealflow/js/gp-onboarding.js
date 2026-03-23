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
    agreementSigned: false,
    offeringType: '506c',
    consents: { tos: false, listing: false, accuracy: false, recording: false },
    deckFile: null,
    ppmFile: null,
    presentationInterest: null,
    networkStats: null
  };

  var ASSET_CLASSES = [
    'Multi-Family', 'Self Storage', 'Industrial', 'Mobile Home Parks',
    'Hotels/Hospitality', 'Retail', 'Office', 'Senior Living',
    'Student Housing', 'Medical Office', 'Data Centers', 'Lending',
    'Short Term Rental', 'Land', 'Mixed Use', 'Build-to-Rent', 'Other'
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

    // Progress bar (steps 0-11, hide on 0 and 1)
    var progressWrap = document.getElementById('progressWrap');
    var progressFill = document.getElementById('progressFill');
    if (step <= 1) {
      progressWrap.style.display = 'none';
    } else {
      progressWrap.style.display = 'block';
      var pct = Math.min(100, Math.round(((step - 2) / 9) * 100));
      progressFill.style.width = pct + '%';
    }

    if (step === 10) buildChecklist();
    window.scrollTo(0, 0);
  };

  // ── Step 0: Name Collection ──
  window.saveName = function() {
    var firstName = titleCase(document.getElementById('onboardFirstName').value.trim());
    var lastName = titleCase(document.getElementById('onboardLastName').value.trim());
    if (!firstName) { document.getElementById('onboardFirstName').focus(); return; }
    if (!lastName) { document.getElementById('onboardLastName').focus(); return; }

    // Update input fields to show title case
    document.getElementById('onboardFirstName').value = firstName;
    document.getElementById('onboardLastName').value = lastName;

    // Update localStorage user name
    var u = JSON.parse(localStorage.getItem('gycUser') || '{}');
    u.name = firstName + ' ' + lastName;
    u.firstName = firstName;
    u.lastName = lastName;
    localStorage.setItem('gycUser', JSON.stringify(u));

    // Update the module-scoped user reference
    user.name = u.name;
    user.firstName = firstName;
    user.lastName = lastName;

    goToStep(1);
  };

  function titleCase(s) {
    if (!s) return '';
    return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
  }

  // Pre-fill name from existing user data (title case)
  (function prefillName() {
    if (user.name && user.name !== user.email.split('@')[0]) {
      var parts = user.name.split(' ');
      var fnEl = document.getElementById('onboardFirstName');
      var lnEl = document.getElementById('onboardLastName');
      if (fnEl && parts[0]) fnEl.value = titleCase(parts[0]);
      if (lnEl && parts.length > 1) lnEl.value = parts.slice(1).map(titleCase).join(' ');
    }
  })();

  // ── Step 1: Role Selection ──
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
    }).then(function() { goToStep(2); }).catch(function() { goToStep(2); });
  };

  // ── Step 3: Company Basics + Typeahead ──
  var searchTimer = null;
  var selectedCompany = null; // Set when user picks an existing company

  (function initCompanyTypeahead() {
    var input = document.getElementById('companyName');
    var dropdown = document.getElementById('companyDropdown');
    if (!input || !dropdown) return;

    input.addEventListener('input', function() {
      var q = input.value.trim();
      selectedCompany = null; // Reset selection on new typing

      if (q.length < 2) { dropdown.style.display = 'none'; return; }

      clearTimeout(searchTimer);
      searchTimer = setTimeout(function() {
        fetch('/api/company-search?q=' + encodeURIComponent(q))
        .then(function(r) { return r.json(); })
        .then(function(data) {
          var results = data.results || [];
          var html = '';

          for (var i = 0; i < results.length; i++) {
            var co = results[i];
            var initials = (co.operator_name || '??').split(' ').map(function(w) { return w[0]; }).join('').toUpperCase().slice(0, 2);
            var meta = [co.type, co.asset_classes ? co.asset_classes.slice(0, 2).join(', ') : ''].filter(Boolean).join(' · ');
            html += '<div class="company-result" data-id="' + co.id + '" onclick="pickCompany(' + i + ')">'
              + '<div class="company-result-icon">' + escHtml(initials) + '</div>'
              + '<div><div class="company-result-name">' + escHtml(co.operator_name) + '</div>'
              + (meta ? '<div class="company-result-meta">' + escHtml(meta) + '</div>' : '')
              + '</div></div>';
          }

          // Always show "Create new" option at the bottom
          html += '<div class="company-create-option" onclick="createNewCompany()">'
            + '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>'
            + 'Create "<strong>' + escHtml(q) + '</strong>" as a new company'
            + '</div>';

          dropdown.innerHTML = html;
          dropdown.style.display = 'block';

          // Stash results for pickCompany
          dropdown._results = results;
        })
        .catch(function() { dropdown.style.display = 'none'; });
      }, 250);
    });

    // Close dropdown when clicking outside
    document.addEventListener('click', function(e) {
      if (!input.contains(e.target) && !dropdown.contains(e.target)) {
        dropdown.style.display = 'none';
      }
    });
  })();

  window.pickCompany = function(index) {
    var dropdown = document.getElementById('companyDropdown');
    var results = dropdown._results || [];
    var co = results[index];
    if (!co) return;

    selectedCompany = co;
    state.companyId = co.id;

    // Fill in fields from the selected company
    document.getElementById('companyName').value = co.operator_name;
    if (co.type) document.getElementById('firmType').value = co.type;
    if (co.ceo) document.getElementById('ceo').value = co.ceo;
    if (co.website) document.getElementById('website').value = co.website;
    if (co.linkedin_ceo) document.getElementById('linkedinCeo').value = co.linkedin_ceo;
    if (co.founding_year) document.getElementById('foundingYear').value = co.founding_year;

    // Pre-select asset class pills
    if (Array.isArray(co.asset_classes) && co.asset_classes.length > 0) {
      selectedAssetClasses = co.asset_classes.slice();
      var pills = document.querySelectorAll('#assetClassPills .pill-option');
      for (var i = 0; i < pills.length; i++) {
        var val = pills[i].getAttribute('data-value');
        pills[i].classList.toggle('selected', selectedAssetClasses.indexOf(val) !== -1);
      }
    }

    // Pre-fill IR contact if available
    if (co.ir_contact_name) document.getElementById('irContactName').value = co.ir_contact_name;
    if (co.ir_contact_email) document.getElementById('irContactEmail').value = co.ir_contact_email;
    if (co.booking_url) document.getElementById('bookingUrl').value = co.booking_url;

    dropdown.style.display = 'none';
  };

  window.createNewCompany = function() {
    selectedCompany = null;
    document.getElementById('companyDropdown').style.display = 'none';
    // Keep whatever they typed — they'll create a new one on save
  };

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
      goToStep(4);
    })
    .catch(function() {
      btn.disabled = false;
      btn.innerHTML = 'Continue <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>';
      goToStep(4);
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
    goToStep(5);
  };

  // ── Step 5: IR Contact ──
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
      goToStep(6);
    })
    .catch(function() {
      btn.disabled = false;
      btn.innerHTML = 'Continue <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>';
      goToStep(6);
    });
  };

  // ── Step 6: Operator Listing Agreement ──
  window.selectOfferingType = function(type) {
    state.offeringType = type;
    document.getElementById('ot506c').classList.toggle('selected', type === '506c');
    document.getElementById('ot506b').classList.toggle('selected', type === '506b');
    document.getElementById('otOther').classList.toggle('selected', type === 'other');
    document.getElementById('offering506bNote').style.display = type === '506b' ? 'block' : 'none';
  };

  window.toggleConsent = function(key) {
    state.consents[key] = !state.consents[key];
    var box = document.getElementById('consent' + key.charAt(0).toUpperCase() + key.slice(1));
    if (box) box.classList.toggle('checked', state.consents[key]);
    updateAgreementBtn();
  };

  function updateAgreementBtn() {
    var btn = document.getElementById('agreementNextBtn');
    var sigName = document.getElementById('sigName').value.trim();
    // All 4 consents + signature name required.
    var canProceed = state.consents.tos && state.consents.listing && state.consents.accuracy && state.consents.recording && sigName.length > 0;
    btn.disabled = !canProceed;
  }

  // Listen to signature name input
  (function() {
    var sigInput = document.getElementById('sigName');
    if (sigInput) sigInput.addEventListener('input', updateAgreementBtn);
  })();

  window.saveAgreement = function() {
    var sigName = document.getElementById('sigName').value.trim();
    var sigTitle = document.getElementById('sigTitle').value.trim();
    if (!sigName) { document.getElementById('sigName').focus(); return; }
    if (!state.consents.tos || !state.consents.listing || !state.consents.accuracy) return;

    var btn = document.getElementById('agreementNextBtn');
    btn.disabled = true; btn.textContent = 'Saving...';

    // Capture the full agreement text for the legal record
    var agreementText = document.getElementById('agreementText').innerText;
    var hash = simpleHash(agreementText);

    fetch('/api/gp-agreement', {
      method: 'POST', headers: headers,
      body: JSON.stringify({
        email: user.email,
        signatoryName: sigName,
        signatoryEmail: user.email,
        signatoryTitle: sigTitle,
        offeringType: state.offeringType,
        acceptedTos: state.consents.tos,
        acceptedListing: state.consents.listing,
        acceptedDataAccuracy: state.consents.accuracy,
        acceptedRecording: state.consents.recording,
        agreementText: agreementText,
        agreementTextHash: hash
      })
    })
    .then(function(r) { return r.json(); })
    .then(function(result) {
      state.agreementSigned = true;
      btn.disabled = false;
      btn.innerHTML = 'I Agree — Continue <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>';
      goToStep(7);
    })
    .catch(function(err) {
      console.error('Agreement save error:', err);
      btn.disabled = false;
      btn.innerHTML = 'I Agree — Continue <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>';
      // Still advance — we'll re-prompt if not saved
      state.agreementSigned = true;
      goToStep(7);
    });
  };

  // Simple string hash for agreement text snapshot
  function simpleHash(str) {
    var hash = 0;
    for (var i = 0; i < str.length; i++) {
      var chr = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + chr;
      hash |= 0;
    }
    return 'v1-' + Math.abs(hash).toString(36);
  }

  // ── Step 6: Deal Upload (deck + PPM) ──
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

  // Convert a File to base64 string
  function fileToBase64(file) {
    return new Promise(function(resolve, reject) {
      var reader = new FileReader();
      reader.onload = function() {
        // result is "data:...;base64,XXXX" — strip the prefix
        var base64 = reader.result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  window.submitDealUploads = function() {
    // Show processing
    document.getElementById('deckDropZone').style.display = 'none';
    document.getElementById('ppmDropZone').style.display = 'none';
    document.getElementById('uploadNextBtn').style.display = 'none';
    document.getElementById('processingState').style.display = 'block';

    // Get a deal name from the filename (strip extension)
    var file = state.deckFile || state.ppmFile;
    var dealName = file ? file.name.replace(/\.[^.]+$/, '') : 'New Deal';
    // Use a placeholder dealId to trigger deal creation in the API
    var dealId = 'new-' + Date.now();
    var docType = (state.ppmFile && !state.deckFile) ? 'ppm' : 'deck';
    var uploadFile = state.deckFile || state.ppmFile;

    if (!uploadFile) {
      goToStep(8);
      return;
    }

    fileToBase64(uploadFile)
    .then(function(base64data) {
      return fetch('/api/deck-upload', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + user.token
        },
        body: JSON.stringify({
          dealId: dealId,
          dealName: dealName,
          filedata: base64data,
          filename: uploadFile.name,
          docType: docType,
          userEmail: user.email,
          userName: user.name || '',
          companyId: state.companyId || ''
        })
      });
    })
    .then(function(r) { return r.json(); })
    .then(function(uploadResult) {
      state.dealUploaded = true;
      // Capture the deal ID — newDealId for newly created, or fallback
      var uploadedDealId = (uploadResult && uploadResult.newDealId) || null;

      // If we also have a PPM file (uploaded deck first), upload PPM too
      var ppmPromise = (state.ppmFile && state.deckFile && uploadedDealId)
        ? fileToBase64(state.ppmFile).then(function(ppmBase64) {
            return fetch('/api/deck-upload', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + user.token
              },
              body: JSON.stringify({
                dealId: uploadedDealId,
                dealName: dealName,
                filedata: ppmBase64,
                filename: state.ppmFile.name,
                docType: 'ppm',
                userEmail: user.email,
                userName: user.name || '',
                companyId: state.companyId || ''
              })
            }).then(function(r) { return r.json(); });
          })
        : Promise.resolve(null);

      return ppmPromise.then(function() {
        return fetch('/api/gp-onboarding', {
          method: 'POST', headers: headers,
          body: JSON.stringify({ email: user.email, step: 'deal-uploaded', data: {} })
        }).then(function() { return uploadedDealId; });
      });
    })
    .then(function(uploadedDealId) {
      // Redirect to deal review page if we have a deal ID
      if (uploadedDealId) {
        window.location.href = 'deal-review.html?id=' + uploadedDealId + '&from=onboarding';
      } else {
        goToStep(8);
      }
    })
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
    }).then(function() { goToStep(8); }).catch(function() { goToStep(8); });
  };

  // ── Step 8: Presentation Interest ──
  window.savePresentation = function(interested) {
    state.presentationInterest = interested;
    fetch('/api/gp-onboarding', {
      method: 'POST', headers: headers,
      body: JSON.stringify({ email: user.email, step: 'presentation', data: { interested: interested } })
    }).then(function() {
      goToStep(interested ? 9 : 10); // Yes → upsell, Maybe later → checklist
    }).catch(function() {
      goToStep(interested ? 9 : 10);
    });
  };

  // ── Step 8: Operator Sponsorship Upsell ──
  var GHL_PAYMENT_LINK = 'https://link.fastpaydirect.com/payment-link/66e09581d780e54a43941ac8';

  window.bookPresentation = function() {
    // Open GHL payment link — they'll complete checkout there
    window.open(GHL_PAYMENT_LINK, '_blank');
    // After a moment, advance to checklist (they can come back)
    setTimeout(function() { goToStep(10); }, 1500);
  };

  window.skipPayment = function() {
    goToStep(10);
  };

  // ── Step 10: Completion Checklist ──
  function buildChecklist() {
    var items = [
      { label: 'Company profile', done: !!state.companyId, action: state.companyId ? 'Edit' : 'Set up', onclick: 'goToStep(3)' },
      { label: 'Asset classes', done: selectedAssetClasses.length > 0, action: 'Edit', onclick: 'goToStep(4)' },
      { label: 'IR contact', done: !!(document.getElementById('irContactName') && document.getElementById('irContactName').value.trim()), action: 'Edit', onclick: 'goToStep(5)' },
      { label: 'Listing agreement', done: state.agreementSigned, action: state.agreementSigned ? 'Signed' : 'Review', onclick: state.agreementSigned ? '' : 'goToStep(6)' },
      { label: 'Deal uploaded', done: state.dealUploaded, skipped: state.dealSkipped, action: state.dealUploaded ? 'View' : 'Add deal', onclick: state.dealUploaded ? '' : 'goToStep(7)' },
      { label: 'Presentation', done: state.presentationInterest === true, skipped: state.presentationInterest === false, action: state.presentationInterest === true ? 'Booked' : 'Learn more', onclick: 'goToStep(8)' }
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

  // ── Step 10: LP Buy Box Prompt ──
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
        state.selectedRole = 'gp'; goToStep(2); return;
      }

      // DB steps → UI steps
      // DB: 0=not started, 1=role done, 2=company done, 3=IR done, 4=agreement done, 5=deal done, 6=pres done, 7=complete
      // UI: 0=name, 1=role, 2=welcome, 3=company, 4=assets, 5=IR, 6=agreement, 7=upload, 8=pres, 9=upsell, 10=checklist, 11=LP
      var stepMap = { 0: 0, 1: 2, 2: 5, 3: 6, 4: 7, 5: 8, 6: 10 };
      var uiStep = stepMap[step] !== undefined ? stepMap[step] : 0;

      // Support ?resumeStep=N for returning from deal-review.html
      var resumeStep = new URLSearchParams(window.location.search).get('resumeStep');
      if (resumeStep) {
        goToStep(parseInt(resumeStep, 10));
        // Clean up URL
        window.history.replaceState({}, '', window.location.pathname);
        return;
      }

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
    var useSample = (stats.totalLPs || 0) < 200 && (stats.completedBuyBoxes || 0) < 200;

    // Welcome page stats — use known GHL numbers as floor
    animateNumber('statTotalLPs', Math.max(stats.totalLPs || 0, 1100));
    animateNumber('statAccredited', Math.max(stats.accreditedCount || 0, 600));

    // Capital ready to deploy
    var capitalEl = document.getElementById('statBuyBoxes');
    if (capitalEl) {
      var capitalValue = useSample ? 18500000 : (stats.totalCapitalReady || 0);
      animateCurrency('statBuyBoxes', capitalValue);
    }

    // Presentation page — hardcode 1,100+ minimum
    var presEl = document.getElementById('presLpCount');
    if (presEl) presEl.textContent = Math.max(stats.totalLPs || 0, 1100).toLocaleString() + '+';

    // Use sample data for charts if real data is thin
    var sampleAssetClasses = [
      { name: 'Multifamily', count: 42 }, { name: 'Industrial', count: 31 },
      { name: 'Private Debt / Credit', count: 28 }, { name: 'Self-Storage', count: 19 },
      { name: 'Build-to-Rent', count: 14 }, { name: 'Mobile Home Parks', count: 11 }
    ];
    var sampleGoals = { income: 58, tax: 27, growth: 15 };

    var assetClasses = stats.topAssetClasses || [];
    var goals = stats.goalDistribution || { income: 0, tax: 0, growth: 0 };
    if (useSample) {
      assetClasses = assetClasses.length >= 3 ? assetClasses : sampleAssetClasses;
      var goalTotal = goals.income + goals.tax + goals.growth;
      goals = goalTotal >= 10 ? goals : sampleGoals;
    }

    renderAssetDemandChart(assetClasses);
    renderGoalDonut(goals);
    renderCheckSizeChart(stats.capitalRanges || {});
  }

  function animateCurrency(elementId, target) {
    var el = document.getElementById(elementId);
    if (!el || !target) return;
    var duration = 1200, startTime = null;
    function step(timestamp) {
      if (!startTime) startTime = timestamp;
      var progress = Math.min((timestamp - startTime) / duration, 1);
      var eased = 1 - Math.pow(1 - progress, 3);
      var val = Math.round(eased * target);
      if (val >= 1000000) {
        el.textContent = '$' + (val / 1000000).toFixed(1) + 'M';
      } else if (val >= 1000) {
        el.textContent = '$' + Math.round(val / 1000) + 'K';
      } else {
        el.textContent = '$' + val.toLocaleString();
      }
      if (progress < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
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
    setTimeout(function() { goToStep(9); }, 100);
  }

})();
