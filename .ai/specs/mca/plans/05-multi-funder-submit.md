# One-Click Multi-Funder Submission Implementation Plan

> **For agentic workers:** Worktree `cursor/mca-multi-funder-submit-5aaa`.

**Goal:** Select many funders on one deal and send once. Independent submission record per funder. No re-typing.

**Architecture:** `merchant_advances.submission.send` command loops funders. Router: `api` (provider package), `email`, `portal` (task), `webhook`. Validation errors stay on that submission.

**Tech Stack:** integrations credentials, messages/email channels, webhooks outbound, progress for large sends.

## Global Constraints
- Never auto-send from matcher.
- Daily poll worker for open submissions; webhook-enabled funders update in real time.
- 17/20 APIs status-capable is a future provider concern; email+portal+webhook must work now.
- Systemic failures notify via `merchant_advances.submission.failed` (ops can subscribe).
- Reps control sending addresses from onboarding/workspace settings.

### Task 1: Router + send command

**Files:**
- Create: `lib/submit/router.ts`, `lib/submit/packDocuments.ts`, `lib/submit/mapApplicationFields.ts`
- Create: `commands/submit.ts`
- Create: `api/submissions/send/route.ts`
- Create: `workers/poll-submissions.ts`
- Test: `lib/submit/__tests__/router.test.ts`

**Interfaces:**
- Produces: `submitToFunder({ deal, funder, docs, fromAddress }) => { status, funderReference, error? }`
- Document packaging: multipart | base64 | binary | secure URL (switch on funder spec jsonb).

- [ ] **Step 1:** Email path sends using configured from-address; portal path creates tracked task (`status=draft` until rep marks portal-complete).
- [ ] **Step 2:** Webhook path POSTs mapped payload with Standard Webhooks signing when possible.
- [ ] **Step 3:** API path resolves `api_provider_key` via tryResolve; missing provider → record error, continue others.
- [ ] **Step 4:** Resubmit after fix updates the same submission row.
- [ ] **Step 5:** Integration: one email funder + one webhook funder; assert two rows, one can fail independently.
