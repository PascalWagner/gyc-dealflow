# Deal Review System — Exhaustive Audit & Refactor Plan

**Date:** April 4, 2026
**Status:** Audit & Planning Only — No Implementation
**Scope:** Full Deal Review Flow, `/dealflow/` application

---

## Executive Summary

The Deal Review system has a mostly coherent architectural intent but a fragmented implementation. The core data model is actually well-conceived — it separates AI-extracted values from human overrides from column fallbacks, and tracks provenance through a `review_field_events` audit table. That's the right idea.

The problems are in the execution gaps: three places define the same field mapping, stage navigation is unnecessarily gated, the enrichment cascade is not resumable, the UI builds on top of a 2,600-line `+page.svelte`, stale-state risks are unmanaged, and the conceptual boundary between "stage completion" and "stage accessibility" has been conflated — which is probably the single most user-visible bug.

The system is not structurally broken. It needs surgical refactoring, not a rewrite. But several decisions must be made explicitly before any implementation begins, or the work will re-create the same problems in cleaner code.

---

## 1. End-to-End System Audit

### 1.1 Source Document Upload

**How it works today:**

- `POST /api/deck-upload` accepts a PDF as base64 (under ~3.5MB) or as a pre-signed direct-upload URL (larger files)
- Files are stored in Supabase Storage at `deals/{dealId}/{dealName}*.pdf`
- A row is created in `deck_submissions` with the submitter, doc type (`ppm` vs `deck`), intent, and surface
- The deal record is updated with `deck_url` or `ppm_url`
- Enrichment cascade is triggered via `_enrichment.js`

**Points of failure:**

- There is no deduplication check before upload. If the same PDF is uploaded twice (e.g., by accident), a second enrichment cascade fires against the same deal.
- The signed URL is valid for 1 year, but there is no indication when the URL will expire or rotate. If a URL expires before a reviewer uses it, the document becomes inaccessible mid-review.
- `deck_submissions` tracks the upload event, but no pointer links a specific `deck_submission` row back to which specific fields it contributed to during extraction. This breaks provenance if multiple documents have been uploaded to the same deal.
- There is no clear UI-level record of "how many documents have been uploaded" in a way that helps a reviewer understand the current document state.
- Auth validation for upload requires the submitter to be in `management_company.authorized_emails`. If that list is stale or the GP is not yet in it, the upload silently fails auth even if the user is otherwise valid.

---

### 1.2 Extraction Trigger & Pipeline

**How it works today:**

- Enrichment is triggered automatically on upload via `_enrichment.js`
- The full enrichment cascade runs: Claude PDF → Claude text fallback → OpenAI → Grok
- Parallel secondary lookups run: SEC EDGAR, RentCast, Census/BLS, background check, sponsor track record, deal matching
- Results are returned as a preview (found fields, sources, steps, notes)
- A separate `POST /api/deal-confirm-enrichment` saves the preview to empty DB fields only — it never overwrites

**Points of failure:**

- The cascade is not resumable. If SEC EDGAR times out, or if OpenAI fails, the entire job is reported as a failure even if Claude successfully extracted 150 fields. There is no partial success path.
- Multiple enrichment runs can fire concurrently (double-click "Extract" or upload triggers one while a manual trigger is already running). Both write to the same `review_field_state.aiValue` fields with no coalescing or lock. Last write wins, unpredictably.
- `deal-confirm-enrichment` only saves to empty fields. Correct and safe for the first run. But if a reviewer manually clears a field and then re-extracts, the cleared field is now "empty" and will be overwritten by the next confirmed extraction. The human clear is not treated as an intentional act.
- The enrichment prompt specifies 150+ JSON keys. If Claude returns a key not in the canonical list, or uses alternate casing, the value is silently dropped. No logging of unrecognized keys.
- Historical returns are extracted as an array of `{year, value, type}` objects but stored as individual `historical_return_YYYY` columns. The normalization logic is bespoke and off-by-one errors are easy to introduce.
- The enrichment pipeline runs on every upload, including re-uploads of the same document. No check for "have we already extracted from this file?"

---

### 1.3 Extracted Value Storage

**How it works today:**

- Extracted values are stored in two places simultaneously:
  1. As `review_field_state[fieldKey].aiValue` with `aiValuePresent=true`, in the `review_field_state` JSONB column
  2. Directly into the deal's flat column (e.g., `investment_name`) if no value exists there yet

**Points of failure:**

- This dual-write creates ambiguity. When the UI reads a field value, it checks `review_field_state` first, but if `review_field_state` doesn't exist for a field (added before the JSONB structure was introduced), it reads the flat column. Unknown population of older fields have only flat column values and no `aiValue` tracking.
- The flat column write and the `review_field_state` write are not atomically coordinated. A crash between them leaves the two stores inconsistent.
- Fields without `review_field_state` support cannot participate in the override model. Admin edits to these fields silently overwrite extracted values with no audit trail of the original extracted value.
- `review_state_version` is incremented on save, but there is no versioning of the extracted values themselves. You cannot say "what did Claude extract the first time?" if the extraction has been run more than once.

---

### 1.4 Value Read-Back Into UI

**How it works today:**

The resolution order in `reviewFieldState.js`:
1. If `adminOverrideActive == true` → return `adminOverrideValue`
2. Else if `aiValuePresent == true` → return `aiValue`
3. Else if `finalValuePresent == true` → return `finalValue`
4. Else → return flat column value (via `readFrom` alias chain)

**Points of failure:**

- The `finalValue` slot is the most opaque. It is unclear when `finalValue` is set vs `aiValue`. If `finalValue` contains a value but `aiValuePresent` is also true, `aiValue` wins — even if `finalValue` was set by a human actor. This precedence rule inverts what users expect.
- The `readFrom` alias chain in `dealReviewSchema.js` allows a field to have many fallback column names. A field could silently read from a legacy column that has a stale or incorrect value, making debugging extremely difficult.
- The UI does not clearly indicate which "tier" a displayed value came from. A reviewer cannot tell at a glance whether they are looking at an AI-extracted value, a human override, or a flat-column fallback.
- If a field is in `review_field_state` but the value is `null`, the system falls through to the column. If the column also has `null`, the field appears blank. But it could also appear blank because the field simply hasn't been extracted yet. These two states (not-yet-extracted vs extracted-and-null) are indistinguishable in the UI.

---

### 1.5 User Edit Storage

**How it works today:**

When a reviewer edits a field and saves:
1. `buildDealReviewPayload()` normalizes the form state
2. `PATCH /api/deals/[id]` receives the payload
3. `normalizeDealReviewPatch()` validates and sanitizes
4. For fields with `review_field_state` support: sets `adminOverrideValue`, marks `adminOverrideActive=true`
5. Logs to `review_field_events` with previous/next values and actor info
6. Increments `review_state_version`
7. For fields without `review_field_state` support: writes directly to column, no audit trail

**Points of failure:**

- The PATCH route has dual field-mapping defined locally, duplicating `_field-map.js`. These can drift. If they drift, a PATCH to a field with a new canonical name will silently fail or write to the wrong column.
- The frontend normalizes values (strips `$`, converts `15%` to `0.15`) and the backend also normalizes. If these two normalizations are not perfectly synchronized, the saved value can differ from what the user typed and from what was extracted.
- "Reset to AI" clears `adminOverrideActive` but the reset event is not stored in `review_field_events` in all code paths.
- Structured fields (e.g., `teamContacts`, `sourceRiskFactors`) are stored as JSON arrays. The event logging stores the entire before/after array — making it difficult to understand which specific item changed in a large array.

---

### 1.6 Stage Completion & Navigation

**How it works today:**

- The review page renders different content based on a `?stage=` query parameter
- Each stage is a config object describing which fields belong to it
- `saveDeal()` validates only the fields belonging to the current stage
- If required fields are missing, save is blocked with inline errors
- Navigation (sidebar clicks) appears to be gated on stage completion

**Points of failure:**

- Stage sidebar navigation logic is the most likely source of the "can't click into stages" complaint. Navigation appears to be gated, making the flow feel like a strict wizard.
- Completion state is stored nowhere persistently for individual stages. There is no `stages_completed` column. Completion is inferred at render time by checking required fields — can change unpredictably if a field is edited elsewhere.
- Stage validation is per-stage, not holistic. A reviewer could complete stages 1–3, then have stage 2's completion retroactively invalidated if a field they edited in stage 4 clears a field required by stage 2.
- There is no saved record of which stages a reviewer has visited. The system cannot distinguish "hasn't reached this stage yet" from "reached it and skipped it" from "completed it."

---

### 1.7 Re-Entry Into Existing Records

**Points of failure:**

- If a reviewer partially fills out a stage, navigates away, and returns, their in-progress (unsaved) changes are lost. No draft persistence.
- If two reviewers open the same deal simultaneously, the `review_state_version` check only fires on save — both can edit in parallel and only find out about the conflict at save time.
- The page always lands on `intake` unless the URL specifies a stage. No memory of last visited stage.
- The loading sequence has no error state for partial failures. If `review_field_state` is malformed JSONB, the page likely renders blank fields with no visible error.

---

### 1.8 Re-Extraction / Re-Upload Behavior

**Points of failure:**

- No reconciliation flow. If the reviewer has completed a full review and the GP uploads a revised PPM, the new extraction runs silently, shows a preview, but offers no comparison between "what Claude just extracted from the new doc" vs "what the reviewer previously entered."
- If some fields are empty (reviewer intentionally left them blank pending verification), the new extraction will fill them silently on confirmation — potentially with values from the wrong document version.
- No timestamp linking which PPM was used for a specific extraction. `deck_submissions` records the upload but doesn't link back to which specific `aiValue` entries came from which extraction run.
- The `aiSource` field records whether the value came from `claude-pdf`, `claude-text`, `openai`, or `grok`, but not which document or which extraction timestamp.

---

### 1.9 Caching & Stale State

1. `dealflowCache` has no TTL. A deal edited via direct API call will not invalidate the cache. Reviewer sees stale data until page reload.
2. Concurrent enrichment jobs are not coalesced. Both can write to `review_field_state` simultaneously with no lock.
3. `review_state_version` catches concurrent saves at the save boundary, but the reviewer may have been editing stale data for many minutes before discovering the conflict.
4. The component holds `form` state (reactive), `deal` state (fetched from DB), and `reviewFieldState` (derived from `deal`). These can become inconsistent if `deal` re-fetches but `form` is not reset.

---

## 2. Root Cause Analysis

### 2.1 "Values display incorrectly"

| Cause | Likelihood | Severity | How to Validate |
|-------|-----------|---------|----------------|
| UI reads from wrong tier of precedence | High | High | Add verbose logging of which tier each field was resolved from on page load |
| `readFrom` alias chain resolves to legacy column with stale value | Medium | High | For a specific broken field, trace all columns in its alias chain |
| Frontend and backend normalization diverge | High | Medium | Compare value in DB directly vs rendered value in UI |
| `finalValue` populated from old pathway, taking precedence incorrectly | Medium | Medium | Check if any `finalValuePresent=true` entries exist in production data |
| Two-write inconsistency (flat column and `review_field_state` got out of sync) | Medium | High | Query fields where column value ≠ review_field_state.aiValue and both are non-null |

**Most likely root cause:** Edge cases in the 4-tier precedence logic where `finalValue` or the flat column is read when `adminOverrideValue` was intended. The `readFrom` alias chain exacerbates this.

---

### 2.2 "User edits don't persist"

| Cause | Likelihood | Severity | How to Validate |
|-------|-----------|---------|----------------|
| Field not in `review_field_state` support list — edit writes to column but next page load re-reads `aiValue` (which wins) | High | High | For the specific failing field, check if `adminOverrideActive` is being set in DB after save |
| PATCH field mapping diverges from `_field-map.js` | Medium | High | Log exactly which DB column is being written on PATCH |
| Frontend normalization converts user value; rendered value differs from what was typed | Medium | Medium | Compare raw typed value vs value returned in PATCH response |
| `review_state_version` conflict on save — edit was rejected silently | Low | High | Check server response for 409 on save |

**Most likely root cause:** Fields lacking `review_field_state` support. These get a direct column write but the resolution logic later reads `aiValue` if it exists. The human edit is overwritten at read time even though the write succeeded.

---

### 2.3 "Can't click into stages"

| Cause | Likelihood | Severity | How to Validate |
|-------|-----------|---------|----------------|
| Sidebar navigation is conditionally disabled based on current stage completion | High | High | Inspect `DealReviewSidebar.svelte` for disabled/gated logic |
| `saveDeal()` is called before navigation and blocks on validation errors | High | Medium | Trace sidebar click → what JS runs before route change |
| Stage is gated behind a previous stage being "complete" | High | High | Check if stage link is disabled when prior stage has validation errors |

**Most likely root cause:** The sidebar treats stages as a linear wizard where later stages are disabled until earlier ones are complete. This is an intentional design that needs to change.

---

### 2.4 "Don't trust whether data shown is correct"

| Cause | Likelihood | Severity | How to Validate |
|-------|-----------|---------|----------------|
| No visual indication of which tier a value came from | Very High | High | Audit the UI — are there any provenance indicators on form fields? |
| Stale cache showing old data after another admin's edit | Medium | High | Open deal in two tabs, edit in one, observe other tab |
| Multiple extraction runs, unclear which one's values are shown | Medium | High | Run extraction twice and compare `aiUpdatedAt` timestamps |
| `review_field_state` JSONB partially populated | High | Medium | Count fields with vs without entries in review_field_state per deal |

**Most likely root cause:** Absence of provenance indicators in the UI. The data model supports provenance tracking but this information is not visibly surfaced.

---

### 2.5 "Re-upload silently destroying prior work"

| Cause | Likelihood | Severity | How to Validate |
|-------|-----------|---------|----------------|
| `deal-confirm-enrichment` fills blank fields even if those blanks were intentional | High | High | Intentionally clear a field, re-extract, confirm — does the blank stay blank? |
| No reconciliation UI — reviewer doesn't realize new extraction differs from their manual work | Very High | High | Confirmed architectural gap |

**Most likely root cause:** Confirmed architectural gap. The "only fill empty fields" rule is correct but insufficient.

---

## 3. Recommended System Architecture

### 3.1 Source-of-Truth Model

**Recommended hierarchy (most to least authoritative):**

1. **Human override** (`adminOverrideValue` + `adminOverrideActive=true`) — wins unless explicitly reset
2. **AI-extracted value** (`aiValue` + `aiValuePresent=true`) — authoritative for fields the reviewer hasn't touched
3. ~~**Confirmed final value** (`finalValue`)~~ — **eliminate this tier** (see below)
4. **Flat column** — legacy read-only fallback during migration period

**The `finalValue` problem:** The current `finalValue` slot is ambiguous — unclear who sets it, when, and by what mechanism. In the current precedence it only wins if there is no AI extraction, making it a de facto legacy fallback, not a "final" value. Recommendation: eliminate `finalValue`. Migrate existing data to either `aiValue` (if from extraction) or `adminOverrideValue` (if set by human).

---

### 3.2 Data Model Philosophy

**Five strict layers:**

| Layer | What It Contains | Who Writes It | Who Reads It |
|-------|-----------------|--------------|-------------|
| **Source documents** | Raw PDFs in Supabase Storage | Uploaders | Extraction pipeline |
| **Extracted values** | `aiValue` per field, tagged with `aiSource`, `aiUpdatedAt`, `extractionRunId` | Extraction pipeline only | Reviewer UI (read-only tier) |
| **Human overrides** | `adminOverrideValue` per field, tagged with actor and timestamp | Reviewers only | Reviewer UI (highest priority) |
| **Resolved display value** | Computed on read — override if active, else aiValue, else flat column | Not stored — always computed | UI display, publish pipeline |
| **Audit trail** | `review_field_events` — every change, immutable | System (on every write) | Admin audit, debugging, reconciliation |

**The missing layer: extraction runs**

Add an `extraction_runs` table:

```
extraction_runs
  id: uuid
  deal_id: uuid
  triggered_by: text (upload | manual | system)
  document_ref: uuid (→ deck_submissions.id)
  started_at: timestamptz
  completed_at: timestamptz
  status: enum(running | complete | failed | partial)
  fields_extracted: jsonb (map of fieldKey → extracted value)
  extraction_source: text (claude-pdf | claude-text | openai | grok)
```

This enables: provenance (which run produced which `aiValue`), reconciliation (diff between current state and new extraction), resumability, and history.

---

### 3.3 Navigation Model

**Recommended behavior:** All stages are always navigable after source documents have been uploaded. Completion indicators exist but are advisory only. Navigation is never blocked by stage completion.

**Conceptual model:** Review dashboard with sections, not a wizard. Like a document with chapters — you can jump to any chapter at any time.

**Completion indicators:**
- ✓ Complete (all required fields filled + citations present)
- ⚠ Partial (some fields filled, some missing)
- ○ Not started (no fields in this stage have been touched)

These are informational. They do not disable navigation.

---

### 3.4 Re-Entry Model

When a reviewer returns to an existing deal:

1. Load full deal state including all `review_field_state` entries and `review_field_evidence`
2. Resolve display values for each field using precedence logic
3. Compute stage completion status for sidebar display
4. **Restore last visited stage** — store in localStorage per deal
5. **Show "last updated" banner** if the deal was modified since the reviewer last loaded it
6. Consider auto-saving drafts in localStorage (30-minute TTL) with restore prompt on re-entry

---

### 3.5 Re-Upload / Re-Extraction Model

**Recommended model: Extraction Run + Reconciliation Flow**

**Phase 1: Silent extraction** — Run pipeline against new document, store results in `extraction_runs`, do NOT touch `review_field_state`. Mark run as `status: 'pending_reconciliation'`.

**Phase 2: Surface the reconciliation task** — Show notification: "New document extracted — X fields differ from current values."

**Phase 3: Reconciliation view** — Field-by-field comparison:

| Field | Current Value | Source | Extracted Value | Source | Action |
|-------|-------------|--------|----------------|--------|--------|
| Investment Minimum | $50,000 | Human edit | $25,000 | New PPM | [Keep current] [Use extracted] [Edit manually] |
| Target IRR | 10-12% | AI (v1) | 10-12% | New PPM | [No change — same] |

**When should re-extraction be automatic vs manual?**

| Scenario | Behavior |
|---------|---------|
| First upload, no review data | Automatic extraction + confirm flow |
| Re-upload, partial review | Automatic extraction, manual reconciliation |
| Re-upload, completed review | Automatic extraction, manual reconciliation, prominent notification |
| Manual "re-extract" trigger | Automatic extraction, reconciliation shown immediately |

**Overwrite prevention rules:**
- Any field with `adminOverrideActive=true` is never touched by any extraction
- Any field with confirmed `aiValue` from prior run must go through reconciliation
- Completely empty fields can be auto-populated without reconciliation

---

### 3.6 Stage Design Philosophy

**Recommended model:** Section-based review dashboard with advisory completion.

Reviewers typically skim all stages first, fill in what they know, then iterate. A linear wizard is optimized for sequential data entry, not document review. The correct mental model is a document with chapters.

- All stages accessible after document upload
- Stage labels show completion status, never gate access
- Each stage is a focused review area with inline evidence/citation support
- Summary stage is a publish-readiness checklist only — not a second set of edit forms
- Stages can be "flagged for follow-up" if intentionally incomplete

---

## 4. UX and Product Recommendations

### 4.1 Reviewer goals per stage

| Stage | Reviewer's goal |
|-------|----------------|
| **Intake** | Confirm the right documents have been uploaded and extraction ran |
| **SEC** | Verify the legal identity of the issuer against EDGAR |
| **Classification** | Set asset class, strategy, and structure so it routes to the right investors |
| **Static Terms** | Get investment minimum, hold period, and return targets right |
| **Fees** | Capture the full fee load, which requires careful parsing |
| **Historical Performance** | Enter return history, often requiring table parsing from PDFs |
| **Portfolio Snapshot** | Capture current fund metrics (AUM, loan count, leverage) |
| **Sponsor Trust** | Evaluate operator background, track record |
| **Team** | Capture key personnel |
| **Risks** | Curate the risk factor list |
| **Summary** | Final check before publishing to investors |

### 4.2 Where current UX creates friction

1. **No provenance indicators** — reviewers can't see whether a value is AI-extracted or manually set
2. **Stage gating** — forced through intake before accessing later stages
3. **No auto-save or draft persistence** — partial work lost on navigation
4. **Extraction confirmation is all-or-nothing** — can't selectively confirm some fields
5. **No "flag as pending" option** — required fields block save even when value is legitimately unknown
6. **Evidence/citation UI is unclear** — not obvious which fields require citations or whether they're present
7. **Summary stage relationship to source stages is ambiguous** — unclear if editing in summary updates source stage

### 4.3 Provenance indicators

Every editable field should show:
- AI extracted (source: Claude/OpenAI) + "view source snippet" option
- Human override (actor name + timestamp)
- Empty — not yet extracted or entered

Small icon + tooltip. Not verbose. But must exist.

### 4.4 Summary stage role

The summary stage should be a publish-readiness dashboard:
- Show all required-for-publish fields with current resolved values
- Flag missing values with inline "fix" links navigating to the relevant stage
- Show field-level confidence (AI with evidence vs human-set vs empty)
- "Publish" button disabled until all required fields are filled
- Read-only — no edit forms in summary, only links back to editable stages

---

## 5. QA and Testing Strategy

### 5.1 Manual QA Scenarios

**Set A: First-time flow**
- A1: Upload PPM to new deal → extraction runs → preview → confirm → verify all extracted fields appear correctly in each stage
- A2: Upload deck (not PPM) → verify different extraction behavior
- A3: Upload file too large for base64 → verify direct-upload path works
- A4: Upload malformed PDF → verify graceful error handling
- A5: Auth edge case — GP not in authorized_emails → verify clear error message

**Set B: Returning reviewer**
- B1: Complete 3 stages, navigate away, return → verify values persist and stage indicators are correct
- B2: Two admins open same deal simultaneously, both edit same field, one saves first → verify second admin sees conflict notification
- B3: Open deal, leave open 30 minutes, save → verify `review_state_version` conflict handled gracefully
- B4: Open deal, edit field without saving, navigate to different stage → verify clear behavior

**Set C: Upload then edit**
- C1: Extract a field, confirm → manually override → verify human override persists and wins
- C2: Extract a field, confirm → reset to AI → verify AI value restored
- C3: Clear a field that has an AI value → save → verify field stays blank (not re-filled from AI on next read)

**Set D: Upload then re-upload**
- D1: Complete full review → upload revised PPM → verify reconciliation flow appears, not silent overwrite
- D2: Complete full review → upload same PDF again → verify no duplicate enrichment or overwrite
- D3: Partial review with some empty fields → upload revised PPM → verify empty fields can be auto-populated, filled fields go to reconciliation
- D4: Full review with all human overrides → upload new PPM → verify no human override is touched

**Set E: Navigation**
- E1: After source document upload, click directly to stage 7 → verify it is accessible
- E2: Start at summary stage with no other stages complete → verify it is accessible
- E3: Navigate forward/backward through all stages → verify form state is not lost
- E4: Edit a field in stage 4, navigate to stage 2 without saving, return to stage 4 → verify edit behavior is clear

**Set F: Edge cases**
- F1: Deal with no PPM (only a deck) → verify extraction handles missing PPM gracefully
- F2: Deal with PPM that has no text layer (scanned image PDF) → verify fallback or clear error
- F3: Extraction returns a value not in canonical enum list → verify handled gracefully, not silently dropped
- F4: Extraction runs, SEC lookup times out → verify partial success is surfaced
- F5: Field has value in both flat column and `review_field_state` → verify correct tier wins

**Set G: Publish**
- G1: Attempt publish with missing required fields → verify all missing fields listed with stage links
- G2: Attempt publish with fields present but no citations → verify evidence requirement surfaced
- G3: Complete all required fields → publish → verify deal appears correctly in investor-facing view

---

### 5.2 Automated Test Strategy

**Unit tests (fast, isolated) — must-have:**
- `resolveFinalReviewFieldValue()` — test all 4 resolution tiers, edge cases with null vs absent
- `buildDealReviewPayload()` — test normalization for every field type (%, $, numeric, enum)
- `normalizeDealReviewPatch()` — test same normalization on server side, verify parity with frontend
- Stage completion computation — given a deal state, verify correct completion for each stage
- Enum alias resolution — test all known aliases map to canonical values

**Integration tests (real API, real database) — must-have:**
- PATCH `/api/deals/[id]` with admin override → verify DB has `adminOverrideActive=true`
- PATCH with `review_state_version` conflict → verify 409 response and no DB mutation
- `deal-confirm-enrichment` → verify empty fields filled, non-empty fields not touched
- `deal-confirm-enrichment` with intentionally cleared field → verify blank stays blank
- Two concurrent PATCHes → verify exactly one wins, other gets 409
- Extraction run → re-extraction → verify previous `aiValue` not silently overwritten without reconciliation

**End-to-end tests (Playwright) — must-have:**
- Full first-time upload → extraction → review → publish flow
- Stage navigation after source document upload — all stages accessible
- Human override persists after page reload
- Conflict notification appears when second admin saves after first admin
- Reconciliation flow appears after re-upload

**Regression tests (run on every PR) — non-negotiable:**
- `review_state_version` conflict detection
- Admin override precedence (human override beats AI value)
- Source-required field citation validation blocks publish
- `investment_minimum` never overwritten by SEC data

**Smoke tests (run on every deploy):**
- `/api/deals/[id]` GET returns correct shape
- `/api/deals/[id]` PATCH accepts and persists a field change
- `/api/deal-cleanup` initiates without 500 error
- Deal review page loads without console errors for a known deal

---

### 5.3 Audit Instrumentation Recommendations

**Events to log (PostHog + server-side):**

| Event | Properties |
|-------|-----------|
| `extraction_started` | dealId, triggeredBy, documentRef |
| `extraction_completed` | dealId, fieldsExtracted (count), source, duration |
| `extraction_failed` | dealId, failureReason, stage, partialFields |
| `extraction_confirmed` | dealId, fieldsFilled (count), fieldsSkipped |
| `field_override` | dealId, fieldKey, previousValue (tier + value), actorEmail |
| `field_reset_to_ai` | dealId, fieldKey, actorEmail |
| `reconciliation_opened` | dealId, conflictingFields (count) |
| `reconciliation_resolved` | dealId, keptCurrent, usedExtracted, editedManually |
| `stage_navigation` | dealId, fromStage, toStage, navigationBlocked (bool) |
| `stage_save_attempted` | dealId, stage, success, validationErrors |
| `deal_published` | dealId, publishedBy, missingFieldsOverridden (count) |
| `review_state_version_conflict` | dealId, localVersion, serverVersion, actorEmail |
| `source_document_uploaded` | dealId, docType, fileSize, uploadedBy |

**Sentry error tracking:**
- Any 5xx from `/api/deals`, `/api/deal-enrich`, `/api/deal-cleanup`, `/api/deck-upload`
- JSONB parse failures on `review_field_state` or `review_field_evidence`
- `review_state_version` conflicts (warning, not error)
- Extraction timeouts or partial failures

**Database-level monitoring:**
- Deals where `review_field_state` has entries for fewer than 50% of expected fields
- Deals where flat column value differs from `review_field_state.aiValue`
- Deals with `adminOverrideActive=true` on more than 80% of fields
- Failed `review_field_events` inserts

---

## 6. Implementation Planning Document

### 6.1 Prioritized Workstreams

| # | Workstream | Description |
|---|-----------|-------------|
| 1 | Schema & data model | Eliminate `finalValue`, add `extraction_runs`, link `aiValue` to run, migrate non-supported fields |
| 2 | Field mapping consolidation | Single canonical field map shared by API and frontend; eliminate duplicate FIELD_MAP in PATCH route |
| 3 | Navigation unlocking | Remove stage gates in sidebar; advisory completion indicators only |
| 4 | Extraction cascade resilience | Partial success handling; run tracking; deduplication; request coalescing |
| 5 | Provenance UI | Per-field provenance indicator (AI / human / empty) + "view source snippet" |
| 6 | Reconciliation flow | Extraction run diff UI; reviewer choice per field; overwrite prevention |
| 7 | Auto-save / draft persistence | localStorage draft with TTL; restore prompt on re-entry |
| 8 | Summary stage rebuild | Publish-readiness dashboard; read-only; links to editable stages |
| 9 | Test infrastructure | Unit tests for normalization/resolution; integration tests for PATCH; Playwright E2E |
| 10 | Observability | PostHog events + Sentry coverage for full extraction and edit lifecycle |

---

### 6.2 Recommended Sequencing

**Phase 0: Understanding (no code changes)**
- Read all flagged files in detail (especially `DealReviewSidebar.svelte`, PATCH route, `_enrichment.js`)
- Reproduce each reported bug in development
- Confirm root cause theories

**Phase 1: Stabilize (low-risk, high-value)**
- Workstream 9 first — test infrastructure is the safety net for all other changes
- Workstream 2 — field mapping consolidation (no behavior change)
- Workstream 3 — navigation unlocking (most visible user pain, isolated change)

**Phase 2: Data model correctness**
- Workstream 1 — schema stabilization (requires careful migration)
- Workstream 4 — extraction resilience (no behavior regression)

**Phase 3: Trust and provenance**
- Workstream 5 — provenance UI (depends on clean data model from Phase 2)
- Workstream 7 — auto-save (isolated, can run in parallel)

**Phase 4: Advanced flows**
- Workstream 6 — reconciliation (complex, depends on Phase 2)
- Workstream 8 — summary rebuild (depends on clean data model)

**Phase 5: Observability**
- Workstream 10 — most useful after Phase 2

---

### 6.3 Risk Analysis Per Workstream

**Workstream 1 (Schema)**
- Risk: Migrating `finalValue` data incorrectly — values could be misclassified
- Regression: Any field currently resolved via `finalValue` will display differently
- Dependency: Must happen before Workstream 5
- Rollback: Retain `finalValue` column but stop writing it; migration is additive
- Validate: Run full manual QA scenario set E against production-copy data

**Workstream 3 (Navigation)**
- Risk: Open navigation exposes incomplete data in later stages prematurely
- Regression: Reviewers who relied on wizard structure for guidance may be confused
- Dependency: None — isolated frontend change
- Rollback: Revert sidebar component
- Validate: QA scenario E1–E4 + confirm completion indicators still render

**Workstream 4 (Extraction resilience)**
- Risk: Partial success logic is complex — risk of false "success" with fewer fields than expected
- Regression: Change in extraction semantics could affect confirm-enrichment behavior
- Rollback: Feature flag the new cascade; keep old cascade as fallback

**Workstream 6 (Reconciliation)**
- Risk: Most complex feature. Poor reconciliation UX could make re-upload worse
- Regression: "Only fill empty fields" rule is safe; new rule introduces more decision points
- Dependency: Requires Workstreams 1, 5
- Rollback: Keep "only fill empty fields" behavior; defer reconciliation
- Validate: Full QA scenario set D; user testing with a real reviewer before broad deploy

---

### 6.4 Definition of Done

The rebuilt Deal Review system is done when:

1. **Every field shows its provenance** (AI-extracted, human-set, or empty) without the reviewer having to guess.

2. **All stages are navigable** after source documents are uploaded. No stage gates. Completion indicators are accurate but never block navigation.

3. **Human overrides are permanent** until explicitly reset. No extraction, re-upload, or background job can overwrite a field with `adminOverrideActive=true`.

4. **Re-upload triggers a reconciliation flow**, not a silent overwrite. The reviewer sees exactly which fields have changed and makes an explicit choice for each.

5. **Extraction is resumable.** A partial failure does not discard successfully extracted fields. The reviewer sees what was found.

6. **Field mapping is defined in exactly one place**, shared by both frontend and backend. Normalization is tested for parity.

7. **The summary stage is a publish-readiness dashboard.** It shows every required-for-publish field with current value, provenance, and a fix link. No edit forms in summary.

8. **Auto-save exists.** A reviewer who navigates away without saving does not lose work silently.

9. **Smoke tests pass on every deploy.** Core PATCH/GET behaviors, extraction trigger, and page load are always tested before traffic.

10. **The audit trail is complete.** Every field change — AI extraction, human edit, or reset-to-AI — produces a `review_field_events` row with full actor and timestamp.

---

## 7. Key Decisions Required Before Implementation

| # | Decision | Options | Recommendation |
|---|---------|---------|----------------|
| 1 | What does "stage completion" mean? | (a) All required fields + citations; (b) Reviewer marks complete; (c) Advisory only | (c) Advisory only for navigation; (a) for publish readiness |
| 2 | Should navigation ever be gated? | (a) Never after documents uploaded; (b) Gate publish but not others; (c) Current wizard | (a) — freedom after upload, gate only at publish |
| 3 | What happens to `finalValue`? | (a) Eliminate, migrate data; (b) Keep but document clearly | (a) Eliminate |
| 4 | How does reconciliation handle arrays (teamContacts, etc.)? | (a) Show full array diff; (b) Top-level fields only; (c) Punt to Phase 2 | (c) |
| 5 | Should "reset to AI" be available after reconciliation? | (a) Always; (b) Only if AI had a value; (c) No reset after reconciliation | (b) |
| 6 | Can reviewer "flag a field as pending"? | (a) Yes, explicit flag; (b) Empty is empty; (c) Free-text notes | (a) |
| 7 | Should extraction run automatically on first upload? | (a) Always automatic; (b) Automatic with opt-out; (c) Manual only | (a) |
| 8 | Who can trigger manual re-extraction? | (a) Any reviewer; (b) Admins only; (c) Assigned reviewer only | (b) |
| 9 | Single source of field definitions? | Must be one file shared by frontend and API | `_field-map.js` extended with review metadata |
| 10 | How should SEC fields interact with extraction model? | (a) Separate system; (b) SEC writes to `aiValue` with `aiSource: 'sec'`; (c) Own columns | (b) |

---

## 8. Open Questions / Unknowns

1. **Sidebar gating logic**: Exact code in `DealReviewSidebar.svelte` controlling stage accessibility. Must be confirmed before implementing navigation unlock.
2. **`finalValue` population**: Every code path writing `finalValue` must be identified before eliminating this tier.
3. **Volume of fields without `review_field_state` support**: Exact count unknown. Affects scope of Workstream 1.
4. **Concurrent extraction in production**: Whether extraction races have caused visible data corruption. Worth querying `review_field_events` for anomalies.
5. **Summary stage edit behavior**: Whether summary has its own edit forms or is read-only — affects rebuild scope.
6. **Draft persistence current state**: Whether any auto-save exists today must be verified before building it.
7. **Multi-reviewer frequency**: How often multiple admins work on the same deal simultaneously — affects priority of conflict handling.
8. **GP edit permissions**: Whether GPs can edit review fields after upload. Authorization model needs explicit documentation.
9. **Publication target**: What happens when a deal is "published" — what checks run, what state changes, what becomes visible to investors.
10. **Historical data integrity**: Deals reviewed before migration 063 (before `review_field_state` columns) only have flat column values. How should they be treated in the new system?

---

## 9. Top Recommendations in Priority Order

1. **Unlock stage navigation** — Most visible user-facing friction. Remove navigation gates. All stages accessible after source document upload. Contained change to `DealReviewSidebar.svelte`.

2. **Build test infrastructure first** — Add unit tests for `resolveFinalReviewFieldValue()`, `buildDealReviewPayload()`, and `normalizeDealReviewPatch()`. These are the functions most likely to regress. Tests are the safety net for every other change.

3. **Add per-field provenance indicators** — Reviewers need to see whether a value is AI-extracted or human-set. UI-only change that directly addresses the trust problem.

4. **Consolidate field mapping to one canonical file** — Eliminate duplicate FIELD_MAP in PATCH route. No behavior change, eliminates a whole class of future bugs.

5. **Fix `finalValue` ambiguity** — Audit every write path to `finalValue`. Migrate into `adminOverrideValue` or `aiValue`. Leaving it ambiguous corrupts the precedence logic.

6. **Add extraction run tracking** — Add `extraction_runs` table and link `aiValue` entries to their source run. Prerequisite for reconciliation, provenance display, and extraction history.

7. **Build reconciliation flow** — Closes the most dangerous data integrity gap: re-uploads silently diverging from prior reviewer work.

8. **Rebuild summary as publish-readiness dashboard** — Summary should be a holistic view with fix links, not a second set of forms.

9. **Add auto-save** — Partial work lost on navigation is a common frustration. Auto-save to localStorage with restore prompt is straightforward and high-value.

10. **Instrument extraction and edit lifecycle events** — Full PostHog + Sentry coverage will make future regressions diagnosable in minutes rather than hours.

---

*This document is an audit and planning output only. No code changes have been made. Every recommendation should be validated against the actual current state of the relevant source files before any implementation begins.*
