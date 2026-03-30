<script>
	import { browser } from '$app/environment';

	let { open = $bindable(false), title = '', width = '50%' } = $props();

	function close() {
		open = false;
	}

	function handleKeydown(e) {
		if (e.key === 'Escape') close();
	}

	function handleOverlayClick(e) {
		if (e.target === e.currentTarget) close();
	}

	$effect(() => {
		if (!browser) return;
		if (open) {
			document.body.style.overflow = 'hidden';
		} else {
			document.body.style.overflow = '';
		}
		return () => {
			document.body.style.overflow = '';
		};
	});
</script>

<svelte:window onkeydown={handleKeydown} />

{#if open}
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div class="slide-overlay" onclick={handleOverlayClick}>
		<div class="slide-panel" style="--panel-width: {width}">
			<div class="slide-header">
				<h2 class="slide-title">{title}</h2>
				<button class="slide-close" onclick={close} aria-label="Close panel">
					<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
				</button>
			</div>
			<div class="slide-body">
				<slot />
			</div>
		</div>
	</div>
{/if}

<style>
	.slide-overlay {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.4);
		z-index: 200;
		animation: fadeIn 0.2s ease;
	}
	.slide-panel {
		position: absolute;
		top: 0;
		right: 0;
		bottom: 0;
		width: var(--panel-width, 50%);
		max-width: 100%;
		background: var(--bg-cream);
		box-shadow: -4px 0 24px rgba(0, 0, 0, 0.12);
		display: flex;
		flex-direction: column;
		animation: slideIn 0.25s ease;
		overflow: hidden;
	}
	.slide-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 20px 24px;
		border-bottom: 1px solid var(--border);
		background: var(--bg-card);
		flex-shrink: 0;
	}
	.slide-title {
		font-family: var(--font-ui);
		font-size: 16px;
		font-weight: 700;
		color: var(--text-dark);
		margin: 0;
	}
	.slide-close {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 36px;
		height: 36px;
		border-radius: 50%;
		border: none;
		background: var(--bg-cream);
		color: var(--text-secondary);
		cursor: pointer;
		transition: background 0.15s, color 0.15s;
	}
	.slide-close:hover {
		background: var(--border-light);
		color: var(--text-dark);
	}
	.slide-body {
		flex: 1;
		overflow-y: auto;
		padding: 24px;
		-webkit-overflow-scrolling: touch;
	}

	@keyframes fadeIn {
		from { opacity: 0; }
		to { opacity: 1; }
	}
	@keyframes slideIn {
		from { transform: translateX(100%); }
		to { transform: translateX(0); }
	}

	@media (max-width: 768px) {
		.slide-panel {
			width: 100% !important;
		}
		.slide-header {
			padding: 16px 16px;
		}
		.slide-body {
			padding: 16px;
		}
	}
</style>
