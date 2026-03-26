<script>
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { isAdmin } from '$lib/stores/auth.js';
	import { onboardingReviewGroups } from '$lib/onboarding/reviewLinks.js';

	onMount(() => {
		if (!$isAdmin) {
			goto('/app/deals');
		}
	});
</script>

<svelte:head>
	<title>Onboarding Review | GYC</title>
</svelte:head>

{#if !$isAdmin}
	<div class="loading">Redirecting...</div>
{:else}
	<div class="ly-page">
		<div class="ly-frame">
			<div class="review-shell">
				<div class="hero-card">
					<div class="eyebrow">Hidden QA Route</div>
					<h1>Onboarding Review Links</h1>
					<p>Open any production onboarding page directly. LP plan stages use `stage`, `flow`, and `branch` query params so every page stays reviewable on its real route.</p>
				</div>

				<div class="group-stack">
					{#each onboardingReviewGroups as group}
						<section class="group-card">
							<div class="group-head">
								<h2>{group.title}</h2>
								<p>{group.description}</p>
							</div>
							<div class="link-grid">
								{#each group.links as link}
									<a class="review-link" href={link.href}>
										<span>{link.label}</span>
										<code>{link.href}</code>
									</a>
								{/each}
							</div>
						</section>
					{/each}
				</div>
			</div>
		</div>
	</div>
{/if}

<style>
	.review-shell {
		max-width: 1180px;
		margin: 0 auto;
		padding: 32px 20px 64px;
		display: flex;
		flex-direction: column;
		gap: 20px;
	}

	.hero-card,
	.group-card {
		background: var(--bg-card, #fff);
		border: 1px solid var(--border, #dde5e8);
		border-radius: 18px;
		padding: 24px;
		box-shadow: 0 8px 28px rgba(15, 23, 42, 0.04);
	}

	.eyebrow {
		font-family: var(--font-ui, sans-serif);
		font-size: 11px;
		font-weight: 800;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--primary, #51be7b);
	}

	h1,
	h2 {
		margin: 8px 0 0;
		font-family: var(--font-headline, serif);
		color: var(--text-dark, #141413);
	}

	h1 {
		font-size: 34px;
		line-height: 1.1;
	}

	h2 {
		font-size: 22px;
	}

	p {
		margin: 10px 0 0;
		font-family: var(--font-body, sans-serif);
		font-size: 15px;
		line-height: 1.7;
		color: var(--text-secondary, #607179);
	}

	.group-stack {
		display: grid;
		gap: 18px;
	}

	.link-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
		gap: 12px;
		margin-top: 18px;
	}

	.review-link {
		display: flex;
		flex-direction: column;
		gap: 8px;
		padding: 14px 16px;
		border-radius: 14px;
		border: 1px solid var(--border-light, #edf1f2);
		background: linear-gradient(180deg, rgba(81, 190, 123, 0.06), rgba(255, 255, 255, 0.96));
		text-decoration: none;
		color: var(--text-dark, #141413);
		transition: transform 120ms ease, border-color 120ms ease;
	}

	.review-link:hover {
		transform: translateY(-1px);
		border-color: rgba(81, 190, 123, 0.35);
	}

	.review-link span {
		font-family: var(--font-ui, sans-serif);
		font-size: 14px;
		font-weight: 800;
	}

	.review-link code {
		font-size: 12px;
		line-height: 1.5;
		color: var(--text-muted, #607179);
		word-break: break-word;
	}

	@media (max-width: 640px) {
		.review-shell {
			padding: 20px 14px 48px;
		}

		.hero-card,
		.group-card {
			padding: 18px;
		}

		h1 {
			font-size: 28px;
		}

		.link-grid {
			grid-template-columns: 1fr;
		}
	}
</style>
