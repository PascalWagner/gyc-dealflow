<script>
	import {
		TEAM_CONTACT_ROLE_OPTIONS,
		createEmptyTeamContact,
		normalizeTeamContacts,
		teamContactFullName,
		validateTeamContacts
	} from '$lib/onboarding/teamContacts.js';

	let {
		contacts = [],
		error = '',
		selfContact = null,
		onchange = () => {},
		onback = () => {},
		oncontinue = () => {}
	} = $props();

	function hasMeaningfulValues(contact = {}) {
		return [
			contact.firstName,
			contact.lastName,
			contact.email,
			contact.phone,
			contact.role,
			contact.linkedinUrl,
			contact.calendarUrl
		]
			.map((value) => String(value || '').trim())
			.some(Boolean);
	}

	function getContacts() {
		return normalizeTeamContacts(contacts, { fallbackContact: selfContact, ensureOne: true });
	}

	function commit(nextContacts) {
		onchange(normalizeTeamContacts(nextContacts, { ensureOne: true }));
	}

	function updateContact(index, patch) {
		const nextContacts = getContacts().map((contact, contactIndex) =>
			contactIndex === index
				? {
					...contact,
					...patch
				}
				: contact
		);
		commit(nextContacts);
	}

	function addContact() {
		commit([
			...getContacts(),
			createEmptyTeamContact()
		]);
	}

	function removeContact(index) {
		const current = getContacts();
		if (current.length === 1) {
			commit([createEmptyTeamContact({ isPrimary: true, isInvestorRelations: true })]);
			return;
		}

		const filtered = current.filter((_, contactIndex) => contactIndex !== index);
		if (!filtered.some((contact) => contact.isPrimary)) {
			filtered[0] = {
				...filtered[0],
				isPrimary: true
			};
		}
		commit(filtered);
	}

	function setPrimary(index) {
		commit(
			getContacts().map((contact, contactIndex) => ({
				...contact,
				isPrimary: contactIndex === index
			}))
		);
	}

	function toggleInvestorRelations(index) {
		const nextContacts = getContacts();
		nextContacts[index] = {
			...nextContacts[index],
			isInvestorRelations: !nextContacts[index]?.isInvestorRelations
		};
		commit(nextContacts);
	}

	function useMyInfo() {
		if (!selfContact) return;

		const current = getContacts();
		const candidateIndex = current.findIndex((contact) => !hasMeaningfulValues(contact));
		const targetIndex = candidateIndex >= 0 ? candidateIndex : 0;
		const target = current[targetIndex] || createEmptyTeamContact();

		current[targetIndex] = {
			...target,
			...selfContact,
			id: target.id || '',
			isPrimary: target.isPrimary || current.length === 1,
			isInvestorRelations: target.isInvestorRelations || true
		};

		commit(current);
	}

	const currentContacts = $derived(getContacts());
	const validation = $derived(validateTeamContacts(currentContacts));
	const displayError = $derived(error || '');
</script>

	<div class="step active">
		<div class="step-header">
		<div class="step-counter">Team &amp; Contacts</div>
			<div class="step-title">Build your team and contact bench</div>
			<div class="step-subtitle">
				Add the people LPs should meet. Mark one primary contact and at least one investor-relations contact.
			</div>
	</div>

	<div class="step-body">
		<div class="team-stage-callout">
			<div>
				<strong>Direct introductions stay personal.</strong>
				<span>
					LPs should land with the right person on your team, not a generic inbox.
				</span>
			</div>
			<button type="button" class="btn-secondary team-stage-callout__btn" onclick={useMyInfo}>
				Use my info
			</button>
		</div>

		<div class="team-stage-stack">
			{#each currentContacts as contact, index}
				<div class="team-contact-card">
					<div class="team-contact-card__header">
						<div>
							<div class="team-contact-card__eyebrow">Team member {index + 1}</div>
							<div class="team-contact-card__title">
								{teamContactFullName(contact) || contact.email || 'Add contact details'}
							</div>
						</div>
						<div class="team-contact-card__actions">
							<button
								type="button"
								class:active={contact.isPrimary}
								class="contact-toggle-pill"
								onclick={() => setPrimary(index)}
							>
								Primary contact
							</button>
							<button
								type="button"
								class:active={contact.isInvestorRelations}
								class="contact-toggle-pill"
								onclick={() => toggleInvestorRelations(index)}
							>
								Investor relations
							</button>
							{#if currentContacts.length > 1}
								<button type="button" class="contact-remove-btn" onclick={() => removeContact(index)}>
									Remove
								</button>
							{/if}
						</div>
					</div>

					<div class="form-grid team-contact-grid">
						<div class="form-group">
							<label class="form-label" for={`team-first-name-${index}`}>First name *</label>
							<input
								id={`team-first-name-${index}`}
								class="form-input"
								type="text"
								value={contact.firstName}
								placeholder="Jordan"
								oninput={(event) => updateContact(index, { firstName: event.currentTarget.value })}
							>
							{#if validation.errors[index]?.firstName}
								<div class="field-error">{validation.errors[index].firstName}</div>
							{/if}
						</div>

						<div class="form-group">
							<label class="form-label" for={`team-last-name-${index}`}>Last name *</label>
							<input
								id={`team-last-name-${index}`}
								class="form-input"
								type="text"
								value={contact.lastName}
								placeholder="Rivera"
								oninput={(event) => updateContact(index, { lastName: event.currentTarget.value })}
							>
							{#if validation.errors[index]?.lastName}
								<div class="field-error">{validation.errors[index].lastName}</div>
							{/if}
						</div>

						<div class="form-group">
							<label class="form-label" for={`team-email-${index}`}>Email *</label>
							<input
								id={`team-email-${index}`}
								class="form-input"
								type="email"
								value={contact.email}
								placeholder="jordan@yourfirm.com"
								oninput={(event) => updateContact(index, { email: event.currentTarget.value })}
							>
							{#if validation.errors[index]?.email}
								<div class="field-error">{validation.errors[index].email}</div>
							{/if}
						</div>

						<div class="form-group">
							<label class="form-label" for={`team-phone-${index}`}>Phone</label>
							<input
								id={`team-phone-${index}`}
								class="form-input"
								type="tel"
								value={contact.phone}
								placeholder="(555) 555-5555"
								oninput={(event) => updateContact(index, { phone: event.currentTarget.value })}
							>
						</div>

						<div class="form-group">
							<label class="form-label" for={`team-role-${index}`}>Role</label>
							<input
								id={`team-role-${index}`}
								class="form-input"
								list={`team-role-options-${index}`}
								value={contact.role}
								placeholder="Investor Relations"
								oninput={(event) => updateContact(index, { role: event.currentTarget.value })}
							>
							<datalist id={`team-role-options-${index}`}>
								{#each TEAM_CONTACT_ROLE_OPTIONS as option}
									<option value={option}></option>
								{/each}
							</datalist>
						</div>

						<div class="form-group">
							<label class="form-label" for={`team-linkedin-${index}`}>LinkedIn URL</label>
							<input
								id={`team-linkedin-${index}`}
								class="form-input"
								type="url"
								value={contact.linkedinUrl}
								placeholder="https://linkedin.com/in/..."
								oninput={(event) => updateContact(index, { linkedinUrl: event.currentTarget.value })}
							>
							{#if validation.errors[index]?.linkedinUrl}
								<div class="field-error">{validation.errors[index].linkedinUrl}</div>
							{/if}
						</div>

						<div class="form-group full-width">
							<label class="form-label" for={`team-calendar-${index}`}>Calendar link</label>
							<input
								id={`team-calendar-${index}`}
								class="form-input"
								type="url"
								value={contact.calendarUrl}
								placeholder="https://calendly.com/yourfirm"
								oninput={(event) => updateContact(index, { calendarUrl: event.currentTarget.value })}
							>
							{#if validation.errors[index]?.calendarUrl}
								<div class="field-error">{validation.errors[index].calendarUrl}</div>
							{/if}
						</div>
					</div>
				</div>
			{/each}
		</div>

		<button type="button" class="contact-add-btn" onclick={addContact}>
			Add another team member
		</button>

		{#if displayError}
			<div class="message-banner message-banner--error team-stage-error">{displayError}</div>
		{/if}
	</div>

	<div class="step-footer">
		<button class="btn-secondary" onclick={onback}>
			<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><polyline points="15 18 9 12 15 6"/></svg>
			Back
		</button>
		<button class="btn-primary" onclick={oncontinue} disabled={!validation.valid}>
			Continue
			<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
		</button>
	</div>
</div>

<style>
	.team-stage-callout {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 16px;
		padding: 16px 18px;
		border: 1px solid color-mix(in srgb, var(--primary, #0f766e) 18%, var(--border, #d9e1ec));
		border-radius: 18px;
		background: color-mix(in srgb, var(--primary, #0f766e) 6%, white);
		margin-bottom: 18px;
	}

	.team-stage-callout strong,
	.team-contact-card__title {
		display: block;
		color: var(--text, #11213b);
	}

	.team-stage-callout span,
	.team-contact-card__eyebrow {
		display: block;
		color: var(--text-muted, #64748b);
		font-size: 0.95rem;
	}

	.team-stage-callout__btn {
		flex-shrink: 0;
	}

	.team-stage-stack {
		display: grid;
		gap: 16px;
	}

	.team-contact-card {
		padding: 18px;
		border: 1px solid var(--border, #d9e1ec);
		border-radius: 20px;
		background: color-mix(in srgb, white 92%, var(--bg-card, #f8fafc));
	}

	.team-contact-card__header {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 16px;
		margin-bottom: 16px;
	}

	.team-contact-card__actions {
		display: flex;
		align-items: center;
		gap: 10px;
		flex-wrap: wrap;
		justify-content: flex-end;
	}

	.contact-toggle-pill,
	.contact-remove-btn,
	.contact-add-btn {
		border: 1px solid var(--border, #d9e1ec);
		border-radius: 999px;
		background: white;
		color: var(--text, #11213b);
		font: inherit;
		cursor: pointer;
	}

	.contact-toggle-pill,
	.contact-remove-btn {
		padding: 8px 12px;
	}

	.contact-toggle-pill.active {
		border-color: color-mix(in srgb, var(--primary, #0f766e) 40%, white);
		background: color-mix(in srgb, var(--primary, #0f766e) 12%, white);
		color: var(--primary, #0f766e);
	}

	.contact-remove-btn {
		color: #b42318;
	}

	.team-contact-grid {
		row-gap: 14px;
	}

	.contact-add-btn {
		margin-top: 16px;
		padding: 11px 16px;
	}

	.field-error {
		margin-top: 6px;
		color: #b42318;
		font-size: 0.9rem;
	}

	.team-stage-error {
		margin-top: 14px;
	}

	@media (max-width: 760px) {
		.team-stage-callout,
		.team-contact-card__header {
			flex-direction: column;
			align-items: stretch;
		}

		.team-contact-card__actions {
			justify-content: flex-start;
		}
	}
</style>
