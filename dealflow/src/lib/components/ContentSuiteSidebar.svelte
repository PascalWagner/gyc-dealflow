<script>
	import { page } from '$app/stores';
	import { user } from '$lib/stores/auth.js';

	const navItems = [
		{ href: '/transcripts', label: 'Transcripts' },
		{ href: '/ideas', label: 'Ideas' },
		{ href: '/content', label: 'Content' },
		{ href: '/calendar', label: 'Calendar' }
	];

	function isActive(href) {
		return $page.url.pathname === href;
	}

	function initials(name) {
		return String(name || 'Pascal')
			.split(/\s+/)
			.filter(Boolean)
			.slice(0, 2)
			.map((part) => part[0]?.toUpperCase())
			.join('');
	}
</script>

<aside class="content-sidebar">
	<div class="brand-block">
		<div class="brand-mark">K</div>
		<div>
			<div class="brand-title">Kontent Engine</div>
			<div class="brand-sub">Operator workspace</div>
		</div>
	</div>

	<nav class="content-nav">
		{#each navItems as item}
			<a class="content-nav-item" class:active={isActive(item.href)} href={item.href}>{item.label}</a>
		{/each}
	</nav>

	<div class="content-sidebar-footer">
		<div class="user-avatar">{initials($user?.name || $user?.fullName || $user?.email)}</div>
		<div>
			<div class="user-name">{$user?.name || $user?.fullName || 'Pascal Wagner'}</div>
			<div class="user-email">{$user?.email || ''}</div>
		</div>
	</div>
</aside>

<style>
	.content-sidebar {
		width: 240px;
		min-width: 240px;
		background: #ffffff;
		border-right: 1px solid #e7e9ef;
		padding: 20px 18px;
		display: flex;
		flex-direction: column;
		gap: 24px;
	}

	.brand-block {
		display: flex;
		align-items: center;
		gap: 12px;
	}

	.brand-mark {
		width: 34px;
		height: 34px;
		border-radius: 12px;
		background: linear-gradient(135deg, #635bff, #8f85ff);
		color: white;
		display: flex;
		align-items: center;
		justify-content: center;
		font-family: var(--font-ui, 'Plus Jakarta Sans', sans-serif);
		font-weight: 800;
	}

	.brand-title {
		font-family: var(--font-ui, 'Plus Jakarta Sans', sans-serif);
		font-size: 15px;
		font-weight: 700;
		color: #141826;
	}

	.brand-sub {
		font-size: 12px;
		color: #7e8599;
	}

	.content-nav {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.content-nav-item {
		text-decoration: none;
		color: #636b80;
		font-family: var(--font-ui, 'Plus Jakarta Sans', sans-serif);
		font-size: 14px;
		font-weight: 600;
		padding: 11px 12px;
		border-radius: 12px;
		transition: background 0.2s ease, color 0.2s ease;
	}

	.content-nav-item:hover {
		background: #f5f6fb;
		color: #141826;
	}

	.content-nav-item.active {
		background: #edeaff;
		color: #5145d8;
	}

	.content-sidebar-footer {
		margin-top: auto;
		display: flex;
		align-items: center;
		gap: 12px;
		padding-top: 18px;
		border-top: 1px solid #eceff5;
	}

	.user-avatar {
		width: 42px;
		height: 42px;
		border-radius: 14px;
		background: #1f8f6d;
		color: white;
		display: flex;
		align-items: center;
		justify-content: center;
		font-weight: 700;
	}

	.user-name {
		font-size: 13px;
		font-weight: 700;
		color: #141826;
	}

	.user-email {
		font-size: 12px;
		color: #7e8599;
	}

	@media (max-width: 900px) {
		.content-sidebar {
			width: 100%;
			min-width: 0;
			border-right: none;
			border-bottom: 1px solid #e7e9ef;
		}

		.content-nav {
			flex-direction: row;
			flex-wrap: wrap;
		}

		.content-sidebar-footer {
			margin-top: 0;
		}
	}
</style>
