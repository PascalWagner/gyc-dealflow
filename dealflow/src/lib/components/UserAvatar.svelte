<script>
	let {
		name = '',
		avatarUrl = '',
		size = 'md',
		class: className = ''
	} = $props();

	const initials = $derived.by(() => {
		if (!name) return '?';
		const parts = name.trim().split(/\s+/).filter(Boolean);
		if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
		return (parts[0]?.[0] || '?').toUpperCase();
	});

	const sizeClass = $derived(`avatar-${size}`);
	let imgError = $state(false);
	const showImage = $derived(!!avatarUrl && !imgError);
</script>

<div class="user-avatar {sizeClass} {className}" class:has-image={showImage}>
	{#if showImage}
		<img
			src={avatarUrl}
			alt={name || 'User avatar'}
			class="avatar-img"
			onerror={() => { imgError = true; }}
		/>
	{:else}
		<span class="avatar-initials">{initials}</span>
	{/if}
</div>

<style>
	.user-avatar {
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
		overflow: hidden;
		flex-shrink: 0;
		background: var(--primary, #51BE7B);
		color: #fff;
		font-family: var(--font-ui, system-ui);
		font-weight: 700;
		letter-spacing: 0.3px;
		user-select: none;
	}
	.avatar-img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}
	.avatar-initials {
		line-height: 1;
	}

	/* Sizes */
	.avatar-xs { width: 24px; height: 24px; font-size: 9px; }
	.avatar-sm { width: 32px; height: 32px; font-size: 11px; }
	.avatar-md { width: 40px; height: 40px; font-size: 14px; }
	.avatar-lg { width: 56px; height: 56px; font-size: 18px; }
	.avatar-xl { width: 80px; height: 80px; font-size: 24px; }
	.avatar-2xl { width: 120px; height: 120px; font-size: 36px; }
</style>
