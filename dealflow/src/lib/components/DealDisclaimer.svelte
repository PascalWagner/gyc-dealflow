<script>
	let { variant = 'standard' } = $props();
</script>

<div class="disclaimer" class:disclaimer-compact={variant === 'compact'}>
	<div class="disclaimer-icon">
		<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
	</div>
	<div class="disclaimer-content">
		{#if variant === 'compact'}
			<p>GYC Dealflow is a deal navigator — not a broker, advisor, or fiduciary. All data is sourced from sponsors or public filings. Nothing here is investment advice. Do your own due diligence.</p>
		{:else}
			<p class="disclaimer-title">Important Disclosure</p>
			<p>GYC Dealflow is a deal navigation platform — not a broker-dealer, investment advisor, or fiduciary. We do not make recommendations, endorsements, or suitability determinations.</p>
			<p>All deal data is sourced from sponsor-provided materials, SEC filings, and public records. We make reasonable efforts to present accurate information but cannot guarantee completeness or accuracy. Data may be outdated.</p>
			<p>Nothing on this platform constitutes investment advice. All investment decisions are yours alone. Consult your financial advisor, tax professional, and/or attorney before investing.</p>
		{/if}
	</div>
</div>

<style>
	.disclaimer {
		display: flex;
		gap: 12px;
		padding: 16px 20px;
		background: var(--bg-card);
		border: 1px solid var(--border);
		border-radius: var(--radius-md, 10px);
		font-family: var(--font-body);
		font-size: 12px;
		line-height: 1.6;
		color: var(--text-muted);
	}
	.disclaimer-compact {
		padding: 12px 16px;
		font-size: 11px;
	}
	.disclaimer-icon {
		flex-shrink: 0;
		color: var(--text-muted);
		margin-top: 1px;
	}
	.disclaimer-content {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}
	.disclaimer-content p {
		margin: 0;
	}
	.disclaimer-title {
		font-family: var(--font-ui);
		font-weight: 700;
		font-size: 12px;
		color: var(--text-secondary);
	}
</style>
