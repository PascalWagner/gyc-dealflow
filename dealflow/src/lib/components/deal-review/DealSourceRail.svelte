<script>
	let {
		deckUrl = '',
		ppmUrl = '',
		subAgreementUrl = '',
		extractionState = 'idle'
	} = $props();

	function getDocumentName(url, fallbackLabel) {
		const trimmed = String(url || '').trim();
		if (!trimmed) return fallbackLabel;
		try {
			const parsed = new URL(trimmed);
			return decodeURIComponent(parsed.pathname.split('/').pop() || '') || fallbackLabel;
		} catch {
			return fallbackLabel;
		}
	}

	const items = $derived(
		[
			{ label: 'Deck', url: deckUrl, fallback: 'Investment Deck' },
			{ label: 'PPM', url: ppmUrl, fallback: 'Private Placement Memorandum' },
			{ label: 'Sub Docs', url: subAgreementUrl, fallback: 'Subscription Documents' }
		].filter((item) => String(item.url || '').trim())
	);
</script>

<section class="source-rail">
	<div class="source-rail__eyebrow">Source Documents</div>
	{#if items.length > 0}
		<div class="source-rail__list">
			{#each items as item}
				<a href={item.url} target="_blank" rel="noopener" class="source-link">
					<span class="source-link__label">{item.label}</span>
					<strong>{getDocumentName(item.url, item.fallback)}</strong>
				</a>
			{/each}
		</div>
	{:else}
		<p class="source-rail__empty">No source documents are attached yet.</p>
	{/if}

	{#if extractionState !== 'idle'}
		<div class="source-rail__status" class:is-error={extractionState === 'error'}>
			{#if extractionState === 'running'}
				Extraction is running from the attached source files.
			{:else if extractionState === 'error'}
				Extraction needs attention. Check the stage details before publishing.
			{:else}
				Extraction results are available below for review.
			{/if}
		</div>
	{/if}
</section>

<style>
	.source-rail {
		display: grid;
		gap: 10px;
		padding: 18px;
		border-radius: 24px;
		background:
			linear-gradient(180deg, rgba(252, 251, 247, 0.98), rgba(245, 246, 241, 0.98)),
			radial-gradient(circle at top right, rgba(81, 190, 123, 0.08), transparent 44%);
		border: 1px solid rgba(31, 81, 89, 0.09);
		box-shadow: 0 14px 30px rgba(16, 37, 42, 0.04);
	}

	.source-rail__eyebrow {
		font-family: var(--font-ui);
		font-size: 11px;
		font-weight: 800;
		letter-spacing: 0.8px;
		text-transform: uppercase;
		color: var(--text-muted);
	}

	.source-rail__list {
		display: grid;
		gap: 8px;
	}

	.source-link {
		display: grid;
		gap: 4px;
		padding: 11px 12px;
		border-radius: 14px;
		background: rgba(255, 255, 255, 0.46);
		border: 1px solid rgba(31, 81, 89, 0.07);
		text-decoration: none;
		color: inherit;
		transition: transform 0.16s ease, background 0.16s ease, border-color 0.16s ease;
	}

	.source-link:hover {
		transform: translateY(-1px);
		background: rgba(255, 255, 255, 0.74);
		border-color: rgba(81, 190, 123, 0.22);
	}

	.source-link__label {
		font-family: var(--font-ui);
		font-size: 10px;
		font-weight: 800;
		letter-spacing: 0.7px;
		text-transform: uppercase;
		color: var(--text-muted);
	}

	.source-link strong {
		font-size: 12px;
		line-height: 1.45;
		color: var(--primary);
		word-break: break-word;
	}

	.source-rail__empty,
	.source-rail__status {
		margin: 0;
		font-size: 13px;
		line-height: 1.5;
		color: var(--text-secondary);
	}

	.source-rail__status {
		padding: 12px;
		border-radius: 14px;
		background: rgba(81, 190, 123, 0.08);
		color: #165c47;
	}

	.source-rail__status.is-error {
		background: rgba(180, 35, 40, 0.08);
		color: #8c2328;
	}
</style>
