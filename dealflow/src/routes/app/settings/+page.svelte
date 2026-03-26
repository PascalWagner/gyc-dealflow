<script>
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';
	import { goto } from '$app/navigation';
	import { user } from '$lib/stores/auth.js';

	let activeTab = $state('plan');

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
	let investableCapital = $state('$250K - $1M');
	let investmentExperience = $state('4-10 LP investments');
	let autoRenewSaving = $state(false);

	// Notifications
	let notifFreq = $state('weekly');
	let dealAlerts = $state(true);
	let weeklyDigest = $state(true);
	let notifSaved = $state(false);

	const membershipPlans = [
		{
			key: 'free',
			label: 'Free',
			accent: 'var(--text-muted)',
			priceNote: 'Free forever',
			features: [
				'Browse all live deals',
				'View investment decks',
				'Deal filtering & search',
				'Weekly deal digest email',
				'Basic deal overview'
			]
		},
		{
			key: 'academy',
			label: 'Academy',
			accent: '#51BE7B',
			priceNote: '$5,000 first year',
			features: [
				'Everything in Free',
				'Full deal data & comparisons',
				'Risk analysis & stress test',
				'PPM & data room access',
				'GP introductions & reviews',
				'Weekly office hours',
				'Investment plan builder',
				'Private investor community'
			]
		},
		{
			key: 'concierge',
			label: 'Concierge',
			accent: 'var(--teal-deep)',
			priceNote: '$25,000',
			features: [
				'Everything in Academy',
				'24-hour text access to Pascal',
				'10 x 90-min 1:1 calls',
				'3hrs strategy sessions',
				'Free live event ticket',
				'Co-underwriting on deals'
			]
		},
		{
			key: 'vip',
			label: 'VIP Retreat',
			accent: '#C5963A',
			priceNote: '$50,000',
			features: [
				'Everything in Concierge',
				'Fly-out retreat experience',
				'Multi-day immersive program',
				'Direct portfolio construction',
				'Tax & entity structuring',
				'Priority GP access'
			]
		}
	];

	const membershipKeyMap = {
		explorer: 'free',
		free: 'free',
		academy: 'academy',
		alumni: 'academy',
		investor: 'academy',
		founding: 'academy',
		'inner-circle': 'concierge',
		family_office: 'concierge',
		concierge: 'concierge',
		vip: 'vip',
		vip_retreat: 'vip'
	};

	const planOrder = {
		free: 0,
		academy: 1,
		concierge: 2,
		vip: 3
	};

	function getStoredUser() {
		if (!browser) return null;
		try {
			return JSON.parse(localStorage.getItem('gycUser') || 'null');
		} catch {
			return null;
		}
	}

	function patchStoredUser(fields) {
		if (!browser) return null;
		const current = getStoredUser() || {};
		const next = { ...current, ...fields };
		user.set(next);
		return next;
	}

	function getToken() {
		return getStoredUser()?.token || '';
	}

	function formatMembershipDate(value) {
		if (!value) return '';
		try {
			return new Date(value).toLocaleDateString('en-US', {
				month: 'short',
				day: 'numeric',
				year: 'numeric'
			});
		} catch {
			return '';
		}
	}

	function getInitials(u) {
		if (!u) return '?';
		const fn = u.firstName || u.name?.split(' ')[0] || '';
		const ln = u.lastName || u.name?.split(' ').slice(1).join(' ') || '';
		return ((fn[0] || '') + (ln[0] || '')).toUpperCase() || '?';
	}

	function getMembershipKey(rawTier, adminFlag = false) {
		const normalizedTier = String(rawTier || '').trim().toLowerCase();
		if (adminFlag && !normalizedTier) return 'academy';
		return membershipKeyMap[normalizedTier] || (adminFlag ? 'academy' : 'free');
	}

	function getPlanMeta(planKey) {
		return membershipPlans.find((plan) => plan.key === planKey) || membershipPlans[0];
	}

	function isPlanUnlocked(planKey, currentPlanKey) {
		return (planOrder[planKey] || 0) <= (planOrder[currentPlanKey] || 0);
	}

	const membershipUser = $derived.by(() => getStoredUser() || $user || {});
	const rawMembershipTier = $derived(String(membershipUser.tier || 'free').toLowerCase());
	const activeMembershipKey = $derived(
		getMembershipKey(rawMembershipTier, membershipUser.isAdmin === true)
	);
	const currentPlanMeta = $derived(getPlanMeta(activeMembershipKey));
	const membershipStart = $derived(formatMembershipDate(membershipUser.academyStart));
	const membershipEnd = $derived(formatMembershipDate(membershipUser.academyEnd));
	const autoRenewEnabled = $derived(membershipUser.autoRenew !== false);
	const billingCardLabel = $derived.by(() => {
		if (!membershipUser.cardLast4) return 'No card on file';
		const brand = membershipUser.cardBrand
			? membershipUser.cardBrand.charAt(0).toUpperCase() + membershipUser.cardBrand.slice(1)
			: 'Card';
		return `${brand} ending in ${membershipUser.cardLast4}`;
	});

	function loadProfile() {
		const storedUser = getStoredUser() || {};
		firstName = storedUser.firstName || storedUser.name?.split(' ')[0] || '';
		lastName = storedUser.lastName || storedUser.name?.split(' ').slice(1).join(' ') || '';
		email = storedUser.email || '';
		phone = storedUser.phone || '';
		location = storedUser.location || '';
		avatarUrl = storedUser.avatar_url || '';
		avatarInitials = getInitials(storedUser);
		shareActivity = storedUser.share_activity !== false;
		accreditedStatus = storedUser.accredited_status || '';
		investableCapital = storedUser.investable_capital || '$250K - $1M';
		investmentExperience = storedUser.investment_experience || '4-10 LP investments';
	}

	async function refreshSessionProfile() {
		if (!browser) return;
		const storedUser = getStoredUser();
		if (!storedUser?.email) return;

		try {
			const resp = await fetch('/api/auth', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ action: 'lookup', email: storedUser.email })
			});
			if (!resp.ok) return;
			const data = await resp.json();
			if (!data?.success) return;

			patchStoredUser({
				email: storedUser.email,
				name: data.name || storedUser.name || storedUser.email.split('@')[0],
				fullName: data.fullName || data.name || storedUser.fullName || storedUser.name || '',
				tier: data.tier || storedUser.tier || 'free',
				isAdmin: data.isAdmin || false,
				tags: data.tags || storedUser.tags || [],
				contactId: data.contactId || storedUser.contactId || null,
				phone: data.phone || '',
				location: data.location || '',
				avatar_url: data.avatar_url || '',
				share_activity: data.share_activity !== false,
				share_saved: data.share_saved !== false,
				share_dd: data.share_dd !== false,
				share_invested: data.share_invested !== false,
				allow_follows: data.allow_follows !== false,
				accredited_status: data.accredited_status || '',
				investable_capital: data.investable_capital || '',
				investment_experience: data.investment_experience || '',
				onboardingRole: data.onboardingRole || null,
				gpOnboardingComplete: data.gpOnboardingComplete || false,
				academyStart: data.academyStart || null,
				academyEnd: data.academyEnd || null,
				autoRenew: data.autoRenew !== false,
				cardLast4: data.cardLast4 || null,
				cardBrand: data.cardBrand || null,
				...(data.gpType && {
					gpType: data.gpType,
					managementCompanyId: data.managementCompanyId,
					managementCompanyName: data.managementCompanyName
				})
			});

			loadProfile();
		} catch (error) {
			console.warn('Session profile refresh failed:', error);
		}
	}

	async function syncProfile(fields) {
		const token = getToken();
		if (!token) return;
		const resp = await fetch('/api/userdata', {
			method: 'POST',
			headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
			body: JSON.stringify({ type: 'profile', data: fields })
		});
		if (!resp.ok) {
			console.warn('Profile sync returned', resp.status);
		}
	}

	async function saveProfile() {
		profileSaving = true;
		const fullName = `${firstName} ${lastName}`.trim();
		patchStoredUser({
			firstName,
			lastName,
			name: fullName || email.split('@')[0] || '',
			fullName,
			phone,
			location,
			share_activity: shareActivity,
			avatar_url: avatarUrl,
			accredited_status: accreditedStatus,
			investable_capital: investableCapital,
			investment_experience: investmentExperience
		});

		try {
			await syncProfile({
				full_name: fullName,
				phone,
				location,
				share_activity: shareActivity,
				avatar_url: avatarUrl,
				accredited_status: accreditedStatus,
				investable_capital: investableCapital,
				investment_experience: investmentExperience
			});
		} catch (error) {
			console.warn('Profile save failed:', error);
		}

		profileSaving = false;
		profileSaved = true;
		setTimeout(() => {
			profileSaved = false;
		}, 2000);
	}

	function updateShareActivity(isOn) {
		shareActivity = isOn;
		patchStoredUser({ share_activity: isOn });
		syncProfile({ share_activity: isOn }).catch(() => {});
	}

	async function toggleAutoRenew(nextValue) {
		autoRenewSaving = true;
		patchStoredUser({ autoRenew: nextValue });
		try {
			const token = getToken();
			if (token) {
				await fetch('/api/userdata', {
					method: 'POST',
					headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
					body: JSON.stringify({ type: 'autoRenew', data: { autoRenew: nextValue } })
				});
			}
		} catch (error) {
			console.warn('Auto renew save failed:', error);
		}
		autoRenewSaving = false;
	}

	function openBillingPortal() {
		if (!browser) return;
		const currentUser = getStoredUser() || {};
		const url = `https://growyourcashflow.io/billing?email=${encodeURIComponent(currentUser.email || email || '')}`;
		window.open(url, '_blank', 'noopener');
	}

	async function saveNotifPrefs() {
		const prefs = { frequency: notifFreq, deal_alerts: dealAlerts, weekly_digest: weeklyDigest };
		if (browser) {
			localStorage.setItem('gycNotifPrefs', JSON.stringify(prefs));
		}
		try {
			const token = getToken();
			if (token) {
				await fetch('/api/userdata', {
					method: 'POST',
					headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
					body: JSON.stringify({ type: 'notif_prefs', data: { frequency: notifFreq } })
				});
			}
		} catch (error) {
			console.warn('Notif prefs save failed:', error);
		}
		notifSaved = true;
		setTimeout(() => {
			notifSaved = false;
		}, 2000);
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
			const token = getToken();
			if (token) {
				const resp = await fetch('/api/userdata?type=notif_prefs', {
					headers: { Authorization: `Bearer ${token}` }
				});
				if (resp.ok) {
					const data = await resp.json();
					if (data.notif_frequency) prefs.frequency = data.notif_frequency;
				}
			}
		} catch {
			// Use local fallback.
		}
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
			avatarUrl = e.target?.result || '';
			patchStoredUser({ avatar_url: avatarUrl });
		};
		reader.readAsDataURL(file);
	}

	function logout() {
		user.logout();
		goto('/');
	}

	const reviewCount = $derived.by(() => {
		if (!browser) return 0;
		try {
			const stages = JSON.parse(localStorage.getItem('gycDealStages') || '{}');
			let count = 0;
			for (const key in stages) {
				const stage = stages[key];
				if (stage && !['browse', 'passed', 'filter', 'skipped'].includes(stage)) count++;
			}
			return count;
		} catch {
			return 0;
		}
	});

	const displayName = $derived((firstName + ' ' + lastName).trim() || 'Your Name');

	onMount(() => {
		const params = new URLSearchParams(window.location.search);
		const tab = params.get('tab');
		if (['profile', 'plan', 'investor', 'privacy', 'notifications'].includes(tab)) {
			activeTab = tab;
		}
		if (params.get('unsubscribed') === 'true') {
			activeTab = 'notifications';
		}
		loadProfile();
		loadNotifPrefs();
		refreshSessionProfile();
	});
</script>

<div class="ly-page">
	<div class="ly-frame">
<div class="settings-page">
	<div class="settings-shell">
		<div class="settings-shell-title">Settings</div>
	</div>

	<div class="settings-tabs">
		<button class="settings-tab" class:active={activeTab === 'profile'} onclick={() => activeTab = 'profile'}>Profile</button>
		<button class="settings-tab" class:active={activeTab === 'plan'} onclick={() => activeTab = 'plan'}>My Plan</button>
		<button class="settings-tab" class:active={activeTab === 'investor'} onclick={() => activeTab = 'investor'}>Investor</button>
		<button class="settings-tab" class:active={activeTab === 'privacy'} onclick={() => activeTab = 'privacy'}>Privacy</button>
		<button class="settings-tab" class:active={activeTab === 'notifications'} onclick={() => activeTab = 'notifications'}>Notifications</button>
	</div>

	{#if activeTab === 'profile'}
		<div class="settings-panel">
			<div class="settings-page-title">Your Profile</div>
			<div class="settings-page-desc">Manage your account information and how others reach you.</div>

			<div class="settings-card">
				<div class="settings-card-title">Personal Information</div>
				<div class="settings-card-desc">This information is shown to GPs when you request an introduction.</div>
				<div class="avatar-row profile-avatar-row">
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
						<div class="avatar-help">This appears on your member profile and next to your deal activity.</div>
					</div>
				</div>
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

	{#if activeTab === 'plan'}
		<div class="settings-panel">
			<div class="settings-page-title">Your Membership</div>
			<div class="settings-page-desc">See what's included in your current plan.</div>

			<div class="settings-card membership-status-card">
				<div class="tier-badge" class:tier-badge-free={activeMembershipKey === 'free'} style={`--tier-accent: ${currentPlanMeta.accent};`}>
					<span class="tier-dot"></span>
					{currentPlanMeta.label}
				</div>
				{#if activeMembershipKey !== 'free' && (membershipStart || membershipEnd)}
					<div class="membership-dates">
						{#if membershipStart}
							<div>Started <strong>{membershipStart}</strong></div>
						{/if}
						{#if membershipEnd}
							<div>Renews <strong>{membershipEnd}</strong></div>
						{/if}
					</div>
				{/if}
			</div>

			<div class="plan-grid">
				{#each membershipPlans as plan}
					<div
						class="plan-card"
						class:current={plan.key === activeMembershipKey}
						class:subsumed={(planOrder[plan.key] || 0) < (planOrder[activeMembershipKey] || 0)}
						style={`--plan-accent:${plan.accent};`}
					>
						{#if plan.key === activeMembershipKey}
							<div class="plan-current">Current Plan</div>
						{/if}

						<div class="plan-name">{plan.label}</div>
						<div class="plan-price">{plan.priceNote}</div>

						<div class="plan-features">
							{#each plan.features as feature}
								<div class="plan-feature">
									{#if isPlanUnlocked(plan.key, activeMembershipKey)}
										<svg viewBox="0 0 24 24" fill="none" stroke="#51BE7B" stroke-width="2.5" width="14" height="14"><polyline points="20 6 9 17 4 12"/></svg>
									{:else}
										<svg viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" stroke-width="2" width="13" height="13" class="plan-lock"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
									{/if}
									<span>{feature}</span>
								</div>
							{/each}
						</div>

						{#if (planOrder[plan.key] || 0) > (planOrder[activeMembershipKey] || 0)}
							{#if plan.key === 'academy'}
								<a href="/app/academy" class="plan-action primary-action">Upgrade</a>
							{:else}
								<a href="https://growyourcashflow.io/introcall" target="_blank" rel="noopener" class="plan-action secondary-action">Book a Call</a>
							{/if}
						{/if}
					</div>
				{/each}
			</div>

			{#if activeMembershipKey === 'academy'}
				<div class="settings-card alumni-note-card">
					<div class="alumni-note-header">
						<span>After your first year</span>
						<span class="alumni-pill">Alumni</span>
					</div>
					<div class="alumni-note-copy">
						Stay connected for <strong>$2,000/yr</strong> or <strong>$300/mo</strong>. You keep full access to deal data, GP introductions, office hours, and the investor community.
					</div>
				</div>
			{/if}

			{#if activeMembershipKey !== 'free'}
				<div class="settings-card billing-card">
					<div class="settings-card-title billing-title">Billing</div>
					<div class="billing-row">
						<div>
							<div class="billing-label">Payment Method</div>
							<div class="billing-value">{billingCardLabel}</div>
						</div>
						<button class="billing-btn" onclick={openBillingPortal}>{membershipUser.cardLast4 ? 'Update' : 'Add Card'}</button>
					</div>
					<div class="billing-row no-border">
						<div>
							<div class="billing-label">Auto-Renew Membership</div>
							<div class="billing-value">Automatically renew at $2,000/yr or $300/mo when your membership ends.</div>
						</div>
						<div class="billing-toggle-wrap">
							<button class="toggle-track" class:on={autoRenewEnabled} aria-label="Toggle auto-renew membership" aria-pressed={autoRenewEnabled} disabled={autoRenewSaving} onclick={() => toggleAutoRenew(!autoRenewEnabled)}>
								<div class="toggle-thumb"></div>
							</button>
							{#if autoRenewSaving}
								<span class="billing-saving">Saving...</span>
							{/if}
						</div>
					</div>
				</div>
			{/if}
		</div>
	{/if}

	{#if activeTab === 'investor'}
		<div class="settings-panel">
			<div class="settings-page-title">Investor Profile</div>
			<div class="settings-page-desc">Help GPs understand your background and investment capacity when you request introductions.</div>

			<div class="settings-card">
				<div class="settings-card-title">Investment Background</div>
				<div class="settings-card-desc">This helps sponsors understand how you evaluate opportunities.</div>
				<div class="profile-row">
					<div class="profile-field">
						<div class="profile-label">Accreditation Status</div>
						<select class="profile-input" bind:value={accreditedStatus}>
							<option value="">Select status</option>
							<option value="Accredited Investor">Accredited Investor</option>
							<option value="Qualified Purchaser">Qualified Purchaser</option>
							<option value="Non-Accredited">Non-Accredited</option>
						</select>
					</div>
					<div class="profile-field">
						<div class="profile-label">Investable Capital</div>
						<select class="profile-input" bind:value={investableCapital}>
							<option>$50K - $250K</option>
							<option>$250K - $1M</option>
							<option>$1M - $5M</option>
							<option>$5M+</option>
						</select>
					</div>
				</div>
				<div class="profile-field">
					<div class="profile-label">Investment Experience</div>
					<select class="profile-input" bind:value={investmentExperience}>
						<option>New to LP investing</option>
						<option>1-3 LP investments</option>
						<option>4-10 LP investments</option>
						<option>10+ LP investments</option>
					</select>
				</div>
			</div>

			<div class="settings-save-bar">
				{#if profileSaved}
					<div class="save-msg">Investor profile saved</div>
				{/if}
				<button class="btn-cta-primary" onclick={saveProfile} disabled={profileSaving}>
					{profileSaving ? 'Saving...' : 'Save Investor Profile'}
				</button>
			</div>
		</div>
	{/if}

	{#if activeTab === 'privacy'}
		<div class="settings-panel">
			<div class="settings-page-title">Privacy &amp; Sharing</div>
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
				<div class="settings-card-title">Portfolio Visibility</div>
				<div class="settings-card-desc" style="margin-bottom:16px;">When on, your deal activity can contribute to shared community visibility features. Your name and dollar amounts are never shown.</div>
				<div class="toggle-row">
					<button class="toggle-track" class:on={shareActivity} aria-label="Toggle deal activity sharing" aria-pressed={shareActivity} onclick={() => updateShareActivity(!shareActivity)}>
						<div class="toggle-thumb"></div>
					</button>
					<div>
						<div class="toggle-label">{shareActivity ? 'Activity sharing is on' : 'Activity sharing is off'}</div>
						<div class="toggle-desc">{shareActivity ? "You're contributing to community deal intelligence" : 'Your deal activity is hidden from other members'}</div>
					</div>
				</div>
			</div>

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

			<div class="settings-card" style="margin-top:16px;">
				<div class="settings-card-title">Preview: How you appear on deals</div>
				<div class="settings-card-desc">What shows on deal cards and deal pages when you're in the pipeline.</div>
				<div class="preview-box">
					{#if shareActivity}
						<div>
							<div class="deal-preview-row">
								<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
								Community visibility is on
							</div>
							<div class="deal-preview-sub green">
								<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="12" height="12"><polyline points="20 6 9 17 4 12"/></svg>
								Your activity may contribute to aggregate visibility signals
							</div>
						</div>
					{:else}
						<div>
							<div class="deal-preview-row">
								<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
								Community visibility is off
							</div>
							<div class="deal-preview-sub muted">
								<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="12" height="12"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
								Your activity will not contribute to shared visibility features
							</div>
						</div>
					{/if}
				</div>
			</div>
		</div>
	{/if}

	{#if activeTab === 'notifications'}
		<div class="settings-panel">
			<div class="settings-page-title">Notification Preferences</div>
			<div class="settings-page-desc">Control how and when you receive deal alert emails.</div>

			<div class="notif-card">
				<div class="notif-title">Deal Alert Frequency</div>
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
					<button class="toggle-track" class:on={dealAlerts} aria-label="Toggle deal alerts" aria-pressed={dealAlerts} onclick={toggleDealAlerts}>
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
					<button class="toggle-track" class:on={weeklyDigest} aria-label="Toggle weekly digest emails" aria-pressed={weeklyDigest} onclick={toggleWeeklyDigest}>
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
</div>
</div>

<style>
	.settings-page { padding: 0 32px 40px; max-width: 920px; }
	.settings-shell {
		padding: 26px 0 18px;
		margin: 0 -32px 24px;
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
	.settings-tabs {
		display: flex;
		gap: 0;
		border-bottom: 2px solid var(--border-light);
		margin-bottom: 24px;
		overflow-x: auto;
		-webkit-overflow-scrolling: touch;
	}
	.settings-tab {
		padding: 12px 24px;
		font-family: var(--font-ui);
		font-size: 13px;
		font-weight: 600;
		color: var(--text-muted);
		cursor: pointer;
		border: none;
		background: none;
		border-bottom: 2px solid transparent;
		margin-bottom: -2px;
		transition: all var(--transition, 0.2s);
		white-space: nowrap;
	}
	.settings-tab:hover { color: var(--text-dark); }
	.settings-tab.active { color: var(--primary); border-bottom-color: var(--primary); }
	.settings-page-title { font-family: var(--font-headline); font-size: 28px; color: var(--text-dark); margin-bottom: 8px; }
	.settings-page-desc { font-family: var(--font-body); font-size: 14px; color: var(--text-secondary); margin-bottom: 24px; line-height: 1.6; }
	.settings-card { background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius); padding: 20px; margin-bottom: 16px; box-shadow: var(--shadow-card); }
	.settings-card-title { font-family: var(--font-ui); font-size: 15px; font-weight: 700; color: var(--text-dark); margin-bottom: 4px; }
	.settings-card-desc { font-family: var(--font-body); font-size: 13px; color: var(--text-muted); margin-bottom: 16px; }
	.always-private { background: var(--bg-cream); border: 1px solid var(--border-light); }
	.card-header-row { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; }
	.private-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px 24px; }
	.private-item { display: flex; align-items: center; gap: 6px; font-family: var(--font-body); font-size: 13px; color: var(--text-secondary); }

	.avatar-row { display: flex; align-items: center; gap: 16px; flex-wrap: wrap; }
	.profile-avatar-row { margin-bottom: 18px; padding-bottom: 18px; border-bottom: 1px solid var(--border-light); }
	.avatar-preview { width: 52px; height: 52px; border-radius: 50%; background: var(--primary); border: none; display: flex; align-items: center; justify-content: center; font-family: var(--font-ui); font-size: 17px; font-weight: 700; color: #fff; overflow: hidden; flex-shrink: 0; }
	.avatar-preview img { width: 100%; height: 100%; object-fit: cover; }
	.avatar-actions { display: flex; flex-direction: column; gap: 6px; }
	.avatar-help { font-family: var(--font-body); font-size: 12px; color: var(--text-muted); line-height: 1.5; }
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
	.btn-cta-primary { padding: 12px 32px; border-radius: 8px; background: var(--primary); color: #fff; font-family: var(--font-ui); font-size: 14px; font-weight: 700; border: none; cursor: pointer; transition: all 0.15s; text-decoration: none; }
	.btn-cta-primary:hover { background: #45A86C; }
	.btn-cta-primary:disabled { opacity: 0.6; cursor: not-allowed; }

	.membership-status-card { padding: 18px 20px; margin-bottom: 14px; }
	.tier-badge {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		padding: 6px 14px;
		border-radius: 999px;
		font-family: var(--font-ui);
		font-size: 13px;
		font-weight: 700;
		background: rgba(81,190,123,0.08);
		border: 1px solid rgba(81,190,123,0.2);
		color: var(--tier-accent, var(--primary));
	}
	.tier-badge-free {
		background: var(--bg-cream);
		border-color: var(--border-light);
		color: var(--text-secondary);
	}
	.tier-dot { width: 8px; height: 8px; border-radius: 50%; background: currentColor; }
	.membership-dates { display: flex; gap: 24px; flex-wrap: wrap; margin-top: 10px; font-family: var(--font-body); font-size: 13px; color: var(--text-muted); }
	.membership-dates strong { color: var(--text-dark); }

	.plan-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; margin-bottom: 16px; }
	.plan-card {
		position: relative;
		display: flex;
		flex-direction: column;
		gap: 10px;
		padding: 18px 14px 14px;
		background: var(--bg-card);
		border: 1px solid var(--border);
		border-radius: 12px;
		min-height: 100%;
	}
	.plan-card.current { border: 2px solid var(--primary); }
	.plan-card.subsumed { opacity: 0.55; }
	.plan-current {
		position: absolute;
		top: -10px;
		left: 50%;
		transform: translateX(-50%);
		padding: 3px 10px;
		border-radius: 999px;
		background: var(--primary);
		color: #fff;
		font-family: var(--font-ui);
		font-size: 10px;
		font-weight: 700;
		letter-spacing: 0.5px;
		text-transform: uppercase;
		white-space: nowrap;
	}
	.plan-name { font-family: var(--font-ui); font-size: 15px; font-weight: 700; color: var(--plan-accent); }
	.plan-price { font-family: var(--font-body); font-size: 12px; color: var(--text-muted); margin-bottom: 2px; }
	.plan-features { display: grid; gap: 6px; flex: 1; }
	.plan-feature { display: flex; align-items: flex-start; gap: 6px; font-family: var(--font-body); font-size: 12px; color: var(--text-dark); line-height: 1.4; }
	.plan-lock { opacity: 0.5; }
	.plan-action {
		display: block;
		margin-top: 10px;
		padding: 10px 14px;
		border-radius: 8px;
		font-family: var(--font-ui);
		font-size: 13px;
		font-weight: 700;
		text-align: center;
		text-decoration: none;
	}
	.primary-action { background: var(--primary); color: #fff; }
	.secondary-action { background: transparent; color: var(--text-dark); border: 1px solid var(--border); }

	.alumni-note-card { background: rgba(81,190,123,0.04); border: 1px dashed rgba(81,190,123,0.3); }
	.alumni-note-header { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; font-family: var(--font-ui); font-size: 13px; font-weight: 700; color: var(--text-dark); }
	.alumni-pill { display: inline-flex; align-items: center; padding: 2px 8px; border-radius: 999px; background: rgba(81,190,123,0.12); color: var(--primary); font-size: 10px; font-weight: 700; letter-spacing: 0.5px; text-transform: uppercase; }
	.alumni-note-copy { font-family: var(--font-body); font-size: 13px; color: var(--text-muted); line-height: 1.5; }
	.alumni-note-copy strong { color: var(--text-dark); }

	.billing-card { margin-top: 20px; }
	.billing-title { margin-bottom: 16px; }
	.billing-row { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 14px 0; border-bottom: 1px solid var(--border-light); flex-wrap: wrap; }
	.billing-row.no-border { border-bottom: none; padding-bottom: 0; }
	.billing-label { font-family: var(--font-ui); font-size: 13px; font-weight: 600; color: var(--text-dark); }
	.billing-value { font-family: var(--font-body); font-size: 13px; color: var(--text-muted); margin-top: 3px; line-height: 1.5; }
	.billing-btn { padding: 8px 16px; background: transparent; border: 1px solid var(--border); border-radius: 8px; font-family: var(--font-ui); font-size: 12px; font-weight: 600; color: var(--text-dark); cursor: pointer; }
	.billing-toggle-wrap { display: flex; align-items: center; gap: 10px; }
	.billing-saving { font-family: var(--font-ui); font-size: 11px; font-weight: 600; color: var(--text-muted); }

	.toggle-row { display: flex; align-items: center; gap: 14px; padding: 12px 16px; background: var(--bg-cream); border: 1px solid var(--border-light); border-radius: var(--radius-sm); }
	.toggle-track { position: relative; width: 48px; height: 26px; flex-shrink: 0; cursor: pointer; border: none; background: var(--border); border-radius: 13px; transition: background 0.2s; padding: 0; }
	.toggle-track.on { background: var(--teal-deep, var(--primary)); }
	.toggle-thumb { position: absolute; top: 2px; left: 2px; width: 22px; height: 22px; background: #fff; border-radius: 50%; box-shadow: 0 1px 3px rgba(0,0,0,0.2); transition: transform 0.2s; pointer-events: none; }
	.toggle-track.on .toggle-thumb { transform: translateX(22px); }
	.toggle-track:disabled { opacity: 0.6; cursor: not-allowed; }
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

	@media (max-width: 900px) {
		.plan-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
	}

	@media (max-width: 768px) {
		.settings-page { padding: 0 16px 24px; }
		.settings-shell {
			margin: 0 -16px 20px;
			padding: 20px 16px 14px;
		}
		.settings-shell-title { font-size: 20px; }
		.settings-tabs { margin-bottom: 20px; }
		.settings-tab { padding: 12px 16px; font-size: 12px; }
		.settings-page-title { font-size: 24px; }
		.settings-page-desc { font-size: 13px; margin-bottom: 20px; }
		.settings-card { padding: 16px; }
		.profile-row { grid-template-columns: 1fr; }
		.private-grid { grid-template-columns: 1fr; }
		.settings-tabs { scrollbar-width: none; }
		.settings-tabs::-webkit-scrollbar { display: none; }
		.plan-grid { grid-template-columns: 1fr; }
		.membership-status-card { padding: 16px; }
		.membership-dates { gap: 12px; flex-direction: column; }
		.plan-card { padding: 18px 16px 16px; }
		.plan-action { width: 100%; box-sizing: border-box; }
		.billing-row { align-items: flex-start; }
		.billing-btn { width: 100%; }
		.billing-toggle-wrap { width: 100%; justify-content: flex-end; }
		.toggle-row { align-items: flex-start; }
		.preview-box { flex-direction: column; align-items: flex-start; }
		.notif-btns { flex-direction: column; }
		.notif-freq-btn { width: 100%; min-width: 0; }
		.logout-section { flex-direction: column; align-items: stretch; }
		.logout-btn { width: 100%; justify-content: center; }
	}

	@media (max-width: 480px) {
		.settings-page { padding: 0 14px 24px; }
		.settings-shell {
			margin: 0 -14px 18px;
			padding: 18px 14px 12px;
		}
		.settings-tab { padding: 11px 14px; }
		.profile-input { font-size: 16px; }
		.avatar-row { align-items: flex-start; }
		.profile-avatar-row { gap: 12px; }
		.membership-status-card { padding: 14px; }
		.plan-current { font-size: 9px; top: -9px; }
		.alumni-note-header { align-items: flex-start; flex-wrap: wrap; }
		.billing-saving { min-width: 56px; text-align: right; }
	}
</style>
