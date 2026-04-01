const DEFAULT_CALENDAR_ID =
	'c_5951c312ac7de0b9a9840a5b29c30423adb70c6d78aba9a41656ac91b1153ba3@group.calendar.google.com';
const DEFAULT_PROGRAM_SLUG = 'cashflow_academy';
const DEFAULT_EVENT_TYPE = 'office_hours';
const DEFAULT_REPLAY_LIBRARY_URL = '/app/resources?category=Office%20Hours';
const DEFAULT_SOURCE_TIMEZONE = 'America/New_York';
const UPCOMING_WINDOW_DAYS = 180;
const MEMBER_EVENTS_CACHE_TTL_MS = 30 * 60 * 1000;
const MEMBER_EVENTS_CACHE_LIMIT = 24;
const RRULE_DAY_TO_INDEX = {
	SU: 0,
	MO: 1,
	TU: 2,
	WE: 3,
	TH: 4,
	FR: 5,
	SA: 6
};
let memberEventsCache = null;
let memberEventsCachePromise = null;

export function getOfficeHoursConfig() {
	return {
		programSlug: DEFAULT_PROGRAM_SLUG,
		eventType: DEFAULT_EVENT_TYPE,
		calendarId: process.env.CASHFLOW_ACADEMY_OFFICE_HOURS_CALENDAR_ID || DEFAULT_CALENDAR_ID,
		replayLibraryUrl:
			process.env.CASHFLOW_ACADEMY_REPLAY_LIBRARY_URL || DEFAULT_REPLAY_LIBRARY_URL
	};
}

export async function getMemberEvents({ programSlug, eventType, limit = 6 }) {
	const config = getOfficeHoursConfig();
	if (programSlug !== config.programSlug || eventType !== config.eventType) {
		return {
			programSlug,
			eventType,
			sourceKind: 'unsupported',
			sourceTimezone: DEFAULT_SOURCE_TIMEZONE,
			events: []
		};
	}

	const payload = await getCachedMemberEvents(config);
	return {
		...payload,
		events: (payload.events || []).slice(0, Math.max(1, limit))
	};
}

async function getCachedMemberEvents(config) {
	const cacheKey = JSON.stringify({
		calendarId: config.calendarId,
		replayLibraryUrl: config.replayLibraryUrl
	});
	const now = Date.now();
	const hasFreshCache =
		memberEventsCache?.key === cacheKey &&
		memberEventsCache?.payload &&
		now - memberEventsCache.refreshedAt < MEMBER_EVENTS_CACHE_TTL_MS;

	if (hasFreshCache) {
		return memberEventsCache.payload;
	}

	if (memberEventsCachePromise) {
		return memberEventsCachePromise;
	}

	memberEventsCachePromise = (async () => {
		const calendar = await fetchGoogleCalendarCalendar(config.calendarId);
		const payload = {
			programSlug: config.programSlug,
			eventType: config.eventType,
			sourceKind: 'google_calendar',
			sourceTimezone: calendar.timezone || DEFAULT_SOURCE_TIMEZONE,
			calendarName: calendar.name || 'Cashflow Academy - Office Hours',
			events: expandOfficeHoursEvents(calendar, {
				limit: MEMBER_EVENTS_CACHE_LIMIT,
				replayLibraryUrl: config.replayLibraryUrl
			})
		};

		memberEventsCache = {
			key: cacheKey,
			payload,
			refreshedAt: Date.now()
		};
		return payload;
	})().finally(() => {
		memberEventsCachePromise = null;
	});

	return memberEventsCachePromise;
}

async function fetchGoogleCalendarCalendar(calendarId) {
	const url = `https://calendar.google.com/calendar/ical/${encodeURIComponent(calendarId)}/public/basic.ics`;
	const response = await fetch(url);
	if (!response.ok) {
		throw new Error(`Google Calendar fetch failed with status ${response.status}`);
	}
	const text = await response.text();
	return parseIcsCalendar(text);
}

function parseIcsCalendar(text) {
	const lines = unfoldIcsLines(text);
	const calendar = { properties: {}, events: [] };
	let currentEvent = null;

	for (const line of lines) {
		if (line === 'BEGIN:VEVENT') {
			currentEvent = { properties: {} };
			continue;
		}
		if (line === 'END:VEVENT') {
			if (currentEvent) calendar.events.push(currentEvent);
			currentEvent = null;
			continue;
		}

		const property = parseProperty(line);
		if (!property) continue;
		const target = currentEvent ? currentEvent.properties : calendar.properties;
		if (!target[property.name]) target[property.name] = [];
		target[property.name].push(property);
	}

	return {
		name: getPropertyValue(calendar.properties, 'X-WR-CALNAME'),
		timezone: getPropertyValue(calendar.properties, 'X-WR-TIMEZONE') || DEFAULT_SOURCE_TIMEZONE,
		description: decodeIcsText(getPropertyValue(calendar.properties, 'X-WR-CALDESC') || ''),
		events: calendar.events
	};
}

function unfoldIcsLines(text) {
	const rawLines = text.split(/\r?\n/);
	const lines = [];
	for (const rawLine of rawLines) {
		if (!rawLine) continue;
		if ((rawLine.startsWith(' ') || rawLine.startsWith('\t')) && lines.length) {
			lines[lines.length - 1] += rawLine.slice(1);
			continue;
		}
		lines.push(rawLine);
	}
	return lines;
}

function parseProperty(line) {
	const colonIndex = line.indexOf(':');
	if (colonIndex === -1) return null;
	const left = line.slice(0, colonIndex);
	const value = line.slice(colonIndex + 1);
	const [rawName, ...rawParams] = left.split(';');
	const params = {};

	for (const param of rawParams) {
		const equalsIndex = param.indexOf('=');
		if (equalsIndex === -1) continue;
		const key = param.slice(0, equalsIndex).toUpperCase();
		const paramValue = param.slice(equalsIndex + 1).replace(/^"|"$/g, '');
		params[key] = paramValue;
	}

	return { name: rawName.toUpperCase(), params, value };
}

function getProperty(properties, name) {
	return properties[name]?.[0] || null;
}

function getPropertyValue(properties, name) {
	return getProperty(properties, name)?.value || '';
}

function getPropertyValues(properties, name) {
	return (properties[name] || []).map((entry) => entry.value);
}

function expandOfficeHoursEvents(calendar, { limit, replayLibraryUrl }) {
	const now = new Date();
	const windowEnd = addDays(now, UPCOMING_WINDOW_DAYS);
	const recurringMasters = [];
	const standaloneEvents = [];
	const overridesByUid = new Map();

	for (const rawEvent of calendar.events) {
		const event = hydrateEvent(rawEvent, calendar.timezone);
		if (!event) continue;
		if (event.recurrenceIdKey) {
			if (!overridesByUid.has(event.uid)) overridesByUid.set(event.uid, new Map());
			overridesByUid.get(event.uid).set(event.recurrenceIdKey, event);
			continue;
		}
		if (event.rrule) {
			recurringMasters.push(event);
			continue;
		}
		standaloneEvents.push(event);
	}

	const occurrences = [];
	for (const master of recurringMasters) {
		const overrideMap = overridesByUid.get(master.uid) || new Map();
		occurrences.push(...expandRecurringEvent(master, overrideMap, windowEnd, replayLibraryUrl));
	}

	for (const standalone of standaloneEvents) {
		occurrences.push(normalizeEventInstance(standalone, {
			replayLibraryUrl,
			isRescheduled: false
		}));
	}

	const upcoming = occurrences
		.filter((event) => event.status !== 'cancelled' && new Date(event.endDateTime) >= now)
		.sort((a, b) => new Date(a.startDateTime) - new Date(b.startDateTime))
		.slice(0, Math.max(1, limit));

	return upcoming;
}

function hydrateEvent(rawEvent, calendarTimezone) {
	const properties = rawEvent.properties;
	const uid = getPropertyValue(properties, 'UID');
	const summary = getPropertyValue(properties, 'SUMMARY');
	const description = decodeIcsText(getPropertyValue(properties, 'DESCRIPTION') || '');
	const startProp = getProperty(properties, 'DTSTART');
	const endProp = getProperty(properties, 'DTEND');
	const recurrenceProp = getProperty(properties, 'RECURRENCE-ID');
	const status = (getPropertyValue(properties, 'STATUS') || 'CONFIRMED').toLowerCase();
	if (!uid || !summary || !startProp || !endProp) return null;

	const timezone = startProp.params.TZID || recurrenceProp?.params.TZID || calendarTimezone || DEFAULT_SOURCE_TIMEZONE;
	const start = parseDateProperty(startProp, timezone);
	const end = parseDateProperty(endProp, timezone);
	const recurrenceId = recurrenceProp ? parseDateProperty(recurrenceProp, timezone) : null;

	return {
		uid,
		title: summary,
		description,
		start,
		end,
		recurrenceIdKey: recurrenceId?.localKey || null,
		joinUrl: extractJoinUrl(properties, description),
		rrule: parseRRule(getPropertyValue(properties, 'RRULE')),
		exdateKeys: collectExdateKeys(properties, timezone),
		status: status === 'cancelled' ? 'cancelled' : 'scheduled',
		sourceTimezone: timezone
	};
}

function expandRecurringEvent(master, overrides, windowEnd, replayLibraryUrl) {
	const occurrences = [];
	const byDay = master.rrule?.BYDAY?.split(',').filter(Boolean) || [];
	const until = parseUntil(master.rrule?.UNTIL, master.sourceTimezone);
	const startDate = new Date(Math.max(master.start.utcDate.getTime(), Date.now() - 7 * 24 * 60 * 60 * 1000));
	const durationMs = master.end.utcDate.getTime() - master.start.utcDate.getTime();
	const expectedDays = byDay.length
		? byDay.map((token) => RRULE_DAY_TO_INDEX[token]).filter((day) => day !== undefined)
		: [getWeekdayInTimezone(master.start.utcDate, master.sourceTimezone)];

	for (let cursor = stripTime(startDate); cursor <= stripTime(windowEnd); cursor = addDays(cursor, 1)) {
		const localDay = getWeekdayInTimezone(cursor, master.sourceTimezone);
		if (!expectedDays.includes(localDay)) continue;

		const candidateLocal = {
			year: getYearInTimezone(cursor, master.sourceTimezone),
			month: getMonthInTimezone(cursor, master.sourceTimezone),
			day: getDayInTimezone(cursor, master.sourceTimezone),
			hour: master.start.localParts.hour,
			minute: master.start.localParts.minute,
			second: master.start.localParts.second
		};
		const candidateKey = buildLocalKey(candidateLocal, master.sourceTimezone);
		if (candidateKey < master.start.localKey) continue;
		if (until && zonedTimeToUtc(candidateLocal, master.sourceTimezone) > until) continue;
		if (master.exdateKeys.has(candidateKey) && !overrides.has(candidateKey)) continue;

		const override = overrides.get(candidateKey);
		if (override) {
			occurrences.push(
				normalizeEventInstance(override, {
					replayLibraryUrl,
					isRescheduled: override.start.localKey !== candidateKey
				})
			);
			continue;
		}

		occurrences.push(
			normalizeEventInstance(
				{
					...master,
					start: {
						utcDate: zonedTimeToUtc(candidateLocal, master.sourceTimezone),
						localParts: candidateLocal,
						localKey: candidateKey
					},
					end: {
						utcDate: new Date(zonedTimeToUtc(candidateLocal, master.sourceTimezone).getTime() + durationMs),
						localParts: addDurationToLocalParts(candidateLocal, durationMs, master.sourceTimezone),
						localKey: ''
					}
				},
				{
					replayLibraryUrl,
					isRescheduled: false
				}
			)
		);
	}

	return occurrences;
}

function normalizeEventInstance(event, { replayLibraryUrl, isRescheduled }) {
	const description = event.description || '';
	const canonicalTimezone = event.sourceTimezone || DEFAULT_SOURCE_TIMEZONE;
	const start = event.start.utcDate;
	const end = event.end.utcDate;
	const status = event.status === 'cancelled' ? 'cancelled' : isRescheduled ? 'rescheduled' : 'scheduled';
	return {
		id: buildEventId(event.uid, event.start.localKey),
		title: event.title,
		startDateTime: start.toISOString(),
		endDateTime: end.toISOString(),
		sourceTimezone: canonicalTimezone,
		description,
		joinUrl: event.joinUrl || '',
		eventType: DEFAULT_EVENT_TYPE,
		recurrenceNote:
			'Scheduled from the live Cashflow Academy office hours calendar. If a Thursday session moves, this page reflects the moved instance.',
		replayLibraryUrl,
		status,
		googleCalendarUrl: buildGoogleCalendarUrl({
			title: event.title,
			startDateTime: start.toISOString(),
			endDateTime: end.toISOString(),
			description,
			location: event.joinUrl || 'Cashflow Academy member portal',
			timezone: canonicalTimezone
		})
	};
}

function collectExdateKeys(properties, timezone) {
	const keys = new Set();
	for (const entry of properties.EXDATE || []) {
		for (const rawValue of entry.value.split(',')) {
			const parsed = parseDateProperty({ value: rawValue, params: entry.params || {} }, timezone);
			keys.add(parsed.localKey);
		}
	}
	return keys;
}

function parseRRule(rule) {
	if (!rule) return null;
	return rule.split(';').reduce((acc, chunk) => {
		const [key, value] = chunk.split('=');
		if (key && value) acc[key.toUpperCase()] = value;
		return acc;
	}, {});
}

function parseUntil(rawUntil, timezone) {
	if (!rawUntil) return null;
	return parseDateProperty({ value: rawUntil, params: rawUntil.endsWith('Z') ? {} : { TZID: timezone } }, timezone)
		.utcDate;
}

function parseDateProperty(property, fallbackTimezone) {
	const parts = parseDateValue(property.value);
	const timezone = property.params?.TZID || fallbackTimezone || DEFAULT_SOURCE_TIMEZONE;
	if (!parts.hasTime) {
		const utcDate = new Date(Date.UTC(parts.year, parts.month - 1, parts.day, 0, 0, 0));
		return { utcDate, localParts: parts, localKey: buildLocalKey(parts, timezone) };
	}
	const utcDate = parts.isUTC
		? new Date(Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second))
		: zonedTimeToUtc(parts, timezone);
	return {
		utcDate,
		localParts: parts,
		localKey: buildLocalKey(parts, timezone)
	};
}

function parseDateValue(rawValue) {
	const match = rawValue.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?)?(Z)?$/);
	if (!match) throw new Error(`Unsupported ICS date value: ${rawValue}`);
	return {
		year: Number(match[1]),
		month: Number(match[2]),
		day: Number(match[3]),
		hour: Number(match[4] || 0),
		minute: Number(match[5] || 0),
		second: Number(match[6] || 0),
		hasTime: Boolean(match[4]),
		isUTC: Boolean(match[7])
	};
}

function buildLocalKey(parts, timezone) {
	return `${parts.year}${pad(parts.month)}${pad(parts.day)}T${pad(parts.hour)}${pad(parts.minute)}${pad(parts.second)}|${timezone}`;
}

function buildEventId(uid, localKey) {
	return `${uid}__${localKey.replace(/[|/]/g, '_')}`;
}

function extractJoinUrl(properties, description) {
	const conferenceUrl = getPropertyValue(properties, 'X-GOOGLE-CONFERENCE');
	if (conferenceUrl) return conferenceUrl;
	const meetMatch = description.match(/https:\/\/meet\.google\.com\/[a-z0-9-]+/i);
	if (meetMatch) return meetMatch[0];
	const genericUrl = description.match(/https?:\/\/[^\s\\]+/i);
	return genericUrl ? genericUrl[0] : '';
}

function buildGoogleCalendarUrl({ title, startDateTime, endDateTime, description, location, timezone }) {
	const params = new URLSearchParams({
		action: 'TEMPLATE',
		text: title,
		dates: `${formatGoogleDate(startDateTime)}/${formatGoogleDate(endDateTime)}`,
		details: description || '',
		location: location || '',
		ctz: timezone || DEFAULT_SOURCE_TIMEZONE
	});
	return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

function formatGoogleDate(isoString) {
	return isoString.replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
}

function decodeIcsText(value) {
	return value
		.replace(/\\n/g, '\n')
		.replace(/\\,/g, ',')
		.replace(/\\;/g, ';')
		.replace(/\\\\/g, '\\');
}

function zonedTimeToUtc(parts, timeZone) {
	const utcGuess = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
	let offset = getTimeZoneOffsetMs(utcGuess, timeZone);
	let adjusted = utcGuess - offset;
	const adjustedOffset = getTimeZoneOffsetMs(adjusted, timeZone);
	if (adjustedOffset !== offset) adjusted = utcGuess - adjustedOffset;
	return new Date(adjusted);
}

function getTimeZoneOffsetMs(timestamp, timeZone) {
	const formatter = new Intl.DateTimeFormat('en-US', {
		timeZone,
		hour12: false,
		year: 'numeric',
		month: '2-digit',
		day: '2-digit',
		hour: '2-digit',
		minute: '2-digit',
		second: '2-digit'
	});
	const parts = Object.fromEntries(
		formatter
			.formatToParts(new Date(timestamp))
			.filter((part) => part.type !== 'literal')
			.map((part) => [part.type, part.value])
	);
	const asUtc = Date.UTC(
		Number(parts.year),
		Number(parts.month) - 1,
		Number(parts.day),
		Number(parts.hour),
		Number(parts.minute),
		Number(parts.second)
	);
	return asUtc - timestamp;
}

function addDurationToLocalParts(parts, durationMs, timeZone) {
	const endUtc = new Date(zonedTimeToUtc(parts, timeZone).getTime() + durationMs);
	const formatter = new Intl.DateTimeFormat('en-US', {
		timeZone,
		hour12: false,
		year: 'numeric',
		month: '2-digit',
		day: '2-digit',
		hour: '2-digit',
		minute: '2-digit',
		second: '2-digit',
		weekday: 'short'
	});
	const endParts = Object.fromEntries(
		formatter
			.formatToParts(endUtc)
			.filter((part) => part.type !== 'literal')
			.map((part) => [part.type, part.value])
	);
	return {
		year: Number(endParts.year),
		month: Number(endParts.month),
		day: Number(endParts.day),
		hour: Number(endParts.hour),
		minute: Number(endParts.minute),
		second: Number(endParts.second)
	};
}

function stripTime(date) {
	return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function addDays(date, days) {
	const next = new Date(date.getTime());
	next.setUTCDate(next.getUTCDate() + days);
	return next;
}

function getWeekdayInTimezone(date, timeZone) {
	const token = new Intl.DateTimeFormat('en-US', { timeZone, weekday: 'short' }).format(date);
	return RRULE_DAY_TO_INDEX[weekdayToken(token)];
}

function weekdayToken(token) {
	return token.slice(0, 2).toUpperCase();
}

function getYearInTimezone(date, timeZone) {
	return Number(new Intl.DateTimeFormat('en-US', { timeZone, year: 'numeric' }).format(date));
}

function getMonthInTimezone(date, timeZone) {
	return Number(new Intl.DateTimeFormat('en-US', { timeZone, month: '2-digit' }).format(date));
}

function getDayInTimezone(date, timeZone) {
	return Number(new Intl.DateTimeFormat('en-US', { timeZone, day: '2-digit' }).format(date));
}

function pad(value) {
	return String(value).padStart(2, '0');
}
