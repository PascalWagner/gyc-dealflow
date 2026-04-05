<script>
	import { getFreshSessionToken } from '$lib/stores/auth.js';
	import { formatDealReviewFieldDisplay } from '$lib/utils/dealReviewSchema.js';
	import { getReviewFieldLabel } from '$lib/utils/reviewFieldState.js';

	let {
		taskId = '',
		dealId = '',
		onresolved = null,   // called after successful POST resolution
		ondismissed = null,  // called after successful PATCH dismiss
		onclose = null       // called when [Close] is clicked without resolving
	} = $props();

	// ── State ──────────────────────────────────────────────────────────────────

	let loadState = $state('idle');   // 'idle' | 'loading' | 'loaded' | 'error'
	let submitState = $state('idle'); // 'idle' | 'submitting' | 'done' | 'error'
	let task = $state(null);
	let loadError = $state('');
	let submitError = $state('');
	let alreadyResolvedInfo = $state(null); // { resolvedBy, resolvedAt } — set on 409 already_resolved

	// Per-field decision state: { [fieldKey]: { action, manualValue, editing } }
	let decisions = $state({});

	// ── Derived ────────────────────────────────────────────────────────────────

	const conflictFields = $derived(
		task && Array.isArray(task.conflict_fields) ? task.conflict_fields : []
	);

	const allDecided = $derived(
		conflictFields.length > 0
		&& conflictFields.every((f) => decisions[f.fieldKey]?.action)
	);

	// ── Load task ──────────────────────────────────────────────────────────────

	async function loadTask() {
		if (!taskId) return;
		loadState = 'loading';
		loadError = '';
		try {
			const token = await getFreshSessionToken();
			const response = await fetch(`/api/reconciliation/${encodeURIComponent(taskId)}`, {
				headers: { Authorization: `Bearer ${token}` }
			});
			const payload = await response.json().catch(() => ({}));
			if (!response.ok || !payload?.task) {
				throw new Error(payload?.error || 'Could not load reconciliation task.');
			}
			task = payload.task;
			// Pre-seed decisions object
			const init = {};
			for (const f of task.conflict_fields || []) {
				init[f.fieldKey] = { action: '', manualValue: '', editing: false };
			}
			decisions = init;
			loadState = 'loaded';
		} catch (err) {
			loadError = err?.message || 'Failed to load reconciliation task.';
			loadState = 'error';
		}
	}

	// ── Actions ────────────────────────────────────────────────────────────────

	function setAction(fieldKey, action) {
		decisions = {
			...decisions,
			[fieldKey]: {
				...decisions[fieldKey],
				action,
				editing: action === 'edit_manual',
				manualValue: action !== 'edit_manual' ? '' : (decisions[fieldKey]?.manualValue || '')
			}
		};
	}

	function setManualValue(fieldKey, value) {
		decisions = {
			...decisions,
			[fieldKey]: { ...decisions[fieldKey], manualValue: value }
		};
	}

	async function submitResolution() {
		if (!allDecided || submitState === 'submitting') return;
		submitState = 'submitting';
		submitError = '';

		const decisionList = conflictFields.map((f) => {
			const d = decisions[f.fieldKey];
			return d.action === 'edit_manual'
				? { fieldKey: f.fieldKey, action: 'edit_manual', manualValue: d.manualValue }
				: { fieldKey: f.fieldKey, action: d.action };
		});

		try {
			const token = await getFreshSessionToken();
			const response = await fetch(`/api/reconciliation/${encodeURIComponent(taskId)}`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Bearer ${token}`
				},
				body: JSON.stringify({ decisions: decisionList })
			});
			const payload = await response.json().catch(() => ({}));
			if (response.status === 409 && payload?.error === 'already_resolved') {
				alreadyResolvedInfo = {
					resolvedBy: payload.resolvedBy || 'another admin',
					resolvedAt: payload.resolvedAt || ''
				};
				submitState = 'error';
				return;
			}
			if (!response.ok || !payload?.success) {
				throw new Error(payload?.error || 'Failed to resolve reconciliation task.');
			}
			submitState = 'done';
			if (typeof onresolved === 'function') onresolved();
		} catch (err) {
			submitError = err?.message || 'Failed to resolve.';
			submitState = 'error';
		}
	}

	async function dismissTask() {
		if (submitState === 'submitting') return;
		submitState = 'submitting';
		submitError = '';
		try {
			const token = await getFreshSessionToken();
			const response = await fetch(`/api/reconciliation/${encodeURIComponent(taskId)}`, {
				method: 'PATCH',
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Bearer ${token}`
				},
				body: JSON.stringify({ action: 'dismiss' })
			});
			const payload = await response.json().catch(() => ({}));
			if (!response.ok || !payload?.success) {
				throw new Error(payload?.error || 'Failed to dismiss task.');
			}
			submitState = 'done';
			if (typeof ondismissed === 'function') ondismissed();
		} catch (err) {
			submitError = err?.message || 'Failed to dismiss.';
			submitState = 'error';
		}
	}

	// ── Formatting ─────────────────────────────────────────────────────────────

	function formatValue(fieldKey, value) {
		if (value === null || value === undefined || value === '') return '—';
		try {
			const formatted = formatDealReviewFieldDisplay(fieldKey, value);
			if (formatted !== null && formatted !== undefined && formatted !== '') {
				return String(formatted);
			}
		} catch {
			// fall through to raw display
		}
		if (Array.isArray(value)) return value.join(', ') || '—';
		if (typeof value === 'object') return JSON.stringify(value);
		return String(value);
	}

	function formatSourceLabel(currentSource) {
		if (!currentSource) return 'AI';
		if (currentSource.toLowerCase().includes('admin') || currentSource === 'human_override') {
			return 'Human edit';
		}
		const sources = { anthropic: 'Claude', openai: 'OpenAI', gemini: 'Gemini', grok: 'Grok' };
		return sources[currentSource.toLowerCase()] || 'AI (prior)';
	}

	// Load on mount
	$effect(() => {
		if (taskId && loadState === 'idle') {
			loadTask();
		}
	});
</script>

<!-- Backdrop -->
<div
	class="recon-overlay"
	role="dialog"
	aria-modal="true"
	aria-label="Reconcile extraction differences"
>
	<div class="recon-modal">
		<div class="recon-header">
			<div class="recon-header__titles">
				<h2 class="recon-title">Review extraction differences</h2>
				{#if loadState === 'loaded' && conflictFields.length > 0}
					<p class="recon-subtitle">
						{conflictFields.length} field{conflictFields.length === 1 ? '' : 's'} differ from your current review.
						Choose what to keep for each field, then click Resolve all.
					</p>
				{/if}
			</div>
			{#if typeof onclose === 'function'}
				<button type="button" class="recon-close" aria-label="Close" onclick={onclose}>✕</button>
			{/if}
		</div>

		{#if loadState === 'loading'}
			<div class="recon-state">Loading differences…</div>
		{:else if loadState === 'error'}
			<div class="recon-state recon-state--error">
				<strong>Could not load conflicts.</strong>
				<p>{loadError}</p>
				<button type="button" class="ghost-btn" onclick={loadTask}>Retry</button>
			</div>
		{:else if loadState === 'loaded'}
			{#if conflictFields.length === 0}
				<div class="recon-state">No conflicts found — all fields were auto-resolved.</div>
			{:else}
				<div class="recon-table-wrap">
					<table class="recon-table">
						<thead>
							<tr>
								<th class="col-field">Field</th>
								<th class="col-current">Your current value</th>
								<th class="col-source">Source</th>
								<th class="col-extracted">Newly extracted</th>
								<th class="col-action">Action</th>
							</tr>
						</thead>
						<tbody>
							{#each conflictFields as field (field.fieldKey)}
								{@const d = decisions[field.fieldKey] || {}}
								{@const isHumanSource = field.currentSource === 'human_override' || field.currentSource?.includes('admin')}
								<tr class="recon-row" class:recon-row--human={isHumanSource}>
									<td class="col-field">
										<span class="field-label">{getReviewFieldLabel(field.fieldKey)}</span>
									</td>
									<td class="col-current">
										<span class="value-text">{formatValue(field.fieldKey, field.currentValue)}</span>
									</td>
									<td class="col-source">
										<span class="source-badge" class:source-badge--human={isHumanSource}>
											{formatSourceLabel(field.currentSource)}
										</span>
									</td>
									<td class="col-extracted">
										<span class="value-text value-text--new">{formatValue(field.fieldKey, field.extractedValue)}</span>
									</td>
									<td class="col-action">
										<div class="action-group">
											<button
												type="button"
												class="action-btn"
												class:action-btn--selected={d.action === 'keep_current'}
												onclick={() => setAction(field.fieldKey, 'keep_current')}
											>Keep</button>
											<button
												type="button"
												class="action-btn action-btn--use"
												class:action-btn--selected={d.action === 'use_extracted'}
												onclick={() => setAction(field.fieldKey, 'use_extracted')}
											>Use extracted</button>
											<button
												type="button"
												class="action-btn"
												class:action-btn--selected={d.action === 'edit_manual'}
												onclick={() => setAction(field.fieldKey, 'edit_manual')}
											>Edit</button>
										</div>
										{#if d.editing}
											<input
												type="text"
												class="manual-input"
												placeholder="Enter value…"
												value={d.manualValue}
												oninput={(e) => setManualValue(field.fieldKey, e.currentTarget.value)}
											/>
										{/if}
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>

				{#if alreadyResolvedInfo}
					<div class="recon-error">
						This reconciliation was already resolved by {alreadyResolvedInfo.resolvedBy}{alreadyResolvedInfo.resolvedAt ? ` at ${new Date(alreadyResolvedInfo.resolvedAt).toLocaleString()}` : ''}.
						<button type="button" class="recon-reload-btn" onclick={() => window.location.reload()}>Reload page</button>
					</div>
				{:else if submitError}
					<div class="recon-error">{submitError}</div>
				{/if}

				<div class="recon-footer">
					<button
						type="button"
						class="ghost-btn"
						onclick={dismissTask}
						disabled={submitState === 'submitting'}
					>Ignore for now</button>
					<button
						type="button"
						class="primary-btn"
						onclick={submitResolution}
						disabled={!allDecided || submitState === 'submitting'}
					>
						{submitState === 'submitting' ? 'Saving…' : 'Resolve all'}
					</button>
				</div>
			{/if}
		{/if}
	</div>
</div>

<style>
	.recon-overlay {
		position: fixed;
		inset: 0;
		background: rgba(16, 37, 42, 0.48);
		display: flex;
		align-items: flex-start;
		justify-content: center;
		z-index: 9000;
		padding: 48px 16px 24px;
		overflow-y: auto;
	}

	.recon-modal {
		background: #fff;
		border-radius: 20px;
		width: 100%;
		max-width: 900px;
		box-shadow: 0 24px 64px rgba(16, 37, 42, 0.18);
		display: flex;
		flex-direction: column;
		overflow: hidden;
	}

	.recon-header {
		display: flex;
		align-items: flex-start;
		gap: 16px;
		padding: 24px 28px 20px;
		border-bottom: 1px solid rgba(31, 81, 89, 0.08);
	}

	.recon-header__titles {
		flex: 1;
	}

	.recon-title {
		font-size: 18px;
		font-weight: 700;
		color: #1f5159;
		margin: 0 0 4px;
	}

	.recon-subtitle {
		font-size: 13px;
		color: #556b70;
		margin: 0;
	}

	.recon-close {
		border: none;
		background: transparent;
		cursor: pointer;
		color: #556b70;
		font-size: 18px;
		padding: 4px;
		line-height: 1;
		flex-shrink: 0;
		margin-top: 2px;
	}

	.recon-close:hover {
		color: #1f5159;
	}

	.recon-state {
		padding: 32px 28px;
		color: #556b70;
		font-size: 14px;
	}

	.recon-state--error {
		color: #b91c1c;
	}

	.recon-table-wrap {
		overflow-x: auto;
		padding: 0 28px;
	}

	.recon-table {
		width: 100%;
		border-collapse: collapse;
		font-size: 13px;
		margin: 16px 0;
	}

	.recon-table th {
		text-align: left;
		padding: 8px 10px;
		font-size: 11px;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.5px;
		color: #789;
		border-bottom: 2px solid rgba(31, 81, 89, 0.08);
		white-space: nowrap;
	}

	.recon-row td {
		padding: 12px 10px;
		vertical-align: top;
		border-bottom: 1px solid rgba(31, 81, 89, 0.06);
	}

	.recon-row--human td {
		background: rgba(255, 200, 80, 0.04);
	}

	.recon-row--human .col-field .field-label::after {
		content: ' ✎';
		color: #b56f2f;
		font-size: 11px;
	}

	.field-label {
		font-weight: 600;
		color: #1f5159;
	}

	.value-text {
		color: #334;
		font-variant-numeric: tabular-nums;
	}

	.value-text--new {
		color: #167a52;
		font-weight: 500;
	}

	.source-badge {
		display: inline-block;
		padding: 2px 8px;
		border-radius: 999px;
		font-size: 11px;
		font-weight: 700;
		background: rgba(81, 190, 123, 0.12);
		color: #167a52;
		border: 1px solid rgba(81, 190, 123, 0.2);
		white-space: nowrap;
	}

	.source-badge--human {
		background: rgba(181, 111, 47, 0.1);
		color: #b56f2f;
		border-color: rgba(181, 111, 47, 0.18);
	}

	.action-group {
		display: flex;
		gap: 6px;
		flex-wrap: wrap;
	}

	.action-btn {
		padding: 5px 12px;
		border-radius: 8px;
		border: 1px solid rgba(31, 81, 89, 0.18);
		background: transparent;
		font-size: 12px;
		font-weight: 600;
		color: #556b70;
		cursor: pointer;
		transition: all 0.12s ease;
		white-space: nowrap;
	}

	.action-btn:hover {
		border-color: rgba(31, 81, 89, 0.4);
		color: #1f5159;
	}

	.action-btn--selected {
		background: #1f5159;
		color: #fff;
		border-color: #1f5159;
	}

	.action-btn--use.action-btn--selected {
		background: #167a52;
		border-color: #167a52;
	}

	.manual-input {
		margin-top: 8px;
		width: 100%;
		padding: 7px 10px;
		border: 1px solid rgba(31, 81, 89, 0.2);
		border-radius: 8px;
		font-size: 13px;
		color: #1f5159;
		background: #fafdf9;
		box-sizing: border-box;
	}

	.manual-input:focus {
		outline: 2px solid rgba(81, 190, 123, 0.4);
		border-color: #51be7b;
	}

	.recon-error {
		margin: 0 28px;
		padding: 10px 14px;
		border-radius: 8px;
		background: rgba(185, 28, 28, 0.06);
		color: #b91c1c;
		font-size: 13px;
		display: flex;
		align-items: center;
		gap: 10px;
		flex-wrap: wrap;
	}

	.recon-reload-btn {
		flex-shrink: 0;
		background: none;
		border: 1px solid #b91c1c;
		border-radius: 4px;
		color: #b91c1c;
		font-size: 12px;
		padding: 2px 8px;
		cursor: pointer;
	}

	.recon-reload-btn:hover {
		background: rgba(185, 28, 28, 0.08);
	}

	.recon-footer {
		display: flex;
		align-items: center;
		justify-content: flex-end;
		gap: 12px;
		padding: 16px 28px 24px;
		border-top: 1px solid rgba(31, 81, 89, 0.08);
	}

	.col-field  { width: 18%; }
	.col-current { width: 20%; }
	.col-source  { width: 12%; }
	.col-extracted { width: 20%; }
	.col-action  { width: 30%; }
</style>
