<script>
	import {
		TEAM_CONTACT_ROLE_OPTIONS,
		createEmptyTeamContact,
		deriveTeamRoleAssignments,
		normalizeTeamContacts,
		teamContactFullName,
		validateTeamContacts
	} from '$lib/onboarding/teamContacts.js';

	const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

	let {
		contacts = [],
		error = '',
		onchange = () => {},
		onback = () => {},
		oncontinue = () => {}
	} = $props();

	let pickerRole = $state('');
	let editingContactId = $state('');
	let submitAttempted = $state(false);
	let touchedFields = $state({});

	function getContacts() {
		return normalizeTeamContacts(contacts, {
			ensureOne: false,
			preserveEmpty: true
		});
	}

	function commit(nextContacts, reason = 'updated') {
		const normalized = normalizeTeamContacts(nextContacts, {
			ensureOne: false,
			preserveEmpty: true
		});
		onchange(normalized);
		console.info('[team-stage] contacts changed', {
			reason,
			contactCount: normalized.length
		});
	}

	function markTouched(contactId, field) {
		touchedFields = {
			...touchedFields,
			[`${contactId}:${field}`]: true
		};
	}

	function applyAssignments(nextContacts, { operatorLeadContactId = '', investorRelationsContactId = '' }) {
		return nextContacts.map((contact) => ({
			...contact,
			isPrimary: Boolean(operatorLeadContactId) && contact.id === operatorLeadContactId,
			isInvestorRelations: Boolean(investorRelationsContactId) && contact.id === investorRelationsContactId
		}));
	}

	function updateContact(contactId, patch) {
		commit(
			currentContacts.map((contact) =>
				contact.id === contactId
					? {
						...contact,
						...patch,
						isUserEdited: true
					}
					: contact
			),
			'edit-contact'
		);
	}

	function createContact(defaultRole = '') {
		return createEmptyTeamContact({
			role: defaultRole,
			isUserEdited: true,
			displayOrder: currentContacts.length
		});
	}

	function addContact() {
		const nextContact = createContact('');
		console.info('[team-stage] add-team-member', {
			contactId: nextContact.id
		});
		commit([...currentContacts, nextContact], 'add-team-member');
		editingContactId = nextContact.id;
		pickerRole = '';
	}

	function addRoleContact(role) {
		const nextContact = createContact(role === 'operator' ? 'CEO' : 'Investor Relations');
		const nextContacts = [...currentContacts, nextContact];
		assignRole(role, nextContact.id, nextContacts);
		editingContactId = nextContact.id;
	}

	function removeContact(contactId) {
		const assignments = roleAssignments;
		if (assignments.operatorLead?.id === contactId || assignments.investorRelations?.id === contactId) return;
		console.info('[team-stage] remove-team-member', {
			contactId
		});
		commit(
			currentContacts.filter((contact) => contact.id !== contactId),
			'remove-team-member'
		);
		if (editingContactId === contactId) {
			editingContactId = '';
		}
	}

	function assignRole(role, contactId, sourceContacts = currentContacts) {
		let operatorLeadContactId = roleAssignments.operatorLead?.id || '';
		let investorRelationsContactId = roleAssignments.investorRelations?.id || '';

		if (role === 'operator') {
			operatorLeadContactId = contactId;
		} else {
			investorRelationsContactId = contactId;
		}

		console.info('[team-stage] role assignment', {
			role,
			contactId
		});

		commit(
			applyAssignments(sourceContacts, {
				operatorLeadContactId,
				investorRelationsContactId
			}),
			'assign-role'
		);
		pickerRole = '';
	}

	function openEditor(contactId, preferredRole = '') {
		if (!contactId) {
			addRoleContact(preferredRole || 'operator');
			return;
		}
		editingContactId = contactId;
		pickerRole = '';
	}

	function handleContinue() {
		submitAttempted = true;
		oncontinue();
	}

	function findContactIndex(contactId) {
		return currentContacts.findIndex((contact) => contact.id === contactId);
	}

	function getFieldError(contactId, field) {
		const contactIndex = findContactIndex(contactId);
		if (contactIndex < 0) return '';
		const message = strictValidation.errors[contactIndex]?.[field] || '';
		if (!message) return '';
		const touched = touchedFields[`${contactId}:${field}`];
		return submitAttempted || touched ? message : '';
	}

	function contactTitleLine(contact = {}) {
		const parts = [contact.role, contact.company].map((value) => String(value || '').trim()).filter(Boolean);
		return parts.join(', ') || 'No title or company yet';
	}

	function emailDisplay(contact = {}) {
		const email = String(contact.email || '').trim().toLowerCase();
		return EMAIL_PATTERN.test(email) ? email : 'no valid email';
	}

	function phoneDisplay(contact = {}) {
		return String(contact.phone || '').trim() || 'no phone listed';
	}

	function calendarDisplay(contact = {}) {
		return String(contact.calendarUrl || '').trim() || 'no calendar link';
	}

	function additionalContactSummary(contact = {}) {
		return [String(contact.email || '').trim(), String(contact.phone || '').trim()].filter(Boolean).join(' • ');
	}

	function roleCardStatus(contact = {}) {
		if (!contact) return 'Needs contact';
		if (!EMAIL_PATTERN.test(String(contact.email || '').trim().toLowerCase())) return 'Needs email';
		return 'Ready';
	}

	function roleCardTone(contact = {}) {
		if (!contact) return 'empty';
		return EMAIL_PATTERN.test(String(contact.email || '').trim().toLowerCase()) ? 'ready' : 'attention';
	}

	const currentContacts = $derived(getContacts());
	const strictValidation = $derived(validateTeamContacts(currentContacts, { mode: 'continue' }));
	const roleAssignments = $derived(deriveTeamRoleAssignments(currentContacts));
	const operatorLeadContact = $derived(roleAssignments.operatorLead);
	const investorRelationsContact = $derived(roleAssignments.investorRelations);
	const additionalContacts = $derived(roleAssignments.additionalContacts || []);
	const roleCards = $derived([
		{
			key: 'operator',
			label: 'Operator lead',
			help: 'The person who can confirm the sponsor, deal details, and factual accuracy.',
			contact: operatorLeadContact
		},
		{
			key: 'ir',
			label: 'Investor relations',
			help: 'The person an LP should reach when they need follow-up or updates.',
			contact: investorRelationsContact
		}
	]);
	const editingContact = $derived(
		currentContacts.find((contact) => contact.id === editingContactId) || null
	);
	const displayError = $derived.by(() => {
		const nextError = error || (submitAttempted ? strictValidation.formError : '') || '';
		return /enrich/i.test(String(nextError || '')) ? '' : nextError;
	});
	const stageSummary = $derived(
		strictValidation.valid
			? 'Both LP-facing roles have usable contact details.'
			: 'Keep this step focused. You only need an operator lead and an investor relations contact with valid emails.'
	);
</script>

<section class="team-stage">
	<div class="team-stage__intro">
		<div class="team-stage__intro-copy">
			<div class="team-stage__eyebrow">Team Contacts</div>
			<h2>Add the two contacts an LP will actually use.</h2>
			<p>{stageSummary}</p>
		</div>
	</div>

	<div class="team-role-grid">
		{#each roleCards as roleCard}
			<article class={`role-card role-card--${roleCardTone(roleCard.contact)}`}>
				<div class="role-card__header">
					<div>
						<div class="role-card__label">{roleCard.label}</div>
						<h3>
							{roleCard.contact
								? teamContactFullName(roleCard.contact) || 'Untitled contact'
								: 'No contact assigned yet'}
						</h3>
						<p class="role-card__subcopy">
							{roleCard.contact ? contactTitleLine(roleCard.contact) : roleCard.help}
						</p>
					</div>
					<span class={`role-card__flag role-card__flag--${roleCardTone(roleCard.contact)}`}>
						{roleCardStatus(roleCard.contact)}
					</span>
				</div>

				<div class="role-card__details">
					<div class="role-detail">
						<span>Email</span>
						<strong>{roleCard.contact ? emailDisplay(roleCard.contact) : 'no valid email'}</strong>
					</div>
					<div class="role-detail">
						<span>Phone</span>
						<strong>{roleCard.contact ? phoneDisplay(roleCard.contact) : 'no phone listed'}</strong>
					</div>
					<div class="role-detail">
						<span>Calendar</span>
						<strong>{roleCard.contact ? calendarDisplay(roleCard.contact) : 'no calendar link'}</strong>
					</div>
				</div>

				<div class="role-card__actions">
					<button type="button" class="ghost-btn" onclick={() => pickerRole = roleCard.key}>
						Select contact
					</button>
					<button type="button" class="ghost-btn" onclick={() => openEditor(roleCard.contact?.id || '', roleCard.key)}>
						Edit
					</button>
				</div>
			</article>
		{/each}
	</div>

	{#if pickerRole}
		<section class="team-panel">
			<div class="team-panel__header">
				<div>
					<div class="team-panel__eyebrow">Select contact</div>
					<h3>{pickerRole === 'operator' ? 'Choose the operator lead' : 'Choose the investor relations contact'}</h3>
				</div>
				<button type="button" class="icon-btn" aria-label="Close contact picker" onclick={() => pickerRole = ''}>×</button>
			</div>
			<div class="contact-picker-list">
				{#each currentContacts as contact}
					<button type="button" class="contact-picker-card" onclick={() => assignRole(pickerRole, contact.id)}>
						<div>
							<strong>{teamContactFullName(contact) || contact.email || 'Untitled contact'}</strong>
							<span>{contactTitleLine(contact)}</span>
						</div>
						<small>{additionalContactSummary(contact) || 'Add more detail in edit mode'}</small>
					</button>
				{/each}
				<button type="button" class="contact-picker-card contact-picker-card--add" onclick={() => addRoleContact(pickerRole)}>
					<div>
						<strong>Add a new contact</strong>
						<span>Create a fresh record and assign it to this role.</span>
					</div>
				</button>
			</div>
		</section>
	{/if}

	<section class="team-support">
		<div class="team-support__copy">
			<div class="team-section__eyebrow">Supporting contacts</div>
			<h3 class="team-support__title">Supporting contacts</h3>
			<p>
				{#if additionalContacts.length > 0}
					{additionalContacts.length} supporting contact{additionalContacts.length === 1 ? '' : 's'} saved.
				{:else}
					This is optional. Keep the page lean unless another person materially helps with diligence or follow-up.
				{/if}
			</p>
		</div>
		<button type="button" class="ghost-btn" onclick={addContact}>Add supporting contact</button>
	</section>

	{#if additionalContacts.length > 0}
		<div class="additional-contact-list">
			{#each additionalContacts as contact}
				<div class="additional-contact-card">
					<div>
						<strong>{teamContactFullName(contact) || 'Untitled contact'}</strong>
						<span>{contactTitleLine(contact)}</span>
						<small>{additionalContactSummary(contact) || 'No direct contact details yet'}</small>
					</div>
					<div class="additional-contact-card__actions">
						<button type="button" class="ghost-btn" onclick={() => openEditor(contact.id)}>Edit</button>
						<button type="button" class="ghost-btn ghost-btn--danger" onclick={() => removeContact(contact.id)}>
							Remove
						</button>
					</div>
				</div>
			{/each}
		</div>
	{/if}

	{#if editingContact}
		<section class="team-panel">
			<div class="team-panel__header">
				<div>
					<div class="team-panel__eyebrow">Edit contact</div>
					<h3>{teamContactFullName(editingContact) || editingContact.email || 'New contact'}</h3>
				</div>
				<button type="button" class="icon-btn" aria-label="Close contact editor" onclick={() => editingContactId = ''}>×</button>
			</div>

			<div class="team-edit-grid">
				<label class="team-field">
					<span>First name</span>
					<input
						type="text"
						value={editingContact.firstName}
						placeholder="Michael"
						oninput={(event) => updateContact(editingContact.id, { firstName: event.currentTarget.value })}
						onblur={() => markTouched(editingContact.id, 'firstName')}
					>
					{#if getFieldError(editingContact.id, 'firstName')}
						<small class="field-error">{getFieldError(editingContact.id, 'firstName')}</small>
					{/if}
				</label>

				<label class="team-field">
					<span>Last name</span>
					<input
						type="text"
						value={editingContact.lastName}
						placeholder="Anderson"
						oninput={(event) => updateContact(editingContact.id, { lastName: event.currentTarget.value })}
						onblur={() => markTouched(editingContact.id, 'lastName')}
					>
					{#if getFieldError(editingContact.id, 'lastName')}
						<small class="field-error">{getFieldError(editingContact.id, 'lastName')}</small>
					{/if}
				</label>

				<label class="team-field">
					<span>Email</span>
					<input
						type="email"
						value={editingContact.email}
						placeholder="michael@capitalfund.com"
						oninput={(event) => updateContact(editingContact.id, { email: event.currentTarget.value })}
						onblur={() => markTouched(editingContact.id, 'email')}
					>
					{#if getFieldError(editingContact.id, 'email')}
						<small class="field-error">{getFieldError(editingContact.id, 'email')}</small>
					{/if}
				</label>

				<label class="team-field">
					<span>Phone</span>
					<input
						type="tel"
						value={editingContact.phone}
						placeholder="(555) 555-5555"
						oninput={(event) => updateContact(editingContact.id, { phone: event.currentTarget.value })}
					>
				</label>

				<label class="team-field">
					<span>Title / role</span>
					<input
						type="text"
						list={`team-role-options-${editingContact.id}`}
						value={editingContact.role}
						placeholder="CEO"
						oninput={(event) => updateContact(editingContact.id, { role: event.currentTarget.value })}
					>
					<datalist id={`team-role-options-${editingContact.id}`}>
						{#each TEAM_CONTACT_ROLE_OPTIONS as option}
							<option value={option}></option>
						{/each}
					</datalist>
				</label>

				<label class="team-field">
					<span>Company</span>
					<input
						type="text"
						value={editingContact.company}
						placeholder="Capital Fund 2"
						oninput={(event) => updateContact(editingContact.id, { company: event.currentTarget.value })}
					>
				</label>

				<label class="team-field">
					<span>LinkedIn URL</span>
					<input
						type="url"
						value={editingContact.linkedinUrl}
						placeholder="https://linkedin.com/in/..."
						oninput={(event) => updateContact(editingContact.id, { linkedinUrl: event.currentTarget.value })}
						onblur={() => markTouched(editingContact.id, 'linkedinUrl')}
					>
					{#if getFieldError(editingContact.id, 'linkedinUrl')}
						<small class="field-error">{getFieldError(editingContact.id, 'linkedinUrl')}</small>
					{/if}
				</label>

				<label class="team-field">
					<span>Calendar link</span>
					<input
						type="url"
						value={editingContact.calendarUrl}
						placeholder="https://calendly.com/..."
						oninput={(event) => updateContact(editingContact.id, { calendarUrl: event.currentTarget.value })}
						onblur={() => markTouched(editingContact.id, 'calendarUrl')}
					>
					{#if getFieldError(editingContact.id, 'calendarUrl')}
						<small class="field-error">{getFieldError(editingContact.id, 'calendarUrl')}</small>
					{/if}
				</label>
			</div>

			<div class="team-panel__footer">
				{#if roleAssignments.operatorLead?.id !== editingContact.id && roleAssignments.investorRelations?.id !== editingContact.id}
					<button type="button" class="ghost-btn ghost-btn--danger" onclick={() => removeContact(editingContact.id)}>
						Remove contact
					</button>
				{/if}
				<button type="button" class="primary-btn" onclick={() => editingContactId = ''}>Done</button>
			</div>
		</section>
	{/if}

	{#if displayError}
		<div class="team-message team-message--error">{displayError}</div>
	{/if}

	<div class="team-stage__footer">
		<button class="ghost-btn" onclick={onback}>Back</button>
		<button class="primary-btn" onclick={handleContinue}>Continue</button>
	</div>
</section>

<style>
	.team-stage {
		display: grid;
		gap: 18px;
		padding: 28px;
		border-radius: 28px;
		background:
			linear-gradient(180deg, rgba(252, 251, 247, 0.98), rgba(246, 247, 242, 0.98)),
			radial-gradient(circle at top right, rgba(31, 81, 89, 0.05), transparent 42%);
		border: 1px solid rgba(31, 81, 89, 0.08);
		box-shadow: 0 18px 38px rgba(16, 37, 42, 0.04);
	}

	.team-stage__intro {
		display: grid;
		gap: 10px;
	}

	.team-stage__intro-copy {
		display: grid;
		gap: 8px;
		max-width: 62ch;
	}

	.team-stage__intro-copy p,
	.team-support p,
	.team-empty,
	.team-message,
	.additional-contact-card span,
	.additional-contact-card small,
	.contact-picker-card span,
	.contact-picker-card small {
		margin: 0;
		font-size: 14px;
		line-height: 1.6;
		color: var(--text-secondary);
	}

	.team-stage__intro-copy h2 {
		margin: 0;
		font-family: var(--font-ui);
		font-size: clamp(1.9rem, 3vw, 2.45rem);
		font-weight: 800;
		line-height: 1.02;
		color: var(--text-dark);
		letter-spacing: -0.03em;
	}

	.team-panel__header h3,
	.team-section__header h3 {
		margin: 0;
		font-family: var(--font-ui);
		font-size: clamp(1.2rem, 1.8vw, 1.45rem);
		font-weight: 750;
		line-height: 1.12;
		color: var(--text-dark);
		letter-spacing: -0.02em;
	}

	.team-stage__eyebrow,
	.team-section__eyebrow,
	.team-panel__eyebrow,
	.role-card__label {
		font-family: var(--font-ui);
		font-size: 11px;
		font-weight: 800;
		letter-spacing: 0.8px;
		text-transform: uppercase;
		color: var(--text-muted);
	}

	.team-role-grid {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 14px;
	}

	.role-card,
	.team-support,
	.team-panel,
	.additional-contact-card {
		padding: 18px;
		border-radius: 22px;
		border: 1px solid rgba(31, 81, 89, 0.08);
		background: rgba(255, 255, 255, 0.56);
	}

	.role-card {
		display: grid;
		gap: 16px;
	}

	.role-card--attention {
		border-color: rgba(214, 140, 69, 0.18);
		background:
			linear-gradient(180deg, rgba(255, 251, 244, 0.96), rgba(255, 255, 255, 0.8)),
			radial-gradient(circle at top right, rgba(214, 140, 69, 0.08), transparent 40%);
	}

	.role-card--ready {
		background:
			linear-gradient(180deg, rgba(255, 255, 255, 0.88), rgba(248, 251, 248, 0.84)),
			radial-gradient(circle at top right, rgba(81, 190, 123, 0.08), transparent 40%);
	}

	.role-card__header {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 14px;
	}

	.role-card__header h3 {
		margin: 4px 0 0;
		font-family: var(--font-ui);
		font-size: clamp(1.35rem, 1.9vw, 1.72rem);
		font-weight: 780;
		line-height: 1.06;
		color: var(--text-dark);
		letter-spacing: -0.02em;
	}

	.role-card__subcopy {
		margin: 8px 0 0;
		font-size: 14px;
		line-height: 1.55;
		color: var(--text-secondary);
	}

	.role-card__flag {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		padding: 7px 11px;
		border-radius: 999px;
		font-family: var(--font-ui);
		font-size: 11px;
		font-weight: 800;
		letter-spacing: 0.04em;
		white-space: nowrap;
	}

	.role-card__flag--ready {
		background: rgba(81, 190, 123, 0.14);
		color: #165c47;
	}

	.role-card__flag--attention,
	.role-card__flag--empty {
		background: rgba(214, 140, 69, 0.12);
		color: #8c581f;
	}

	.role-card__details {
		display: grid;
		gap: 0;
	}

	.role-detail {
		display: grid;
		grid-template-columns: minmax(82px, auto) minmax(0, 1fr);
		gap: 12px;
		padding: 12px 0;
		border-top: 1px solid rgba(31, 81, 89, 0.08);
	}

	.role-detail:first-child {
		padding-top: 0;
		border-top: 0;
	}

	.role-detail span {
		font-size: 12px;
		font-weight: 700;
		color: var(--text-muted);
		text-transform: uppercase;
		letter-spacing: 0.4px;
	}

	.role-detail strong,
	.additional-contact-card strong,
	.contact-picker-card strong {
		font-size: 14px;
		line-height: 1.45;
		color: var(--text-dark);
		word-break: break-word;
	}

	.role-card__actions,
	.additional-contact-card__actions,
	.team-panel__footer,
	.team-stage__footer {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 10px;
		flex-wrap: wrap;
	}

	.ghost-btn,
	.primary-btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-height: 40px;
		padding: 10px 14px;
		border-radius: 12px;
		font-family: var(--font-ui);
		font-size: 12px;
		font-weight: 800;
		letter-spacing: 0.01em;
		text-decoration: none;
		cursor: pointer;
		transition:
			background 0.16s ease,
			border-color 0.16s ease,
			color 0.16s ease,
			box-shadow 0.16s ease,
			transform 0.16s ease;
		-webkit-appearance: none;
		appearance: none;
	}

	.ghost-btn {
		border: 1px solid rgba(31, 81, 89, 0.14);
		background: rgba(255, 255, 255, 0.92);
		color: var(--text-dark);
		box-shadow: 0 6px 16px rgba(16, 37, 42, 0.04);
	}

	.ghost-btn:hover {
		border-color: rgba(31, 81, 89, 0.22);
		background: rgba(255, 255, 255, 1);
		transform: translateY(-1px);
		box-shadow: 0 10px 20px rgba(16, 37, 42, 0.08);
	}

	.primary-btn {
		border: 1px solid rgba(31, 81, 89, 0.16);
		background: linear-gradient(135deg, #1f5159, #10252a);
		color: #fff;
		box-shadow: 0 12px 24px rgba(16, 37, 42, 0.16);
	}

	.primary-btn:hover {
		transform: translateY(-1px);
		box-shadow: 0 16px 28px rgba(16, 37, 42, 0.2);
	}

	.primary-btn:disabled,
	.ghost-btn:disabled {
		opacity: 0.55;
		cursor: default;
		transform: none;
		box-shadow: none;
	}

	.primary-btn:focus-visible,
	.ghost-btn:focus-visible,
	.contact-picker-card:focus-visible,
	.icon-btn:focus-visible {
		outline: none;
		box-shadow: 0 0 0 3px rgba(81, 190, 123, 0.12);
	}

	.team-support {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 16px;
		flex-wrap: wrap;
		background: rgba(255, 255, 255, 0.42);
		border-color: rgba(31, 81, 89, 0.06);
	}

	.team-support__copy {
		display: grid;
		gap: 6px;
		max-width: 54ch;
	}

	.team-support__title {
		margin: 0;
		font-family: var(--font-ui);
		font-size: clamp(1.08rem, 1.55vw, 1.3rem);
		font-weight: 720;
		line-height: 1.18;
		letter-spacing: -0.01em;
		color: var(--text-dark);
	}

	.team-section {
		display: grid;
		gap: 14px;
	}

	.team-section__header,
	.team-panel__header {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 16px;
	}

	.additional-contact-list,
	.contact-picker-list {
		display: grid;
		gap: 12px;
	}

	.additional-contact-card {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 14px;
	}

	.contact-picker-card {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 14px;
		width: 100%;
		padding: 16px 18px;
		border-radius: 16px;
		border: 1px solid rgba(31, 81, 89, 0.08);
		background: rgba(255, 255, 255, 0.62);
		text-align: left;
		cursor: pointer;
	}

	.contact-picker-card--add {
		border-style: dashed;
	}

	.contact-picker-card:hover {
		border-color: rgba(31, 81, 89, 0.18);
		background: rgba(255, 255, 255, 0.84);
		transform: translateY(-1px);
		box-shadow: 0 12px 22px rgba(16, 37, 42, 0.06);
	}

	.team-edit-grid {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 14px;
		margin-top: 18px;
	}

	.team-field {
		display: grid;
		gap: 8px;
	}

	.team-field span {
		font-size: 12px;
		font-weight: 700;
		color: var(--text-muted);
		text-transform: uppercase;
		letter-spacing: 0.4px;
	}

	.team-field input {
		width: 100%;
		box-sizing: border-box;
		padding: 12px 14px;
		border-radius: 14px;
		border: 1px solid rgba(31, 81, 89, 0.14);
		background: rgba(252, 251, 247, 0.92);
		font-family: var(--font-body);
		font-size: 15px;
		color: var(--text-dark);
	}

	.team-message {
		padding: 14px 16px;
		border-radius: 16px;
	}

	.team-message--error {
		background: rgba(180, 35, 40, 0.08);
		color: #8c2328;
	}

	.field-error {
		color: #b42328;
	}

	.icon-btn {
		width: 36px;
		height: 36px;
		border: 0;
		border-radius: 999px;
		background: rgba(31, 81, 89, 0.08);
		color: var(--text-dark);
		cursor: pointer;
		font-size: 18px;
	}

	.ghost-btn--danger {
		color: #8c2328;
	}

	.ghost-btn--danger:hover {
		border-color: rgba(180, 35, 40, 0.22);
		color: #8c2328;
		background: rgba(180, 35, 40, 0.06);
	}

	@media (max-width: 900px) {
		.team-role-grid,
		.team-edit-grid {
			grid-template-columns: 1fr;
		}

		.team-stage__intro,
		.team-support,
		.additional-contact-card,
		.contact-picker-card {
			flex-direction: column;
			align-items: flex-start;
		}
	}

	@media (max-width: 640px) {
		.team-stage {
			padding: 20px;
		}

		.team-stage__intro,
		.team-section__header,
		.team-panel__header {
			flex-direction: column;
			align-items: stretch;
		}

		.role-detail,
		.role-card__actions,
		.additional-contact-card__actions,
		.team-panel__footer,
		.team-stage__footer {
			flex-direction: column;
			align-items: stretch;
		}
	}
</style>
