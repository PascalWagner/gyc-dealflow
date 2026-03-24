<script>
	import { isAdmin, userTier } from '$lib/stores/auth.js';

	const isGP = $derived($userTier === 'gp');

	const sections = [
		{
			label: 'My Dashboard',
			items: [
				{ href: '/app/portfolio', label: 'Portfolio', icon: '📊' },
				{ href: '/app/plan', label: 'My Plan', icon: '🎯' },
				{ href: '/app/tax-prep', label: 'Tax Prep', icon: '📄' }
			]
		},
		{
			label: 'Support',
			items: [
				{ href: '/app/academy', label: 'Cash Flow Academy', icon: '📚' },
				{ href: '/app/office-hours', label: 'Office Hours', icon: '🕛' },
				{ href: '/app/income-fund', label: 'GYC Income Fund', icon: '💰' }
			]
		},
		{
			label: 'Account',
			items: [
				{ href: '/app/settings', label: 'Settings', icon: '⚙️' }
			]
		}
	];
</script>

<svelte:head><title>More | GYC</title></svelte:head>

<div class="more-page">
	<h1>More</h1>

	{#each sections as section}
		<div class="section-label">{section.label}</div>
		{#each section.items as item}
			<a href={item.href} class="menu-item">
				<span class="menu-icon">{item.icon}</span>
				<span class="menu-label">{item.label}</span>
				<svg class="chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><polyline points="9 18 15 12 9 6"/></svg>
			</a>
		{/each}
	{/each}

	{#if isGP}
		<div class="section-label">GP Portal</div>
		<a href="/gp-dashboard" class="menu-item">
			<span class="menu-icon">📈</span>
			<span class="menu-label">GP Dashboard</span>
			<svg class="chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><polyline points="9 18 15 12 9 6"/></svg>
		</a>
	{/if}

	{#if $isAdmin}
		<div class="section-label">Admin</div>
		<a href="/app/admin" class="menu-item">
			<span class="menu-icon">🔧</span>
			<span class="menu-label">Admin Dashboard</span>
			<svg class="chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><polyline points="9 18 15 12 9 6"/></svg>
		</a>
		<a href="/app/admin/manage" class="menu-item">
			<span class="menu-icon">🗄️</span>
			<span class="menu-label">Manage Data</span>
			<svg class="chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><polyline points="9 18 15 12 9 6"/></svg>
		</a>
		<a href="/app/case-studies" class="menu-item">
			<span class="menu-icon">🏆</span>
			<span class="menu-label">Member Success</span>
			<svg class="chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><polyline points="9 18 15 12 9 6"/></svg>
		</a>
	{/if}
</div>

<style>
	.more-page { padding: 20px 16px; max-width: 480px; margin: 0 auto; }
	h1 { font-family: var(--font-headline); font-size: 22px; font-weight: 800; color: var(--text-dark); margin: 0 0 20px; }

	.section-label {
		font-family: var(--font-ui); font-size: 11px; font-weight: 700;
		text-transform: uppercase; letter-spacing: 1px; color: var(--text-muted);
		padding: 16px 0 8px;
	}

	.menu-item {
		display: flex; align-items: center; gap: 12px;
		padding: 14px 12px; border-radius: var(--radius-sm);
		text-decoration: none; color: var(--text-dark);
		transition: background 0.15s;
	}
	.menu-item:hover { background: rgba(0,0,0,0.04); }
	.menu-icon { font-size: 18px; width: 24px; text-align: center; }
	.menu-label { flex: 1; font-family: var(--font-ui); font-size: 15px; font-weight: 600; }
	.chevron { color: var(--text-muted); flex-shrink: 0; }

	@media (min-width: 769px) and (max-width: 1024px) {
		.more-page {
			max-width: 600px;
			padding: 24px;
		}

		.menu-item {
			min-height: 48px;
			padding: 16px 14px;
		}
	}
</style>
