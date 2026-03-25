<script>
	let {
		title = 'Continue on the web',
		message = 'Scheduling and checkout are completed on the web.',
		href = '',
		linkLabel = 'Continue on the web'
	} = $props();
</script>

<div class="web-notice">
	<div class="web-notice-title">{title}</div>
	<div class="web-notice-message">{message}</div>
	{#if href}
		<a href={href} target="_blank" rel="noopener" class="web-notice-link">{linkLabel}</a>
	{/if}
</div>

<style>
	.web-notice {
		padding: 24px 22px;
		border-radius: 16px;
		border: 1px solid var(--border, #dde5e8);
		background: linear-gradient(180deg, rgba(255, 255, 255, 0.98), rgba(248, 250, 251, 0.96));
		text-align: center;
		box-shadow: 0 16px 36px rgba(10, 30, 33, 0.08);
	}

	.web-notice-title {
		font-family: var(--font-ui);
		font-size: 18px;
		font-weight: 700;
		color: var(--text-dark, #141413);
		margin-bottom: 8px;
	}

	.web-notice-message {
		font-family: var(--font-body);
		font-size: 14px;
		line-height: 1.65;
		color: var(--text-secondary, #607179);
		max-width: 34rem;
		margin: 0 auto;
	}

	.web-notice-link {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		margin-top: 16px;
		padding: 12px 22px;
		border-radius: 999px;
		background: var(--primary, #51BE7B);
		color: #fff;
		font-family: var(--font-ui);
		font-size: 13px;
		font-weight: 700;
		text-decoration: none;
	}
	.web-notice-link:hover {
		background: var(--primary-hover, #43a96c);
	}
</style>
