# Pipeline, Deals, and Offers UI Implementation Plan

> **For agentic workers:** Worktree `cursor/mca-pipeline-offers-5aaa`.

**Goal:** Kanban of every MCA deal, search/filter, submissions on the deal, offer records, manual fallback, CSV export of filtered deals/offers. Full lifecycle new app → submitted → offered → funded.

**Architecture:** Enhance foundation pages (do not rewrite entities). Reuse `DataTable` export and customers kanban patterns.

**Tech Stack:** `@open-mercato/ui` DataTable, CrudForm, StatusBadge, FilterBar.

## Global Constraints
- Manual fallback: mark declines, paste responses, add offers by hand (offers CRUD already exists).
- pageSize ≤ 100.
- DS tokens only.

### Task 1: Kanban + deal detail

**Files:**
- Modify: `backend/pipeline/page.tsx`, `backend/page.tsx`, add `backend/[id]/page.tsx`
- Create: `backend/components/DealKanban.tsx`, `OfferEditor.tsx`, `SubmissionTable.tsx`

- [ ] **Step 1:** Columns = pipeline statuses; drag uses `useGuardedMutation` + optimistic lock header.
- [ ] **Step 2:** Deal detail tabs from master spec.
- [ ] **Step 3:** Export filtered deals/offers CSV via DataTable export (no SSN columns).
- [ ] **Step 4:** Integration: create deal, move stage, add manual offer, export.
