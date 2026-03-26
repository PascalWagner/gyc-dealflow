<script>
	let {
		score = null,
		max = 5,
		highlight = false
	} = $props();

	const clampedScore = $derived(typeof score === 'number' ? Math.max(0, Math.min(max, score)) : null);
	const fillWidth = $derived(clampedScore === null ? 0 : (clampedScore / max) * 100);
</script>

<div class="plan-fit" class:is-highlight={highlight}>
	<div class="plan-fit-score">{clampedScore === null ? '\u2014' : `${clampedScore}/${max}`}</div>
	<div class="plan-fit-track" aria-hidden="true">
		<div class="plan-fit-fill" style={`width:${fillWidth}%`}></div>
	</div>
</div>

<style>
	.plan-fit {
		display: grid;
		gap: 8px;
		width: 100%;
	}

	.plan-fit-score {
		font-family: var(--font-ui);
		font-size: 15px;
		font-weight: 700;
		color: var(--text-dark);
		text-align: center;
	}

	.plan-fit.is-highlight .plan-fit-score {
		color: var(--primary);
	}

	.plan-fit-track {
		height: 4px;
		border-radius: 999px;
		background: var(--border-light, var(--border));
		overflow: hidden;
	}

	.plan-fit-fill {
		height: 100%;
		border-radius: inherit;
		background: var(--primary);
	}
</style>
