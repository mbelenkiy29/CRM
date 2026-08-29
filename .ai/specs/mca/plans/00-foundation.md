# Foundation Implementation Plan

> **For agentic workers:** Use this plan on `cursor/mca-crm-platform-5aaa`. Later worktrees branch from this commit.

**Goal:** Ship the `merchant_advances` module with the full data model, ACL, math helpers, CRUD for deals/funders/offers/submissions, and MCA nav pages.

**Architecture:** Copy `warranty_claims` + `customers` file layout. Entities are the contract for every other feature.

**Tech Stack:** MikroORM v7 legacy decorators, zod, `makeCrudRoute`, `createModuleEvents`.

## Global Constraints

Inherited from `.ai/specs/2026-08-29-mca-crm-platform.md`. Do not add funder API adapters, AI prompts, or import workers here.

### Task 1: Module scaffold + entities

**Files:**
- Create: `packages/core/src/modules/merchant_advances/index.ts`
- Create: `packages/core/src/modules/merchant_advances/data/entities.ts`
- Create: `packages/core/src/modules/merchant_advances/data/validators.ts`
- Create: `packages/core/src/modules/merchant_advances/data/constants.ts`
- Create: `packages/core/src/modules/merchant_advances/acl.ts`
- Create: `packages/core/src/modules/merchant_advances/setup.ts`
- Create: `packages/core/src/modules/merchant_advances/events.ts`
- Create: `packages/core/src/modules/merchant_advances/encryption.ts`
- Create: `packages/core/src/modules/merchant_advances/ce.ts`
- Create: `packages/core/src/modules/merchant_advances/di.ts`
- Create: `packages/core/src/modules/merchant_advances/AGENTS.md`

**Interfaces:**
- Produces: all entity class names in the master spec Data Models section.

- [ ] **Step 1:** Add entities with UUID PK, org/tenant, timestamps, soft delete, `updated_at` on user-editable rows.
- [ ] **Step 2:** ACL features: `deal.view/manage`, `funder.view/manage`, `offer.view/manage`, `submission.view/manage/send`, `match.manage`, `import.manage`, `renewal.view`, `reports.view`, `settings.manage`.
- [ ] **Step 3:** `setup.defaultRoleFeatures`: admin gets `merchant_advances.*`; employee gets deal/offer/submission/renewal/funder.view — **not** `reports.view`.
- [ ] **Step 4:** Encryption maps for `ein`, `legal_address`, `raw_body` on replies.

### Task 2: Deterministic math

**Files:**
- Create: `packages/core/src/modules/merchant_advances/lib/money.ts`
- Create: `packages/core/src/modules/merchant_advances/lib/paidIn.ts`
- Create: `packages/core/src/modules/merchant_advances/lib/funderScore.ts`
- Create: `packages/core/src/modules/merchant_advances/lib/duplicateCheck.ts`
- Create: `packages/core/src/modules/merchant_advances/lib/pipeline.ts`
- Test: `packages/core/src/modules/merchant_advances/lib/__tests__/*.test.ts`

**Interfaces:**
- Produces: `calculatePayback(amount, factor)`, `calculatePayment(payback, termMonths, frequency)`, `calculateCommission(fundedAmount, points)`, `calculatePaidInPct({ fundedAt, frequency, termMonths, now })`, `scoreFunder(deal, funder)`, `assertUniqueSubmission(existing, dealId, funderId)`, `assertStageTransition(from, to)`.

- [ ] **Step 1:** Write failing unit tests for the formulas (amount 75000 × 1.32 = 99000 payback; 10 points of 75000 = 7500; daily payment over 6 months).
- [ ] **Step 2:** Implement helpers with decimal strings, no `any`.
- [ ] **Step 3:** Run `yarn workspace @open-mercato/core test -- merchant_advances/lib`

### Task 3: CRUD + pages + enable

**Files:**
- Create: `api/openapi.ts`, `api/deals/route.ts`, `api/funders/route.ts`, `api/offers/route.ts`, `api/submissions/route.ts`
- Create: `commands/deals.ts`, `commands/funders.ts`
- Create: backend pages listed in the master spec UI/UX table
- Create: `i18n/en.json`
- Create: SQL migration
- Modify: `apps/mercato/src/modules.ts`, `packages/create-app/template/src/modules.ts`

- [ ] **Step 1:** `makeCrudRoute` with `indexer.entityType`, `updatedAt` in transform.
- [ ] **Step 2:** Pages use `useT`, `DataTable`/`CrudForm`, reports page `requireFeatures: ['merchant_advances.reports.view']`.
- [ ] **Step 3:** `yarn generate` then keep only this module's migration if `yarn db:generate` is used.
- [ ] **Step 4:** Enable `{ id: 'merchant_advances', from: '@open-mercato/core' }` in both module registries.
