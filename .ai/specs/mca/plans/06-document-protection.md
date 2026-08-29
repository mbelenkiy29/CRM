# Document Protection Implementation Plan

> **For agentic workers:** Worktree `cursor/mca-document-protection-5aaa`.

**Goal:** On submit, generate a stamped copy of statements with destination funder (optional broker logo). Originals stay clean. Per-funder exception for unstamped files.

**Architecture:** Hook inside submit command (event `merchant_advances.submission.created` subscriber is OK if it writes `stamped_attachment_id` before send). PDF stamp via existing PDF libs or a small worker — do not shell out.

**Tech Stack:** attachments copy + overlay; `McaFunder.requiresUnstampedStatements`; `McaWorkspaceSettings.watermarkEnabled` / logo attachment.

## Global Constraints
- Attribution / anti-reuse, not DRM.
- Works for email and API submits.
- Never overwrite `mca_documents.attachment_id`.

### Task 1: Stamp copies

**Files:**
- Create: `lib/documents/stampStatement.ts`
- Create: `subscribers/stamp-on-submit.ts`
- Test: `lib/documents/__tests__/stampStatement.test.ts` (use a tiny PDF fixture)

**Interfaces:**
- Produces: `stampStatement({ originalAttachmentId, funderName, logoAttachmentId | null }) => stampedAttachmentId`

- [ ] **Step 1:** If `requiresUnstampedStatements`, skip stamp and send original.
- [ ] **Step 2:** Write `mca_documents` row with `is_original=false`, `destination_funder_id`.
- [ ] **Step 3:** Integration: submit with watermark on; original hash unchanged; stamped attachment exists.
