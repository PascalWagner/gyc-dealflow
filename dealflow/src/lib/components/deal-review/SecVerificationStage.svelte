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
		initialPayload = null,
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
			return 'This deal is linked to a filing. Double-check the differences below before you move on.';
		}
		if (view?.currentStatus === 'have_not_filed_yet') {
			return 'Keep a reviewer note explaining why the issuer has not filed yet so the resolution is easy to trust later.';
		}
		if (view?.currentStatus === 'not_applicable') {
			return 'Document why this deal should bypass Form D review so the next reviewer does not have to guess.';
		}
		if (candidateCount > 0) {
			return 'Pick the right filing if one matches. Otherwise resolve it manually and explain why.';
		}
		if (cachedFiling) {
			return 'You can confirm the cached filing, run a fresh search, or choose a manual resolution if this issuer is still pre-file.';
		}
		return 'Search for a filing first. If the issuer has not filed yet or Form D does not apply, resolve it manually with a note.';
	});
	const contextFacts = $derived.by(() => [
		{ label: 'Deal', value: searchContext.dealName || '—' },
		{ label: 'Sponsor', value: searchContext.sponsorName || '—' },
		{ label: 'Issuer', value: searchContext.legalEntities?.issuerEntity || '—' },
		{ label: 'Applicability', value: applicabilityLabel },
		{ label: 'Search mode', value: searchModeLabel }
	]);

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

	function evidenceSnapshot(source = {}) {
		return [
			{ label: 'Filed', value: source.filingDate || source.fileDate || '—' },
			{ label: 'Form', value: source.filingType || source.form || '—' },
			{ label: 'CIK', value: source.cik || '—' },
			{ label: 'Investors', value: source.totalInvestors ?? '—' },
			{ label: 'Minimum', value: formatMoney(source.minimumInvestment) },
			{ label: 'Amount sold', value: formatMoney(source.totalAmountSold) }
		];
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
		if (!background) loading = true;
		error = '';

		try {
			const nextPayload = await request(`/api/sec-verification?dealId=${encodeURIComponent(dealId)}`);
			syncPayload(nextPayload, { resetNote: true });
			lastLoadedDealId = dealId;
		} catch (err) {
			error = err?.message || 'Could not load SEC verification.';
		} finally {
			if (!background) loading = false;
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

	async function findNewRecord() {
		await refreshMatch();
	}

	async function skipForNow() {
		if (!String(noteDraft || '').trim()) {
			noteDraft = 'Skipped for now while I confirm the right filing.';
		}
		await setManualStatus('skipped');
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
		if (!dealId) return;
		lastLoadedDealId = dealId;
		lastRefreshKey = refreshKey;
		if (initialPayload) {
			syncPayload(initialPayload, { resetNote: true });
			return;
		}
		if (autoload) {
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
		if (!dealId || !initialPayload) return;
		if (loading) return;
		if (dealId !== lastLoadedDealId) return;
		syncPayload(initialPayload, { resetNote: true });
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

	<section class="sec-stage__decision">
		<div class="sec-stage__decision-header">
			<div class="sec-stage__decision-copy">
				<div class="sec-stage__eyebrow">SEC Review</div>
				<h3>{workspaceHeading}</h3>
				<p>{decisionSummary}</p>
			</div>
			<div class="sec-stage__decision-meta">
				<div class={`sec-stage__pill sec-stage__pill--${tone}`}>
					{view?.currentLabel || SEC_VERIFICATION_LABELS.pending}
				</div>
				<div class="sec-stage__microfact">
					<span>Last checked</span>
					<strong>{checkedAtLabel}</strong>
				</div>
				{#if view?.suggestedLabel && gate.blocksPublish}
					<div class="sec-stage__microfact">
						<span>Suggested</span>
						<strong>{view.suggestedLabel}</strong>
					</div>
				{/if}
			</div>
		</div>

		<div class="sec-stage__context-strip">
			{#each contextFacts as fact}
				<div class="sec-stage__context-chip">
					<span>{fact.label}</span>
					<strong>{fact.value}</strong>
				</div>
			{/each}
		</div>

		<div class="sec-stage__actions">
			<button type="button" class="sec-stage__button sec-stage__button--primary" disabled={loading || submitting || !dealId} onclick={findNewRecord}>
				{search.hasRun ? 'Find New Record' : 'Find New Record'}
			</button>
			<button
				type="button"
				class="sec-stage__button"
				disabled={loading || submitting || !dealId || disableManualResolution}
				onclick={skipForNow}
			>
				Skip For Now
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

	{#if filing}
		<section class="sec-stage__evidence sec-stage__evidence--verified">
			<div class="sec-stage__evidence-head">
				<div>
					<div class="sec-stage__card-kicker">Matched filing</div>
					<strong>{filing.entityName || 'SEC filing linked'}</strong>
					<p class="sec-stage__evidence-copy">The issuer is linked. Scan the differences below, then move on once the record feels trustworthy.</p>
				</div>
				{#if filing.edgarUrl}
					<a href={filing.edgarUrl} target="_blank" rel="noreferrer">Open on EDGAR</a>
				{/if}
			</div>

			<div class="sec-stage__snapshot-grid">
				{#each evidenceSnapshot(filing) as fact}
					<div class="sec-stage__snapshot-card">
						<span>{fact.label}</span>
						<strong>{fact.value}</strong>
					</div>
				{/each}
			</div>

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

			<details class="sec-stage__detail-panel">
				<summary>See full filing detail</summary>
				<div class="sec-stage__details">
					<div><span>Accession</span><strong>{filing.accessionNumber || '—'}</strong></div>
					<div><span>First sale</span><strong>{filing.dateOfFirstSale || '—'}</strong></div>
					<div><span>Exemptions</span><strong>{formatExemptions(filing.federalExemptions)}</strong></div>
				</div>
				{#if formatPeople(filing.relatedPeople)}
					<div class="sec-stage__inline-list">
						<span>Related people</span>
						<strong>{formatPeople(filing.relatedPeople)}</strong>
					</div>
				{/if}
			</details>
		</section>
	{:else if cachedFiling}
		<section class="sec-stage__evidence">
			<div class="sec-stage__evidence-head">
				<div>
					<div class="sec-stage__card-kicker">Cached filing</div>
					<strong>{cachedFiling.entityName || 'Cached SEC filing found'}</strong>
					<p class="sec-stage__evidence-copy">A plausible filing is already on hand. Use it, open it, or keep searching if the issuer still looks off.</p>
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

			<div class="sec-stage__snapshot-grid">
				{#each evidenceSnapshot(cachedFiling) as fact}
					<div class="sec-stage__snapshot-card">
						<span>{fact.label}</span>
						<strong>{fact.value}</strong>
					</div>
				{/each}
			</div>

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

			<details class="sec-stage__detail-panel">
				<summary>See full filing detail</summary>
				<div class="sec-stage__details">
					<div><span>Accession</span><strong>{cachedFiling.accessionNumber || '—'}</strong></div>
					<div><span>First sale</span><strong>{cachedFiling.dateOfFirstSale || '—'}</strong></div>
					<div><span>Exemptions</span><strong>{formatExemptions(cachedFiling.federalExemptions)}</strong></div>
				</div>
				{#if formatPeople(cachedFiling.relatedPeople)}
					<div class="sec-stage__inline-list">
						<span>Related people</span>
						<strong>{formatPeople(cachedFiling.relatedPeople)}</strong>
					</div>
				{/if}
			</details>
		</section>
	{:else if search.hasRun && candidateCount > 0}
		<section class="sec-stage__matches">
			<div class="sec-stage__matches-head">
				<div>
					<div class="sec-stage__card-kicker">Candidate filings</div>
					<strong>{candidateCount} possible match{candidateCount === 1 ? '' : 'es'}</strong>
					<p class="sec-stage__matches-copy">Choose the best match if you see one. Otherwise use a manual resolution and explain why.</p>
				</div>
				{#if queryCount > 0}
					<span class="sec-stage__card-badge">{queryCount} queries run</span>
				{/if}
			</div>

			{#each search.candidates as candidate}
				<div class="sec-stage__candidate">
					<div class="sec-stage__candidate-head">
						<div>
							<div class="sec-stage__candidate-name">{candidate.entityName || 'Unnamed SEC issuer'}</div>
							<div class="sec-stage__candidate-meta">
								<span>{candidate.form || 'D'}</span>
								<span>{candidate.fileDate || 'Unknown filing date'}</span>
								<span>CIK {candidate.cik || '—'}</span>
								<span>{formatSecVerificationConfidence(candidate.matchScore) || 'No confidence score'}</span>
							</div>
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

					<div class="sec-stage__snapshot-grid">
						{#each [
							{ label: 'Filed', value: candidate.fileDate || '—' },
							{ label: 'Jurisdiction', value: candidate.jurisdiction || candidate.issuerState || '—' },
							{ label: 'Minimum', value: formatMoney(candidate.minimumInvestment) },
							{ label: 'Amount sold', value: formatMoney(candidate.totalAmountSold) }
						] as fact}
							<div class="sec-stage__snapshot-card">
								<span>{fact.label}</span>
								<strong>{fact.value}</strong>
							</div>
						{/each}
					</div>

					{#if candidate.reasons?.length > 0 || candidate.discrepancies?.length > 0 || formatPeople(candidate.relatedPeople)}
						<details class="sec-stage__detail-panel">
							<summary>Why this matched</summary>
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
						</details>
					{/if}
				</div>
			{/each}
		</section>
	{:else if search.hasRun}
		<div class="sec-stage__empty">
			No SEC matches were found from the current search context. Review the structured inputs above, run a fresh search, or resolve this manually if the issuer has not filed yet.
		</div>
	{:else}
		<div class="sec-stage__empty">
			Run a filing search once the structured inputs look right. If Form D does not apply, resolve it manually with a short note.
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

	.sec-stage__decision,
	.sec-stage__evidence,
	.sec-stage__candidate {
		display: grid;
		gap: 14px;
		padding: 18px;
		border-radius: 22px;
		border: 1px solid rgba(31, 81, 89, 0.08);
		background: rgba(255, 255, 255, 0.58);
	}

	.sec-stage__decision {
		background:
			linear-gradient(180deg, rgba(255, 255, 255, 0.9), rgba(249, 250, 248, 0.88)),
			radial-gradient(circle at top right, rgba(81, 190, 123, 0.08), transparent 42%);
	}

	.sec-stage__evidence--verified {
		background:
			linear-gradient(180deg, rgba(237, 253, 243, 0.96), rgba(246, 251, 247, 0.94)),
			radial-gradient(circle at top right, rgba(22, 122, 82, 0.12), transparent 46%);
	}

	.sec-stage__decision-header,
	.sec-stage__evidence-head,
	.sec-stage__matches-head,
	.sec-stage__candidate-head {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 16px;
		flex-wrap: wrap;
	}

	.sec-stage__decision-copy {
		display: grid;
		gap: 8px;
		max-width: 56ch;
	}

	.sec-stage__decision-meta {
		display: grid;
		gap: 10px;
		justify-items: start;
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
		font-size: clamp(1.7rem, 2.4vw, 2.1rem);
		line-height: 1.06;
		letter-spacing: -0.03em;
		color: var(--text, #111827);
	}

	.sec-stage__decision-copy p,
	.sec-stage__evidence-copy,
	.sec-stage__matches-copy {
		margin: 0;
		font-size: 14px;
		line-height: 1.6;
		color: var(--text-muted, #5f6c7b);
	}

	.sec-stage__pill {
		display: inline-flex;
		align-items: center;
		justify-content: center;
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

	.sec-stage__microfact,
	.sec-stage__context-chip,
	.sec-stage__snapshot-card,
	.sec-stage__details div {
		display: grid;
		gap: 4px;
		padding: 12px;
		border-radius: 14px;
		background: rgba(247, 249, 247, 0.92);
		font-size: 13px;
	}

	.sec-stage__microfact span,
	.sec-stage__context-chip span,
	.sec-stage__snapshot-card span,
	.sec-stage__details span,
	.sec-stage__inline-list span,
	.sec-stage__warning-item span {
		color: var(--text-muted, #68707a);
	}

	.sec-stage__microfact strong,
	.sec-stage__context-chip strong,
	.sec-stage__snapshot-card strong,
	.sec-stage__details strong,
	.sec-stage__inline-list strong,
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

	.sec-stage__context-strip,
	.sec-stage__snapshot-grid,
	.sec-stage__details {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(126px, 1fr));
		gap: 10px;
	}

	.sec-stage__actions {
		display: flex;
		flex-wrap: wrap;
		gap: 10px;
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
		background: linear-gradient(135deg, #1f5159, #10252a);
		border-color: rgba(31, 81, 89, 0.18);
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
		min-height: 96px;
		padding: 12px 14px;
		border-radius: 14px;
		border: 1px solid color-mix(in srgb, var(--border-color, #d7dadd) 88%, white);
		background: white;
		font: inherit;
		color: var(--text, #111827);
		resize: vertical;
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

	.sec-stage__detail-panel {
		display: grid;
		gap: 12px;
	}

	.sec-stage__detail-panel summary {
		cursor: pointer;
		font-size: 13px;
		font-weight: 700;
		color: var(--text, #111827);
	}

	.sec-stage__chip-list {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
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

	.sec-stage__matches {
		display: grid;
		gap: 12px;
	}

	.sec-stage__candidate-name {
		font-weight: 800;
		font-size: 1.05rem;
	}

	.sec-stage__candidate-meta {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
		margin-top: 8px;
		font-size: 13px;
		color: var(--text-muted, #5f6c7b);
	}

	.sec-stage__candidate-actions,
	.sec-stage__evidence-actions {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
		align-items: center;
	}

	.sec-stage__evidence-head a {
		color: inherit;
		font-size: 13px;
		font-weight: 700;
		text-decoration: none;
	}

	@media (max-width: 900px) {
		.sec-stage__decision-header,
		.sec-stage__evidence-head,
		.sec-stage__matches-head,
		.sec-stage__candidate-head,
		.sec-stage__candidate-actions,
		.sec-stage__evidence-actions {
			flex-direction: column;
			align-items: stretch;
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
