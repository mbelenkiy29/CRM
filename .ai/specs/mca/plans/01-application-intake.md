# Application Intake Implementation Plan

> **For agentic workers:** Worktree `cursor/mca-application-intake-5aaa`. Do not edit `data/entities.ts`.

**Goal:** Instant MCA deal creation from JotForm, GoHighLevel, Zoho, or a custom form, with statements attached and auto-assignment.

**Architecture:** Inbound webhook handlers in `merchant_advances` register with `@open-mercato/webhooks`. Map 50–70 form fields into `mca_deals` + attachments. Assignment uses workspace settings (round-robin or form-mapped owner).

**Tech Stack:** webhooks inbound registry, attachments upload, `merchant_advances.deal.create` command.

## Global Constraints
- No manual re-key: all mapped fields persist on the deal.
- Secure merchant upload links are configured in onboarding (reuse customer_accounts portal upload or signed attachment URL).
- Soft-optional: if webhooks module is disabled, form route 404s cleanly.

### Task 1: Form intake command

**Files:**
- Create: `packages/core/src/modules/merchant_advances/lib/intake/formMapper.ts`
- Create: `packages/core/src/modules/merchant_advances/commands/intake.ts`
- Create: `packages/core/src/modules/merchant_advances/api/intake/form/route.ts`
- Test: `packages/core/src/modules/merchant_advances/lib/intake/__tests__/formMapper.test.ts`

**Interfaces:**
- Consumes: `McaDeal` fields from foundation validators.
- Produces: `mapFormPayload(provider, body) => IntakeMappedDeal` with `businessName` required.

- [ ] **Step 1:** Test JotForm/GHL/Zoho/custom sample payloads → business name, requested amount, revenue, TIB, owner email.
- [ ] **Step 2:** Command creates deal, optional customer company/person via customers commands (tryResolve), attaches statement URLs.
- [ ] **Step 3:** Auto-assign: honor `ownerUserId` from mapping, else round-robin from `McaWorkspaceSettings`.
- [ ] **Step 4:** Integration: POST inbound webhook creates a deal; cleanup in finally.

### Task 2: Secure upload links

**Files:**
- Create: `packages/core/src/modules/merchant_advances/lib/intake/uploadLinks.ts`
- Create: `packages/core/src/modules/merchant_advances/api/intake/upload/route.ts`

- [ ] **Step 1:** Signed, tenant-scoped upload token stored hashed; expires; writes attachments classified as statements/application.
- [ ] **Step 2:** Onboarding settings field on workspace settings page (owned by this feature's settings widget, not entities.ts — use existing `McaWorkspaceSettings` columns or ModuleConfigService).
