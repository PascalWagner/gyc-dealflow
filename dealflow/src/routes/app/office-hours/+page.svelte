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

	const ET_TIMEZONE = 'America/New_York';

	let loading = $state(true);
	let error = $state('');
	let forbidden = $state(false);
	let events = $state([]);
	let nextSession = $state(null);
	let localTimeZone = $state(null);
	let sourceLabel = $state('Google Calendar');
	let activeMonthIndex = $state(0);

	const replayLibraryUrl = '/app/resources?category=Office%20Hours';
	const calendarDayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

	const canAccess = $derived($isAdmin || $isAcademy);
	const timezoneSummary = $derived.by(() => {
		if (!localTimeZone) return 'Local timezone unavailable. Eastern Time is the canonical schedule reference.';
		return `Showing your local time in ${localTimeZone}. Eastern Time remains the canonical schedule reference.`;
	});
	const calendarSummary = $derived.by(() => {
		if (!localTimeZone) return 'Month view is using your browser date. Eastern Time remains the canonical schedule reference.';
		return `Month view uses your local date in ${localTimeZone}. Eastern Time remains the canonical schedule reference.`;
	});
	const calendarMonths = $derived.by(() => buildCalendarMonths(events));
	const activeCalendarMonth = $derived.by(() => calendarMonths[activeMonthIndex] || null);
	const activeMonthEvents = $derived.by(() => activeCalendarMonth?.events || []);
	const visibleUpcomingSessions = $derived.by(() => events.slice(0, 6));
	const activeMonthSummary = $derived.by(() => {
		const count = activeMonthEvents.length;
		if (count === 0) return 'No live sessions scheduled for this month yet.';
		if (count === 1) return '1 confirmed live session this month.';
		return `${count} confirmed live sessions this month.`;
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

	function calendarTime(event) {
		const date = new Date(event.startDateTime);
		if (Number.isNaN(date.getTime())) return '';
		return new Intl.DateTimeFormat('en-US', {
			timeZone: localTimeZone || undefined,
			hour: 'numeric',
			minute: '2-digit'
		}).format(date);
	}

	function weekdayShort(event) {
		return formatEventDatePart(event.startDateTime, { weekday: 'short' });
	}

	function monthShort(event) {
		return formatEventDatePart(event.startDateTime, { month: 'short' });
	}

	function dayNumber(event) {
		return formatEventDatePart(event.startDateTime, { day: 'numeric' });
	}

	function monthDay(event) {
		return formatEventDatePart(event.startDateTime, { month: 'short', day: 'numeric' });
	}

	function previousMonth() {
		if (activeMonthIndex > 0) activeMonthIndex -= 1;
	}

	function nextMonth() {
		if (activeMonthIndex < calendarMonths.length - 1) activeMonthIndex += 1;
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

			const response = await fetch('/api/member-events?programSlug=cashflow_academy&eventType=office_hours&limit=20', {
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
			nextSession = payload.nextSession || payload.upcomingSessions?.[0] || payload.events?.[0] || null;
			activeMonthIndex = 0;
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

	$effect(() => {
		if (calendarMonths.length === 0) {
			activeMonthIndex = 0;
			return;
		}
		if (activeMonthIndex > calendarMonths.length - 1) {
			activeMonthIndex = calendarMonths.length - 1;
		}
	});

	function buildCalendarMonths(items) {
		const monthMap = new Map();

		for (const event of items) {
			const start = new Date(event.startDateTime);
			if (Number.isNaN(start.getTime())) continue;

			const monthKey = `${start.getFullYear()}-${pad(start.getMonth() + 1)}`;
			const dayKey = buildDayKey(start);
			if (!monthMap.has(monthKey)) {
				const monthStart = new Date(start.getFullYear(), start.getMonth(), 1);
				monthMap.set(monthKey, {
					key: monthKey,
					label: monthStart.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
					monthStart,
					eventsByDay: new Map()
				});
			}

			const monthData = monthMap.get(monthKey);
			if (!monthData.eventsByDay.has(dayKey)) monthData.eventsByDay.set(dayKey, []);
			monthData.eventsByDay.get(dayKey).push(event);
		}

		return Array.from(monthMap.values())
			.sort((a, b) => a.monthStart - b.monthStart)
			.map((month) => {
				const monthEvents = Array.from(month.eventsByDay.values())
					.flat()
					.sort((a, b) => new Date(a.startDateTime) - new Date(b.startDateTime));

				return {
					...month,
					events: monthEvents,
					weeks: buildCalendarWeeks(month.monthStart, month.eventsByDay)
				};
			});
	}

	function buildCalendarWeeks(monthStart, eventsByDay) {
		const year = monthStart.getFullYear();
		const month = monthStart.getMonth();
		const firstWeekday = new Date(year, month, 1).getDay();
		const daysInMonth = new Date(year, month + 1, 0).getDate();
		const prevMonthDays = new Date(year, month, 0).getDate();
		const today = new Date();
		const cells = [];

		for (let i = 0; i < firstWeekday; i += 1) {
			const date = new Date(year, month - 1, prevMonthDays - firstWeekday + i + 1);
			cells.push(buildCalendarCell(date, false, [], today));
		}

		for (let day = 1; day <= daysInMonth; day += 1) {
			const date = new Date(year, month, day);
			const dayEvents = [...(eventsByDay.get(buildDayKey(date)) || [])].sort(
				(a, b) => new Date(a.startDateTime) - new Date(b.startDateTime)
			);
			cells.push(buildCalendarCell(date, true, dayEvents, today));
		}

		while (cells.length % 7 !== 0) {
			const overflowDay = cells.length - (firstWeekday + daysInMonth) + 1;
			const date = new Date(year, month + 1, overflowDay);
			cells.push(buildCalendarCell(date, false, [], today));
		}

		const weeks = [];
		for (let index = 0; index < cells.length; index += 7) {
			weeks.push(cells.slice(index, index + 7));
		}
		return weeks;
	}

	function buildCalendarCell(date, isCurrentMonth, dayEvents, today) {
		return {
			key: `${buildDayKey(date)}-${isCurrentMonth ? 'current' : 'overflow'}`,
			dayNumber: date.getDate(),
			isCurrentMonth,
			isToday:
				date.getFullYear() === today.getFullYear() &&
				date.getMonth() === today.getMonth() &&
				date.getDate() === today.getDate(),
			events: dayEvents
		};
	}

	function buildDayKey(date) {
		return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
	}

	function pad(value) {
		return String(value).padStart(2, '0');
	}

	function formatEventDatePart(isoString, options, timeZone = ET_TIMEZONE) {
		const date = new Date(isoString);
		if (Number.isNaN(date.getTime())) return '';
		return new Intl.DateTimeFormat('en-US', { timeZone, ...options }).format(date);
	}
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
			<div class="column-stack">
				<section class="schedule-card featured-card">
					<div class="card-header">
						<div>
							<div class="card-label">Next Session</div>
							<h2>{nextSession?.title || 'No session scheduled'}</h2>
							<p class="card-copy">
								Your next live office-hours window, with local time first and Eastern kept as the
								canonical reference.
							</p>
						</div>
						{#if nextSession?.status === 'rescheduled'}
							<div class="status-pill status-moved">Moved</div>
						{/if}
					</div>

					{#if nextSession}
						<div class="featured-stage">
							<div class="featured-time-panel">
								<div class="featured-panel-label">Next live window</div>
								<div class="time-local">
									{localTime(nextSession) || 'Local time unavailable. Use ET below.'}
								</div>
								<div class="time-et">{canonicalDate(nextSession)} • {canonicalTime(nextSession)}</div>
								<div class="time-note">{timezoneSummary}</div>
							</div>

							<div class="featured-date-pill">
								<div class="featured-date-month">{monthShort(nextSession)}</div>
								<div class="featured-date-day">{dayNumber(nextSession)}</div>
								<div class="featured-date-weekday">{weekdayShort(nextSession)}</div>
							</div>
						</div>

						<p class="session-description">{nextSession.description}</p>

						<div class="source-note">
							Source of truth: {sourceLabel}. If a Thursday session moves, this page reflects the
							scheduled instance instead of assuming the recurring slot.
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

				<section class="schedule-card agenda-card">
					<div class="card-header">
						<div>
							<div class="card-label">Upcoming Sessions</div>
							<h2>Confirmed schedule</h2>
							<p class="card-copy">
								The next few live sessions at a glance. Use the month view to the right to scan future
								dates by weekday and month.
							</p>
						</div>
						<a class="header-link" href={replayLibraryUrl}>Replay Library</a>
					</div>

					{#if visibleUpcomingSessions.length === 0}
						<div class="empty-state">No upcoming office hours are available yet.</div>
					{:else}
						<div class="session-list refined-list">
							{#each visibleUpcomingSessions as event}
								<article class="session-row refined-row">
									<div class="session-stamp">
										<div class="session-stamp-month">{monthShort(event)}</div>
										<div class="session-stamp-day">{dayNumber(event)}</div>
										<div class="session-stamp-weekday">{weekdayShort(event)}</div>
									</div>

									<div class="session-main">
										<div class="session-topline">
											<h3>{canonicalDate(event)}</h3>
											{#if event.status === 'rescheduled'}
												<div class="status-pill status-moved">Moved</div>
											{/if}
										</div>
										<div class="session-local">
											{localTime(event) || 'Local time unavailable. Use ET below.'}
										</div>
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

						{#if events.length > visibleUpcomingSessions.length}
							<div class="session-footnote">
								More confirmed dates are available in the month view. Later months stay in the calendar
								instead of stretching this list indefinitely.
							</div>
						{/if}
					{/if}
				</section>
			</div>

			<section class="schedule-card calendar-card">
				<div class="card-header calendar-card-header">
					<div>
						<div class="card-label">Monthly View</div>
						<h2>Office Hours calendar</h2>
						<p class="calendar-copy">
							A calmer month view for planning. You can scan the weekday cadence, flip between months,
							and see moved sessions without the page turning into a giant scheduling tool. {calendarSummary}
						</p>
					</div>

					{#if activeCalendarMonth}
						<div class="calendar-controls">
							<button
								class="calendar-nav-btn"
								onclick={previousMonth}
								disabled={activeMonthIndex === 0}
								aria-label="Previous month"
							>
								&larr;
							</button>
							<div class="calendar-month-label">{activeCalendarMonth.label}</div>
							<button
								class="calendar-nav-btn"
								onclick={nextMonth}
								disabled={activeMonthIndex >= calendarMonths.length - 1}
								aria-label="Next month"
							>
								&rarr;
							</button>
						</div>
					{/if}
				</div>

				{#if activeCalendarMonth}
					<div class="calendar-surface">
						<div class="calendar-weekdays">
							{#each calendarDayLabels as dayLabel}
								<div>{dayLabel}</div>
							{/each}
						</div>

						<div class="calendar-grid">
							{#each activeCalendarMonth.weeks as week}
								{#each week as day}
									<div
										class="calendar-day"
										class:calendar-day-outside={!day.isCurrentMonth}
										class:calendar-day-today={day.isToday}
										class:calendar-day-has-events={day.events.length > 0}
									>
										<div class="calendar-day-top">
											<div class="calendar-day-number">{day.dayNumber}</div>
											{#if day.events.length > 0}
												<div class="calendar-day-count">{day.events.length}</div>
											{/if}
										</div>

										{#if day.events.length > 0}
											<div class="calendar-day-events">
												{#each day.events as event}
													<div class="calendar-event-pill">
														<div class="calendar-event-title">Office Hours</div>
														<div class="calendar-event-meta">
															<span>{calendarTime(event)}</span>
															{#if event.status === 'rescheduled'}
																<span class="calendar-event-status">Moved</span>
															{/if}
														</div>
													</div>
												{/each}
											</div>
										{/if}
									</div>
								{/each}
							{/each}
						</div>
					</div>

					<div class="calendar-agenda">
						<div class="calendar-agenda-header">
							<div>
								<div class="calendar-agenda-label">{activeCalendarMonth.label}</div>
								<div class="calendar-agenda-summary">{activeMonthSummary}</div>
							</div>
							<a class="header-link" href={replayLibraryUrl}>Replay Library</a>
						</div>

						<div class="month-session-list">
							{#each activeMonthEvents as event}
								<article class="month-session-row">
									<div class="month-session-date">
										<div class="month-session-weekday">{weekdayShort(event)}</div>
										<div class="month-session-monthday">{monthDay(event)}</div>
									</div>

									<div class="month-session-main">
										<div class="month-session-time">
											{localTime(event) || 'Local time unavailable. Use ET below.'}
										</div>
										<div class="month-session-et">{canonicalTime(event)}</div>
									</div>

									<div class="month-session-actions">
										<a href={event.googleCalendarUrl} target="_blank" rel="noreferrer">Google</a>
										<button class="text-btn" onclick={() => downloadEventIcs(event)}>ICS</button>
										{#if event.joinUrl}
											<a href={event.joinUrl} target="_blank" rel="noreferrer">Join</a>
										{/if}
									</div>
								</article>
							{/each}
						</div>

						<div class="calendar-footnote">
							Session dates come from the live Office Hours calendar. If a Thursday session moves, this
							month view reflects the moved date instead of assuming the old recurring slot.
						</div>
					</div>
				{:else}
					<div class="empty-state">No monthly calendar is available yet.</div>
				{/if}
			</section>
		</div>
	{/if}
</div>

<style>
	.office-hours-page {
		max-width: 1220px;
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
	.month-session-actions a,
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
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 22px;
		align-items: start;
	}

	.column-stack {
		display: grid;
		gap: 22px;
		align-content: start;
	}

	.schedule-card,
	.gate-card {
		background: linear-gradient(180deg, rgba(255, 255, 255, 0.98), rgba(248, 250, 251, 0.98));
		border: 1px solid rgba(15, 23, 42, 0.08);
		border-radius: 28px;
		padding: 28px;
		box-shadow:
			0 22px 52px rgba(12, 24, 28, 0.08),
			inset 0 1px 0 rgba(255, 255, 255, 0.65);
	}

	.featured-card {
		background:
			radial-gradient(circle at top right, rgba(81, 190, 123, 0.08), transparent 34%),
			linear-gradient(180deg, rgba(255, 255, 255, 0.99), rgba(244, 249, 246, 0.98));
	}

	.card-header {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		gap: 16px;
		margin-bottom: 20px;
	}

	.calendar-card-header {
		margin-bottom: 18px;
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
		line-height: 1.05;
		color: var(--text-dark);
	}

	.card-copy,
	.time-note,
	.session-local,
	.source-note,
	.session-description,
	.gate-card p,
	.empty-state,
	.calendar-copy,
	.calendar-footnote,
	.session-footnote,
	.calendar-agenda-summary {
		font-family: var(--font-body);
		font-size: 14px;
		line-height: 1.7;
		color: var(--text-secondary);
	}

	.card-copy {
		margin: 10px 0 0;
	}

	.calendar-copy {
		margin: 10px 0 0;
	}

	.featured-stage {
		display: grid;
		grid-template-columns: minmax(0, 1fr) 112px;
		gap: 18px;
		padding: 20px;
		border-radius: 24px;
		border: 1px solid rgba(16, 37, 42, 0.08);
		background: linear-gradient(180deg, rgba(250, 252, 252, 0.92), rgba(242, 248, 245, 0.96));
		margin-bottom: 18px;
	}

	.featured-time-panel {
		display: grid;
		gap: 8px;
	}

	.featured-panel-label {
		font-family: var(--font-ui);
		font-size: 11px;
		font-weight: 700;
		letter-spacing: 1.1px;
		text-transform: uppercase;
		color: var(--text-muted);
	}

	.time-local {
		font-family: var(--font-ui);
		font-size: 19px;
		font-weight: 800;
		line-height: 1.35;
		color: var(--text-dark);
	}

	.time-et,
	.session-et,
	.month-session-et {
		font-family: var(--font-ui);
		font-size: 13px;
		font-weight: 800;
		color: var(--primary);
	}

	.featured-date-pill {
		display: grid;
		align-content: center;
		justify-items: center;
		gap: 2px;
		padding: 16px 12px;
		border-radius: 22px;
		background: linear-gradient(180deg, rgba(16, 37, 42, 0.96), rgba(24, 61, 69, 0.92));
		color: #fff;
		box-shadow: 0 12px 28px rgba(16, 37, 42, 0.14);
	}

	.featured-date-month,
	.featured-date-weekday {
		font-family: var(--font-ui);
		font-size: 11px;
		font-weight: 700;
		letter-spacing: 0.8px;
		text-transform: uppercase;
		color: rgba(255, 255, 255, 0.7);
	}

	.featured-date-day {
		font-family: var(--font-headline);
		font-size: 44px;
		line-height: 1;
		font-weight: 700;
	}

	.session-description {
		margin: 0 0 18px;
	}

	.source-note {
		padding: 16px 18px;
		border-radius: 18px;
		background: linear-gradient(180deg, rgba(81, 190, 123, 0.08), rgba(81, 190, 123, 0.05));
		border: 1px solid rgba(81, 190, 123, 0.15);
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
		background: rgba(255, 255, 255, 0.9);
		color: var(--text-dark);
		border: 1px solid var(--border);
	}

	.button-reset {
		appearance: none;
	}

	.refined-list,
	.month-session-list {
		display: grid;
		gap: 12px;
	}

	.session-row,
	.month-session-row {
		display: grid;
		grid-template-columns: auto minmax(0, 1fr) auto;
		gap: 16px;
		align-items: center;
		padding: 16px 18px;
		border: 1px solid rgba(15, 23, 42, 0.08);
		border-radius: 22px;
		background: linear-gradient(180deg, rgba(255, 255, 255, 0.92), rgba(246, 249, 250, 0.96));
	}

	.session-stamp {
		width: 78px;
		min-width: 78px;
		padding: 14px 10px;
		border-radius: 18px;
		border: 1px solid rgba(15, 23, 42, 0.06);
		background: rgba(244, 247, 248, 0.92);
		text-align: center;
	}

	.session-stamp-month,
	.session-stamp-weekday {
		font-family: var(--font-ui);
		font-size: 11px;
		font-weight: 700;
		letter-spacing: 0.8px;
		text-transform: uppercase;
		color: var(--text-muted);
	}

	.session-stamp-day {
		margin: 4px 0;
		font-family: var(--font-headline);
		font-size: 32px;
		line-height: 1;
		color: var(--text-dark);
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

	.session-main,
	.month-session-main {
		min-width: 0;
	}

	.month-session-main {
		display: grid;
		gap: 4px;
	}

	.session-actions,
	.month-session-actions {
		display: flex;
		flex-direction: column;
		align-items: flex-end;
		gap: 8px;
		min-width: 84px;
	}

	.session-actions a,
	.month-session-actions a,
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

	.session-footnote {
		margin-top: 14px;
		padding-top: 2px;
	}

	.calendar-card {
		display: grid;
		gap: 20px;
	}

	.calendar-surface {
		padding: 18px;
		border-radius: 24px;
		background: linear-gradient(180deg, rgba(246, 248, 249, 0.94), rgba(255, 255, 255, 0.98));
		border: 1px solid rgba(15, 23, 42, 0.08);
		overflow-x: auto;
	}

	.calendar-controls {
		display: flex;
		align-items: center;
		gap: 10px;
	}

	.calendar-month-label {
		min-width: 170px;
		text-align: center;
		font-family: var(--font-ui);
		font-size: 14px;
		font-weight: 800;
		color: var(--text-dark);
	}

	.calendar-nav-btn {
		width: 40px;
		height: 40px;
		border-radius: 999px;
		border: 1px solid rgba(15, 23, 42, 0.08);
		background: rgba(255, 255, 255, 0.96);
		color: var(--text-dark);
		font-family: var(--font-ui);
		font-size: 15px;
		font-weight: 800;
		cursor: pointer;
		transition: all 0.18s ease;
	}

	.calendar-nav-btn:hover:not(:disabled) {
		border-color: var(--primary);
		color: var(--primary);
		transform: translateY(-1px);
		box-shadow: 0 10px 22px rgba(81, 190, 123, 0.12);
	}

	.calendar-nav-btn:disabled {
		opacity: 0.35;
		cursor: default;
	}

	.calendar-weekdays,
	.calendar-grid {
		display: grid;
		grid-template-columns: repeat(7, minmax(72px, 1fr));
		gap: 10px;
		min-width: 560px;
	}

	.calendar-weekdays {
		margin-bottom: 10px;
	}

	.calendar-weekdays div {
		font-family: var(--font-ui);
		font-size: 11px;
		font-weight: 800;
		letter-spacing: 0.9px;
		text-transform: uppercase;
		color: var(--text-muted);
		text-align: center;
	}

	.calendar-day {
		min-height: 122px;
		padding: 12px;
		border-radius: 20px;
		border: 1px solid rgba(15, 23, 42, 0.08);
		background: rgba(255, 255, 255, 0.88);
		display: flex;
		flex-direction: column;
		gap: 10px;
	}

	.calendar-day-top {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	.calendar-day-outside {
		opacity: 0.4;
		background: rgba(244, 246, 247, 0.74);
	}

	.calendar-day-today {
		border-color: rgba(81, 190, 123, 0.5);
		box-shadow:
			inset 0 0 0 1px rgba(81, 190, 123, 0.14),
			0 8px 22px rgba(81, 190, 123, 0.08);
	}

	.calendar-day-has-events {
		background: linear-gradient(180deg, rgba(240, 248, 243, 0.96), rgba(255, 255, 255, 0.96));
	}

	.calendar-day-number {
		font-family: var(--font-ui);
		font-size: 14px;
		font-weight: 800;
		color: var(--text-dark);
	}

	.calendar-day-count {
		min-width: 22px;
		height: 22px;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		padding: 0 6px;
		border-radius: 999px;
		background: rgba(16, 37, 42, 0.08);
		font-family: var(--font-ui);
		font-size: 11px;
		font-weight: 800;
		color: var(--text-muted);
	}

	.calendar-day-events {
		display: grid;
		gap: 8px;
	}

	.calendar-event-pill {
		display: grid;
		gap: 3px;
		padding: 8px 10px;
		border-radius: 14px;
		background: linear-gradient(135deg, rgba(81, 190, 123, 0.16), rgba(81, 190, 123, 0.06));
		border: 1px solid rgba(81, 190, 123, 0.12);
	}

	.calendar-event-title {
		font-family: var(--font-ui);
		font-size: 10px;
		font-weight: 800;
		letter-spacing: 0.8px;
		text-transform: uppercase;
		color: var(--primary);
	}

	.calendar-event-meta {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
		font-family: var(--font-ui);
		font-size: 12px;
		font-weight: 800;
		color: var(--text-dark);
	}

	.calendar-event-status {
		font-size: 10px;
		font-weight: 800;
		text-transform: uppercase;
		color: #b45309;
	}

	.calendar-agenda {
		padding-top: 2px;
	}

	.calendar-agenda-header {
		display: flex;
		align-items: flex-end;
		justify-content: space-between;
		gap: 16px;
		margin-bottom: 16px;
	}

	.calendar-agenda-label {
		font-family: var(--font-ui);
		font-size: 12px;
		font-weight: 800;
		letter-spacing: 1px;
		text-transform: uppercase;
		color: var(--text-dark);
		margin-bottom: 4px;
	}

	.calendar-agenda-summary {
		margin: 0;
	}

	.month-session-date {
		display: grid;
		gap: 2px;
	}

	.month-session-weekday {
		font-family: var(--font-ui);
		font-size: 11px;
		font-weight: 800;
		letter-spacing: 0.9px;
		text-transform: uppercase;
		color: var(--text-muted);
	}

	.month-session-monthday,
	.month-session-time {
		font-family: var(--font-ui);
		font-size: 14px;
		font-weight: 800;
		color: var(--text-dark);
	}

	.calendar-footnote {
		margin-top: 14px;
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
		min-height: 460px;
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

	@media (max-width: 1040px) {
		.office-hours-grid {
			grid-template-columns: 1fr;
		}

		.office-hours-hero {
			flex-direction: column;
		}

		.hero-actions {
			align-items: flex-start;
		}
	}

	@media (max-width: 760px) {
		.schedule-card,
		.gate-card,
		.office-hours-hero {
			padding: 22px;
		}

		.featured-stage,
		.session-row,
		.month-session-row {
			grid-template-columns: 1fr;
		}

		.featured-date-pill {
			grid-auto-flow: column;
			grid-template-columns: repeat(3, auto);
			justify-content: space-between;
			padding: 14px 16px;
		}

		.featured-date-day {
			font-size: 32px;
		}

		.session-stamp {
			width: auto;
			display: grid;
			grid-auto-flow: column;
			align-items: center;
			justify-content: start;
			gap: 10px;
			text-align: left;
		}

		.session-stamp-day {
			margin: 0;
			font-size: 26px;
		}

		.session-actions,
		.month-session-actions {
			flex-direction: row;
			align-items: center;
			min-width: 0;
		}

		.calendar-card-header,
		.calendar-agenda-header {
			flex-direction: column;
			align-items: flex-start;
		}

		.calendar-controls {
			width: 100%;
			justify-content: space-between;
		}

		.calendar-month-label {
			min-width: 0;
			flex: 1;
		}
	}

	@media (max-width: 640px) {
		.office-hours-page {
			padding: 0 16px 32px;
		}

		h1 {
			font-size: 30px;
		}

		h2 {
			font-size: 24px;
		}

		.calendar-surface {
			padding: 14px;
		}

		.calendar-weekdays,
		.calendar-grid {
			gap: 6px;
			min-width: 520px;
		}

		.calendar-day {
			min-height: 104px;
			padding: 10px;
		}

		.calendar-event-pill {
			padding: 7px 8px;
		}

		.calendar-event-meta {
			font-size: 11px;
		}
	}
</style>
