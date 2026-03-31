<script>
	let {
		stages = [],
		currentStage = '',
		onselect = () => {},
		completedStages = []
	} = $props();

	const completedSet = $derived(new Set(completedStages || []));
</script>

<nav class="onboarding-progress" aria-label="Deal onboarding progress">
	{#each stages as stage, index}
		{@const active = stage.id === currentStage}
		{@const complete = completedSet.has(stage.id)}
		<button
			type="button"
			class="progress-step"
			class:is-active={active}
			class:is-complete={complete}
			onclick={() => onselect(stage.id)}
		>
			<span class="progress-step__index">{index + 1}</span>
			<span class="progress-step__meta">
				<strong>{stage.label}</strong>
				<small>{stage.title}</small>
			</span>
		</button>
	{/each}
</nav>

<style>
	.onboarding-progress {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(132px, 1fr));
		gap: 10px;
	}

	.progress-step {
		display: flex;
		align-items: flex-start;
		gap: 10px;
		padding: 12px;
		border-radius: 16px;
		border: 1px solid rgba(31, 81, 89, 0.1);
		background: rgba(255, 255, 255, 0.92);
		cursor: pointer;
		text-align: left;
		min-width: 0;
	}

	.progress-step__index {
		width: 28px;
		height: 28px;
		border-radius: 999px;
		background: rgba(31, 81, 89, 0.08);
		color: var(--text-dark);
		display: inline-flex;
		align-items: center;
		justify-content: center;
		font-family: var(--font-ui);
		font-size: 12px;
		font-weight: 800;
		flex-shrink: 0;
	}

	.progress-step__meta {
		display: grid;
		gap: 4px;
		min-width: 0;
	}

	.progress-step__meta strong {
		font-family: var(--font-ui);
		font-size: 12px;
		font-weight: 800;
		color: var(--text-dark);
		text-transform: uppercase;
		letter-spacing: 0.6px;
	}

	.progress-step__meta small {
		font-size: 12px;
		line-height: 1.4;
		color: var(--text-secondary);
	}

	.progress-step.is-active {
		border-color: rgba(81, 190, 123, 0.4);
		box-shadow: 0 0 0 3px rgba(81, 190, 123, 0.12);
	}

	.progress-step.is-active .progress-step__index,
	.progress-step.is-complete .progress-step__index {
		background: var(--primary);
		color: #fff;
	}

	@media (max-width: 900px) {
		.onboarding-progress {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
	}

	@media (max-width: 640px) {
		.onboarding-progress {
			grid-template-columns: 1fr;
		}
	}
</style>
