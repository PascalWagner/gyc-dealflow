<script>
	export let title = '';
	export let description = '';
	export let icon = '';
	export let selected = false;
	export let disabled = false;
	export let muted = false;
	export let href = '';
	export let type = 'button';
	export let className = '';
	export let onClick = null;

	const tagName = href ? 'a' : 'button';

	function handleClick(event) {
		if (disabled) {
			event.preventDefault();
			return;
		}
		onClick?.(event);
	}
</script>

<svelte:element
	this={tagName}
	type={tagName === 'button' ? type : undefined}
	href={tagName === 'a' ? href : undefined}
	aria-disabled={disabled}
	class={`ob-select-card ${selected ? 'is-selected' : ''} ${disabled ? 'is-disabled' : ''} ${muted ? 'is-muted' : ''} ${className}`.trim()}
	onclick={handleClick}
>
	<div class="ob-select-card__head" class:has-aside={$$slots.aside}>
		{#if icon || $$slots.icon}
			<div class="ob-select-card__icon">
				<slot name="icon">{icon}</slot>
			</div>
		{/if}
		<div class="ob-select-card__copy">
			{#if title}
				<div class="ob-select-card__title">{title}</div>
			{/if}
			{#if description}
				<div class="ob-select-card__description">{description}</div>
			{/if}
		</div>
		{#if $$slots.aside}
			<div class="ob-select-card__aside">
				<slot name="aside" />
			</div>
		{/if}
	</div>

	{#if $$slots.default}
		<div class="ob-select-card__body">
			<slot />
		</div>
	{/if}

	{#if $$slots.meta}
		<div class="ob-select-card__meta">
			<slot name="meta" />
		</div>
	{/if}
</svelte:element>

<style>
	.ob-select-card {
		display: flex;
		flex-direction: column;
		gap: 10px;
		width: 100%;
		padding: 18px;
		border: 2px solid var(--border, #dde5e8);
		border-radius: 16px;
		background: #fff;
		text-align: left;
		text-decoration: none;
		color: inherit;
		cursor: pointer;
		transition: border-color 0.18s ease, box-shadow 0.18s ease, transform 0.18s ease, background 0.18s ease;
	}

	.ob-select-card:hover {
		border-color: rgba(81, 190, 123, 0.35);
		box-shadow: 0 10px 22px rgba(20, 20, 19, 0.06);
		transform: translateY(-1px);
	}

	.ob-select-card.is-selected {
		border-color: var(--ob-selected-border, rgba(81, 190, 123, 0.92));
		background: var(--ob-selected-bg, rgba(81, 190, 123, 0.06));
	}

	.ob-select-card.is-disabled {
		opacity: 0.45;
		cursor: default;
		transform: none;
		box-shadow: none;
	}

	.ob-select-card.is-muted:not(.is-selected) {
		opacity: 0.5;
	}

	.ob-select-card__head {
		display: flex;
		align-items: flex-start;
		gap: 12px;
	}

	.ob-select-card__head.has-aside {
		justify-content: space-between;
	}

	.ob-select-card__icon {
		font-size: 24px;
		line-height: 1;
		flex-shrink: 0;
	}

	.ob-select-card__copy {
		display: grid;
		gap: 6px;
		min-width: 0;
		flex: 1;
	}

	.ob-select-card__title {
		font-size: 15px;
		font-weight: 800;
		color: var(--text-dark, #141413);
	}

	.ob-select-card__description {
		font-size: 13px;
		line-height: 1.55;
		color: var(--text-secondary, #607179);
	}

	.ob-select-card__body {
		min-width: 0;
	}

	.ob-select-card__aside {
		flex-shrink: 0;
	}

	.ob-select-card__meta {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
	}
</style>
