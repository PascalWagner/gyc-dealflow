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
	const cachedFiling = $derived(payload?.cachedFiling || null);
	const search = $derived(payload?.search || { hasRun: false, candidates: [], bestMatch: null, queries: [] });
	const searchContext = $derived(search?.searchContext || { dealName: '', sponsorName: '', legalEntities: {}, priorityMode: 'deal_first' });
	const gate = $derived(view?.gate || buildSecVerificationGate('pending'));
	const tone = $derived(view?.currentTone || 'pending');
	const setupRequired = $derived(Boolean(payload?.setupRequired));
	const setupMessage = $derived(String(payload?.setupMessage || ''));
	const disableManualResolution = $derived(Boolean(view?.currentStatus === 'verified' || setupRequired));
	const applicabilityLabel = $derived(view?.applicability?.isApplicable === false ? 'Not expected' : 'Review required');
	const searchModeLabel = $derived(searchContext.priorityMode === 'issuer_first' ? 'Issuer entity first' : 'Deal name first');
	const checkedAtLabel = $derived(view?.checkedAt ? new Date(view.checkedAt).toLocaleString() : 'Not yet checked');
	const candidateCount = $derived(Array.isArray(search?.candidates) ? search.candidates.length : 0);
	const queryCount = $derived(Array.isArray(search?.queries) ? search.queries.length : 0);
	const workspaceHeading = $derived.by(() => {
		if (view?.currentStatus === 'verified') return 'Issuer match confirmed';
		if (view?.currentStatus === 'have_not_filed_yet') return "Issuer marked as haven't filed yet";
		if (view?.currentStatus === 'not_applicable') return 'SEC review marked not applicable';
		if (candidateCount > 0) return 'Review the likely filing matches';
		if (cachedFiling) return 'A cached filing is ready for review';
		return 'Resolve the issuer and compliance record';
	});
	const decisionSummary = $derived.by(() => {
		if (view?.currentStatus === 'verified') {
			return 'This deal is linked to a filing. Double-check the discrepancies below before you move on.';
		}
		if (view?.currentStatus === 'have_not_filed_yet') {
			return 'Keep a reviewer note explaining why the issuer has not filed yet so the resolution is easy to trust later.';
		}
		if (view?.currentStatus === 'not_applicable') {
			return 'Document why this deal should bypass Form D review so the next reviewer does not have to guess.';
		}
		if (candidateCount > 0) {
			return 'Pick the right filing if one matches. Otherwise use a manual resolution and explain why.';
		}
		if (cachedFiling) {
			return 'You can confirm the cached filing, run a fresh search, or choose a manual resolution if this issuer is still pre-file.';
		}
		return 'Search for a filing first. If the issuer has not filed yet or Form D does not apply, resolve it manually with a note.';
	});

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
			throw new Error(nextPayload?.setupMessage || nextPayload?.error || 'SEC verification request failed.');
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

	function buildCachedFilingCandidate(filingSummary) {
		if (!filingSummary?.accessionNumber) return null;
		return {
			accession: filingSummary.accessionNumber,
			cik: filingSummary.cik,
			cikPadded: filingSummary.cikPadded || String(filingSummary.cik || '').padStart(10, '0'),
			entityName: filingSummary.entityName,
			matchScore: 1
		};
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
	<div class={`sec-stage__hero sec-stage__hero--${tone}`}>
		<div class="sec-stage__hero-copy">
			<div class="sec-stage__eyebrow">Issuer verification</div>
			<h3>{workspaceHeading}</h3>
			<p>{view?.description || fallbackApplicability.reason}</p>
		</div>
		<div class="sec-stage__hero-side">
			<div class={`sec-stage__pill sec-stage__pill--${tone}`}>
				{view?.currentLabel || SEC_VERIFICATION_LABELS.pending}
			</div>
			<div class="sec-stage__hero-metrics">
				<div class="sec-stage__metric">
					<span>Applicability</span>
					<strong>{applicabilityLabel}</strong>
				</div>
				<div class="sec-stage__metric">
					<span>Search mode</span>
					<strong>{searchModeLabel}</strong>
				</div>
				<div class="sec-stage__metric">
					<span>Last checked</span>
					<strong>{checkedAtLabel}</strong>
				</div>
				{#if view?.suggestedLabel && gate.blocksPublish}
					<div class="sec-stage__metric">
						<span>Suggested</span>
						<strong>{view.suggestedLabel}</strong>
					</div>
				{/if}
			</div>
		</div>
	</div>

	{#if gate.blocksPublish}
		<div class="sec-stage__banner sec-stage__banner--blocked">{gate.reason}</div>
	{/if}

	{#if setupRequired && setupMessage}
		<div class="sec-stage__banner sec-stage__banner--warning">
			<strong>Persistence setup required</strong>
			<span>{setupMessage}</span>
		</div>
	{/if}

	{#if loading}
		<div class="sec-stage__banner">Loading SEC verification...</div>
	{:else if error}
		<div class="sec-stage__banner sec-stage__banner--error">{error}</div>
	{/if}

	<div class="sec-stage__workspace">
		<section class="sec-stage__card sec-stage__card--decision">
			<div class="sec-stage__card-head">
				<div>
					<div class="sec-stage__card-kicker">Decision</div>
					<strong>How this stage resolves</strong>
				</div>
			</div>
			<p class="sec-stage__card-copy">{decisionSummary}</p>
			<div class="sec-stage__actions">
				<button type="button" class="sec-stage__button sec-stage__button--primary" disabled={loading || submitting || !dealId} onclick={refreshMatch}>
					{search.hasRun ? 'Refresh Form D Search' : 'Search Form D Filings'}
				</button>
				<button
					type="button"
					class="sec-stage__button"
					disabled={loading || submitting || !dealId || disableManualResolution}
					onclick={() => setManualStatus('have_not_filed_yet')}
				>
					Mark Haven't Filed Yet
				</button>
				<button
					type="button"
					class="sec-stage__button"
					disabled={loading || submitting || !dealId || disableManualResolution}
					onclick={() => setManualStatus('not_applicable')}
				>
					Mark Not Applicable
				</button>
			</div>
			<label class="sec-stage__note">
				<span>Reviewer note</span>
				<textarea
					rows="3"
					placeholder="Explain why the issuer is verified, still pre-file, or should be treated as not applicable."
					value={noteDraft}
					oninput={(event) => {
						noteDraft = event.currentTarget.value;
					}}
				></textarea>
			</label>
		</section>

		<section class="sec-stage__card">
			<div class="sec-stage__card-head">
				<div>
					<div class="sec-stage__card-kicker">Search context</div>
					<strong>What we are matching against</strong>
				</div>
				{#if search.hasRun && queryCount > 0}
					<span class="sec-stage__card-badge">{queryCount} queries run</span>
				{/if}
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
			{#if search.hasRun && queryCount > 0}
				<div class="sec-stage__chip-list">
					{#each search.queries as query}
						<span class="sec-stage__chip">{query}</span>
					{/each}
				</div>
			{/if}
		</section>
	</div>

	{#if filing}
		<section class="sec-stage__evidence sec-stage__evidence--verified">
			<div class="sec-stage__evidence-head">
				<div>
					<div class="sec-stage__card-kicker">Matched filing</div>
					<strong>{filing.entityName || 'SEC filing linked'}</strong>
				</div>
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
		</section>
	{/if}

	{#if !filing && cachedFiling}
		<section class="sec-stage__evidence">
			<div class="sec-stage__evidence-head">
				<div>
					<div class="sec-stage__card-kicker">Cached filing</div>
					<strong>{cachedFiling.entityName || 'Cached SEC filing found'}</strong>
				</div>
				<div class="sec-stage__evidence-actions">
					{#if cachedFiling.edgarUrl}
						<a href={cachedFiling.edgarUrl} target="_blank" rel="noreferrer">Open on EDGAR</a>
					{/if}
					<button
						type="button"
						class="sec-stage__button sec-stage__button--small"
						disabled={submitting}
						onclick={() => confirmMatch(buildCachedFilingCandidate(cachedFiling))}
					>
						Use Cached Filing
					</button>
				</div>
			</div>
			<div class="sec-stage__details">
				<div><span>CIK</span><strong>{cachedFiling.cik || '—'}</strong></div>
				<div><span>Accession</span><strong>{cachedFiling.accessionNumber || '—'}</strong></div>
				<div><span>Filed</span><strong>{cachedFiling.filingDate || '—'}</strong></div>
				<div><span>First sale</span><strong>{cachedFiling.dateOfFirstSale || '—'}</strong></div>
				<div><span>Form</span><strong>{cachedFiling.filingType || '—'}</strong></div>
				<div><span>Exemptions</span><strong>{formatExemptions(cachedFiling.federalExemptions)}</strong></div>
				<div><span>Minimum</span><strong>{formatMoney(cachedFiling.minimumInvestment)}</strong></div>
				<div><span>Amount sold</span><strong>{formatMoney(cachedFiling.totalAmountSold)}</strong></div>
				<div><span>Investors</span><strong>{cachedFiling.totalInvestors ?? '—'}</strong></div>
			</div>
			{#if formatPeople(cachedFiling.relatedPeople)}
				<div class="sec-stage__inline-list">
					<span>Related people</span>
					<strong>{formatPeople(cachedFiling.relatedPeople)}</strong>
				</div>
			{/if}
			{#if cachedFiling.discrepancies?.length > 0}
				<div class="sec-stage__warnings">
					<strong>Review these differences</strong>
					{#each cachedFiling.discrepancies as discrepancy}
						<div class="sec-stage__warning-item">
							<span>{discrepancy.label}</span>
							<strong>{discrepancy.detail}</strong>
						</div>
					{/each}
				</div>
			{/if}
		</section>
	{/if}

	{#if !filing && search.hasRun && candidateCount > 0}
		<section class="sec-stage__matches">
			<div class="sec-stage__matches-head">
				<div>
					<div class="sec-stage__card-kicker">Candidate filings</div>
					<strong>{candidateCount} possible match{candidateCount === 1 ? '' : 'es'}</strong>
				</div>
			</div>
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
							<div class="sec-stage__chip-list">
								{#each candidate.reasons as reason}
									<span class="sec-stage__chip">{reason}</span>
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
								Open Filing
							</a>
						{/if}
						<button
							type="button"
							class="sec-stage__button sec-stage__button--small"
							disabled={submitting}
							onclick={() => confirmMatch(candidate)}
						>
							Use This Filing
						</button>
					</div>
				</div>
			{/each}
		</section>
	{:else if !filing && search.hasRun}
		<div class="sec-stage__empty">
			No SEC matches were found from the current search context. Review the structured fields above, then run the search again or choose a manual resolution if the issuer has not filed yet.
		</div>
	{/if}
</section>

<style>
	.sec-stage {
		display: grid;
		gap: 16px;
		padding: 22px;
		border: 1px solid color-mix(in srgb, var(--border-color, #d7dadd) 78%, white);
		border-radius: 26px;
		background:
			linear-gradient(180deg, rgba(252, 251, 247, 0.98), rgba(245, 246, 241, 0.98)),
			radial-gradient(circle at top right, rgba(31, 81, 89, 0.04), transparent 44%);
	}

	.sec-stage__hero {
		display: grid;
		grid-template-columns: minmax(0, 1.15fr) minmax(260px, 0.85fr);
		gap: 16px;
		padding: 18px;
		border-radius: 22px;
		border: 1px solid rgba(31, 81, 89, 0.08);
		background: rgba(255, 255, 255, 0.56);
	}

	.sec-stage__hero--verified {
		background:
			linear-gradient(180deg, rgba(239, 253, 244, 0.96), rgba(247, 251, 248, 0.94)),
			radial-gradient(circle at top right, rgba(22, 122, 82, 0.14), transparent 46%);
	}

	.sec-stage__hero--review,
	.sec-stage__hero--waiting {
		background:
			linear-gradient(180deg, rgba(255, 249, 239, 0.96), rgba(251, 248, 243, 0.94)),
			radial-gradient(circle at top right, rgba(249, 115, 22, 0.12), transparent 46%);
	}

	.sec-stage__hero-copy {
		display: grid;
		gap: 8px;
	}

	.sec-stage__eyebrow,
	.sec-stage__card-kicker {
		font-size: 11px;
		font-weight: 800;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: var(--text-muted, #68707a);
	}

	h3 {
		margin: 0;
		font-size: 24px;
		line-height: 1.1;
		color: var(--text, #111827);
	}

	.sec-stage__hero-copy p,
	.sec-stage__card-copy {
		margin: 0;
		font-size: 14px;
		line-height: 1.6;
		color: var(--text-muted, #5f6c7b);
	}

	.sec-stage__hero-side {
		display: grid;
		align-content: start;
		gap: 12px;
	}

	.sec-stage__pill {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		padding: 8px 12px;
		border-radius: 999px;
		font-size: 12px;
		font-weight: 700;
		justify-self: start;
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

	.sec-stage__hero-metrics,
	.sec-stage__details,
	.sec-stage__context-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
		gap: 10px;
	}

	.sec-stage__metric,
	.sec-stage__details div,
	.sec-stage__context-grid div {
		display: grid;
		gap: 4px;
		padding: 12px;
		border-radius: 14px;
		background: rgba(255, 255, 255, 0.58);
		font-size: 13px;
	}

	.sec-stage__metric span,
	.sec-stage__details span,
	.sec-stage__context-grid span,
	.sec-stage__inline-list span,
	.sec-stage__warning-item span {
		color: var(--text-muted, #68707a);
	}

	.sec-stage__metric strong,
	.sec-stage__details strong,
	.sec-stage__context-grid strong,
	.sec-stage__inline-list strong,
	.sec-stage__card-head strong,
	.sec-stage__candidate-name,
	.sec-stage__matches-head strong,
	.sec-stage__evidence-head strong {
		color: var(--text, #111827);
	}

	.sec-stage__banner,
	.sec-stage__empty {
		padding: 13px 14px;
		border-radius: 16px;
		background: #f8fafc;
		color: var(--text-muted, #5f6c7b);
		font-size: 13px;
		line-height: 1.55;
	}

	.sec-stage__banner--blocked,
	.sec-stage__banner--error {
		background: #fff1f0;
		color: #b42318;
	}

	.sec-stage__banner--warning {
		display: grid;
		gap: 4px;
		background: #fff7e8;
		color: #9a6700;
	}

	.sec-stage__workspace {
		display: grid;
		grid-template-columns: minmax(0, 0.95fr) minmax(0, 1.05fr);
		gap: 14px;
	}

	.sec-stage__card,
	.sec-stage__evidence,
	.sec-stage__candidate {
		padding: 16px;
		border-radius: 18px;
		border: 1px solid color-mix(in srgb, var(--border-color, #d7dadd) 84%, white);
		background: rgba(255, 255, 255, 0.58);
	}

	.sec-stage__card--decision {
		background:
			linear-gradient(180deg, rgba(255, 255, 255, 0.98), rgba(247, 249, 251, 0.96)),
			radial-gradient(circle at top right, rgba(249, 115, 22, 0.08), transparent 42%);
	}

	.sec-stage__evidence--verified {
		background:
			linear-gradient(180deg, rgba(237, 253, 243, 0.96), rgba(246, 251, 247, 0.94)),
			radial-gradient(circle at top right, rgba(22, 122, 82, 0.12), transparent 46%);
	}

	.sec-stage__card-head,
	.sec-stage__evidence-head,
	.sec-stage__matches-head {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 12px;
		margin-bottom: 12px;
	}

	.sec-stage__card-copy {
		margin-bottom: 14px;
	}

	.sec-stage__card-badge {
		display: inline-flex;
		align-items: center;
		padding: 7px 10px;
		border-radius: 999px;
		background: #f5f7fa;
		color: var(--text, #111827);
		font-size: 12px;
		font-weight: 700;
	}

	.sec-stage__actions {
		display: flex;
		flex-wrap: wrap;
		gap: 10px;
		margin-bottom: 14px;
	}

	.sec-stage__button {
		border: 1px solid color-mix(in srgb, var(--border-color, #d7dadd) 88%, white);
		background: white;
		color: var(--text, #111827);
		padding: 10px 14px;
		border-radius: 999px;
		font: inherit;
		font-weight: 700;
		cursor: pointer;
		text-decoration: none;
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
		font-weight: 700;
	}

	.sec-stage__note textarea {
		width: 100%;
		min-height: 110px;
		padding: 12px 14px;
		border-radius: 14px;
		border: 1px solid color-mix(in srgb, var(--border-color, #d7dadd) 88%, white);
		background: white;
		font: inherit;
		color: var(--text, #111827);
		resize: vertical;
	}

	.sec-stage__chip-list {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
		margin-top: 12px;
	}

	.sec-stage__chip {
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

	.sec-stage__inline-list {
		display: grid;
		gap: 4px;
		margin-top: 12px;
	}

	.sec-stage__warnings {
		display: grid;
		gap: 8px;
		padding: 12px;
		border-radius: 14px;
		background: #fff5f3;
		color: #7a271a;
		margin-top: 12px;
	}

	.sec-stage__warning-item {
		display: grid;
		gap: 2px;
	}

	.sec-stage__matches {
		display: grid;
		gap: 12px;
	}

	.sec-stage__candidate {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 14px;
	}

	.sec-stage__candidate-copy {
		display: grid;
		gap: 10px;
		flex: 1;
	}

	.sec-stage__candidate-meta {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
		font-size: 13px;
		color: var(--text-muted, #5f6c7b);
	}

	.sec-stage__candidate-actions,
	.sec-stage__evidence-actions {
		display: grid;
		gap: 8px;
		justify-items: end;
	}

	.sec-stage__evidence-head a {
		color: inherit;
		font-size: 13px;
		font-weight: 700;
		text-decoration: none;
	}

	@media (max-width: 900px) {
		.sec-stage__hero,
		.sec-stage__workspace,
		.sec-stage__candidate {
			grid-template-columns: 1fr;
			flex-direction: column;
		}

		.sec-stage__candidate-actions,
		.sec-stage__evidence-actions {
			width: 100%;
			justify-items: stretch;
		}
	}

	@media (max-width: 720px) {
		.sec-stage__actions {
			flex-direction: column;
		}

		.sec-stage__button {
			width: 100%;
		}
	}
</style>
