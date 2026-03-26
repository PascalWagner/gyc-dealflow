<script>
	export let title = '';
	export let subtitle = '';
	export let variant = 'standard';
	export let className = '';
	export let secondaryClass = '';
</script>

<header class={`ly-page-header ${className}`.trim()} data-variant={variant}>
	<div class="ly-page-header-main">
		<div class="ly-page-header-copy">
			<h1 class="ly-page-header-title">{title}</h1>
			{#if subtitle}
				<p class="ly-page-header-subtitle">{subtitle}</p>
			{/if}
		</div>

		{#if $$slots.actions}
			<div class="ly-page-header-actions">
				<slot name="actions" />
			</div>
		{/if}
	</div>

	{#if $$slots.secondaryRow}
		<div class={`ly-page-header-secondary ${secondaryClass}`.trim()}>
			<slot name="secondaryRow" />
		</div>
	{/if}
</header>
