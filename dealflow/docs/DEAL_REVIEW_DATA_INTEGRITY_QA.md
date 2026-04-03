# Deal Review Data Integrity QA

Use this checklist after deploying the deal review data integrity fix to Sandbox.

## Scope

This QA validates four things:

1. The schema migration is present.
2. Admin edits persist and remain authoritative.
3. AI extraction no longer silently overwrites admin edits.
4. Stale saves fail loudly instead of silently winning.

## Required Migration

Apply:

```bash
npx supabase db push
```

Expected migration:

- `supabase/migrations/063_review_field_state_guards.sql`

## Existing Data Backfill

Existing deals created before this release will not have `review_field_state` yet. To protect current stored values from silent AI overwrite, run the conservative backfill before broader Sandbox QA:

```bash
npm run backfill:review-field-state
```

Review the dry-run output, then apply:

```bash
npm run backfill:review-field-state:apply
```

For a single deal or a fuller preview:

```bash
npm run backfill:review-field-state -- --deal-id <deal-id>
npm run backfill:review-field-state -- --verbose
```

This backfill treats existing stored values as protected admin overrides by default. That is intentionally conservative: it favors data integrity over automatic AI replacement for pre-existing records.

## Automated Checks

Run these before browser QA:

```bash
npm run audit:migrations:strict
npm run build
node --test ./tests/review-field-state.test.mjs
node --test --import ./scripts/register-codex-alias-loader.mjs ./tests/deal-transform-lending.test.mjs
```

## Schema Verification

Run in the Sandbox SQL editor:

```sql
select
  column_name,
  data_type
from information_schema.columns
where table_schema = 'public'
  and table_name = 'opportunities'
  and column_name in (
    'review_field_state',
    'review_state_version',
    'historical_return_2015',
    'historical_return_2016',
    'historical_return_2017',
    'historical_return_2018',
    'historical_return_2019',
    'historical_return_2020',
    'historical_return_2021',
    'historical_return_2022',
    'historical_return_2023',
    'historical_return_2024',
    'historical_return_2025'
  )
order by column_name;
```

Expected:

- `review_field_state` exists as `jsonb`
- `review_state_version` exists as `bigint`
- historical return columns exist through `historical_return_2025`

Verify the audit table:

```sql
select
  table_name
from information_schema.tables
where table_schema = 'public'
  and table_name = 'review_field_events';
```

## Data Verification

Pick one known Sandbox deal and inspect:

```sql
select
  id,
  investment_name,
  review_state_version,
  review_field_state,
  historical_return_2023,
  historical_return_2024,
  historical_return_2025
from opportunities
where id = '<deal-id>';
```

After an admin save, expected:

- `review_state_version` increments
- edited fields appear in `review_field_state`
- admin-edited fields have:
  - `adminOverrideActive = true`
  - `adminOverrideValue`
  - `lastWriter = 'admin'`

After AI apply without forced overwrite, expected:

- AI values update `aiValue`
- admin-edited fields keep the admin final value
- blocked fields remain `adminOverrideActive = true`

Inspect event history:

```sql
select
  field_key,
  event_type,
  actor_type,
  actor_email,
  previous_value,
  next_value,
  metadata,
  created_at
from review_field_events
where opportunity_id = '<deal-id>'
order by created_at desc
limit 50;
```

Expected event types:

- `admin_save`
- `ai_apply`
- `ai_update_blocked_by_admin`
- `ai_overwrite_admin`
- `reset_to_ai`

## Manual Sandbox QA

### 1. Admin edit survives navigation

1. Open a lending deal in Deal Review.
2. Go to `Historical Performance`.
3. Edit returns for `2023`, `2024`, and `2025`.
4. Save.
5. Navigate to another step.
6. Navigate back.

Expected:

- Values remain visible.
- Header state shows `Saved`.
- No field silently reverts.

### 2. Admin edit survives refresh

1. Save a changed field.
2. Refresh the page.

Expected:

- The saved value reloads.
- The DB row shows the updated canonical value and review field state entry.

### 3. Unsaved navigation is protected

1. Change a field without saving.
2. Click Back or another already-unlocked earlier step.

Expected:

- A confirmation prompt appears.
- Cancel keeps the local draft.

### 4. Stale save is blocked

1. Open the same deal in two browser sessions.
2. In session A, edit and save a field.
3. In session B, edit the same field and save without refreshing.

Expected:

- Session B gets a clear conflict error.
- Session B sees `Load latest saved version`.
- Session B's local draft is not silently overwritten.

### 5. Re-extraction previews only

1. Open a review step with source documents attached.
2. Click `Re-extract this step`.

Expected:

- A preview card appears.
- No field changes immediately.
- The preview shows `Current` vs `Extracted`.

### 6. Safe apply respects admin authority

1. Admin-edit a field and save it.
2. Re-extract the same step.
3. Click `Apply safe updates`.

Expected:

- Admin-edited fields remain unchanged.
- The UI reports blocked/protected fields.
- `review_field_events` records `ai_update_blocked_by_admin`.

### 7. Forced overwrite is explicit

1. In the extraction preview, choose overwrite for a locked field.
2. Confirm the warning.

Expected:

- The admin override is replaced only after confirmation.
- The event log records `ai_overwrite_admin`.

### 8. Reset to extracted value is explicit

1. Admin-edit and save a field.
2. Use `Reset to extracted value`.

Expected:

- The field returns to the stored AI value.
- The event log records `reset_to_ai`.

### 9. Save failure remains visible

1. Simulate a failing save in Sandbox or via dev tools.

Expected:

- Header state changes to `Save failed`.
- The local draft remains visible.
- No silent fallback message claims the deal was saved.

## Release Sign-Off

Do not promote beyond Sandbox until all of these are true:

- Migration applied successfully.
- Schema verification queries pass.
- Admin edit persistence passes for historical returns.
- Stale save conflict is confirmed manually.
- Re-extraction preview and safe apply both pass.
- Event log rows are being written in `review_field_events`.
