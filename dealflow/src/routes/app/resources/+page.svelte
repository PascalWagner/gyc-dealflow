<script>
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { browser } from '$app/environment';
	import CompanionGate from '$lib/components/CompanionGate.svelte';
	import { getStoredSessionToken, isMember, userToken } from '$lib/stores/auth.js';
	import { isNativeApp } from '$lib/utils/platform.js';

	let searchQuery = $state('');
	let activeCategory = $state('All');
	let videos = $state([]);
	let selectedVideo = $state(null);
	let loading = $state(true);
	let replayLibraryUrl = $state('/app/office-hours');
	let sourceKind = $state('fallback');
	const nativeCompanionMode = browser && isNativeApp();

	const baseCategories = ['All', 'Office Hours', 'Deal Reviews', 'Education'];

	const categories = $derived.by(() => {
		const discovered = new Set(baseCategories);
		for (const video of videos) {
			if (video?.category) discovered.add(video.category);
		}
		return Array.from(discovered);
	});

	const filteredVideos = $derived.by(() =>
		videos.filter((video) => {
			if (activeCategory !== 'All' && video.category !== activeCategory) return false;
			if (!searchQuery.trim()) return true;
			const q = searchQuery.trim().toLowerCase();
			return [video.title, video.category, video.description]
				.filter(Boolean)
				.some((value) => String(value).toLowerCase().includes(q));
		})
	);

	const featuredVideo = $derived.by(
		() => filteredVideos.find((video) => video.featured) || filteredVideos[0] || videos[0] || null
	);

	const spotlightVideos = $derived.by(() =>
		(featuredVideo ? filteredVideos.filter((video) => video.id !== featuredVideo.id) : filteredVideos).slice(0, 3)
	);

	const libraryStats = $derived.by(() => ({
		total: videos.length,
		officeHours: videos.filter((video) => video.category === 'Office Hours').length,
		dealReviews: videos.filter((video) => video.category === 'Deal Reviews').length,
		education: videos.filter((video) => video.category === 'Education').length
	}));

	function badgeClass(category) {
		if (category === 'Office Hours') return 'resource-badge-office';
		if (category === 'Deal Reviews') return 'resource-badge-deal';
		return 'resource-badge-education';
	}

	function getThumbnail(video) {
		if (video.thumbnail) return video.thumbnail;
		if (video.youtubeId) return `https://img.youtube.com/vi/${video.youtubeId}/hqdefault.jpg`;
		return '';
	}

	function formatDate(dateValue) {
		if (!dateValue) return '';
		try {
			return new Date(dateValue).toLocaleDateString('en-US', {
				month: 'short',
				day: 'numeric',
				year: 'numeric'
			});
		} catch {
			return '';
		}
	}

	function closeModal() {
		selectedVideo = null;
		if (browser) document.body.style.overflow = '';
	}

	function openVideo(video) {
		if (!video) return;
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
			replayLibraryUrl = payload.replayLibraryUrl || replayLibraryUrl;
			sourceKind = payload.source || 'fallback';
		} catch (error) {
			console.warn('Resources unavailable:', error.message);
			videos = [];
		} finally {
			loading = false;
		}
	}

	onMount(() => {
		const requestedCategory = $page.url.searchParams.get('category');
		if (requestedCategory && baseCategories.includes(requestedCategory)) {
			activeCategory = requestedCategory;
		}
		loadResources();
	});
</script>

<svelte:head>
	<title>Resources | GYC</title>
</svelte:head>

<svelte:window onkeydown={handleKeydown} />

<div class="ly-page">
	<div class="ly-frame">
<div class="resources-page">
	{#if !$isMember}
		<div class="gate-wrap">
			<div class="academy-gate-cta">
				{#if nativeCompanionMode}
					<CompanionGate
						title="Available to existing members"
						message="Recorded office hours, deal reviews, and member lessons stay available to existing members on the web."
						note="Enrollment and billing are not offered in the iOS app."
					/>
				{:else}
					<div class="gate-icon">
						<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2">
							<rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
							<path d="M7 11V7a5 5 0 0 1 10 0v4" />
						</svg>
					</div>
					<div class="gate-title">Unlock the Resource Library</div>
					<div class="gate-sub">
						Recorded office hours, deal reviews, and Cash Flow Academy lessons live here for members.
					</div>
					<a href="/app/academy" class="gate-btn">See What's Included &rarr;</a>
				{/if}
			</div>
		</div>
	{:else if loading}
		<div class="loading-state">
			<div class="resource-stage">
				<div class="sk-hero"></div>
				<div class="sk-side"></div>
			</div>
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
		<div class="page-header">
			<div>
				<div class="page-eyebrow">Cash Flow Academy</div>
				<h1>Resources</h1>
				<p class="page-desc">
					A cleaner video library for office hours replays, deal reviews, and training lessons. This is where the member video shelf lives now.
				</p>
			</div>
			<a href={replayLibraryUrl} class="header-cta" target={replayLibraryUrl.startsWith('http') ? '_blank' : undefined} rel="noopener">
				Open Full Library
			</a>
		</div>

		<div class="resource-stats">
			<div class="resource-stat">
				<div class="resource-stat-label">Total Videos</div>
				<div class="resource-stat-value">{libraryStats.total}</div>
			</div>
			<div class="resource-stat">
				<div class="resource-stat-label">Office Hours</div>
				<div class="resource-stat-value">{libraryStats.officeHours}</div>
			</div>
			<div class="resource-stat">
				<div class="resource-stat-label">Deal Reviews</div>
				<div class="resource-stat-value">{libraryStats.dealReviews}</div>
			</div>
			<div class="resource-stat">
				<div class="resource-stat-label">Education</div>
				<div class="resource-stat-value">{libraryStats.education}</div>
			</div>
		</div>

		{#if featuredVideo}
			<div class="resource-stage">
				<button class="featured-card" onclick={() => openVideo(featuredVideo)}>
					<div class="featured-media">
						{#if getThumbnail(featuredVideo)}
							<img src={getThumbnail(featuredVideo)} alt="" loading="lazy" />
						{/if}
						<div class="featured-overlay">
							<div class="featured-badge {badgeClass(featuredVideo.category)}">{featuredVideo.category}</div>
							<div class="featured-play">
								<svg viewBox="0 0 24 24" fill="none" width="24" height="24">
									<polygon points="7 5 19 12 7 19 7 5" fill="#17343a" />
								</svg>
							</div>
						</div>
					</div>
					<div class="featured-copy">
						<div class="featured-kicker">Featured Replay</div>
						<h2>{featuredVideo.title}</h2>
						<p>{featuredVideo.description}</p>
						<div class="featured-meta">
							{#if formatDate(featuredVideo.date)}
								<span>{formatDate(featuredVideo.date)}</span>
							{/if}
							{#if featuredVideo.duration}
								<span>{featuredVideo.duration}</span>
							{/if}
							<span>{sourceKind === 'published-library' ? 'Published Library' : 'Member Library'}</span>
						</div>
					</div>
				</button>

				<div class="spotlight-panel">
					<div class="spotlight-header">
						<div class="spotlight-title">Quick Access</div>
						<a href={replayLibraryUrl} class="spotlight-link" target={replayLibraryUrl.startsWith('http') ? '_blank' : undefined} rel="noopener">
							Open all
						</a>
					</div>
					<div class="spotlight-list">
						{#each spotlightVideos as video}
							<button class="spotlight-item" onclick={() => openVideo(video)}>
								<div class="spotlight-item-title">{video.title}</div>
								<div class="spotlight-item-meta">
									<span class="resource-badge {badgeClass(video.category)}">{video.category}</span>
									{#if video.duration}<span>{video.duration}</span>{/if}
								</div>
							</button>
						{/each}
						{#if spotlightVideos.length === 0}
							<div class="spotlight-empty">More replays will appear here as the library grows.</div>
						{/if}
					</div>
				</div>
			</div>
		{/if}

		<div class="library-toolbar">
			<div class="search-wrap">
				<svg class="search-icon" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" stroke-width="2" width="16" height="16">
					<circle cx="11" cy="11" r="8" />
					<line x1="21" y1="21" x2="16.65" y2="16.65" />
				</svg>
				<input type="text" class="resource-search" placeholder="Search resources..." bind:value={searchQuery} />
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
				<div class="empty-title">No videos match that search.</div>
				<div class="empty-desc">Try a different keyword or switch back to all categories.</div>
			</div>
		{:else}
			<div class="resource-grid">
				{#each filteredVideos as video}
					<button class="resource-card" onclick={() => openVideo(video)}>
						<div class="resource-thumb">
							{#if getThumbnail(video)}
								<img src={getThumbnail(video)} alt="" loading="lazy" />
							{/if}
							<div class="play-overlay">
								<div class="play-btn">
									<svg viewBox="0 0 24 24" fill="none" width="22" height="22">
										<polygon points="7 5 19 12 7 19 7 5" fill="#17343a" />
									</svg>
								</div>
							</div>
						</div>
						<div class="resource-meta">
							<div class="resource-meta-top">
								<span class="resource-badge {badgeClass(video.category)}">{video.category}</span>
								{#if formatDate(video.date)}<span>{formatDate(video.date)}</span>{/if}
							</div>
							<h3>{video.title}</h3>
							<p>{video.description}</p>
							<div class="resource-meta-bottom">
								{#if video.duration}<span>{video.duration}</span>{/if}
								<span>{video.youtubeId ? 'Watch here' : 'Open library'}</span>
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
				<h3>{selectedVideo.title}</h3>
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
		</div>
	</div>
{/if}
</div>
</div>

<style>
	.resources-page {
		max-width: 1180px;
		margin: 0 auto;
		padding: 0 24px 48px;
	}

	.page-header {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 24px;
		margin-bottom: 22px;
	}
	.page-eyebrow {
		font-family: var(--font-ui);
		font-size: 11px;
		font-weight: 700;
		letter-spacing: 0.5px;
		text-transform: uppercase;
		color: var(--text-muted);
		margin-bottom: 10px;
	}
	h1 {
		margin: 0 0 10px;
		font-family: var(--font-headline);
		font-size: 42px;
		line-height: 0.95;
		color: var(--text-dark);
	}
	.page-desc {
		max-width: 640px;
		margin: 0;
		font-family: var(--font-body);
		font-size: 15px;
		line-height: 1.7;
		color: var(--text-secondary);
	}
	.header-cta,
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

	.resource-stats {
		display: grid;
		grid-template-columns: repeat(4, minmax(0, 1fr));
		gap: 14px;
		margin-bottom: 22px;
	}
	.resource-stat {
		padding: 16px 18px;
		border: 1px solid var(--border);
		border-radius: 18px;
		background: var(--bg-card);
	}
	.resource-stat-label {
		font-family: var(--font-ui);
		font-size: 11px;
		font-weight: 700;
		letter-spacing: 0.4px;
		text-transform: uppercase;
		color: var(--text-muted);
		margin-bottom: 8px;
	}
	.resource-stat-value {
		font-family: var(--font-headline);
		font-size: 28px;
		color: var(--text-dark);
	}

	.resource-stage {
		display: grid;
		grid-template-columns: minmax(0, 1.6fr) minmax(320px, 0.9fr);
		gap: 18px;
		margin-bottom: 24px;
	}
	.featured-card {
		display: grid;
		grid-template-columns: minmax(280px, 1fr) minmax(0, 1fr);
		padding: 0;
		border: 1px solid var(--border);
		border-radius: 24px;
		background: var(--bg-card);
		overflow: hidden;
		cursor: pointer;
		text-align: left;
	}
	.featured-media {
		position: relative;
		min-height: 100%;
		background:
			linear-gradient(135deg, rgba(81, 190, 123, 0.16), rgba(23, 52, 58, 0.2)),
			linear-gradient(160deg, #18393f, #0f2428);
	}
	.featured-media img {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		object-fit: cover;
	}
	.featured-overlay {
		position: absolute;
		inset: 0;
		display: flex;
		flex-direction: column;
		justify-content: space-between;
		padding: 18px;
		background: linear-gradient(180deg, rgba(10, 20, 23, 0.18), rgba(10, 20, 23, 0.55));
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
	.featured-play,
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
	.featured-copy {
		padding: 28px 26px;
		display: grid;
		align-content: center;
		gap: 12px;
	}
	.featured-kicker {
		font-family: var(--font-ui);
		font-size: 11px;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.5px;
		color: var(--text-muted);
	}
	.featured-copy h2 {
		margin: 0;
		font-family: var(--font-headline);
		font-size: 30px;
		line-height: 1.02;
		color: var(--text-dark);
	}
	.featured-copy p {
		margin: 0;
		font-family: var(--font-body);
		font-size: 14px;
		line-height: 1.7;
		color: var(--text-secondary);
	}
	.featured-meta,
	.resource-meta-bottom,
	.resource-meta-top {
		display: flex;
		flex-wrap: wrap;
		gap: 10px;
		font-family: var(--font-ui);
		font-size: 12px;
		color: var(--text-muted);
	}

	.spotlight-panel {
		padding: 20px;
		border: 1px solid var(--border);
		border-radius: 24px;
		background:
			radial-gradient(circle at top right, rgba(81, 190, 123, 0.12), transparent 42%),
			var(--bg-card);
	}
	.spotlight-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		margin-bottom: 14px;
	}
	.spotlight-title {
		font-family: var(--font-ui);
		font-size: 14px;
		font-weight: 700;
		color: var(--text-dark);
	}
	.spotlight-link {
		font-family: var(--font-ui);
		font-size: 12px;
		font-weight: 700;
		color: var(--primary);
		text-decoration: none;
	}
	.spotlight-list {
		display: grid;
		gap: 10px;
	}
	.spotlight-item {
		padding: 14px 14px;
		border: 1px solid var(--border);
		border-radius: 16px;
		background: rgba(255, 255, 255, 0.84);
		text-align: left;
		cursor: pointer;
	}
	.spotlight-item-title {
		font-family: var(--font-ui);
		font-size: 13px;
		font-weight: 700;
		color: var(--text-dark);
		margin-bottom: 6px;
	}
	.spotlight-item-meta {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
		font-family: var(--font-ui);
		font-size: 11px;
		color: var(--text-muted);
	}
	.spotlight-empty {
		font-family: var(--font-body);
		font-size: 13px;
		color: var(--text-muted);
		padding: 10px 2px 0;
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
		background:
			linear-gradient(135deg, rgba(81, 190, 123, 0.14), rgba(23, 52, 58, 0.2)),
			linear-gradient(160deg, #17343a, #102529);
	}
	.resource-thumb img {
		position: absolute;
		inset: 0;
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

	.resource-badge-office {
		background: rgba(81, 190, 123, 0.12);
		color: var(--primary);
	}
	.resource-badge-deal {
		background: rgba(59, 130, 246, 0.12);
		color: #2563eb;
	}
	.resource-badge-education {
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
	.sk-hero,
	.sk-side,
	.sk-thumb,
	.sk-text {
		background: var(--border-light, #e7ecef);
		animation: skPulse 1.5s infinite;
	}
	.sk-hero {
		min-height: 320px;
		border-radius: 24px;
	}
	.sk-side {
		min-height: 320px;
		border-radius: 24px;
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
	.resource-modal-header h3 {
		margin: 0;
		font-family: var(--font-ui);
		font-size: 15px;
		font-weight: 700;
		color: var(--text-dark);
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

	@media (max-width: 1024px) {
		.resource-stage,
		.resource-stats {
			grid-template-columns: 1fr 1fr;
		}
		.featured-card {
			grid-template-columns: 1fr;
		}
		.resource-grid {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
	}

	@media (max-width: 768px) {
		.resources-page {
			padding: 0 16px 36px;
		}
		.page-header,
		.resource-stage,
		.resource-stats {
			grid-template-columns: 1fr;
			display: grid;
		}
		.page-header {
			gap: 16px;
		}
		h1 {
			font-size: 34px;
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
