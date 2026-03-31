<script>
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { browser } from '$app/environment';
	import CompanionGate from '$lib/components/CompanionGate.svelte';
	import { getStoredSessionToken, isMember, userToken } from '$lib/stores/auth.js';
	import { isNativeApp } from '$lib/utils/platform.js';
	import PageContainer from '$lib/layout/PageContainer.svelte';
	import PageHeader from '$lib/layout/PageHeader.svelte';

	let searchQuery = $state('');
	let activeCategory = $state('All');
	let videos = $state([]);
	let sections = $state([]);
	let selectedVideo = $state(null);
	let loading = $state(true);
	const nativeCompanionMode = browser && isNativeApp();

	const categories = $derived.by(() => {
		const cats = ['All'];
		for (const section of sections) {
			cats.push(section.title);
		}
		return cats;
	});

	const filteredVideos = $derived.by(() =>
		videos.filter((video) => {
			if (activeCategory !== 'All' && video.category !== activeCategory) return false;
			if (!searchQuery.trim()) return true;
			const q = searchQuery.trim().toLowerCase();
			return [video.title, video.category, video.description, video.module]
				.filter(Boolean)
				.some((value) => String(value).toLowerCase().includes(q));
		})
	);

	function badgeClass(category) {
		if (category === 'Strategy') return 'resource-badge-strategy';
		if (category === 'Deal Flow') return 'resource-badge-dealflow';
		if (category === 'Execution') return 'resource-badge-execution';
		return 'resource-badge-strategy';
	}

	function getThumbnail(video) {
		if (video.thumbnail) return video.thumbnail;
		if (video.youtubeId) return `https://img.youtube.com/vi/${video.youtubeId}/maxresdefault.jpg`;
		return '';
	}

	function handleThumbnailError(event, video) {
		const image = event.currentTarget;
		if (!image || !video?.youtubeId) return;
		if (image.dataset.fallbackApplied === 'hq') {
			image.onerror = null;
			image.src = `https://img.youtube.com/vi/${video.youtubeId}/mqdefault.jpg`;
			image.dataset.fallbackApplied = 'mq';
			return;
		}
		image.src = `https://img.youtube.com/vi/${video.youtubeId}/hqdefault.jpg`;
		image.dataset.fallbackApplied = 'hq';
	}

	function isPlayable(video) {
		return Boolean(video?.playable || video?.youtubeId || video?.url);
	}

	function closeModal() {
		selectedVideo = null;
		if (browser) document.body.style.overflow = '';
	}

	function openVideo(video) {
		if (!video) return;
		if (!isPlayable(video)) return;
		if (video.youtubeId) {
			selectedVideo = video;
			if (browser) document.body.style.overflow = 'hidden';
			return;
		}
		if (video.url && browser) {
			window.open(video.url, '_blank', 'noopener');
		}
	}

	function handleOverlayClick(event) {
		if (event.target === event.currentTarget) closeModal();
	}

	function handleKeydown(event) {
		if (event.key === 'Escape' && selectedVideo) closeModal();
	}

	async function loadResources() {
		const token = $userToken || getStoredSessionToken();
		if (!token) {
			loading = false;
			videos = [];
			return;
		}

		try {
			const response = await fetch('/api/resources', {
				headers: {
					Authorization: `Bearer ${token}`
				}
			});
			if (!response.ok) throw new Error(`Resources load failed: ${response.status}`);
			const payload = await response.json();
			videos = Array.isArray(payload) ? payload : payload.videos || [];
			sections = payload.sections || [];
		} catch (error) {
			console.warn('Resources unavailable:', error.message);
			videos = [];
		} finally {
			loading = false;
		}
	}

	onMount(() => {
		const requestedCategory = $page.url.searchParams.get('category');
		if (requestedCategory) {
			activeCategory = requestedCategory;
		}
		loadResources();
	});
</script>

<svelte:head>
	<title>Resources | GYC</title>
</svelte:head>

<svelte:window onkeydown={handleKeydown} />

<PageContainer className="resources-shell ly-page-stack">
	<PageHeader
		title="Resources"
		subtitle="Structured video courses covering strategy, deal sourcing, and execution — everything you need to invest in commercial real estate with confidence."
	/>

	<div class="resources-page">
		{#if !$isMember}
			<div class="gate-wrap">
				<div class="academy-gate-cta">
					{#if nativeCompanionMode}
					<CompanionGate
						title="Available to existing members"
						message="Cashflow Academy lessons, deal reviews, and office hours are available to existing members on the web."
						note="Enrollment and billing are not offered in the iOS app."
					/>
				{:else}
					<div class="gate-icon">
						<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2">
							<rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
							<path d="M7 11V7a5 5 0 0 1 10 0v4" />
						</svg>
					</div>
					<div class="gate-title">Unlock Cashflow Academy</div>
					<div class="gate-sub">
						Structured courses on strategy, deal flow, and execution — built for passive real estate investors who want to invest with confidence.
					</div>
					<a href="/app/academy" class="gate-btn">See What's Included &rarr;</a>
				{/if}
			</div>
		</div>
	{:else if loading}
		<div class="loading-state">
			<div class="resource-grid">
				{#each Array(6) as _}
					<div class="sk-card">
						<div class="sk-thumb"></div>
						<div class="sk-text" style="width:68%"></div>
						<div class="sk-text" style="width:40%"></div>
					</div>
				{/each}
			</div>
		</div>
		{:else}
			<div class="library-toolbar">
				<div class="search-wrap">
					<svg class="search-icon" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" stroke-width="2" width="16" height="16">
					<circle cx="11" cy="11" r="8" />
					<line x1="21" y1="21" x2="16.65" y2="16.65" />
				</svg>
				<input type="text" class="resource-search" placeholder="Search lessons..." bind:value={searchQuery} />
			</div>

			<div class="resource-filters">
				{#each categories as category}
					<button class="resource-filter-btn" class:active={activeCategory === category} onclick={() => (activeCategory = category)}>
						{category}
					</button>
				{/each}
			</div>
		</div>

		{#if filteredVideos.length === 0}
			<div class="empty-state">
				<div class="empty-title">No lessons match that search.</div>
				<div class="empty-desc">Try a different keyword or switch back to all sections.</div>
			</div>
		{:else}
			<div class="resource-grid">
				{#each filteredVideos as video}
					<button
						class="resource-card"
						class:is-disabled={!isPlayable(video)}
						onclick={() => openVideo(video)}
						disabled={!isPlayable(video)}
					>
						<div class="resource-thumb">
							{#if getThumbnail(video)}
								<img src={getThumbnail(video)} alt="" loading="lazy" onerror={(event) => handleThumbnailError(event, video)} />
							{:else}
								<div class="resource-thumb-fallback">
									<span>{video.category}</span>
									<strong>{video.module || 'Lesson'}</strong>
								</div>
							{/if}
							{#if isPlayable(video)}
								<div class="play-overlay">
									<div class="play-btn">
										<svg viewBox="0 0 24 24" fill="none" width="22" height="22">
											<polygon points="7 5 19 12 7 19 7 5" fill="#17343a" />
										</svg>
									</div>
								</div>
							{/if}
						</div>
						<div class="resource-meta">
							<div class="resource-meta-top">
								<span class="resource-badge {badgeClass(video.category)}">{video.category}</span>
								{#if video.module}<span class="resource-module">{video.module}</span>{/if}
							</div>
							<h3>{video.title}</h3>
							<p>{video.description}</p>
							<div class="resource-meta-bottom">
								{#if video.duration}<span>{video.duration}</span>{/if}
								<span>{isPlayable(video) ? 'Watch lesson' : 'Video link coming soon'}</span>
							</div>
						</div>
					</button>
				{/each}
			</div>
			{/if}
		{/if}
	</div>

{#if selectedVideo}
	<div class="resource-modal-overlay" onclick={handleOverlayClick} role="dialog" tabindex="-1">
		<div class="resource-modal">
			<div class="resource-modal-header">
				<div class="resource-modal-info">
					<span class="resource-badge {badgeClass(selectedVideo.category)}">{selectedVideo.category}</span>
					{#if selectedVideo.module}<span class="resource-modal-module">{selectedVideo.module}</span>{/if}
				</div>
				<button class="resource-modal-close" onclick={closeModal}>&times;</button>
			</div>
			<div class="video-container">
				<iframe
					src={`https://www.youtube.com/embed/${selectedVideo.youtubeId}?autoplay=1&rel=0&playsinline=1`}
					title={selectedVideo.title}
					allowfullscreen
					allow="autoplay"
				></iframe>
			</div>
			<div class="resource-modal-body">
				<h3>{selectedVideo.title}</h3>
				<p>{selectedVideo.description}</p>
				{#if selectedVideo.duration}
					<div class="resource-modal-duration">{selectedVideo.duration}</div>
				{/if}
			</div>
		</div>
	</div>
	{/if}
</PageContainer>

<style>
	.resources-page { min-width: 0; }
	.gate-btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		padding: 12px 22px;
		border-radius: 999px;
		background: var(--primary);
		color: #fff;
		font-family: var(--font-ui);
		font-size: 13px;
		font-weight: 700;
		text-decoration: none;
		white-space: nowrap;
		border: none;
	}
	.featured-badge,
	.resource-badge {
		display: inline-flex;
		align-items: center;
		padding: 4px 10px;
		border-radius: 999px;
		font-family: var(--font-ui);
		font-size: 10px;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.4px;
	}
	.play-btn {
		width: 54px;
		height: 54px;
		border-radius: 50%;
		background: rgba(255, 255, 255, 0.94);
		display: flex;
		align-items: center;
		justify-content: center;
		box-shadow: 0 8px 24px rgba(0, 0, 0, 0.22);
	}
	.resource-meta-bottom,
	.resource-meta-top {
		display: flex;
		flex-wrap: wrap;
		gap: 10px;
		font-family: var(--font-ui);
		font-size: 12px;
		color: var(--text-muted);
	}

	.library-toolbar {
		display: grid;
		gap: 14px;
		margin-bottom: 20px;
	}
	.search-wrap {
		position: relative;
	}
	.search-icon {
		position: absolute;
		left: 14px;
		top: 50%;
		transform: translateY(-50%);
		pointer-events: none;
	}
	.resource-search {
		width: 100%;
		box-sizing: border-box;
		padding: 12px 16px 12px 40px;
		border: 1px solid var(--border);
		border-radius: 16px;
		background: var(--bg-card);
		font-family: var(--font-body);
		font-size: 14px;
		color: var(--text-dark);
	}

	.resource-thumb-fallback {
		height: 100%;
		background: linear-gradient(135deg, #0d2a30 0%, #204951 100%);
		color: rgba(255, 255, 255, 0.88);
		display: flex;
		flex-direction: column;
		justify-content: flex-end;
		gap: 8px;
		padding: 18px;
		box-sizing: border-box;
		font-family: var(--font-ui);
		text-align: left;
	}

	.resource-thumb-fallback span {
		font-size: 10px;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.12em;
		color: rgba(255, 255, 255, 0.62);
	}

	.resource-thumb-fallback strong {
		font-size: 20px;
		font-weight: 800;
		letter-spacing: -0.02em;
		line-height: 1.1;
	}

	.resource-card.is-disabled {
		cursor: default;
	}
	.resource-filters {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
	}
	.resource-filter-btn {
		padding: 8px 16px;
		border: 1px solid var(--border);
		border-radius: 999px;
		background: var(--bg-card);
		font-family: var(--font-ui);
		font-size: 12px;
		font-weight: 700;
		color: var(--text-secondary);
		cursor: pointer;
	}
	.resource-filter-btn.active {
		background: var(--primary);
		border-color: var(--primary);
		color: #fff;
	}

	.resource-grid {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 18px;
	}
	.resource-card {
		appearance: none;
		-webkit-appearance: none;
		padding: 0;
		border: 1px solid var(--border);
		border-radius: 20px;
		background: var(--bg-card);
		overflow: hidden;
		cursor: pointer;
		text-align: left;
	}
	.resource-thumb {
		position: relative;
		padding-bottom: 56.25%;
		overflow: hidden;
		line-height: 0;
		background:
			linear-gradient(135deg, rgba(81, 190, 123, 0.14), rgba(23, 52, 58, 0.2)),
			linear-gradient(160deg, #17343a, #102529);
	}
	.resource-thumb img {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		display: block;
		object-fit: cover;
		object-position: center;
		transform: scale(1.02);
	}
	.play-overlay {
		position: absolute;
		inset: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		background: rgba(0, 0, 0, 0.2);
	}
	.resource-meta {
		padding: 16px;
		display: grid;
		gap: 10px;
	}
	.resource-meta h3 {
		margin: 0;
		font-family: var(--font-ui);
		font-size: 15px;
		font-weight: 700;
		line-height: 1.4;
		color: var(--text-dark);
	}
	.resource-meta p {
		margin: 0;
		font-family: var(--font-body);
		font-size: 13px;
		line-height: 1.6;
		color: var(--text-secondary);
	}
	.resource-module {
		font-family: var(--font-ui);
		font-size: 11px;
		color: var(--text-muted);
	}

	.resource-badge-strategy {
		background: rgba(81, 190, 123, 0.12);
		color: var(--primary);
	}
	.resource-badge-dealflow {
		background: rgba(59, 130, 246, 0.12);
		color: #2563eb;
	}
	.resource-badge-execution {
		background: rgba(245, 158, 11, 0.14);
		color: #c87b10;
	}

	.gate-wrap {
		padding: 60px 20px;
		text-align: center;
	}
	.academy-gate-cta {
		max-width: 440px;
		margin: 0 auto;
	}
	.gate-icon {
		width: 48px;
		height: 48px;
		border-radius: 50%;
		background: var(--primary);
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
		line-height: 1.6;
		color: var(--text-secondary);
		margin-bottom: 18px;
	}

	.empty-state {
		padding: 48px 16px;
		border: 1px dashed var(--border);
		border-radius: 20px;
		text-align: center;
		color: var(--text-muted);
	}
	.empty-title {
		font-family: var(--font-ui);
		font-size: 16px;
		font-weight: 700;
		color: var(--text-dark);
		margin-bottom: 6px;
	}
	.empty-desc {
		font-family: var(--font-body);
		font-size: 13px;
		color: var(--text-secondary);
	}

	.loading-state {
		display: grid;
		gap: 18px;
	}
	.sk-thumb,
	.sk-text {
		background: var(--border-light, #e7ecef);
		animation: skPulse 1.5s infinite;
	}
	.sk-card {
		border: 1px solid var(--border);
		border-radius: 20px;
		background: var(--bg-card);
		overflow: hidden;
	}
	.sk-thumb {
		height: 180px;
	}
	.sk-text {
		height: 12px;
		border-radius: 999px;
		margin: 14px 16px 0;
	}
	.sk-text:last-child {
		margin-bottom: 16px;
	}
	@keyframes skPulse {
		0%, 100% { opacity: 0.45; }
		50% { opacity: 0.85; }
	}

	.resource-modal-overlay {
		position: fixed;
		inset: 0;
		z-index: 9999;
		display: flex;
		align-items: center;
		justify-content: center;
		background: rgba(0, 0, 0, 0.72);
	}
	.resource-modal {
		width: min(960px, 92vw);
		background: var(--bg-card);
		border-radius: 24px;
		overflow: hidden;
		box-shadow: 0 20px 60px rgba(0, 0, 0, 0.32);
	}
	.resource-modal-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 16px;
		padding: 16px 20px;
		border-bottom: 1px solid var(--border);
	}
	.resource-modal-info {
		display: flex;
		align-items: center;
		gap: 10px;
	}
	.resource-modal-module {
		font-family: var(--font-ui);
		font-size: 12px;
		color: var(--text-muted);
	}
	.resource-modal-close {
		border: none;
		background: none;
		font-size: 24px;
		color: var(--text-muted);
		cursor: pointer;
	}
	.video-container {
		position: relative;
		padding-bottom: 56.25%;
		height: 0;
	}
	.video-container iframe {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		border: none;
	}
	.resource-modal-body {
		padding: 20px 24px;
	}
	.resource-modal-body h3 {
		margin: 0 0 8px;
		font-family: var(--font-ui);
		font-size: 17px;
		font-weight: 700;
		color: var(--text-dark);
	}
	.resource-modal-body p {
		margin: 0;
		font-family: var(--font-body);
		font-size: 14px;
		line-height: 1.7;
		color: var(--text-secondary);
	}
	.resource-modal-duration {
		margin-top: 10px;
		font-family: var(--font-ui);
		font-size: 12px;
		color: var(--text-muted);
	}

	@media (max-width: 1024px) {
		.resource-grid {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
	}

	@media (max-width: 768px) {
		.resources-page {
			padding: 0 16px 36px;
		}
		.resource-grid {
			grid-template-columns: 1fr;
		}
		.resource-filters {
			flex-wrap: nowrap;
			overflow-x: auto;
			padding-bottom: 4px;
			scrollbar-width: none;
		}
		.resource-filters::-webkit-scrollbar {
			display: none;
		}
		.resource-filter-btn {
			flex-shrink: 0;
		}
	}
</style>
