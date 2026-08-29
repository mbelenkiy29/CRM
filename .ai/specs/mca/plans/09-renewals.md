# Renewals Implementation Plan

> **For agentic workers:** Worktree `cursor/mca-renewals-5aaa`.

**Goal:** Auto-calculate paid-in % from date funded, payment frequency, and term. Surface merchants approaching renewal (e.g. 82% paid in). Past-approval follow-up list.

**Architecture:** Use foundation `calculatePaidInPct`. Scheduled worker updates `mca_fundings.paid_in_pct` and upserts `mca_renewals`.

**Tech Stack:** scheduler + queue worker, renewals list page.

## Global Constraints
- Renewal timing surfaces itself — no spreadsheet.
- Tenant-scoped sweep.

### Task 1: Paid-in sweep + lists

**Files:**
- Create: `workers/renewal-sweep.ts`
- Create: `api/renewals/route.ts`
- Modify: `backend/renewals/page.tsx`
- Test: extend `lib/__tests__/paidIn.test.ts` (funded 5 of 6 months daily → ~83%)

**Interfaces:**
- Consumes: `calculatePaidInPct`
- Produces: renewals with status `watching|due|contacted|renewed|lost`

- [ ] **Step 1:** Surface when paid-in ≥ workspace threshold (default 80) or term remaining ≤ 30 days.
- [ ] **Step 2:** Past-approval list = funded merchants without an open deal.
- [ ] **Step 3:** Integration: create funding in the past, run sweep helper, assert renewal row.
