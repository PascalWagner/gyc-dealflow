<script>
	let {
		title = 'Available to existing members',
		message = 'This area is available to existing members on the web.',
		note = 'Enrollment and billing are not offered in the iOS app.',
		compact = false
	} = $props();
</script>

<div class:compact class="companion-gate">
	<div class="gate-icon" aria-hidden="true">
		<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
			<rect x="3" y="11" width="18" height="10" rx="2" ry="2" />
			<path d="M7 11V7a5 5 0 0 1 10 0v4" />
		</svg>
	</div>
	<div class="gate-title">{title}</div>
	<div class="gate-message">{message}</div>
	<div class="gate-note">{note}</div>
</div>

<style>
	.companion-gate {
		padding: 28px 24px;
		border-radius: 18px;
		border: 1px solid rgba(81, 190, 123, 0.18);
		background: linear-gradient(135deg, rgba(10, 30, 33, 0.98), rgba(20, 58, 66, 0.94));
		color: #fff;
		text-align: center;
		box-shadow: 0 20px 50px rgba(10, 30, 33, 0.16);
	}

	.companion-gate.compact {
		padding: 20px 18px;
		border-radius: 14px;
	}

	.gate-icon {
		width: 52px;
		height: 52px;
		margin: 0 auto 14px;
		border-radius: 14px;
		background: rgba(81, 190, 123, 0.18);
		display: flex;
		align-items: center;
		justify-content: center;
		color: var(--primary, #51BE7B);
	}

	.compact .gate-icon {
		width: 44px;
		height: 44px;
		border-radius: 12px;
		margin-bottom: 12px;
	}

	.gate-icon svg {
		width: 22px;
		height: 22px;
	}

	.gate-title {
		font-family: var(--font-ui);
		font-size: 19px;
		font-weight: 700;
		letter-spacing: -0.02em;
		margin-bottom: 8px;
	}

	.compact .gate-title {
		font-size: 16px;
	}

	.gate-message {
		font-family: var(--font-body);
		font-size: 14px;
		line-height: 1.6;
		color: rgba(255, 255, 255, 0.82);
		max-width: 38rem;
		margin: 0 auto;
	}

	.gate-note {
		font-family: var(--font-ui);
		font-size: 11px;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: rgba(81, 190, 123, 0.94);
		margin-top: 14px;
	}
</style>
