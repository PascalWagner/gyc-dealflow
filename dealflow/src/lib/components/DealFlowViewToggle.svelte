<script>
	let {
		value = 'grid',
		onchange = () => {},
		className = ''
	} = $props();

	const VIEW_MODES = [
		{ id: 'grid', label: 'Grid', ariaLabel: 'Grid view' },
		{ id: 'compare', label: 'Compare', ariaLabel: 'Compare view' },
		{ id: 'location', label: 'Map', ariaLabel: 'Map view' }
	];

	function selectMode(mode) {
		onchange(mode);
	}
</script>

<div class={`deal-flow-view-toggle ${className}`.trim()} role="group" aria-label="Deal Flow view mode">
	{#each VIEW_MODES as mode}
		<button
			type="button"
			class="view-toggle-btn"
			class:active={value === mode.id}
			aria-label={mode.ariaLabel}
			aria-pressed={value === mode.id}
			title={mode.ariaLabel}
			onclick={() => selectMode(mode.id)}
		>
			<span class="view-toggle-icon" aria-hidden="true">
				{#if mode.id === 'grid'}
					<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
						<rect x="3" y="3" width="7" height="7"></rect>
						<rect x="14" y="3" width="7" height="7"></rect>
						<rect x="3" y="14" width="7" height="7"></rect>
						<rect x="14" y="14" width="7" height="7"></rect>
					</svg>
				{:else if mode.id === 'compare'}
					<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
						<rect x="3" y="5" width="7" height="14" rx="1.5"></rect>
						<rect x="14" y="5" width="7" height="14" rx="1.5"></rect>
						<line x1="12" y1="3.5" x2="12" y2="20.5"></line>
					</svg>
				{:else}
					<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
						<path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
						<circle cx="12" cy="10" r="3"></circle>
					</svg>
				{/if}
			</span>
			<span class="view-toggle-label">{mode.label}</span>
		</button>
	{/each}
</div>

<style>
	.deal-flow-view-toggle {
		display: inline-flex;
		align-items: center;
		gap: 2px;
		padding: 4px;
		border: 1px solid var(--border);
		border-radius: 10px;
		background: var(--bg-card);
		flex-shrink: 0;
	}

	.view-toggle-btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
		min-width: 78px;
		height: 36px;
		padding: 0 14px;
		border: none;
		border-radius: 8px;
		background: none;
		color: var(--text-muted);
		cursor: pointer;
		transition: all 0.15s ease;
		font-family: var(--font-ui);
		font-size: 12px;
		font-weight: 700;
		white-space: nowrap;
	}

	.view-toggle-btn:hover {
		color: var(--text-dark);
	}

	.view-toggle-btn.active {
		background: var(--primary);
		color: #fff;
	}

	.view-toggle-icon {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
	}

	.view-toggle-label {
		display: inline-flex;
		align-items: center;
	}

	@media (max-width: 1023px) {
		.view-toggle-btn {
			min-width: 40px;
			padding-inline: 10px;
			gap: 0;
		}

		.view-toggle-label {
			display: none;
		}
	}
</style>
