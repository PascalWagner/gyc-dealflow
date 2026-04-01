const ET_TIMEZONE = 'America/New_York';

export function resolveBrowserTimeZone() {
	try {
		return Intl.DateTimeFormat().resolvedOptions().timeZone || null;
	} catch {
		return null;
	}
}

export function formatCanonicalDate(isoString) {
	return new Intl.DateTimeFormat('en-US', {
		timeZone: ET_TIMEZONE,
		weekday: 'long',
		month: 'long',
		day: 'numeric'
	}).format(new Date(isoString));
}

export function formatCanonicalTimeRange(startIso, endIso) {
	const start = new Date(startIso);
	const end = new Date(endIso);
	return `${formatTime(start, ET_TIMEZONE)} to ${formatTime(end, ET_TIMEZONE)} ET`;
}

export function formatLocalDateTimeRange(startIso, endIso, timeZone) {
	if (!timeZone) return null;
	const start = new Date(startIso);
	const end = new Date(endIso);
	if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;

	const date = new Intl.DateTimeFormat('en-US', {
		timeZone,
		weekday: 'long',
		month: 'long',
		day: 'numeric'
	}).format(start);
	const time = `${formatTime(start, timeZone)} to ${formatTime(end, timeZone)} ${formatTimeZoneName(start, timeZone)}`;
	return `${date} • ${time}`;
}

export function formatLocalTimeRange(startIso, endIso, timeZone) {
	if (!timeZone) return null;
	const start = new Date(startIso);
	const end = new Date(endIso);
	if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;
	return `${formatTime(start, timeZone)} to ${formatTime(end, timeZone)} ${formatTimeZoneName(start, timeZone)}`;
}

export function downloadEventIcs(event) {
	const blob = new Blob([buildIcsContent(event)], {
		type: 'text/calendar;charset=utf-8'
	});
	const href = URL.createObjectURL(blob);
	const link = document.createElement('a');
	link.href = href;
	link.download = buildIcsFilename(event);
	document.body.appendChild(link);
	link.click();
	link.remove();
	URL.revokeObjectURL(href);
}

function buildIcsContent(event) {
	const description = event.joinUrl
		? `${event.description || ''}\n\nJoin: ${event.joinUrl}`.trim()
		: event.description || '';
	return [
		'BEGIN:VCALENDAR',
		'VERSION:2.0',
		'PRODID:-//Grow Your Cashflow//Office Hours//EN',
		'CALSCALE:GREGORIAN',
		'METHOD:PUBLISH',
		'BEGIN:VEVENT',
		`UID:${escapeIcs(event.id)}@growyourcashflow.io`,
		`DTSTAMP:${formatIcsTimestamp(new Date().toISOString())}`,
		`DTSTART:${formatIcsTimestamp(event.startDateTime)}`,
		`DTEND:${formatIcsTimestamp(event.endDateTime)}`,
		`SUMMARY:${escapeIcs(event.title)}`,
		`DESCRIPTION:${escapeIcs(description)}`,
		`LOCATION:${escapeIcs(event.joinUrl || 'Cashflow Academy member portal')}`,
		`STATUS:${event.status === 'cancelled' ? 'CANCELLED' : 'CONFIRMED'}`,
		'END:VEVENT',
		'END:VCALENDAR',
		''
	].join('\r\n');
}

function buildIcsFilename(event) {
	const start = new Date(event.startDateTime);
	const datePart = `${start.getUTCFullYear()}-${String(start.getUTCMonth() + 1).padStart(2, '0')}-${String(
		start.getUTCDate()
	).padStart(2, '0')}`;
	return `cashflow-academy-office-hours-${datePart}.ics`;
}

function formatIcsTimestamp(isoString) {
	return new Date(isoString).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
}

function formatTime(date, timeZone) {
	return new Intl.DateTimeFormat('en-US', {
		timeZone,
		hour: 'numeric',
		minute: '2-digit'
	}).format(date);
}

function formatTimeZoneName(date, timeZone) {
	const parts = new Intl.DateTimeFormat('en-US', {
		timeZone,
		timeZoneName: 'short'
	}).formatToParts(date);
	return parts.find((part) => part.type === 'timeZoneName')?.value || timeZone;
}

function escapeIcs(value) {
	return String(value)
		.replace(/\\/g, '\\\\')
		.replace(/\n/g, '\\n')
		.replace(/,/g, '\\,')
		.replace(/;/g, '\\;');
}
