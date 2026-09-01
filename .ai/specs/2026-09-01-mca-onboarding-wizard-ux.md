# MCA Onboarding Wizard UX

## TLDR
**Key Points:**
- Shop-setup wizard copy and list-field input were confusing brokers (license UUID, intake vs documents, People jargon, industries that drop spaces/commas, unexplained AMR/TIB/NSF/ADB/SIC).
- This change is wizard UX only: no schema drops, no intake API changes, no logo upload, no user invite, no shared tags primitive.

**Scope:**
- Shop: hide broker-logo UUID in the wizard; license-not-required copy; watermark-without-logo stays the existing skip path.
- Intake: retitle to “How do new applications arrive?” with three choices (form / spreadsheet / skip). Webhook URL, secret, sample JSON, and test intake stay behind “Connect a form.”
- People: shop-floor language; hide default originator; From: email only for Rep seats; existing `/api/auth/users` only.
- Funders: wizard-local chip input with a draft string so `"Auto repair, restaurants"` keeps the space; optional Appetite collapse; glossary labels/tooltips.
- First-deal help and match chips use the same expanded acronym copy via i18n.

**Concerns:**
- Do not complete onboarding on the shared Railway demo tenant.
- Calendar, Documents, Extras, and First-deal flows are out of scope except acronym copy on first-deal help / match chips.
- Humans still pick funders; nothing auto-submits.

## Overview
The MCA shop-setup wizard at `/backend/merchant_advances/onboarding` is the first surface brokers see. Client review notes showed the wizard still read like an engineering form: a UUID for a broker logo, an Intake step that looked like merchant document upload, a People step that said “Invite” and `reports.view`, and funder industry fields that trimmed on every keystroke.

This spec records the default UX plan already decided with the client. Implementation stays inside `merchant_advances`.

> **Market Reference:** Common ISO onboarding (form vs spreadsheet vs skip; appetite as optional chips) rather than a generic SaaS “invite team + upload logo” wizard. Rejected a shared DS tags primitive and file-upload for logos because both are out of scope for this pass.

## Problem Statement
1. Brokers do not need a license or logo UUID to start brokering MCA. The Shop step asked for `brokerLogoAttachmentId`.
2. Intake looked like merchant document submission. Webhook URL, secret, sample JSON, and “Send Sunset Diner test intake” were all first-class.
3. People asked whether “default originator for imports” was where merchant documents go, and used Invite / `reports.view` language. The originator control is a no-op on imports.
4. `CRITERIA_LIST` fields parsed and trimmed on every keystroke, so spaces and commas could not be typed (`OnboardingWizard.tsx`).
5. Appetite labels used unexplained acronyms (AMR, TIB, NSF, ADB, SIC).

## Proposed Solution
Keep save payloads, `FunderCriteria`, `broker_logo_attachment_id`, and intake webhook/secret/test-intake APIs unchanged. Change wizard presentation:

| Area | Default approach |
|------|------------------|
| Shop logo | Remove the UUID field from the wizard only. Copy: no license required; optional logo later; watermark-without-logo already skips. |
| Intake | Three radios: form (JotForm/GHL/Zoho), spreadsheet of leads, skip. Hide connection details behind “Connect a form.” Point document upload at Documents. |
| People | Floor / profit-report / optional From: email language. Hide default originator. Show From: only when the seat is Rep. Do not create users. |
| List fields | Draft string per list key; parse on blur / Enter / comma-complete. Wizard-local chip helper. |
| Acronyms | Full labels plus SimpleTooltip / ContextHelp glossary. Same keys on first-deal help and match chips. |
| Appetite | Collapse 20+ criteria behind “Appetite (optional)” so Add funder is name + email + route first. Starter Harbor/Northstar panel stays. |

### Design Decisions
| Decision | Rationale |
|----------|-----------|
| Wizard-local chips, not a DS primitive | Bug is local to this form; no new npm dep or DS surface. |
| Keep `MCA_ONBOARDING_INTAKE_SOURCES` | Form choice maps to jotform/ghl/zoho/custom; APIs stay stable. |
| Hide originator instead of deleting the field | JSON/state still round-trips `defaultOriginatorUserId`. |
| i18n-only acronym expansion on match chips | Scoring still emits `code` + English `label`; UI prefers `match.reasons.<code>`. |

### Alternatives Considered
| Alternative | Why Rejected |
|-------------|--------------|
| Logo file upload in Shop | Client: optional later; no upload work in this pass. |
| Merge Intake with Documents | Different jobs (how apps arrive vs how files are stamped). |
| Create users from People | UI only lists existing `/api/auth/users`. |
| Shared tags primitive | Out of scope; wizard-local helper is enough. |

## User Stories / Use Cases
- **Broker** wants to **type `Auto repair, restaurants` in Industries** so that **multi-word industries save as two tokens**.
- **Broker** wants to **set up the shop without a license UUID** so that **they can start brokering MCA immediately**.
- **Broker** wants to **see three intake choices** so that **they are not asked to wire a webhook before they are ready**.
- **Admin** wants to **assign floor seats in shop language** so that **they know who sees profit reports and which rep sends as From:**.

## Architecture
Wizard-only presentation on top of existing `PUT /api/merchant_advances/onboarding` and funder CRUD.

```
Shop / Intake / People / Funders (UI)
        │
        ▼
existing onboarding state JSON + funder criteria JSON
        │
        ▼
unchanged commands, webhook, secret, test-intake, watermark skip
```

`parseCriteriaListTokens` / `splitCriteriaListCommaDraft` live under `lib/onboarding/parseListField.ts`. `CriteriaListInput` owns the draft string and commits tokens into `FunderCriteria` list keys.

### Commands & Events
Unchanged. Optimistic lock on onboarding save stays.

## Data Models
No entity or column changes. `mca_workspace_settings.broker_logo_attachment_id` remains. `FunderCriteria` list keys remain `string[]`.

## API Contracts
Unchanged:
- `GET`/`PUT /api/merchant_advances/onboarding`
- `POST /api/merchant_advances/onboarding/rotate-secret`
- `POST /api/merchant_advances/onboarding/test-intake`
- `POST /api/merchant_advances/intake/form`
- Funder create criteria shape

## Internationalization (i18n)
New/updated keys under `merchant_advances.onboarding.*`, `merchant_advances.glossary.*`, and `merchant_advances.match.reasons.*`. No hardcoded user-facing strings.

## UI/UX
- Shop: license alert + later-logo copy; no UUID input.
- Intake: title “How do new applications arrive?”; three radios; “Connect a form” disclosure.
- People: existing-user checkboxes; Admin/Rep descriptions; From: email only for Rep.
- Funders: name, contact email, route first; Appetite disclosure with chip inputs and glossary.
- Match chips: expanded AMR/TIB/NSF/ADB/SIC labels when `reason.code` maps.

## Migration & Compatibility
No migration. Backward compatible: existing onboarding JSON and intake sources still parse. Wizard no longer writes a logo UUID from this step (column can still be set from Settings later). Follows `BACKWARD_COMPATIBILITY.md`: do not drop `broker_logo_attachment_id` or intake APIs.

## Implementation Plan

### Phase 1: List parse helper
1. Add `parseListField.ts` + unit tests including `"Auto repair, restaurants"`.
2. Add wizard-local `CriteriaListInput`.

### Phase 2: Wizard copy and layout
1. Shop / Intake / People / Funders / glossary i18n.
2. Hide logo UUID and default originator.
3. Collapse appetite; keep starter panel.

### Phase 3: Acronym surfaces
1. Criteria labels + SimpleTooltip/ContextHelp.
2. First-deal help + match chip i18n.

## File Manifest
| File | Action | Purpose |
|------|--------|---------|
| `packages/core/src/modules/merchant_advances/lib/onboarding/parseListField.ts` | Create | List token parse/commit |
| `packages/core/src/modules/merchant_advances/lib/onboarding/__tests__/parseListField.test.ts` | Create | Unit tests |
| `packages/core/src/modules/merchant_advances/backend/components/onboarding/CriteriaListInput.tsx` | Create | Draft + chips |
| `packages/core/src/modules/merchant_advances/backend/components/onboarding/CriteriaFieldLabel.tsx` | Create | Label + glossary hint |
| `packages/core/src/modules/merchant_advances/backend/components/OnboardingWizard.tsx` | Modify | Shop/Intake/People/Funders UX |
| `packages/core/src/modules/merchant_advances/backend/components/FunderMatchList.tsx` | Modify | Acronym match chips |
| `packages/core/src/modules/merchant_advances/i18n/en.json` | Modify | Copy + glossary |

## Testing Strategy
- Unit: `"Auto repair, restaurants"` → two tokens; comma-complete keeps in-progress spaces.
- Existing onboarding state/gate tests must still pass.
- Playwright only if it can run without completing the shared tenant’s onboarding.

## Risks & Impact Review

### Data Integrity Failures
Onboarding save is unchanged (same PUT + optimistic lock). Chip commit writes the same `string[]` criteria shape. Interrupted typing only loses uncommitted draft, which is expected for an unsaved form field.

### Cascading Failures & Side Effects
No new events. Intake webhook/secret/test-intake still called only from “Connect a form.” Matching still never auto-submits.

### Tenant & Data Isolation Risks
No query or tenant-scope changes. Users still load from `/api/auth/users` in the current org.

### Migration & Deployment Risks
UI-only. Rolling back the wizard restores the UUID field and eager list parse; stored data remains valid.

### Operational Risks
Blast radius is the wizard and match-chip labels. No new storage.

### Risk Register

#### Brokers skip form connection and never issue a secret
- **Scenario**: User picks “A form” but never opens “Connect a form,” so intake stays incomplete until first deal or skip rules.
- **Severity**: Low
- **Affected area**: Intake step completion (`intakePathComplete`)
- **Mitigation**: Existing completion rules still require secret/test or skip/spreadsheet/first deal. Copy tells them Connect a form is optional now.
- **Residual risk**: Some shops postpone webhook setup — acceptable; “Not sure yet” is first-class.

#### Hidden originator leaves stale JSON
- **Scenario**: An existing workspace has `defaultOriginatorUserId` set; the wizard no longer shows the control.
- **Severity**: Low
- **Affected area**: Onboarding JSON
- **Mitigation**: Field still saved if present; it was already a no-op on imports.
- **Residual risk**: Stale value remains until Settings/import work uses it — acceptable.

#### List draft not committed before add-funder click
- **Scenario**: User types `Auto repair` without blur/Enter/comma and clicks Add funder.
- **Severity**: Low
- **Affected area**: New funder criteria
- **Mitigation**: Blur on the input commits; chips show committed tokens. Add funder is a separate button, so users typically blur first.
- **Residual risk**: An in-progress token can be dropped if they click Add without leaving the field — acceptable vs the previous “cannot type spaces” bug.

## Final Compliance Report — 2026-09-01

### AGENTS.md Files Reviewed
- `AGENTS.md` (root)
- `packages/core/AGENTS.md`
- `packages/core/src/modules/merchant_advances/AGENTS.md`
- `packages/ui/AGENTS.md`
- `.ai/specs/AGENTS.md`
- `BACKWARD_COMPATIBILITY.md`

### Compliance Matrix

| Rule Source | Rule | Status | Notes |
|-------------|------|--------|-------|
| root AGENTS.md | No hardcoded user-facing strings | Compliant | `useT` + `en.json` |
| root AGENTS.md | No DS status colors / arbitrary px | Compliant | Existing tokens; `size-4` icon |
| root AGENTS.md | No cross-module ORM | Compliant | merchant_advances only |
| merchant_advances AGENTS.md | Never auto-submit funders | Compliant | Unchanged |
| BACKWARD_COMPATIBILITY.md | Do not drop logo column or intake APIs | Compliant | Hidden in wizard only |
| root AGENTS.md | Optimistic lock on onboarding save | Compliant | Unchanged PUT path |
| ui AGENTS.md | No new primitive when local helper fits | Compliant | Wizard-local chips |

### Internal Consistency Check

| Check | Status | Notes |
|-------|--------|-------|
| Data models match API contracts | Pass | No model change |
| API contracts match UI/UX section | Pass | APIs unchanged; UI hides some fields |
| Risks cover all write operations | Pass | Same onboarding/funder writes |
| Commands defined for all mutations | Pass | Existing commands |
| Cache strategy covers all read APIs | Pass | No new reads that need cache |

### Non-Compliant Items
None.

### Verdict
- **Fully compliant**: Approved — implementation matches the decided UX plan.

## Changelog
### [2026-09-01]
- Initial specification and implementation of wizard copy, intake grouping, hidden logo UUID / default originator, list-field draft chips, and acronym glossary.
