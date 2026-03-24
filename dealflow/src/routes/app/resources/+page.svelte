<script>
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { browser } from '$app/environment';
	import { isAcademy, isAdmin } from '$lib/stores/auth.js';

	let searchQuery = $state('');
	let activeCategory = $state('All');
	let videos = $state([]);
	let selectedVideo = $state(null);
	let loading = $state(true);

	const categories = ['All', 'Office Hours', 'Deal Reviews', 'Education'];

	function badgeClass(category) {
		if (category === 'Office Hours') return 'resource-badge-office';
		if (category === 'Deal Reviews') return 'resource-badge-deal';
		return 'resource-badge-education';
	}

	const filteredVideos = $derived(
		videos.filter((v) => {
			if (activeCategory !== 'All' && v.category !== activeCategory) return false;
			if (searchQuery) {
				const q = searchQuery.toLowerCase().trim();
				if (
					v.title.toLowerCase().indexOf(q) < 0 &&
					v.category.toLowerCase().indexOf(q) < 0
				)
					return false;
			}
			return true;
		})
	);

	const previewCards = [
		{ title: 'Office Hours: Deal Review', category: 'Office Hours' },
		{ title: 'How to Evaluate a Debt Fund', category: 'Education' },
		{ title: 'GP Spotlight Interview', category: 'Deal Reviews' },
		{ title: 'Understanding PPMs', category: 'Education' },
		{ title: 'Tax Benefits of Passive RE', category: 'Education' },
		{ title: 'Office Hours: Q&A Session', category: 'Office Hours' }
	];

	function getThumbnail(v) {
		if (v.thumbnail) return v.thumbnail;
		if (v.youtubeId) return `https://img.youtube.com/vi/${v.youtubeId}/mqdefault.jpg`;
		return '';
	}

	function formatDate(dateStr) {
		if (!dateStr) return '';
		return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
			month: 'short',
			day: 'numeric',
			year: 'numeric'
		});
	}

	function openVideo(video) {
		selectedVideo = video;
		if (browser) document.body.style.overflow = 'hidden';
	}

	function closeModal() {
		selectedVideo = null;
		if (browser) document.body.style.overflow = '';
	}

	function handleOverlayClick(e) {
		if (e.target === e.currentTarget) closeModal();
	}

	function handleKeydown(e) {
		if (e.key === 'Escape' && selectedVideo) closeModal();
	}

	onMount(async () => {
		const requestedCategory = $page.url.searchParams.get('category');
		if (requestedCategory && categories.includes(requestedCategory)) {
			activeCategory = requestedCategory;
		}

		try {
			const res = await fetch('/api/resources');
			if (res.ok) {
				const data = await res.json();
				if (Array.isArray(data)) videos = data;
				else if (data.videos) videos = data.videos;
			}
		} catch (e) {
			// API may not exist yet — gracefully fall through to coming-soon state
		} finally {
			loading = false;
		}
	});
</script>

<svelte:head><title>Resources | GYC</title></svelte:head>
<svelte:window onkeydown={handleKeydown} />

<div class="resources-page">
	{#if !$isAcademy && !$isAdmin}
		<!-- Academy gate -->
		<div class="gate-wrap">
			<div class="academy-gate-cta">
				<div class="gate-icon">
					<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2">
						<rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
						<path d="M7 11V7a5 5 0 0110 0v4" />
					</svg>
				</div>
				<div class="gate-title">Unlock the Resource Library</div>
				<div class="gate-sub">
					Office hours recordings, deal reviews, and educational content — exclusively for Academy
					members.
				</div>
				<a href="/app/academy" class="gate-btn">See What's Included &rarr;</a>
				<div class="gate-features">
					<span>
						<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
							><polyline points="20 6 9 17 4 12" /></svg
						>Full DD Checklist</span
					>
					<span>
						<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
							><polyline points="20 6 9 17 4 12" /></svg
						>Deal Comparison</span
					>
					<span>
						<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
							><polyline points="20 6 9 17 4 12" /></svg
						>Risk Analysis</span
					>
				</div>
			</div>
		</div>
	{:else if loading}
		<div class="loading-state">
			<div class="resource-grid">
				{#each Array(6) as _}
					<div class="sk-card"><div class="sk-thumb"></div><div class="sk-text" style="width:70%"></div><div class="sk-text" style="width:40%"></div></div>
				{/each}
			</div>
		</div>
	{:else if videos.length === 0}
		<div class="page-desc">
			Office hours recordings, deal reviews, and educational content from the Cashflow Academy.
		</div>
		<div class="resource-library-empty">
			<div class="empty-icon">&#127916;</div>
			<div class="empty-title">Your resource library is ready</div>
			<div class="empty-desc">
				Recorded office hours, deal reviews, and training sessions appear here as soon as they are published to the member library.
			</div>
			<div class="empty-actions">
				<a href="/app/office-hours" class="gate-btn">View Office Hours</a>
				<a href="/app/deals" class="resource-empty-link">Browse Deal Flow</a>
			</div>
		</div>
	{:else}
		<!-- Active resources view -->
		<div class="page-desc">
			Office hours recordings, deal reviews, and educational content from the Cashflow Academy.
		</div>

		<div class="search-wrap">
			<svg
				class="search-icon"
				viewBox="0 0 24 24"
				fill="none"
				stroke="var(--text-muted)"
				stroke-width="2"
				width="16"
				height="16"
			>
				<circle cx="11" cy="11" r="8" />
				<line x1="21" y1="21" x2="16.65" y2="16.65" />
			</svg>
			<input
				type="text"
				class="resource-search"
				placeholder="Search resources..."
				bind:value={searchQuery}
			/>
		</div>

		<div class="resource-filters">
			{#each categories as cat}
				<button
					class="resource-filter-btn"
					class:active={activeCategory === cat}
					onclick={() => (activeCategory = cat)}
				>
					{cat}
				</button>
			{/each}
		</div>

		{#if filteredVideos.length === 0}
			<div class="empty-state">
				<div class="empty-icon">&#127909;</div>
				<div class="empty-title">No resources found</div>
				<div class="empty-desc">
					{searchQuery ? 'Try a different search term.' : 'No recordings are available in this category yet.'}
				</div>
			</div>
		{:else}
			<div class="resource-grid">
				{#each filteredVideos as video}
					<div
						class="resource-card"
						onclick={() => openVideo(video)}
						onkeydown={(e) => e.key === 'Enter' && openVideo(video)}
						role="button"
						tabindex="0"
					>
						<div class="resource-thumb">
							{#if getThumbnail(video)}
								<img src={getThumbnail(video)} alt="" loading="lazy" />
							{/if}
							<div class="play-overlay">
								<div class="play-btn">
									<svg viewBox="0 0 24 24" fill="none" width="24" height="24">
										<polygon points="5 3 19 12 5 21 5 3" fill="#1a2e35" />
									</svg>
								</div>
							</div>
						</div>
						<div class="resource-meta">
							<h3>{video.title || 'Untitled'}</h3>
							<div class="resource-info">
								<span class="resource-badge {badgeClass(video.category)}">
									{video.category || ''}
								</span>
								{#if video.date}
									<span>{formatDate(video.date)}</span>
								{/if}
								{#if video.duration}
									<span>&middot; {video.duration}</span>
								{/if}
							</div>
						</div>
					</div>
				{/each}
			</div>
		{/if}
	{/if}
</div>

<!-- Video modal -->
{#if selectedVideo}
	<div
		class="resource-modal-overlay"
		onclick={handleOverlayClick}
		onkeydown={(e) => e.key === 'Escape' && closeModal()}
		role="dialog"
		tabindex="-1"
	>
		<div class="resource-modal">
			<div class="resource-modal-header">
				<h3>{selectedVideo.title || ''}</h3>
				<button class="resource-modal-close" onclick={closeModal}>&times;</button>
			</div>
			{#if selectedVideo.youtubeId}
				<div class="video-container">
					<iframe
						src="https://www.youtube.com/embed/{selectedVideo.youtubeId}?autoplay=1&rel=0&playsinline=1"
						title={selectedVideo.title}
						allowfullscreen
						allow="autoplay"
					></iframe>
				</div>
			{:else if selectedVideo.url}
				<div class="video-container">
					<p style="padding:40px;text-align:center;">
						<a href={selectedVideo.url} target="_blank" rel="noopener">Open video in new tab</a>
					</p>
				</div>
			{/if}
		</div>
	</div>
{/if}

<style>
	.resources-page {
		max-width: 1100px;
		margin: 0 auto;
		padding: 0 20px 40px;
	}

	.page-desc {
		font-family: var(--font-body);
		font-size: 14px;
		color: var(--text-secondary);
		max-width: 500px;
		margin-bottom: 24px;
	}

	/* ===== Gate CTA ===== */
	.gate-wrap {
		padding: 60px 20px;
		text-align: center;
	}
	.academy-gate-cta {
		max-width: 440px;
		margin: 0 auto;
		text-align: center;
	}
	.gate-icon {
		width: 48px;
		height: 48px;
		border-radius: 50%;
		background: var(--primary, #51be7b);
		display: flex;
		align-items: center;
		justify-content: center;
		margin: 0 auto 16px;
	}
	.gate-title {
		font-family: var(--font-ui);
		font-size: 20px;
		font-weight: 800;
		color: var(--text-dark);
		margin-bottom: 8px;
	}
	.gate-sub {
		font-family: var(--font-body);
		font-size: 14px;
		color: var(--text-secondary);
		line-height: 1.6;
		margin-bottom: 20px;
	}
	.gate-btn {
		display: inline-block;
		padding: 12px 28px;
		background: var(--primary, #51be7b);
		color: #fff;
		border: none;
		border-radius: 8px;
		font-family: var(--font-ui);
		font-size: 14px;
		font-weight: 700;
		cursor: pointer;
		text-decoration: none;
		transition: opacity 0.15s;
	}
	.gate-btn:hover {
		opacity: 0.9;
	}
	.gate-features {
		display: flex;
		justify-content: center;
		gap: 16px;
		margin-top: 20px;
		flex-wrap: wrap;
	}
	.gate-features span {
		display: flex;
		align-items: center;
		gap: 4px;
		font-family: var(--font-ui);
		font-size: 12px;
		color: var(--text-secondary);
	}
	.gate-features svg {
		width: 14px;
		height: 14px;
		color: var(--primary, #51be7b);
	}

	/* ===== Loading ===== */
	.loading-state {
		padding: 20px 0;
	}

	.resource-library-empty {
		background: var(--bg-card);
		border: 1px solid var(--border);
		border-radius: var(--radius);
		padding: 40px 32px;
		text-align: center;
		box-shadow: var(--shadow-card);
	}
	.empty-actions {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 12px;
		flex-wrap: wrap;
		margin-top: 20px;
	}
	.resource-empty-link {
		font-family: var(--font-ui);
		font-size: 13px;
		font-weight: 700;
		color: var(--primary);
		text-decoration: none;
	}

	/* ===== Search & Filters ===== */
	.search-wrap {
		position: relative;
		margin-bottom: 12px;
	}
	.search-icon {
		position: absolute;
		left: 12px;
		top: 50%;
		transform: translateY(-50%);
		pointer-events: none;
	}
	.resource-search {
		width: 100%;
		box-sizing: border-box;
		padding: 8px 14px 8px 36px;
		border: 1px solid var(--border);
		border-radius: 20px;
		font-family: var(--font-body);
		font-size: 13px;
		color: var(--text-dark);
		background: var(--bg-card);
		outline: none;
	}
	.resource-search:focus {
		border-color: var(--primary);
	}

	.resource-filters {
		display: flex;
		align-items: center;
		gap: 8px;
		margin-bottom: 24px;
		flex-wrap: wrap;
	}
	.resource-filter-btn {
		padding: 7px 16px;
		border: 1px solid var(--border);
		border-radius: 20px;
		background: var(--bg-card);
		font-family: var(--font-ui);
		font-size: 12px;
		font-weight: 600;
		color: var(--text-secondary);
		cursor: pointer;
		transition: all 0.15s;
	}
	.resource-filter-btn:hover {
		border-color: var(--primary);
		color: var(--primary);
	}
	.resource-filter-btn.active {
		background: var(--primary);
		color: #fff;
		border-color: var(--primary);
	}

	/* ===== Grid ===== */
	.resource-grid {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 20px;
	}

	/* ===== Card ===== */
	.resource-card {
		background: var(--bg-card);
		border: 1px solid var(--border);
		border-radius: var(--radius);
		overflow: hidden;
		cursor: pointer;
		transition: all 0.2s;
	}
	.resource-card:hover {
		border-color: var(--primary);
		box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
		transform: translateY(-2px);
	}
	.preview-card {
		pointer-events: none;
	}

	.resource-thumb {
		position: relative;
		padding-bottom: 56.25%;
		background: var(--bg-sidebar);
		overflow: hidden;
	}
	.resource-thumb img {
		position: absolute;
		top: 0;
		left: 0;
		width: 100%;
		height: 100%;
		object-fit: cover;
	}
	.play-overlay {
		position: absolute;
		inset: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		background: rgba(0, 0, 0, 0.25);
		transition: background 0.2s;
	}
	.resource-card:hover .play-overlay {
		background: rgba(0, 0, 0, 0.4);
	}
	.play-btn {
		width: 52px;
		height: 52px;
		border-radius: 50%;
		background: rgba(255, 255, 255, 0.95);
		display: flex;
		align-items: center;
		justify-content: center;
		box-shadow: 0 2px 12px rgba(0, 0, 0, 0.2);
	}

	.resource-meta {
		padding: 16px;
	}
	.resource-meta h3 {
		font-family: var(--font-ui);
		font-size: 14px;
		font-weight: 700;
		color: var(--text-dark);
		margin: 0 0 6px;
		line-height: 1.4;
	}
	.resource-info {
		display: flex;
		align-items: center;
		gap: 8px;
		font-family: var(--font-ui);
		font-size: 12px;
		color: var(--text-muted);
	}

	/* ===== Badge Colors ===== */
	.resource-badge {
		display: inline-block;
		padding: 2px 8px;
		border-radius: 10px;
		font-family: var(--font-ui);
		font-size: 10px;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.3px;
	}
	:global(.resource-badge-office) {
		background: rgba(81, 190, 123, 0.1);
		color: var(--primary, #51be7b);
	}
	:global(.resource-badge-education) {
		background: rgba(139, 92, 246, 0.1);
		color: #8b5cf6;
	}
	:global(.resource-badge-deal) {
		background: rgba(59, 130, 246, 0.1);
		color: #3b82f6;
	}

	/* ===== Empty State ===== */
	.empty-state {
		text-align: center;
		padding: 60px 20px;
	}
	.empty-state .empty-icon {
		font-size: 48px;
		margin-bottom: 12px;
		opacity: 0.3;
	}
	.empty-state .empty-title {
		font-family: var(--font-ui);
		font-size: 16px;
		font-weight: 700;
		color: var(--text-secondary);
		margin-bottom: 4px;
	}
	.empty-state .empty-desc {
		font-family: var(--font-body);
		font-size: 13px;
		color: var(--text-muted);
	}

	/* ===== Modal ===== */
	.resource-modal-overlay {
		position: fixed;
		inset: 0;
		z-index: 9999;
		display: flex;
		align-items: center;
		justify-content: center;
		background: rgba(0, 0, 0, 0.7);
		backdrop-filter: blur(4px);
		-webkit-backdrop-filter: blur(4px);
	}
	.resource-modal {
		width: 90%;
		max-width: 900px;
		background: var(--bg-card);
		border-radius: var(--radius);
		overflow: hidden;
		box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
	}
	.resource-modal-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 16px 20px;
		border-bottom: 1px solid var(--border);
	}
	.resource-modal-header h3 {
		font-family: var(--font-ui);
		font-size: 15px;
		font-weight: 700;
		color: var(--text-dark);
		margin: 0;
	}
	.resource-modal-close {
		background: none;
		border: none;
		font-size: 22px;
		cursor: pointer;
		color: var(--text-muted);
		padding: 4px;
	}
	.video-container {
		position: relative;
		padding-bottom: 56.25%;
		height: 0;
	}
	.video-container iframe {
		position: absolute;
		top: 0;
		left: 0;
		width: 100%;
		height: 100%;
		border: none;
	}

	/* ===== Responsive ===== */
	@media (max-width: 900px) {
		.resource-grid {
			grid-template-columns: repeat(2, 1fr);
		}
	}
	@media (min-width: 769px) and (max-width: 1024px) {
		.resources-page {
			padding: 0 24px 40px;
		}

		.resource-grid {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
	}
	@media (max-width: 600px) {
		.resource-grid {
			grid-template-columns: 1fr;
			gap: 16px;
		}
		.resource-filters {
			flex-wrap: nowrap;
			overflow-x: auto;
			-webkit-overflow-scrolling: touch;
			scrollbar-width: none;
			padding-bottom: 4px;
			gap: 6px;
		}
		.resource-filters::-webkit-scrollbar {
			display: none;
		}
		.resource-filter-btn {
			flex-shrink: 0;
			padding: 8px 16px;
			font-size: 13px;
			-webkit-tap-highlight-color: transparent;
		}
		.resource-search {
			font-size: 16px;
			padding: 10px 14px 10px 36px;
		}
		.resource-card:hover {
			transform: none;
			box-shadow: none;
		}
	}
	.sk-card { background: var(--bg-card, #fff); border: 1px solid var(--border, #e5e7eb); border-radius: 12px; overflow: hidden; }
	.sk-thumb { width: 100%; height: 140px; background: var(--border-light, #e5e7eb); animation: skPulse 1.5s infinite; }
	.sk-text { height: 12px; background: var(--border-light, #e5e7eb); border-radius: 6px; margin: 12px 16px 0; animation: skPulse 1.5s infinite; }
	.sk-text:last-child { margin-bottom: 16px; }
	@keyframes skPulse { 0%, 100% { opacity: 0.4; } 50% { opacity: 0.8; } }
</style>
