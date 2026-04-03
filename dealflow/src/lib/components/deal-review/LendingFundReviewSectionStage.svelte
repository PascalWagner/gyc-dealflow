<script>
	import FieldEvidence from '$lib/components/deal-review/FieldEvidence.svelte';
	import FieldRenderer from '$lib/components/deal-review/FieldRenderer.svelte';
	import {
		dealFieldConfig,
		LENDING_FUND_OFFERING_STATUS_OPTIONS,
		STATE_OPTIONS
	} from '$lib/utils/dealReviewSchema.js';

	let {
		eyebrow = '',
		title = '',
		description = '',
		sections = [],
		form = {},
		fieldErrors = {},
		fieldWarnings = {},
		fieldEvidence = {},
		documentUrls = {},
		evidenceLoading = false,
		labelOverrides = {},
		variant = '',
		onupdate = () => {},
		onaction = null
	} = $props();

	function isHistoricalReturnField(fieldKey) {
		return /^historicalReturn20\d{2}$/i.test(fieldKey);
	}

	function getLendingOfferingStatusValue(value) {
		const normalized = String(value || '').trim().toLowerCase();
		if (!normalized) return '';
		if (normalized === 'currently open' || normalized === 'open to invest') return 'Currently Open';
		if (normalized === 'evergreen') return 'Evergreen';
		if (normalized === 'full' || normalized === 'fully funded' || normalized === 'paused') return 'Full';
		if (normalized === 'full cycle' || normalized === 'completed' || normalized === 'closed') return 'Full Cycle';
		return String(value || '').trim();
	}

	function toggleState(stateCode) {
		const currentValues = Array.isArray(form.investingStates) ? form.investingStates : [];
		const exists = currentValues.includes(stateCode);
		onupdate(
			'investingStates',
			exists ? currentValues.filter((value) => value !== stateCode) : [...currentValues, stateCode]
		);
	}

	function toggleAllStates() {
		const currentValues = Array.isArray(form.investingStates) ? form.investingStates : [];
		onupdate('investingStates', currentValues.length === STATE_OPTIONS.length ? [] : [...STATE_OPTIONS]);
	}
</script>

<section class="lf-stage-shell">
	<header class="lf-stage-header">
		{#if eyebrow}
			<div class="lf-stage-eyebrow">{eyebrow}</div>
		{/if}
		{#if title}
			<h2>{title}</h2>
		{/if}
		{#if description}
			<p>{description}</p>
		{/if}
	</header>

	{#each sections as section}
		<section class="lf-stage-group">
			<div class="lf-stage-group__header">
				<h3>{section.label}</h3>
				{#if section.description}
					<p>{section.description}</p>
				{/if}
			</div>

			{#if section.fieldKeys?.length > 0}
				<div class="lf-stage-group__fields">
					{#each section.fieldKeys as fieldKey}
						{#if variant === 'lending_fund' && fieldKey === 'offeringStatus'}
							<label class="lf-special-field">
								<span>{labelOverrides[fieldKey] || dealFieldConfig[fieldKey]?.label || fieldKey}</span>
								<select value={getLendingOfferingStatusValue(form[fieldKey])} onchange={(event) => onupdate(fieldKey, event.currentTarget.value)}>
									<option value="">Select {labelOverrides[fieldKey] || dealFieldConfig[fieldKey]?.label || fieldKey}</option>
									{#each LENDING_FUND_OFFERING_STATUS_OPTIONS as option}
										<option value={option}>{option}</option>
									{/each}
								</select>
								{#if dealFieldConfig[fieldKey]?.helperText}
									<div class="field-helper">{dealFieldConfig[fieldKey].helperText}</div>
								{/if}
								<FieldEvidence
									fieldKey={fieldKey}
									evidence={fieldEvidence[fieldKey] || []}
									value={form[fieldKey]}
									documentUrls={documentUrls}
									loading={evidenceLoading}
								/>
								{#if fieldErrors[fieldKey]}
									<div class="field-feedback field-feedback--error">{fieldErrors[fieldKey]}</div>
								{:else if fieldWarnings[fieldKey]}
									<div class="field-feedback field-feedback--warning">{fieldWarnings[fieldKey]}</div>
								{/if}
							</label>
						{:else if variant === 'lending_fund' && fieldKey === 'investingStates'}
							<div class="lf-special-field lf-special-field--span-2">
								<span>{labelOverrides[fieldKey] || dealFieldConfig[fieldKey]?.label || fieldKey}</span>
								<div class="lf-state-actions">
									<button type="button" class="lf-inline-btn" onclick={toggleAllStates}>
										{(Array.isArray(form.investingStates) ? form.investingStates.length : 0) === STATE_OPTIONS.length ? 'Clear All States' : 'Select All States'}
									</button>
								</div>
								<div class="lf-state-grid">
									{#each STATE_OPTIONS as stateCode}
										<label class="lf-state-option">
											<input
												type="checkbox"
												checked={Array.isArray(form.investingStates) && form.investingStates.includes(stateCode)}
												onchange={() => toggleState(stateCode)}
											>
											<span>{stateCode}</span>
										</label>
									{/each}
								</div>
								{#if dealFieldConfig[fieldKey]?.helperText}
									<div class="field-helper">{dealFieldConfig[fieldKey].helperText}</div>
								{/if}
								<FieldEvidence
									fieldKey={fieldKey}
									evidence={fieldEvidence[fieldKey] || []}
									value={form[fieldKey]}
									documentUrls={documentUrls}
									loading={evidenceLoading}
								/>
								{#if fieldErrors[fieldKey]}
									<div class="field-feedback field-feedback--error">{fieldErrors[fieldKey]}</div>
								{:else if fieldWarnings[fieldKey]}
									<div class="field-feedback field-feedback--warning">{fieldWarnings[fieldKey]}</div>
								{/if}
							</div>
						{:else if variant === 'lending_fund' && fieldKey === 'lpGpSplit'}
							<label class="lf-special-field">
								<span>{labelOverrides[fieldKey] || dealFieldConfig[fieldKey]?.label || fieldKey}</span>
								<div class="lf-number-shell">
									<input
										type="number"
										min="0"
										max="100"
										step="1"
										value={form[fieldKey] || ''}
										oninput={(event) => onupdate(fieldKey, event.currentTarget.value)}
									>
									<div class="lf-number-suffix">%</div>
								</div>
								{#if dealFieldConfig[fieldKey]?.helperText}
									<div class="field-helper">{dealFieldConfig[fieldKey].helperText}</div>
								{/if}
								<FieldEvidence
									fieldKey={fieldKey}
									evidence={fieldEvidence[fieldKey] || []}
									value={form[fieldKey]}
									documentUrls={documentUrls}
									loading={evidenceLoading}
								/>
								{#if fieldErrors[fieldKey]}
									<div class="field-feedback field-feedback--error">{fieldErrors[fieldKey]}</div>
								{:else if fieldWarnings[fieldKey]}
									<div class="field-feedback field-feedback--warning">{fieldWarnings[fieldKey]}</div>
								{/if}
							</label>
						{:else if isHistoricalReturnField(fieldKey)}
							<label class="lf-special-field">
								<span>{labelOverrides[fieldKey] || dealFieldConfig[fieldKey]?.label || fieldKey}</span>
								<div class="lf-number-shell">
									<input
										type="number"
										step="0.01"
										value={form[fieldKey] || ''}
										oninput={(event) => onupdate(fieldKey, event.currentTarget.value)}
									>
									<div class="lf-number-suffix">%</div>
								</div>
								{#if dealFieldConfig[fieldKey]?.helperText}
									<div class="field-helper">{dealFieldConfig[fieldKey].helperText}</div>
								{/if}
								<FieldEvidence
									fieldKey={fieldKey}
									evidence={fieldEvidence[fieldKey] || []}
									value={form[fieldKey]}
									documentUrls={documentUrls}
									loading={evidenceLoading}
								/>
								{#if fieldErrors[fieldKey]}
									<div class="field-feedback field-feedback--error">{fieldErrors[fieldKey]}</div>
								{:else if fieldWarnings[fieldKey]}
									<div class="field-feedback field-feedback--warning">{fieldWarnings[fieldKey]}</div>
								{/if}
							</label>
						{:else}
							<FieldRenderer
								field={{ ...dealFieldConfig[fieldKey], label: labelOverrides[fieldKey] || dealFieldConfig[fieldKey]?.label || fieldKey }}
								value={form[fieldKey]}
								error={fieldErrors[fieldKey] || ''}
								warning={fieldWarnings[fieldKey] || ''}
								evidence={fieldEvidence[fieldKey] || []}
								documentUrls={documentUrls}
								evidenceLoading={evidenceLoading}
								onupdate={(nextValue) => onupdate(fieldKey, nextValue)}
								onaction={fieldKey === 'slug' ? onaction : null}
							/>
						{/if}
					{/each}
				</div>
			{:else if section.note}
				<div class="lf-stage-note">{section.note}</div>
			{/if}
		</section>
	{/each}
</section>

<style>
	.lf-stage-shell {
		display: grid;
		gap: 20px;
	}

	.lf-stage-header {
		display: grid;
		gap: 8px;
		padding: 24px;
		border: 1px solid rgba(31, 81, 89, 0.08);
		border-radius: 24px;
		background:
			linear-gradient(180deg, rgba(252, 251, 247, 0.98), rgba(245, 246, 241, 0.98)),
			radial-gradient(circle at top right, rgba(81, 190, 123, 0.08), transparent 44%);
	}

	.lf-stage-eyebrow {
		font-size: 12px;
		font-weight: 700;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		color: #486f61;
	}

	.lf-stage-header h2,
	.lf-stage-group__header h3 {
		margin: 0;
		color: var(--text-dark);
		letter-spacing: -0.02em;
	}

	.lf-stage-header p,
	.lf-stage-group__header p,
	.lf-stage-note {
		margin: 0;
		color: var(--text-secondary);
		line-height: 1.55;
	}

	.lf-stage-group {
		display: grid;
		gap: 16px;
		padding: 20px;
		border: 1px solid rgba(31, 81, 89, 0.08);
		border-radius: 22px;
		background: rgba(255, 255, 255, 0.56);
	}

	.lf-stage-group__header {
		display: grid;
		gap: 6px;
	}

	.lf-stage-group__fields {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
		gap: 16px;
	}

	.lf-special-field {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	.lf-special-field--span-2 {
		grid-column: 1 / -1;
	}

	.lf-special-field > span {
		font-family: var(--font-ui);
		font-size: 11px;
		font-weight: 800;
		letter-spacing: 0.8px;
		text-transform: uppercase;
		color: var(--text-muted);
	}

	.lf-special-field input,
	.lf-special-field select {
		width: 100%;
		padding: 11px 12px;
		border-radius: 12px;
		border: 1px solid rgba(31, 81, 89, 0.12);
		background: rgba(255, 255, 255, 0.92);
		color: var(--text-dark);
		font-family: var(--font-body);
		font-size: 14px;
		line-height: 1.45;
		outline: none;
		transition: border-color 0.16s ease, box-shadow 0.16s ease;
	}

	.lf-special-field input:focus,
	.lf-special-field select:focus {
		border-color: rgba(31, 81, 89, 0.34);
		box-shadow: 0 0 0 3px rgba(81, 190, 123, 0.12);
	}

	.lf-inline-btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		padding: 8px 12px;
		border-radius: 12px;
		border: 1px solid rgba(31, 81, 89, 0.14);
		background: rgba(255, 255, 255, 0.9);
		color: var(--text-dark);
		font-family: var(--font-ui);
		font-size: 11px;
		font-weight: 800;
		cursor: pointer;
	}

	.lf-state-actions {
		display: flex;
		justify-content: flex-end;
	}

	.lf-state-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(72px, 1fr));
		gap: 10px;
	}

	.lf-state-option {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		padding: 10px 12px;
		border-radius: 12px;
		border: 1px solid rgba(31, 81, 89, 0.12);
		background: rgba(255, 255, 255, 0.92);
		font-family: var(--font-ui);
		font-size: 12px;
		font-weight: 700;
		color: var(--text-dark);
	}

	.lf-state-option input {
		width: auto;
		margin: 0;
		padding: 0;
		box-shadow: none;
	}

	.lf-number-shell {
		position: relative;
	}

	.lf-number-shell input {
		padding-right: 38px;
	}

	.lf-number-suffix {
		position: absolute;
		top: 50%;
		right: 12px;
		transform: translateY(-50%);
		font-family: var(--font-ui);
		font-size: 12px;
		font-weight: 800;
		color: var(--text-muted);
		pointer-events: none;
	}

	.lf-stage-note {
		padding: 16px;
		border-radius: 16px;
		background: rgba(31, 81, 89, 0.04);
		border: 1px solid rgba(31, 81, 89, 0.08);
	}
</style>
