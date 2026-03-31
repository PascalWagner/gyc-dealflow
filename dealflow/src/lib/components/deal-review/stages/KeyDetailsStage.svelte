<script>
	import FieldRenderer from '$lib/components/deal-review/FieldRenderer.svelte';
	import { dealFieldConfig } from '$lib/utils/dealReviewSchema.js';
	import {
		createDealOnboardingFieldValueMap,
		getDealOnboardingStageById,
		resolveDealOnboardingBranch
	} from '$lib/utils/dealOnboardingFlow.js';

	let {
		source = {},
		form = {},
		branch = '',
		fieldErrors = {},
		fieldWarnings = {},
		onupdate = () => {},
		onaction = null
	} = $props();

	const stageSource = $derived({
		...source,
		...form,
		sponsor: form?.sponsor ?? source?.sponsor
	});
	const branchInfo = $derived(
		resolveDealOnboardingBranch({
			...stageSource,
			branch: branch || source?.branch || form?.branch || ''
		})
	);
	const stage = $derived(
		getDealOnboardingStageById('key_details', {
			branch: branchInfo.branch,
			source: stageSource
		})
	);
	const fieldValues = $derived(createDealOnboardingFieldValueMap(stageSource));
</script>

{#if stage}
	<section class="stage-shell">
		<header class="stage-header">
			<div class="stage-eyebrow">{branchInfo.shortLabel} · {stage.label}</div>
			<h2>{stage.title}</h2>
			<p>{stage.description}</p>
		</header>

		{#each stage.fieldGroups as group}
			<section class="stage-group">
				<div class="stage-group__header">
					<h3>{group.label}</h3>
					{#if group.description}
						<p>{group.description}</p>
					{/if}
				</div>

				<div class="stage-group__fields">
					{#each group.fieldKeys as fieldKey}
						<FieldRenderer
							field={dealFieldConfig[fieldKey]}
							value={fieldValues[fieldKey]}
							error={fieldErrors[fieldKey] || ''}
							warning={fieldWarnings[fieldKey] || ''}
							onupdate={(nextValue) => onupdate(fieldKey, nextValue)}
							onaction={fieldKey === 'slug' ? onaction : null}
						/>
					{/each}
				</div>
			</section>
		{/each}
	</section>
{/if}

<style>
	.stage-shell {
		display: grid;
		gap: 20px;
	}

	.stage-header {
		display: grid;
		gap: 10px;
		padding: 22px;
		border: 1px solid rgba(15, 23, 42, 0.08);
		border-radius: 20px;
		background: linear-gradient(180deg, rgba(255, 255, 255, 0.98), rgba(248, 250, 252, 0.95));
	}

	.stage-eyebrow {
		font-size: 12px;
		font-weight: 700;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		color: #8a5a2b;
	}

	.stage-header h2,
	.stage-group__header h3 {
		margin: 0;
		color: #111827;
	}

	.stage-header p,
	.stage-group__header p {
		margin: 0;
		color: #4b5563;
		line-height: 1.55;
	}

	.stage-group {
		display: grid;
		gap: 16px;
		padding: 20px;
		border: 1px solid rgba(15, 23, 42, 0.08);
		border-radius: 20px;
		background: #fff;
	}

	.stage-group__header {
		display: grid;
		gap: 6px;
	}

	.stage-group__fields {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
		gap: 16px;
	}
</style>
