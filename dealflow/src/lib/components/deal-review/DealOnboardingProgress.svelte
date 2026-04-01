<script>
	let {
		stages = [],
		currentStage = '',
		onselect = () => {},
		completedStages = [],
		accessibleStages = [],
		variant = 'inline',
		title = 'Review Flow'
	} = $props();

	const completedSet = $derived(new Set(completedStages || []));
	const accessibleSet = $derived(
		new Set((accessibleStages || []).length > 0 ? accessibleStages : (stages || []).map((stage) => stage.id))
	);
	const currentIndex = $derived(
		Math.max(
			0,
			(stages || []).findIndex((stage) => stage.id === currentStage)
		)
	);
</script>

{#if variant === 'sidebar'}
	<section class="sidebar-progress" aria-label="Deal onboarding progress">
		<div class="sidebar-progress__header">
			<div class="sidebar-progress__eyebrow">{title}</div>
			<div class="sidebar-progress__count">{currentIndex + 1}/{stages.length || 0}</div>
		</div>
		<nav class="sidebar-progress__nav">
			{#each stages as stage, index}
				{@const active = stage.id === currentStage}
				{@const complete = completedSet.has(stage.id)}
				{@const unlocked = accessibleSet.has(stage.id)}
				<button
					type="button"
					class="sidebar-progress__step"
					class:is-active={active}
					class:is-complete={complete}
					class:is-locked={!unlocked}
					disabled={!unlocked}
					onclick={() => {
						if (!unlocked) return;
						onselect(stage.id);
					}}
				>
					<span class="sidebar-progress__index">{complete ? '✓' : index + 1}</span>
					<span class="sidebar-progress__meta">
						<strong>{stage.label}</strong>
						<small>{stage.title || stage.description || ''}</small>
					</span>
				</button>
			{/each}
		</nav>
	</section>
{:else}
	<div class="onboarding-progress-shell">
		<nav class="onboarding-progress" aria-label="Deal onboarding progress">
			{#each stages as stage}
				{@const active = stage.id === currentStage}
				{@const complete = completedSet.has(stage.id)}
				{@const unlocked = accessibleSet.has(stage.id)}
				<button
					type="button"
					class="progress-step"
					class:is-active={active}
					class:is-complete={complete}
					class:is-locked={!unlocked}
					disabled={!unlocked}
					onclick={() => {
						if (!unlocked) return;
						onselect(stage.id);
					}}
				>
					<span class="progress-step__label">{stage.label}</span>
					{#if complete}
						<span class="progress-step__status">Done</span>
					{:else if active}
						<span class="progress-step__status">Current</span>
					{/if}
				</button>
			{/each}
		</nav>
		<div class="progress-count">{currentIndex + 1}/{stages.length || 0}</div>
	</div>
{/if}

<style>
	.sidebar-progress {
		display: grid;
		gap: 12px;
		padding: 18px;
		border-radius: 22px;
		background:
			linear-gradient(180deg, rgba(252, 251, 247, 0.98), rgba(245, 246, 241, 0.98)),
			radial-gradient(circle at top right, rgba(81, 190, 123, 0.08), transparent 44%);
		border: 1px solid rgba(31, 81, 89, 0.09);
		box-shadow: 0 14px 30px rgba(16, 37, 42, 0.04);
	}

	.sidebar-progress__header {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 12px;
	}

	.sidebar-progress__eyebrow,
	.sidebar-progress__count {
		font-family: var(--font-ui);
		font-size: 11px;
		font-weight: 800;
		letter-spacing: 0.8px;
		text-transform: uppercase;
		color: var(--text-muted);
	}

	.sidebar-progress__nav {
		display: grid;
		gap: 8px;
	}

	.sidebar-progress__step {
		display: grid;
		grid-template-columns: auto minmax(0, 1fr);
		align-items: start;
		gap: 10px;
		padding: 11px 12px;
		border: 1px solid rgba(31, 81, 89, 0.07);
		border-radius: 16px;
		background: rgba(255, 255, 255, 0.46);
		cursor: pointer;
		text-align: left;
		transition: border-color 0.16s ease, background 0.16s ease, transform 0.16s ease;
	}

	.sidebar-progress__step:hover:not(:disabled) {
		transform: translateY(-1px);
		background: rgba(255, 255, 255, 0.72);
	}

	.sidebar-progress__step:disabled,
	.progress-step:disabled {
		cursor: not-allowed;
	}

	.sidebar-progress__index {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 28px;
		height: 28px;
		border-radius: 999px;
		background: rgba(31, 81, 89, 0.08);
		color: var(--text-dark);
		font-family: var(--font-ui);
		font-size: 12px;
		font-weight: 800;
		flex-shrink: 0;
	}

	.sidebar-progress__meta {
		display: grid;
		gap: 4px;
		min-width: 0;
	}

	.sidebar-progress__meta strong {
		font-family: var(--font-ui);
		font-size: 12px;
		font-weight: 800;
		color: var(--text-dark);
		text-transform: uppercase;
		letter-spacing: 0.06em;
	}

	.sidebar-progress__meta small {
		font-size: 11px;
		line-height: 1.4;
		color: var(--text-secondary);
	}

	.sidebar-progress__step.is-active {
		border-color: rgba(81, 190, 123, 0.34);
		background:
			linear-gradient(180deg, rgba(255, 255, 255, 0.84), rgba(250, 252, 248, 0.84)),
			radial-gradient(circle at right top, rgba(81, 190, 123, 0.12), transparent 50%);
		box-shadow: 0 0 0 2px rgba(81, 190, 123, 0.08);
	}

	.sidebar-progress__step.is-locked {
		opacity: 0.44;
	}

	.sidebar-progress__step.is-active .sidebar-progress__index,
	.sidebar-progress__step.is-complete .sidebar-progress__index {
		background: var(--primary);
		color: #fff;
	}

	.sidebar-progress__step.is-complete {
		background: rgba(255, 255, 255, 0.62);
	}

	.onboarding-progress-shell {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 18px;
		padding: 10px 0 4px;
		border-bottom: 1px solid rgba(31, 81, 89, 0.08);
		overflow-x: auto;
	}

	.onboarding-progress {
		display: flex;
		align-items: center;
		gap: 6px;
		flex-wrap: nowrap;
		min-width: max-content;
	}

	.progress-step {
		position: relative;
		display: inline-flex;
		align-items: center;
		gap: 10px;
		padding: 10px 14px 14px;
		border: 0;
		background: transparent;
		cursor: pointer;
		white-space: nowrap;
		color: var(--text-muted);
	}

	.progress-step.is-locked {
		opacity: 0.48;
	}

	.progress-step::after {
		content: '';
		position: absolute;
		left: 14px;
		right: 14px;
		bottom: 0;
		height: 3px;
		border-radius: 999px;
		background: transparent;
		transition: background 120ms ease;
	}

	.progress-step__label {
		font-family: var(--font-ui);
		font-size: 13px;
		font-weight: 800;
		text-transform: uppercase;
		letter-spacing: 0.6px;
	}

	.progress-step__status,
	.progress-count {
		font-family: var(--font-ui);
		font-size: 11px;
		font-weight: 800;
		letter-spacing: 0.5px;
		text-transform: uppercase;
		color: var(--text-muted);
	}

	.progress-step.is-active {
		color: var(--text-dark);
	}

	.progress-step.is-active::after {
		background: var(--primary);
	}

	.progress-step.is-complete {
		color: color-mix(in srgb, var(--text-dark) 78%, var(--primary, #0f766e));
	}

	.progress-step.is-complete::after {
		background: color-mix(in srgb, var(--primary, #0f766e) 28%, transparent);
	}

	@media (max-width: 640px) {
		.sidebar-progress {
			padding: 16px;
		}

		.onboarding-progress-shell {
			align-items: flex-end;
		}

		.progress-count {
			padding-bottom: 14px;
		}
	}
</style>
