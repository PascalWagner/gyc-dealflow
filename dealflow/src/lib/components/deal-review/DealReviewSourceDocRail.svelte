<script>
	import { browser } from '$app/environment';
	import { createEventDispatcher } from 'svelte';
	import {
		resolveDealReviewSourceDocs,
		resolveDealReviewSourceRailState,
		writeDealReviewSourceRailState
	} from '$lib/utils/dealReviewShell.js';

	export let dealId = '';
	export let deal = null;
	export let documents = [];
	export let pendingFiles = {};
	export let selectedKind = '';
	export let persist = true;
	export let sticky = true;
	export let collapsible = true;
	export let defaultCollapsed = false;
	export let title = 'Source Docs';
	export let subtitle = 'Keep the deck and PPM accessible while you move through intake and review.';
	export let emptyMessage = 'Attach a deck or PPM to make the source rail useful.';

	const dispatch = createEventDispatcher();

	let activeKind = '';
	let collapsed = defaultCollapsed;
	let initialized = false;

	$: resolvedDocuments =
		Array.isArray(documents) && documents.length > 0
			? documents
			: resolveDealReviewSourceDocs(deal || {}, { pendingFiles });
	$: resolvedState = resolveDealReviewSourceRailState({
		dealId,
		docs: resolvedDocuments,
		selectedKind,
		defaultCollapsed
	});
	$: activeDocument = resolvedDocuments.find((document) => document.kind === activeKind) || resolvedDocuments[0] || null;
	$: syncLocalState();
	$: if (browser && persist && initialized && dealId) {
		writeDealReviewSourceRailState(dealId, {
			activeKind,
			collapsed
		});
	}

	function syncLocalState() {
		const nextActiveKind = resolvedState.activeKind || resolvedDocuments[0]?.kind || '';
		if (!initialized || selectedKind || !resolvedDocuments.some((document) => document.kind === activeKind)) {
			activeKind = nextActiveKind;
		}
		if (!initialized) {
			collapsed = resolvedState.collapsed;
			initialized = true;
		}
	}

	function toggleCollapsed() {
		if (!collapsible) return;
		collapsed = !collapsed;
		dispatch('toggle', { collapsed });
	}

	function selectDocument(document, { open = false } = {}) {
		activeKind = document.kind;
		dispatch('select', {
			document,
			kind: document.kind
		});

		if (open) {
			if (!document.url) {
				dispatch('missing', {
					document,
					kind: document.kind
				});
				return;
			}
			if (persist && dealId) {
				writeDealReviewSourceRailState(dealId, {
					activeKind: document.kind,
					lastOpenedKind: document.kind,
					collapsed
				});
			}
			dispatch('open', {
				document,
				kind: document.kind,
				url: document.url
			});
			window.open(document.url, '_blank', 'noopener');
		}
	}
</script>

<aside class:dr-doc-rail--sticky={sticky} class="dr-doc-rail" aria-label={title}>
	<header class="dr-doc-rail__header">
		<div>
			<h2>{title}</h2>
			{#if subtitle}
				<p>{subtitle}</p>
			{/if}
		</div>

		{#if collapsible}
			<button
				type="button"
				class="dr-doc-rail__toggle"
				aria-expanded={!collapsed}
				aria-controls="deal-review-source-docs"
				onclick={toggleCollapsed}
			>
				{collapsed ? 'Show' : 'Hide'}
			</button>
		{/if}
	</header>

	{#if !collapsed}
		<div id="deal-review-source-docs" class="dr-doc-rail__body">
			{#if resolvedDocuments.some((document) => document.isAvailable)}
				<ul class="dr-doc-rail__list">
					{#each resolvedDocuments as document}
						<li>
							<button
								type="button"
								class="dr-doc-rail__item"
								class:is-active={document.kind === activeKind}
								onclick={() => selectDocument(document)}
							>
								<span class="dr-doc-rail__item-main">
									<span class="dr-doc-rail__label">{document.label}</span>
									<span class="dr-doc-rail__name">{document.name}</span>
								</span>
								<span class={`dr-doc-rail__status dr-doc-rail__status--${document.status}`}>
									{document.status === 'ready' ? 'Linked' : document.status === 'pending' ? 'Pending' : 'Missing'}
								</span>
							</button>
						</li>
					{/each}
				</ul>

				{#if activeDocument}
					<section class="dr-doc-rail__focus">
						<div class="dr-doc-rail__focus-copy">
							<div class="dr-doc-rail__focus-label">{activeDocument.label}</div>
							<div class="dr-doc-rail__focus-name">{activeDocument.name}</div>
						</div>
						<div class="dr-doc-rail__focus-actions">
							<button
								type="button"
								class="dr-doc-rail__action"
								onclick={() => selectDocument(activeDocument, { open: true })}
								disabled={!activeDocument.url}
							>
								{activeDocument.url ? 'Open doc' : 'Not attached'}
							</button>
						</div>
					</section>
				{/if}
			{:else}
				<div class="dr-doc-rail__empty">{emptyMessage}</div>
			{/if}
		</div>
	{/if}
</aside>

<style>
	.dr-doc-rail {
		display: grid;
		gap: 16px;
		padding: 18px;
		border: 1px solid rgba(20, 20, 19, 0.08);
		border-radius: 24px;
		background: #fff;
		box-shadow: 0 18px 36px rgba(20, 20, 19, 0.04);
	}

	.dr-doc-rail--sticky {
		position: sticky;
		top: 24px;
	}

	.dr-doc-rail__header {
		display: flex;
		align-items: start;
		justify-content: space-between;
		gap: 16px;
	}

	.dr-doc-rail__header h2 {
		margin: 0;
		font-size: 1rem;
		font-weight: 700;
		color: #141413;
	}

	.dr-doc-rail__header p {
		margin: 4px 0 0;
		font-size: 0.88rem;
		line-height: 1.5;
		color: #607179;
	}

	.dr-doc-rail__toggle,
	.dr-doc-rail__action {
		border: 1px solid rgba(20, 20, 19, 0.1);
		border-radius: 999px;
		background: #fff;
		padding: 10px 14px;
		font-size: 0.82rem;
		font-weight: 700;
		color: #141413;
		cursor: pointer;
	}

	.dr-doc-rail__toggle:hover,
	.dr-doc-rail__action:hover:not(:disabled) {
		border-color: rgba(47, 165, 106, 0.35);
	}

	.dr-doc-rail__body {
		display: grid;
		gap: 14px;
	}

	.dr-doc-rail__list {
		display: grid;
		gap: 10px;
		padding: 0;
		margin: 0;
		list-style: none;
	}

	.dr-doc-rail__item {
		width: 100%;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		padding: 12px 14px;
		border: 1px solid rgba(20, 20, 19, 0.08);
		border-radius: 18px;
		background: rgba(246, 248, 247, 0.6);
		text-align: left;
		cursor: pointer;
	}

	.dr-doc-rail__item.is-active {
		border-color: rgba(47, 165, 106, 0.4);
		background: rgba(81, 190, 123, 0.08);
	}

	.dr-doc-rail__item-main {
		display: grid;
		gap: 3px;
		min-width: 0;
	}

	.dr-doc-rail__label {
		font-size: 0.75rem;
		font-weight: 800;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: #607179;
	}

	.dr-doc-rail__name {
		font-size: 0.88rem;
		font-weight: 600;
		color: #141413;
		word-break: break-word;
	}

	.dr-doc-rail__status {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		padding: 6px 10px;
		border-radius: 999px;
		font-size: 0.72rem;
		font-weight: 800;
		text-transform: uppercase;
	}

	.dr-doc-rail__status--ready {
		background: rgba(81, 190, 123, 0.16);
		color: #217347;
	}

	.dr-doc-rail__status--pending {
		background: rgba(255, 196, 61, 0.18);
		color: #8c6600;
	}

	.dr-doc-rail__status--missing {
		background: rgba(97, 113, 121, 0.12);
		color: #607179;
	}

	.dr-doc-rail__focus {
		display: grid;
		gap: 12px;
		padding: 14px;
		border-radius: 20px;
		background: linear-gradient(180deg, rgba(246, 248, 247, 0.92) 0%, rgba(255, 255, 255, 0.98) 100%);
		border: 1px solid rgba(20, 20, 19, 0.06);
	}

	.dr-doc-rail__focus-copy {
		display: grid;
		gap: 4px;
	}

	.dr-doc-rail__focus-label {
		font-size: 0.78rem;
		font-weight: 800;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: #607179;
	}

	.dr-doc-rail__focus-name {
		font-size: 0.96rem;
		font-weight: 700;
		color: #141413;
		word-break: break-word;
	}

	.dr-doc-rail__empty {
		padding: 16px;
		border-radius: 18px;
		background: rgba(246, 248, 247, 0.72);
		font-size: 0.9rem;
		line-height: 1.5;
		color: #607179;
	}

	@media (max-width: 960px) {
		.dr-doc-rail--sticky {
			position: static;
		}
	}
</style>
