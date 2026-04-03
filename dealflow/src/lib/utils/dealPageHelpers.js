import { browser } from '$app/environment';
import {
	getStoredSessionUser
} from '$lib/stores/auth.js';
import {
	readUserScopedJson,
	readUserScopedString,
	writeUserScopedJson,
	writeUserScopedString
} from '$lib/utils/userScopedState.js';

export function currentSessionUser() {
	return browser ? (getStoredSessionUser() || {}) : {};
}

export function scopedDealKey(dealId, prefix) {
	return dealId ? `${prefix}_${dealId}` : prefix;
}

export function readScopedDealJson(dealId, prefix, fallback) {
	return readUserScopedJson(scopedDealKey(dealId, prefix), fallback);
}

export function readScopedDealString(dealId, prefix, fallback = '') {
	return readUserScopedString(scopedDealKey(dealId, prefix), fallback);
}

export function writeScopedDealJson(dealId, prefix, value) {
	writeUserScopedJson(scopedDealKey(dealId, prefix), value);
}

export function writeScopedDealString(dealId, prefix, value) {
	writeUserScopedString(scopedDealKey(dealId, prefix), value);
}

export function firstDefined(...values) {
	for (const value of values) {
		if (value === undefined || value === null) continue;
		if (typeof value === 'string' && !value.trim()) continue;
		return value;
	}
	return null;
}

export function bgStatusClass(s) {
	return s === 'clear' ? 'bg-clear' : s === 'flagged' ? 'bg-flagged' : 'bg-pending';
}

export function bgStatusLabel(s) {
	return s === 'clear' ? 'Clear' : s === 'flagged' ? 'Flag' : 'Pending';
}

export function getRelativeTime(ds) {
	if (!ds) return '';
	const d = Date.now() - new Date(ds).getTime();
	const m = Math.floor(d / 60000);
	if (m < 1) return 'just now';
	if (m < 60) return `${m}m ago`;
	const h = Math.floor(m / 60);
	if (h < 24) return `${h}h ago`;
	const dy = Math.floor(h / 24);
	if (dy < 30) return `${dy}d ago`;
	return `${Math.floor(dy / 30)}mo ago`;
}

export function loadWhenVisible(node, setVisible) {
	if (!browser || typeof IntersectionObserver === 'undefined') {
		setVisible(true);
		return { destroy() {} };
	}

	let triggered = false;
	const trigger = () => {
		if (triggered) return;
		triggered = true;
		setVisible(true);
	};

	const observer = new IntersectionObserver((entries) => {
		if (entries.some((entry) => entry.isIntersecting)) {
			observer.disconnect();
			trigger();
		}
	}, { rootMargin: '180px 0px' });

	observer.observe(node);
	return { destroy() { observer.disconnect(); } };
}

export function formatReviewDate(ds) {
	if (!ds) return '';
	const raw = String(ds).trim();
	const dateOnlyMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
	if (dateOnlyMatch) {
		const [, year, month, day] = dateOnlyMatch;
		return new Date(Number(year), Number(month) - 1, Number(day)).toLocaleDateString('en-US', {
			month: 'short',
			day: 'numeric',
			year: 'numeric'
		});
	}

	const parsed = new Date(raw);
	if (Number.isNaN(parsed.getTime())) return raw;
	return parsed.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function statusBadgeClass(status) {
	if (status === 'Open to invest') return 'status-open';
	if (status === 'Evergreen') return 'status-evergreen';
	return 'status-closed';
}
