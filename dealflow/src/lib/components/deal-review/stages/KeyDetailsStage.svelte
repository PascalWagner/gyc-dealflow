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
		fieldEvidence = {},
		documentUrls = {},
		evidenceLoading = false,
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
							evidence={fieldEvidence[fieldKey] || []}
							documentUrls={documentUrls}
							evidenceLoading={evidenceLoading}
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
		padding: 24px;
		border: 1px solid rgba(31, 81, 89, 0.08);
		border-radius: 24px;
		background:
			linear-gradient(180deg, rgba(252, 251, 247, 0.98), rgba(245, 246, 241, 0.98)),
			radial-gradient(circle at top right, rgba(81, 190, 123, 0.08), transparent 44%);
	}

	.stage-eyebrow {
		font-size: 12px;
		font-weight: 700;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		color: #486f61;
	}

	.stage-header h2,
	.stage-group__header h3 {
		margin: 0;
		color: var(--text-dark);
		letter-spacing: -0.02em;
	}

	.stage-header p,
	.stage-group__header p {
		margin: 0;
		color: var(--text-secondary);
		line-height: 1.55;
	}

	.stage-group {
		display: grid;
		gap: 16px;
		padding: 20px;
		border: 1px solid rgba(31, 81, 89, 0.08);
		border-radius: 22px;
		background: rgba(255, 255, 255, 0.56);
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
