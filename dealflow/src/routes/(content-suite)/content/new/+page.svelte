<script>
	import { goto } from '$app/navigation';
	import { getStoredSessionToken, userToken } from '$lib/stores/auth.js';
	import {
		ARCHIVE_OPTIONS,
		CTA_OPTIONS,
		EVERGREEN_OPTIONS,
		FORMAT_OPTIONS,
		ORIGIN_OPTIONS,
		PLATFORM_OPTIONS,
		REPURPOSE_OPTIONS,
		emptyDistribution,
		emptyPublishedRecord,
		formatEnumLabel,
		formatPlatformLabel
	} from '$lib/utils/publishedLibrary.js';

	let form = $state(emptyPublishedRecord());
	let distributions = $state([emptyDistribution()]);
	let submitting = $state(false);
	let errorMessage = $state('');
	let successMessage = $state('');

	async function contentFetch(url, options = {}) {
		const token = $userToken || getStoredSessionToken();
		const response = await fetch(url, {
			...options,
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${token}`,
				...(options.headers || {})
			}
		});
		const payload = await response.json().catch(() => ({}));
		if (!response.ok) throw new Error(payload.error || 'Request failed');
		return payload;
	}

	function addDistribution() {
		distributions.push(emptyDistribution());
	}

	function removeDistribution(index) {
		if (distributions.length === 1) return;
		distributions.splice(index, 1);
	}

	function buildPayload() {
		return {
			title: form.title,
			content_group_id: form.content_group_id || null,
			primary_topic: form.primary_topic,
			theme_tags: form.theme_tags_input
				.split(',')
				.map((tag) => tag.trim())
				.filter(Boolean),
			format: form.format,
			hook: form.hook,
			canonical_content_text: form.canonical_content_text,
			content_summary: form.content_summary || null,
			cta_type: form.cta_type,
			evergreen_status: form.evergreen_status,
			repurpose_potential: form.repurpose_potential,
			origin_type: form.origin_type,
			preview_image_url: form.preview_image_url || null,
			source_doc_url: form.source_doc_url || null,
			drive_folder_url: form.drive_folder_url || null,
			ai_retrieval_notes: form.ai_retrieval_notes || null,
			distributions
		};
	}

	async function submitForm() {
		submitting = true;
		errorMessage = '';
		successMessage = '';
		try {
			await contentFetch('/api/content-published', {
				method: 'POST',
				body: JSON.stringify(buildPayload())
			});
			successMessage = 'Published record created. Redirecting to library...';
			setTimeout(() => goto('/content'), 600);
		} catch (error) {
			errorMessage = error.message;
		} finally {
			submitting = false;
		}
	}
</script>

<svelte:head>
	<title>New Published Record | Kontent Engine</title>
</svelte:head>

<div class="new-content-page">
	<header class="page-header">
		<div>
			<p class="eyebrow">Historical import</p>
			<h1>New Published Record</h1>
			<p>Create one canonical content item, then attach every platform-specific publish underneath it.</p>
		</div>
		<div class="header-actions">
			<button class="ghost-button" onclick={() => goto('/content')}>Back to Library</button>
			<button class="primary-button" onclick={submitForm} disabled={submitting}>{submitting ? 'Saving…' : 'Save Record'}</button>
		</div>
	</header>

	{#if errorMessage}
		<div class="message-banner error-banner">{errorMessage}</div>
	{/if}
	{#if successMessage}
		<div class="message-banner success-banner">{successMessage}</div>
	{/if}

	<div class="form-grid">
		<section class="form-card">
			<h2>Canonical content</h2>
			<div class="field-grid">
				<label>
					<span>Title</span>
					<input bind:value={form.title} placeholder="How I decide which deals deserve real time" />
				</label>
				<label>
					<span>Content group ID</span>
					<input bind:value={form.content_group_id} placeholder="G-2026-014" />
				</label>
				<label>
					<span>Primary topic</span>
					<input bind:value={form.primary_topic} placeholder="Real estate investing" />
				</label>
				<label>
					<span>Format</span>
					<select bind:value={form.format}>
						{#each FORMAT_OPTIONS as option}
							<option value={option}>{formatEnumLabel(option)}</option>
						{/each}
					</select>
				</label>
				<label class="full-width">
					<span>Hook</span>
					<input bind:value={form.hook} placeholder="Most investors waste time on deals they should have killed in the first 3 minutes." />
				</label>
				<label class="full-width">
					<span>Theme tags (comma separated)</span>
					<input bind:value={form.theme_tags_input} placeholder="deal flow, underwriting, filtering, speed" />
				</label>
				<label>
					<span>CTA type</span>
					<select bind:value={form.cta_type}>
						{#each CTA_OPTIONS as option}
							<option value={option}>{formatEnumLabel(option)}</option>
						{/each}
					</select>
				</label>
				<label>
					<span>Evergreen status</span>
					<select bind:value={form.evergreen_status}>
						{#each EVERGREEN_OPTIONS as option}
							<option value={option}>{formatEnumLabel(option)}</option>
						{/each}
					</select>
				</label>
				<label>
					<span>Repurpose potential</span>
					<select bind:value={form.repurpose_potential}>
						{#each REPURPOSE_OPTIONS as option}
							<option value={option}>{formatEnumLabel(option)}</option>
						{/each}
					</select>
				</label>
				<label>
					<span>Origin</span>
					<select bind:value={form.origin_type}>
						{#each ORIGIN_OPTIONS as option}
							<option value={option}>{formatEnumLabel(option)}</option>
						{/each}
					</select>
				</label>
				<label class="full-width">
					<span>Summary</span>
					<textarea bind:value={form.content_summary} rows="3" placeholder="What this piece was trying to teach or provoke." />
				</label>
				<label class="full-width">
					<span>Canonical content text</span>
					<textarea bind:value={form.canonical_content_text} rows="10" placeholder="Paste the clean published text or transcript here." />
				</label>
				<label class="full-width">
					<span>AI retrieval notes</span>
					<textarea bind:value={form.ai_retrieval_notes} rows="4" placeholder="Why this matters, what it is useful for, and what future prompts should retrieve it for." />
				</label>
			</div>
		</section>

		<section class="form-card">
			<h2>Links and assets</h2>
			<div class="field-grid">
				<label class="full-width">
					<span>Preview image URL</span>
					<input bind:value={form.preview_image_url} placeholder="https://..." />
				</label>
				<label class="full-width">
					<span>Source doc URL</span>
					<input bind:value={form.source_doc_url} placeholder="https://docs.google.com/document/..." />
				</label>
				<label class="full-width">
					<span>Drive folder URL</span>
					<input bind:value={form.drive_folder_url} placeholder="https://drive.google.com/drive/folders/..." />
				</label>
			</div>
		</section>
	</div>

	<section class="form-card">
		<div class="section-head">
			<div>
				<h2>Platform publishes</h2>
				<p>Each child publish stores its own URL, timestamp, platform-specific copy, and metrics.</p>
			</div>
			<button class="ghost-button" onclick={addDistribution}>+ Add Platform</button>
		</div>

		<div class="distribution-stack">
			{#each distributions as distribution, index}
				<div class="distribution-editor">
					<div class="section-head">
						<h3>Platform publish {index + 1}</h3>
						{#if distributions.length > 1}
							<button class="ghost-button" onclick={() => removeDistribution(index)}>Remove</button>
						{/if}
					</div>
					<div class="field-grid">
						<label>
							<span>Platform</span>
							<select bind:value={distribution.platform}>
								{#each PLATFORM_OPTIONS as option}
									<option value={option}>{formatPlatformLabel(option)}</option>
								{/each}
							</select>
						</label>
						<label>
							<span>Published at</span>
							<input type="datetime-local" bind:value={distribution.published_at} />
						</label>
						<label class="full-width">
							<span>Published URL</span>
							<input bind:value={distribution.published_url} placeholder="https://..." />
						</label>
						<label>
							<span>Platform handle</span>
							<input bind:value={distribution.platform_handle} placeholder="@pascal" />
						</label>
						<label>
							<span>Variant label</span>
							<input bind:value={distribution.variant_label} placeholder="Primary, cutdown, newsletter version" />
						</label>
						<label class="full-width">
							<span>Platform-specific preview URL</span>
							<input bind:value={distribution.preview_image_url} placeholder="https://..." />
						</label>
						<label class="full-width">
							<span>Platform text</span>
							<textarea bind:value={distribution.platform_text} rows="4" placeholder="Platform-specific copy or shortened variation." />
						</label>
						<label><span>Impressions</span><input type="number" bind:value={distribution.impressions} min="0" /></label>
						<label><span>Views</span><input type="number" bind:value={distribution.views} min="0" /></label>
						<label><span>Likes</span><input type="number" bind:value={distribution.likes} min="0" /></label>
						<label><span>Comments</span><input type="number" bind:value={distribution.comments} min="0" /></label>
						<label><span>Shares</span><input type="number" bind:value={distribution.shares} min="0" /></label>
						<label><span>Saves</span><input type="number" bind:value={distribution.saves} min="0" /></label>
						<label><span>Clicks</span><input type="number" bind:value={distribution.clicks} min="0" /></label>
						<label><span>Replies</span><input type="number" bind:value={distribution.replies} min="0" /></label>
					</div>
				</div>
			{/each}
		</div>
	</section>
</div>

<style>
	.new-content-page {
		padding: 28px;
		display: flex;
		flex-direction: column;
		gap: 18px;
	}

	.page-header,
	.section-head,
	.header-actions {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 16px;
	}

	h1,
	h2,
	h3,
	p {
		margin: 0;
	}

	.eyebrow {
		margin-bottom: 6px;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		font-size: 11px;
		font-weight: 700;
		color: #7f82a0;
	}

	.form-grid {
		display: grid;
		grid-template-columns: 1.2fr 0.8fr;
		gap: 18px;
	}

	.form-card {
		background: white;
		border: 1px solid #e6e9f2;
		border-radius: 18px;
		padding: 20px;
		display: flex;
		flex-direction: column;
		gap: 16px;
	}

	.field-grid {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 14px;
	}

	label {
		display: flex;
		flex-direction: column;
		gap: 8px;
		font-size: 13px;
		font-weight: 600;
		color: #425066;
	}

	.full-width {
		grid-column: 1 / -1;
	}

	input,
	select,
	textarea {
		width: 100%;
		border: 1px solid #dfe3ef;
		border-radius: 12px;
		padding: 12px 14px;
		font-size: 14px;
		background: #fff;
		font-family: inherit;
	}

	textarea {
		resize: vertical;
	}

	.primary-button,
	.ghost-button {
		border: none;
		border-radius: 12px;
		padding: 11px 16px;
		text-decoration: none;
		font-weight: 700;
		cursor: pointer;
	}

	.primary-button {
		background: #635bff;
		color: white;
	}

	.ghost-button {
		background: white;
		color: #1b2133;
		border: 1px solid #e6e9f2;
	}

	.message-banner {
		border-radius: 14px;
		padding: 14px 16px;
	}

	.error-banner {
		background: #fff1f2;
		color: #9f1239;
		border: 1px solid #fecdd3;
	}

	.success-banner {
		background: #edfdf3;
		color: #166534;
		border: 1px solid #bbf7d0;
	}

	.distribution-stack {
		display: flex;
		flex-direction: column;
		gap: 16px;
	}

	.distribution-editor {
		background: #fbfcff;
		border: 1px solid #e6e9f2;
		border-radius: 16px;
		padding: 18px;
	}

	@media (max-width: 1000px) {
		.page-header,
		.header-actions,
		.section-head,
		.form-grid,
		.field-grid {
			grid-template-columns: 1fr;
			flex-direction: column;
		}

		.new-content-page {
			padding: 18px;
		}
	}
</style>
