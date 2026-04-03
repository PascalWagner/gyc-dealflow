<script>
	let {
		label = 'Coming Soon',
		description = '',
		children
	} = $props();
</script>

<div class="coming-soon-wrapper">
	<div class="coming-soon-blur">
		{@render children()}
	</div>
	<div class="coming-soon-badge">
		<div class="coming-soon-badge-label">{label}</div>
		{#if description}
			<div class="coming-soon-badge-desc">{description}</div>
		{/if}
	</div>
</div>

<style>
	.coming-soon-wrapper {
		position: relative;
		min-height: 120px;
	}
	.coming-soon-blur {
		filter: blur(3px);
		opacity: 0.25;
		pointer-events: none;
		user-select: none;
	}
	.coming-soon-badge {
		position: absolute;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		z-index: 5;
		text-align: center;
		padding: 24px 40px;
		background: rgba(255, 255, 255, 0.95);
		border-radius: 12px;
		border: 1px solid var(--border);
		box-shadow: 0 4px 24px rgba(0, 0, 0, 0.08);
	}
	.coming-soon-badge-label {
		font-family: var(--font-ui);
		font-size: 18px;
		font-weight: 800;
		color: var(--text-dark);
		margin-bottom: 6px;
	}
	.coming-soon-badge-desc {
		font-family: var(--font-body);
		font-size: 13px;
		color: var(--text-secondary);
		max-width: 280px;
		line-height: 1.5;
	}
	:global(html.dark) .coming-soon-badge {
		background: rgba(30, 30, 30, 0.95);
	}
</style>
