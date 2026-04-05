<script>
	import { getContext } from 'svelte';
	import FieldEvidence from '$lib/components/deal-review/FieldEvidence.svelte';
	import FieldProvenance from '$lib/components/deal-review/FieldProvenance.svelte';
	import {
		COUNTRY_OPTIONS,
		formatDealReviewFieldDisplay,
		STATE_OPTIONS
	} from '$lib/utils/dealReviewSchema.js';

	let {
		field,
		value,
		error = '',
		warning = '',
		evidence = [],
		documentUrls = {},
		evidenceLoading = false,
		onupdate = () => {},
		onaction = null
	} = $props();

	// Read provenance data from deal-review page context (set once per review session).
	// Returns null safely when used outside the deal-review context.
	const _provenanceCtx = getContext('deal-review-provenance');
	const provenanceEntry = $derived(_provenanceCtx?.reviewFieldState?.[field?.key] ?? null);

	let sponsorResults = $state([]);
	let sponsorLoading = $state(false);
	let sponsorOpen = $state(false);
	let sponsorSearchError = $state(null);
	let sponsorSearchDone = $state(false);
	let sponsorBlurTimer = $state(null);
	let sponsorSearchTimer = $state(null);
	let tagDraft = $state('');

	function emit(value) {
		onupdate(value);
	}

	function formatOnBlur() {
		if (!field || !['currency', 'percentage', 'number'].includes(field.type)) return;
		emit(formatDealReviewFieldDisplay(field.key, value));
	}

	async function runSponsorSearch(query) {
		const trimmed = String(query || '').trim();
		if (trimmed.length < 2) {
			sponsorResults = [];
			sponsorSearchError = null;
			sponsorSearchDone = false;
			sponsorLoading = false;
			return;
		}

		sponsorSearchError = null;
		sponsorLoading = true;
		try {
			const response = await fetch(`/api/company-search?q=${encodeURIComponent(trimmed)}`);
			if (!response.ok) {
				throw new Error(`Search failed (${response.status})`);
			}
			const payload = await response.json().catch(() => ({}));
			sponsorResults = Array.isArray(payload?.results) ? payload.results : [];
		} catch {
			sponsorResults = [];
			sponsorSearchError = 'Sponsor search unavailable — enter manually or try again';
		} finally {
			sponsorLoading = false;
			sponsorSearchDone = true;
		}
	}

	function queueSponsorSearch(query) {
		if (sponsorSearchTimer) clearTimeout(sponsorSearchTimer);
		sponsorOpen = true;
		sponsorSearchTimer = setTimeout(() => {
			void runSponsorSearch(query);
		}, 180);
	}

	function updateSponsorName(nextName) {
		emit({
			id: '',
			name: nextName,
			createIfMissing: false
		});
		queueSponsorSearch(nextName);
	}

	function selectSponsor(result) {
		sponsorResults = [];
		sponsorOpen = false;
		emit({
			id: result?.id || '',
			name: result?.operator_name || result?.name || '',
			createIfMissing: false
		});
	}

	function createSponsor() {
		const nextName = String(value?.name || '').trim();
		if (!nextName) return;
		sponsorResults = [];
		sponsorOpen = false;
		emit({
			id: '',
			name: nextName,
			createIfMissing: true
		});
	}

	function sponsorLabel(result) {
		const name = result?.operator_name || result?.name || 'Unknown sponsor';
		const detail = [result?.type, Array.isArray(result?.asset_classes) ? result.asset_classes[0] : '']
			.filter(Boolean)
			.join(' · ');
		return detail ? `${name} — ${detail}` : name;
	}

	function closeSponsorMenuSoon() {
		if (sponsorBlurTimer) clearTimeout(sponsorBlurTimer);
		sponsorBlurTimer = setTimeout(() => {
			sponsorOpen = false;
		}, 140);
	}

	function cancelSponsorBlur() {
		if (sponsorBlurTimer) clearTimeout(sponsorBlurTimer);
	}

	function commitTagDraft() {
		const trimmed = String(tagDraft || '').trim();
		if (!trimmed) return;
		const next = Array.isArray(value) ? [...value] : [];
		if (!next.includes(trimmed)) next.push(trimmed);
		tagDraft = '';
		emit(next);
	}

	function removeTag(tag) {
		emit((Array.isArray(value) ? value : []).filter((item) => item !== tag));
	}

	function handleTagKeydown(event) {
		if (event.key === 'Enter' || event.key === ',') {
			event.preventDefault();
			commitTagDraft();
		} else if (event.key === 'Backspace' && !tagDraft && Array.isArray(value) && value.length > 0) {
			removeTag(value[value.length - 1]);
		}
	}

	function updateLocation(part, nextValue) {
		emit({
			city: value?.city || '',
			state: value?.state || '',
			country: value?.country || 'United States',
			[part]: nextValue
		});
	}

	const hasFieldError = $derived(Boolean(error));
	const hasFieldWarning = $derived(Boolean(warning));
	const sponsorName = $derived(String(value?.name || '').trim());
	const sponsorExactMatch = $derived(
		sponsorResults.some(
			(result) => String(result?.operator_name || result?.name || '').trim().toLowerCase() === sponsorName.toLowerCase()
		)
	);
	const showCreateSponsor = $derived(
		field?.type === 'entity_reference' && sponsorName.length >= 2 && !sponsorExactMatch && !value?.id
	);
</script>

{#if field?.type === 'entity_reference'}
	<div class:field--span-2={field?.span === 2} class="field entity-field">
		<span class="field-label-row">{field.label}<FieldProvenance entry={provenanceEntry} fieldKey={field?.key || ''} onreset={_provenanceCtx?.onreset} /></span>
		<div class="entity-shell" onfocusin={cancelSponsorBlur} onfocusout={closeSponsorMenuSoon}>
			<input
				type="text"
				value={value?.name || ''}
				placeholder="Search sponsors..."
				autocomplete="off"
				aria-invalid={hasFieldError}
				onfocus={() => {
					sponsorOpen = true;
					queueSponsorSearch(value?.name || '');
				}}
				oninput={(event) => updateSponsorName(event.currentTarget.value)}
			>
			{#if value?.id}
				<div class="field-meta field-meta--success">Linked to sponsor record</div>
			{:else if value?.createIfMissing}
				<div class="field-meta field-meta--info">Will create a new sponsor record on save</div>
			{/if}

			{#if sponsorSearchError}
				<div class="field-meta field-meta--search-error">{sponsorSearchError}</div>
			{:else if sponsorSearchDone && !sponsorLoading && sponsorResults.length === 0 && !showCreateSponsor}
				<div class="field-meta field-meta--search-empty">No results found</div>
			{/if}

			{#if sponsorOpen && (sponsorLoading || sponsorResults.length > 0 || showCreateSponsor)}
				<div class="entity-menu">
					{#if sponsorLoading}
						<div class="entity-empty">Searching sponsors...</div>
					{:else}
						{#each sponsorResults as result}
							<button type="button" class="entity-option" onclick={() => selectSponsor(result)}>
								{sponsorLabel(result)}
							</button>
						{/each}
						{#if showCreateSponsor}
							<button type="button" class="entity-option entity-option--create" onclick={createSponsor}>
								Create new sponsor: {sponsorName}
							</button>
						{/if}
					{/if}
				</div>
			{/if}
		</div>
		{#if field.helperText}
			<div class="field-helper">{field.helperText}</div>
		{/if}
		<FieldEvidence fieldKey={field?.key} evidence={evidence} value={value} documentUrls={documentUrls} loading={evidenceLoading} />
		{#if error}
			<div class="field-feedback field-feedback--error">{error}</div>
		{:else if warning}
			<div class="field-feedback field-feedback--warning">{warning}</div>
		{/if}
	</div>
{:else if field?.type === 'location'}
	<div class:field--span-2={field?.span === 2} class="field">
		<span class="field-label-row">{field.label}<FieldProvenance entry={provenanceEntry} fieldKey={field?.key || ''} onreset={_provenanceCtx?.onreset} /></span>
		<div class="location-grid">
			<input
				type="text"
				value={value?.city || ''}
				placeholder="City or market"
				oninput={(event) => updateLocation('city', event.currentTarget.value)}
			>
			<div class="location-subfield">
				<input
					list={`state-options-${field.key}`}
					value={value?.state || ''}
					placeholder="State"
					maxlength="2"
					oninput={(event) => updateLocation('state', event.currentTarget.value.toUpperCase())}
				>
				<datalist id={`state-options-${field.key}`}>
					{#each STATE_OPTIONS as state}
						<option value={state}></option>
					{/each}
				</datalist>
			</div>
			<select value={value?.country || 'United States'} onchange={(event) => updateLocation('country', event.currentTarget.value)}>
				{#each COUNTRY_OPTIONS as option}
					<option value={option}>{option}</option>
				{/each}
			</select>
		</div>
		{#if field.helperText}
			<div class="field-helper">{field.helperText}</div>
		{/if}
		<FieldEvidence fieldKey={field?.key} evidence={evidence} value={value} documentUrls={documentUrls} loading={evidenceLoading} />
		{#if error}
			<div class="field-feedback field-feedback--error">{error}</div>
		{:else if warning}
			<div class="field-feedback field-feedback--warning">{warning}</div>
		{/if}
	</div>
{:else if field?.type === 'multi_select'}
	<div class:field--span-2={field?.span === 2} class="field">
		<span class="field-label-row">{field.label}<FieldProvenance entry={provenanceEntry} fieldKey={field?.key || ''} onreset={_provenanceCtx?.onreset} /></span>
		<div class="tags-shell" aria-invalid={hasFieldError}>
			<div class="tag-list">
				{#each Array.isArray(value) ? value : [] as tag}
					<button type="button" class="tag-chip" onclick={() => removeTag(tag)}>
						{tag}
						<span aria-hidden="true">×</span>
					</button>
				{/each}
				<input
					type="text"
					bind:value={tagDraft}
					placeholder="Press Enter to add a tag"
					onkeydown={handleTagKeydown}
					onblur={commitTagDraft}
				>
			</div>
		</div>
		{#if field.helperText}
			<div class="field-helper">{field.helperText}</div>
		{/if}
		<FieldEvidence fieldKey={field?.key} evidence={evidence} value={value} documentUrls={documentUrls} loading={evidenceLoading} />
		{#if error}
			<div class="field-feedback field-feedback--error">{error}</div>
		{:else if warning}
			<div class="field-feedback field-feedback--warning">{warning}</div>
		{/if}
	</div>
{:else if field?.type === 'string_enum' && field?.searchable}
	<label class:field--span-2={field?.span === 2} class="field">
		<span class="field-label-row">{field.label}<FieldProvenance entry={provenanceEntry} fieldKey={field?.key || ''} onreset={_provenanceCtx?.onreset} /></span>
		<input
			list={`deal-review-options-${field.key}`}
			value={value || ''}
			placeholder={field.placeholder || ''}
			aria-invalid={hasFieldError}
			oninput={(event) => emit(event.currentTarget.value)}
		>
		<datalist id={`deal-review-options-${field.key}`}>
			{#each field.options || [] as option}
				<option value={option}></option>
			{/each}
		</datalist>
		{#if field.helperText}
			<div class="field-helper">{field.helperText}</div>
		{/if}
		<FieldEvidence fieldKey={field?.key} evidence={evidence} value={value} documentUrls={documentUrls} loading={evidenceLoading} />
		{#if error}
			<div class="field-feedback field-feedback--error">{error}</div>
		{:else if warning}
			<div class="field-feedback field-feedback--warning">{warning}</div>
		{/if}
	</label>
{:else if field?.type === 'string_enum'}
	<label class:field--span-2={field?.span === 2} class="field">
		<span class="field-label-row">{field.label}<FieldProvenance entry={provenanceEntry} fieldKey={field?.key || ''} onreset={_provenanceCtx?.onreset} /></span>
		<select value={value || ''} aria-invalid={hasFieldError} onchange={(event) => emit(event.currentTarget.value)}>
			<option value="">{field.placeholder || `Select ${field.label}`}</option>
			{#each field.options || [] as option}
				<option value={option}>{option}</option>
			{/each}
		</select>
		{#if field.helperText}
			<div class="field-helper">{field.helperText}</div>
		{/if}
		<FieldEvidence fieldKey={field?.key} evidence={evidence} value={value} documentUrls={documentUrls} loading={evidenceLoading} />
		{#if error}
			<div class="field-feedback field-feedback--error">{error}</div>
		{:else if warning}
			<div class="field-feedback field-feedback--warning">{warning}</div>
		{/if}
	</label>
{:else if field?.input === 'textarea'}
	<label class:field--span-2={field?.span === 2} class="field">
		<span class="field-label-row">{field.label}<FieldProvenance entry={provenanceEntry} fieldKey={field?.key || ''} onreset={_provenanceCtx?.onreset} /></span>
		<textarea
			rows={field.rows || 3}
			value={value || ''}
			placeholder={field.placeholder || ''}
			aria-invalid={hasFieldError}
			oninput={(event) => emit(event.currentTarget.value)}
		></textarea>
		{#if field.helperText}
			<div class="field-helper">{field.helperText}</div>
		{/if}
		<FieldEvidence fieldKey={field?.key} evidence={evidence} value={value} documentUrls={documentUrls} loading={evidenceLoading} />
		{#if error}
			<div class="field-feedback field-feedback--error">{error}</div>
		{:else if warning}
			<div class="field-feedback field-feedback--warning">{warning}</div>
		{/if}
	</label>
{:else}
	<label class:field--span-2={field?.span === 2} class="field">
		<span class="field-label-row">
			<span>{field.label}<FieldProvenance entry={provenanceEntry} fieldKey={field?.key || ''} onreset={_provenanceCtx?.onreset} /></span>
			{#if field?.actionLabel && onaction}
				<button type="button" class="inline-btn" onclick={onaction}>{field.actionLabel}</button>
			{/if}
		</span>
		<input
			type={field?.input === 'url' ? 'url' : field?.input === 'date' ? 'date' : field?.input === 'number' ? 'number' : 'text'}
			inputmode={field?.type === 'currency' || field?.type === 'percentage' || field?.type === 'number' ? 'decimal' : 'text'}
			value={value || ''}
			placeholder={field.placeholder || ''}
			min={field?.min ?? undefined}
			max={field?.max ?? undefined}
			step={field?.step ?? undefined}
			aria-invalid={hasFieldError}
			oninput={(event) => emit(event.currentTarget.value)}
			onblur={formatOnBlur}
		>
		{#if field.helperText}
			<div class="field-helper">{field.helperText}</div>
		{/if}
		<FieldEvidence fieldKey={field?.key} evidence={evidence} value={value} documentUrls={documentUrls} loading={evidenceLoading} />
		{#if error}
			<div class="field-feedback field-feedback--error">{error}</div>
		{:else if warning}
			<div class="field-feedback field-feedback--warning">{warning}</div>
		{/if}
	</label>
{/if}

<style>
	.field {
		display: flex;
		flex-direction: column;
		gap: 6px;
		min-width: 0;
	}

	.field--span-2 {
		grid-column: 1 / -1;
	}

	.field span {
		font-family: var(--font-ui);
		font-size: 11px;
		font-weight: 800;
		letter-spacing: 0.8px;
		text-transform: uppercase;
		color: var(--text-muted);
	}

	.field input,
	.field textarea,
	.field select {
		width: 100%;
		padding: 11px 12px;
		border-radius: 12px;
		border: 1px solid rgba(31, 81, 89, 0.12);
		background: rgba(255, 255, 255, 0.92);
		color: var(--text-dark);
		font-family: var(--font-body);
		font-size: 14px;
		line-height: 1.45;
		outline: none;
		transition: border-color 0.16s ease, box-shadow 0.16s ease;
	}

	.field input:focus,
	.field textarea:focus,
	.field select:focus {
		border-color: rgba(31, 81, 89, 0.34);
		box-shadow: 0 0 0 3px rgba(81, 190, 123, 0.12);
	}

	.field textarea {
		resize: vertical;
		min-height: 96px;
	}

	.field-label-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 6px;
	}

	.field-label-row > span {
		display: inline-flex;
		align-items: center;
		gap: 6px;
	}

	.inline-btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		padding: 6px 10px;
		border-radius: 12px;
		border: 1px solid rgba(31, 81, 89, 0.14);
		background: rgba(255, 255, 255, 0.9);
		color: var(--text-dark);
		font-family: var(--font-ui);
		font-size: 11px;
		font-weight: 800;
		cursor: pointer;
	}

	.field-helper {
		font-size: 12px;
		line-height: 1.45;
		color: var(--text-muted);
	}

	.field-feedback {
		font-size: 12px;
		font-weight: 600;
		line-height: 1.45;
	}

	.field-feedback--error {
		color: #b42328;
	}

	.field-feedback--warning {
		color: #b56f2f;
	}

	.field-meta {
		font-size: 12px;
		font-weight: 600;
	}

	.field-meta--success {
		color: #167a52;
	}

	.field-meta--info {
		color: #1f5159;
	}

	.field-meta--search-error {
		color: #9a6c00;
	}

	.field-meta--search-empty {
		color: var(--text-muted, #789);
	}

	.location-grid {
		display: grid;
		grid-template-columns: minmax(0, 1.4fr) minmax(90px, 110px) minmax(150px, 1fr);
		gap: 10px;
	}

	.tags-shell {
		padding: 8px 10px;
		border-radius: 12px;
		border: 1px solid rgba(31, 81, 89, 0.12);
		background: rgba(255, 255, 255, 0.92);
	}

	.tag-list {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
		align-items: center;
	}

	.tag-list input {
		border: none;
		background: transparent;
		box-shadow: none;
		padding: 4px 0;
		min-width: 180px;
		flex: 1 1 180px;
	}

	.tag-chip {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		padding: 6px 10px;
		border-radius: 999px;
		border: none;
		background: rgba(81, 190, 123, 0.12);
		color: #167a52;
		font-size: 12px;
		font-weight: 700;
		cursor: pointer;
	}

	.entity-shell {
		position: relative;
	}

	.entity-menu {
		position: absolute;
		top: calc(100% + 6px);
		left: 0;
		right: 0;
		z-index: 10;
		display: flex;
		flex-direction: column;
		gap: 4px;
		padding: 8px;
		border-radius: 14px;
		border: 1px solid rgba(31, 81, 89, 0.12);
		background: rgba(255, 255, 255, 0.98);
		box-shadow: 0 18px 30px rgba(16, 37, 42, 0.14);
	}

	.entity-option,
	.entity-empty {
		padding: 10px 12px;
		border-radius: 10px;
		font-size: 13px;
		line-height: 1.45;
		text-align: left;
	}

	.entity-option {
		border: none;
		background: transparent;
		cursor: pointer;
		color: var(--text-dark);
	}

	.entity-option:hover {
		background: rgba(31, 81, 89, 0.06);
	}

	.entity-option--create {
		color: #167a52;
		font-weight: 700;
	}

	.entity-empty {
		color: var(--text-muted);
	}

	@media (max-width: 720px) {
		.field--span-2 {
			grid-column: auto;
		}

		.location-grid {
			grid-template-columns: 1fr;
		}
	}
</style>
