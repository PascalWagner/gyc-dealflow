<script>
	let { imageFile, onSave, onCancel, saving = false } = $props();

	const CIRCLE_SIZE = 380;
	const MIN_ZOOM = 1.0;
	const MAX_ZOOM = 4.0;
	const OUTPUT_SIZE = 512;

	// State
	let zoom = $state(1.0);
	let offsetX = $state(0);
	let offsetY = $state(0);
	let imageLoaded = $state(false);
	let isDragging = $state(false);
	let imageEl = $state(null);
	let imageUrl = $state('');

	let naturalWidth = $state(1);
	let naturalHeight = $state(1);

	// Create/revoke object URL when imageFile changes
	$effect(() => {
		if (!imageFile) { imageUrl = ''; return; }
		const url = URL.createObjectURL(imageFile);
		imageUrl = url;
		imageLoaded = false;
		zoom = 1.0;
		offsetX = 0;
		offsetY = 0;
		return () => URL.revokeObjectURL(url);
	});

	// At zoom=1: shortest side of image fills the circle exactly
	const baseScale = $derived(CIRCLE_SIZE / Math.min(naturalWidth, naturalHeight));
	const renderedW = $derived(naturalWidth * baseScale * zoom);
	const renderedH = $derived(naturalHeight * baseScale * zoom);

	// Max drag distance before image edge enters the circle
	const maxOffsetX = $derived(Math.max(0, (renderedW - CIRCLE_SIZE) / 2));
	const maxOffsetY = $derived(Math.max(0, (renderedH - CIRCLE_SIZE) / 2));

	function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

	// Clamped offsets — auto-corrects when zoom changes tighten the bounds
	const displayX = $derived(clamp(offsetX, -maxOffsetX, maxOffsetX));
	const displayY = $derived(clamp(offsetY, -maxOffsetY, maxOffsetY));

	// Drag tracking (plain vars, not state — we don't need reactivity here)
	let dragAnchorX = 0, dragAnchorY = 0;
	let offsetAnchorX = 0, offsetAnchorY = 0;

	function onImageLoad(e) {
		naturalWidth = e.target.naturalWidth || 1;
		naturalHeight = e.target.naturalHeight || 1;
		imageLoaded = true;
	}

	function onPointerDown(e) {
		if (e.button !== 0) return;
		isDragging = true;
		dragAnchorX = e.clientX;
		dragAnchorY = e.clientY;
		offsetAnchorX = displayX;
		offsetAnchorY = displayY;
		e.currentTarget.setPointerCapture(e.pointerId);
		e.preventDefault();
	}

	function onPointerMove(e) {
		if (!isDragging) return;
		offsetX = offsetAnchorX + (e.clientX - dragAnchorX);
		offsetY = offsetAnchorY + (e.clientY - dragAnchorY);
	}

	function onPointerUp() {
		if (!isDragging) return;
		isDragging = false;
		// Commit clamped position so future drags start from correct anchor
		offsetX = displayX;
		offsetY = displayY;
	}

	function onWheel(e) {
		e.preventDefault();
		const delta = e.deltaY * -0.002 * (MAX_ZOOM - MIN_ZOOM);
		zoom = clamp(zoom + delta, MIN_ZOOM, MAX_ZOOM);
	}

	function reset() {
		zoom = 1.0;
		offsetX = 0;
		offsetY = 0;
	}

	async function handleSave() {
		if (!imageEl || !imageLoaded) return;

		// Compute the source region in natural image pixels
		const scaleFactor = baseScale * zoom;
		const cropLeft   = naturalWidth  / 2 - CIRCLE_SIZE / (2 * scaleFactor) - displayX / scaleFactor;
		const cropTop    = naturalHeight / 2 - CIRCLE_SIZE / (2 * scaleFactor) - displayY / scaleFactor;
		const srcRegion  = CIRCLE_SIZE / scaleFactor;

		const canvas = document.createElement('canvas');
		canvas.width  = OUTPUT_SIZE;
		canvas.height = OUTPUT_SIZE;
		const ctx = canvas.getContext('2d');

		// White background for transparent PNGs
		ctx.fillStyle = '#ffffff';
		ctx.fillRect(0, 0, OUTPUT_SIZE, OUTPUT_SIZE);

		// Draw the cropped region
		ctx.drawImage(imageEl, cropLeft, cropTop, srcRegion, srcRegion, 0, 0, OUTPUT_SIZE, OUTPUT_SIZE);

		// Prefer WebP, fall back to JPEG for old Safari
		const mimeType = canvas.toDataURL('image/webp').startsWith('data:image/webp')
			? 'image/webp'
			: 'image/jpeg';

		const dataUrl = canvas.toDataURL(mimeType, 0.92);
		onSave(dataUrl);
	}

	function handleOverlayClick(e) {
		if (e.target === e.currentTarget) onCancel();
	}
</script>

{#if imageFile}
<div class="crop-overlay" onclick={handleOverlayClick} role="dialog" aria-modal="true" aria-label="Edit photo">
	<div class="crop-modal">

		<div class="crop-header">
			<span class="crop-title">Edit photo</span>
			<button class="crop-close" onclick={onCancel} aria-label="Close" disabled={saving}>✕</button>
		</div>

		<!-- Dark stage: image visible only through the circle viewport -->
		<div
			class="crop-stage"
			onpointerdown={onPointerDown}
			onpointermove={onPointerMove}
			onpointerup={onPointerUp}
			onpointercancel={onPointerUp}
			onwheel={onWheel}
			style:cursor={isDragging ? 'grabbing' : 'grab'}
		>
			<div class="viewport">
				{#if !imageLoaded && imageUrl}
					<div class="crop-spinner-wrap"><span class="crop-spinner"></span></div>
				{/if}
				<!-- image-orientation: from-image handles EXIF rotation in browser -->
				<img
					src={imageUrl}
					alt="Crop preview"
					class="crop-image"
					style:width="{renderedW}px"
					style:height="{renderedH}px"
					style:transform="translate(calc(-50% + {displayX}px), calc(-50% + {displayY}px))"
					bind:this={imageEl}
					onload={onImageLoad}
					draggable="false"
				/>
			</div>
		</div>

		<div class="crop-controls">
			<div class="zoom-row">
				<!-- Minus icon -->
				<svg class="zoom-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="8" y1="11" x2="14" y2="11"/></svg>
				<input
					type="range"
					class="zoom-slider"
					min={MIN_ZOOM}
					max={MAX_ZOOM}
					step="0.01"
					bind:value={zoom}
					aria-label="Zoom"
				/>
				<!-- Plus icon -->
				<svg class="zoom-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/></svg>
			</div>
			<button class="reset-btn" onclick={reset} type="button">Reset</button>
		</div>

		<div class="crop-actions">
			<button class="btn-cancel" onclick={onCancel} disabled={saving} type="button">Cancel</button>
			<button class="btn-save" onclick={handleSave} disabled={saving || !imageLoaded} type="button">
				{#if saving}
					<span class="btn-spinner"></span>Saving…
				{:else}
					Save changes
				{/if}
			</button>
		</div>

	</div>
</div>
{/if}

<style>
	/* ── Overlay ───────────────────────────────────────────────────────────── */
	.crop-overlay {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.7);
		backdrop-filter: blur(4px);
		-webkit-backdrop-filter: blur(4px);
		z-index: 1200;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 20px;
		animation: fadeIn 0.2s ease forwards;
	}

	@keyframes fadeIn {
		from { opacity: 0; }
		to   { opacity: 1; }
	}

	/* ── Modal card ────────────────────────────────────────────────────────── */
	.crop-modal {
		background: #fff;
		border-radius: 20px;
		width: 100%;
		max-width: 480px;
		overflow: hidden;
		box-shadow: 0 32px 80px rgba(0,0,0,0.35), 0 0 0 1px rgba(0,0,0,0.06);
		animation: slideUp 0.25s ease forwards;
	}

	@keyframes slideUp {
		from { opacity: 0; transform: translateY(10px); }
		to   { opacity: 1; transform: translateY(0); }
	}

	/* ── Header ────────────────────────────────────────────────────────────── */
	.crop-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 20px 24px 16px;
	}

	.crop-title {
		font-family: var(--font-ui, system-ui);
		font-size: 18px;
		font-weight: 700;
		color: var(--text-dark, #111);
		letter-spacing: -0.3px;
	}

	.crop-close {
		background: none;
		border: none;
		cursor: pointer;
		color: var(--text-muted, #888);
		font-size: 18px;
		line-height: 1;
		width: 32px;
		height: 32px;
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
		transition: background 0.15s;
	}
	.crop-close:hover { background: rgba(0,0,0,0.06); }

	/* ── Crop stage (dark bg + circle viewport) ───────────────────────────── */
	.crop-stage {
		background: #1a1a1a;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 24px;
		touch-action: none;
		user-select: none;
		-webkit-user-select: none;
	}

	.viewport {
		width: 380px;
		height: 380px;
		border-radius: 50%;
		overflow: hidden;
		position: relative;
		flex-shrink: 0;
		/* Subtle ring to show circle edge against very light images */
		box-shadow: 0 0 0 1px rgba(255,255,255,0.15);
	}

	.crop-image {
		position: absolute;
		left: 50%;
		top: 50%;
		/* image-orientation handled via CSS for EXIF rotation */
		image-orientation: from-image;
		pointer-events: none;
		user-select: none;
		-webkit-user-select: none;
	}

	.crop-spinner-wrap {
		position: absolute;
		inset: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 2;
	}

	.crop-spinner {
		width: 28px;
		height: 28px;
		border: 3px solid rgba(255,255,255,0.2);
		border-top-color: #fff;
		border-radius: 50%;
		animation: spin 0.7s linear infinite;
	}

	@keyframes spin { to { transform: rotate(360deg); } }

	/* ── Zoom controls ─────────────────────────────────────────────────────── */
	.crop-controls {
		padding: 16px 24px 4px;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 6px;
	}

	.zoom-row {
		display: flex;
		align-items: center;
		gap: 10px;
		width: 100%;
	}

	.zoom-icon {
		flex-shrink: 0;
		color: var(--text-muted, #888);
		width: 16px;
		height: 16px;
	}

	.zoom-slider {
		flex: 1;
		-webkit-appearance: none;
		appearance: none;
		height: 4px;
		border-radius: 2px;
		background: var(--border, #e5e7eb);
		outline: none;
		cursor: pointer;
	}
	.zoom-slider::-webkit-slider-thumb {
		-webkit-appearance: none;
		appearance: none;
		width: 20px;
		height: 20px;
		border-radius: 50%;
		background: var(--primary, #51BE7B);
		cursor: pointer;
		box-shadow: 0 1px 4px rgba(0,0,0,0.2);
		transition: transform 0.1s;
	}
	.zoom-slider::-webkit-slider-thumb:hover { transform: scale(1.15); }
	.zoom-slider::-moz-range-thumb {
		width: 20px;
		height: 20px;
		border: none;
		border-radius: 50%;
		background: var(--primary, #51BE7B);
		cursor: pointer;
		box-shadow: 0 1px 4px rgba(0,0,0,0.2);
	}

	.reset-btn {
		background: none;
		border: none;
		cursor: pointer;
		font-family: var(--font-ui, system-ui);
		font-size: 12px;
		color: var(--text-muted, #888);
		padding: 2px 4px;
		text-decoration: underline;
		text-underline-offset: 2px;
	}
	.reset-btn:hover { color: var(--text-dark, #111); }

	/* ── Actions ───────────────────────────────────────────────────────────── */
	.crop-actions {
		display: flex;
		align-items: center;
		justify-content: flex-end;
		gap: 10px;
		padding: 16px 24px 24px;
	}

	.btn-cancel {
		background: none;
		border: 1.5px solid var(--border, #e5e7eb);
		border-radius: 8px;
		padding: 9px 20px;
		font-family: var(--font-ui, system-ui);
		font-size: 14px;
		font-weight: 600;
		color: var(--text-secondary, #555);
		cursor: pointer;
		transition: background 0.15s;
	}
	.btn-cancel:hover:not(:disabled) { background: rgba(0,0,0,0.04); }
	.btn-cancel:disabled { opacity: 0.5; cursor: not-allowed; }

	.btn-save {
		background: var(--primary, #51BE7B);
		border: none;
		border-radius: 8px;
		padding: 9px 22px;
		font-family: var(--font-ui, system-ui);
		font-size: 14px;
		font-weight: 700;
		color: #fff;
		cursor: pointer;
		display: flex;
		align-items: center;
		gap: 8px;
		transition: opacity 0.15s;
	}
	.btn-save:hover:not(:disabled) { opacity: 0.88; }
	.btn-save:disabled { opacity: 0.55; cursor: not-allowed; }

	.btn-spinner {
		width: 14px;
		height: 14px;
		border: 2px solid rgba(255,255,255,0.4);
		border-top-color: #fff;
		border-radius: 50%;
		animation: spin 0.7s linear infinite;
		flex-shrink: 0;
	}

	/* ── Mobile ────────────────────────────────────────────────────────────── */
	@media (max-width: 480px) {
		.crop-overlay {
			padding: 0;
			align-items: flex-end;
		}

		.crop-modal {
			border-radius: 20px 20px 0 0;
			max-width: 100%;
		}

		.viewport {
			width: min(80vw, 80vh);
			height: min(80vw, 80vh);
		}

		.crop-actions {
			padding-bottom: calc(24px + env(safe-area-inset-bottom));
			flex-direction: column-reverse;
			gap: 8px;
		}

		.btn-cancel,
		.btn-save {
			width: 100%;
			justify-content: center;
		}
	}
</style>
