<script>
	export let items = [];
	export let currentPhase = 0;
	export let className = '';

	function tagForItem(item) {
		if (item?.href) return 'a';
		if (item?.onClick) return 'button';
		return 'div';
	}

	function handleClick(item, event) {
		item?.onClick?.(event);
	}
</script>

<div class={`ob-phase-strip ${className}`.trim()}>
	{#each items as item, index}
		<svelte:element
			this={tagForItem(item)}
			class="ob-phase-node"
			class:is-complete={index < currentPhase}
			class:is-active={index === currentPhase}
			href={item?.href}
			type={tagForItem(item) === 'button' ? 'button' : undefined}
			aria-current={index === currentPhase ? 'step' : undefined}
			onclick={(event) => handleClick(item, event)}
		>
			<span class="ob-phase-number">{index + 1}</span>
			<span class="ob-phase-label">{item?.label || ''}</span>
		</svelte:element>
	{/each}
</div>

<style>
	.ob-phase-strip {
		display: flex;
		gap: 10px;
		flex-wrap: wrap;
	}

	.ob-phase-node {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		padding: 10px 12px;
		border: 1px solid var(--border, #dde5e8);
		border-radius: 999px;
		background: #fff;
		color: var(--text-muted, #607179);
		text-decoration: none;
		cursor: pointer;
		transition: border-color 0.18s ease, background 0.18s ease, color 0.18s ease, transform 0.18s ease;
	}

	.ob-phase-node:hover {
		border-color: rgba(81, 190, 123, 0.32);
		color: var(--text-dark, #141413);
		transform: translateY(-1px);
	}

	.ob-phase-node.is-active {
		border-color: rgba(81, 190, 123, 0.4);
		background: rgba(81, 190, 123, 0.08);
		color: var(--text-dark, #141413);
	}

	.ob-phase-node.is-complete {
		border-color: rgba(81, 190, 123, 0.18);
		background: rgba(81, 190, 123, 0.05);
	}

	.ob-phase-number {
		display: inline-flex;
		width: 24px;
		height: 24px;
		align-items: center;
		justify-content: center;
		border-radius: 999px;
		background: var(--border-light, #edf1f2);
		font-size: 12px;
		font-weight: 700;
	}

	.ob-phase-node.is-active .ob-phase-number,
	.ob-phase-node.is-complete .ob-phase-number {
		background: var(--primary, #51be7b);
		color: #fff;
	}

	.ob-phase-label {
		font-size: 12px;
		font-weight: 700;
	}

	@media (max-width: 640px) {
		.ob-phase-strip {
			gap: 8px;
		}

		.ob-phase-node {
			padding: 8px 10px;
		}

		.ob-phase-label {
			font-size: 11px;
		}
	}
</style>
