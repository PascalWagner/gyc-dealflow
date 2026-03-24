<script>
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';
	import { isAcademy, isAdmin, userToken } from '$lib/stores/auth.js';
	import {
		downloadEventIcs,
		formatCanonicalDate,
		formatCanonicalTimeRange,
		formatLocalDateTimeRange,
		resolveBrowserTimeZone
	} from '$lib/utils/memberEvents.js';

	let loading = $state(true);
	let error = $state('');
	let forbidden = $state(false);
	let events = $state([]);
	let nextSession = $state(null);
	let localTimeZone = $state(null);
	let sourceLabel = $state('Google Calendar');

	const replayLibraryUrl = '/app/resources?category=Office%20Hours';

	const canAccess = $derived($isAdmin || $isAcademy);
	const timezoneSummary = $derived.by(() => {
		if (!localTimeZone) return 'Local timezone unavailable. Eastern Time is the canonical schedule reference.';
		return `Showing your local time in ${localTimeZone}. Eastern Time remains the canonical schedule reference.`;
	});

	function canonicalDate(event) {
		return formatCanonicalDate(event.startDateTime);
	}

	function canonicalTime(event) {
		return formatCanonicalTimeRange(event.startDateTime, event.endDateTime);
	}

	function localTime(event) {
		return formatLocalDateTimeRange(event.startDateTime, event.endDateTime, localTimeZone);
	}

	async function loadOfficeHours() {
		if (!browser) return;

		loading = true;
		error = '';
		forbidden = false;
		localTimeZone = resolveBrowserTimeZone();

		try {
			const stored = JSON.parse(localStorage.getItem('gycUser') || '{}');
			const token = stored.token || $userToken;
			if (!token) {
				throw new Error('Missing session token');
			}

			const response = await fetch('/api/member-events?programSlug=cashflow_academy&eventType=office_hours&limit=6', {
				headers: {
					Authorization: `Bearer ${token}`
				}
			});

			if (response.status === 403) {
				forbidden = true;
				events = [];
				nextSession = null;
				return;
			}

			if (!response.ok) {
				throw new Error('Failed to load office hours');
			}

			const payload = await response.json();
			sourceLabel = payload.sourceKind === 'google_calendar' ? 'Live Google Calendar' : 'Event source';
			events = payload.upcomingSessions || payload.events || [];
			nextSession = payload.nextSession || events[0] || null;
		} catch (fetchError) {
			console.warn('office hours load failed:', fetchError);
			error = 'Unable to load the Office Hours schedule right now.';
		} finally {
			loading = false;
		}
	}

	onMount(() => {
		loadOfficeHours();
	});
</script>

<svelte:head>
	<title>Office Hours | GYC</title>
</svelte:head>

<div class="office-hours-page">
	<div class="office-hours-hero">
		<div>
			<div class="page-eyebrow">Cashflow Academy</div>
			<h1>Office Hours</h1>
			<p class="hero-copy">
				Your private concierge window with Pascal. Bring live deals, capital allocation decisions, and
				anything blocking your next move.
			</p>
		</div>
		<div class="hero-actions">
			<div class="hero-badge">Members only</div>
			<a class="hero-link" href={replayLibraryUrl}>Replay Library</a>
		</div>
	</div>

	{#if loading}
		<div class="office-hours-grid">
			<div class="schedule-card skeleton-card"></div>
			<div class="schedule-card skeleton-card"></div>
		</div>
	{:else if forbidden && !canAccess}
		<div class="gate-card">
			<div class="gate-pill">Academy access required</div>
			<h2>Office Hours is reserved for Cashflow Academy members.</h2>
			<p>
				Join the weekly live session to get deal feedback, portfolio guidance, and direct answers from
				Pascal in real time.
			</p>
			<div class="gate-actions">
				<a class="primary-btn" href="/app/academy">See Academy Access</a>
				<a class="secondary-btn" href={replayLibraryUrl}>View Replay Library</a>
			</div>
		</div>
	{:else if error}
		<div class="gate-card">
			<div class="gate-pill">Schedule unavailable</div>
			<h2>Office Hours couldn’t be loaded.</h2>
			<p>{error}</p>
			<div class="gate-actions">
				<button class="primary-btn button-reset" onclick={loadOfficeHours}>Try Again</button>
				<a class="secondary-btn" href={replayLibraryUrl}>Replay Library</a>
			</div>
		</div>
	{:else}
		<div class="office-hours-grid">
			<section class="schedule-card featured-card">
				<div class="card-header">
					<div>
						<div class="card-label">Next Session</div>
						<h2>{nextSession?.title || 'No session scheduled'}</h2>
					</div>
					{#if nextSession?.status === 'rescheduled'}
						<div class="status-pill status-moved">Moved</div>
					{/if}
				</div>

				{#if nextSession}
					<div class="time-stack">
						<div class="time-local">{localTime(nextSession) || 'Local time unavailable. Use ET below.'}</div>
						<div class="time-et">{canonicalDate(nextSession)} • {canonicalTime(nextSession)}</div>
						<div class="time-note">{timezoneSummary}</div>
					</div>

					<p class="session-description">{nextSession.description}</p>
					<div class="source-note">
						Source of truth: {sourceLabel}. If a Thursday session moves, this page reflects the scheduled
						instance instead of assuming the recurring slot.
					</div>

					<div class="action-row">
						<a class="primary-btn" href={nextSession.googleCalendarUrl} target="_blank" rel="noreferrer"
							>Add to Google Calendar</a
						>
						<button class="secondary-btn button-reset" onclick={() => downloadEventIcs(nextSession)}
							>Download ICS</button
						>
						{#if nextSession.joinUrl}
							<a class="secondary-btn" href={nextSession.joinUrl} target="_blank" rel="noreferrer"
								>Join Session</a
							>
						{/if}
					</div>
				{:else}
					<p class="session-description">No upcoming session is scheduled yet.</p>
				{/if}
			</section>

			<section class="schedule-card list-card">
				<div class="card-header">
					<div>
						<div class="card-label">Upcoming Sessions</div>
						<h2>Confirmed schedule</h2>
					</div>
					<a class="header-link" href={replayLibraryUrl}>Replay Library</a>
				</div>

				{#if events.length === 0}
					<div class="empty-state">No upcoming office hours are available yet.</div>
				{:else}
					<div class="session-list">
						{#each events as event, index}
							<article class="session-row" class:session-row-featured={index === 0}>
								<div class="session-main">
									<div class="session-topline">
										<h3>{canonicalDate(event)}</h3>
										{#if event.status === 'rescheduled'}
											<div class="status-pill status-moved">Moved</div>
										{/if}
									</div>
									<div class="session-local">{localTime(event) || 'Local time unavailable. Use ET below.'}</div>
									<div class="session-et">{canonicalTime(event)}</div>
								</div>
								<div class="session-actions">
									<a href={event.googleCalendarUrl} target="_blank" rel="noreferrer">Google</a>
									<button class="text-btn" onclick={() => downloadEventIcs(event)}>ICS</button>
									{#if event.joinUrl}
										<a href={event.joinUrl} target="_blank" rel="noreferrer">Join</a>
									{/if}
								</div>
							</article>
						{/each}
					</div>
				{/if}
			</section>
		</div>
	{/if}
</div>

<style>
	.office-hours-page {
		max-width: 1180px;
		margin: 0 auto;
		padding: 0 24px 48px;
	}

	.office-hours-hero {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		gap: 24px;
		background:
			radial-gradient(circle at top right, rgba(81, 190, 123, 0.14), transparent 32%),
			linear-gradient(135deg, #10252a 0%, #173841 60%, #1f5159 100%);
		border-radius: 24px;
		padding: 28px 30px;
		color: #fff;
		margin-bottom: 24px;
		box-shadow: 0 18px 50px rgba(10, 30, 33, 0.16);
	}

	.page-eyebrow {
		font-family: var(--font-ui);
		font-size: 11px;
		font-weight: 700;
		letter-spacing: 1.4px;
		text-transform: uppercase;
		color: rgba(255, 255, 255, 0.68);
		margin-bottom: 10px;
	}

	h1 {
		font-family: var(--font-headline);
		font-size: 36px;
		line-height: 1.05;
		margin: 0 0 12px;
	}

	.hero-copy {
		max-width: 640px;
		margin: 0;
		font-family: var(--font-body);
		font-size: 15px;
		line-height: 1.7;
		color: rgba(255, 255, 255, 0.82);
	}

	.hero-actions {
		display: flex;
		flex-direction: column;
		align-items: flex-end;
		gap: 12px;
	}

	.hero-badge,
	.status-pill,
	.gate-pill {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		padding: 7px 12px;
		border-radius: 999px;
		font-family: var(--font-ui);
		font-size: 11px;
		font-weight: 700;
		letter-spacing: 0.4px;
		text-transform: uppercase;
	}

	.hero-badge {
		background: rgba(255, 255, 255, 0.14);
		color: #fff;
	}

	.hero-link,
	.header-link,
	.session-actions a,
	.secondary-btn,
	.primary-btn {
		text-decoration: none;
	}

	.hero-link {
		color: #fff;
		font-family: var(--font-ui);
		font-size: 13px;
		font-weight: 700;
	}

	.office-hours-grid {
		display: grid;
		grid-template-columns: minmax(0, 1.06fr) minmax(320px, 0.94fr);
		gap: 20px;
	}

	.schedule-card,
	.gate-card {
		background: var(--bg-card);
		border: 1px solid var(--border);
		border-radius: 22px;
		padding: 24px;
		box-shadow: 0 10px 34px rgba(12, 24, 28, 0.06);
	}

	.featured-card {
		background:
			radial-gradient(circle at top right, rgba(81, 190, 123, 0.08), transparent 34%),
			var(--bg-card);
	}

	.card-header {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		gap: 16px;
		margin-bottom: 20px;
	}

	.card-label {
		font-family: var(--font-ui);
		font-size: 11px;
		font-weight: 700;
		letter-spacing: 1.2px;
		text-transform: uppercase;
		color: var(--text-muted);
		margin-bottom: 8px;
	}

	h2 {
		margin: 0;
		font-family: var(--font-headline);
		font-size: 28px;
		line-height: 1.1;
		color: var(--text-dark);
	}

	.time-stack {
		display: grid;
		gap: 8px;
		margin-bottom: 20px;
	}

	.time-local {
		font-family: var(--font-ui);
		font-size: 18px;
		font-weight: 800;
		color: var(--text-dark);
	}

	.time-et,
	.session-et {
		font-family: var(--font-ui);
		font-size: 14px;
		font-weight: 700;
		color: var(--primary);
	}

	.time-note,
	.session-local,
	.source-note,
	.session-description,
	.gate-card p,
	.empty-state {
		font-family: var(--font-body);
		font-size: 14px;
		line-height: 1.7;
		color: var(--text-secondary);
	}

	.source-note {
		padding: 14px 16px;
		border-radius: 16px;
		background: rgba(81, 190, 123, 0.08);
		margin-bottom: 20px;
	}

	.action-row,
	.gate-actions {
		display: flex;
		flex-wrap: wrap;
		gap: 10px;
	}

	.primary-btn,
	.secondary-btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		padding: 12px 18px;
		border-radius: 999px;
		font-family: var(--font-ui);
		font-size: 13px;
		font-weight: 700;
		cursor: pointer;
		transition: transform 0.15s ease, box-shadow 0.15s ease, opacity 0.15s ease;
	}

	.primary-btn:hover,
	.secondary-btn:hover {
		transform: translateY(-1px);
	}

	.primary-btn {
		background: linear-gradient(135deg, var(--primary), #3ca262);
		color: #fff;
		border: none;
		box-shadow: 0 10px 24px rgba(81, 190, 123, 0.22);
	}

	.secondary-btn {
		background: transparent;
		color: var(--text-dark);
		border: 1px solid var(--border);
	}

	.button-reset {
		appearance: none;
	}

	.session-list {
		display: grid;
		gap: 12px;
	}

	.session-row {
		display: flex;
		justify-content: space-between;
		gap: 16px;
		padding: 16px 18px;
		border: 1px solid var(--border);
		border-radius: 18px;
		background: linear-gradient(180deg, rgba(255, 255, 255, 0.9), rgba(248, 251, 252, 0.92));
	}

	.session-topline {
		display: flex;
		align-items: center;
		gap: 10px;
		flex-wrap: wrap;
		margin-bottom: 6px;
	}

	h3 {
		margin: 0;
		font-family: var(--font-ui);
		font-size: 16px;
		font-weight: 800;
		color: var(--text-dark);
	}

	.session-actions {
		display: flex;
		flex-direction: column;
		align-items: flex-end;
		gap: 8px;
		min-width: 88px;
	}

	.session-actions a,
	.text-btn,
	.header-link {
		font-family: var(--font-ui);
		font-size: 13px;
		font-weight: 700;
		color: var(--primary);
		background: none;
		border: none;
		padding: 0;
		cursor: pointer;
	}

	.status-moved {
		background: rgba(245, 158, 11, 0.12);
		color: #b45309;
	}

	.gate-card {
		max-width: 760px;
	}

	.gate-pill {
		background: rgba(81, 190, 123, 0.1);
		color: var(--primary);
		margin-bottom: 12px;
	}

	.skeleton-card {
		min-height: 360px;
		background:
			linear-gradient(90deg, rgba(241, 245, 246, 0.8), rgba(255, 255, 255, 0.95), rgba(241, 245, 246, 0.8));
		background-size: 200% 100%;
		animation: shimmer 1.2s infinite linear;
	}

	@keyframes shimmer {
		from {
			background-position: 200% 0;
		}
		to {
			background-position: -200% 0;
		}
	}

	@media (max-width: 940px) {
		.office-hours-grid {
			grid-template-columns: 1fr;
		}

		.office-hours-hero {
			flex-direction: column;
		}

		.hero-actions {
			align-items: flex-start;
		}

		.session-row {
			flex-direction: column;
		}

		.session-actions {
			flex-direction: row;
			align-items: center;
			min-width: 0;
		}
	}

	@media (max-width: 640px) {
		.office-hours-page {
			padding: 0 16px 32px;
		}

		.office-hours-hero,
		.schedule-card,
		.gate-card {
			padding: 20px;
		}

		h1 {
			font-size: 30px;
		}

		h2 {
			font-size: 24px;
		}
	}
</style>
