<script>
	import { accessTier, isAdmin, isGP } from '$lib/stores/auth.js';
	import { browser } from '$app/environment';
	import { isNativeApp } from '$lib/utils/platform.js';
	import PageContainer from '$lib/layout/PageContainer.svelte';
	import PageHeader from '$lib/layout/PageHeader.svelte';

	const nativeCompanionMode = browser && isNativeApp();
	const canShowMemberHub = $derived(!nativeCompanionMode || ['member', 'admin'].includes($accessTier));
	const canShowOfficeHours = $derived(!nativeCompanionMode || ['member', 'admin'].includes($accessTier));

	const sections = $derived.by(() => {
		const supportItems = [];
		if (canShowMemberHub) {
			supportItems.push({
				href: '/app/academy',
				label: nativeCompanionMode ? 'Member Hub' : 'Cash Flow Academy',
				icon: '📚'
			});
		}
		supportItems.push({ href: '/app/resources', label: 'Resources', icon: '🎬' });
		if (canShowOfficeHours) {
			supportItems.push({ href: '/app/office-hours', label: 'Office Hours', icon: '🕛' });
		}
		if (!nativeCompanionMode) {
			supportItems.push({ href: '/app/income-fund', label: 'GYC Income Fund', icon: '💰' });
		}

		return [
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
				items: supportItems
			},
			{
				label: 'Account',
				items: [
					{ href: '/app/settings', label: 'Settings', icon: '⚙️' }
				]
			}
		];
	});
</script>

<svelte:head><title>More | GYC</title></svelte:head>

<PageContainer className="more-frame">
<div class="more-page">
	<PageHeader title="More" />

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

	{#if $isGP}
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
</PageContainer>

<style>
	.more-page { max-width: 480px; margin: 0; }

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
		}

		.menu-item {
			min-height: 48px;
			padding: 16px 14px;
		}
	}
</style>
