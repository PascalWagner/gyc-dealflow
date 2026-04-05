<script>
	let { entry = null, fieldKey = '', onreset = null } = $props();

	function formatShortDate(iso) {
		if (!iso) return '';
		try {
			const d = new Date(iso);
			return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
		} catch {
			return '';
		}
	}

	const state = $derived(
		!entry
			? 'none'
			: entry.adminOverrideActive
				? 'human'
				: entry.aiValuePresent
					? 'ai'
					: 'none'
	);

	const tooltip = $derived.by(() => {
		if (state === 'human') {
			const name = entry?.adminActorName || entry?.adminActorEmail || 'Admin';
			const date = formatShortDate(entry?.adminEditedAt);
			return date ? `Set by ${name} · ${date}` : `Set by ${name}`;
		}
		if (state === 'ai') {
			const source = entry?.aiSource || 'AI extraction';
			const date = formatShortDate(entry?.aiUpdatedAt);
			return date ? `Extracted from ${source} · ${date}` : `Extracted from ${source}`;
		}
		return '';
	});

	const canReset = $derived(
		state === 'human' && entry?.aiValuePresent === true && typeof onreset === 'function'
	);
</script>

{#if state !== 'none'}
	<span class="field-provenance field-provenance--{state}" title={tooltip} role="status" aria-label={tooltip}>
		{#if state === 'ai'}
			<span class="field-provenance__icon" aria-hidden="true">✦</span>
			<span class="field-provenance__label">AI</span>
		{:else}
			<span class="field-provenance__icon" aria-hidden="true">✎</span>
			<span class="field-provenance__label">Override</span>
		{/if}
		{#if canReset}
			<button
				type="button"
				class="field-provenance__reset"
				title="Reset to extracted value"
				aria-label="Reset {fieldKey} to extracted value"
				onclick={() => onreset(fieldKey)}
			>↩</button>
		{/if}
	</span>
{/if}

<style>
	.field-provenance {
		display: inline-flex;
		align-items: center;
		gap: 3px;
		padding: 2px 7px 2px 5px;
		border-radius: 999px;
		font-family: var(--font-ui);
		font-size: 10px;
		font-weight: 800;
		letter-spacing: 0.4px;
		text-transform: uppercase;
		cursor: default;
		line-height: 1;
		white-space: nowrap;
		flex-shrink: 0;
	}

	.field-provenance--ai {
		background: rgba(81, 190, 123, 0.12);
		color: #167a52;
		border: 1px solid rgba(81, 190, 123, 0.2);
	}

	.field-provenance--human {
		background: rgba(181, 111, 47, 0.1);
		color: #b56f2f;
		border: 1px solid rgba(181, 111, 47, 0.18);
	}

	.field-provenance__icon {
		font-size: 10px;
		line-height: 1;
	}

	.field-provenance__reset {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		margin-left: 2px;
		padding: 0 2px;
		border: none;
		background: transparent;
		cursor: pointer;
		color: inherit;
		font-size: 11px;
		opacity: 0.7;
		line-height: 1;
	}

	.field-provenance__reset:hover {
		opacity: 1;
	}
</style>
