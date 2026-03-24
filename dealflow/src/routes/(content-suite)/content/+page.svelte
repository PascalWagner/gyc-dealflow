<script>
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { userToken } from '$lib/stores/auth.js';
	import {
		LIBRARY_VIEWS,
		formatCount,
		formatDate,
		formatDateTime,
		formatEnumLabel,
		formatPlatformLabel
	} from '$lib/utils/publishedLibrary.js';

	const initialMetrics = {
		total_records: 0,
		archived: 0,
		evergreen: 0,
		repurpose_high: 0,
		multi_platform: 0,
		top_performers: 0
	};

	let loading = $state(true);
	let saving = $state(false);
	let setupRequired = $state(false);
	let setupMessage = $state('');
	let errorMessage = $state('');
	let visibleCount = $state(0);
	let items = $state([]);
	let selectedId = $state('');
	let detail = $state(null);
	let metrics = $state(initialMetrics);
	let options = $state({ platforms: [], formats: [], topics: [] });

	let filters = $state({
		view: 'all',
		q: '',
		platform: '',
		format: '',
		primary_topic: '',
		evergreen_status: '',
		repurpose_potential: '',
		archive_status: ''
	});

	let searchTimer;

	async function contentFetch(url, options = {}) {
		const token = $userToken || JSON.parse(localStorage.getItem('gycUser') || '{}').token;
		const response = await fetch(url, {
			...options,
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${token}`,
				...(options.headers || {})
			}
		});
		const payload = await response.json().catch(() => ({}));
		if (!response.ok) throw new Error(payload.error || 'Request failed');
		return payload;
	}

	function queryString() {
		const params = new URLSearchParams();
		Object.entries(filters).forEach(([key, value]) => {
			if (value) params.set(key, value);
		});
		return params.toString();
	}

	async function loadList() {
		loading = true;
		errorMessage = '';
		try {
			const payload = await contentFetch(`/api/content-published${queryString() ? `?${queryString()}` : ''}`);
			setupRequired = Boolean(payload.setupRequired);
			setupMessage = payload.setupMessage || '';
			items = payload.items || [];
			metrics = payload.metrics || initialMetrics;
			options = payload.options || { platforms: [], formats: [], topics: [] };
			visibleCount = payload.visibleCount || items.length;

			if (!setupRequired && items.length) {
				const targetId = items.some((item) => item.id === selectedId) ? selectedId : items[0].id;
				selectedId = targetId;
				await loadDetail(targetId, false);
			} else if (!items.length) {
				detail = null;
			}
		} catch (error) {
			errorMessage = error.message;
		} finally {
			loading = false;
		}
	}

	async function loadDetail(id, showSpinner = true) {
		if (!id) {
			detail = null;
			return;
		}
		if (showSpinner) saving = true;
		try {
			const payload = await contentFetch(`/api/content-published?id=${encodeURIComponent(id)}`);
			detail = payload.item || null;
			selectedId = detail?.id || id;
		} catch (error) {
			errorMessage = error.message;
		} finally {
			saving = false;
		}
	}

	function selectItem(id) {
		if (id === selectedId) return;
		loadDetail(id);
	}

	function debouncedSearch() {
		clearTimeout(searchTimer);
		searchTimer = setTimeout(() => loadList(), 200);
	}

	onMount(() => {
		loadList();
	});
</script>

<svelte:head>
	<title>Content Library | Kontent Engine</title>
</svelte:head>

<div class="content-page">
	<header class="content-header">
		<div>
			<p class="eyebrow">Published dataset</p>
			<h1>Content Library</h1>
			<p class="header-copy">Structured memory for every post, asset, and platform variant you have already published.</p>
		</div>
		<div class="header-actions">
			<button class="ghost-button" onclick={() => loadList()} disabled={loading}>Refresh</button>
			<button class="primary-button" onclick={() => goto('/content/new')}>+ New Content</button>
		</div>
	</header>

	<div class="metric-grid">
		<article class="metric-card"><span>Total records</span><strong>{metrics.total_records}</strong></article>
		<article class="metric-card"><span>Archived</span><strong>{metrics.archived}</strong></article>
		<article class="metric-card"><span>Evergreen</span><strong>{metrics.evergreen}</strong></article>
		<article class="metric-card"><span>High repurpose</span><strong>{metrics.repurpose_high}</strong></article>
		<article class="metric-card"><span>Multi-platform</span><strong>{metrics.multi_platform}</strong></article>
		<article class="metric-card"><span>Top performers</span><strong>{metrics.top_performers}</strong></article>
	</div>

	<div class="view-row">
		{#each LIBRARY_VIEWS as view}
			<button class="view-chip" class:active={filters.view === view.value} onclick={() => { filters.view = view.value; loadList(); }}>
				{view.label}
			</button>
		{/each}
	</div>

	<section class="filter-bar">
		<label class="search-field">
			<input
				type="text"
				placeholder="Search title, hook, topic, or text"
				bind:value={filters.q}
				oninput={debouncedSearch}
			/>
		</label>
		<select bind:value={filters.platform} onchange={loadList}>
			<option value="">All platforms</option>
			{#each options.platforms || [] as platform}
				<option value={platform}>{formatPlatformLabel(platform)}</option>
			{/each}
		</select>
		<select bind:value={filters.format} onchange={loadList}>
			<option value="">All formats</option>
			{#each options.formats || [] as format}
				<option value={format}>{formatEnumLabel(format)}</option>
			{/each}
		</select>
		<select bind:value={filters.primary_topic} onchange={loadList}>
			<option value="">All topics</option>
			{#each options.topics || [] as topic}
				<option value={topic}>{topic}</option>
			{/each}
		</select>
		<select bind:value={filters.archive_status} onchange={loadList}>
			<option value="">All archive states</option>
			<option value="archived">Archived</option>
			<option value="incomplete">Incomplete</option>
		</select>
	</section>

	{#if setupRequired}
		<div class="setup-banner">
			<strong>Setup required.</strong> {setupMessage}
		</div>
	{:else if errorMessage}
		<div class="setup-banner error-banner">{errorMessage}</div>
	{/if}

	<div class="workspace">
		<section class="library-list">
			<div class="section-head">
				<div>
					<h2>Published archive</h2>
					<p>{visibleCount} visible records</p>
				</div>
			</div>

			{#if loading}
				<div class="empty-state"><p>Loading published content…</p></div>
			{:else if !items.length}
				<div class="empty-state">
					<h3>No published records yet</h3>
					<p>Create your first canonical post record and attach one or more platform publishes.</p>
					<button class="primary-button" onclick={() => goto('/content/new')}>Create Published Record</button>
				</div>
			{:else}
				<div class="card-list">
					{#each items as item}
						<button class="content-card" class:active={item.id === selectedId} onclick={() => selectItem(item.id)}>
							{#if item.preview_image_url}
								<img class="content-card-thumb" src={item.preview_image_url} alt="" />
							{:else}
								<div class="content-card-thumb thumb-fallback">No preview</div>
							{/if}
							<div class="content-card-copy">
								<div class="content-card-head">
									<div>
										<p class="eyebrow">{item.content_id}</p>
										<h3>{item.title}</h3>
									</div>
									<span class="score-pill">{Math.round(item.aggregate_performance_score)}</span>
								</div>
								<p class="content-card-hook">{item.hook}</p>
								<div class="badge-row">
									<span class="badge">{item.primary_topic}</span>
									<span class="badge">{formatEnumLabel(item.format)}</span>
									{#each item.platforms as platform}
										<span class="badge">{formatPlatformLabel(platform)}</span>
									{/each}
								</div>
								<div class="card-meta">
									<span>{formatDate(item.last_published_at)}</span>
									<span>{item.archive_complete ? 'Archived' : 'Incomplete'}</span>
								</div>
							</div>
						</button>
					{/each}
				</div>
			{/if}
		</section>

		<section class="detail-pane">
			{#if !detail}
				<div class="empty-state">
					<h3>Select a record</h3>
					<p>The detail pane shows threadable context for one canonical content item and all of its published variants.</p>
				</div>
			{:else}
				<div class="detail-scroll">
					<header class="detail-header">
						<div>
							<p class="eyebrow">{detail.content_id}</p>
							<h2>{detail.title}</h2>
							<p class="detail-meta">{detail.platforms.map(formatPlatformLabel).join(', ')} • {formatDate(detail.first_published_at)}</p>
						</div>
						<div class="header-actions">
							{#if detail.distributions[0]}
								<a class="ghost-button" href={detail.distributions[0].published_url} target="_blank" rel="noreferrer">Open Post</a>
							{/if}
							{#if detail.source_doc_url}
								<a class="ghost-button" href={detail.source_doc_url} target="_blank" rel="noreferrer">Open Doc</a>
							{/if}
							{#if detail.drive_folder_url}
								<a class="ghost-button" href={detail.drive_folder_url} target="_blank" rel="noreferrer">Open Folder</a>
							{/if}
						</div>
					</header>

					{#if detail.preview_image_url}
						<img class="detail-hero" src={detail.preview_image_url} alt="" />
					{/if}

					<div class="detail-metrics">
						<div class="stat-block"><span>Best platform</span><strong>{detail.best_platform ? formatPlatformLabel(detail.best_platform) : 'n/a'}</strong></div>
						<div class="stat-block"><span>Best score</span><strong>{Math.round(detail.best_platform_score)}</strong></div>
						<div class="stat-block"><span>Total views</span><strong>{formatCount(detail.total_views)}</strong></div>
						<div class="stat-block"><span>Total engagements</span><strong>{formatCount(detail.total_engagements)}</strong></div>
					</div>

					<div class="detail-grid">
						<article class="detail-card">
							<h3>Metadata</h3>
							<div class="meta-list">
								<div><span>Topic</span><strong>{detail.primary_topic}</strong></div>
								<div><span>Format</span><strong>{formatEnumLabel(detail.format)}</strong></div>
								<div><span>CTA</span><strong>{formatEnumLabel(detail.cta_type)}</strong></div>
								<div><span>Evergreen</span><strong>{formatEnumLabel(detail.evergreen_status)}</strong></div>
								<div><span>Repurpose</span><strong>{formatEnumLabel(detail.repurpose_potential)}</strong></div>
								<div><span>Origin</span><strong>{formatEnumLabel(detail.origin_type)}</strong></div>
							</div>
							<div class="badge-row">
								{#each detail.theme_tags as tag}
									<span class="badge">{tag}</span>
								{/each}
							</div>
						</article>

						<article class="detail-card">
							<h3>Hook</h3>
							<p>{detail.hook}</p>
							<h3>Summary</h3>
							<p>{detail.content_summary || 'No summary added yet.'}</p>
							<h3>AI retrieval note</h3>
							<p>{detail.ai_retrieval_notes || 'No retrieval notes yet.'}</p>
						</article>
					</div>

					<article class="detail-card">
						<h3>Canonical text</h3>
						<pre class="content-text">{detail.canonical_content_text}</pre>
					</article>

					<article class="detail-card">
						<h3>Platform publishes</h3>
						<div class="distribution-grid">
							{#each detail.distributions as distribution}
								<div class="distribution-card">
									<div class="distribution-head">
										<div>
											<strong>{formatPlatformLabel(distribution.platform)}</strong>
											<p>{distribution.variant_label || 'Primary version'}</p>
										</div>
										<a href={distribution.published_url} target="_blank" rel="noreferrer">Open ↗</a>
									</div>
									<div class="badge-row">
										<span class="badge">Score {Math.round(distribution.performance_score)}</span>
										<span class="badge">Views {formatCount(distribution.views || distribution.impressions)}</span>
										<span class="badge">Eng {formatCount(distribution.likes + distribution.comments + distribution.shares + distribution.saves + distribution.clicks + distribution.replies)}</span>
									</div>
									<p class="distribution-date">{formatDateTime(distribution.published_at)}</p>
									<p>{distribution.platform_text || 'No platform-specific copy saved.'}</p>
								</div>
							{/each}
						</div>
					</article>

					<article class="detail-card">
						<h3>Similar content</h3>
						<div class="similar-grid">
							{#if detail.similar_items?.length}
								{#each detail.similar_items as item}
									<button class="similar-card" onclick={() => selectItem(item.id)}>
										{#if item.preview_image_url}
											<img src={item.preview_image_url} alt="" />
										{/if}
										<div>
											<strong>{item.title}</strong>
											<p>{item.primary_topic}</p>
										</div>
									</button>
								{/each}
							{:else}
								<p class="muted-copy">No similar content surfaced yet.</p>
							{/if}
						</div>
					</article>
				</div>
			{/if}
		</section>
	</div>
</div>

<style>
	.content-page {
		padding: 28px;
		display: flex;
		flex-direction: column;
		gap: 20px;
	}

	.content-header,
	.section-head,
	.content-card-head,
	.card-meta,
	.detail-header,
	.header-actions,
	.distribution-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 16px;
	}

	.content-header {
		align-items: flex-start;
	}

	.eyebrow {
		margin: 0 0 6px;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		font-size: 11px;
		font-weight: 700;
		color: #7f82a0;
	}

	h1,
	h2,
	h3,
	p {
		margin: 0;
	}

	h1 {
		font-family: var(--font-ui, 'Plus Jakarta Sans', sans-serif);
		font-size: 34px;
		color: #121727;
	}

	.header-copy,
	.detail-meta,
	.card-meta,
	.distribution-date,
	.muted-copy,
	.section-head p {
		color: #70788f;
		font-size: 14px;
	}

	.primary-button,
	.ghost-button,
	.view-chip,
	.badge,
	.score-pill {
		font-family: var(--font-ui, 'Plus Jakarta Sans', sans-serif);
	}

	.primary-button,
	.ghost-button {
		border: none;
		border-radius: 12px;
		padding: 11px 16px;
		text-decoration: none;
		font-weight: 700;
		cursor: pointer;
	}

	.primary-button {
		background: #635bff;
		color: white;
	}

	.ghost-button {
		background: white;
		color: #1b2133;
		border: 1px solid #e6e9f2;
	}

	.metric-grid {
		display: grid;
		grid-template-columns: repeat(6, minmax(0, 1fr));
		gap: 14px;
	}

	.metric-card,
	.detail-card,
	.library-list,
	.detail-pane,
	.filter-bar {
		background: white;
		border: 1px solid #e6e9f2;
		border-radius: 18px;
	}

	.metric-card {
		padding: 16px;
	}

	.metric-card span,
	.stat-block span {
		display: block;
		font-size: 12px;
		color: #7f82a0;
		margin-bottom: 6px;
	}

	.metric-card strong,
	.stat-block strong {
		font-size: 24px;
		color: #141826;
	}

	.view-row {
		display: flex;
		flex-wrap: wrap;
		gap: 10px;
	}

	.view-chip {
		border: none;
		border-radius: 999px;
		padding: 8px 13px;
		background: #eaecf7;
		color: #6a728b;
		font-weight: 700;
		cursor: pointer;
	}

	.view-chip.active {
		background: #edeaff;
		color: #5145d8;
	}

	.filter-bar {
		padding: 14px;
		display: grid;
		grid-template-columns: minmax(280px, 2fr) repeat(4, minmax(0, 1fr));
		gap: 12px;
	}

	.search-field input,
	select {
		width: 100%;
		border: 1px solid #dfe3ef;
		border-radius: 12px;
		padding: 12px 14px;
		font-size: 14px;
		background: #fff;
	}

	.setup-banner {
		background: #fff7dd;
		border: 1px solid #f6d776;
		color: #7b5e00;
		border-radius: 14px;
		padding: 14px 16px;
	}

	.error-banner {
		background: #fff1f2;
		border-color: #fecdd3;
		color: #9f1239;
	}

	.workspace {
		display: grid;
		grid-template-columns: minmax(360px, 0.95fr) minmax(0, 1.25fr);
		gap: 18px;
		min-height: 620px;
	}

	.library-list,
	.detail-pane {
		padding: 18px;
	}

	.card-list,
	.detail-scroll {
		display: flex;
		flex-direction: column;
		gap: 14px;
	}

	.content-card,
	.similar-card {
		border: 1px solid #e6e9f2;
		background: #fbfcff;
		border-radius: 18px;
		padding: 12px;
		display: flex;
		gap: 14px;
		text-align: left;
		cursor: pointer;
	}

	.content-card.active {
		border-color: #8f85ff;
		box-shadow: 0 0 0 1px rgba(99, 91, 255, 0.12);
	}

	.content-card-thumb,
	.thumb-fallback {
		width: 96px;
		height: 96px;
		border-radius: 14px;
		object-fit: cover;
		background: #eef1f8;
		flex-shrink: 0;
	}

	.thumb-fallback {
		display: flex;
		align-items: center;
		justify-content: center;
		color: #7e8599;
		font-size: 12px;
	}

	.content-card-copy {
		min-width: 0;
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 10px;
	}

	.content-card h3 {
		font-size: 17px;
		color: #111827;
	}

	.content-card-hook {
		color: #4c5568;
		font-size: 14px;
		line-height: 1.45;
		display: -webkit-box;
		-webkit-line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}

	.score-pill,
	.badge {
		display: inline-flex;
		align-items: center;
		border-radius: 999px;
		padding: 6px 10px;
		font-size: 12px;
		font-weight: 700;
	}

	.score-pill {
		background: #edeaff;
		color: #5145d8;
	}

	.badge-row {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
	}

	.badge {
		background: #f1f4fb;
		color: #556074;
	}

	.empty-state {
		min-height: 220px;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		text-align: center;
		gap: 12px;
		color: #677084;
	}

	.detail-scroll {
		max-height: calc(100vh - 180px);
		overflow: auto;
		padding-right: 4px;
	}

	.detail-hero {
		width: 100%;
		border-radius: 20px;
		object-fit: cover;
		max-height: 280px;
	}

	.detail-metrics,
	.detail-grid,
	.distribution-grid,
	.similar-grid {
		display: grid;
		gap: 14px;
	}

	.detail-metrics {
		grid-template-columns: repeat(4, minmax(0, 1fr));
	}

	.stat-block,
	.distribution-card,
	.similar-card {
		background: #fbfcff;
		border: 1px solid #e6e9f2;
		border-radius: 16px;
		padding: 14px;
	}

	.detail-grid {
		grid-template-columns: repeat(2, minmax(0, 1fr));
	}

	.detail-card {
		padding: 18px;
		display: flex;
		flex-direction: column;
		gap: 14px;
	}

	.meta-list {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 12px;
	}

	.meta-list span {
		display: block;
		font-size: 12px;
		color: #7f82a0;
		margin-bottom: 5px;
	}

	.meta-list strong {
		font-size: 14px;
		color: #101727;
	}

	.content-text {
		margin: 0;
		white-space: pre-wrap;
		word-break: break-word;
		font-family: inherit;
		background: #f6f8fc;
		border-radius: 16px;
		padding: 16px;
		color: #1d2434;
	}

	.distribution-grid,
	.similar-grid {
		grid-template-columns: repeat(2, minmax(0, 1fr));
	}

	.distribution-head a {
		color: #5145d8;
		text-decoration: none;
		font-weight: 700;
	}

	.similar-card {
		align-items: center;
	}

	.similar-card img {
		width: 64px;
		height: 64px;
		border-radius: 14px;
		object-fit: cover;
	}

	@media (max-width: 1200px) {
		.metric-grid {
			grid-template-columns: repeat(3, minmax(0, 1fr));
		}

		.workspace {
			grid-template-columns: 1fr;
		}
	}

	@media (max-width: 900px) {
		.content-page {
			padding: 18px;
		}

		.content-header {
			flex-direction: column;
		}

		.filter-bar,
		.detail-grid,
		.distribution-grid,
		.detail-metrics,
		.similar-grid {
			grid-template-columns: 1fr;
		}
	}
</style>
