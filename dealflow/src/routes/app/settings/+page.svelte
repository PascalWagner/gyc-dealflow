<script>
	import { onMount } from 'svelte';
	import { user, userEmail, userTier, isAdmin, supabase } from '$lib/stores/auth.js';
	import { browser } from '$app/environment';
	import { goto } from '$app/navigation';

	let activeTab = $state('profile');

	// Profile fields
	let firstName = $state('');
	let lastName = $state('');
	let email = $state('');
	let phone = $state('');
	let location = $state('');
	let avatarUrl = $state('');
	let avatarInitials = $state('?');
	let profileSaving = $state(false);
	let profileSaved = $state(false);

	// Privacy
	let shareActivity = $state(true);

	// Investor profile
	let accreditedStatus = $state('');

	// Notifications
	let notifFreq = $state('weekly');
	let dealAlerts = $state(true);
	let weeklyDigest = $state(true);
	let notifSaved = $state(false);

	// Tier display
	const tierLabels = {
		explorer: 'Explorer (Free)',
		academy: 'Academy Member',
		founding: 'Founding Member',
		'inner-circle': 'Inner Circle'
	};

	function getInitials(u) {
		if (!u) return '?';
		const fn = u.firstName || u.name?.split(' ')[0] || '';
		const ln = u.lastName || u.name?.split(' ').slice(1).join(' ') || '';
		return ((fn[0] || '') + (ln[0] || '')).toUpperCase() || '?';
	}

	function loadProfile() {
		if (!browser) return;
		const u = JSON.parse(localStorage.getItem('gycUser') || '{}');
		firstName = u.firstName || u.name?.split(' ')[0] || '';
		lastName = u.lastName || u.name?.split(' ').slice(1).join(' ') || '';
		email = u.email || '';
		phone = u.phone || '';
		location = u.location || '';
		avatarUrl = u.avatar_url || '';
		avatarInitials = getInitials(u);
		shareActivity = u.share_activity !== false;
		accreditedStatus = u.accredited_status || '';
	}

	async function saveProfile() {
		profileSaving = true;
		if (browser) {
			const u = JSON.parse(localStorage.getItem('gycUser') || '{}');
			u.firstName = firstName;
			u.lastName = lastName;
			u.phone = phone;
			u.location = location;
			u.accredited_status = accreditedStatus;
			u.name = (firstName + ' ' + lastName).trim();
			localStorage.setItem('gycUser', JSON.stringify(u));
		}
		try {
			const token = browser ? (localStorage.getItem('sb_token') || localStorage.getItem('ghlToken')) : null;
			if (token) {
				const resp = await fetch('/api/userdata', {
					method: 'POST',
					headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
					body: JSON.stringify({ type: 'profile', data: { firstName, lastName, phone, location, accredited_status: accreditedStatus } })
				});
				if (!resp.ok) console.warn('Profile save returned', resp.status);
			}
		} catch (e) {
			console.warn('Profile save failed:', e);
		}
		profileSaving = false;
		profileSaved = true;
		setTimeout(() => profileSaved = false, 2000);
	}

	function updateShareActivity(isOn) {
		shareActivity = isOn;
		if (browser) {
			const u = JSON.parse(localStorage.getItem('gycUser') || '{}');
			u.share_activity = isOn;
			localStorage.setItem('gycUser', JSON.stringify(u));
		}
		try {
			const token = browser ? (localStorage.getItem('sb_token') || localStorage.getItem('ghlToken')) : null;
			if (token) {
				fetch('/api/userdata', {
					method: 'POST',
					headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
					body: JSON.stringify({ type: 'privacy', data: { share_activity: isOn } })
				});
			}
		} catch (e) { /* silent */ }
	}

	async function saveNotifPrefs() {
		const prefs = { frequency: notifFreq, deal_alerts: dealAlerts, weekly_digest: weeklyDigest };
		if (browser) localStorage.setItem('gycNotifPrefs', JSON.stringify(prefs));
		try {
			const token = browser ? (localStorage.getItem('sb_token') || localStorage.getItem('ghlToken')) : null;
			if (token) {
				await fetch('/api/userdata', {
					method: 'POST',
					headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
					body: JSON.stringify({ type: 'notif_prefs', data: prefs })
				});
			}
		} catch (e) {
			console.warn('Notif prefs save failed:', e);
		}
		notifSaved = true;
		setTimeout(() => notifSaved = false, 2000);
	}

	function setNotifFrequency(freq) {
		notifFreq = freq;
		saveNotifPrefs();
	}

	function toggleDealAlerts() {
		dealAlerts = !dealAlerts;
		saveNotifPrefs();
	}

	function toggleWeeklyDigest() {
		weeklyDigest = !weeklyDigest;
		saveNotifPrefs();
	}

	async function loadNotifPrefs() {
		let prefs = { frequency: 'weekly', deal_alerts: true, weekly_digest: true };
		try {
			const token = browser ? (localStorage.getItem('sb_token') || localStorage.getItem('ghlToken')) : null;
			if (token) {
				const resp = await fetch('/api/userdata?type=notif_prefs', { headers: { 'Authorization': 'Bearer ' + token } });
				if (resp.ok) {
					const data = await resp.json();
					if (data.notif_frequency) prefs.frequency = data.notif_frequency;
					if (data.deal_alerts !== undefined) prefs.deal_alerts = data.deal_alerts;
					if (data.weekly_digest !== undefined) prefs.weekly_digest = data.weekly_digest;
				}
			}
		} catch (e) { /* use default */ }
		// Fallback to localStorage
		const local = browser ? JSON.parse(localStorage.getItem('gycNotifPrefs') || '{}') : {};
		if (local.frequency && prefs.frequency === 'weekly') prefs.frequency = local.frequency;
		if (local.deal_alerts !== undefined) prefs.deal_alerts = local.deal_alerts;
		if (local.weekly_digest !== undefined) prefs.weekly_digest = local.weekly_digest;
		notifFreq = prefs.frequency;
		dealAlerts = prefs.deal_alerts !== false;
		weeklyDigest = prefs.weekly_digest !== false;
	}

	function handleAvatarUpload(event) {
		const file = event.target.files?.[0];
		if (!file) return;
		const reader = new FileReader();
		reader.onload = (e) => {
			avatarUrl = e.target?.result;
			if (browser) {
				const u = JSON.parse(localStorage.getItem('gycUser') || '{}');
				u.avatar_url = avatarUrl;
				localStorage.setItem('gycUser', JSON.stringify(u));
			}
		};
		reader.readAsDataURL(file);
	}

	function logout() {
		if (browser) {
			localStorage.removeItem('gycUser');
			localStorage.removeItem('gycDealStages');
			localStorage.removeItem('gycBuyBoxWizard');
			supabase?.auth.signOut();
		}
		user.set(null);
		goto('/');
	}

	// Privacy preview data
	let reviewCount = $derived.by(() => {
		if (!browser) return 0;
		try {
			const stages = JSON.parse(localStorage.getItem('gycDealStages') || '{}');
			let count = 0;
			for (const k in stages) {
				const s = stages[k];
				if (s && s !== 'browse' && s !== 'passed') count++;
			}
			return count;
		} catch { return 0; }
	});

	let displayName = $derived((firstName + ' ' + lastName).trim() || 'Your Name');

	onMount(() => {
		loadProfile();
		loadNotifPrefs();
	});
</script>

<div class="settings-page">
	<div class="settings-shell">
		<div class="settings-shell-title">Settings</div>
	</div>

	<div class="settings-tabs">
		<button class="settings-tab" class:active={activeTab === 'profile'} onclick={() => activeTab = 'profile'}>Profile</button>
		<button class="settings-tab" class:active={activeTab === 'plan'} onclick={() => activeTab = 'plan'}>Membership</button>
		<button class="settings-tab" class:active={activeTab === 'privacy'} onclick={() => activeTab = 'privacy'}>Privacy & Sharing</button>
		<button class="settings-tab" class:active={activeTab === 'notifications'} onclick={() => activeTab = 'notifications'}>Notifications</button>
	</div>

	<!-- Profile Tab -->
	{#if activeTab === 'profile'}
		<div class="settings-panel">
			<div class="settings-page-title">Your Profile</div>
			<div class="settings-page-desc">Manage your account information and how others reach you.</div>

			<div class="settings-card" style="margin-bottom:16px;">
				<div class="settings-card-title">Profile Photo</div>
				<div class="settings-card-desc">This appears on your profile and next to your deal activity.</div>
				<div class="avatar-row">
					<div class="avatar-preview">
						{#if avatarUrl}
							<img src={avatarUrl} alt="Avatar" />
						{:else}
							<span class="avatar-initials">{avatarInitials}</span>
						{/if}
					</div>
					<div class="avatar-actions">
						<label class="upload-btn">
							<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
							Choose Photo
							<input type="file" accept="image/*" onchange={handleAvatarUpload} style="display:none;" />
						</label>
					</div>
				</div>
			</div>

			<div class="settings-card">
				<div class="settings-card-title">Personal Information</div>
				<div class="settings-card-desc">This information is shown to GPs when you request an introduction</div>
				<div class="profile-row">
					<div class="profile-field">
						<div class="profile-label">First Name</div>
						<input type="text" class="profile-input" bind:value={firstName} placeholder="First name" />
					</div>
					<div class="profile-field">
						<div class="profile-label">Last Name</div>
						<input type="text" class="profile-input" bind:value={lastName} placeholder="Last name" />
					</div>
				</div>
				<div class="profile-field">
					<div class="profile-label">Email</div>
					<input type="email" class="profile-input" value={email} readonly />
				</div>
				<div class="profile-row">
					<div class="profile-field">
						<div class="profile-label">Phone</div>
						<input type="tel" class="profile-input" bind:value={phone} placeholder="(555) 123-4567" />
					</div>
					<div class="profile-field">
						<div class="profile-label">Location</div>
						<input type="text" class="profile-input" bind:value={location} placeholder="City, State" />
					</div>
				</div>
			</div>

			<div class="settings-save-bar">
				{#if profileSaved}
					<div class="save-msg">Profile saved</div>
				{/if}
				<button class="btn-cta-primary" onclick={saveProfile} disabled={profileSaving}>
					{profileSaving ? 'Saving...' : 'Save Profile'}
				</button>
			</div>
		</div>
	{/if}

	<!-- Membership Tab -->
	{#if activeTab === 'plan'}
		<div class="settings-panel">
			<div class="settings-page-title">Your Membership</div>
			<div class="settings-page-desc">Manage your plan and see what's included at each tier.</div>

			<div class="settings-card">
				<div class="settings-card-title">Current Plan</div>
				<div class="tier-display">
					<div class="tier-badge">{tierLabels[$userTier] || $userTier}</div>
				</div>
				{#if $userTier === 'explorer'}
					<div class="upgrade-cta">
						<p>Upgrade to Academy for full deal intelligence, GP introductions, and hands-on coaching.</p>
						<a href="/app/academy" class="btn-cta-primary" style="display:inline-flex;width:auto;padding:10px 24px;">View Academy</a>
					</div>
				{/if}
			</div>
		</div>
	{/if}

	<!-- Privacy Tab -->
	{#if activeTab === 'privacy'}
		<div class="settings-panel">
			<div class="settings-page-title">Privacy & Sharing</div>
			<div class="settings-page-desc">Control what other GYC members can see about your deal activity. Your financial details are never shared.</div>

			<div class="settings-card always-private">
				<div class="card-header-row">
					<svg viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" stroke-width="2" width="18" height="18"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
					<div class="settings-card-title" style="margin-bottom:0;">Always Private</div>
				</div>
				<div class="private-grid">
					{#each ['Net worth & capital amounts', 'Accreditation status', 'Dollar amounts invested', 'Contact info (email, phone)'] as item}
						<div class="private-item">
							<svg viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" stroke-width="2" width="14" height="14"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
							{item}
						</div>
					{/each}
				</div>
			</div>

			<div class="settings-card" style="margin-top:16px;">
				<div class="settings-card-title">Share My Deal Activity</div>
				<div class="settings-card-desc" style="margin-bottom:16px;">When on, your deal activity counts toward "X LPs are reviewing this deal" on deal pages. Your name and dollar amounts are never shown.</div>
				<div class="toggle-row">
					<button class="toggle-track" class:on={shareActivity} aria-label="Toggle deal activity sharing" onclick={() => updateShareActivity(!shareActivity)}>
						<div class="toggle-thumb"></div>
					</button>
					<div>
						<div class="toggle-label">{shareActivity ? 'Activity sharing is on' : 'Activity sharing is off'}</div>
						<div class="toggle-desc">{shareActivity ? "You're contributing to community deal intelligence" : 'Your deal activity is hidden from other members'}</div>
					</div>
				</div>
			</div>

			<!-- Preview: Profile -->
			<div class="settings-card" style="margin-top:16px;">
				<div class="settings-card-title">Preview: Your Profile</div>
				<div class="settings-card-desc">How other members see you in the network.</div>
				<div class="preview-box">
					<div class="preview-avatar">
						{#if avatarUrl}
							<img src={avatarUrl} alt="" />
						{:else}
							{avatarInitials}
						{/if}
					</div>
					<div>
						<div class="preview-name">{displayName}</div>
						{#if shareActivity}
							<div class="preview-meta">
								{#if location}{location}{/if}
								{#if location && reviewCount > 0} &middot; {/if}
								{#if reviewCount > 0}{reviewCount} deal{reviewCount === 1 ? '' : 's'} in review{/if}
							</div>
						{:else}
							<div class="preview-meta" style="font-style:italic;">Activity hidden</div>
						{/if}
					</div>
				</div>
			</div>

			<!-- Preview: Deal appearance -->
			<div class="settings-card" style="margin-top:16px;">
				<div class="settings-card-title">Preview: How you appear on deals</div>
				<div class="settings-card-desc">What shows on deal cards and deal pages when you're in the pipeline.</div>
				<div class="preview-box">
					{#if shareActivity}
						<div class="deal-preview-row">
							<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
							12 LPs are reviewing this deal
						</div>
						<div class="deal-preview-sub green">
							<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="12" height="12"><polyline points="20 6 9 17 4 12"/></svg>
							You are counted in this number
						</div>
					{:else}
						<div class="deal-preview-row">
							<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
							11 LPs are reviewing this deal
						</div>
						<div class="deal-preview-sub muted">
							<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="12" height="12"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
							You are NOT counted (sharing off)
						</div>
					{/if}
				</div>
			</div>
		</div>
	{/if}

	<!-- Notifications Tab -->
	{#if activeTab === 'notifications'}
		<div class="settings-panel">
			<div class="settings-page-title">Notification Preferences</div>
			<div class="settings-page-desc">Control how and when you receive deal alert emails.</div>

			<div class="notif-card">
				<div class="notif-title">Email Frequency</div>
				<div class="notif-desc">We'll email you new deals that match your buy box. Choose how often.</div>
				<div class="notif-btns">
					<button class="notif-freq-btn" class:active={notifFreq === 'realtime'} onclick={() => setNotifFrequency('realtime')}>
						<div>Real-Time</div>
						<div class="notif-freq-sub">As deals arrive</div>
					</button>
					<button class="notif-freq-btn" class:active={notifFreq === 'daily'} onclick={() => setNotifFrequency('daily')}>
						<div>Daily</div>
						<div class="notif-freq-sub">Morning digest</div>
					</button>
					<button class="notif-freq-btn" class:active={notifFreq === 'weekly'} onclick={() => setNotifFrequency('weekly')}>
						<div>Weekly</div>
						<div class="notif-freq-sub">Every Friday</div>
					</button>
					<button class="notif-freq-btn" class:active={notifFreq === 'off'} onclick={() => setNotifFrequency('off')}>
						<div>Off</div>
						<div class="notif-freq-sub">No deal emails</div>
					</button>
				</div>
			</div>

			<div class="notif-card" style="margin-top:16px;">
				<div class="notif-title">Deal Alerts</div>
				<div class="notif-desc">Get notified when new deals match your buy box criteria.</div>
				<div class="toggle-row">
					<button class="toggle-track" class:on={dealAlerts} aria-label="Toggle deal alerts" onclick={toggleDealAlerts}>
						<div class="toggle-thumb"></div>
					</button>
					<div>
						<div class="toggle-label">{dealAlerts ? 'Deal alerts are on' : 'Deal alerts are off'}</div>
						<div class="toggle-desc">{dealAlerts ? 'You will receive alerts for matching deals' : 'You will not receive deal alert notifications'}</div>
					</div>
				</div>
			</div>

			<div class="notif-card" style="margin-top:16px;">
				<div class="notif-title">Weekly Digest</div>
				<div class="notif-desc">A summary of new deals, market insights, and your portfolio activity.</div>
				<div class="toggle-row">
					<button class="toggle-track" class:on={weeklyDigest} aria-label="Toggle weekly digest emails" onclick={toggleWeeklyDigest}>
						<div class="toggle-thumb"></div>
					</button>
					<div>
						<div class="toggle-label">{weeklyDigest ? 'Weekly digest is on' : 'Weekly digest is off'}</div>
						<div class="toggle-desc">{weeklyDigest ? 'Sent every Friday morning' : 'You will not receive the weekly digest'}</div>
					</div>
				</div>
			</div>

			{#if notifSaved}
				<div class="notif-saved-msg">Preferences saved</div>
			{/if}
		</div>
	{/if}

	<!-- Sign Out -->
	<div class="logout-section">
		<div>
			<div class="logout-title">Sign Out</div>
			<div class="logout-desc">Sign out of your Grow Your Cashflow account on this device.</div>
		</div>
		<button class="logout-btn" onclick={logout}>
			<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
			Log Out
		</button>
	</div>
</div>

<style>
	.settings-page { padding: 0 32px 40px; max-width: 900px; }
	.settings-shell {
		padding: 26px 0 18px;
		margin: 0 -32px 22px;
		padding-left: 32px;
		padding-right: 32px;
		border-bottom: 1px solid var(--border);
	}
	.settings-shell-title {
		font-family: var(--font-headline);
		font-size: 22px;
		font-weight: 400;
		color: var(--text-dark);
		letter-spacing: -0.3px;
	}
	.settings-tabs { display: flex; gap: 0; border-bottom: 2px solid var(--border-light); margin-bottom: 32px; overflow-x: auto; -webkit-overflow-scrolling: touch; }
	.settings-tab { padding: 12px 24px; font-family: var(--font-ui); font-size: 13px; font-weight: 600; color: var(--text-muted); cursor: pointer; border: none; background: none; border-bottom: 2px solid transparent; margin-bottom: -2px; transition: all var(--transition, 0.2s); white-space: nowrap; }
	.settings-tab:hover { color: var(--text-dark); }
	.settings-tab.active { color: var(--primary); border-bottom-color: var(--primary); }
	.settings-panel { }
	.settings-page-title { font-family: var(--font-headline); font-size: 28px; color: var(--text-dark); margin-bottom: 8px; }
	.settings-page-desc { font-family: var(--font-body); font-size: 15px; color: var(--text-secondary); margin-bottom: 32px; line-height: 1.6; }
	.settings-card { background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius); padding: 24px; margin-bottom: 16px; box-shadow: var(--shadow-card); }
	.settings-card-title { font-family: var(--font-ui); font-size: 15px; font-weight: 700; color: var(--text-dark); margin-bottom: 4px; }
	.settings-card-desc { font-family: var(--font-body); font-size: 13px; color: var(--text-muted); margin-bottom: 16px; }
	.always-private { background: var(--bg-cream); border: 1px solid var(--border-light); }
	.card-header-row { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; }
	.private-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px 24px; }
	.private-item { display: flex; align-items: center; gap: 6px; font-family: var(--font-body); font-size: 13px; color: var(--text-secondary); }

	.avatar-row { display: flex; align-items: center; gap: 16px; margin-top: 14px; flex-wrap: wrap; }
	.avatar-preview { width: 52px; height: 52px; border-radius: 50%; background: var(--primary); border: none; display: flex; align-items: center; justify-content: center; font-family: var(--font-ui); font-size: 17px; font-weight: 700; color: #fff; overflow: hidden; flex-shrink: 0; box-shadow: inset 0 0 0 1px rgba(255,255,255,0.08); }
	.avatar-preview img { width: 100%; height: 100%; object-fit: cover; }
	.avatar-initials { }
	.upload-btn { display: inline-flex; align-items: center; gap: 6px; padding: 8px 16px; background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius-sm); font-family: var(--font-ui); font-size: 13px; font-weight: 600; color: var(--text-dark); cursor: pointer; transition: all 0.15s; }
	.upload-btn:hover { border-color: var(--primary); }

	.profile-row { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
	.profile-field { margin-bottom: 20px; }
	.profile-row .profile-field { margin-bottom: 0; }
	.profile-label { font-family: var(--font-ui); font-size: 12px; font-weight: 600; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px; }
	.profile-input { width: 100%; padding: 10px 14px; border: 1px solid var(--border); border-radius: var(--radius-sm); font-family: var(--font-body); font-size: 14px; color: var(--text-dark); background: var(--bg-card); box-sizing: border-box; }
	.profile-input:focus { outline: none; border-color: var(--primary); }
	.profile-input[readonly] { background: var(--bg-cream); color: var(--text-muted); }
	.settings-save-bar { display: flex; gap: 12px; align-items: center; padding: 20px 0; border-top: 1px solid var(--border-light); margin-top: 24px; }
	.settings-save-bar .btn-cta-primary { width: auto; padding: 12px 32px; }
	.save-msg { font-family: var(--font-ui); font-size: 13px; color: var(--primary); font-weight: 600; }
	.btn-cta-primary { padding: 12px 32px; border-radius: 8px; background: var(--primary); color: #fff; font-family: var(--font-ui); font-size: 14px; font-weight: 700; border: none; cursor: pointer; transition: all 0.15s; }
	.btn-cta-primary:hover { background: #45A86C; }
	.btn-cta-primary:disabled { opacity: 0.6; cursor: not-allowed; }

	.tier-display { margin-top: 16px; }
	.tier-badge { display: inline-block; padding: 8px 20px; background: rgba(81,190,123,0.08); border: 1px solid rgba(81,190,123,0.2); border-radius: 8px; font-family: var(--font-ui); font-size: 14px; font-weight: 700; color: var(--primary); }
	.upgrade-cta { margin-top: 20px; padding-top: 16px; border-top: 1px solid var(--border-light); }
	.upgrade-cta p { font-family: var(--font-body); font-size: 13px; color: var(--text-secondary); margin-bottom: 12px; line-height: 1.6; }

	.toggle-row { display: flex; align-items: center; gap: 14px; padding: 12px 16px; background: var(--bg-cream); border: 1px solid var(--border-light); border-radius: var(--radius-sm); }
	.toggle-track { position: relative; width: 48px; height: 26px; flex-shrink: 0; cursor: pointer; border: none; background: var(--border); border-radius: 13px; transition: background 0.2s; padding: 0; }
	.toggle-track.on { background: var(--teal-deep, var(--primary)); }
	.toggle-thumb { position: absolute; top: 2px; left: 2px; width: 22px; height: 22px; background: #fff; border-radius: 50%; box-shadow: 0 1px 3px rgba(0,0,0,0.2); transition: transform 0.2s; pointer-events: none; }
	.toggle-track.on .toggle-thumb { transform: translateX(22px); }
	.toggle-label { font-family: var(--font-ui); font-size: 14px; font-weight: 700; color: var(--text-dark); }
	.toggle-desc { font-family: var(--font-body); font-size: 12px; color: var(--text-secondary); margin-top: 2px; }

	.preview-box { margin-top: 12px; padding: 16px; background: var(--bg-cream); border: 1px solid var(--border-light); border-radius: var(--radius-sm); display: flex; align-items: center; gap: 14px; }
	.preview-avatar { width: 48px; height: 48px; border-radius: 50%; background: var(--primary); color: #fff; display: flex; align-items: center; justify-content: center; font-family: var(--font-ui); font-weight: 700; font-size: 16px; flex-shrink: 0; overflow: hidden; }
	.preview-avatar img { width: 100%; height: 100%; object-fit: cover; }
	.preview-name { font-family: var(--font-ui); font-size: 14px; font-weight: 700; color: var(--text-dark); }
	.preview-meta { font-family: var(--font-body); font-size: 12px; color: var(--text-secondary); margin-top: 2px; }

	.deal-preview-row { display: flex; align-items: center; gap: 6px; font-family: var(--font-body); font-size: 12px; color: var(--text-secondary); }
	.deal-preview-sub { display: flex; align-items: center; gap: 6px; font-family: var(--font-body); font-size: 11px; margin-top: 8px; }
	.deal-preview-sub.green { color: var(--primary); }
	.deal-preview-sub.muted { color: var(--text-muted); }

	.notif-card { margin-top: 24px; padding: 24px; background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius); box-shadow: var(--shadow-card); }
	.notif-title { font-family: var(--font-ui); font-size: 15px; font-weight: 700; color: var(--text-dark); margin-bottom: 4px; }
	.notif-desc { font-family: var(--font-body); font-size: 13px; color: var(--text-secondary); margin-bottom: 16px; line-height: 1.5; }
	.notif-btns { display: flex; gap: 10px; flex-wrap: wrap; }
	.notif-freq-btn { flex: 1; min-width: 120px; padding: 14px 20px; border: 2px solid var(--border); border-radius: 10px; background: var(--bg-main); font-family: var(--font-ui); font-size: 14px; font-weight: 600; color: var(--text-secondary); cursor: pointer; transition: 0.2s; text-align: left; }
	.notif-freq-btn:hover { border-color: var(--primary) !important; color: var(--primary) !important; }
	.notif-freq-btn.active { border-color: var(--primary); background: rgba(81,190,123,0.08); color: var(--primary); }
	.notif-freq-sub { font-size: 11px; font-weight: 400; color: var(--text-muted); margin-top: 4px; }
	.notif-freq-btn.active .notif-freq-sub { color: var(--text-secondary); }
	.notif-saved-msg { margin-top: 16px; padding: 12px 16px; background: #F0F9F4; border-radius: 8px; font-size: 13px; color: #059669; font-weight: 600; text-align: center; }

	.logout-section { margin-top: 32px; padding-top: 24px; border-top: 1px solid var(--border); display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 16px; }
	.logout-title { font-family: var(--font-ui); font-size: 14px; font-weight: 700; color: var(--text-dark); }
	.logout-desc { font-family: var(--font-body); font-size: 13px; color: var(--text-muted); }
	.logout-btn { display: inline-flex; align-items: center; gap: 6px; padding: 10px 24px; border: 1px solid #D04040; border-radius: 8px; background: transparent; font-family: var(--font-ui); font-size: 14px; font-weight: 600; color: #D04040; cursor: pointer; transition: all 0.15s; }
	.logout-btn:hover { background: rgba(208,64,64,0.06); }

	@media (min-width: 769px) and (max-width: 1024px) {
		.settings-page {
			max-width: 640px;
			margin: 0 auto;
			padding: 0 24px 32px;
		}
	}

	@media (max-width: 768px) {
		.settings-page { padding: 0 16px 24px; }
		.settings-shell {
			margin: 0 -16px 20px;
			padding: 20px 16px 14px;
		}
		.settings-shell-title { font-size: 20px; }
		.profile-row { grid-template-columns: 1fr; }
		.private-grid { grid-template-columns: 1fr; }
		.settings-tabs { scrollbar-width: none; }
		.settings-tabs::-webkit-scrollbar { display: none; }
	}
</style>
