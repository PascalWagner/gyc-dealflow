<script>
	import {
		buildReviewFieldEvidenceHref,
		formatReviewFieldEvidenceAnchor,
		getReviewFieldEvidenceTone,
		normalizeReviewFieldEvidenceMap
	} from '$lib/utils/reviewFieldEvidence.js';

	let {
		fieldKey = '',
		evidence = [],
		value = '',
		documentUrls = {},
		loading = false
	} = $props();

	const normalizedEvidence = $derived(
		normalizeReviewFieldEvidenceMap({ [fieldKey]: evidence })[fieldKey] || []
	);
	const tone = $derived(getReviewFieldEvidenceTone(normalizedEvidence, value));

	function hasMeaningfulValue(candidate) {
		if (Array.isArray(candidate)) return candidate.length > 0;
		if (candidate && typeof candidate === 'object') return Object.keys(candidate).length > 0;
		return String(candidate || '').trim() !== '';
	}

	function fallbackCopy() {
		if (loading) return 'Looking up source citation from the attached documents...';
		if (hasMeaningfulValue(value)) return 'No supporting citation is saved for this value yet.';
		return 'No source citation is saved for this field yet.';
	}
</script>

<div class={`field-evidence field-evidence--${tone}`}>
	{#if normalizedEvidence.length > 0}
		{#each normalizedEvidence as entry}
			<div class="field-evidence__item">
				<div class="field-evidence__meta">
					<span class="field-evidence__label">
						{entry.sourceType === 'verified'
							? 'Verified'
							: entry.sourceType === 'derived'
								? 'Derived from'
								: entry.sourceType === 'manual_override'
									? 'Reviewer override'
									: 'Source'}
					</span>
					{#if buildReviewFieldEvidenceHref(entry, documentUrls)}
						<a
							class="field-evidence__link"
							href={buildReviewFieldEvidenceHref(entry, documentUrls)}
							target="_blank"
							rel="noopener noreferrer"
						>
							{formatReviewFieldEvidenceAnchor(entry)}
						</a>
					{:else}
						<span class="field-evidence__anchor">{formatReviewFieldEvidenceAnchor(entry)}</span>
					{/if}
					{#if entry.note}
						<span class="field-evidence__note">{entry.note}</span>
					{/if}
				</div>
				{#if entry.snippet}
					<div class="field-evidence__snippet">“{entry.snippet}”</div>
				{/if}
			</div>
		{/each}
	{:else}
		<div class="field-evidence__meta">
			<span class="field-evidence__label">Source</span>
			<span class="field-evidence__fallback">{fallbackCopy()}</span>
		</div>
	{/if}
</div>

<style>
	.field-evidence {
		display: grid;
		gap: 6px;
		margin-top: 2px;
	}

	.field-evidence__item {
		display: grid;
		gap: 4px;
	}

	.field-evidence__meta {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: 6px;
		font-size: 11px;
		line-height: 1.45;
		color: var(--text-muted);
	}

	.field-evidence__label {
		font-family: var(--font-ui);
		font-weight: 800;
		letter-spacing: 0.02em;
		text-transform: uppercase;
	}

	.field-evidence__link,
	.field-evidence__anchor {
		font-weight: 700;
		color: var(--text-secondary);
	}

	.field-evidence__link {
		text-decoration: underline;
		text-decoration-thickness: 1px;
		text-underline-offset: 2px;
	}

	.field-evidence__link:hover {
		color: var(--primary);
	}

	.field-evidence__note,
	.field-evidence__fallback {
		color: var(--text-secondary);
	}

	.field-evidence__snippet {
		font-size: 11px;
		line-height: 1.45;
		color: var(--text-secondary);
	}

	.field-evidence--warning .field-evidence__fallback,
	.field-evidence--warning .field-evidence__label {
		color: #9b5a2d;
	}

	.field-evidence--muted .field-evidence__fallback {
		color: var(--text-muted);
	}
 </style>
