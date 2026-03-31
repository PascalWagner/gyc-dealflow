<script>
	import { buildRiskSourceValidationModel } from '$lib/utils/dealReviewRiskSourceValidation.js';

	let {
		deal = null,
		backgroundCheck = null,
		title = 'Risk / Source Validation',
		description = 'Review the actual source set and structured risk evidence before moving the deal forward.'
	} = $props();

	const model = $derived(buildRiskSourceValidationModel(deal, backgroundCheck));

	function resolveFindingSources(finding) {
		return (finding?.sourceKeys || [])
			.map((key) => model.sourceIndex?.[key])
			.filter(Boolean);
	}

	function formatReadinessClass(readiness) {
		switch (readiness) {
			case 'ready':
				return 'status--ready';
			case 'partial':
				return 'status--partial';
			default:
				return 'status--missing';
		}
	}

	function formatSeverityClass(severity) {
		switch (severity) {
			case 'high':
				return 'severity--high';
			case 'medium':
				return 'severity--medium';
			default:
				return 'severity--low';
		}
	}
</script>

<section class="risk-stage">
	<div class="stage-header">
		<div>
			<div class="stage-kicker">Risk stage</div>
			<h2>{title}</h2>
			<p>{description}</p>
		</div>
		<div class={`stage-status ${formatReadinessClass(model.readiness)}`}>
			<span>{model.readinessLabel}</span>
		</div>
	</div>

	<div class="stage-summary">
		<div class="summary-card">
			<span class="summary-label">Source docs</span>
			<strong>{model.counts.sourceDocuments}</strong>
		</div>
		<div class="summary-card">
			<span class="summary-label">External checks</span>
			<strong>{model.counts.backgroundChecks}</strong>
		</div>
		<div class="summary-card">
			<span class="summary-label">Structured findings</span>
			<strong>{model.counts.findings}</strong>
		</div>
		<div class="summary-card">
			<span class="summary-label">Coverage gaps</span>
			<strong>{model.counts.missingCoverage}</strong>
		</div>
	</div>

	<p class="stage-summary-text">{model.summary}</p>

	<div class="stage-grid">
		<section class="stage-panel">
			<div class="panel-header">
				<h3>Source set</h3>
				<span>{model.counts.sourceDocuments + model.counts.backgroundChecks} items</span>
			</div>

			{#if model.sourceDocuments.length > 0}
				<div class="source-group">
					<div class="source-group-title">Deal documents</div>
					<div class="source-list">
						{#each model.sourceDocuments as source}
							<a class="source-card" href={source.url} target="_blank" rel="noopener">
								<div class="source-card-top">
									<span class="source-label">{source.label}</span>
									<span class="source-link">Open</span>
								</div>
								<div class="source-url">{source.url}</div>
								{#if source.context}
									<div class="source-context">{source.context}</div>
								{/if}
							</a>
						{/each}
					</div>
				</div>
			{/if}

			{#if model.backgroundChecks.length > 0}
				<div class="source-group">
					<div class="source-group-title">Third-party verification</div>
					<div class="verification-list">
						{#each model.backgroundChecks as check}
							<div class="verification-card">
								<div class="verification-top">
									<div>
										<div class="source-label">{check.label}</div>
										{#if check.searchedName}
											<div class="verification-searched">Searched: {check.searchedName}</div>
										{/if}
									</div>
									<span class={`verification-status ${formatReadinessClass(check.status === 'clear' ? 'ready' : (check.status === 'pending' ? 'missing' : 'partial'))}`}>
										{check.statusLabel}
									</span>
								</div>
								{#if check.detail}
									<div class="verification-detail">{check.detail}</div>
								{/if}
								{#if check.url}
									<a class="verification-link" href={check.url} target="_blank" rel="noopener">Verify externally</a>
								{/if}
							</div>
						{/each}
					</div>
				</div>
			{/if}

			{#if model.sourceDocuments.length === 0 && model.backgroundChecks.length === 0}
				<div class="empty-state">
					No deck, PPM, primary source URL, or background-check evidence is attached yet.
				</div>
			{/if}
		</section>

		<section class="stage-panel">
			<div class="panel-header">
				<h3>Coverage gaps</h3>
				<span>{model.counts.missingCoverage}</span>
			</div>

			{#if model.missingCoverage.length > 0}
				<ul class="coverage-list">
					{#each model.missingCoverage as item}
						<li class="coverage-item">
							<strong>{item.label}</strong>
							<span>{item.description}</span>
						</li>
					{/each}
				</ul>
			{:else}
				<div class="empty-state empty-state--success">
					Core source coverage is in place for this stage.
				</div>
			{/if}
		</section>
	</div>

	<section class="stage-panel">
		<div class="panel-header">
			<h3>Evidence-backed findings</h3>
			<span>{model.counts.findings}</span>
		</div>

		{#if model.findings.length > 0}
			<div class="findings-list">
				{#each model.findings as finding}
					<div class={`finding-card ${formatSeverityClass(finding.severity)}`}>
						<div class="finding-top">
							<div class="finding-title-wrap">
								<strong>{finding.label}</strong>
								<span class="finding-type">{finding.evidenceType === 'background_check' ? 'Third-party check' : 'Structured field'}</span>
							</div>
							<span class={`finding-severity ${formatSeverityClass(finding.severity)}`}>{finding.severity}</span>
						</div>
						<div class="finding-summary">{finding.summary}</div>
						{#if finding.detail && finding.detail !== finding.summary}
							<details class="finding-detail">
								<summary>View full detail</summary>
								<div>{finding.detail}</div>
							</details>
						{/if}
						{#if resolveFindingSources(finding).length > 0}
							<div class="finding-sources">
								{#each resolveFindingSources(finding) as source}
									{#if source.url}
										<a class="source-pill" href={source.url} target="_blank" rel="noopener">
											{source.label}
										</a>
									{:else}
										<span class="source-pill">{source.label}</span>
									{/if}
								{/each}
							</div>
						{/if}
					</div>
				{/each}
			</div>
		{:else}
			<div class="empty-state">
				No structured risk findings are stored yet. Add risk notes, downside notes, key dates, or a background-check result to populate this stage.
			</div>
		{/if}
	</section>
</section>

<style>
	.risk-stage {
		display: flex;
		flex-direction: column;
		gap: 18px;
	}

	.stage-header {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 16px;
	}

	.stage-kicker {
		font-size: 11px;
		font-weight: 700;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: rgba(15, 23, 42, 0.6);
		margin-bottom: 6px;
	}

	h2 {
		margin: 0;
		font-size: 24px;
		line-height: 1.15;
	}

	p {
		margin: 8px 0 0;
		color: rgba(15, 23, 42, 0.7);
		line-height: 1.55;
	}

	.stage-status,
	.verification-status,
	.finding-severity {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		border-radius: 999px;
		padding: 6px 10px;
		font-size: 12px;
		font-weight: 700;
		text-transform: capitalize;
	}

	.status--ready {
		background: rgba(34, 197, 94, 0.14);
		color: #166534;
	}

	.status--partial {
		background: rgba(245, 158, 11, 0.16);
		color: #92400e;
	}

	.status--missing {
		background: rgba(239, 68, 68, 0.12);
		color: #b91c1c;
	}

	.stage-summary {
		display: grid;
		grid-template-columns: repeat(4, minmax(0, 1fr));
		gap: 12px;
	}

	.summary-card,
	.stage-panel,
	.source-card,
	.verification-card,
	.finding-card,
	.coverage-item,
	.empty-state {
		border: 1px solid rgba(15, 23, 42, 0.08);
		background: #fff;
		border-radius: 16px;
	}

	.summary-card {
		padding: 14px 16px;
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.summary-card strong {
		font-size: 24px;
		line-height: 1;
	}

	.summary-label,
	.source-group-title,
	.finding-type,
	.verification-searched,
	.source-context,
	.source-url,
	.coverage-item span,
	.stage-summary-text {
		color: rgba(15, 23, 42, 0.65);
	}

	.summary-label,
	.source-group-title {
		font-size: 12px;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.06em;
	}

	.stage-summary-text {
		margin: 0;
	}

	.stage-grid {
		display: grid;
		grid-template-columns: minmax(0, 1.35fr) minmax(280px, 0.85fr);
		gap: 16px;
	}

	.stage-panel {
		padding: 18px;
		display: flex;
		flex-direction: column;
		gap: 16px;
	}

	.panel-header {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 12px;
	}

	.panel-header h3 {
		margin: 0;
		font-size: 18px;
	}

	.panel-header span {
		font-size: 13px;
		color: rgba(15, 23, 42, 0.55);
	}

	.source-group {
		display: flex;
		flex-direction: column;
		gap: 12px;
	}

	.source-list,
	.verification-list,
	.findings-list {
		display: grid;
		gap: 12px;
	}

	.source-card,
	.verification-card,
	.finding-card {
		padding: 14px 16px;
		text-decoration: none;
		color: inherit;
		min-width: 0;
	}

	.source-card-top,
	.verification-top,
	.finding-top {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 12px;
	}

	.source-label {
		font-weight: 700;
	}

	.source-link,
	.verification-link {
		font-size: 13px;
		font-weight: 700;
		color: #166534;
	}

	.source-url,
	.source-context,
	.verification-detail {
		margin-top: 8px;
		font-size: 13px;
		line-height: 1.45;
		overflow-wrap: anywhere;
	}

	.coverage-list {
		list-style: none;
		padding: 0;
		margin: 0;
		display: grid;
		gap: 10px;
	}

	.coverage-item {
		padding: 14px 16px;
		display: grid;
		gap: 6px;
	}

	.findings-list {
		grid-template-columns: repeat(2, minmax(0, 1fr));
	}

	.finding-card {
		display: flex;
		flex-direction: column;
		gap: 12px;
	}

	.finding-title-wrap {
		display: flex;
		flex-direction: column;
		gap: 4px;
		min-width: 0;
	}

	.finding-type,
	.verification-searched {
		font-size: 12px;
	}

	.finding-summary,
	.finding-detail {
		line-height: 1.55;
	}

	.finding-detail summary {
		cursor: pointer;
		font-weight: 700;
	}

	.finding-sources {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
	}

	.source-pill {
		display: inline-flex;
		align-items: center;
		border-radius: 999px;
		padding: 6px 10px;
		background: rgba(15, 23, 42, 0.06);
		font-size: 12px;
		font-weight: 700;
		text-decoration: none;
		color: inherit;
	}

	.severity--high {
		border-color: rgba(239, 68, 68, 0.18);
	}

	.severity--medium {
		border-color: rgba(245, 158, 11, 0.2);
	}

	.severity--low {
		border-color: rgba(15, 23, 42, 0.08);
	}

	.empty-state {
		padding: 18px;
		color: rgba(15, 23, 42, 0.65);
		line-height: 1.5;
	}

	.empty-state--success {
		color: #166534;
		background: rgba(34, 197, 94, 0.08);
		border-color: rgba(34, 197, 94, 0.16);
	}

	@media (max-width: 1024px) {
		.stage-summary,
		.findings-list,
		.stage-grid {
			grid-template-columns: 1fr;
		}
	}

	@media (max-width: 640px) {
		.stage-header,
		.panel-header,
		.source-card-top,
		.verification-top,
		.finding-top {
			flex-direction: column;
			align-items: flex-start;
		}

		.stage-status {
			align-self: flex-start;
		}
	}
</style>
