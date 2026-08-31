# MCA CRM Platform (MCA Pilot parity)

## TLDR
**Key Points:**
- Turn this Open Mercato CRM into an MCA broker/ISO CRM that covers intake → underwriting → funder match → multi-funder submit → reply parsing → offers → funded → renewals → commissions.
- Reuse `customers` (merchant = company, owner = person, generic deal/pipeline/kanban) and add a first-class `merchant_advances` module for MCA objects. Do not fork Noloco and do not cram funding economics into `customer_deals.value_amount`.

**Scope:**
- New core module `merchant_advances` with the full MCA object graph, ACL, events, encryption, and MCA pipeline UI.
- Feature worktrees implement intake, bulk import, AI underwriting, funder matching, submissions, document stamps, reply parsing, offers, renewals, commissions, duplicates, reporting, team/PWA, and optional add-ons.

**Concerns:**
- Twenty live funder APIs are a multi-provider program, not a single PR. This spec ships the adapter contract plus email/portal/webhook routes first; each funder API is a later provider package.
- Bank-statement AI and inbox parsing depend on attachments OCR + `ai_assistant` + connected mail. They must never auto-submit or replace a human underwriter.

## Overview
MCA Pilot is a web CRM + deal-automation platform for merchant cash advance broker shops and ISOs (not a consumer mobile app). Public marketing lists one full-featured plan. This specification clones that product on Open Mercato: tenant-scoped workspaces, feature-based roles (Super Admin / Admin, Manager, Rep), and MCA vocabulary.

> **Market Reference**: MCA Pilot (mcapilot.com). Adopted: end-to-end MCA lifecycle, ranked funder match without auto-submit, independent per-funder submissions, AI reply parsing into structured offers, paid-in renewal surfacing, admin-only reports. Rejected: hosting on Noloco, per-deal fees, role-name guards, stuffing MCA fields into generic CRM custom fields as the long-term model.

This is an independently deployable platform capability split into feature specs/plans under `.ai/specs/mca/plans/`. The foundation (this spec + Phase 0 code) is the shared contract those worktrees implement against.

## Problem Statement
The current app is a capable generic CRM (`customers` people/companies/deals, attachments, webhooks, AI, dashboards). It cannot run an MCA shop:

- No merchant-application fields (requested amount, average monthly revenue, time in business, position, EIN).
- No funder catalog, appetite scoring, or multi-funder submission records.
- No offer/factor/term/payment/commission math, paid-in %, or renewal queue.
- No lead-package import, form intake, statement underwriting, or funder-reply parsing.
- Reports are generic pipeline KPIs; Managers/Reps cannot be hidden from them via MCA roles.
- There is no built-in `manager` role; authorization must stay feature-based.

## Proposed Solution
Add `packages/core/src/modules/merchant_advances/` as an isomorphic core module.

- **Merchant** = `customers` company (`customer_entity` kind `company`) referenced by UUID + snapshot (`merchantName`, `merchantState`).
- **Owner/guarantor** = `customers` person, same FK+snapshot pattern.
- **MCA deal** (`mca_deals`) is the source of truth for the MCA lifecycle. Optional `customer_deal_id` links a CRM deal for activities/email. Do not reuse `value_amount` as advance principal.
- Documents attach through `attachments` (`entityId` + `recordId`) and are classified in `mca_documents` (original vs stamped copy).
- Funders, matches, submissions, replies, offers, fundings, commissions, renewals, lead sources/batches, and import jobs live in this module.
- Humans pick funders. The system never auto-submits.
- Reports require `merchant_advances.reports.view` (admin/superadmin only).

### Design Decisions
| Decision | Rationale |
|----------|-----------|
| New `merchant_advances` module, not only custom fields on `customers` | Funding, submissions, and commissions are a distinct lifecycle; keeps `customers` as the stable CRUD reference |
| FK IDs + snapshots to customers/auth | Cross-module ORM is forbidden; snapshots keep list/report reads if CRM records are renamed |
| Feature ACL, not `requireRoles: ['manager']` | Role names are mutable; MCA Pilot "Managers/Reps hidden from Reports" maps to missing `reports.view` |
| Adapter interface for funder submit (`api` / `email` / `portal` / `webhook`) | 20 APIs cannot ship in one change; email+portal+webhook cover any funder on day one |
| First-class money helpers in `lib/money.ts` | Payback, payment, commission, paid-in % must be deterministic and unit-tested |
| All entities declared in foundation | Feature worktrees add APIs/UI/workers without colliding on `data/entities.ts` |

### Alternatives Considered
| Alternative | Why Rejected |
|-------------|--------------|
| Custom fields only on `customer_deals` | Cannot model submissions/offers/commissions or report CAC/ROI safely |
| App-local module under `apps/mercato/src/modules/` | Domain is core-sized; `apps/mercato/src/` must stay boilerplate except versioned generated registries |
| Auto-submit top-N funders | MCA Pilot explicitly does not auto-submit; burns funder relationships |
| Role-name page guards | Violates `auth` AGENTS.md |

## User Stories / Use Cases
- **Rep** wants a new application to land already assigned with statements attached so they can submit without re-keying.
- **Rep** wants a ranked funder list and one-click multi-funder send so they stop spraying from Gmail.
- **Rep** wants funder emails to become offer/decline/stip records so the pipeline moves without paste-work.
- **Manager** wants to see the floor pipeline and assignments but not profit/CAC reports.
- **Admin** wants lead-source ROI, funder analytics, and CSV exports of deals/offers/funded book.
- **Admin** wants duplicate-submit protection so the same merchant file is not sent twice to the same funder.

## Architecture

```
Form / zip / email intake
        │
        ▼
  mca_deals ── attachments + mca_documents
        │
        ├─► statement analysis (AI, human-reviewed)
        ├─► funder matches (scored, human-selected)
        ├─► submissions (api | email | portal | webhook)
        │       ├─► stamped statement copy
        │       └─► funder replies (raw + parsed)
        ├─► offers
        ├─► funding + payment schedule + paid-in %
        ├─► commissions / splits
        └─► renewals
```

Coupling:

- **Events** for side effects (underwriting, submit, reply, funded).
- **Widgets** to inject MCA panels onto customer company/deal detail.
- **Inbound webhooks** (`@open-mercato/webhooks`) for JotForm / GHL / Zoho / custom forms.
- **data_sync + sync_excel** patterns for bulk lead packages.
- **attachments** OCR/`content` + `ai_assistant` tools for statements and reply parsing.
- **channel_gmail / channel_imap** for connected inboxes.
- Soft-optional `tryResolve` for staff assignable roster, AI, and mail.

### Commands & Events
Commands use `merchant_advances.<entity>.<action>` (create/update/delete/transition/submit/parse).

Events (singular entity, past tense):

| Event ID | Category | Broadcast |
|----------|----------|-----------|
| `merchant_advances.deal.created` | crud | client |
| `merchant_advances.deal.updated` | crud | client |
| `merchant_advances.deal.deleted` | crud | — |
| `merchant_advances.deal.stage_changed` | lifecycle | client |
| `merchant_advances.deal.funded` | lifecycle | client |
| `merchant_advances.statement.analyzed` | lifecycle | client |
| `merchant_advances.funder.matched` | lifecycle | — |
| `merchant_advances.submission.created` | crud | client |
| `merchant_advances.submission.sent` | lifecycle | client |
| `merchant_advances.submission.failed` | lifecycle | client |
| `merchant_advances.reply.parsed` | lifecycle | client |
| `merchant_advances.offer.created` | crud | client |
| `merchant_advances.funding.created` | crud | client |
| `merchant_advances.renewal.surfaced` | lifecycle | client |
| `merchant_advances.import.completed` | lifecycle | client |

## Data Models

All tables: UUID PK, `organization_id`, `tenant_id`, `created_at`, `updated_at` (user-editable), `deleted_at` (soft delete). Prefix `mca_`.

### McaLeadSource (Singular)
- `id`, `organization_id`, `tenant_id`
- `name` (required), `code` (optional slug)
- `cost_amount` numeric(14,2), `cost_currency`
- `is_active`

### McaLeadBatch (Singular)
- `lead_source_id`
- `name`, `purchased_at`, `lead_count`, `cost_amount`, `cost_currency`
- `import_job_id` (optional)

### McaIntakeAddress (Singular)
- `email_address` (workspace-scoped private intake mailbox)
- `default_owner_user_id`, `is_active`

### McaDeal (Singular)
- `business_name` (required)
- `merchant_company_id` (UUID, customers company)
- `merchant_name_snapshot`, `merchant_state_snapshot`
- `primary_person_id` (UUID, customers person)
- `customer_deal_id` (optional UUID)
- `owner_user_id`
- `pipeline_status`: `new_app` \| `statements_in` \| `underwriting` \| `matched` \| `submitted` \| `offered` \| `contracted` \| `funded` \| `declined` \| `dead`
- `requested_amount`, `avg_monthly_revenue` numeric(14,2)
- `time_in_business_months` int
- `position` int (1st/2nd/…)
- `industry`, `state`, `ein` (encrypted)
- `legal_address` (encrypted)
- `start_date`
- `lead_source_id`, `lead_batch_id`
- `assignment_method`: `manual` \| `round_robin` \| `originator_column` \| `form_rule`

### McaDocument (Singular)
- `deal_id`
- `classification`: `statement` \| `application` \| `id` \| `voided_check` \| `tax_return` \| `other_stip`
- `attachment_id` (original)
- `stamped_attachment_id` (per-funder copy, nullable)
- `destination_funder_id` (nullable)
- `is_original` boolean

### McaStatementAnalysis (Singular)
- `deal_id`, `attachment_id`
- `avg_monthly_revenue`, `avg_daily_balance` numeric
- `deposit_count` int
- `nsf_count` int
- `negative_days` int
- `existing_positions` int
- `model`, `confidence`, `notes`
- `reviewed_by_user_id`, `reviewed_at`

### McaFunder (Singular)
- `name`, `code`
- `submit_method`: `api` \| `email` \| `portal` \| `webhook`
- `submit_email`, `portal_url`, `webhook_url`
- `api_provider_key` (optional integration id)
- `requires_unstamped_statements` boolean
- `supports_status_poll` boolean
- `is_active`
- `criteria` jsonb (appetite: industries, states, min/max revenue, max position, min TIB, max requested, …)

### McaFunderMatch (Singular)
- `deal_id`, `funder_id`
- `score` numeric(5,2) (0–100)
- `reasons` jsonb (industry fit, 1st position OK, …)
- `rank` int

### McaSubmission (Singular)
- `deal_id`, `funder_id`
- `method`, `status`: `draft` \| `queued` \| `sent` \| `accepted` \| `offered` \| `declined` \| `stips` \| `error`
- `funder_reference`
- `decline_reason`
- `validation_errors` jsonb
- `payload_snapshot` jsonb (no secrets)
- `sent_from_address`
- Unique partial index: `(tenant_id, organization_id, deal_id, funder_id) WHERE deleted_at IS NULL` for duplicate protection

### McaFunderReply (Singular)
- `submission_id`, `deal_id`
- `raw_source`: `email` \| `api` \| `manual`
- `classification`: `offer` \| `decline` \| `stip_request` \| `other`
- `raw_body` (encrypted)
- `parsed_payload` jsonb
- `confidence`

### McaOffer (Singular)
- `deal_id`, `submission_id`, `funder_id`
- `amount`, `factor`, `term_months`, `payment_amount`
- `payment_frequency`: `daily` \| `weekly` \| `monthly`
- `fees_amount`
- `commission_points`
- `stips` jsonb
- `status`: `open` \| `accepted` \| `expired` \| `withdrawn`

### McaFunding (Singular)
- `deal_id`, `offer_id`
- `funded_amount`, `funded_at`
- `term_months`, `payment_frequency`, `payment_amount`
- `payback_amount`
- `paid_in_pct` (computed, stored for list/sort)

### McaCommission (Singular)
- `funding_id`, `deal_id`
- `points`, `amount`, `currency`
- splits in `mca_commission_splits` (`user_id`, `role`, `points`, `amount`)

### McaRenewal (Singular)
- `funding_id`, `deal_id`, `merchant_company_id`
- `paid_in_pct`, `surfaced_at`, `status`: `watching` \| `due` \| `contacted` \| `renewed` \| `lost`

### McaImportJob / McaImportMapping (Singular)
- Job: source (`csv` \| `xlsx` \| `xls` \| `tsv` \| `zip` \| `gdrive` \| `email`), status, counts, `result_attachment_id`
- Mapping: `provider_name`, `column_map` jsonb, workspace-scoped

### McaWorkspaceSettings (Singular)
- One row per org/tenant
- `round_robin_cursor_user_id`
- `broker_logo_attachment_id`
- `default_from_address`
- `watermark_enabled`

## API Contracts

| Method | Path | Feature | Notes |
|--------|------|---------|-------|
| CRUD | `/api/merchant_advances/deals` | `deal.view` / `deal.manage` | `updatedAt` for optimistic lock |
| CRUD | `/api/merchant_advances/funders` | `funder.view` / `funder.manage` | Appetite criteria |
| CRUD | `/api/merchant_advances/offers` | `offer.view` / `offer.manage` | Manual fallback create |
| CRUD | `/api/merchant_advances/submissions` | `submission.view` / `submission.manage` | |
| POST | `/api/merchant_advances/submissions/send` | `submission.send` | Multi-funder; never auto |
| POST | `/api/merchant_advances/matches/refresh` | `match.manage` | Re-score deal |
| GET | `/api/merchant_advances/renewals` | `renewal.view` | Paid-in queue |
| GET | `/api/merchant_advances/reports/{rep,team,funder,leads}` | `reports.view` | Admin only |
| POST | `/api/merchant_advances/imports/preview` | `import.manage` | Review before create |
| POST | `/api/merchant_advances/imports/commit` | `import.manage` | Progress job |
| POST | `/api/merchant_advances/intake/form` | inbound webhook | JotForm/GHL/Zoho/custom |

All routes export `openApi`. Writes go through commands + mutation guards. List/detail return `updatedAt`.

## Internationalization (i18n)
Module keys under `merchant_advances.*` in `i18n/en.json`. No hardcoded user-facing strings. Internal errors prefixed `[internal]`.

## UI/UX
Backend group **MCA** (`merchant_advances.nav.group`):

| Page | Path | Feature |
|------|------|---------|
| Deals | `/backend/merchant_advances` | `deal.view` |
| Pipeline | `/backend/merchant_advances/pipeline` | `deal.view` |
| Offers | `/backend/merchant_advances/offers` | `offer.view` |
| Renewals | `/backend/merchant_advances/renewals` | `renewal.view` |
| Funders | `/backend/merchant_advances/funders` | `funder.view` |
| Reports | `/backend/merchant_advances/reports` | `reports.view` |
| Settings | `/backend/merchant_advances/settings` | `settings.manage` |

Design system: semantic status tokens, shared `DataTable` / `CrudForm` / `StatusBadge` / `EmptyState` / `LoadingMessage`. Dialogs: Cmd/Ctrl+Enter submit, Escape cancel.

Pipeline columns match `pipeline_status`. Deal detail tabs: Application, Statements, Matches, Submissions, Offers, Funding, Documents.

Reports page is omitted from the nav for users without `reports.view` (Managers and Reps).

## Configuration
- Reuse existing `OM_AI_*` provider keys for statement/reply/import mapping.
- Funder API credentials via `integrations` credentials (secret fields), never env-hardcoded in core.
- Shop sending addresses and intake mailboxes stored in workspace settings / intake addresses (encrypted).
- Optional add-ons (SMS, ACH e-sign, merchant upload links) configured at onboarding using the shop's vendor accounts.

## Migration & Compatibility
- Additive module: new tables only. No change to `customer_deals` schema.
- Optional `customer_deal_id` is a UUID, not an ORM relation.
- Enable in `apps/mercato/src/modules.ts` and `packages/create-app/template/src/modules.ts` (already depends on `@open-mercato/core`).
- Run `yarn generate` after module files are added.
- `yarn mercato auth sync-role-acls` after ACL grants.
- FROZEN contract surfaces are not removed; new ACL/event/API IDs are ADDITIVE.

## Implementation Plan

### Phase 0 — Foundation (this PR / `cursor/mca-crm-platform-5aaa`)
1. Spec + per-feature plans + worktree ledger.
2. Module scaffold: entities, validators, ACL, setup, events, encryption, ce, di, search, i18n.
3. Deterministic money / paid-in / funder-score / duplicate-check / pipeline helpers + unit tests.
4. CRUD for deals, funders, offers, submissions.
5. Backend nav pages (deals, pipeline, offers, renewals, funders, reports, settings).
6. Seed default MCA statuses + example funders.
7. Enable module in mercato + create-app template.

### Phase 1 — Intake & import (worktrees)
- Application intake connectors + secure upload links.
- Bulk lead-package import with AI mapping and review screen.

### Phase 2 — Underwrite & match (worktrees)
- AI statement analysis.
- Funder scoring UI (no auto-submit).

### Phase 3 — Submit & protect (worktrees)
- Multi-funder send (email/portal/webhook first; API adapters incremental).
- Document stamp/watermark + per-funder unstamped exception.
- Duplicate-submit guard on send.

### Phase 4 — Replies, money, renewals (worktrees)
- Inbox/API reply parsing → offers/declines/stips.
- Commission splits + funding math.
- Paid-in renewal queue.

### Phase 5 — Ops (worktrees)
- Admin reports + CSV exports.
- PWA manifest, custom notifications/webhooks, seat/address oversight.
- Optional SMS / ACH e-sign / merchant upload.

### File Manifest
| File | Action | Purpose |
|------|--------|---------|
| `packages/core/src/modules/merchant_advances/**` | Create | MCA module |
| `apps/mercato/src/modules.ts` | Modify | Enable module |
| `packages/create-app/template/src/modules.ts` | Modify | Template parity |
| `.ai/specs/mca/plans/*` | Create | Per-feature plans |

### Testing Strategy
- Unit: money, paid-in, funder score, duplicate key, pipeline transitions.
- Integration (same change as each feature): self-contained fixtures, no seeded demo data, cleanup in finally. Paths listed in each feature plan.
- ACL: Rep cannot GET reports; Admin can.

## Frontend Architecture Contract
- List/kanban/detail pages are `"use client"` because they use `DataTable`, `CrudForm`, `useT`, `useGuardedMutation`.
- Server metadata stays in `page.meta.ts` (no client bundle).
- Do not introduce a workspace-wide MCA provider; pass page data through existing backend shell.
- Hydration: no `window` at module scope; load charts only on Reports (admin) via existing dashboard widget lazy pattern if charts are added.

## Risks & Impact Review

### Data Integrity Failures
- Multi-funder send is per-submission records inside one command with per-funder try/catch: one funder validation error must not roll back others.
- Optimistic locking on deals/offers/funders/settings via `updated_at`.
- Import commit is a progress job + worker; preview creates nothing.

### Cascading Failures & Side Effects
- Submit/reply events are persistent; subscriber failure retries, does not unsend.
- Optional AI/mail peers degrade: deal still creates, analysis stays pending.

### Tenant & Data Isolation Risks
- Every query includes `tenant_id` + `organization_id`.
- Import result CSV excludes SSN / full deal dumps.
- EIN/address/raw replies encrypted.

### Migration & Deployment Risks
- New tables only; deploy without rewriting CRM deals.
- Snapshot/migration scoped to this module.

### Operational Risks
- Bulk zip import (≤1000) and Drive (≤5000) must use progress jobs, not request-thread loops.
- Daily submission poll is a scheduled worker, tenant-scoped.

### Risk Register

#### Cross-tenant deal leak
- **Scenario**: List/report omits organization filter
- **Severity**: Critical
- **Affected area**: All MCA APIs
- **Mitigation**: `makeCrudRoute` org/tenant fields; extra where clauses on custom routes; tests
- **Residual risk**: Custom report SQL must copy the same helpers

#### Accidental auto-submit
- **Scenario**: Matcher or intake auto-sends to top funders
- **Severity**: High
- **Affected area**: Submissions / funder relationships
- **Mitigation**: Send is an explicit command; matchers only write `mca_funder_matches`
- **Residual risk**: A future agent/tool must go through `prepareMutation`

#### Duplicate spray to the same funder
- **Scenario**: Rep submits the same deal twice to one funder
- **Severity**: High
- **Affected area**: Submissions
- **Mitigation**: Partial unique index + pre-send check
- **Residual risk**: Different deal records for the same merchant still need fuzzy duplicate warn (Phase 4)

#### AI mis-parse of offers
- **Scenario**: Wrong factor/amount written as an offer
- **Severity**: Medium
- **Affected area**: Offers / commissions
- **Mitigation**: Confidence + human edit; manual fallback; never auto-fund
- **Residual risk**: ~26% of emails may need manual classification (MCA Pilot case study)

#### Statement originals stamped for every funder
- **Scenario**: Watermark written onto the only copy
- **Severity**: High
- **Affected area**: Documents / funder exceptions
- **Mitigation**: Stamp a copy; keep `attachment_id` original; honor `requires_unstamped_statements`
- **Residual risk**: Attribution watermark is not a hard DRM lock (accepted, matches MCA Pilot)

## Final Compliance Report — 2026-08-29

### AGENTS.md Files Reviewed
- `AGENTS.md` (root)
- `.ai/specs/AGENTS.md`
- `packages/core/AGENTS.md`
- `packages/core/src/modules/customers/AGENTS.md`
- `packages/core/src/modules/integrations/AGENTS.md`
- `packages/core/src/modules/attachments/AGENTS.md`
- `packages/create-app/AGENTS.md`
- `BACKWARD_COMPATIBILITY.md` (additive module; no frozen removals)

### Compliance Matrix

| Rule Source | Rule | Status | Notes |
|-------------|------|--------|-------|
| root AGENTS.md | No direct ORM relationships between modules | Compliant | UUID FKs + snapshots |
| root AGENTS.md | Filter by organization_id | Compliant | All entities scoped |
| root AGENTS.md | Optimistic locking on new editable entities | Compliant | `updated_at` + `updatedAt` in APIs |
| root AGENTS.md | Never add code under `apps/mercato/src/` except generated | Compliant | Module lives in `packages/core` |
| packages/core/AGENTS.md | API routes MUST export openApi | Compliant | Planned on every route |
| packages/core/AGENTS.md | Commands for writes | Compliant | |
| packages/core/AGENTS.md | Encryption maps for PII | Compliant | EIN, address, raw reply |
| packages/core/AGENTS.md | Feature ACL + setup defaultRoleFeatures | Compliant | Reports withheld from employee |
| packages/create-app/AGENTS.md | Template module registration parity | Compliant | Enable in template `modules.ts` |
| DS rules | No hardcoded status colors | Compliant | `StatusBadge` + tokens |
| BACKWARD_COMPATIBILITY.md | Additive-only new surfaces | Compliant | New module IDs |

### Internal Consistency Check

| Check | Status | Notes |
|-------|--------|-------|
| Data models match API contracts | Pass | CRUD resources map 1:1 to entities |
| API contracts match UI/UX section | Pass | Pages listed with features |
| Risks cover all write operations | Pass | Send, import, parse, fund |
| Commands defined for all mutations | Pass | Pattern declared |
| Cache strategy covers all read APIs | Pass | CRUD indexer + post-commit invalidation |

### Non-Compliant Items
None for Phase 0 design. Live 20-funder API payloads are out of Phase 0 and tracked as provider packages.

### Verdict
- **Fully compliant**: Approved — ready for Phase 0 implementation and per-feature worktrees.

## Changelog
### [2026-08-30]
- Pilot-style shop onboarding wizard at `/backend/merchant_advances/onboarding`.
- Persists `mca_workspace_settings.onboarding` plus `plan=supercharged` and `trialEndsAt=+15 days` (no card collection).
- First-run gate redirects admin/superadmin landing to the wizard when `completedAt` is null; managers/reps see an ask-an-admin banner and cannot open the wizard.
- Settings → Setup reopens the wizard, rotates the intake secret, and shows intake / funder / sender / extras chips.
- SMS, ACH e-sign, and outbound webhook extras are config + stubs (encrypted keys, no 10DLC or e-sign ceremony).
- Events: `merchant_advances.onboarding.step_completed`, `merchant_advances.onboarding.completed`.
- Humans still pick funders; first-deal create/score/select never auto-submits.

### [2026-08-29]
- Initial specification and feature decomposition for MCA Pilot parity on Open Mercato.
