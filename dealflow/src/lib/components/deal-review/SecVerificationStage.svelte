<script>
	import { onMount } from 'svelte';
	import { getFreshSessionToken } from '$lib/stores/auth.js';
	import {
		buildSecVerificationGate,
		deriveSecApplicability,
		formatSecVerificationConfidence,
		SEC_VERIFICATION_LABELS
	} from '$lib/sec/verification.js';

	let {
		dealId = '',
		deal = null,
		autoload = true,
		refreshKey = 0,
		onchange = () => {}
	} = $props();

	let loading = $state(false);
	let submitting = $state(false);
	let error = $state('');
	let payload = $state(null);
	let noteDraft = $state('');
	let lastLoadedDealId = $state('');
	let lastRefreshKey = $state(0);

	const fallbackApplicability = $derived(deriveSecApplicability(deal || {}));
	const view = $derived(payload?.view || null);
	const filing = $derived(payload?.filing || null);
	const search = $derived(payload?.search || { hasRun: false, candidates: [], bestMatch: null, queries: [] });
	const searchContext = $derived(search?.searchContext || { dealName: '', sponsorName: '', legalEntities: {}, priorityMode: 'deal_first' });
	const gate = $derived(view?.gate || buildSecVerificationGate('pending'));
	const tone = $derived(view?.currentTone || 'pending');
	const disableManualResolution = $derived(Boolean(filing?.id || view?.currentStatus === 'verified'));

	function formatMoney(value) {
		if (value === null || value === undefined || value === '') return '—';
		const numeric = Number(value);
		if (!Number.isFinite(numeric)) return '—';
		return new Intl.NumberFormat('en-US', {
			style: 'currency',
			currency: 'USD',
			maximumFractionDigits: 0
		}).format(numeric);
	}

	function formatExemptions(values = []) {
		if (!Array.isArray(values) || values.length === 0) return '—';
		return values
			.map((value) => (value === '06b' ? '506(b)' : value === '06c' ? '506(c)' : value))
			.join(', ');
	}

	function formatPeople(values = []) {
		return Array.isArray(values) ? values.filter(Boolean).join(' • ') : '';
	}

	function emitChange(nextPayload) {
		onchange({
			view: nextPayload?.view || null,
			record: nextPayload?.record || null,
			filing: nextPayload?.filing || null,
			search: nextPayload?.search || null
		});
	}

	function syncPayload(nextPayload, { resetNote = false } = {}) {
		payload = nextPayload;
		if (resetNote || !noteDraft) {
			noteDraft = String(nextPayload?.view?.note || '');
		}
		emitChange(nextPayload);
	}

	async function request(url, options = {}) {
		const token = await getFreshSessionToken();
		if (!token) throw new Error('You need an active session to use SEC verification.');

		const headers = {
			Authorization: `Bearer ${token}`,
			...(options.body ? { 'Content-Type': 'application/json' } : {}),
			...(options.headers || {})
		};

		const response = await fetch(url, {
			...options,
			headers
		});
		const nextPayload = await response.json().catch(() => ({}));
		if (!response.ok) {
			throw new Error(nextPayload?.error || 'SEC verification request failed.');
		}
		return nextPayload;
	}

	async function load({ background = false } = {}) {
		if (!dealId) return;
		if (!background) {
			loading = true;
		}
		error = '';

		try {
			const nextPayload = await request(`/api/sec-verification?dealId=${encodeURIComponent(dealId)}`);
			syncPayload(nextPayload, { resetNote: true });
			lastLoadedDealId = dealId;
		} catch (err) {
			error = err?.message || 'Could not load SEC verification.';
		} finally {
			if (!background) {
				loading = false;
			}
		}
	}

	async function refreshMatch() {
		if (!dealId || submitting) return;
		submitting = true;
		error = '';

		try {
			const nextPayload = await request('/api/sec-verification', {
				method: 'POST',
				body: JSON.stringify({
					action: 'refresh-match',
					dealId
				})
			});
			syncPayload(nextPayload);
		} catch (err) {
			error = err?.message || 'Could not run the SEC issuer check.';
		} finally {
			submitting = false;
		}
	}

	async function setManualStatus(status) {
		if (!dealId || submitting) return;
		submitting = true;
		error = '';

		try {
			const nextPayload = await request('/api/sec-verification', {
				method: 'POST',
				body: JSON.stringify({
					action: 'set-status',
					dealId,
					status,
					note: noteDraft
				})
			});
			syncPayload(nextPayload);
		} catch (err) {
			error = err?.message || 'Could not save the SEC verification status.';
		} finally {
			submitting = false;
		}
	}

	async function confirmMatch(candidate) {
		if (!dealId || submitting || !candidate?.accession) return;
		submitting = true;
		error = '';

		try {
			const nextPayload = await request('/api/sec-verification', {
				method: 'POST',
				body: JSON.stringify({
					action: 'confirm-match',
					dealId,
					accession: candidate.accession,
					cik: candidate.cik,
					cikPadded: candidate.cikPadded,
					entityName: candidate.entityName,
					matchScore: candidate.matchScore,
					note: noteDraft
				})
			});
			syncPayload(nextPayload);
		} catch (err) {
			error = err?.message || 'Could not confirm the SEC filing match.';
		} finally {
			submitting = false;
		}
	}

	onMount(() => {
		if (autoload && dealId) {
			lastLoadedDealId = dealId;
			lastRefreshKey = refreshKey;
			void load();
		}
	});

	$effect(() => {
		if (!autoload || !dealId) return;
		if (loading) return;
		if (dealId === lastLoadedDealId) return;
		error = '';
		noteDraft = '';
		lastLoadedDealId = dealId;
		void load();
	});

	$effect(() => {
		if (!autoload || !dealId) return;
		if (!payload) return;
		if (dealId !== lastLoadedDealId) return;
		if (refreshKey === lastRefreshKey) return;
		lastRefreshKey = refreshKey;
		void load({ background: true });
	});
</script>

<section class="sec-stage">
	<div class="sec-stage__header">
		<div>
			<div class="sec-stage__eyebrow">Compliance stage</div>
			<h3>SEC / Issuer Verification</h3>
		</div>
		<div class={`sec-stage__pill sec-stage__pill--${tone}`}>
			{view?.currentLabel || SEC_VERIFICATION_LABELS.pending}
		</div>
	</div>

	{#if gate.blocksPublish}
		<div class="sec-stage__gate">
			{gate.reason}
		</div>
	{/if}

	<p class="sec-stage__summary">
		{view?.description || fallbackApplicability.reason}
	</p>

	<div class="sec-stage__meta">
		<div>
			<span class="sec-stage__meta-label">Applicability</span>
			<span>{view?.applicability?.isApplicable === false ? 'Not expected' : 'Review required'}</span>
		</div>
		<div>
			<span class="sec-stage__meta-label">Search mode</span>
			<span>{searchContext.priorityMode === 'issuer_first' ? 'Issuer entity first' : 'Deal name first'}</span>
		</div>
		{#if view?.checkedAt}
			<div>
				<span class="sec-stage__meta-label">Last checked</span>
				<span>{new Date(view.checkedAt).toLocaleString()}</span>
			</div>
		{/if}
		{#if view?.suggestedLabel && gate.blocksPublish}
			<div>
				<span class="sec-stage__meta-label">Suggested</span>
				<span>{view.suggestedLabel}</span>
			</div>
		{/if}
	</div>

	<div class="sec-stage__actions">
		<button type="button" class="sec-stage__button sec-stage__button--primary" disabled={loading || submitting || !dealId} onclick={refreshMatch}>
			{search.hasRun ? 'Refresh SEC filing search' : 'Search SEC Form D filings'}
		</button>
		<button
			type="button"
			class="sec-stage__button"
			disabled={loading || submitting || !dealId || disableManualResolution}
			onclick={() => setManualStatus('have_not_filed_yet')}
		>
			Mark haven't filed yet
		</button>
		<button
			type="button"
			class="sec-stage__button"
			disabled={loading || submitting || !dealId || disableManualResolution}
			onclick={() => setManualStatus('not_applicable')}
		>
			Mark not applicable
		</button>
	</div>

	<div class="sec-stage__search-plan">
		<div class="sec-stage__panel">
			<div class="sec-stage__panel-header">
				<strong>Search context</strong>
			</div>
			<div class="sec-stage__context-grid">
				<div>
					<span>Deal name</span>
					<strong>{searchContext.dealName || '—'}</strong>
				</div>
				<div>
					<span>Sponsor</span>
					<strong>{searchContext.sponsorName || '—'}</strong>
				</div>
				<div>
					<span>Issuer entity</span>
					<strong>{searchContext.legalEntities?.issuerEntity || '—'}</strong>
				</div>
				<div>
					<span>GP entity</span>
					<strong>{searchContext.legalEntities?.gpEntity || '—'}</strong>
				</div>
				<div>
					<span>Sponsor entity</span>
					<strong>{searchContext.legalEntities?.sponsorEntity || '—'}</strong>
				</div>
				<div>
					<span>Operator legal entity</span>
					<strong>{searchContext.legalEntities?.operatorLegalEntity || '—'}</strong>
				</div>
			</div>
		</div>

		{#if search.hasRun && search.queries?.length > 0}
			<div class="sec-stage__panel">
				<div class="sec-stage__panel-header">
					<strong>Queries run</strong>
				</div>
				<div class="sec-stage__query-list">
					{#each search.queries as query}
						<span class="sec-stage__query-chip">{query}</span>
					{/each}
				</div>
			</div>
		{/if}
	</div>

	<label class="sec-stage__note">
		<span>Reviewer note</span>
		<textarea
			rows="3"
			placeholder="Add context for why the issuer is verified, hasn't filed yet, or should be treated as not applicable."
			value={noteDraft}
			oninput={(event) => {
				noteDraft = event.currentTarget.value;
			}}
		></textarea>
	</label>

	{#if loading}
		<div class="sec-stage__panel">Loading SEC verification...</div>
	{:else if error}
		<div class="sec-stage__panel sec-stage__panel--error">{error}</div>
	{/if}

	{#if filing}
		<div class="sec-stage__panel sec-stage__panel--verified">
			<div class="sec-stage__panel-header">
				<strong>{filing.entityName || 'SEC filing linked'}</strong>
				{#if filing.edgarUrl}
					<a href={filing.edgarUrl} target="_blank" rel="noreferrer">Open on EDGAR</a>
				{/if}
			</div>
			<div class="sec-stage__details">
				<div><span>CIK</span><strong>{filing.cik || '—'}</strong></div>
				<div><span>Accession</span><strong>{filing.accessionNumber || '—'}</strong></div>
				<div><span>Filed</span><strong>{filing.filingDate || '—'}</strong></div>
				<div><span>First sale</span><strong>{filing.dateOfFirstSale || '—'}</strong></div>
				<div><span>Form</span><strong>{filing.filingType || '—'}</strong></div>
				<div><span>Exemptions</span><strong>{formatExemptions(filing.federalExemptions)}</strong></div>
				<div><span>Minimum</span><strong>{formatMoney(filing.minimumInvestment)}</strong></div>
				<div><span>Amount sold</span><strong>{formatMoney(filing.totalAmountSold)}</strong></div>
				<div><span>Investors</span><strong>{filing.totalInvestors ?? '—'}</strong></div>
			</div>
			{#if formatPeople(filing.relatedPeople)}
				<div class="sec-stage__inline-list">
					<span>Related people</span>
					<strong>{formatPeople(filing.relatedPeople)}</strong>
				</div>
			{/if}
			{#if filing.discrepancies?.length > 0}
				<div class="sec-stage__warnings">
					<strong>Review these differences</strong>
					{#each filing.discrepancies as discrepancy}
						<div class="sec-stage__warning-item">
							<span>{discrepancy.label}</span>
							<strong>{discrepancy.detail}</strong>
						</div>
					{/each}
				</div>
			{/if}
		</div>
	{:else if search.hasRun && search.candidates.length > 0}
		<div class="sec-stage__matches">
			<div class="sec-stage__matches-title">Candidate SEC filings</div>
			{#each search.candidates as candidate}
				<div class="sec-stage__candidate">
					<div class="sec-stage__candidate-copy">
						<div class="sec-stage__candidate-name">{candidate.entityName || 'Unnamed SEC issuer'}</div>
						<div class="sec-stage__candidate-meta">
							<span>{candidate.form || 'D'}</span>
							<span>{candidate.fileDate || 'Unknown filing date'}</span>
							<span>CIK {candidate.cik || '—'}</span>
							<span>{formatSecVerificationConfidence(candidate.matchScore) || 'No confidence score'}</span>
						</div>
						<div class="sec-stage__details">
							<div><span>Issuer type</span><strong>{candidate.entityType || '—'}</strong></div>
							<div><span>Jurisdiction</span><strong>{candidate.jurisdiction || candidate.issuerState || '—'}</strong></div>
							<div><span>Minimum</span><strong>{formatMoney(candidate.minimumInvestment)}</strong></div>
							<div><span>Amount sold</span><strong>{formatMoney(candidate.totalAmountSold)}</strong></div>
							<div><span>Investors</span><strong>{candidate.totalInvestors ?? '—'}</strong></div>
							<div><span>Exemptions</span><strong>{formatExemptions(candidate.federalExemptions)}</strong></div>
						</div>
						{#if candidate.reasons?.length > 0}
							<div class="sec-stage__reason-list">
								{#each candidate.reasons as reason}
									<span class="sec-stage__reason-chip">{reason}</span>
								{/each}
							</div>
						{/if}
						{#if formatPeople(candidate.relatedPeople)}
							<div class="sec-stage__inline-list">
								<span>Related people</span>
								<strong>{formatPeople(candidate.relatedPeople)}</strong>
							</div>
						{/if}
						{#if candidate.discrepancies?.length > 0}
							<div class="sec-stage__warnings">
								<strong>Review these differences</strong>
								{#each candidate.discrepancies as discrepancy}
									<div class="sec-stage__warning-item">
										<span>{discrepancy.label}</span>
										<strong>{discrepancy.detail}</strong>
									</div>
								{/each}
							</div>
						{/if}
					</div>
					<div class="sec-stage__candidate-actions">
						{#if candidate.edgarUrl}
							<a class="sec-stage__button sec-stage__button--small" href={candidate.edgarUrl} target="_blank" rel="noreferrer">
								Open filing
							</a>
						{/if}
						<button
							type="button"
							class="sec-stage__button sec-stage__button--small"
							disabled={submitting}
							onclick={() => confirmMatch(candidate)}
						>
							This is the filing
						</button>
					</div>
				</div>
			{/each}
		</div>
	{:else if search.hasRun}
		<div class="sec-stage__panel">
			No SEC matches were found from the current search context. Review the extracted issuer fields above, then run the search again or choose a manual state if the issuer has not filed yet.
		</div>
	{/if}
</section>

<style>
	.sec-stage {
		display: grid;
		gap: 14px;
		padding: 18px;
		border: 1px solid color-mix(in srgb, var(--border-color, #d7dadd) 80%, white);
		border-radius: 20px;
		background: linear-gradient(180deg, rgba(255, 255, 255, 0.96), rgba(247, 249, 251, 0.98));
	}

	.sec-stage__header {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 12px;
	}

	.sec-stage__eyebrow {
		font-size: 11px;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: var(--text-muted, #68707a);
	}

	h3 {
		margin: 4px 0 0;
		font-size: 20px;
		line-height: 1.1;
	}

	.sec-stage__pill {
		display: inline-flex;
		align-items: center;
		padding: 8px 12px;
		border-radius: 999px;
		font-size: 12px;
		font-weight: 700;
	}

	.sec-stage__pill--pending {
		background: #eef2f7;
		color: #344054;
	}

	.sec-stage__pill--review {
		background: #fff2dd;
		color: #9a6700;
	}

	.sec-stage__pill--verified {
		background: #e8f7ef;
		color: #14733c;
	}

	.sec-stage__pill--waiting {
		background: #fff3eb;
		color: #b54708;
	}

	.sec-stage__pill--neutral {
		background: #f2f4f7;
		color: #475467;
	}

	.sec-stage__gate {
		padding: 10px 12px;
		border-radius: 14px;
		background: #fff5f3;
		color: #b42318;
		font-size: 13px;
		font-weight: 600;
	}

	.sec-stage__summary {
		margin: 0;
		color: var(--text-muted, #5f6c7b);
		line-height: 1.5;
	}

	.sec-stage__meta {
		display: flex;
		flex-wrap: wrap;
		gap: 12px 18px;
		font-size: 13px;
		color: var(--text-muted, #5f6c7b);
	}

	.sec-stage__meta > div {
		display: inline-flex;
		gap: 8px;
		align-items: center;
	}

	.sec-stage__meta-label {
		font-weight: 700;
		color: var(--text, #111827);
	}

	.sec-stage__actions {
		display: flex;
		flex-wrap: wrap;
		gap: 10px;
	}

	.sec-stage__search-plan {
		display: grid;
		gap: 12px;
	}

	.sec-stage__button {
		border: 1px solid color-mix(in srgb, var(--border-color, #d7dadd) 88%, white);
		background: white;
		color: var(--text, #111827);
		padding: 10px 14px;
		border-radius: 999px;
		font: inherit;
		font-weight: 600;
		cursor: pointer;
	}

	.sec-stage__button:disabled {
		opacity: 0.55;
		cursor: not-allowed;
	}

	.sec-stage__button--primary {
		background: var(--orange, #f97316);
		border-color: var(--orange, #f97316);
		color: white;
	}

	.sec-stage__button--small {
		padding: 8px 12px;
		font-size: 13px;
	}

	.sec-stage__note {
		display: grid;
		gap: 8px;
		font-size: 13px;
		font-weight: 600;
	}

	.sec-stage__note textarea {
		width: 100%;
		min-height: 88px;
		padding: 12px 14px;
		border-radius: 14px;
		border: 1px solid color-mix(in srgb, var(--border-color, #d7dadd) 88%, white);
		background: white;
		font: inherit;
		color: var(--text, #111827);
		resize: vertical;
	}

	.sec-stage__panel {
		padding: 14px;
		border-radius: 16px;
		background: #f8fafc;
		color: var(--text-muted, #5f6c7b);
	}

	.sec-stage__panel--error {
		background: #fff1f0;
		color: #b42318;
	}

	.sec-stage__panel--verified {
		background: #edfdf3;
		color: #14532d;
	}

	.sec-stage__panel-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		margin-bottom: 12px;
	}

	.sec-stage__panel-header a {
		color: inherit;
		font-size: 13px;
		font-weight: 700;
		text-decoration: none;
	}

	.sec-stage__details {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
		gap: 12px;
	}

	.sec-stage__context-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
		gap: 12px;
	}

	.sec-stage__context-grid div {
		display: grid;
		gap: 4px;
		font-size: 13px;
	}

	.sec-stage__details div,
	.sec-stage__candidate-meta {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
		font-size: 13px;
	}

	.sec-stage__details span,
	.sec-stage__context-grid span,
	.sec-stage__inline-list span,
	.sec-stage__warning-item span {
		color: color-mix(in srgb, currentColor 70%, white);
	}

	.sec-stage__matches {
		display: grid;
		gap: 10px;
	}

	.sec-stage__query-list,
	.sec-stage__reason-list {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
	}

	.sec-stage__query-chip,
	.sec-stage__reason-chip {
		display: inline-flex;
		align-items: center;
		padding: 7px 10px;
		border-radius: 999px;
		border: 1px solid color-mix(in srgb, var(--border-color, #d7dadd) 84%, white);
		background: #f5f7fa;
		color: var(--text, #111827);
		font-size: 12px;
		font-weight: 600;
	}

	.sec-stage__matches-title {
		font-size: 13px;
		font-weight: 700;
		color: var(--text, #111827);
	}

	.sec-stage__candidate {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 12px;
		padding: 12px 14px;
		border-radius: 16px;
		border: 1px solid color-mix(in srgb, var(--border-color, #d7dadd) 84%, white);
		background: white;
	}

	.sec-stage__candidate-copy {
		display: grid;
		gap: 10px;
		flex: 1;
	}

	.sec-stage__candidate-name {
		font-weight: 700;
		color: var(--text, #111827);
	}

	.sec-stage__candidate-meta {
		color: var(--text-muted, #5f6c7b);
	}

	.sec-stage__candidate-actions {
		display: grid;
		gap: 8px;
		justify-items: end;
	}

	.sec-stage__inline-list {
		display: grid;
		gap: 4px;
	}

	.sec-stage__warnings {
		display: grid;
		gap: 8px;
		padding: 12px;
		border-radius: 14px;
		background: #fff5f3;
		color: #7a271a;
	}

	.sec-stage__warning-item {
		display: grid;
		gap: 2px;
	}

	@media (max-width: 720px) {
		.sec-stage__header,
		.sec-stage__candidate {
			flex-direction: column;
			align-items: stretch;
		}

		.sec-stage__actions {
			flex-direction: column;
		}

		.sec-stage__candidate-actions {
			justify-items: stretch;
		}
	}
</style>
