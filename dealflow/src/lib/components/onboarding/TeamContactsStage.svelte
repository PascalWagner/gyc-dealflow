<script>
	import {
		TEAM_CONTACT_ROLE_OPTIONS,
		createEmptyTeamContact,
		deriveTeamRoleAssignments,
		hasMeaningfulContactValues,
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
	let samePersonPreference = $state(false);

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
		const useSamePerson = samePersonHandlesBothRoles;
		let operatorLeadContactId = roleAssignments.operatorLead?.id || '';
		let investorRelationsContactId = roleAssignments.investorRelations?.id || '';

		if (role === 'operator') {
			operatorLeadContactId = contactId;
			if (useSamePerson) investorRelationsContactId = contactId;
		} else {
			investorRelationsContactId = contactId;
			if (useSamePerson) operatorLeadContactId = contactId;
		}

		console.info('[team-stage] role assignment', {
			role,
			contactId,
			samePersonHandlesBothRoles: useSamePerson
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

	function toggleSamePerson(nextValue) {
		samePersonPreference = nextValue;
		let operatorLeadContactId = roleAssignments.operatorLead?.id || '';
		let investorRelationsContactId = roleAssignments.investorRelations?.id || '';

		if (nextValue) {
			const sharedContactId =
				operatorLeadContactId ||
				investorRelationsContactId ||
				currentContacts.find((contact) => hasMeaningfulContactValues(contact))?.id ||
				currentContacts[0]?.id ||
				'';

			operatorLeadContactId = sharedContactId;
			investorRelationsContactId = sharedContactId;
		} else if (operatorLeadContactId && investorRelationsContactId && operatorLeadContactId === investorRelationsContactId) {
			const alternateContact = currentContacts.find((contact) => contact.id !== operatorLeadContactId);
			investorRelationsContactId = alternateContact?.id || investorRelationsContactId;
		}

		console.info('[team-stage] same-person-toggle', {
			value: nextValue,
			operatorLeadContactId,
			investorRelationsContactId
		});

		commit(
			applyAssignments(currentContacts, {
				operatorLeadContactId,
				investorRelationsContactId
			}),
			'toggle-same-person'
		);
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

	const currentContacts = $derived(getContacts());
	const strictValidation = $derived(validateTeamContacts(currentContacts, { mode: 'continue' }));
	const roleAssignments = $derived(deriveTeamRoleAssignments(currentContacts));
	const samePersonHandlesBothRoles = $derived(
		samePersonPreference || roleAssignments.samePersonHandlesBothRoles
	);
	const stageStatus = $derived(strictValidation.valid ? 'Ready' : 'Needs attention');
	const operatorLeadContact = $derived(roleAssignments.operatorLead);
	const investorRelationsContact = $derived(roleAssignments.investorRelations);
	const additionalContacts = $derived(roleAssignments.additionalContacts || []);
	const roleCards = $derived([
		{ key: 'operator', label: 'CEO / Operator lead', contact: operatorLeadContact },
		{ key: 'ir', label: 'Investor relations', contact: investorRelationsContact }
	]);
	const editingContact = $derived(
		currentContacts.find((contact) => contact.id === editingContactId) || null
	);
	const displayError = $derived(error || (submitAttempted ? strictValidation.formError : '') || '');
	const errorTone = $derived(
		/enrich/i.test(String(displayError || '')) ? 'note' : 'error'
	);
</script>

<section class="team-stage">
	<div class="team-stage__intro">
		<p class="team-stage__lede">Confirm who leads the operator and who handles investor conversations.</p>
		<div class="team-stage__heading">
			<div>
				<div class="team-stage__eyebrow">Team Contacts</div>
				<h2>Add the two people an LP needs to understand and reach.</h2>
			</div>
			<span class={`team-stage__status team-stage__status--${stageStatus === 'Ready' ? 'ready' : 'attention'}`}>
				{stageStatus}
			</span>
		</div>
	</div>

	<div class="team-role-grid">
		{#each roleCards as roleCard}
			<article class="role-card">
				<div class="role-card__label">{roleCard.label}</div>
				<div class="role-card__name">
					{roleCard.contact ? teamContactFullName(roleCard.contact) || 'Untitled contact' : 'No contact assigned yet'}
				</div>
				<div class="role-card__line">{roleCard.contact ? contactTitleLine(roleCard.contact) : 'Choose an existing contact or add a new one.'}</div>
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

	<label class="same-person-toggle">
		<input
			type="checkbox"
			checked={samePersonHandlesBothRoles}
			onchange={(event) => toggleSamePerson(event.currentTarget.checked)}
		>
		<span>Same person handles both roles</span>
	</label>

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

	<section class="team-section">
		<div class="team-section__header">
			<div>
				<div class="team-section__eyebrow">Additional team members</div>
				<h3>Supporting contacts</h3>
			</div>
			<button type="button" class="ghost-btn" onclick={addContact}>Add team member</button>
		</div>

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
		{:else}
			<p class="team-empty">No additional team members yet.</p>
		{/if}
	</section>

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
		<div class={`team-message team-message--${errorTone}`}>{displayError}</div>
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
			linear-gradient(180deg, rgba(252, 251, 247, 0.98), rgba(245, 246, 241, 0.98)),
			radial-gradient(circle at top right, rgba(31, 81, 89, 0.06), transparent 40%);
		border: 1px solid rgba(31, 81, 89, 0.08);
		box-shadow: 0 20px 44px rgba(16, 37, 42, 0.05);
	}

	.team-stage__intro {
		display: grid;
		gap: 12px;
	}

	.team-stage__lede {
		margin: 0;
		font-size: 14px;
		line-height: 1.6;
		color: var(--text-secondary);
	}

	.team-stage__heading {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 16px;
	}

	.team-stage__heading h2,
	.team-section__header h3,
	.team-panel__header h3 {
		margin: 6px 0 0;
		font-family: var(--font-ui);
		font-size: clamp(1.8rem, 2.8vw, 2.3rem);
		font-weight: 800;
		line-height: 1.1;
		color: var(--text-dark);
		letter-spacing: -0.03em;
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

	.team-stage__status {
		padding: 9px 14px;
		border-radius: 999px;
		font-family: var(--font-ui);
		font-size: 12px;
		font-weight: 800;
	}

	.team-stage__status--attention {
		background: rgba(180, 122, 22, 0.1);
		color: #9a5e11;
	}

	.team-stage__status--ready {
		background: rgba(81, 190, 123, 0.14);
		color: #165c47;
	}

	.team-role-grid {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 16px;
	}

	.role-card,
	.team-panel,
	.additional-contact-card {
		padding: 18px;
		border-radius: 22px;
		border: 1px solid rgba(31, 81, 89, 0.08);
		background: rgba(255, 255, 255, 0.58);
	}

	.role-card {
		display: grid;
		gap: 12px;
	}

	.role-card__name {
		font-family: var(--font-ui);
		font-size: 1.8rem;
		font-weight: 800;
		line-height: 1.15;
		color: var(--text-dark);
		letter-spacing: -0.02em;
	}

	.role-card__line,
	.team-empty,
	.team-message,
	.additional-contact-card span,
	.additional-contact-card small,
	.contact-picker-card span,
	.contact-picker-card small {
		font-size: 14px;
		line-height: 1.55;
		color: var(--text-secondary);
	}

	.role-card__details {
		display: grid;
		gap: 10px;
	}

	.role-detail {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		padding: 10px 12px;
		border-radius: 14px;
		background: rgba(250, 248, 242, 0.88);
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

	.same-person-toggle {
		display: inline-flex;
		align-items: center;
		gap: 10px;
		font-size: 14px;
		color: var(--text-dark);
	}

	.same-person-toggle input {
		width: 18px;
		height: 18px;
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
		background: rgba(255, 255, 255, 0.56);
		text-align: left;
		cursor: pointer;
	}

	.contact-picker-card--add {
		border-style: dashed;
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

	.team-message--note {
		background: rgba(31, 81, 89, 0.08);
		color: var(--text-secondary);
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

	@media (max-width: 900px) {
		.team-role-grid,
		.team-edit-grid {
			grid-template-columns: 1fr;
		}

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

		.team-stage__heading,
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
