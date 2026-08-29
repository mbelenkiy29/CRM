# Bulk Deal Importing Implementation Plan

> **For agentic workers:** Worktree `cursor/mca-bulk-import-5aaa`.

**Goal:** Import purchased lead packages (spreadsheet + document folders) with AI column mapping, review, then create.

**Architecture:** Progress job + queue worker. Preview persists nothing. Commit creates deals, documents, assignments. Saved mappings on `mca_import_mappings`.

**Tech Stack:** `sync_excel` column detector, attachments, progress module, `mammoth`/`pdfjs` already in attachments.

## Global Constraints
- File types: CSV, XLSX, XLS, TSV; docs PDF/images/Word/Excel.
- Zip ≤ ~1000 leads; Google Drive ≤ ~5000 files (Drive adapter can be stubbed behind integration credentials).
- Business name required; other fields optional.
- Sheet values win over PDF fill; note when PDF filled a blank.
- Result CSV: deal links, assignments, file counts, statuses, failure reasons — **no SSNs**.
- Classify files: statements / application / more stips.

### Task 1: Mapping + folder match

**Files:**
- Create: `lib/import/detectHeaders.ts`, `lib/import/matchFiles.ts`, `lib/import/classifyFile.ts`, `lib/import/fillFromApplicationPdf.ts`
- Test: `lib/import/__tests__/*.test.ts`

**Interfaces:**
- Produces: `detectHeaderRow(rows)`, `suggestColumnMap(headers)`, `matchFilesToRows(rows, files)`, `classifyFileName(name)`, `extractApplicationFields(pdfText)`.

- [ ] **Step 1:** Unit tests for header detection, fuzzy folder names, classification keywords, EIN/address extract.
- [ ] **Step 2:** Implement without calling live LLM in unit tests (inject `suggestFn`).

### Task 2: Preview / commit APIs

**Files:**
- Create: `api/imports/preview/route.ts`, `api/imports/commit/route.ts`, `workers/import-commit.ts`
- Create: `backend/imports/page.tsx` (review screen)

- [ ] **Step 1:** Preview returns deal count, mappings, file matches, assignments, failures.
- [ ] **Step 2:** Commit uses ProgressJob; assignment round-robin or Originator column.
- [ ] **Step 3:** Attach lead source + batch.
- [ ] **Step 4:** Optional private intake email worker: parse forwarded lead, assign, reply with deal link (reuse channel_imap/gmail via tryResolve).
- [ ] **Step 5:** Integration: upload fixture CSV+PDF zip, preview, commit, export results, delete deals.
