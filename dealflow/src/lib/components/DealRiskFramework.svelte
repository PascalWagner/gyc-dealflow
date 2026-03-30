<script>
	let { risks = [], compensations = [], gaps = [], isPaid = false, nativeCompanionMode = false, academyHref = '/app/academy' } = $props();

	let activeTab = $state('risks');
</script>

<div class="risk-framework">
	<div class="rf-tabs">
		<button class="rf-tab" class:active={activeTab === 'risks'} onclick={() => activeTab = 'risks'}>
			<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
			Risks ({risks.length})
		</button>
		<button class="rf-tab" class:active={activeTab === 'compensation'} onclick={() => activeTab = 'compensation'}>
			<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M12 1v22"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
			Compensation ({compensations.length})
		</button>
		<button class="rf-tab" class:active={activeTab === 'gaps'} onclick={() => activeTab = 'gaps'}>
			<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
			Gaps ({gaps.length})
		</button>
	</div>

	{#if !isPaid}
		<div class="rf-gate">
			<div class="rf-gate-icon">
				<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
			</div>
			<div class="rf-gate-text">
				{#if nativeCompanionMode}
					Risk analysis available to members on web.
				{:else}
					Members unlock the full risk/compensation/gaps framework for every deal.
				{/if}
			</div>
			{#if !nativeCompanionMode}
				<a href={academyHref} class="rf-gate-cta">Become a Member</a>
			{/if}
		</div>
	{:else}
		<div class="rf-content">
			{#if activeTab === 'risks'}
				{#if risks.length > 0}
					<div class="rf-list">
						{#each risks as risk}
							<div class="rf-item rf-item-risk">
								<div class="rf-item-dot risk-dot"></div>
								<div class="rf-item-body">
									<div class="rf-item-label">{risk.label}</div>
									<div class="rf-item-detail">{risk.detail}</div>
								</div>
							</div>
						{/each}
					</div>
				{:else}
					<div class="rf-empty">No specific risks identified from available data.</div>
				{/if}

			{:else if activeTab === 'compensation'}
				{#if compensations.length > 0}
					<div class="rf-list">
						{#each compensations as comp}
							<div class="rf-item rf-item-comp">
								<div class="rf-item-dot comp-dot"></div>
								<div class="rf-item-body">
									<div class="rf-item-label">{comp.label} <span class="rf-item-value">{comp.value}</span></div>
									<div class="rf-item-detail">{comp.detail}</div>
								</div>
							</div>
						{/each}
					</div>
				{:else}
					<div class="rf-empty">No compensation metrics are available for this deal.</div>
				{/if}

			{:else if activeTab === 'gaps'}
				{#if gaps.length > 0}
					<div class="rf-list">
						{#each gaps as gap}
							<div class="rf-item rf-item-gap">
								<div class="rf-item-dot gap-dot"></div>
								<div class="rf-item-body">
									<div class="rf-item-label">{gap.label}</div>
									<div class="rf-item-detail">This field has not been provided by the sponsor or found in public filings.</div>
								</div>
							</div>
						{/each}
					</div>
				{:else}
					<div class="rf-empty">All critical data fields are present for this deal.</div>
				{/if}
			{/if}
		</div>
	{/if}
</div>

<style>
	.risk-framework {
		background: var(--bg-card);
		border-radius: var(--radius-md, 10px);
	}
	.rf-tabs {
		display: flex;
		gap: 2px;
		padding: 4px;
		background: var(--border-light);
		border-radius: var(--radius-sm, 6px);
		margin-bottom: 16px;
	}
	.rf-tab {
		flex: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 6px;
		padding: 8px 12px;
		border: none;
		background: transparent;
		border-radius: calc(var(--radius-sm, 6px) - 2px);
		font-family: var(--font-ui);
		font-size: 12px;
		font-weight: 600;
		color: var(--text-muted);
		cursor: pointer;
		transition: all 0.15s;
		white-space: nowrap;
	}
	.rf-tab.active {
		background: var(--bg-card);
		color: var(--text-dark);
		box-shadow: var(--shadow-sm);
	}
	.rf-tab:hover:not(.active) {
		color: var(--text-secondary);
	}
	.rf-gate {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 10px;
		padding: 24px 16px;
		text-align: center;
	}
	.rf-gate-icon {
		color: var(--text-muted);
	}
	.rf-gate-text {
		font-family: var(--font-ui);
		font-size: 13px;
		color: var(--text-secondary);
	}
	.rf-gate-cta {
		display: inline-block;
		padding: 8px 20px;
		background: var(--primary);
		color: #fff;
		border-radius: var(--radius-sm, 6px);
		font-family: var(--font-ui);
		font-size: 13px;
		font-weight: 700;
		text-decoration: none;
	}
	.rf-gate-cta:hover {
		background: var(--primary-hover);
	}
	.rf-content {
		min-height: 60px;
	}
	.rf-list {
		display: flex;
		flex-direction: column;
		gap: 12px;
	}
	.rf-item {
		display: flex;
		gap: 12px;
		align-items: flex-start;
	}
	.rf-item-dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		margin-top: 6px;
		flex-shrink: 0;
	}
	.risk-dot { background: #f59e0b; }
	.comp-dot { background: var(--primary); }
	.gap-dot { background: var(--text-muted); }
	.rf-item-body {
		flex: 1;
		min-width: 0;
	}
	.rf-item-label {
		font-family: var(--font-ui);
		font-size: 13px;
		font-weight: 600;
		color: var(--text-dark);
		margin-bottom: 2px;
	}
	.rf-item-value {
		color: var(--primary);
		font-weight: 700;
	}
	.rf-item-detail {
		font-family: var(--font-body);
		font-size: 12px;
		color: var(--text-secondary);
		line-height: 1.5;
	}
	.rf-empty {
		text-align: center;
		font-family: var(--font-ui);
		font-size: 13px;
		color: var(--text-muted);
		padding: 20px 16px;
	}

	@media (max-width: 600px) {
		.rf-tab {
			font-size: 11px;
			padding: 7px 8px;
			gap: 4px;
		}
		.rf-tab svg {
			display: none;
		}
	}
</style>
