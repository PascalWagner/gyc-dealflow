<script>
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';

	const BASE_URL = 'https://dealflow.growyourcashflow.io';

	const FALLBACK_DEAL = {
		id: '4088aa9d-78ab-4dcd-91c8-8a18f16503b5',
		name: 'F Street West Bend, LLC',
		operator_name: 'F Street',
		asset_class: 'Multi-Family',
		deal_type: 'Syndication',
		target_irr: 17.3,
		minimum_investment: 50000,
		lockup_period: null,
		distribution_frequency: 'Unknown',
		lp_gp_split: '60/40',
		equity_multiple: 2.6,
		manager_aum: null,
		founded_year: 2008,
		amount_raised: 8000000,
		funding_percentage: 70,
		description: null,
		total_deals: 181
	};

	let deal = $state(null);
	let loading = $state(true);
	let userEmail = $state('investor@example.com');

	function fmt$(v) {
		if (!v && v !== 0) return '--';
		if (v >= 1e6) return '$' + (v / 1e6).toFixed(1) + 'M';
		if (v >= 1e3) return '$' + Math.round(v / 1e3) + 'K';
		return '$' + v.toLocaleString();
	}

	function fmtPct(v) {
		if (!v && v !== 0) return '--';
		return v + '%';
	}

	function buildDescription(d) {
		if (d.description) return d.description;
		const parts = [d.name];
		if (d.asset_class) parts.push('is a ' + d.asset_class);
		if (d.deal_type) parts[parts.length - 1] += ' ' + d.deal_type;
		if (d.target_irr) parts.push('targeting a ' + d.target_irr + '% IRR');
		if (d.equity_multiple) parts.push('and ' + d.equity_multiple.toFixed(2) + 'x equity multiple');
		if (d.lockup_period) parts.push('over ' + d.lockup_period);
		else parts.push('over --');
		if (d.minimum_investment) parts.push('with a minimum ' + fmt$(d.minimum_investment) + ' investment');
		return parts.join(' ') + '.';
	}

	onMount(async () => {
		const params = new URLSearchParams(window.location.search);
		const id = params.get('id');
		const email = params.get('email');
		if (email) userEmail = email;

		if (id) {
			try {
				const res = await fetch(`/api/deals?id=${id}`);
				if (res.ok) {
					const data = await res.json();
					const d = Array.isArray(data) ? data[0] : data;
					if (d) {
						deal = { ...FALLBACK_DEAL, ...d };
						loading = false;
						return;
					}
				}
			} catch (e) {
				console.warn('Failed to fetch deal, using fallback deal data:', e);
			}
		}
		deal = FALLBACK_DEAL;
		loading = false;
	});

	const dealUrl = $derived(deal ? `${BASE_URL}/deal/${deal.id}` : '#');
	const subject = $derived(deal ? `${deal.name} — ${deal.asset_class || 'Deal'}, ${fmtPct(deal.target_irr)} IRR, ${fmt$(deal.minimum_investment)} min` : '');
</script>

<svelte:head>
	<title>{subject || 'Weekly Digest Preview'}</title>
</svelte:head>

<div class="ly-page">
{#if loading}
	<div class="loading">Loading preview...</div>
{:else if deal}
<div class="preview-wrapper">

	<!-- Preview toolbar -->
	<div class="toolbar">
		<span class="toolbar-label">Email Preview</span>
		<span class="toolbar-hint">This is how the weekly deal alert email will appear in inboxes.</span>
	</div>

	<!-- Simulated email header -->
	<div class="email-header">
		<div class="from">Grow Your Cashflow &lt;deals@growyourcashflow.io&gt;</div>
		<div class="meta"><strong>Subject:</strong> {subject}</div>
		<div class="meta"><strong>To:</strong> {userEmail}</div>
	</div>

	<!-- Email body (table-based for email fidelity) -->
	<table cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#FAF9F5;">
		<tbody><tr><td align="center" style="padding:32px 16px;">
			<table cellpadding="0" cellspacing="0" border="0" width="480" style="max-width:480px;">
				<tbody>
				<!-- Header -->
				<tr><td align="center" style="padding-bottom:24px;">
					<div style="display:inline-block;">
						<span style="font-family:Georgia,serif;font-size:18px;font-weight:700;color:#141413;letter-spacing:-0.3px;">Grow Your Cashflow</span>
						<span style="color:#DDE5E8;margin:0 8px;">&#183;</span>
						<span style="font-size:13px;font-weight:600;color:#51BE7B;letter-spacing:0.3px;">Deal Alert</span>
					</div>
				</td></tr>

				<!-- Deal Card -->
				<tr><td>
					<table cellpadding="0" cellspacing="0" border="0" width="100%" style="border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);">
						<tbody>
						<!-- Card Hero -->
						<tr><td style="background:linear-gradient(135deg,#1a2332 0%,#2d3748 100%);padding:24px 24px 20px;">
							<a href={dealUrl} style="text-decoration:none;color:inherit;">
								<div style="margin-bottom:16px;">
									{#if deal.asset_class}
										<span class="badge badge-asset">{deal.asset_class}</span>
									{/if}
									{#if deal.deal_type}
										<span class="badge badge-type">{deal.deal_type}</span>
									{/if}
								</div>
								<div style="font-size:42px;font-weight:800;color:#51BE7B;line-height:1;">{fmtPct(deal.target_irr)}</div>
								<div style="font-size:11px;font-weight:600;color:rgba(255,255,255,0.5);letter-spacing:0.5px;margin-top:6px;">TARGET IRR</div>
							</a>
						</td></tr>

						<!-- Deal Name + Operator + Description -->
						<tr><td style="background:#fff;padding:20px 24px 12px;">
							<a href={dealUrl} style="text-decoration:none;color:inherit;">
								<div style="font-size:20px;font-weight:700;color:#141413;line-height:1.3;">{deal.name}</div>
								{#if deal.operator_name}
									<div style="font-size:13px;color:#607179;margin-top:4px;">{deal.operator_name}</div>
								{/if}
								<div style="font-size:13px;color:#8A9AA0;margin-top:10px;line-height:1.5;">{buildDescription(deal)}</div>
							</a>
						</td></tr>

						<!-- Metrics Row 1 -->
						<tr><td style="background:#fff;padding:0 24px;">
							<table cellpadding="0" cellspacing="0" border="0" width="100%" style="border-top:1px solid #F0F0EE;">
								<tbody><tr>
									<td class="metric-cell"><div class="metric-label">TARGET IRR</div><div class="metric-value green">{fmtPct(deal.target_irr)}</div></td>
									<td class="metric-cell"><div class="metric-label">MINIMUM</div><div class="metric-value">{fmt$(deal.minimum_investment)}</div></td>
									<td class="metric-cell"><div class="metric-label">LOCKUP</div><div class="metric-value">{deal.lockup_period || '--'}</div></td>
									<td class="metric-cell"><div class="metric-label">DISTRIBUTION</div><div class="metric-value">{deal.distribution_frequency || 'Unknown'}</div></td>
								</tr>
							</tbody></table>
						</td></tr>

						<!-- Metrics Row 2 -->
						<tr><td style="background:#fff;padding:0 24px 16px;">
							<table cellpadding="0" cellspacing="0" border="0" width="100%" style="border-top:1px solid #F0F0EE;">
								<tbody><tr>
									<td class="metric-cell"><div class="metric-label">LP/GP SPLIT</div><div class="metric-value">{deal.lp_gp_split || '--'}</div></td>
									<td class="metric-cell"><div class="metric-label">EQUITY MULT.</div><div class="metric-value">{deal.equity_multiple ? deal.equity_multiple.toFixed(2) + 'x' : '--'}</div></td>
									<td class="metric-cell"><div class="metric-label">MANAGER SIZE</div><div class="metric-value">{deal.manager_aum ? fmt$(deal.manager_aum) : '--'}</div></td>
									<td class="metric-cell"><div class="metric-label">FOUNDED</div><div class="metric-value">{deal.founded_year || '--'}</div></td>
								</tr>
							</tbody></table>
						</td></tr>

						<!-- Funding progress bar -->
						{#if deal.funding_percentage || deal.amount_raised}
						<tr><td style="background:#fff;padding:0 24px 16px;">
							<div style="display:flex;justify-content:space-between;font-size:11px;color:#8A9AA0;margin-bottom:6px;">
								<span>{fmt$(deal.amount_raised)} raised</span>
								<span>{deal.funding_percentage || 0}% funded</span>
							</div>
							<div style="background:#F0F0EE;border-radius:4px;height:8px;overflow:hidden;">
								<div style="background:linear-gradient(90deg,#51BE7B,#3da864);height:100%;border-radius:4px;width:{deal.funding_percentage || 0}%;"></div>
							</div>
						</td></tr>
						{/if}

						<!-- Skip + Save buttons -->
						<tr><td style="background:#fff;padding:8px 24px 20px;">
							<table cellpadding="0" cellspacing="0" border="0" width="100%">
								<tbody><tr>
									<td style="width:48%;padding-right:6px;">
										<a href="{BASE_URL}/api/deal-save?id={deal.id}&email={encodeURIComponent(userEmail)}&action=skip" class="btn-skip">&#10005; SKIP</a>
									</td>
									<td style="width:52%;padding-left:6px;">
										<a href="{BASE_URL}/api/deal-save?id={deal.id}&email={encodeURIComponent(userEmail)}" class="btn-save">&#128204; SAVE</a>
									</td>
								</tr>
							</tbody></table>
						</td></tr>

					</tbody></table>
				</td></tr>

				<!-- More deals -->
				<tr><td align="center" style="padding:4px 0 20px;">
					<a href={BASE_URL} style="font-size:13px;font-weight:600;color:#51BE7B;text-decoration:none;">+ {deal.total_deals || 0} more deals in the database &#8594;</a>
				</td></tr>

				<!-- Buy box nudge -->
				<tr><td>
					<table cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#F0F9F4;border-radius:10px;">
						<tbody><tr><td style="padding:16px 20px;text-align:center;">
							<div style="font-size:13px;font-weight:700;color:#141413;margin-bottom:4px;">Not the right fit?</div>
							<div style="font-size:12px;color:#607179;margin-bottom:10px;">Update your buy box and we'll send better matches next time.</div>
							<a href="{BASE_URL}/app/plan" style="font-weight:700;font-size:13px;color:#51BE7B;text-decoration:none;">Update Buy Box &#8594;</a>
						</td></tr>
					</tbody></table>
				</td></tr>

				<!-- Footer -->
				<tr><td align="center" style="padding:24px 0 0;">
					<div style="font-size:11px;color:#8A9AA0;">
						<a href="{BASE_URL}/app/settings" style="color:#8A9AA0;text-decoration:underline;">Manage preferences</a>
						<span style="margin:0 4px;">&#183;</span>
						<a href="{BASE_URL}/api/unsubscribe?email={encodeURIComponent(userEmail)}" style="color:#8A9AA0;text-decoration:underline;">Unsubscribe</a>
					</div>
					<div style="font-size:11px;color:#C4CDD1;margin-top:8px;">Grow Your Cashflow &#183; growyourcashflow.io</div>
				</td></tr>

			</tbody></table>
		</td></tr></tbody>
	</table>

</div>
{/if}
</div>

<style>
	.loading {
		display: flex;
		align-items: center;
		justify-content: center;
		min-height: 60vh;
		font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
		color: #8A9AA0;
		font-size: 14px;
	}

	.preview-wrapper {
		margin: 0;
		padding: 0;
		background: #FAF9F5;
		font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
		min-height: 100vh;
		max-width: 520px;
		margin: 0 auto;
	}

	.toolbar {
		background: #1a2332;
		padding: 12px 24px;
		display: flex;
		align-items: center;
		gap: 12px;
		border-radius: 8px 8px 0 0;
		margin-top: 32px;
	}

	.toolbar-label {
		font-size: 12px;
		font-weight: 700;
		color: #51BE7B;
		text-transform: uppercase;
		letter-spacing: 0.5px;
	}

	.toolbar-hint {
		font-size: 11px;
		color: rgba(255, 255, 255, 0.5);
	}

	.email-header {
		background: #fff;
		border-bottom: 1px solid #e5e5e5;
		padding: 16px 24px;
		font-size: 12px;
		color: #8A9AA0;
	}

	.email-header .from {
		color: #141413;
		font-weight: 600;
		font-size: 13px;
	}

	.email-header .meta {
		margin-top: 4px;
	}

	.email-header .meta strong {
		color: #141413;
	}

	.badge {
		display: inline-block;
		font-size: 11px;
		font-weight: 700;
		padding: 4px 10px;
		border-radius: 4px;
		letter-spacing: 0.3px;
	}

	.badge-asset {
		background: rgba(255, 255, 255, 0.15);
		color: #fff;
		margin-right: 6px;
	}

	.badge-type {
		background: rgba(81, 190, 123, 0.25);
		color: #51BE7B;
	}

	:global(.metric-cell) {
		padding: 14px 0;
		width: 25%;
	}

	:global(.metric-label) {
		font-size: 10px;
		font-weight: 600;
		color: #8A9AA0;
		letter-spacing: 0.5px;
	}

	:global(.metric-value) {
		font-size: 15px;
		font-weight: 700;
		color: #141413;
		margin-top: 2px;
	}

	:global(.metric-value.green) {
		color: #51BE7B;
	}

	.btn-skip {
		display: block;
		text-align: center;
		padding: 12px;
		border: 2px solid #DDE5E8;
		border-radius: 8px;
		font-size: 13px;
		font-weight: 700;
		color: #8A9AA0;
		text-decoration: none;
	}

	.btn-skip:hover {
		border-color: #c4cdd1;
		color: #607179;
	}

	.btn-save {
		display: block;
		text-align: center;
		padding: 12px;
		background: #51BE7B;
		border-radius: 8px;
		font-size: 13px;
		font-weight: 700;
		color: #fff;
		text-decoration: none;
	}

	.btn-save:hover {
		background: #3da864;
	}
</style>
