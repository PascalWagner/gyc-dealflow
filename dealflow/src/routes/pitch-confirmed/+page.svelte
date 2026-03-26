<script>
	import { onMount } from 'svelte';
	import { getStoredSessionUser } from '$lib/stores/auth.js';

	let selectedDate = $state(null);
	let bookingState = $state('idle'); // idle | booking | success | error
	let bookedDateText = $state('');
	let gcalLink = $state('');
	let btnText = $state('Select a date above');
	let thursdays = $state([]);

	const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

	function getUpcomingThursdays(count) {
		const dates = [];
		const d = new Date();
		d.setDate(d.getDate() + ((4 - d.getDay() + 7) % 7 || 7));
		const minDate = new Date();
		minDate.setDate(minDate.getDate() + 14);
		while (dates.length < count) {
			if (d >= minDate) {
				dates.push(new Date(d));
			}
			d.setDate(d.getDate() + 7);
		}
		return dates;
	}

	onMount(() => {
		thursdays = getUpcomingThursdays(6);
	});

	function selectDate(date) {
		selectedDate = date;
		const fullDate = date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
		btnText = `Confirm ${fullDate} →`;
	}

	async function submitBooking() {
		if (!selectedDate) return;
		bookingState = 'booking';
		btnText = 'Booking...';

		const user = getStoredSessionUser() || {};
		try {
			const res = await fetch('/api/pitch-booking', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'Authorization': `Bearer ${user.token || ''}`
				},
				body: JSON.stringify({
					name: user.name || 'Unknown',
					email: user.email || 'unknown',
					selectedDate: selectedDate.toISOString()
				})
			});
			const data = await res.json();
			bookedDateText = selectedDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }) + ' at 1:00 PM ET';
			if (data.gcalLink) gcalLink = data.gcalLink;
			bookingState = 'success';
		} catch {
			bookingState = 'error';
			btnText = 'Something went wrong — try again';
		}
	}
</script>

<svelte:head>
	<title>Pitch Booked — GYC Dealflow</title>
	<link href="https://fonts.googleapis.com/css2?family=DM+Serif+Display&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Source+Sans+3:wght@300;400;500;600;700&display=swap" rel="stylesheet">
</svelte:head>

<div class="ly-page">
<div class="page-wrap">
	<div class="content-wrap">

		<div class="breadcrumb">
			<a href="/gp-dashboard">GP Dashboard</a>
			<span class="breadcrumb-sep">/</span>
			<a href="/book-pitch">Book Your Pitch</a>
			<span class="breadcrumb-sep">/</span>
			<span class="breadcrumb-current">Confirmed</span>
		</div>

		<!-- Confirmation Hero -->
		<div class="confirm-hero">
			<div class="confirm-check">
				<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
			</div>
			<h1>Payment Received!</h1>
			<p>Your $1,000 pitch slot is secured. Now pick your Thursday and we'll handle the rest.</p>
		</div>

		<!-- Date Selection -->
		{#if bookingState !== 'success'}
		<div class="date-section">
			<h2>Pick Your Thursday</h2>
			<p class="date-section-sub">1:00 PM ET &bull; 90-minute session &bull; One operator per week</p>
			<div class="date-grid">
				{#each thursdays as date}
					<button
						class="date-option"
						class:selected={selectedDate === date}
						onclick={() => selectDate(date)}
					>
						<div class="date-option-cal" class:selected={selectedDate === date}>
							<span class="date-option-cal-month">{months[date.getMonth()]}</span>
							<span class="date-option-cal-day">{date.getDate()}</span>
						</div>
						<div class="date-option-info">
							<h4>{date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</h4>
							<span>1:00 PM – 2:30 PM ET</span>
						</div>
					</button>
				{/each}
			</div>
			<button
				class="date-confirm-btn"
				disabled={!selectedDate || bookingState === 'booking'}
				onclick={submitBooking}
			>{btnText}</button>
		</div>
		{/if}

		<!-- Booking Success -->
		{#if bookingState === 'success'}
		<div class="booking-success">
			<svg viewBox="0 0 24 24" fill="none" stroke="var(--primary, #51BE7B)" stroke-width="2.5" style="width:40px;height:40px;margin-bottom:12px;"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
			<h3>You're booked!</h3>
			<div class="booked-date">{bookedDateText}</div>
			<p>Check your inbox — we just sent you a confirmation email with everything you need to prepare.</p>
			<p style="margin-top:8px;color:var(--text-secondary, #607179);">Pascal will reach out within 24 hours to confirm your date and schedule your 15-minute prep call.</p>
			{#if gcalLink}
			<a href={gcalLink} target="_blank" class="gcal-btn">
				<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:18px;height:18px;"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
				Add to Google Calendar
			</a>
			{/if}
		</div>
		{/if}

		<!-- What Happens Next -->
		<div class="timeline">
			<div class="timeline-header">
				<div class="timeline-title">What Happens Next</div>
			</div>
			<div class="timeline-body">
				<ul class="timeline-steps">
					<li class="timeline-step">
						<div class="timeline-dot">1</div>
						<div class="timeline-step-text">
							<h4>Confirmation Email</h4>
							<p>You'll receive a confirmation email with your selected date and a calendar invite within 24 hours.</p>
						</div>
					</li>
					<li class="timeline-step">
						<div class="timeline-dot">2</div>
						<div class="timeline-step-text">
							<h4>Prep Call Scheduled</h4>
							<p>Pascal will reach out to schedule your 15-minute prep call to review your deck and set expectations.</p>
						</div>
					</li>
					<li class="timeline-step">
						<div class="timeline-dot">3</div>
						<div class="timeline-step-text">
							<h4>Investor Invitations Sent</h4>
							<p>One week before your presentation, every LP whose buy box matches your deal receives a personal invitation.</p>
						</div>
					</li>
					<li class="timeline-step">
						<div class="timeline-dot">4</div>
						<div class="timeline-step-text">
							<h4>Go Live</h4>
							<p>Present on your Thursday. We handle Zoom hosting, introductions, and moderation. You focus on your pitch.</p>
						</div>
					</li>
					<li class="timeline-step">
						<div class="timeline-dot">5</div>
						<div class="timeline-step-text">
							<h4>Post-Event Report + Intros</h4>
							<p>Within 48 hours you get your investor interest report, analytics, and warm introductions to high-intent LPs.</p>
						</div>
					</li>
				</ul>
			</div>
		</div>

		<!-- Prep Checklist -->
		<div class="prep-section">
			<div class="prep-header">
				<div class="prep-title">Prepare for Your Pitch</div>
			</div>
			<div class="prep-body">
				<ul class="prep-list">
					<li>
						<div class="prep-list-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg></div>
						<div class="prep-list-text">
							<h4>Finalize Your Deck</h4>
							<p>Prepare a 30-40 slide deck covering your deal thesis, financials, team, and track record. We'll review it together on the prep call.</p>
						</div>
					</li>
					<li>
						<div class="prep-list-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg></div>
						<div class="prep-list-text">
							<h4>Update Your Deal Page</h4>
							<p>Make sure your deal listing on the platform is current — investors will check it before and after the webinar.</p>
						</div>
					</li>
					<li>
						<div class="prep-list-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg></div>
						<div class="prep-list-text">
							<h4>Block 90 Minutes</h4>
							<p>Your session runs 1:00–2:30 PM ET. Plan for 45 minutes of presentation and 45 minutes of live Q&amp;A.</p>
						</div>
					</li>
					<li>
						<div class="prep-list-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg></div>
						<div class="prep-list-text">
							<h4>Know Your Numbers</h4>
							<p>Investors will ask about returns, fees, minimums, and track record. Come prepared with specifics — this is where trust gets built.</p>
						</div>
					</li>
				</ul>
			</div>
		</div>

		<div style="text-align:center;padding:16px 0;">
			<a href="/gp-dashboard" class="back-link">&larr; Back to GP Dashboard</a>
		</div>
	</div>
</div>
</div>

<style>
	.page-wrap {
		min-height: 100vh;
		background: var(--bg-cream, #FAF9F5);
		font-family: var(--font-body, 'Source Sans 3', sans-serif);
		color: var(--text-dark, #141413);
		line-height: 1.5;
		-webkit-font-smoothing: antialiased;
	}
	.content-wrap {
		max-width: 800px;
		padding: 32px 40px 64px;
		margin: 0 auto;
	}

	/* Breadcrumb */
	.breadcrumb { display: flex; align-items: center; gap: 8px; margin-bottom: 24px; }
	.breadcrumb a { font-family: var(--font-ui, 'Plus Jakarta Sans', sans-serif); font-size: 13px; font-weight: 600; color: var(--primary, #51BE7B); text-decoration: none; }
	.breadcrumb-sep { font-size: 12px; color: var(--text-muted, #8A9AA0); }
	.breadcrumb-current { font-family: var(--font-ui, 'Plus Jakarta Sans', sans-serif); font-size: 13px; font-weight: 600; color: var(--text-muted, #8A9AA0); }

	/* Confirmation Hero */
	.confirm-hero { text-align: center; padding: 48px 32px; margin-bottom: 32px; }
	.confirm-check {
		width: 72px; height: 72px; border-radius: 50%;
		background: var(--green-bg, #E7F5F0);
		display: flex; align-items: center; justify-content: center;
		margin: 0 auto 20px;
	}
	.confirm-check svg { width: 36px; height: 36px; color: var(--primary, #51BE7B); }
	.confirm-hero h1 { font-family: var(--font-headline, 'DM Serif Display', serif); font-size: 32px; color: var(--teal-deep, #1F5159); margin-bottom: 8px; }
	.confirm-hero p { font-size: 16px; color: var(--text-secondary, #607179); max-width: 500px; margin: 0 auto; }

	/* Date Section */
	.date-section {
		background: var(--bg-card, #fff);
		border: 2px solid var(--primary, #51BE7B);
		border-radius: var(--radius, 12px);
		padding: 32px;
		margin-bottom: 32px;
		box-shadow: var(--shadow-lg, 0 8px 30px rgba(0,0,0,0.08));
	}
	.date-section h2 { font-family: var(--font-headline, 'DM Serif Display', serif); font-size: 24px; color: var(--teal-deep, #1F5159); margin-bottom: 4px; text-align: center; }
	.date-section-sub { font-family: var(--font-ui, 'Plus Jakarta Sans', sans-serif); font-size: 14px; color: var(--text-muted, #8A9AA0); text-align: center; margin-bottom: 24px; }
	.date-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }

	.date-option {
		display: flex; align-items: center; gap: 14px;
		padding: 16px 20px;
		border: 2px solid var(--border-light, #EDF1F2);
		border-radius: var(--radius-sm, 8px);
		cursor: pointer;
		transition: all 0.2s;
		background: var(--bg-card, #fff);
		text-align: left;
		font-family: inherit;
		font-size: inherit;
		color: inherit;
	}
	.date-option:hover, .date-option.selected { border-color: var(--primary, #51BE7B); background: var(--green-bg, #E7F5F0); }

	.date-option-cal {
		width: 48px; height: 48px;
		background: var(--off-white, #FAF9F5);
		border: 1px solid var(--border-light, #EDF1F2);
		border-radius: var(--radius-sm, 8px);
		display: flex; flex-direction: column; align-items: center; justify-content: center;
		flex-shrink: 0;
	}
	.date-option-cal.selected { background: var(--teal-deep, #1F5159); border-color: var(--teal-deep, #1F5159); }
	.date-option-cal-month { font-family: var(--font-ui, 'Plus Jakarta Sans', sans-serif); font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: var(--text-muted, #8A9AA0); line-height: 1; }
	.date-option-cal.selected .date-option-cal-month { color: rgba(255,255,255,0.6); }
	.date-option-cal-day { font-family: var(--font-headline, 'DM Serif Display', serif); font-size: 20px; color: var(--teal-deep, #1F5159); line-height: 1; }
	.date-option-cal.selected .date-option-cal-day { color: #fff; }

	.date-option-info h4 { font-family: var(--font-ui, 'Plus Jakarta Sans', sans-serif); font-size: 14px; font-weight: 700; color: var(--text-dark, #141413); }
	.date-option-info span { font-family: var(--font-ui, 'Plus Jakarta Sans', sans-serif); font-size: 12px; color: var(--text-muted, #8A9AA0); }

	.date-confirm-btn {
		display: block; width: 100%; margin-top: 20px; padding: 16px;
		font-family: var(--font-ui, 'Plus Jakarta Sans', sans-serif); font-size: 16px; font-weight: 700;
		background: var(--primary, #51BE7B); color: #fff;
		border: none; border-radius: var(--radius-sm, 8px);
		cursor: pointer; transition: background 0.2s, transform 0.15s;
	}
	.date-confirm-btn:hover { background: var(--primary-hover, #45A86C); transform: translateY(-1px); }
	.date-confirm-btn:disabled { background: var(--border, #DDE5E8); cursor: not-allowed; transform: none; }

	/* Booking Success */
	.booking-success {
		text-align: center; padding: 32px;
		background: var(--green-bg, #E7F5F0);
		border: 1px solid var(--primary, #51BE7B);
		border-radius: var(--radius, 12px);
		margin-bottom: 32px;
	}
	.booking-success h3 { font-family: var(--font-headline, 'DM Serif Display', serif); font-size: 22px; color: var(--teal-deep, #1F5159); margin-bottom: 8px; }
	.booking-success p { font-size: 15px; color: var(--text-secondary, #607179); }
	.booked-date { font-family: var(--font-ui, 'Plus Jakarta Sans', sans-serif); font-size: 18px; font-weight: 700; color: var(--teal-deep, #1F5159); margin: 12px 0; }
	.gcal-btn {
		display: inline-flex; align-items: center; gap: 8px;
		margin-top: 16px; padding: 12px 24px;
		background: var(--primary, #51BE7B); color: #fff;
		border-radius: var(--radius-sm, 8px);
		text-decoration: none;
		font-family: var(--font-ui, 'Plus Jakarta Sans', sans-serif); font-size: 14px; font-weight: 700;
		transition: background 0.2s;
	}
	.gcal-btn:hover { background: var(--primary-hover, #45A86C); }

	/* Timeline */
	.timeline {
		background: var(--bg-card, #fff);
		border: 1px solid var(--border-light, #EDF1F2);
		border-radius: var(--radius, 12px);
		box-shadow: var(--shadow-card, 0 1px 3px rgba(0,0,0,0.06));
		margin-bottom: 24px;
		overflow: hidden;
	}
	.timeline-header { padding: 18px 24px; border-bottom: 1px solid var(--border-light, #EDF1F2); }
	.timeline-title { font-family: var(--font-ui, 'Plus Jakarta Sans', sans-serif); font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1.5px; color: var(--primary, #51BE7B); }
	.timeline-body { padding: 24px; }
	.timeline-steps { list-style: none; position: relative; padding: 0; margin: 0; }
	.timeline-steps::before { content: ''; position: absolute; left: 15px; top: 8px; bottom: 8px; width: 2px; background: var(--border-light, #EDF1F2); }
	.timeline-step { display: flex; align-items: flex-start; gap: 16px; padding: 12px 0; position: relative; }
	.timeline-dot {
		width: 32px; height: 32px; border-radius: 50%;
		background: var(--green-bg, #E7F5F0);
		border: 2px solid var(--primary, #51BE7B);
		display: flex; align-items: center; justify-content: center;
		flex-shrink: 0;
		font-family: var(--font-ui, 'Plus Jakarta Sans', sans-serif); font-size: 13px; font-weight: 700; color: var(--primary, #51BE7B);
		z-index: 1;
	}
	.timeline-step-text h4 { font-family: var(--font-ui, 'Plus Jakarta Sans', sans-serif); font-size: 14px; font-weight: 700; color: var(--text-dark, #141413); margin-bottom: 2px; }
	.timeline-step-text p { font-size: 13px; color: var(--text-secondary, #607179); line-height: 1.4; }

	/* Prep Section */
	.prep-section {
		background: var(--bg-card, #fff);
		border: 1px solid var(--border-light, #EDF1F2);
		border-radius: var(--radius, 12px);
		box-shadow: var(--shadow-card, 0 1px 3px rgba(0,0,0,0.06));
		margin-bottom: 24px;
		overflow: hidden;
	}
	.prep-header { padding: 18px 24px; border-bottom: 1px solid var(--border-light, #EDF1F2); }
	.prep-title { font-family: var(--font-ui, 'Plus Jakarta Sans', sans-serif); font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1.5px; color: var(--primary, #51BE7B); }
	.prep-body { padding: 24px; }
	.prep-list { list-style: none; padding: 0; margin: 0; }
	.prep-list li { display: flex; align-items: flex-start; gap: 14px; padding: 14px 0; border-bottom: 1px solid var(--border-light, #EDF1F2); }
	.prep-list li:last-child { border-bottom: none; }
	.prep-list-icon {
		width: 32px; height: 32px; background: var(--green-bg, #E7F5F0); border-radius: 50%;
		display: flex; align-items: center; justify-content: center; flex-shrink: 0; color: var(--primary, #51BE7B);
	}
	.prep-list-icon svg { width: 16px; height: 16px; }
	.prep-list-text h4 { font-family: var(--font-ui, 'Plus Jakarta Sans', sans-serif); font-size: 14px; font-weight: 700; color: var(--text-dark, #141413); margin-bottom: 2px; }
	.prep-list-text p { font-size: 14px; color: var(--text-secondary, #607179); line-height: 1.5; }

	.back-link { font-family: var(--font-ui, 'Plus Jakarta Sans', sans-serif); font-size: 14px; font-weight: 600; color: var(--primary, #51BE7B); text-decoration: none; }

	@media (max-width: 768px) {
		.content-wrap { padding: 20px 16px 48px; }
		.date-grid { grid-template-columns: 1fr; }
		.confirm-hero { padding: 32px 16px; }
		.confirm-hero h1 { font-size: 26px; }
	}
</style>
